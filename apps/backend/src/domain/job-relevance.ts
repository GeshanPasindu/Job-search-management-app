import { defaultKeywords, defaultPreferredRoles } from "./defaults";

export type TargetJobCandidate = {
  title: string;
  description?: string | null;
  company?: string | null;
  location?: string | null;
  workplaceType?: string | null;
  jobType?: string | null;
  seniority?: string | null;
};

export type JobRelevanceOptions = {
  targetKeywords?: string[];
};

const defaultTargetKeywords = Array.from(
  new Set([
    ...defaultPreferredRoles,
    ...defaultKeywords.map((keyword) => keyword.keyword)
  ])
);

const disqualifyingTitlePatterns = [
  /\b(?:senior|lead|principal|staff|head|chief|director|manager)\b/i,
  /\b(?:english\s+)?(?:teacher|lecturer|tutor|instructor)\b/i,
  /\b(?:3d\s+)?visuali[sz]er\b/i,
  /\bsurveyor\b/i,
  /\bsteward\b/i,
  /\b(?:video|content|copy|creative|digital|marketing|sales)\s+(?:producer|production|executive|manager|officer|associate|representative|consultant)\b/i,
  /\b(?:sales|marketing)\s+(?:executive|representative|manager|officer|associate|consultant)\b/i,
  /\bbusiness\s+development\b/i,
  /\bcustomer\s+relationship\s+management\b/i,
  /\b(?:accountant|finance|auditor|payroll|bookkeeper)\b/i,
  /\b(?:hr|human\s+resources|recruiter|talent\s+acquisition)\b/i,
  /\b(?:graphic|ui\/ux|ux|visual)\s+designer\b/i,
  /\b(?:operations?|administrative|admin|office)\s+(?:assistant|executive|officer|coordinator)\b/i,
  /\b(?:receptionist|cashier|driver|chef|nurse|doctor|pharmacist)\b/i,
  /\b(?:civil|mechanical|electrical|construction)\s+engineer\b/i,
  /\bbusiness\s+analyst\b/i,
  /\byour\s+application\s+was\s+sent\b/i
];

const targetTitlePatterns = [
  /\b(?:junior|associate|intern|trainee)?\s*software\s+engineers?\b/i,
  /\b(?:junior|associate|intern|trainee)?\s*software\s+developers?\b/i,
  /\bintern\s+software\s+engineers?\b/i,
  /\bback[-\s]?end\s+(?:software\s+)?(?:engineers?|developers?)\b/i,
  /\bfull[-\s]?stack\s+(?:software\s+)?(?:engineers?|developers?)\b/i,
  /\bweb\s+(?:application\s+)?(?:engineers?|developers?)\b/i,
  /\bnode(?:\.js|js)?\s+(?:engineers?|developers?)\b/i,
  /\btypescript\s+(?:engineers?|developers?)\b/i,
  /\breact\s+(?:engineers?|developers?)\b/i,
  /\b(?:api\s+)?integration\s+(?:engineers?|developers?|consultants?|analysts?|specialists?)\b/i,
  /\bapi\s+(?:integration\s+)?(?:engineers?|developers?|specialists?|consultants?)\b/i,
  /\btechnical\s+implementation\s+(?:engineers?|consultants?|specialists?)\b/i,
  /\bimplementation\s+(?:engineers?|consultants?|specialists?|analysts?)\b/i,
  /\b(?:functional|application)\s+consultants?\b/i,
  /\bcloud\s+(?:support|operations|engineers?|associates?)\b/i,
  /\b(?:it|technical|production)\s+support\s+engineers?\b/i,
  /\bsolutions?\s+engineers?\b/i,
  /\btechnical\s+solutions?\s+(?:engineers?|consultants?|specialists?)\b/i,
  /\bdata\s+integration\s+(?:analysts?|engineers?|developers?|consultants?)\b/i,
  /\bbi\s+(?:implementation\s+)?(?:analysts?|developers?|consultants?)\b/i,
  /\banalytics\s+implementation\s+(?:analysts?|consultants?|specialists?)\b/i
];

const ambiguousTargetTitlePatterns = [
  /\bdevelopers?\b/i,
  /\bengineers?\b/i,
  /\bconsultants?\b/i,
  /\banalysts?\b/i
];

const descriptionSupportSignals = [
  "api",
  "integration",
  "backend",
  "full stack",
  "nodejs",
  "typescript",
  "javascript",
  "react",
  "angular",
  "rest",
  "sql",
  "cloud",
  "aws",
  "saas",
  "implementation",
  "technical support",
  "production support",
  "troubleshooting"
];

function cleanText(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value: string | undefined | null) {
  return cleanText(value)
    .toLowerCase()
    .replace(/node\.?\s*js/g, "nodejs")
    .replace(/type\s*script/g, "typescript")
    .replace(/[^a-z0-9.+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseInTitle(title: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length > 0 && title.includes(normalizedPhrase);
}

function supportSignalCount(candidate: TargetJobCandidate) {
  const text = normalize(
    [
      candidate.title,
      candidate.description,
      candidate.jobType,
      candidate.seniority
    ].filter(Boolean).join(" ")
  );

  return descriptionSupportSignals.filter((signal) => text.includes(signal)).length;
}

export function targetRoleKeywords(extraKeywords: string[] = []) {
  return Array.from(new Set([...extraKeywords.filter(Boolean), ...defaultTargetKeywords]));
}

export function isTargetJob(candidate: TargetJobCandidate, options: JobRelevanceOptions = {}) {
  const title = normalize(candidate.title);
  if (!title) return false;
  if (disqualifyingTitlePatterns.some((pattern) => pattern.test(title))) return false;

  const configuredTargets = targetRoleKeywords(options.targetKeywords ?? []);
  if (configuredTargets.some((keyword) => phraseInTitle(title, keyword))) return true;
  if (targetTitlePatterns.some((pattern) => pattern.test(title))) return true;

  return ambiguousTargetTitlePatterns.some((pattern) => pattern.test(title)) && supportSignalCount(candidate) >= 3;
}
