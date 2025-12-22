import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import {
  openai,
  createAgent,
  createNetwork,
  createState,
  type Message,
} from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inngest } from "./client";
import { SANDBOX_TIMEOUT, type Framework, type AgentState } from "./types";
import { sanitizeTextForDatabase } from "@/lib/utils";
import { createCodeAgentTools, MODEL_CONFIGS } from "./functions";
import { NEXTJS_PROMPT } from "@/prompt";
import { getShadcnSystemPrompt } from "@/prompts/shared";
import { lastAssistantTextMessageContent } from "./utils";

// Get Convex client lazily
let convexClient: ConvexHttpClient | null = null;
function getConvexClient() {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

const convex = new Proxy({} as ConvexHttpClient, {
  get(_target, prop) {
    return getConvexClient()[prop as keyof ConvexHttpClient];
  },
});

const SHADCN_PRESETS = {
  vega: 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=vega&baseColor=neutral&theme=neutral&iconLibrary=lucide&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next',
  nova: 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=nova&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next',
  maia: 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next',
  lyra: 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=lyra&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=jetbrains-mono&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next',
  mira: 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=mira&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next',
  "nova-indigo": 'npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=nova&baseColor=neutral&theme=indigo&iconLibrary=lucide&font=inter&menuAccent=subtle&menuColor=default&radius=medium&template=next" --template next',
} as const;

type ShadcnStyle = keyof typeof SHADCN_PRESETS;

function frameworkToConvexEnum(
  framework: Framework,
): "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE" {
  const mapping: Record<
    Framework,
    "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE"
  > = {
    nextjs: "NEXTJS",
    angular: "ANGULAR",
    react: "REACT",
    vue: "VUE",
    svelte: "SVELTE",
  };
  return mapping[framework];
}

export const shadcnCreateFunction = inngest.createFunction(
  { id: "shadcn-create" },
  { event: "shadcn/create" },
  async ({ event, step }) => {
    console.log("[DEBUG] Starting shadcn-create function");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));

    const style = (event.data.style as ShadcnStyle) || "vega";
    const prompt = event.data.prompt as string;
    const command = SHADCN_PRESETS[style];

    if (!command) {
      throw new Error(`Invalid style requested: ${style}`);
    }

    // Get project
    const project = await step.run("get-project", async () => {
      return await convex.query(api.projects.getForSystem, {
        projectId: event.data.projectId as Id<"projects">,
      });
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Create Sandbox
    const sandboxId = await step.run("get-sandbox-id", async () => {
      console.log("[DEBUG] Creating E2B sandbox for Shadcn...");
      
      try {
        const sandbox = await Sandbox.create("zapdev", {
          apiKey: process.env.E2B_API_KEY,
          timeoutMs: SANDBOX_TIMEOUT,
        });

        console.log("[DEBUG] Sandbox created successfully:", sandbox.sandboxId);
        return sandbox.sandboxId;
      } catch (error) {
        console.error("[ERROR] Failed to create E2B sandbox:", error);
        throw new Error(`E2B sandbox creation failed: ${error}`);
      }
    });

    // Create sandbox session
    await step.run("create-sandbox-session", async () => {
      try {
        await convex.mutation(api.sandboxSessions.create, {
          sandboxId,
          projectId: event.data.projectId as Id<"projects">,
          userId: project.userId,
          framework: "NEXTJS",
          autoPauseTimeout: 10 * 60 * 1000,
        });
      } catch (error) {
        console.error("[ERROR] Failed to create sandbox session:", error);
      }
    });

    // Run the Shadcn Create Command
    await step.run("run-shadcn-create", async () => {
      const sandbox = await Sandbox.connect(sandboxId);
      console.log(`[DEBUG] Running command: ${command}`);
      
      const fullCommand = `rm -rf ./* && ${command} .`;
      
      const result = await sandbox.commands.run(fullCommand, {
        timeoutMs: 5 * 60 * 1000, // 5 minutes for install
      });
      
      if (result.exitCode !== 0) {
        console.error("[ERROR] Shadcn create failed:", result.stderr);
        throw new Error(`Shadcn create failed: ${result.stderr}`);
      }
      
      console.log("[DEBUG] Shadcn create output:", result.stdout);
    });

    // If a prompt is provided, run the agent to build on top of the scaffold
    let agentFiles: Record<string, string> = {};
    let agentSummary = "";

    if (prompt) {
      console.log("[DEBUG] Prompt provided, running agent...");
      
      const agentResult = await step.run("run-agent-build", async () => {
        const state = createState<AgentState>(
          {
            summary: "",
            files: {},
            selectedFramework: "nextjs",
            summaryRetryCount: 0,
          },
          {
            messages: [{ type: "text", role: "user", content: prompt }],
          },
        );

        const modelConfig = MODEL_CONFIGS["anthropic/claude-haiku-4.5"];
        
        const codeAgent = createAgent<AgentState>({
          name: "shadcn-builder-agent",
          description: "An expert Next.js coding agent",
          system: getShadcnSystemPrompt(NEXTJS_PROMPT, style),
          model: openai({
            model: "anthropic/claude-haiku-4.5",
            apiKey: process.env.AI_GATEWAY_API_KEY!,
            baseUrl: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
            defaultParameters: {
              temperature: modelConfig.temperature,
              frequency_penalty: modelConfig.frequency_penalty,
            },
          }),
          tools: createCodeAgentTools(sandboxId),
          lifecycle: {
            onResponse: async ({ result, network }) => {
              const lastAssistantMessageText = lastAssistantTextMessageContent(result);
              if (lastAssistantMessageText && network) {
                if (lastAssistantMessageText.includes("<task_summary>")) {
                  const match = /<task_summary>([\s\S]*?)<\/task_summary>/i.exec(lastAssistantMessageText);
                  if (match) {
                    network.state.data.summary = match[1].trim();
                  }
                }
              }
              return result;
            },
          },
        });

        const network = createNetwork<AgentState>({
          name: "shadcn-builder-network",
          agents: [codeAgent],
          maxIter: 8,
          defaultState: state,
        });

        const result = await network.run(prompt, { state });
        return {
          files: result.state.data.files || {},
          summary: result.state.data.summary || "Build complete.",
        };
      });

      agentFiles = agentResult.files;
      agentSummary = agentResult.summary;
    }

    // Get the files (combine scaffolded + agent files)
    const files = await step.run("read-files", async () => {
      const sandbox = await Sandbox.connect(sandboxId);
      
      const findCommand = "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*'";
      const findResult = await sandbox.commands.run(findCommand);
      const filePaths = findResult.stdout.split("\n").filter(p => p.trim());
      
      const MAX_FILES = 50;
      const pathsToRead = filePaths.slice(0, MAX_FILES);
      
      const files: Record<string, string> = {};
      
      for (const path of pathsToRead) {
        const cleanPath = path.startsWith("./") ? path.substring(2) : path;
        const content = await sandbox.files.read(path);
        files[cleanPath] = content;
      }
      
      return files;
    });

    // Save Result
    await step.run("save-result", async () => {
      const summary = prompt 
        ? `Created Shadcn project (${style}) and built: ${agentSummary}`
        : `Created new Shadcn project with style: ${style}`;
      
      // Create message
      const messageId = await convex.mutation(api.messages.createForUser, {
        userId: project.userId,
        projectId: event.data.projectId as Id<"projects">,
        content: summary,
        role: "ASSISTANT",
        type: "RESULT",
        status: "COMPLETE",
      });

      // Create fragment
      await convex.mutation(api.messages.createFragmentForUser, {
        userId: project.userId,
        messageId: messageId as Id<"messages">,
        sandboxId,
        sandboxUrl: `https://${sandboxId}.sandbox.e2b.dev`,
        title: prompt ? `Shadcn Build: ${prompt.slice(0, 20)}...` : `Shadcn ${style} Project`,
        files,
        framework: "NEXTJS",
        metadata: {
          style,
          command,
          type: "shadcn-create",
          prompt
        },
      });
    });

    return { success: true, style, sandboxId };
  }
);
