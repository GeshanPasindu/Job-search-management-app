import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "../lib/http";
import { prisma } from "../lib/prisma";
import { adapterForSource, SearchFilters, SourceConfig } from "./source-adapters";

const sourceConfigSchema: z.ZodType<SourceConfig> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  enabled: z.boolean(),
  baseUrl: z.string().optional(),
  supportsFilters: z.record(z.boolean()).optional(),
  queryParams: z.record(z.string()).optional(),
  filterMappings: z.record(z.record(z.string())).optional(),
  importConfig: z.record(z.unknown()).optional(),
  applyMode: z.string().min(1)
});

const sourceConfigListSchema = z.array(sourceConfigSchema);

function configPath() {
  const configuredPath = process.env.SOURCE_CONFIG_PATH ?? "config/job-sources.json";
  const firstPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);

  if (fs.existsSync(firstPath)) {
    return firstPath;
  }

  return path.join(process.cwd(), "apps/backend", configuredPath);
}

function serializeSource(source: {
  sourceKey: string;
  name: string;
  type: string;
  enabled: boolean;
  baseUrl: string | null;
  applyMode: string;
  config: Prisma.JsonValue;
}): SourceConfig {
  const config = sourceConfigSchema.parse(source.config);
  return {
    ...config,
    id: source.sourceKey,
    name: source.name,
    type: source.type,
    enabled: source.enabled,
    baseUrl: source.baseUrl ?? config.baseUrl,
    applyMode: source.applyMode
  };
}

export class SourceService {
  readConfigSources() {
    const filePath = configPath();
    if (!fs.existsSync(filePath)) {
      throw new ApiError(500, `Source config file not found at ${filePath}`);
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    return sourceConfigListSchema.parse(parsed);
  }

  async syncConfigSources() {
    const configSources = this.readConfigSources();

    for (const source of configSources) {
      await prisma.jobSource.upsert({
        where: { sourceKey: source.id },
        update: {},
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
  }

  async list() {
    await this.syncConfigSources();
    const sources = await prisma.jobSource.findMany({
      orderBy: [{ enabled: "desc" }, { name: "asc" }]
    });

    return sources.map(serializeSource);
  }

  async get(sourceKey: string) {
    await this.syncConfigSources();
    const source = await prisma.jobSource.findUnique({ where: { sourceKey } });
    if (!source) {
      throw new ApiError(404, `Source ${sourceKey} was not found.`);
    }

    return serializeSource(source);
  }

  async update(
    sourceKey: string,
    input: Partial<SourceConfig> & { config?: SourceConfig }
  ) {
    const existing = await prisma.jobSource.findUnique({ where: { sourceKey } });
    if (!existing) {
      throw new ApiError(404, `Source ${sourceKey} was not found.`);
    }

    const nextConfig = sourceConfigSchema.parse({
      ...sourceConfigSchema.parse(existing.config),
      ...(input.config ?? input),
      id: sourceKey
    });

    const updated = await prisma.jobSource.update({
      where: { sourceKey },
      data: {
        name: input.name ?? nextConfig.name,
        type: input.type ?? nextConfig.type,
        enabled: input.enabled ?? nextConfig.enabled,
        baseUrl: input.baseUrl ?? nextConfig.baseUrl,
        applyMode: input.applyMode ?? nextConfig.applyMode,
        config: nextConfig as unknown as Prisma.JsonObject
      }
    });

    return serializeSource(updated);
  }

  async testUrl(sourceKey: string, filters: SearchFilters) {
    const source = await this.get(sourceKey);
    if (!source.enabled) {
      throw new ApiError(400, `${source.name} is disabled.`);
    }

    const adapter = adapterForSource(source);
    const result = adapter.buildSearchUrls(source, filters);

    return {
      source,
      urls: result.urls,
      notes: result.notes,
      safetyNote:
        "Manual open only. No scraping, CAPTCHA bypassing, fake account automation, or auto-submit behavior is implemented."
    };
  }
}
