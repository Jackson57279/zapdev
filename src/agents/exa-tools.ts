import Exa from "exa-js";
import { tool } from "ai";
import { z } from "zod";

const exa = process.env.EXA_API_KEY ? new Exa(process.env.EXA_API_KEY) : null;

export interface ExaSearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}

export function createExaTools() {
  return {
    webSearch: tool({
      description: "Search the web using Exa API for real-time information, documentation, and best practices",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        numResults: z.number().default(5).describe("Number of results to return (1-10)"),
        category: z.enum(["web", "news", "research", "documentation"]).default("web"),
      }),
      execute: async ({ query, numResults, category }: { query: string; numResults: number; category: string }) => {
        console.log(`[EXA] Web search: "${query}" (${numResults} results, category: ${category})`);
        
        if (!exa) {
          return JSON.stringify({
            error: "Exa API key not configured",
            query,
            results: [],
          });
        }
        
        try {
          const searchOptions: any = {
            numResults: Math.min(numResults, 10),
            useAutoprompt: true,
            type: "auto",
            contents: {
              text: true,
              highlights: true,
            },
          };

          if (category === "documentation") {
            searchOptions.includeDomains = [
              "docs.npmjs.com",
              "nextjs.org",
              "react.dev",
              "vuejs.org",
              "angular.io",
              "svelte.dev",
              "developer.mozilla.org",
            ];
          }

          const results = await exa.searchAndContents(query, searchOptions);
          
          console.log(`[EXA] Found ${results.results.length} results`);

          const formatted: ExaSearchResult[] = results.results.map((result: any) => ({
            url: result.url || "",
            title: result.title || "Untitled",
            snippet: result.highlights?.[0] || result.text?.slice(0, 200) || "",
            content: result.text?.slice(0, 1000),
          }));

          return JSON.stringify({
            query,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[EXA] Web search error:", errorMessage);
          return JSON.stringify({
            error: `Web search failed: ${errorMessage}`,
            query,
            results: [],
          });
        }
      },
    }),

    lookupDocumentation: tool({
      description: "Look up official documentation and API references for libraries and frameworks",
      inputSchema: z.object({
        library: z.string().describe("The library or framework name (e.g., 'Next.js', 'React', 'Stripe')"),
        topic: z.string().describe("Specific topic or API to look up"),
        numResults: z.number().default(3).describe("Number of results (1-5)"),
      }),
      execute: async ({ library, topic, numResults }: { library: string; topic: string; numResults: number }) => {
        console.log(`[EXA] Documentation lookup: ${library} - ${topic}`);
        
        if (!exa) {
          return JSON.stringify({
            error: "Exa API key not configured",
            library,
            topic,
            results: [],
          });
        }
        
        try {
          const query = `${library} ${topic} documentation API reference`;
          
          const domainMap: Record<string, string[]> = {
            "next": ["nextjs.org"],
            "react": ["react.dev", "reactjs.org"],
            "vue": ["vuejs.org"],
            "angular": ["angular.io"],
            "svelte": ["svelte.dev"],
            "stripe": ["stripe.com/docs", "docs.stripe.com"],
            "supabase": ["supabase.com/docs"],
            "prisma": ["prisma.io/docs"],
            "tailwind": ["tailwindcss.com/docs"],
          };

          const libraryKey = library.toLowerCase().split(/[^a-z]/)[0];
          const includeDomains = domainMap[libraryKey] || [];

          const searchOptions: any = {
            numResults: Math.min(numResults, 5),
            useAutoprompt: true,
            type: "auto",
            contents: {
              text: true,
              highlights: true,
            },
          };

          if (includeDomains.length > 0) {
            searchOptions.includeDomains = includeDomains;
          }

          const results = await exa.searchAndContents(query, searchOptions);
          
          console.log(`[EXA] Found ${results.results.length} documentation results`);

          const formatted: ExaSearchResult[] = results.results.map((result: any) => ({
            url: result.url || "",
            title: result.title || "Untitled",
            snippet: result.highlights?.[0] || result.text?.slice(0, 200) || "",
            content: result.text?.slice(0, 1500),
          }));

          return JSON.stringify({
            library,
            topic,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[EXA] Documentation lookup error:", errorMessage);
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
      description: "Search for code examples and implementation patterns from GitHub and developer resources",
      inputSchema: z.object({
        query: z.string().describe("What to search for (e.g., 'Next.js authentication with Clerk')"),
        language: z.string().optional().describe("Programming language filter (e.g., 'TypeScript', 'JavaScript')"),
        numResults: z.number().default(3).describe("Number of examples (1-5)"),
      }),
      execute: async ({ query, language, numResults }: { query: string; language?: string; numResults: number }) => {
        console.log(`[EXA] Code search: "${query}"${language ? ` (${language})` : ""}`);
        
        if (!exa) {
          return JSON.stringify({
            error: "Exa API key not configured",
            query,
            results: [],
          });
        }
        
        try {
          const searchQuery = language 
            ? `${query} ${language} code example implementation`
            : `${query} code example implementation`;

          const searchOptions: any = {
            numResults: Math.min(numResults, 5),
            useAutoprompt: true,
            type: "auto",
            contents: {
              text: true,
              highlights: true,
            },
            includeDomains: [
              "github.com",
              "stackoverflow.com",
              "dev.to",
              "medium.com",
            ],
          };

          const results = await exa.searchAndContents(searchQuery, searchOptions);
          
          console.log(`[EXA] Found ${results.results.length} code examples`);

          const formatted: ExaSearchResult[] = results.results.map((result: any) => ({
            url: result.url || "",
            title: result.title || "Untitled",
            snippet: result.highlights?.[0] || result.text?.slice(0, 200) || "",
            content: result.text?.slice(0, 1000),
          }));

          return JSON.stringify({
            query,
            language,
            results: formatted,
            count: formatted.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[EXA] Code search error:", errorMessage);
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

export async function exaWebSearch(
  query: string,
  numResults: number = 5
): Promise<ExaSearchResult[]> {
  if (!exa) {
    console.error("[EXA] API key not configured");
    return [];
  }
  
  try {
    const results = await exa.searchAndContents(query, {
      numResults,
      useAutoprompt: true,
      type: "auto",
      contents: {
        text: true,
        highlights: true,
      },
    });

    return results.results.map((result: any) => ({
      url: result.url || "",
      title: result.title || "Untitled",
      snippet: result.highlights?.[0] || result.text?.slice(0, 200) || "",
      content: result.text,
    }));
  } catch (error) {
    console.error("[EXA] Search error:", error);
    return [];
  }
}

export async function exaDocumentationLookup(
  library: string,
  topic: string,
  numResults: number = 3
): Promise<ExaSearchResult[]> {
  if (!exa) {
    console.error("[EXA] API key not configured");
    return [];
  }
  
  try {
    const query = `${library} ${topic} documentation`;
    const results = await exa.searchAndContents(query, {
      numResults,
      useAutoprompt: true,
      type: "auto",
      contents: {
        text: true,
        highlights: true,
      },
    });

    return results.results.map((result: any) => ({
      url: result.url || "",
      title: result.title || "Untitled",
      snippet: result.highlights?.[0] || result.text?.slice(0, 200) || "",
      content: result.text,
    }));
  } catch (error) {
    console.error("[EXA] Documentation lookup error:", error);
    return [];
  }
}
