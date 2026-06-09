import { load } from "cheerio";
import { z } from "zod";
import { isTargetJob } from "../domain/job-relevance";
import { ApiError, parseOptionalDate } from "../lib/http";
import { getDefaultUser, prisma } from "../lib/prisma";
import { ScoringService } from "./scoring.service";
import { SourceService } from "./source.service";

const optionalLimitSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(1).optional()
);

export const publicJobImportSchema = z.object({
  sourceId: z.string().min(1),
  keyword: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  location: z.string().optional(),
  workplaceType: z.string().optional(),
  limit: optionalLimitSchema,
  includeDetails: z.boolean().default(true),
  todayOnly: z.boolean().default(false),
  strictRelevance: z.boolean().default(true),
  targetDate: z.string().optional()
});

export const publicJobImportAllSchema = publicJobImportSchema
  .omit({ sourceId: true })
  .extend({
    sourceIds: z.array(z.string()).optional(),
    limitPerSource: optionalLimitSchema,
    todayOnly: z.boolean().default(true)
  });

type PublicJobInput = {
  sourceId: string;
  sourceName: string;
  title: string;
  company: string;
  location?: string | null;
  workplaceType?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  description: string;
  salaryText?: string | null;
  seniority?: string | null;
  jobType?: string | null;
  postedDate?: string | null;
  deadline?: string | null;
  notes?: string | null;
};

type XpressJobItem = {
  jobId: number;
  jobTitle: string;
  organizationName: string;
  overview?: string;
  expiryDateOnWebsite?: string;
  jobType?: string;
  locations?: string;
  remote?: boolean;
  recordCount?: number;
};

type XpressJobDetails = {
  jobInfo?: string;
  salaryRange?: string;
  createdDate?: string;
  jobItem?: XpressJobItem;
};

type RoosterSearchResponse = {
  body?: {
    count?: number;
    data?: RoosterJobItem[];
  };
};

type RoosterJobItem = {
  id: number;
  title: string;
  description?: string | null;
  company_name?: string | null;
  subsidiary_company_name?: string | null;
  location?: string | null;
  remote?: boolean | null;
  job_type?: string | null;
  created_at?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  salary_frequency?: string | null;
  salary_currency?: string | null;
  class?: string | null;
  subclass?: string | null;
  department?: string | null;
  tags?: string[];
};

type ItProJobItem = {
  id: string | number;
  title: string;
  description?: string | null;
  summary?: string | null;
  type_id?: string | number | null;
  category_id?: string | number | null;
  location?: string | number | null;
  company?: string | null;
  website?: string | null;
  created_on?: string | null;
};

const publicImporterSourceIds = new Set(["xpressjobs", "topjobs", "rooster", "itpro"]);
const defaultPublicApiPageSize = 1000;
const defaultXpressPageSize = 100;
const sriLankaTimeZone = "Asia/Colombo";
const itProJobTypes: Record<string, string> = {
  "1": "Full-time",
  "2": "Part-time",
  "3": "Freelance",
  "4": "Internship"
};
const itProCategories: Record<string, string> = {
  "19": "Hardware and Networking",
  "20": "Management and Business",
  "21": "Software Engineering",
  "39": "Quality Assurance",
  "40": "Digital Marketing",
  "41": "Mobile Development",
  "42": "Web Development"
};
function htmlToText(html: string) {
  return load(html).text().replace(/\s+/g, " ").trim();
}

function uniqueKeywords(input: z.infer<typeof publicJobImportSchema>) {
  const keywords = [
    ...(input.keywords ?? []),
    ...(input.keyword ? [input.keyword] : [])
  ].map((keyword) => keyword.trim()).filter(Boolean);

  return Array.from(new Set(keywords.length > 0 ? keywords : [""]));
}

function absoluteUrl(baseUrl: string, url: string) {
  return new URL(url, baseUrl).toString();
}

function parseTopJobsPopupHref(href: string) {
  const match = href.match(/openSizeWindow\('([^']+)'/);
  return match?.[1] ?? href;
}

function cleanText(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: sriLankaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function dateKeyFromValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const directDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (directDate) return directDate;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return localDateKey(parsed);
}

function filterByImportDate(
  jobs: PublicJobInput[],
  input: Pick<z.infer<typeof publicJobImportSchema>, "todayOnly" | "targetDate">
) {
  if (!input.todayOnly) return jobs;

  const targetDate = targetImportDateKey(input);
  return jobs.filter((job) => {
    const postedDate = dateKeyFromValue(job.postedDate);
    return postedDate ? postedDate === targetDate : false;
  });
}

function targetImportDateKey(
  input: Pick<z.infer<typeof publicJobImportSchema>, "targetDate">
) {
  return dateKeyFromValue(input.targetDate) ?? localDateKey();
}

function mayHaveMoreTargetDatedJobs(
  jobs: PublicJobInput[],
  input: Pick<z.infer<typeof publicJobImportSchema>, "todayOnly" | "targetDate">
) {
  if (!input.todayOnly || jobs.length === 0) return false;

  const targetDate = targetImportDateKey(input);
  const dates = jobs
    .map((job) => dateKeyFromValue(job.postedDate))
    .filter((date): date is string => Boolean(date));

  if (dates.length === 0) return true;
  return dates.every((date) => date >= targetDate);
}

function formatRoosterSalary(job: RoosterJobItem) {
  const values = [job.min_salary, job.max_salary]
    .filter((value): value is number => typeof value === "number")
    .map((value) => value.toLocaleString("en-US"));

  if (values.length === 0) return undefined;

  const range = values.length === 2 ? `${values[0]} - ${values[1]}` : values[0];
  return [job.salary_currency, range, job.salary_frequency ? `per ${job.salary_frequency}` : undefined]
    .filter(Boolean)
    .join(" ");
}

function parseItProSummary(summary: string | null | undefined) {
  const match = cleanText(summary).match(/\bin\s+([^,]+),\s+([^.]+)\.\s+Apply/i);
  return {
    location: match?.[1]?.trim(),
    jobType: match?.[2]?.trim()
  };
}

function parseJsonLdJob(html: string) {
  const $ = load(html);
  const jsonBlocks = $('script[type="application/ld+json"]')
    .map((_index, element) => $(element).text())
    .get();

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block) as {
        "@type"?: string;
        title?: string;
        description?: string;
        datePosted?: string;
        validThrough?: string;
        hiringOrganization?: { name?: string };
        jobLocation?: Array<{
          address?: {
            addressLocality?: string;
            addressRegion?: string;
            addressCountry?: string;
          };
        }>;
      };

      if (parsed["@type"] === "JobPosting" || parsed.title) {
        const address = parsed.jobLocation?.[0]?.address;
        const location = [address?.addressLocality, address?.addressRegion, address?.addressCountry]
          .filter(Boolean)
          .join(", ");

        return {
          title: parsed.title,
          company: parsed.hiringOrganization?.name,
          description: htmlToText(parsed.description ?? ""),
          postedDate: parsed.datePosted,
          deadline: parsed.validThrough,
          location
        };
      }
    } catch {
      // Some pages include non-JSON script content; ignore and keep parsing.
    }
  }

  return null;
}

export class PublicJobImportService {
  private sourceService = new SourceService();
  private scoringService = new ScoringService();

  async importJobs(input: z.infer<typeof publicJobImportSchema>) {
    const source = await this.sourceService.get(input.sourceId);
    if (!source.enabled) {
      throw new ApiError(400, `${source.name} is disabled.`);
    }

    const jobs =
      source.id === "xpressjobs"
        ? await this.fetchXpressJobs(input)
        : source.id === "topjobs"
          ? await this.fetchTopJobs(input)
          : source.id === "rooster"
            ? await this.fetchRoosterJobs(input)
            : source.id === "itpro"
              ? await this.fetchItProJobs(input)
              : [];

    if (jobs.length === 0 && !publicImporterSourceIds.has(source.id)) {
      throw new ApiError(400, `${source.name} does not have a public importer yet.`);
    }

    const datedJobs = filterByImportDate(jobs, input);
    const targetKeywords = await this.relevanceKeywordsFor(input);
    const eligibleJobs = input.strictRelevance
      ? datedJobs.filter((job) => isTargetJob(job, { targetKeywords }))
      : datedJobs;
    const filteredCount = datedJobs.length - eligibleJobs.length;
    const jobsToSave = input.limit ? eligibleJobs.slice(0, input.limit) : eligibleJobs;
    const saved = [];
    const skipped = [];

    for (const job of jobsToSave) {
      const result = await this.saveImportedJob(job);
      if (result.created) {
        saved.push(result.job);
      } else {
        skipped.push(result.job);
      }
    }

    return {
      source,
      importedCount: saved.length,
      skippedCount: skipped.length,
      filteredCount,
      jobs: saved,
      skipped
    };
  }

  async importAllJobs(input: z.infer<typeof publicJobImportAllSchema>) {
    const sources = await this.sourceService.list();
    const sourceIdFilter = new Set(input.sourceIds ?? []);
    const importableSources = sources.filter(
      (source) =>
        source.enabled &&
        publicImporterSourceIds.has(source.id) &&
        (sourceIdFilter.size === 0 || sourceIdFilter.has(source.id))
    );

    if (importableSources.length === 0) {
      throw new ApiError(400, "No enabled public job sources are available for import.");
    }

    const keywords = uniqueKeywords({
      ...input,
      sourceId: importableSources[0].id
    });
    const importKeywords = keywords.filter(Boolean);
    const limit = input.limitPerSource ?? input.limit;
    const sourceResults = [];
    const errors = [];
    const jobs = [];
    const skipped = [];
    let filteredCount = 0;

    for (const source of importableSources) {
      try {
        const result = await this.importJobs({
          ...input,
          sourceId: source.id,
          keywords: importKeywords,
          limit,
          todayOnly: input.todayOnly
        });

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
          filteredCount: result.filteredCount
        });
        jobs.push(...result.jobs);
        skipped.push(...result.skipped);
        filteredCount += result.filteredCount;
      } catch (error) {
        errors.push({
          sourceId: source.id,
          sourceName: source.name,
          error: error instanceof Error ? error.message : "Import failed"
        });
      }
    }

    return {
      importedCount: jobs.length,
      skippedCount: skipped.length,
      filteredCount,
      jobs,
      skipped,
      sources: sourceResults,
      errors
    };
  }

  private async fetchXpressJobs(input: z.infer<typeof publicJobImportSchema>): Promise<PublicJobInput[]> {
    const jobs: PublicJobInput[] = [];
    const keywords = uniqueKeywords(input);
    const shouldFetchDetails = input.includeDetails || input.todayOnly;

    for (const keyword of keywords) {
      let page = 1;
      let fetchedForKeyword = 0;
      let totalForKeyword: number | undefined;

      while (true) {
        const url = new URL("https://xpress.jobs/api/jobs/searchJobs");
        if (keyword) url.searchParams.set("KeyWord", keyword);
        if (input.location) url.searchParams.set("Location", input.location);
        url.searchParams.set("page", String(page));
        url.searchParams.set("pageSize", String(defaultXpressPageSize));

        const response = await fetch(url);
        if (!response.ok) {
          throw new ApiError(response.status, `XpressJobs import failed for "${keyword}".`);
        }

        const payload = (await response.json()) as { value?: XpressJobItem[] } | XpressJobItem[];
        const items = Array.isArray(payload) ? payload : payload.value ?? [];
        if (items.length === 0) break;

        totalForKeyword ??= items[0]?.recordCount;
        fetchedForKeyword += items.length;

        const pageJobs: PublicJobInput[] = [];
        for (const item of items) {
          const details = shouldFetchDetails ? await this.fetchXpressJobDetails(item.jobId) : null;
          const detailItem = details?.jobItem ?? item;
          const description = details?.jobInfo ? htmlToText(details.jobInfo) : cleanText(item.overview);
          const jobUrl = `https://xpress.jobs/jobs/view/${item.jobId}`;

          pageJobs.push({
            sourceId: "xpressjobs",
            sourceName: "XpressJobs",
            title: detailItem.jobTitle,
            company: cleanText(detailItem.organizationName),
            location: cleanText(detailItem.locations),
            workplaceType: detailItem.remote ? "remote" : undefined,
            jobUrl,
            applyUrl: jobUrl,
            description: description || cleanText(item.overview) || detailItem.jobTitle,
            salaryText: details?.salaryRange,
            jobType: detailItem.jobType,
            postedDate: details?.createdDate,
            deadline: detailItem.expiryDateOnWebsite,
            notes: `Imported from XpressJobs public API. External job ID: ${item.jobId}`
          });
        }

        jobs.push(...pageJobs);

        if (input.limit && jobs.length >= input.limit) break;
        if (input.todayOnly && !mayHaveMoreTargetDatedJobs(pageJobs, input)) break;
        if (totalForKeyword && fetchedForKeyword >= totalForKeyword) break;
        if (items.length < defaultXpressPageSize) break;

        page += 1;
      }

      if (input.limit && jobs.length >= input.limit) break;
    }

    return this.dedupePublicJobs(jobs);
  }

  private async fetchXpressJobDetails(jobId: number) {
    try {
      const response = await fetch(`https://xpress.jobs/api/jobs/publishedJob?jobId=${jobId}`);
      if (!response.ok) return null;
      return (await response.json()) as XpressJobDetails;
    } catch {
      return null;
    }
  }

  private async fetchTopJobs(input: z.infer<typeof publicJobImportSchema>): Promise<PublicJobInput[]> {
    const response = await fetch("https://www.topjobs.lk/");
    if (!response.ok) {
      throw new ApiError(response.status, "TopJobs import failed.");
    }

    const keywordFilter = uniqueKeywords(input)
      .filter(Boolean)
      .map((keyword) => keyword.toLowerCase());
    const $ = load(await response.text());
    const jobs: PublicJobInput[] = [];

    $("span.job-link a").each((_index, element) => {
      const link = $(element);
      const company = cleanText(link.find("h5").first().text());
      link.find("h5").remove();
      const title = cleanText(link.text());
      const popupUrl = parseTopJobsPopupHref(link.attr("href") ?? "");
      const jobUrl = absoluteUrl("https://www.topjobs.lk/", popupUrl);

      if (!title || !company || !jobUrl) return;
      if (
        keywordFilter.length > 0 &&
        !keywordFilter.some((keyword) =>
          `${title} ${company}`.toLowerCase().includes(keyword)
        )
      ) {
        return;
      }

      jobs.push({
        sourceId: "topjobs",
        sourceName: "TopJobs.lk",
        title,
        company,
        jobUrl,
        applyUrl: jobUrl,
        description: `${title} at ${company}. Imported from the TopJobs public listing page.`,
        notes: "Imported from TopJobs public listing page."
      });
    });

    const slicedJobs = this.dedupePublicJobs(jobs).slice(0, input.limit);
    if (!input.includeDetails && !input.todayOnly) {
      return slicedJobs;
    }

    return Promise.all(
      slicedJobs.map(async (job) => {
        const details = await this.fetchTopJobsDetails(job.jobUrl ?? "");
        return {
          ...job,
          title: details?.title ?? job.title,
          company: details?.company ?? job.company,
          location: details?.location ?? job.location,
          description: details?.description || job.description,
          postedDate: details?.postedDate ?? job.postedDate,
          deadline: details?.deadline ?? job.deadline
        };
      })
    );
  }

  private async fetchTopJobsDetails(jobUrl: string) {
    try {
      const response = await fetch(jobUrl);
      if (!response.ok) return null;
      return parseJsonLdJob(await response.text());
    } catch {
      return null;
    }
  }

  private async fetchRoosterJobs(input: z.infer<typeof publicJobImportSchema>): Promise<PublicJobInput[]> {
    const keywords = uniqueKeywords(input).filter(Boolean);
    const pageSize = input.limit ?? defaultPublicApiPageSize;
    const jobs: PublicJobInput[] = [];
    let page = 1;
    let totalCount: number | undefined;

    while (true) {
      const body = {
        query: keywords,
        limit: pageSize,
        page,
        filters: {
          remote: input.workplaceType === "remote" ? true : undefined,
          country: input.location?.toLowerCase().includes("sri lanka") ? "Sri Lanka" : undefined
        }
      };

      const response = await fetch("https://api.rooster.jobs/jobSearch/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new ApiError(response.status, "Rooster import failed.");
      }

      const payload = (await response.json()) as RoosterSearchResponse;
      totalCount ??= payload.body?.count;

      const pageJobs = (payload.body?.data ?? []).map((item) => {
        const jobUrl = `https://rooster.jobs/jobs/${item.id}`;
        const company = cleanText(item.subsidiary_company_name ?? item.company_name);
        const tags = item.tags?.filter(Boolean).join(", ");

        return {
          sourceId: "rooster",
          sourceName: "Rooster",
          title: cleanText(item.title),
          company: company || "Unknown company",
          location: cleanText(item.location),
          workplaceType: item.remote ? "remote" : undefined,
          jobUrl,
          applyUrl: jobUrl,
          description: cleanText(item.description) || cleanText(item.title),
          salaryText: formatRoosterSalary(item),
          jobType: item.job_type,
          postedDate: item.created_at,
          notes: [
            "Imported from Rooster public job search API.",
            item.class ? `Class: ${item.class}` : undefined,
            item.subclass ? `Subclass: ${item.subclass}` : undefined,
            item.department ? `Department: ${item.department}` : undefined,
            tags ? `Tags: ${tags}` : undefined,
            `External job ID: ${item.id}`
          ].filter(Boolean).join(" ")
        };
      });

      if (pageJobs.length === 0) break;

      jobs.push(...pageJobs);

      if (input.limit && jobs.length >= input.limit) break;
      if (input.todayOnly && !mayHaveMoreTargetDatedJobs(pageJobs, input)) break;
      if (totalCount && page * pageSize >= totalCount) break;

      page += 1;
    }

    return this.dedupePublicJobs(jobs).filter((job) => job.title && job.company);
  }

  private async fetchItProJobs(input: z.infer<typeof publicJobImportSchema>): Promise<PublicJobInput[]> {
    let fetchLimit = input.limit ?? defaultPublicApiPageSize;
    let payload: ItProJobItem[] = [];
    let previousCount = 0;

    while (true) {
      const url = new URL("https://itpro.lk/api/v1/jobs");
      url.searchParams.set("limit", String(fetchLimit));

      const response = await fetch(url);
      if (!response.ok) {
        throw new ApiError(response.status, "ITPro.lk import failed.");
      }

      payload = (await response.json()) as ItProJobItem[];
      if (input.limit) break;
      if (payload.length === 0 || payload.length < fetchLimit || payload.length === previousCount) break;

      const pageJobs = payload.map((item) => this.toItProPublicJob(item));
      if (input.todayOnly && !mayHaveMoreTargetDatedJobs(pageJobs, input)) break;

      previousCount = payload.length;
      fetchLimit *= 2;
    }

    const keywordFilter = uniqueKeywords(input)
      .filter(Boolean)
      .map((keyword) => keyword.toLowerCase());
    const locationFilter = input.location?.trim().toLowerCase();
    const jobs = payload.map((item) => this.toItProPublicJob(item));

    return this.dedupePublicJobs(jobs).filter((job) => {
      if (!job.title || !job.company) return false;
      const searchable = `${job.title} ${job.company} ${job.location ?? ""} ${job.description}`.toLowerCase();
      if (keywordFilter.length > 0 && !keywordFilter.some((keyword) => searchable.includes(keyword))) {
        return false;
      }
      if (locationFilter && !String(job.location ?? "").toLowerCase().includes(locationFilter)) {
        return false;
      }
      return true;
    });
  }

  private toItProPublicJob(item: ItProJobItem): PublicJobInput {
    const parsedSummary = parseItProSummary(item.summary);
    const category = itProCategories[String(item.category_id ?? "")];
    const jobType = parsedSummary.jobType ?? itProJobTypes[String(item.type_id ?? "")];
    const location = parsedSummary.location ?? cleanText(String(item.location ?? ""));
    const jobUrl = `https://itpro.lk/job/${item.id}/`;
    const description = htmlToText(item.description ?? "") || cleanText(item.summary) || item.title;

    return {
      sourceId: "itpro",
      sourceName: "ITPro.lk",
      title: cleanText(item.title),
      company: cleanText(item.company) || "Unknown company",
      location,
      workplaceType: location.toLowerCase() === "remote" ? "remote" : undefined,
      jobUrl,
      applyUrl: jobUrl,
      description,
      jobType,
      postedDate: item.created_on,
      notes: [
        "Imported from ITPro.lk public jobs API.",
        category ? `Category: ${category}` : undefined,
        item.website ? `Company website: ${item.website}` : undefined,
        `External job ID: ${item.id}`
      ].filter(Boolean).join(" ")
    };
  }

  private dedupePublicJobs(jobs: PublicJobInput[]) {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = job.jobUrl ?? `${job.sourceId}:${job.title}:${job.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async relevanceKeywordsFor(input: z.infer<typeof publicJobImportSchema>) {
    const explicitKeywords = uniqueKeywords(input).filter(Boolean);
    return explicitKeywords.length > 0 ? explicitKeywords : await this.enabledKeywordValues();
  }

  private async enabledKeywordValues() {
    const user = await getDefaultUser();
    const keywords = await prisma.keyword.findMany({
      where: { userId: user.id, enabled: true },
      orderBy: [{ priority: "desc" }, { keyword: "asc" }]
    });

    return keywords.map((keyword) => keyword.keyword);
  }

  private async saveImportedJob(job: PublicJobInput) {
    const user = await getDefaultUser();
    const existing = await prisma.job.findFirst({
      where: {
        userId: user.id,
        OR: [
          ...(job.jobUrl ? [{ jobUrl: job.jobUrl }] : []),
          {
            sourceId: job.sourceId,
            title: job.title,
            company: job.company
          }
        ]
      }
    });

    if (existing) {
      return { created: false, job: existing };
    }

    const score = await this.scoringService.scoreJob(job);

    const created = await prisma.job.create({
      data: {
        userId: user.id,
        sourceId: job.sourceId,
        sourceName: job.sourceName,
        title: job.title,
        company: job.company,
        location: job.location,
        workplaceType: job.workplaceType,
        jobUrl: job.jobUrl,
        applyUrl: job.applyUrl,
        description: job.description,
        salaryText: job.salaryText,
        seniority: job.seniority,
        jobType: job.jobType,
        postedDate: parseOptionalDate(job.postedDate),
        deadline: parseOptionalDate(job.deadline),
        notes: job.notes,
        ...score
      }
    });

    return { created: true, job: created };
  }
}
