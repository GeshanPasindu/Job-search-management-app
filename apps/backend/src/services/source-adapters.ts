import { ApiError } from "../lib/http";

export type SourceConfig = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  baseUrl?: string;
  supportsFilters?: Record<string, boolean>;
  queryParams?: Record<string, string>;
  filterMappings?: Record<string, Record<string, string>>;
  importConfig?: Record<string, unknown>;
  applyMode: string;
};

export type SearchFilters = {
  keywords?: string[] | string;
  location?: string;
  workplaceType?: string;
  datePosted?: string;
  experienceLevel?: string;
  sortBy?: string;
  [key: string]: unknown;
};

export type AdapterResult = {
  urls: string[];
  notes: string[];
};

export interface JobSourceAdapter {
  buildSearchUrls(source: SourceConfig, filters: SearchFilters): AdapterResult;
}

function normalizeKeywords(value: SearchFilters["keywords"]) {
  if (Array.isArray(value)) {
    return value.map((keyword) => keyword.trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
}

function isBlankFilterValue(value: unknown) {
  return value === undefined || value === null || value === "" || value === "any";
}

function resolveTokenValue(
  source: SourceConfig,
  token: string,
  keyword: string,
  filters: SearchFilters
) {
  const rawValue = token === "keywords" ? keyword : filters[token];
  if (isBlankFilterValue(rawValue)) {
    return undefined;
  }

  const textValue = String(rawValue);
  const mappedValue = source.filterMappings?.[token]?.[textValue] ?? textValue;

  return isBlankFilterValue(mappedValue) ? undefined : mappedValue;
}

function renderQueryValue(
  source: SourceConfig,
  template: string,
  keyword: string,
  filters: SearchFilters
) {
  const tokenMatch = template.match(/^{{\s*([\w.-]+)\s*}}$/);
  if (!tokenMatch) {
    return template;
  }

  return resolveTokenValue(source, tokenMatch[1], keyword, filters);
}

export class SearchUrlAdapter implements JobSourceAdapter {
  buildSearchUrls(source: SourceConfig, filters: SearchFilters): AdapterResult {
    if (!source.baseUrl) {
      throw new ApiError(400, `${source.name} does not define a baseUrl.`);
    }

    const keywords = normalizeKeywords(filters.keywords);
    const keywordValues = keywords.length > 0 ? keywords : [""];
    const urls = keywordValues.map((keyword) => {
      const url = new URL(source.baseUrl as string);

      for (const [paramName, template] of Object.entries(source.queryParams ?? {})) {
        const value = renderQueryValue(source, template, keyword, filters);
        if (!isBlankFilterValue(value)) {
          url.searchParams.set(paramName, String(value));
        }
      }

      return url.toString();
    });

    const notes = ["Open generated URLs manually. This app does not scrape or apply on your behalf."];
    if (source.id === "linkedin") {
      notes.push("LinkedIn support is limited to search URL generation and manual opening.");
    }

    return { urls, notes };
  }
}

export class ManualImportAdapter implements JobSourceAdapter {
  buildSearchUrls(source: SourceConfig): AdapterResult {
    return {
      urls: source.baseUrl ? [source.baseUrl] : [],
      notes: [
        "This source is configured for manual opening or manual job import. Paste job details into the app after reviewing the posting."
      ]
    };
  }
}

export class ApiAdapter implements JobSourceAdapter {
  buildSearchUrls(source: SourceConfig): AdapterResult {
    return {
      urls: source.baseUrl ? [source.baseUrl] : [],
      notes: [
        `${source.name} is configured as an API source placeholder. Add credentials and a dedicated adapter before automated importing.`
      ]
    };
  }
}

export class EmailAlertAdapter implements JobSourceAdapter {
  buildSearchUrls(): AdapterResult {
    return {
      urls: [],
      notes: ["Email alert parsing is a future-safe placeholder and is not enabled in the MVP."]
    };
  }
}

export class CompanyBoardAdapter implements JobSourceAdapter {
  buildSearchUrls(source: SourceConfig): AdapterResult {
    return {
      urls: source.baseUrl ? [source.baseUrl] : [],
      notes: [
        "Company board adapters are placeholders for future Greenhouse, Workable, and similar integrations."
      ]
    };
  }
}

export function adapterForSource(source: SourceConfig): JobSourceAdapter {
  switch (source.type) {
    case "search_url":
      return new SearchUrlAdapter();
    case "manual_import_or_search_url":
      return new ManualImportAdapter();
    case "api":
    case "public_api":
      return new ApiAdapter();
    case "public_html":
      return new ManualImportAdapter();
    case "email_alert":
      return new EmailAlertAdapter();
    case "company_board_api":
      return new CompanyBoardAdapter();
    default:
      return new ManualImportAdapter();
  }
}
