/**
 * Brave Search API Client
 * 
 * A TypeScript client for the Brave Search API.
 * Documentation: https://api-dashboard.search.brave.com/app/documentation
 * 
 * Environment variable: BRAVE_SEARCH_API_KEY
 * Get API key from: https://api-dashboard.search.brave.com/app/keys
 */

const BRAVE_SEARCH_BASE_URL = "https://api.search.brave.com/res/v1";
const MAX_RESULTS = 20;
const MAX_CONTENT_LENGTH = 1500;
const FETCH_TIMEOUT_MS = 30_000;

export interface BraveSearchResult {
  url: string;
  title: string;
  description: string;
  age?: string;
  publishedDate?: string;
  extraSnippets?: string[];
  thumbnail?: {
    src: string;
    original?: string;
  };
  familyFriendly?: boolean;
}

export interface BraveWebSearchResponse {
  query: {
    original: string;
    altered?: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
  news?: {
    results: BraveSearchResult[];
  };
}

export interface BraveSearchOptions {
  query: string;
  count?: number;
  offset?: number;
  country?: string;
  searchLang?: string;
  freshness?: "pd" | "pw" | "pm" | "py" | string;
  safesearch?: "off" | "moderate" | "strict";
  textDecorations?: boolean;
}

export interface BraveFormattedResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
}

let cachedApiKey: string | null = null;

const getApiKey = (): string | null => {
  if (cachedApiKey !== null) {
    return cachedApiKey;
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  cachedApiKey = apiKey;
  return cachedApiKey;
};

const buildSearchUrl = (endpoint: string, options: BraveSearchOptions): string => {
  const params = new URLSearchParams();

  params.set("q", options.query);
  params.set("count", String(Math.min(options.count || 10, MAX_RESULTS)));

  if (options.offset !== undefined) {
    params.set("offset", String(Math.min(options.offset, 9)));
  }

  if (options.country) {
    params.set("country", options.country);
  }

  if (options.searchLang) {
    params.set("search_lang", options.searchLang);
  }

  if (options.freshness) {
    params.set("freshness", options.freshness);
  }

  if (options.safesearch) {
    params.set("safesearch", options.safesearch);
  }

  if (options.textDecorations !== undefined) {
    params.set("text_decorations", String(options.textDecorations));
  }

  return `${BRAVE_SEARCH_BASE_URL}${endpoint}?${params.toString()}`;
};

const truncateContent = (value: string, maxLength: number = MAX_CONTENT_LENGTH): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

/**
 * Perform a web search using Brave Search API
 */
export async function braveWebSearch(
  options: BraveSearchOptions
): Promise<BraveFormattedResult[]> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("[brave-search] BRAVE_SEARCH_API_KEY is not configured");
    return [];
  }

  if (!options.query || options.query.trim().length === 0) {
    console.warn("[brave-search] Empty query provided");
    return [];
  }

  const url = buildSearchUrl("/web/search", options);

  try {
    console.log(`[brave-search] Searching: "${options.query}" (count: ${options.count || 10})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[brave-search] API error: ${response.status} - ${errorText}`);

      if (response.status === 401) {
        console.error("[brave-search] Invalid API key");
      } else if (response.status === 429) {
        console.error("[brave-search] Rate limit exceeded");
      }

      return [];
    }

    const data: BraveWebSearchResponse = await response.json();

    if (!data.web?.results || data.web.results.length === 0) {
      console.log("[brave-search] No results found");
      return [];
    }

    console.log(`[brave-search] Found ${data.web.results.length} results`);

    const formatted: BraveFormattedResult[] = data.web.results.map((result) => {
      const extraContent = result.extraSnippets?.join(" ") || "";
      const fullContent = extraContent
        ? `${result.description} ${extraContent}`
        : result.description;

      return {
        url: result.url,
        title: result.title || "Untitled",
        snippet: result.description || "",
        content: truncateContent(fullContent),
        publishedDate: result.publishedDate || result.age,
      };
    });

    return formatted;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[brave-search] Unexpected error:", errorMessage);
    return [];
  }
}

/**
 * Search for documentation from official sources
 */
export async function braveDocumentationSearch(
  library: string,
  topic: string,
  numResults: number = 5
): Promise<BraveFormattedResult[]> {
  const query = `${library} ${topic} documentation API reference`;

  return braveWebSearch({
    query,
    count: numResults,
    textDecorations: false,
  });
}

/**
 * Search for code examples from developer resources
 */
export async function braveCodeSearch(
  query: string,
  language?: string,
  numResults: number = 5
): Promise<BraveFormattedResult[]> {
  const searchQuery = language
    ? `${query} ${language} code example implementation site:github.com OR site:stackoverflow.com`
    : `${query} code example implementation site:github.com OR site:stackoverflow.com`;

  return braveWebSearch({
    query: searchQuery,
    count: numResults,
    textDecorations: false,
  });
}

/**
 * Check if Brave Search is configured
 */
export function isBraveSearchConfigured(): boolean {
  return getApiKey() !== null;
}
