import { defaultSkills } from "../domain/defaults";
import { getDefaultUser, prisma } from "../lib/prisma";

export type ScorableJob = {
  title: string;
  description?: string | null;
  location?: string | null;
  workplaceType?: string | null;
  salaryText?: string | null;
  seniority?: string | null;
};

export type JobScore = {
  score: number;
  scoreLabel: string;
  scoreExplanation: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchingCategory: string;
};

const categorySignals: Record<string, string[]> = {
  Integration: ["integration", "api", "rest", "webhook", "middleware", "etl"],
  Cloud: ["cloud", "aws", "lambda", "s3", "cognito", "dynamodb", "operations", "support"],
  Implementation: [
    "implementation",
    "implement",
    "consultant",
    "onboarding",
    "configuration",
    "application consultant"
  ],
  Solutions: ["solutions engineer", "solution engineer", "technical solutions", "saas"],
  "Data/BI": ["data", "bi", "analytics", "sql", "reporting", "dashboard"],
  "Software Engineering": [
    "software engineer",
    "software developer",
    "full stack",
    "backend",
    "node.js",
    "nodejs",
    "typescript",
    "javascript",
    "react",
    "web application"
  ]
};

const targetTitleSignals = [
  "integration",
  "api",
  "cloud support",
  "cloud operations",
  "cloud engineer",
  "implementation",
  "application consultant",
  "functional consultant",
  "solutions engineer",
  "data integration",
  "bi implementation",
  "analytics implementation",
  "software engineer",
  "software developer",
  "junior software engineer",
  "associate software engineer",
  "full stack",
  "backend developer",
  "node.js developer",
  "typescript developer"
];

const positiveTechnicalSignals = [
  "cloud",
  "api",
  "integration",
  "implementation",
  "saas",
  "technical consultant",
  "solutions",
  "sql",
  "aws",
  "support engineer",
  "troubleshooting",
  "software engineering",
  "software development",
  "full stack",
  "backend",
  "node.js",
  "typescript",
  "react"
];

const entrySignals = [
  "associate",
  "junior",
  "entry level",
  "entry-level",
  "0-2 years",
  "1 to 2",
  "1-2",
  "1 to 2",
  "1 to 2 years"
];

const penaltySignals = [
  { pattern: /\b(senior|lead|principal|staff)\b/i, points: 30, reason: "senior/lead/principal level" },
  {
    pattern: /\b(?:[5]\+|[6-9]\+|10\+|5\s+plus|6\s+plus|7\s+plus|8\s+plus|9\s+plus|10\s+plus)\s*(?:years?|yrs?)\b/i,
    points: 25,
    reason: "5+ years requirement"
  },
  { pattern: /\bmanual qa\b|\bqa tester\b|\btest cases only\b/i, points: 20, reason: "manual QA only signal" },
  { pattern: /\bbusiness analyst\b|\bba role\b|\bdocumentation only\b/i, points: 20, reason: "BA/documentation-only signal" },
  { pattern: /\bsales executive\b|\bcold calling\b|\bquota\b/i, points: 20, reason: "sales-only signal" },
  { pattern: /\bhtml\b.*\bcss\b.*\bfigma\b|\bpixel perfect\b/i, points: 15, reason: "frontend-heavy signal" },
  { pattern: /\bcall center\b|\bnon-technical support\b/i, points: 15, reason: "non-technical support signal" }
];

const skillAliases: Record<string, string[]> = {
  "Node.js": ["node.js", "nodejs", "node js"],
  "Express.js": ["express.js", "expressjs", "express"],
  NestJS: ["nestjs", "nest js"],
  TypeScript: ["typescript", "type script"],
  JavaScript: ["javascript", "java script"],
  "REST APIs": ["rest api", "rest apis", "restful", "api"],
  "API integration": ["api integration", "integrations", "integration"],
  "authentication flows": ["authentication", "auth flows", "login flow"],
  "AWS Lambda": ["aws lambda", "lambda"],
  S3: ["s3", "amazon s3"],
  Cognito: ["cognito", "aws cognito"],
  DynamoDB: ["dynamodb", "dynamo db"],
  SES: ["ses", "simple email service"],
  PostgreSQL: ["postgresql", "postgres", "sql"],
  MySQL: ["mysql", "sql"],
  MongoDB: ["mongodb", "mongo db"],
  "Azure DevOps": ["azure devops", "ado"],
  debugging: ["debugging", "troubleshooting", "root cause"],
  "production troubleshooting": ["production troubleshooting", "incident", "support", "debugging"]
};

const watchedGapSignals = [
  "Docker",
  "Kubernetes",
  "Salesforce",
  "Power BI",
  "Tableau",
  "Python",
  "Java",
  "ETL",
  "Snowflake",
  "Azure",
  "GCP",
  "Terraform",
  "Linux"
];

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function countMatches(text: string, signals: string[]) {
  return signals.filter((signal) => text.includes(signal)).length;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(score: number) {
  if (score >= 75) return "Excellent Match";
  if (score >= 55) return "Good Match";
  if (score >= 35) return "Maybe";
  return "Skip";
}

function skillMatchesText(skill: string, text: string) {
  const aliases = skillAliases[skill] ?? [skill.toLowerCase()];
  return aliases.some((alias) => text.includes(alias.toLowerCase()));
}

export class ScoringService {
  async scoreJob(job: ScorableJob): Promise<JobScore> {
    const user = await getDefaultUser();
    const storedSkills = await prisma.skill.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "desc" }, { name: "asc" }]
    });
    const profileSkills = storedSkills.length > 0 ? storedSkills.map((skill) => skill.name) : defaultSkills;
    const title = job.title.toLowerCase();
    const description = (job.description ?? "").toLowerCase();
    const allText = `${title} ${description} ${job.seniority ?? ""}`.toLowerCase();
    const explanation: string[] = [];

    let score = 0;

    const titleSignalCount = countMatches(title, targetTitleSignals);
    if (titleSignalCount > 0) {
      score += 30;
      explanation.push("Title matches a target role family.");
    }

    const matchedSkills = profileSkills.filter((skill) => skillMatchesText(skill, allText));
    if (matchedSkills.length > 0) {
      const skillPoints = Math.min(20, matchedSkills.length * 3);
      score += skillPoints;
      explanation.push(`Matched ${matchedSkills.length} provided skill(s).`);
    }

    if (includesAny(allText, entrySignals)) {
      score += 15;
      explanation.push("Role appears junior, associate, entry-level, or 1-2 years experience.");
    }

    const positiveSignalCount = countMatches(allText, positiveTechnicalSignals);
    if (positiveSignalCount > 0) {
      const signalPoints = Math.min(15, positiveSignalCount * 3);
      score += signalPoints;
      explanation.push("Description contains technical target-role signals.");
    }

    const locationText = `${job.location ?? ""} ${job.workplaceType ?? ""}`.toLowerCase();
    if (includesAny(locationText, ["remote", "hybrid", "sri lanka", "colombo"])) {
      score += 10;
      explanation.push("Location or workplace type is favorable.");
    }

    if (job.salaryText?.trim()) {
      score += 5;
      explanation.push("Salary information is available for manual review.");
    }

    for (const penalty of penaltySignals) {
      if (penalty.pattern.test(allText)) {
        score -= penalty.points;
        explanation.push(`Penalty applied for ${penalty.reason}.`);
      }
    }

    const matchingCategory = this.detectCategory(allText);
    const missingSkills = watchedGapSignals.filter((skill) => {
      const normalizedSkill = skill.toLowerCase();
      return allText.includes(normalizedSkill) && !profileSkills.some((owned) => owned.toLowerCase() === normalizedSkill);
    });

    const finalScore = clampScore(score);
    if (explanation.length === 0) {
      explanation.push("Limited target-role or skill evidence was found in the provided text.");
    }

    return {
      score: finalScore,
      scoreLabel: scoreLabel(finalScore),
      scoreExplanation: explanation.join(" "),
      matchedSkills,
      missingSkills,
      matchingCategory
    };
  }

  private detectCategory(text: string) {
    let bestCategory = "Implementation";
    let bestCount = 0;

    for (const [category, signals] of Object.entries(categorySignals)) {
      const count = countMatches(text, signals);
      if (count > bestCount) {
        bestCategory = category;
        bestCount = count;
      }
    }

    return bestCategory;
  }
}
