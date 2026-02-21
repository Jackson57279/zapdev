import { createAgent, createNetwork, createTool, openai } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { selectModelForTask, frameworkToConvexEnum, type Framework } from "@/agents/types";
import { ANGULAR_PROMPT, NEXTJS_PROMPT, REACT_PROMPT, SVELTE_PROMPT, VUE_PROMPT } from "@/prompt";
import { sanitizeTextForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { inngest } from "../client";

const FRAMEWORK_PROMPTS: Record<Framework, string> = {
  nextjs: NEXTJS_PROMPT,
  angular: ANGULAR_PROMPT,
  react: REACT_PROMPT,
  vue: VUE_PROMPT,
  svelte: SVELTE_PROMPT,
};

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

const getModelForAgentKit = (
  requestedModel: string | undefined,
  prompt: string,
  framework: Framework
): string => {
  if (requestedModel && requestedModel !== "auto") return requestedModel;
  return selectModelForTask(prompt, framework);
};

const truncate = (value: string, maxLength: number = 20_000): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

const SUMMARY_TAG_REGEX = /<task_summary>([\s\S]*?)<\/task_summary>/i;

const extractSummaryText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.length) return "";
  const match = SUMMARY_TAG_REGEX.exec(trimmed);
  if (match && typeof match[1] === "string") return match[1].trim();
  return "";
};

const buildInMemoryTools = (files: Record<string, string>) => {
  const terminalTool = createTool({
    name: "terminal",
    description:
      "Terminal commands are not available in this in-memory environment. Use createOrUpdateFiles to write or modify files.",
    parameters: z.object({ command: z.string() }),
    handler: async () =>
      "Terminal is not available. Files are written in-memory and previewed via WebContainer. Use the createOrUpdateFiles tool to make code changes.",
  });

  const createOrUpdateFilesTool = createTool({
    name: "createOrUpdateFiles",
    description: "Create or update files in the in-memory workspace.",
    parameters: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
    }),
    handler: async ({ files: incoming }) => {
      for (const file of incoming) {
        files[file.path] = file.content;
      }
      return `Updated ${incoming.length} file(s).`;
    },
  });

  const readFilesTool = createTool({
    name: "readFiles",
    description: "Read files from the in-memory workspace.",
    parameters: z.object({ files: z.array(z.string()) }),
    handler: async ({ files: paths }) =>
      JSON.stringify(paths.map((path) => ({ path, content: files[path] ?? null }))),
  });

  return [terminalTool, createOrUpdateFilesTool, readFilesTool];
};

export const runCodeAgentKitFunction = inngest.createFunction(
  { id: "run-code-agent-kit" },
  { event: "agent/code-agent-kit.run" },
  async ({ event }) => {
    const framework: Framework = (event.data.framework as Framework) ?? "nextjs";
    const userPrompt = event.data.value;
    const selectedModel = getModelForAgentKit(event.data.model, userPrompt, framework);
    const writtenFiles: Record<string, string> = {};

    const tools = buildInMemoryTools(writtenFiles);

    const codingAgent = createAgent({
      name: "ZapDev Coding Agent",
      description: "Generates and edits project code in an in-memory workspace.",
      system: `${FRAMEWORK_PROMPTS[framework]}

You are running inside an Inngest workflow. Files are stored in-memory and previewed via WebContainer in the browser.
Always implement the user's request using the available tools.
After finishing, return a concise summary wrapped in <task_summary> tags.`,
      model: openai({
        model: selectedModel,
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultParameters: { temperature: 0.2 },
      }),
      tools,
    });

    const network = createNetwork({
      name: "ZapDev Code Agent Network",
      agents: [codingAgent],
      router: ({ callCount }) => (callCount > 0 ? undefined : codingAgent),
    });

    const result = await network.run(userPrompt);
    const resultText = truncate(toText(result));
    const convex = getConvexClient();
    const projectId = event.data.projectId as Id<"projects">;
    const project = await convex.query(api.projects.getForSystem, { projectId });

    const summaryText =
      extractSummaryText(resultText) ||
      `Generated ${Object.keys(writtenFiles).length} file(s).`;

    const filteredFiles = filterAIGeneratedFiles(writtenFiles);

    const messageId = await convex.mutation(api.messages.createForUser, {
      userId: project.userId,
      projectId,
      content: sanitizeTextForDatabase(summaryText) || "Generated code is ready.",
      role: "ASSISTANT",
      type: "RESULT",
      status: "COMPLETE",
    });

    await convex.mutation(api.messages.createFragmentForUser, {
      userId: project.userId,
      messageId: messageId as Id<"messages">,
      sandboxUrl: WEB_CONTAINER_PREVIEW_URL,
      title: sanitizeTextForDatabase(summaryText.slice(0, 80)) || "In-Memory Result",
      files: filteredFiles,
      metadata: { source: "inngest-agent-kit", model: selectedModel },
      framework: frameworkToConvexEnum(framework),
    });

    return {
      ok: true,
      filesUpdated: Object.keys(filteredFiles).length,
    };
  }
);

export const runFixErrorsFunction = inngest.createFunction(
  { id: "run-fix-errors" },
  { event: "agent/fix-errors.run" },
  async ({ event }) => {
    const fragmentId = event.data.fragmentId as Id<"fragments">;
    const convex = getConvexClient();

    const fragment = await convex.query(api.messages.getFragmentById, { fragmentId });
    if (!fragment) throw new Error("Fragment not found");

    const message = await convex.query(api.messages.get, {
      messageId: fragment.messageId as Id<"messages">,
    });
    if (!message) throw new Error("Message not found");

    const project = await convex.query(api.projects.getForSystem, {
      projectId: message.projectId as Id<"projects">,
    });
    if (!project) throw new Error("Project not found");

    const fragmentFramework = (fragment.framework?.toLowerCase() || "nextjs") as Framework;
    const fragmentMetadata =
      typeof fragment.metadata === "object" && fragment.metadata !== null
        ? (fragment.metadata as Record<string, unknown>)
        : {};

    const fragmentModel = (fragmentMetadata.model as string) || "anthropic/claude-haiku-4.5";

    const currentFiles: Record<string, string> =
      typeof fragment.files === "object" && fragment.files !== null
        ? Object.fromEntries(
            Object.entries(fragment.files as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string])
          )
        : {};

    const fixedFiles = { ...currentFiles };
    const tools = buildInMemoryTools(fixedFiles);

    const filesSummary = Object.entries(currentFiles)
      .slice(0, 8)
      .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 500)}\n\`\`\``)
      .join("\n\n");

    const fixPrompt = `Review the following code files and fix any TypeScript errors, import issues, missing dependencies, or obvious bugs. Apply all fixes using the createOrUpdateFiles tool. When done, provide a <task_summary> of what was fixed.

Current files:
${filesSummary}`;

    const fixAgent = createAgent({
      name: "ZapDev Fix Agent",
      description: "Reviews and fixes code issues in-memory.",
      system: FRAMEWORK_PROMPTS[fragmentFramework],
      model: openai({
        model: fragmentModel,
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultParameters: { temperature: 0.2 },
      }),
      tools,
    });

    const network = createNetwork({
      name: "ZapDev Fix Network",
      agents: [fixAgent],
      router: ({ callCount }) => (callCount > 0 ? undefined : fixAgent),
    });

    const result = await network.run(fixPrompt);
    const resultText = truncate(toText(result));
    const summaryText = extractSummaryText(resultText) || "Applied code fixes.";

    await convex.mutation(api.messages.createFragmentForUser, {
      userId: project.userId,
      messageId: fragment.messageId,
      sandboxUrl: fragment.sandboxUrl,
      title: fragment.title,
      files: fixedFiles,
      framework: frameworkToConvexEnum(fragmentFramework),
      metadata: {
        ...fragmentMetadata,
        previousFiles: fragment.files,
        fixedAt: new Date().toISOString(),
      },
    });

    return { ok: true, summary: summaryText };
  }
);
