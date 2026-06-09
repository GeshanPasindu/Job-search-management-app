import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { z } from "zod";
import { isTargetJob } from "../domain/job-relevance";
import { ApiError } from "../lib/http";
import { getDefaultUser, prisma } from "../lib/prisma";
import { ScoringService } from "./scoring.service";

const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";

export const emailJobImportSchema = z.object({
  query: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(100).default(25),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

type ParsedEmailJob = {
  sourceId: string;
  sourceName: string;
  title: string;
  company: string;
  location?: string | null;
  jobUrl: string;
  applyUrl: string;
  description: string;
  notes: string;
};

type GmailHeaderMap = Record<string, string>;

function appRootPath(...parts: string[]) {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "backend"))
    ? path.resolve(cwd, "../..")
    : cwd;
  return path.join(root, ...parts);
}

function tokenPath() {
  const configured = process.env.GMAIL_TOKEN_PATH ?? ".local/gmail-token.json";
  return path.isAbsolute(configured) ? configured : appRootPath(configured);
}

function getRedirectUri() {
  return process.env.GMAIL_REDIRECT_URI ?? "http://localhost:4000/api/email/gmail/callback";
}

function createOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ApiError(
      400,
      "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

function isConnected() {
  return fs.existsSync(tokenPath());
}

function readStoredToken() {
  const filePath = tokenPath();
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, "Gmail is not connected yet. Generate an auth URL and complete OAuth first.");
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function storeToken(token: unknown) {
  const filePath = tokenPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(token, null, 2));
}

function decodeBase64Url(data?: string | null) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function htmlToText(html: string) {
  return cleanText(load(html).text());
}

function headersToMap(headers?: gmail_v1.Schema$MessagePartHeader[]): GmailHeaderMap {
  return (headers ?? []).reduce<GmailHeaderMap>((acc, header) => {
    if (header.name && header.value) {
      acc[header.name.toLowerCase()] = header.value;
    }
    return acc;
  }, {});
}

function collectMessageBodies(part?: gmail_v1.Schema$MessagePart): { html: string[]; text: string[] } {
  const html: string[] = [];
  const text: string[] = [];

  function visit(current?: gmail_v1.Schema$MessagePart) {
    if (!current) return;
    const body = decodeBase64Url(current.body?.data);
    if (body && current.mimeType?.includes("text/html")) html.push(body);
    if (body && current.mimeType?.includes("text/plain")) text.push(body);
    for (const child of current.parts ?? []) visit(child);
  }

  visit(part);
  return { html, text };
}

function normalizeJobUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const nestedUrl = url.searchParams.get("url") ?? url.searchParams.get("u");
    if (nestedUrl?.startsWith("http")) return normalizeJobUrl(nestedUrl);

    const currentJobId = url.searchParams.get("currentJobId");
    if (url.hostname.includes("linkedin.com") && currentJobId) {
      return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
    }

    if (url.hostname.includes("linkedin.com")) {
      const match = url.pathname.match(/\/jobs\/view\/(\d+)/);
      if (match) return `https://www.linkedin.com/jobs/view/${match[1]}/`;
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

function sourceFromUrl(jobUrl: string) {
  try {
    const hostname = new URL(jobUrl).hostname;
    if (hostname.includes("linkedin.com")) return { sourceId: "linkedin-email", sourceName: "LinkedIn Email Alert" };
    if (hostname.includes("xpress.jobs")) return { sourceId: "xpressjobs-email", sourceName: "XpressJobs Email Alert" };
    if (hostname.includes("topjobs.lk")) return { sourceId: "topjobs-email", sourceName: "TopJobs Email Alert" };
    if (hostname.includes("rooster.jobs")) return { sourceId: "rooster-email", sourceName: "Rooster Email Alert" };
    return { sourceId: "gmail-alert", sourceName: hostname };
  } catch {
    return { sourceId: "gmail-alert", sourceName: "Gmail Job Alert" };
  }
}

function isLikelyJobUrl(jobUrl: string) {
  const lower = jobUrl.toLowerCase();
  if (lower.startsWith("mailto:")) return false;
  if (lower.includes("unsubscribe")) return false;
  if (lower.includes("privacy")) return false;
  if (lower.includes("preferences")) return false;
  if (lower.includes("settings")) return false;

  return [
    "linkedin.com/jobs",
    "xpress.jobs/jobs/view",
    "topjobs.lk/employer/jobadvertismentservlet",
    "rooster.jobs"
  ].some((needle) => lower.includes(needle));
}

function isGenericLinkText(text: string) {
  const lower = text.toLowerCase();
  return !text || [
    "view job",
    "view jobs",
    "apply",
    "apply now",
    "see job",
    "see more",
    "learn more"
  ].includes(lower);
}

function subjectToTitle(subject: string) {
  return cleanText(
    subject
      .replace(/^\s*(job alert|new jobs|jobs for you|recommended jobs)\s*[:|-]\s*/i, "")
      .replace(/\s+-\s+linkedin\s*$/i, "")
  );
}

function extractJobsFromEmail(input: {
  html: string;
  text: string;
  subject: string;
  from: string;
  messageId: string;
}) {
  const jobs: ParsedEmailJob[] = [];
  const seen = new Set<string>();
  const fallbackTitle = subjectToTitle(input.subject) || "Job alert";

  if (input.html) {
    const $ = load(input.html);
    $("a[href]").each((_index, element) => {
      const link = $(element);
      const rawHref = link.attr("href") ?? "";
      const jobUrl = normalizeJobUrl(rawHref);
      if (!isLikelyJobUrl(jobUrl) || seen.has(jobUrl)) return;

      const linkText = cleanText(link.text());
      const parentText = cleanText(link.closest("td, div, li, p, section").text());
      const title = isGenericLinkText(linkText) ? fallbackTitle : linkText;
      const { sourceId, sourceName } = sourceFromUrl(jobUrl);
      seen.add(jobUrl);

      jobs.push({
        sourceId,
        sourceName,
        title,
        company: "Unknown company",
        jobUrl,
        applyUrl: jobUrl,
        description: parentText || `${title}. Imported from Gmail job alert email.`,
        notes: `Imported from Gmail alert. From: ${input.from}. Gmail message ID: ${input.messageId}`
      });
    });
  }

  const urlMatches = input.text.match(/https?:\/\/[^\s<>()"]+/g) ?? [];
  for (const rawUrl of urlMatches) {
    const jobUrl = normalizeJobUrl(rawUrl);
    if (!isLikelyJobUrl(jobUrl) || seen.has(jobUrl)) continue;
    const { sourceId, sourceName } = sourceFromUrl(jobUrl);
    seen.add(jobUrl);
    jobs.push({
      sourceId,
      sourceName,
      title: fallbackTitle,
      company: "Unknown company",
      jobUrl,
      applyUrl: jobUrl,
      description: input.text.slice(0, 1500) || `${fallbackTitle}. Imported from Gmail job alert email.`,
      notes: `Imported from Gmail alert. From: ${input.from}. Gmail message ID: ${input.messageId}`
    });
  }

  return jobs;
}

export class EmailJobImportService {
  private scoringService = new ScoringService();

  getStatus() {
    return {
      configured: Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
      connected: isConnected(),
      redirectUri: getRedirectUri(),
      scopes: [gmailReadonlyScope]
    };
  }

  getAuthUrl() {
    const client = createOAuthClient();
    return {
      url: client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [gmailReadonlyScope]
      })
    };
  }

  async handleCallback(code: string) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    storeToken(tokens);
    return { connected: true };
  }

  async importJobAlerts(input: z.infer<typeof emailJobImportSchema>) {
    const client = createOAuthClient();
    client.setCredentials(readStoredToken());
    const gmail = google.gmail({ version: "v1", auth: client });
    const q =
      input.query ??
      'newer_than:30d ("job alert" OR "jobs for you" OR "new jobs" OR linkedin OR xpressjobs OR topjobs OR rooster)';

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: input.maxResults
    });

    const messages = listResponse.data.messages ?? [];
    const parsedJobs: ParsedEmailJob[] = [];

    for (const message of messages) {
      if (!message.id) continue;
      const fullMessage = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full"
      });

      const headers = headersToMap(fullMessage.data.payload?.headers);
      const bodies = collectMessageBodies(fullMessage.data.payload);
      const html = bodies.html.join("\n");
      const text = bodies.text.join("\n") || htmlToText(html);
      parsedJobs.push(
        ...extractJobsFromEmail({
          html,
          text,
          subject: headers.subject ?? "",
          from: headers.from ?? "",
          messageId: message.id
        })
      );
    }

    const saved = [];
    const skipped = [];

    const dedupedJobs = this.dedupeParsedJobs(parsedJobs);
    const relevantJobs = dedupedJobs.filter((job) => isTargetJob(job));
    const filteredCount = dedupedJobs.length - relevantJobs.length;

    for (const parsedJob of relevantJobs.slice(0, input.limit)) {
      const result = await this.saveParsedJob(parsedJob);
      if (result.created) saved.push(result.job);
      else skipped.push(result.job);
    }

    return {
      messagesScanned: messages.length,
      candidateJobsFound: parsedJobs.length,
      importedCount: saved.length,
      skippedCount: skipped.length,
      filteredCount,
      jobs: saved,
      skipped
    };
  }

  private dedupeParsedJobs(jobs: ParsedEmailJob[]) {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = job.jobUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async saveParsedJob(parsedJob: ParsedEmailJob) {
    const user = await getDefaultUser();
    const existing = await prisma.job.findFirst({
      where: {
        userId: user.id,
        jobUrl: parsedJob.jobUrl
      }
    });

    if (existing) {
      return { created: false, job: existing };
    }

    const score = await this.scoringService.scoreJob(parsedJob);
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        sourceId: parsedJob.sourceId,
        sourceName: parsedJob.sourceName,
        title: parsedJob.title,
        company: parsedJob.company,
        location: parsedJob.location,
        jobUrl: parsedJob.jobUrl,
        applyUrl: parsedJob.applyUrl,
        description: parsedJob.description,
        notes: parsedJob.notes,
        ...score
      }
    });

    return { created: true, job };
  }
}
