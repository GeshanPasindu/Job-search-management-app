import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isTargetJob } from "../domain/job-relevance";
import { ApiError, parseOptionalDate } from "../lib/http";
import { getDefaultUser, prisma } from "../lib/prisma";
import { ScoringService } from "./scoring.service";
import { SourceService } from "./source.service";

export const jobInputSchema = z.object({
  sourceId: z.string().optional().nullable(),
  sourceName: z.string().optional().nullable(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().nullable(),
  workplaceType: z.string().optional().nullable(),
  jobUrl: z.string().optional().nullable(),
  applyUrl: z.string().optional().nullable(),
  applyEmail: z.string().optional().nullable(),
  description: z.string().min(1),
  salaryText: z.string().optional().nullable(),
  seniority: z.string().optional().nullable(),
  jobType: z.string().optional().nullable(),
  postedDate: z.unknown().optional(),
  deadline: z.unknown().optional(),
  status: z.string().optional(),
  notes: z.string().optional().nullable()
});

export const manualImportSchema = jobInputSchema.partial().extend({
  rawText: z.string().optional(),
  description: z.string().optional()
});

export type JobInput = z.infer<typeof jobInputSchema>;
export type ManualImportInput = z.infer<typeof manualImportSchema>;

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function fieldFromText(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`^\\s*${label}\\s*[:\\-]\\s*(.+)$`, "im");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }

  return undefined;
}

function firstUrl(text: string) {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function firstEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function firstNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function extractManualFields(input: ManualImportInput): JobInput {
  const rawText = input.rawText ?? input.description ?? "";
  const description = input.description ?? rawText;

  return {
    sourceId: input.sourceId ?? fieldFromText(rawText, ["source id", "source"]),
    sourceName: input.sourceName ?? fieldFromText(rawText, ["source name", "source"]),
    title:
      input.title ??
      fieldFromText(rawText, ["job title", "title", "position", "role"]) ??
      firstNonEmptyLine(rawText) ??
      "Untitled job",
    company: input.company ?? fieldFromText(rawText, ["company", "employer"]) ?? "Unknown company",
    location: input.location ?? fieldFromText(rawText, ["location", "job location"]),
    workplaceType: input.workplaceType ?? fieldFromText(rawText, ["workplace type", "remote"]),
    jobUrl: input.jobUrl ?? fieldFromText(rawText, ["job url", "posting url"]) ?? firstUrl(rawText),
    applyUrl: input.applyUrl ?? fieldFromText(rawText, ["apply url", "application url"]) ?? firstUrl(rawText),
    applyEmail: input.applyEmail ?? fieldFromText(rawText, ["apply email", "email"]) ?? firstEmail(rawText),
    description: description || rawText || "No description provided.",
    salaryText: input.salaryText ?? fieldFromText(rawText, ["salary", "salary range", "compensation"]),
    seniority: input.seniority ?? fieldFromText(rawText, ["seniority", "experience"]),
    jobType: input.jobType ?? fieldFromText(rawText, ["job type", "employment type"]),
    postedDate: input.postedDate ?? fieldFromText(rawText, ["posted", "date posted"]),
    deadline: input.deadline ?? fieldFromText(rawText, ["deadline", "closing date"]),
    status: input.status ?? "New",
    notes: input.notes
  };
}

export class JobService {
  private scoringService = new ScoringService();
  private sourceService = new SourceService();

  async list(query: Record<string, unknown>) {
    const user = await getDefaultUser();
    const where: Prisma.JobWhereInput = { userId: user.id };
    const search = typeof query.search === "string" ? query.search.trim() : "";

    if (query.status) where.status = String(query.status);
    if (query.sourceId) where.sourceId = String(query.sourceId);
    if (query.category) where.matchingCategory = String(query.category);
    if (query.workplaceType) where.workplaceType = String(query.workplaceType);
    if (query.location) {
      where.location = { contains: String(query.location), mode: "insensitive" };
    }
    if (query.minScore || query.maxScore) {
      where.score = {
        ...(query.minScore ? { gte: Number(query.minScore) } : {}),
        ...(query.maxScore ? { lte: Number(query.maxScore) } : {})
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
      ];
    }

    const sort = String(query.sort ?? "createdAt");
    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      sort === "score"
        ? [{ score: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

    const jobs = await prisma.job.findMany({
      where,
      orderBy
    });
    const visibleJobs = String(query.includeOffTarget ?? "") === "true"
      ? jobs
      : jobs.filter((job) => isTargetJob(job));
    return query.limit ? visibleJobs.slice(0, Number(query.limit)) : visibleJobs;
  }

  async get(id: string) {
    const user = await getDefaultUser();
    const job = await prisma.job.findFirst({
      where: { id, userId: user.id },
      include: { packages: true, applications: true }
    });
    if (!job) {
      throw new ApiError(404, "Job was not found.");
    }

    return job;
  }

  async create(input: JobInput) {
    const user = await getDefaultUser();
    const source = input.sourceId ? await this.findSource(input.sourceId) : null;
    const score = await this.scoringService.scoreJob(input);

    return prisma.job.create({
      data: {
        userId: user.id,
        sourceId: emptyToNull(input.sourceId),
        sourceName: emptyToNull(input.sourceName) ?? source?.name ?? null,
        title: input.title,
        company: input.company,
        location: emptyToNull(input.location),
        workplaceType: emptyToNull(input.workplaceType),
        jobUrl: emptyToNull(input.jobUrl),
        applyUrl: emptyToNull(input.applyUrl),
        applyEmail: emptyToNull(input.applyEmail),
        description: input.description,
        salaryText: emptyToNull(input.salaryText),
        seniority: emptyToNull(input.seniority),
        jobType: emptyToNull(input.jobType),
        postedDate: parseOptionalDate(input.postedDate),
        deadline: parseOptionalDate(input.deadline),
        status: input.status ?? "New",
        notes: emptyToNull(input.notes),
        ...score
      }
    });
  }

  async update(id: string, input: Partial<JobInput>) {
    const user = await getDefaultUser();
    await this.ensureOwnedJob(id, user.id);

    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...(input.sourceId !== undefined ? { sourceId: emptyToNull(input.sourceId) } : {}),
        ...(input.sourceName !== undefined ? { sourceName: emptyToNull(input.sourceName) } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.location !== undefined ? { location: emptyToNull(input.location) } : {}),
        ...(input.workplaceType !== undefined ? { workplaceType: emptyToNull(input.workplaceType) } : {}),
        ...(input.jobUrl !== undefined ? { jobUrl: emptyToNull(input.jobUrl) } : {}),
        ...(input.applyUrl !== undefined ? { applyUrl: emptyToNull(input.applyUrl) } : {}),
        ...(input.applyEmail !== undefined ? { applyEmail: emptyToNull(input.applyEmail) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.salaryText !== undefined ? { salaryText: emptyToNull(input.salaryText) } : {}),
        ...(input.seniority !== undefined ? { seniority: emptyToNull(input.seniority) } : {}),
        ...(input.jobType !== undefined ? { jobType: emptyToNull(input.jobType) } : {}),
        ...(input.postedDate !== undefined ? { postedDate: parseOptionalDate(input.postedDate) } : {}),
        ...(input.deadline !== undefined ? { deadline: parseOptionalDate(input.deadline) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {})
      }
    });

    if (
      input.title !== undefined ||
      input.description !== undefined ||
      input.location !== undefined ||
      input.workplaceType !== undefined ||
      input.salaryText !== undefined ||
      input.seniority !== undefined
    ) {
      return this.scoreAndPersist(updated.id);
    }

    return updated;
  }

  async delete(id: string) {
    const user = await getDefaultUser();
    await this.ensureOwnedJob(id, user.id);
    await prisma.job.delete({ where: { id } });
    return { id };
  }

  async importManual(input: ManualImportInput) {
    return this.create(extractManualFields(input));
  }

  async scoreAndPersist(id: string) {
    const job = await this.get(id);
    const score = await this.scoringService.scoreJob(job);

    return prisma.job.update({
      where: { id },
      data: score
    });
  }

  async rescoreAll() {
    const user = await getDefaultUser();
    const jobs = await prisma.job.findMany({ where: { userId: user.id } });
    const updated = [];

    for (const job of jobs) {
      updated.push(await this.scoreAndPersist(job.id));
    }

    return updated;
  }

  private async findSource(sourceKey: string) {
    try {
      return await this.sourceService.get(sourceKey);
    } catch {
      return null;
    }
  }

  private async ensureOwnedJob(id: string, userId: string) {
    const job = await prisma.job.findFirst({ where: { id, userId } });
    if (!job) {
      throw new ApiError(404, "Job was not found.");
    }
  }
}
