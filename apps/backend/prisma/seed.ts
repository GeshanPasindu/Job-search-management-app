import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  defaultCoverLetterTemplate,
  defaultKeywords,
  defaultPreferredLocations,
  defaultPreferredRoles,
  defaultSkills,
  roleCategories
} from "../src/domain/defaults";
import { SourceConfig } from "../src/services/source-adapters";

const prisma = new PrismaClient();

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function sourceConfigPath() {
  const configuredPath = process.env.SOURCE_CONFIG_PATH ?? "config/job-sources.json";
  const first = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
  if (fs.existsSync(first)) return first;

  return path.join(process.cwd(), "apps/backend", configuredPath);
}

async function main() {
  const email = process.env.DEFAULT_USER_EMAIL ?? "owner@example.local";
  const name = process.env.DEFAULT_USER_NAME ?? "Job Search Owner";

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name }
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      preferredRoles: defaultPreferredRoles,
      preferredLocations: defaultPreferredLocations,
      aiKeyConfigured: Boolean(process.env.AI_API_KEY)
    },
    create: {
      userId: user.id,
      summary:
        "Backend and cloud-focused engineer targeting integration, cloud support, implementation, solutions, and data/BI roles.",
      preferredRoles: defaultPreferredRoles,
      preferredLocations: defaultPreferredLocations,
      aiKeyConfigured: Boolean(process.env.AI_API_KEY)
    }
  });

  for (const [index, skill] of defaultSkills.entries()) {
    await prisma.skill.upsert({
      where: { userId_name: { userId: user.id, name: skill } },
      update: { priority: defaultSkills.length - index },
      create: {
        userId: user.id,
        name: skill,
        priority: defaultSkills.length - index
      }
    });
  }

  for (const keyword of defaultKeywords) {
    await prisma.keyword.upsert({
      where: { userId_keyword: { userId: user.id, keyword: keyword.keyword } },
      update: keyword,
      create: {
        userId: user.id,
        ...keyword,
        enabled: true
      }
    });
  }

  const sourceConfigs = JSON.parse(fs.readFileSync(sourceConfigPath(), "utf8")) as SourceConfig[];
  for (const source of sourceConfigs) {
    await prisma.jobSource.upsert({
      where: { sourceKey: source.id },
      update: {
        name: source.name,
        type: source.type,
        enabled: source.enabled,
        baseUrl: source.baseUrl,
        applyMode: source.applyMode,
        config: source as unknown as Prisma.JsonObject
      },
      create: {
        sourceKey: source.id,
        name: source.name,
        type: source.type,
        enabled: source.enabled,
        baseUrl: source.baseUrl,
        applyMode: source.applyMode,
        config: source as unknown as Prisma.JsonObject
      }
    });
  }

  for (const roleCategory of roleCategories) {
    await prisma.cvTemplate.upsert({
      where: {
        id: `sample-cv-${roleCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      },
      update: {},
      create: {
        id: `sample-cv-${roleCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        userId: user.id,
        roleCategory,
        versionName: `${roleCategory} sample CV summary`,
        summaryText:
          "Backend and cloud-focused software engineer with hands-on experience in Node.js, TypeScript, REST APIs, authentication flows, SQL databases, AWS services, debugging, and production troubleshooting.",
        skillsPriorityList: defaultSkills,
        isDefault: true,
        notes: "Sample editable CV summary. Replace with your own CV upload when ready."
      }
    });

    await prisma.coverLetterTemplate.upsert({
      where: {
        id: `sample-cover-${roleCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      },
      update: {},
      create: {
        id: `sample-cover-${roleCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        userId: user.id,
        roleCategory,
        versionName: `${roleCategory} sample cover letter`,
        content: defaultCoverLetterTemplate,
        isDefault: true,
        notes: "Sample deterministic template. Uses only configured variables and profile skills."
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
