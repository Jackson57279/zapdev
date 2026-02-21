import { createAgent, createNetwork, createTool, openai } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { runCodeAgent, type StreamEvent } from "@/agents/code-agent";
import {
  createSandbox,
  getSandbox,
  getSandboxUrl,
  isValidFilePath,
  readFileWithTimeout,
  writeFilesBatch,
} from "@/agents/sandbox-utils";
import { frameworkToConvexEnum, selectModelForTask, type Framework, type ModelId } from "@/agents/types";
import { ANGULAR_PROMPT, NEXTJS_PROMPT, REACT_PROMPT, SVELTE_PROMPT, VUE_PROMPT } from "@/prompt";
import { inngest } from "../client";

const FRAMEWORK_PROMPTS: Record<Framework, string> = {
  nextjs: NEXTJS_PROMPT,
  angular: ANGULAR_PROMPT,
  react: REACT_PROMPT,
  vue: VUE_PROMPT,
  svelte: SVELTE_PROMPT,
};

let convexClient: ConvexHttpClient | null = null;

const getConvexClient = (): ConvexHttpClient => {
  if (convexClient) {
    return convexClient;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }

  convexClient = new ConvexHttpClient(convexUrl);
  return convexClient;
};

const toText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getRequestedModel = (model: string | undefined): ModelId => {
  if (!model || model === "auto") {
    return "auto";
  }

  return model as ModelId;
};

const getModelForAgentKit = (
  requestedModel: string | undefined,
  prompt: string,
  framework: Framework
): string => {
  if (requestedModel && requestedModel !== "auto") {
    return requestedModel;
  }

  return selectModelForTask(prompt, framework);
};

const truncate = (value: string, maxLength: number = 20_000): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

export const runCodeAgentInngestFunction = inngest.createFunction(
  { id: "run-code-agent-ai-sdk" },
  { event: "agent/code.run" },
  async ({ event }) => {
    const streamInput = {
      projectId: event.data.projectId,
      value: event.data.value,
      model: getRequestedModel(event.data.model),
    };

    let lastEvent: StreamEvent | null = null;
    let eventCount = 0;

    for await (const streamEvent of runCodeAgent(streamInput)) {
      eventCount += 1;
      lastEvent = streamEvent;
    }

    return {
      ok: true,
      eventCount,
      finalEventType: lastEvent?.type ?? null,
    };
  }
);

export const runCodeAgentKitFunction = inngest.createFunction(
  { id: "run-code-agent-kit" },
  { event: "agent/code-agent-kit.run" },
  async ({ event }) => {
    const framework: Framework = event.data.framework ?? "nextjs";
    const userPrompt = event.data.value;
    const selectedModel = getModelForAgentKit(event.data.model, userPrompt, framework);
    const sandbox = await createSandbox(framework);
    const sandboxId = sandbox.sandboxId;
    const writtenFiles: Record<string, string> = {};

    const terminalTool = createTool({
      name: "terminal",
      description: "Run shell commands inside the E2B sandbox.",
      parameters: z.object({
        command: z.string(),
      }),
      handler: async ({ command }) => {
        const connectedSandbox = await getSandbox(sandboxId);
        const buffers = {
          stdout: "",
          stderr: "",
        };

        const result = await connectedSandbox.commands.run(command, {
          timeoutMs: 60_000,
          onStdout: (chunk: string) => {
            buffers.stdout += chunk;
          },
          onStderr: (chunk: string) => {
            buffers.stderr += chunk;
          },
        });

        const combined = `${result.stdout || buffers.stdout}${buffers.stderr ? `\n${buffers.stderr}` : ""}`;
        return truncate(combined);
      },
    });

    const createOrUpdateFilesTool = createTool({
      name: "createOrUpdateFiles",
      description: "Create or update files in the E2B sandbox.",
      parameters: z.object({
        files: z.array(
          z.object({
            path: z.string(),
            content: z.string(),
          })
        ),
      }),
      handler: async ({ files }) => {
        const connectedSandbox = await getSandbox(sandboxId);
        const filesToWrite: Record<string, string> = {};

        for (const file of files) {
          if (!isValidFilePath(file.path)) {
            throw new Error(`Invalid file path: ${file.path}`);
          }
          filesToWrite[file.path] = file.content;
          writtenFiles[file.path] = file.content;
        }

        await writeFilesBatch(connectedSandbox, filesToWrite);
        return `Updated ${files.length} file(s).`;
      },
    });

    const readFilesTool = createTool({
      name: "readFiles",
      description: "Read one or more files from the E2B sandbox.",
      parameters: z.object({
        files: z.array(z.string()),
      }),
      handler: async ({ files }) => {
        const connectedSandbox = await getSandbox(sandboxId);
        const results: Array<{ path: string; content: string | null }> = [];

        for (const filePath of files) {
          if (!isValidFilePath(filePath)) {
            results.push({ path: filePath, content: null });
            continue;
          }

          const content = await readFileWithTimeout(connectedSandbox, filePath);
          results.push({ path: filePath, content });
        }

        return JSON.stringify(results);
      },
    });

    const codingAgent = createAgent({
      name: "ZapDev Coding Agent",
      description: "Generates and edits project code in an E2B sandbox.",
      system: `${FRAMEWORK_PROMPTS[framework]}

You are running inside an Inngest workflow with tool access.
Always implement the user's request using the available tools.
After finishing, return a concise summary wrapped in <task_summary> tags.`,
      model: openai({
        model: selectedModel,
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultParameters: {
          temperature: 0.2,
        },
      }),
      tools: [terminalTool, createOrUpdateFilesTool, readFilesTool],
    });

    const network = createNetwork({
      name: "ZapDev Code Agent Network",
      agents: [codingAgent],
      router: ({ callCount }) => {
        if (callCount > 0) {
          return;
        }

        return codingAgent;
      },
    });

    const result = await network.run(userPrompt);
    const resultText = truncate(toText(result));
    const convex = getConvexClient();
    const projectId = event.data.projectId as Id<"projects">;

    const project = await convex.query(api.projects.getForSystem, {
      projectId,
    });

    const sandboxUrl = await getSandboxUrl(sandbox, framework);
    const messageId = await convex.mutation(api.messages.createForUser, {
      userId: project.userId,
      projectId,
      content: resultText,
      role: "ASSISTANT",
      type: "RESULT",
      status: "COMPLETE",
    });

    await convex.mutation(api.messages.createFragmentForUser, {
      userId: project.userId,
      messageId: messageId as Id<"messages">,
      sandboxId,
      sandboxUrl,
      title: "Inngest Agent Kit Result",
      files: writtenFiles,
      metadata: {
        source: "inngest-agent-kit",
        model: selectedModel,
      },
      framework: frameworkToConvexEnum(framework),
    });

    return {
      ok: true,
      sandboxId,
      sandboxUrl,
      filesUpdated: Object.keys(writtenFiles).length,
    };
  }
);
