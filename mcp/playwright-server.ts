#!/usr/bin/env node
// @ts-nocheck

import { chromium, Browser, Page } from "playwright";
import {
  Server,
} from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";

let browser: Browser | null = null;
let page: Page | null = null;

async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  if (!page) {
    const context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

const server = new Server(
  {
    name: "zapdev-playwright-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Helper to normalize URLs – if a bare host is provided, prefix with https
function normalizeUrl(raw: string): string {
  try {
    return new URL(raw).toString();
  } catch {
    return new URL(raw, "https://").toString();
  }
}

server.tool(
  "open-page",
  {
    description:
      "Open a web page in Playwright. Usually pass the E2B sandbox URL (e.g. https://<sandboxId>.sandbox.e2b.dev).",
    inputSchema: z.object({
      url: z.string().describe("Absolute URL to open"),
      waitForNetworkIdle: z
        .boolean()
        .default(true)
        .describe("Wait for network to be idle before returning"),
    }),
  },
  async ({ url, waitForNetworkIdle }) => {
    const page = await getPage();
    const targetUrl = normalizeUrl(url);

    await page.goto(targetUrl, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "load",
      timeout: 60_000,
    });

    const title = await page.title();

    return {
      content: [
        {
          type: "text",
          text: `Opened ${targetUrl}\nTitle: ${title}`,
        },
      ],
    };
  },
);

server.tool(
  "snapshot-page",
  {
    description:
      "Return a compact snapshot of the current page: URL, title, and trimmed HTML+text for analysis.",
    inputSchema: z.object({
      maxChars: z
        .number()
        .int()
        .positive()
        .max(50_000)
        .default(5_000)
        .describe("Maximum characters of combined HTML/text to return"),
    }),
  },
  async ({ maxChars }) => {
    const page = await getPage();
    const currentUrl = page.url();
    const title = await page.title();

    const html = await page.content();
    const bodyText = (await page.textContent("body")) || "";

    const combined = `URL: ${currentUrl}\nTITLE: ${title}\n\nHTML:\n${html}\n\nTEXT:\n${bodyText}`;
    const trimmed =
      combined.length > maxChars
        ? combined.slice(0, maxChars) + "\n...[truncated]"
        : combined;

    return {
      content: [
        {
          type: "text",
          text: trimmed,
        },
      ],
    };
  },
);

server.tool(
  "review-page",
  {
    description:
      "High-level UX/code-review helper. Loads the given URL and returns structured observations and suggestions suitable for feeding back into the coding agent.",
    inputSchema: z.object({
      url: z.string().describe("URL to review (usually the sandbox preview URL)"),
      focus: z
        .string()
        .optional()
        .describe(
          "Optional focus area, e.g. 'accessibility', 'performance', 'layout', or 'copy'.",
        ),
    }),
  },
  async ({ url, focus }) => {
    const page = await getPage();
    const targetUrl = normalizeUrl(url);

    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    const title = await page.title();
    const bodyText = ((await page.textContent("body")) || "").slice(0, 10_000);

    const focusNote = focus ? `Focus: ${focus}` : "Focus: general UX & implementation";

    const analysisPrompt = [
      `You are reviewing a live web app page opened via Playwright.`,
      `URL: ${targetUrl}`,
      `Title: ${title}`,
      focusNote,
      "\nBelow is the first 10k characters of the page body text:",
      bodyText,
      "\nProvide:",
      "1. A short summary of what this page appears to do.",
      "2. A bullet list of UX issues or confusing behaviors you notice.",
      "3. A bullet list of implementation issues you suspect in the underlying React/Next.js code (based only on what you can infer).",
      "4. Concrete suggestions the coding agent should apply in the codebase to improve this page.",
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: analysisPrompt,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[MCP] Playwright server failed:", err);
  process.exit(1);
});
