import { createAgent, createNetwork, createTool, openai } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { frameworkToConvexEnum } from "@/agents/types";
import { NEXTJS_PROMPT } from "@/prompt";
import { sanitizeTextForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { inngest } from "../client";

const WEB_CONTAINER_PREVIEW_URL = "webcontainer://local";

let convexClient: ConvexHttpClient | null = null;

const getConvexClient = (): ConvexHttpClient => {
  if (convexClient) return convexClient;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  convexClient = new ConvexHttpClient(convexUrl);
  return convexClient;
};

const toText = (value: unknown): string => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};

const truncate = (value: string, maxLength: number = 20_000): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

const SUMMARY_TAG_REGEX = /<task_summary>([\s\S]*?)<\/task_summary>/i;
const extractSummaryText = (value: string): string => {
  const match = SUMMARY_TAG_REGEX.exec(value.trim());
  if (match && typeof match[1] === "string") return match[1].trim();
  return "";
};

export const runFigmaImportFunction = inngest.createFunction(
  { id: "run-figma-import" },
  { event: "agent/figma-import.run" },
  async ({ event }) => {
    const { projectId, importId, fileKey, accessToken, figmaUrl, fileBase64, fileName } = event.data;
    const convex = getConvexClient();

    let prompt: string;

    if (fileKey && accessToken) {
      let figmaFileContext = "";
      try {
        const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (fileResponse.ok) {
          const fileData = await fileResponse.json() as { name?: string; document?: unknown };
          figmaFileContext = `Figma file name: ${fileData.name ?? "Unknown"}\n`;
        }
      } catch {
        figmaFileContext = "";
      }

      prompt = `${figmaFileContext}Import and recreate this Figma design (file key: ${fileKey}).

Please analyze the design and create a complete Next.js implementation with:
1. Accurate layout and spacing matching the original design
2. Proper color scheme and typography
3. Responsive design that works on mobile and desktop
4. All interactive elements with proper hover/focus states
5. Use Shadcn UI components from @/components/ui/
6. Follow Next.js best practices

After finishing, return a concise summary wrapped in <task_summary> tags.`;
    } else if (figmaUrl) {
      prompt = `Import and recreate the Figma design from this URL: ${figmaUrl}

Create a complete Next.js implementation with:
1. Accurate layout matching the design intent
2. Proper color scheme and typography
3. Responsive design for mobile and desktop
4. Interactive elements with hover/focus states
5. Use Shadcn UI components from @/components/ui/

After finishing, return a concise summary wrapped in <task_summary> tags.`;
    } else {
      prompt = `Import and recreate the Figma design from the uploaded file: ${fileName ?? "figma-upload"}.

Create a complete Next.js implementation with:
1. Accurate layout and spacing
2. Proper color scheme
3. Responsive design
4. Interactive elements
5. Use Shadcn UI components from @/components/ui/

After finishing, return a concise summary wrapped in <task_summary> tags.`;
    }

    const writtenFiles: Record<string, string> = {};

    const createOrUpdateFilesTool = createTool({
      name: "createOrUpdateFiles",
      description: "Create or update files in the in-memory workspace.",
      parameters: z.object({
        files: z.array(z.object({ path: z.string(), content: z.string() })),
      }),
      handler: async ({ files }) => {
        for (const file of files) writtenFiles[file.path] = file.content;
        return `Updated ${files.length} file(s).`;
      },
    });

    const readFilesTool = createTool({
      name: "readFiles",
      description: "Read files from the in-memory workspace.",
      parameters: z.object({ files: z.array(z.string()) }),
      handler: async ({ files }) =>
        JSON.stringify(files.map((path) => ({ path, content: writtenFiles[path] ?? null }))),
    });

    const figmaAgent = createAgent({
      name: "ZapDev Figma Import Agent",
      description: "Generates code from Figma designs in-memory.",
      system: `${NEXTJS_PROMPT}

You are implementing a design imported from Figma. Create a faithful implementation using Next.js and Shadcn UI components.`,
      model: openai({
        model: "anthropic/claude-haiku-4.5",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultParameters: { temperature: 0.2 },
      }),
      tools: [createOrUpdateFilesTool, readFilesTool],
    });

    const network = createNetwork({
      name: "ZapDev Figma Import Network",
      agents: [figmaAgent],
      router: ({ callCount }) => (callCount > 0 ? undefined : figmaAgent),
    });

    const result = await network.run(prompt);
    const resultText = truncate(toText(result));
    const summaryText = extractSummaryText(resultText) || `Figma import: generated ${Object.keys(writtenFiles).length} file(s).`;
    const filteredFiles = filterAIGeneratedFiles(writtenFiles);

    const project = await convex.query(api.projects.getForSystem, {
      projectId: projectId as Id<"projects">,
    });

    const messageId = await convex.mutation(api.messages.createForUser, {
      userId: project.userId,
      projectId: projectId as Id<"projects">,
      content: sanitizeTextForDatabase(summaryText) || "Figma import complete.",
      role: "ASSISTANT",
      type: "RESULT",
      status: "COMPLETE",
    });

    await convex.mutation(api.messages.createFragmentForUser, {
      userId: project.userId,
      messageId: messageId as Id<"messages">,
      sandboxUrl: WEB_CONTAINER_PREVIEW_URL,
      title: sanitizeTextForDatabase(summaryText.slice(0, 80)) || "Figma Import Result",
      files: filteredFiles,
      metadata: { source: "figma-import", importId, model: "anthropic/claude-haiku-4.5" },
      framework: frameworkToConvexEnum("nextjs"),
    });

    return { ok: true, filesUpdated: Object.keys(filteredFiles).length };
  }
);
