import { tool } from "ai";
import { z } from "zod";
import {
  braveWebSearch,
  braveDocumentationSearch,
  braveCodeSearch,
  isBraveSearchConfigured,
} from "@/lib/brave-search";

export interface BraveSearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}

export function createBraveTools() {
  return {
    webSearch: tool({
      description:
        "Search the web using Brave Search API for real-time information, documentation, and best practices",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        numResults: z
          .number()
          .default(5)
          .describe("Number of results to return (1-20)"),
        category: z
          .enum(["web", "news", "research", "documentation"])
          .default("web"),
      }),
      execute: async ({
        query,
        numResults,
        category,
      }: {
        query: string;
        numResults: number;
        category: string;
      }) => {
        console.log(
          `[BRAVE] Web search: "${query}" (${numResults} results, category: ${category})`
        );

        if (!isBraveSearchConfigured()) {
          return JSON.stringify({
            error: "Brave Search API key not configured",
            query,
            results: [],
          });
        }

        try {
          const freshness = mapCategoryToFreshness(category);

          const results = await braveWebSearch({
            query,
            count: Math.min(numResults, 20),
            freshness,
          });

          console.log(`[BRAVE] Found ${results.length} results`);

          const formatted: BraveSearchResult[] = results.map((result) => ({
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            content: result.content,
          }));

          return JSON.stringify({
            query,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[BRAVE] Web search error:", errorMessage);
          return JSON.stringify({
            error: `Web search failed: ${errorMessage}`,
            query,
            results: [],
          });
        }
      },
    }),

    lookupDocumentation: tool({
      description:
        "Look up official documentation and API references for libraries and frameworks",
      inputSchema: z.object({
        library: z
          .string()
          .describe(
            "The library or framework name (e.g., 'Next.js', 'React', 'Stripe')"
          ),
        topic: z.string().describe("Specific topic or API to look up"),
        numResults: z.number().default(3).describe("Number of results (1-10)"),
      }),
      execute: async ({
        library,
        topic,
        numResults,
      }: {
        library: string;
        topic: string;
        numResults: number;
      }) => {
        console.log(`[BRAVE] Documentation lookup: ${library} - ${topic}`);

        if (!isBraveSearchConfigured()) {
          return JSON.stringify({
            error: "Brave Search API key not configured",
            library,
            topic,
            results: [],
          });
        }

        try {
          const results = await braveDocumentationSearch(
            library,
            topic,
            Math.min(numResults, 10)
          );

          console.log(`[BRAVE] Found ${results.length} documentation results`);

          const formatted: BraveSearchResult[] = results.map((result) => ({
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            content: result.content,
          }));

          return JSON.stringify({
            library,
            topic,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[BRAVE] Documentation lookup error:", errorMessage);
          return JSON.stringify({
            error: `Documentation lookup failed: ${errorMessage}`,
            library,
            topic,
            results: [],
          });
        }
      },
    }),

    searchCodeExamples: tool({
      description:
        "Search for code examples and implementation patterns from GitHub and developer resources",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "What to search for (e.g., 'Next.js authentication with Clerk')"
          ),
        language: z
          .string()
          .optional()
          .describe(
            "Programming language filter (e.g., 'TypeScript', 'JavaScript')"
          ),
        numResults: z.number().default(3).describe("Number of examples (1-10)"),
      }),
      execute: async ({
        query,
        language,
        numResults,
      }: {
        query: string;
        language?: string;
        numResults: number;
      }) => {
        console.log(
          `[BRAVE] Code search: "${query}"${language ? ` (${language})` : ""}`
        );

        if (!isBraveSearchConfigured()) {
          return JSON.stringify({
            error: "Brave Search API key not configured",
            query,
            results: [],
          });
        }

        try {
          const results = await braveCodeSearch(
            query,
            language,
            Math.min(numResults, 10)
          );

          console.log(`[BRAVE] Found ${results.length} code examples`);

          const formatted: BraveSearchResult[] = results.map((result) => ({
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            content: result.content,
          }));

          return JSON.stringify({
            query,
            language,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[BRAVE] Code search error:", errorMessage);
          return JSON.stringify({
            error: `Code search failed: ${errorMessage}`,
            query,
            results: [],
          });
        }
      },
    }),
  };
}

function mapCategoryToFreshness(
  category: string
): "pd" | "pw" | "pm" | "py" | undefined {
  switch (category) {
    case "news":
      return "pw";
    case "research":
      return "pm";
    case "documentation":
      return undefined;
    case "web":
    default:
      return undefined;
  }
}

export async function braveWebSearchDirect(
  query: string,
  numResults: number = 5
): Promise<BraveSearchResult[]> {
  if (!isBraveSearchConfigured()) {
    console.error("[BRAVE] API key not configured");
    return [];
  }

  try {
    const results = await braveWebSearch({
      query,
      count: numResults,
    });

    return results.map((result) => ({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      content: result.content,
    }));
  } catch (error) {
    console.error("[BRAVE] Search error:", error);
    return [];
  }
}

export async function braveDocumentationLookup(
  library: string,
  topic: string,
  numResults: number = 3
): Promise<BraveSearchResult[]> {
  if (!isBraveSearchConfigured()) {
    console.error("[BRAVE] API key not configured");
    return [];
  }

  try {
    const results = await braveDocumentationSearch(library, topic, numResults);

    return results.map((result) => ({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      content: result.content,
    }));
  } catch (error) {
    console.error("[BRAVE] Documentation lookup error:", error);
    return [];
  }
}
