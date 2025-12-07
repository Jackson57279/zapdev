import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import {
  openai,
  gemini,
  createAgent,
  createTool,
  createNetwork,
  type Tool,
  type Message,
  createState,
} from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inspect } from "util";
import {
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
  FRAMEWORK_SELECTOR_PROMPT,
  NEXTJS_PROMPT,
  ANGULAR_PROMPT,
  REACT_PROMPT,
  VUE_PROMPT,
  SVELTE_PROMPT,
  SPEC_MODE_PROMPT,
} from "@/prompt";
import { sanitizeJsonForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { inngest } from "./client";
import { type Framework, type AgentState, SANDBOX_TIMEOUT } from "./types";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  parseAgentOutput,
  createSandboxWithRetry,
  ensureDevServerRunning,
} from "./utils";

// Get Convex client lazily to avoid build-time errors
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

// Multi-agent workflow removed; only single code agent is used.

type FragmentMetadata = Record<string, unknown>;

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

// Model configurations for multi-model support
export const MODEL_CONFIGS = {
  "anthropic/claude-haiku-4.5": {
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient for most coding tasks",
    temperature: 0.7,
  },
  "openai/gpt-5.1-codex": {
    name: "GPT-5.1 Codex",
    provider: "openai",
    description: "OpenAI's flagship model for complex tasks",
    temperature: 0.7,
  },
  "moonshotai/kimi-k2-thinking": {
    name: "Kimi K2 Thinking",
    provider: "moonshot",
    description: "Fast and efficient for speed-critical tasks",
    temperature: 0.7,
  },
  "google/gemini-3-pro-preview": {
    name: "Gemini 3 Pro",
    provider: "google",
    description: "Specialized for coding tasks",
    temperature: 0.7,
  },
  "xai/grok-4-fast-reasoning": {
    name: "Grok 4 Fast",
    provider: "xai",
    description: "Good at nothing",
    temperature: 0.7,
  },
  "prime-intellect/intellect-3": {
    name: "Intellect 3",
    provider: "prime-intellect",
    description: "Advanced reasoning model from Prime Intellect",
    temperature: 0.7,
  },
  "bfl/flux-kontext-pro": {
    name: "Flux Kontext Pro",
    provider: "bfl",
    description:
      "Advanced image generation with context awareness for Pro users",
    temperature: 0.7,
    isProOnly: true,
    isImageGeneration: true,
    hidden: true,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS | "auto";

// Auto-selection logic to choose the best model based on task complexity
export function selectModelForTask(
  prompt: string,
  framework?: Framework,
): keyof typeof MODEL_CONFIGS {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();
  let chosenModel: keyof typeof MODEL_CONFIGS = "anthropic/claude-haiku-4.5";

  // Analyze task complexity
  const complexityIndicators = [
    "advanced",
    "complex",
    "sophisticated",
    "enterprise",
    "architecture",
    "performance",
    "optimization",
    "scalability",
    "authentication",
    "authorization",
    "database",
    "api",
    "integration",
    "deployment",
    "security",
    "testing",
  ];

  const hasComplexityIndicators = complexityIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  const isLongPrompt = promptLength > 500;
  const isVeryLongPrompt = promptLength > 1000;

  // Framework-specific model selection
  if (framework === "angular" && (hasComplexityIndicators || isLongPrompt)) {
    // Angular projects tend to be more enterprise-focused; keep Haiku for consistency
    return chosenModel;
  }

  // Coding-specific keywords favor Qwen
  const codingIndicators = [
    "refactor",
    "optimize",
    "debug",
    "fix bug",
    "improve code",
  ];
  const hasCodingFocus = codingIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  if (hasCodingFocus && !isVeryLongPrompt) {
    chosenModel = "google/gemini-3-pro-preview";
  }

  // Speed-critical tasks favor Kimi, but only override if clearly requested
  const speedIndicators = ["quick", "fast", "simple", "basic", "prototype"];
  const needsSpeed = speedIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  if (needsSpeed && !hasComplexityIndicators) {
    chosenModel = "moonshotai/kimi-k2-thinking";
  }

  // Highly complex or long tasks stick with Haiku
  if (hasComplexityIndicators || isVeryLongPrompt) {
    chosenModel = "anthropic/claude-haiku-4.5";
  }

  return chosenModel;
}

/**
 * Returns the appropriate AI adapter based on model provider
 */
function getModelAdapter(
  modelId: keyof typeof MODEL_CONFIGS | string,
  temperature?: number,
) {
  // Validate environment variables early
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY environment variable is not set. Cannot initialize AI models.",
    );
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1";

  const config =
    modelId in MODEL_CONFIGS
      ? MODEL_CONFIGS[modelId as keyof typeof MODEL_CONFIGS]
      : null;

  const temp = temperature ?? config?.temperature ?? 0.7;

  // Detect Google models to use native Gemini adapter
  const isGoogleModel =
    config?.provider === "google" ||
    modelId.startsWith("google/") ||
    modelId.includes("gemini");

  if (isGoogleModel) {
    console.log("[DEBUG] Initializing Gemini adapter for model:", modelId);
    try {
      return gemini({
        apiKey,
        baseUrl,
        model: modelId,
        defaultParameters: {
          generationConfig: {
            temperature: temp,
          },
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize Gemini adapter for model "${modelId}": ${errorMessage}`,
      );
    }
  }

  // Use OpenAI adapter for all other models (OpenAI, Anthropic, Moonshot, xAI, etc.)
  console.log(
    "[DEBUG] Initializing OpenAI-compatible adapter for model:",
    modelId,
  );
  try {
    return openai({
      apiKey,
      baseUrl,
      model: modelId,
      defaultParameters: {
        temperature: temp,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize OpenAI adapter for model "${modelId}": ${errorMessage}`,
    );
  }
}

/**
 * Converts screenshot URLs to AI-compatible image messages
 */
async function createImageMessages(screenshots: string[]): Promise<Message[]> {
  const imageMessages: Message[] = [];

  for (const screenshotUrl of screenshots) {
    try {
      // Represent screenshot as a text message containing the image URL.
      // The agent/tooling layer currently supports only text/tool_* messages,
      // so we encode the image as a markdown link the model can fetch.
      const imageMessage: Message = {
        type: "text",
        role: "user",
        content: `Screenshot: ${screenshotUrl}`,
      };
      imageMessages.push(imageMessage);
    } catch (error) {
      console.error(
        `[ERROR] Failed to create image message for ${screenshotUrl}:`,
        error,
      );
    }
  }

  return imageMessages;
}

const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i,
  /\[ERROR\]/i,
  /ERROR/,
  /Failed\b/i,
  /failure\b/i,
  /Exception\b/i,
  /SyntaxError/i,
  /TypeError/i,
  /ReferenceError/i,
  /Module not found/i,
  /Cannot find module/i,
  /Failed to resolve/i,
  /Build failed/i,
  /Compilation error/i,
  /undefined is not/i,
  /null is not/i,
  /Cannot read propert/i,
  /is not a function/i,
  /is not defined/i,
  /ESLint/i,
  /Type error/i,
  /TS\d+/i,
  // ECMAScript/Turbopack errors
  /Ecmascript file had an error/i,
  /Parsing ecmascript source code failed/i,
  /Turbopack build failed/i,
  /the name .* is defined multiple times/i,
  /Expected a semicolon/i,
  // Additional error patterns
  /CommandExitError/i,
  /ENOENT/i,
  /Module build failed/i,
];

const SUMMARY_TAG_REGEX = /<task_summary>([\s\S]*?)<\/task_summary>/i;

const extractSummaryText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const match = SUMMARY_TAG_REGEX.exec(trimmed);
  if (match && typeof match[1] === "string") {
    return match[1].trim();
  }

  return trimmed;
};

const runLintCheck = async (sandboxId: string): Promise<string | null> => {
  const sandbox = await getSandbox(sandboxId);
  const buffers: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  try {
    const result = await sandbox.commands.run("npm run lint", {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      },
    });

    const output = buffers.stdout + buffers.stderr;

    // Exit code 127 means command not found - gracefully skip validation
    if (result.exitCode === 127) {
      console.warn(
        "[WARN] Lint script not found in package.json, skipping lint check",
      );
      return null;
    }

    // If lint found errors (non-zero exit code and has output)
    if (result.exitCode !== 0 && output.length > 0) {
      // Check if output contains actual error indicators (not just warnings)
      if (/error|✖/i.test(output)) {
        console.log("[DEBUG] Lint check found ERRORS:\n", output);
        return output;
      }
      // Also check for any pattern match indicating a problem
      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        console.log("[DEBUG] Lint check found issues:\n", output);
        return output;
      }
    }

    console.log("[DEBUG] Lint check passed with no errors");
    return null;
  } catch (error) {
    // E2B SDK throws CommandExitError when command exits with non-zero status
    // We need to handle this and extract the output that was captured before the error
    const output = buffers.stdout + buffers.stderr;

    console.error("[DEBUG] Lint check failed with exception:", error);

    // If we have output from lint, check if it contains actual errors
    if (output.trim()) {
      console.log("[DEBUG] Lint output before exception:\n", output);

      // Check if output contains actual error indicators (not just warnings)
      if (/error|✖/i.test(output)) {
        console.log("[DEBUG] Lint check found ERRORS in exception output");
        return output;
      }

      // Also check for any pattern match indicating a problem
      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        console.log("[DEBUG] Lint check found issues in exception output");
        return output;
      }
    }

    // Don't fail the entire process if lint check fails with no clear errors
    console.warn(
      "[WARN] Lint check threw exception but no clear errors found, continuing",
    );
    return null;
  }
};

const runBuildCheck = async (sandboxId: string): Promise<string | null> => {
  const sandbox = await getSandbox(sandboxId);
  const buffers: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  // Try to build the project to catch build-time errors
  const buildCommand = "npm run build";
  console.log("[DEBUG] Running build check with command:", buildCommand);

  try {
    const result = await sandbox.commands.run(buildCommand, {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      },
      timeoutMs: BUILD_TIMEOUT_MS, // 2 minute timeout for build (some builds need more time)
    });

    const output = buffers.stdout + buffers.stderr;

    // Exit code 127 means command not found - gracefully skip validation
    if (result.exitCode === 127) {
      console.warn(
        "[WARN] Build script not found in package.json, skipping build check",
      );
      return null;
    }

    // If build failed (non-zero exit code)
    if (result.exitCode !== 0) {
      console.log(
        "[DEBUG] Build check FAILED with exit code:",
        result.exitCode,
      );
      console.log("[DEBUG] Build output:\n", output);

      // Check if output contains error patterns
      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        return `Build failed with errors:\n${output}`;
      }

      // Even if no specific pattern matches, if build failed it's an error
      return `Build failed with exit code ${result.exitCode}:\n${output}`;
    }

    console.log("[DEBUG] Build check passed successfully");
    return null;
  } catch (error) {
    // E2B SDK throws CommandExitError when command exits with non-zero status
    // We need to handle this and extract the output that was captured before the error
    const output = buffers.stdout + buffers.stderr;

    console.error("[DEBUG] Build check failed with exception:", error);
    if (error instanceof Error && error.stack) {
      console.error("[DEBUG] Stack trace:", error.stack);
    }

    // If we have output from the build, use it (this is the actual error)
    if (output.trim()) {
      console.log("[DEBUG] Build output before exception:\n", output);

      // Check if output contains error patterns
      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        return `Build failed with errors:\n${output}`;
      }

      return `Build failed:\n${output}`;
    }

    // If we don't have output, return the exception details
    const serializedError =
      error instanceof Error
        ? `${error.message}${error.stack ? `\n${error.stack}` : ""}`.trim()
        : inspect(error, { depth: null });

    // Return the error as it likely indicates a build problem
    return `Build check exception: ${serializedError}`;
  }
};

const getE2BTemplate = (framework: Framework): string => {
  switch (framework) {
    case "nextjs":
      return "zapdev";
    case "angular":
      return "zapdev-angular";
    case "react":
      return "zapdev-react";
    case "vue":
      return "zapdev-vue";
    case "svelte":
      return "zapdev-svelte";
    default:
      return "zapdev";
  }
};

const getFrameworkPort = (framework: Framework): number => {
  switch (framework) {
    case "nextjs":
      return 3000;
    case "angular":
      return 4200;
    case "react":
    case "vue":
    case "svelte":
      return 5173;
    default:
      return 3000;
  }
};

const getFrameworkPrompt = (framework: Framework): string => {
  switch (framework) {
    case "nextjs":
      return NEXTJS_PROMPT;
    case "angular":
      return ANGULAR_PROMPT;
    case "react":
      return REACT_PROMPT;
    case "vue":
      return VUE_PROMPT;
    case "svelte":
      return SVELTE_PROMPT;
    default:
      return NEXTJS_PROMPT;
  }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 500;
const FILE_READ_TIMEOUT_MS = 3000; // Reduced from 5000 to 3000ms for faster failure detection
const BUILD_TIMEOUT_MS = 120000; // 2 minutes for build operations (increased from 60s)

const ALLOWED_WORKSPACE_PATHS = ["/home/user", "."];
type SandboxWithHost = Sandbox & {
  getHost?: (port: number) => string | undefined;
};

export const isValidFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }

  const normalizedPath = filePath.trim();

  if (normalizedPath.length === 0 || normalizedPath.length > 4096) {
    return false;
  }

  if (normalizedPath.includes("..")) {
    return false;
  }

  if (
    normalizedPath.includes("\0") ||
    normalizedPath.includes("\n") ||
    normalizedPath.includes("\r")
  ) {
    return false;
  }

  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(
    (basePath) =>
      normalizedPath === basePath ||
      normalizedPath.startsWith(`${basePath}/`) ||
      normalizedPath.startsWith(`./`),
  );

  return isInWorkspace || normalizedPath.startsWith("/home/user/");
};

export const readFileWithTimeout = async (
  sandbox: Sandbox,
  filePath: string,
  timeoutMs: number,
): Promise<string | null> => {
  if (!isValidFilePath(filePath)) {
    console.warn(`[WARN] Invalid file path detected, skipping: ${filePath}`);
    return null;
  }

  try {
    const readPromise = sandbox.files.read(filePath);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );

    const content = await Promise.race([readPromise, timeoutPromise]);

    if (content === null) {
      console.warn(`[WARN] File read timeout for ${filePath}`);
      return null;
    }

    if (typeof content === "string" && content.length > MAX_FILE_SIZE) {
      console.warn(
        `[WARN] File ${filePath} exceeds size limit (${content.length} bytes), skipping`,
      );
      return null;
    }

    return typeof content === "string" ? content : null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Failed to read file ${filePath}:`, errorMessage);
    return null;
  }
};

export const readFilesInBatches = async (
  sandbox: Sandbox,
  filePaths: string[],
  batchSize: number,
): Promise<Record<string, string>> => {
  const allFilesMap: Record<string, string> = {};

  const validFilePaths = filePaths.filter(isValidFilePath);
  const invalidCount = filePaths.length - validFilePaths.length;

  if (invalidCount > 0) {
    console.warn(
      `[WARN] Filtered out ${invalidCount} invalid file paths (path traversal attempts or invalid paths)`,
    );
  }

  const totalFiles = Math.min(validFilePaths.length, MAX_FILE_COUNT);

  if (validFilePaths.length > MAX_FILE_COUNT) {
    console.warn(
      `[WARN] File count (${validFilePaths.length}) exceeds limit (${MAX_FILE_COUNT}), reading first ${MAX_FILE_COUNT} files`,
    );
  }

  const filesToRead = validFilePaths.slice(0, totalFiles);

  for (let i = 0; i < filesToRead.length; i += batchSize) {
    const batch = filesToRead.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const content = await readFileWithTimeout(
          sandbox,
          filePath,
          FILE_READ_TIMEOUT_MS,
        );
        return { filePath, content };
      }),
    );

    for (const { filePath, content } of batchResults) {
      if (content !== null) {
        allFilesMap[filePath] = content;
      }
    }

    console.log(
      `[DEBUG] Processed ${Math.min(i + batchSize, filesToRead.length)}/${filesToRead.length} files`,
    );
  }

  return allFilesMap;
};

const createCodeAgentTools = (sandboxId: string) => [
  createTool({
    name: "terminal",
    description: "Use the terminal to run commands",
    parameters: z.object({
      command: z.string(),
    }),
    handler: async ({ command }: { command: string }) => {
      const buffers: { stdout: string; stderr: string } = {
        stdout: "",
        stderr: "",
      };

      try {
        const sandbox = await getSandbox(sandboxId);
        const result = await sandbox.commands.run(command, {
          onStdout: (data: string) => {
            buffers.stdout += data;
          },
          onStderr: (data: string) => {
            buffers.stderr += data;
          },
        });
        return result.stdout;
      } catch (e) {
        console.error(
          `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
        );
        return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
      }
    },
  }),
  createTool({
    name: "createOrUpdateFiles",
    description: "Create or update files in the sandbox",
    parameters: z.object({
      files: z.array(
        z.object({
          path: z.string(),
          content: z.string(),
        }),
      ),
    }),
    handler: async ({ files }, { network }: Tool.Options<AgentState>) => {
      try {
        const updatedFiles = {
          ...(network?.state?.data?.files ?? {}),
        };
        const sandbox = await getSandbox(sandboxId);
        for (const file of files) {
          await sandbox.files.write(file.path, file.content);
          updatedFiles[file.path] = file.content;
        }

        if (network) {
          network.state.data.files = updatedFiles;
        }

        return updatedFiles;
      } catch (e) {
        return "Error: " + e;
      }
    },
  }),
  createTool({
    name: "readFiles",
    description: "Read files from the sandbox",
    parameters: z.object({
      files: z.array(z.string()),
    }),
    handler: async ({ files }) => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const contents = [];
        for (const file of files) {
          const content = await sandbox.files.read(file);
          contents.push({ path: file, content });
        }
        return JSON.stringify(contents);
      } catch (e) {
        return "Error: " + e;
      }
    },
  }),
];

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    if (!step || typeof step.run !== "function") {
      throw new Error(
        "Inngest step tools are unavailable. Ensure async context is enabled and this route uses the nodejs runtime.",
      );
    }

    const projectId = event.data.projectId as Id<"projects">;

    const project = await step.run("get-project", async () => {
      return await convex.query(api.projects.getForSystem, {
        projectId,
      });
    });

    if (!project) {
      const missingProjectId = String(event.data.projectId ?? "unknown");
      console.error("[ERROR] Project not found for code-agent run:", missingProjectId);
      throw new Error(
        `Project not found. Unable to run code agent for project ${missingProjectId}.`,
      );
    }

    const selectedFramework: Framework =
      (project.framework?.toLowerCase() as Framework) || "nextjs";

    const requestedModel: ModelId =
      (event.data.model as ModelId) || project.modelPreference || "auto";
    const validatedModel: ModelId =
      requestedModel !== "auto" && !(requestedModel in MODEL_CONFIGS)
        ? "auto"
        : requestedModel;

    const selectedModel: keyof typeof MODEL_CONFIGS =
      validatedModel === "auto"
        ? selectModelForTask(event.data.value ?? "", selectedFramework)
        : (validatedModel as keyof typeof MODEL_CONFIGS);

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const template = getE2BTemplate(selectedFramework);
      const sandbox = await createSandboxWithRetry(template, 3);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    await step.run("create-sandbox-session", async () => {
      try {
        await convex.mutation(api.sandboxSessions.create, {
          sandboxId,
          projectId,
          userId: project.userId,
          framework: frameworkToConvexEnum(selectedFramework),
          autoPauseTimeout: 10 * 60 * 1000,
        });
      } catch (error) {
        console.error("[ERROR] Failed to create sandbox session:", error);
      }
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formatted: Message[] = [];
        try {
          const messages = await convex.query(api.messages.listForUser, {
            userId: project.userId,
            projectId,
          });

          const recent = messages.slice(-5);
          for (const message of recent) {
            formatted.push({
              type: "text",
              role: message.role === "ASSISTANT" ? "assistant" : "user",
              content: message.content,
            });

            if (
              Array.isArray(message.Attachment) &&
              message.Attachment.length > 0
            ) {
              const imageAttachments = message.Attachment.filter(
                (att) => att.type === "IMAGE",
              );
              if (imageAttachments.length > 0) {
                const imageUrls = imageAttachments
                  .map((att) => att.url)
                  .filter(
                    (url): url is string =>
                      typeof url === "string" && url.length > 0,
                  );
                const imageMessages = await createImageMessages(imageUrls);
                formatted.push(...imageMessages);
              }
            }
          }
        } catch (error) {
          console.error("[ERROR] Failed to fetch previous messages:", error);
        }
        return formatted;
      },
    );

    const initialState = createState<AgentState>(
      {
        summary: "",
        files: {},
        selectedFramework,
        summaryRetryCount: 0,
      },
      { messages: previousMessages },
    );

    const modelConfig = MODEL_CONFIGS[selectedModel];

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: getFrameworkPrompt(selectedFramework),
      model: getModelAdapter(selectedModel, 0.1),
      tools: createCodeAgentTools(sandboxId),
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText && network) {
            // Only save summary if it contains the task_summary tag (matching old working logic)
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: initialState,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        // Stop when we have a summary (matching old working logic)
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    const runOptions = {
      state: initialState,
      step,
    } as unknown as Parameters<typeof network.run>[1];

    const result = await network.run(event.data.value, runOptions);

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "Generates fragment titles",
      system: FRAGMENT_TITLE_PROMPT,
      model: getModelAdapter(selectedModel, modelConfig.temperature),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "Generates assistant responses",
      system: RESPONSE_PROMPT,
      model: getModelAdapter(selectedModel, modelConfig.temperature),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      result.state.data.summary || "New fragment",
    );
    const { output: responseOutput } = await responseGenerator.run(
      result.state.data.summary || "Code generation completed",
    );

    const files = result.state.data.files || {};
    const hasFiles = Object.keys(files).length > 0;
    const summaryText = result.state.data.summary || "";

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const host = sandbox.getHost
          ? sandbox.getHost(getFrameworkPort(selectedFramework))
          : undefined;
        if (host) {
          return `https://${host}`;
        }
      } catch (error) {
        console.error("[ERROR] Failed to get sandbox URL:", error);
      }
      return "";
    });

    const isError = !summaryText || !hasFiles;

    await step.run("save-result", async () => {
      try {
        const content = isError
          ? "Something went wrong. Please try again."
          : parseAgentOutput(responseOutput);
        const messageId = (await convex.mutation(api.messages.createForUser, {
          userId: project.userId,
          projectId,
          content,
          role: "ASSISTANT",
          type: isError ? "ERROR" : "RESULT",
          status: "COMPLETE",
        })) as Id<"messages">;

        if (!isError) {
          await convex.mutation(api.messages.createFragmentForUser, {
            userId: project.userId,
            messageId,
            sandboxId,
            sandboxUrl,
            title: parseAgentOutput(fragmentTitleOutput),
            files: filterAIGeneratedFiles(files),
            metadata: {},
            framework: frameworkToConvexEnum(selectedFramework),
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to save result:", error);
      }
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files,
      summary: summaryText,
      selectedModel,
      selectedFramework,
    };
  },
);

export const sandboxTransferFunction = inngest.createFunction(
  { id: "sandbox-transfer" },
  { event: "sandbox-transfer/run" },
  async ({ event, step }) => {
    console.log("[DEBUG] Starting sandbox resume function");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));

    const fragment = await step.run("get-fragment", async () => {
      return await convex.query(api.messages.getFragmentById, {
        fragmentId: event.data.fragmentId as Id<"fragments">,
      });
    });

    if (!fragment) {
      throw new Error("Fragment not found");
    }

    if (!fragment.sandboxId) {
      throw new Error("Fragment has no sandbox");
    }

    // Get the message to extract userId
    const message = await step.run("get-message", async () => {
      const msg = await convex.query(api.messages.get, {
        messageId: fragment.messageId as Id<"messages">,
      });
      if (!msg) {
        throw new Error("Message not found");
      }
      return msg;
    });

    // Get the project to verify userId
    const project = await step.run("get-project", async () => {
      const proj = await convex.query(api.projects.getForSystem, {
        projectId: message.projectId as Id<"projects">,
      });
      if (!proj) {
        throw new Error("Project not found");
      }
      return proj;
    });

    const sandboxId = fragment.sandboxId;
    const framework = (fragment.framework?.toLowerCase() ||
      "nextjs") as Framework;

    await step.run("resume-sandbox", async () => {
      try {
        console.log("[DEBUG] Connecting to sandbox to resume:", sandboxId);
        const connection = await getSandbox(sandboxId);
        console.log("[DEBUG] Sandbox resumed successfully");
        return connection;
      } catch (error) {
        console.error("[ERROR] Failed to resume sandbox:", error);
        throw new Error("Sandbox resume failed. Please trigger a new build.");
      }
    });

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      // Ensure the dev server is running before returning the URL
      let sandboxInstance: Sandbox | null = null;
      try {
        sandboxInstance = await getSandbox(sandboxId);
        await ensureDevServerRunning(sandboxInstance, framework);
        console.log("[DEBUG] Dev server confirmed running for resumed sandbox");
      } catch (error) {
        console.warn(
          "[WARN] Failed to ensure dev server is running on resumed sandbox:",
          error,
        );
        // Continue anyway - might still work
      }

      // Prefer E2B SDK helper when available so we follow their host format
      try {
        const port = getFrameworkPort(framework);
        const sandboxWithHost = sandboxInstance as SandboxWithHost | null;
        const maybeHost =
          sandboxWithHost && typeof sandboxWithHost.getHost === "function"
            ? sandboxWithHost.getHost?.(port)
            : undefined;

        if (
          maybeHost &&
          typeof maybeHost === "string" &&
          maybeHost.length > 0
        ) {
          const host = maybeHost.startsWith("http")
            ? maybeHost
            : `https://${maybeHost}`;
          return host;
        }
      } catch (hostError) {
        console.warn(
          "[WARN] Failed to resolve resumed sandbox host via E2B SDK, using fallback URL:",
          hostError,
        );
      }

      // Fallback to legacy pattern if getHost is unavailable
      console.warn(
        "[WARN] E2B sandbox getHost() not available for resumed sandbox; using fallback https://${sandboxId}.sandbox.e2b.dev",
      );
      return `https://${sandboxId}.sandbox.e2b.dev`;
    });

    await step.run("update-fragment", async () => {
      // Use createFragmentForUser which will update if it already exists
      return await convex.mutation(api.messages.createFragmentForUser, {
        userId: project.userId,
        messageId: fragment.messageId,
        sandboxId: fragment.sandboxId || undefined,
        sandboxUrl: sandboxUrl,
        title: fragment.title,
        files: fragment.files,
        framework: frameworkToConvexEnum(framework),
        metadata: fragment.metadata,
      });
    });

    console.log("[DEBUG] Sandbox resume complete. URL:", sandboxUrl);

    return {
      sandboxId,
      sandboxUrl,
    };
  },
);

export const errorFixFunction = inngest.createFunction(
  { id: "error-fix" },
  { event: "error-fix/run" },
  async ({ event, step }) => {
    console.log("[DEBUG] Starting error-fix function (no credit charge)");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));

    const fragment = await step.run("get-fragment", async () => {
      return await convex.query(api.messages.getFragmentById, {
        fragmentId: event.data.fragmentId as Id<"fragments">,
      });
    });

    if (!fragment) {
      throw new Error("Fragment not found");
    }

    if (!fragment.sandboxId) {
      throw new Error("Fragment has no active sandbox");
    }

    // Get the message to extract userId
    const message = await step.run("get-message", async () => {
      const msg = await convex.query(api.messages.get, {
        messageId: fragment.messageId as Id<"messages">,
      });
      if (!msg) {
        throw new Error("Message not found");
      }
      return msg;
    });

    // Get the project to verify userId
    const project = await step.run("get-project", async () => {
      const proj = await convex.query(api.projects.getForSystem, {
        projectId: message.projectId as Id<"projects">,
      });
      if (!proj) {
        throw new Error("Project not found");
      }
      return proj;
    });

    const fragmentFramework = (fragment.framework?.toLowerCase() ||
      "nextjs") as Framework;
    const sandboxId = fragment.sandboxId;

    await step.run("validate-sandbox", async () => {
      try {
        await getSandbox(sandboxId);
      } catch (error) {
        console.error("[ERROR] Sandbox validation failed:", error);
        throw new Error(
          "Sandbox is no longer active. Please refresh the fragment.",
        );
      }
    });

    const toJsonObject = (value: unknown): Record<string, unknown> => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
      }

      return { ...(value as Record<string, unknown>) };
    };

    const fragmentRecord = fragment as Record<string, unknown>;
    const supportsMetadata = Object.prototype.hasOwnProperty.call(
      fragmentRecord,
      "metadata",
    );
    const initialMetadata: FragmentMetadata = supportsMetadata
      ? toJsonObject(fragmentRecord.metadata)
      : {};

    // Extract model from fragment metadata, fall back to default
    const fragmentModel =
      (initialMetadata.model as keyof typeof MODEL_CONFIGS) ||
      "anthropic/claude-haiku-4.5";
    console.log("[DEBUG] Using model from original fragment:", fragmentModel);

    const fragmentFiles = (fragment.files || {}) as Record<string, string>;
    const originalFiles = { ...fragmentFiles };

    console.log("[DEBUG] Running error detection on sandbox:", sandboxId);

    // Run validation checks to detect errors
    const [lintErrors, buildErrors] = await Promise.all([
      step.run("error-fix-lint-check", async () => {
        return await runLintCheck(sandboxId);
      }),
      step.run("error-fix-build-check", async () => {
        return await runBuildCheck(sandboxId);
      }),
    ]);

    const validationErrors = [lintErrors, buildErrors]
      .filter(Boolean)
      .join("\n\n");

    if (!validationErrors) {
      console.log("[DEBUG] No errors detected in fragment");
      return {
        success: true,
        message: "No errors detected",
      };
    }

    console.log("[DEBUG] Errors detected, running fix agent...");

    // Create a minimal state with existing files
    const state = createState<AgentState>(
      {
        summary:
          ((fragmentRecord.metadata as Record<string, unknown>)
            ?.summary as string) ?? "",
        files: fragmentFiles,
        selectedFramework: fragmentFramework,
        summaryRetryCount: 0,
      },
      {
        messages: [],
      },
    );

    const frameworkPrompt = getFrameworkPrompt(fragmentFramework);
    const errorFixModelConfig = MODEL_CONFIGS[fragmentModel];
    console.log(
      "[DEBUG] Creating error-fix agent with model:",
      fragmentModel,
      "config:",
      errorFixModelConfig,
    );

    const codeAgent = createAgent<AgentState>({
      name: `${fragmentFramework}-error-fix-agent`,
      description: `An expert ${fragmentFramework} coding agent for fixing errors powered by ${errorFixModelConfig.name}`,
      system: frameworkPrompt,
      model: openai({
        model: fragmentModel,
        apiKey: process.env.AI_GATEWAY_API_KEY!,
        baseUrl:
          process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
        defaultParameters: {
          temperature: errorFixModelConfig.temperature,
        },
      }),
      tools: createCodeAgentTools(sandboxId),
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText && network) {
            const containsSummaryTag =
              lastAssistantMessageText.includes("<task_summary>");
            console.log(
              `[DEBUG] Error-fix agent response received (contains summary tag: ${containsSummaryTag})`,
            );
            if (containsSummaryTag) {
              network.state.data.summary = extractSummaryText(
                lastAssistantMessageText,
              );
              network.state.data.summaryRetryCount = 0;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "error-fix-network",
      agents: [codeAgent],
      maxIter: 10,
      defaultState: state,
      router: async ({ network }) => {
        const summaryText = extractSummaryText(
          network.state.data.summary ?? "",
        );
        const fileEntries = network.state.data.files ?? {};
        const fileCount = Object.keys(fileEntries).length;

        if (summaryText.length > 0) {
          return;
        }

        if (fileCount === 0) {
          network.state.data.summaryRetryCount = 0;
          return codeAgent;
        }

        const currentRetry = network.state.data.summaryRetryCount ?? 0;
        if (currentRetry >= 3) {
          console.warn(
            "[WARN] Error-fix agent missing <task_summary> after multiple retries; proceeding with collected fixes.",
          );
          return;
        }

        const nextRetry = currentRetry + 1;
        network.state.data.summaryRetryCount = nextRetry;
        console.log(
          `[DEBUG] Error-fix agent missing <task_summary>; retrying (attempt ${nextRetry}).`,
        );

        return codeAgent;
      },
    });

    const fixPrompt = `CRITICAL ERROR FIX REQUEST

The following errors were detected in the application and need to be fixed immediately:

${validationErrors}

REQUIRED ACTIONS:
1. Carefully analyze the error messages to identify the root cause
2. Check for common issues:
   - Missing imports or incorrect import paths
   - TypeScript type errors or incorrect type usage
   - Syntax errors or typos in the code
   - Missing package installations
   - Configuration issues
3. Apply the necessary fixes to resolve ALL errors completely
4. Verify the fixes by ensuring the code is syntactically correct
5. Provide a <task_summary> explaining what was fixed

DO NOT proceed until all errors are completely resolved. Focus on fixing the root cause, not just masking symptoms.`;

    try {
      let result = await step.run("retry-with-error-fix", async () => {
        return await network.run(fixPrompt, { state });
      });

      // Post-network fallback: If no summary but files were modified, make one more explicit request
      let summaryText = extractSummaryText(result.state.data.summary ?? "");
      const hasModifiedFiles =
        Object.keys(result.state.data.files || {}).length > 0;

      if (!summaryText && hasModifiedFiles) {
        console.log(
          "[DEBUG] No summary detected after error-fix, requesting explicitly...",
        );
        result = await step.run("retry-error-fix-summary-request", async () => {
          return await network.run(
            "IMPORTANT: You have successfully fixed the errors, but you forgot to provide the <task_summary> tag. Please provide it now with a brief description of what errors you fixed. This is required to complete the task.",
            { state: result.state },
          );
        });

        // Re-extract summary after explicit request
        summaryText = extractSummaryText(result.state.data.summary ?? "");

        if (summaryText) {
          console.log(
            "[DEBUG] Summary successfully extracted after explicit request",
          );
        } else {
          console.warn(
            "[WARN] Summary still missing after explicit request, will use fallback",
          );
        }
      }

      // Re-run validation checks to verify if errors are actually fixed
      console.log("[DEBUG] Re-running validation checks after error fix...");
      const [newLintErrors, newBuildErrors] = await Promise.all([
        step.run("error-fix-verification-lint-check", async () => {
          return await runLintCheck(sandboxId);
        }),
        step.run("error-fix-verification-build-check", async () => {
          return await runBuildCheck(sandboxId);
        }),
      ]);

      const remainingErrors = [newLintErrors, newBuildErrors]
        .filter(Boolean)
        .join("\n\n");

      if (remainingErrors) {
        console.warn(
          "[WARN] Some errors remain after fix attempt:",
          remainingErrors,
        );
      } else {
        console.log("[DEBUG] All errors resolved!");
      }

      // Ensure all fixed files are written back to the sandbox
      await step.run("sync-fixed-files-to-sandbox", async () => {
        const fixedFiles = result.state.data.files || {};
        const sandbox = await getSandbox(sandboxId);

        console.log(
          "[DEBUG] Writing fixed files back to sandbox:",
          Object.keys(fixedFiles).length,
        );

        for (const [path, content] of Object.entries(fixedFiles)) {
          try {
            await sandbox.files.write(path, content);
          } catch (error) {
            console.error(
              `[ERROR] Failed to write file ${path} to sandbox:`,
              error,
            );
          }
        }

        console.log("[DEBUG] All fixed files synced to sandbox");
      });

      const backupMetadata = await step.run(
        "backup-original-files",
        async (): Promise<FragmentMetadata | null> => {
          if (!supportsMetadata) {
            console.warn(
              "[WARN] Fragment metadata field not available; skipping backup snapshot",
            );
            return null;
          }

          console.log(
            "[DEBUG] Backing up original files before applying fixes",
          );
          const metadata: FragmentMetadata = {
            ...initialMetadata,
            previousFiles: sanitizeJsonForDatabase(originalFiles),
            fixedAt: new Date().toISOString(),
          };

          await convex.mutation(api.messages.createFragmentForUser, {
            userId: project.userId,
            messageId: fragment.messageId,
            sandboxId: fragment.sandboxId || undefined,
            sandboxUrl: fragment.sandboxUrl,
            title: fragment.title,
            files: fragment.files,
            framework: frameworkToConvexEnum(fragmentFramework),
            metadata,
          });

          return metadata;
        },
      );

      await step.run("update-fragment-files", async () => {
        const baseMetadata: FragmentMetadata =
          backupMetadata ?? initialMetadata;
        const metadataUpdate = supportsMetadata
          ? {
            ...baseMetadata,
            previousFiles: originalFiles,
            fixedAt: new Date().toISOString(),
            lastFixSuccess: {
              summary: result.state.data.summary,
              occurredAt: new Date().toISOString(),
            },
          }
          : undefined;

        return await convex.mutation(api.messages.createFragmentForUser, {
          userId: project.userId,
          messageId: fragment.messageId,
          sandboxId: fragment.sandboxId || undefined,
          sandboxUrl: fragment.sandboxUrl,
          title: fragment.title,
          files: result.state.data.files,
          framework: frameworkToConvexEnum(fragmentFramework),
          metadata: metadataUpdate || fragment.metadata,
        });
      });

      console.log("[DEBUG] Error fix complete");

      return {
        success: true,
        message: remainingErrors
          ? "Some errors may remain. Please check the sandbox."
          : "Errors fixed successfully",
        summary: result.state.data.summary,
        remainingErrors: remainingErrors || undefined,
      };
    } catch (error) {
      console.error("[ERROR] Error fix failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const friendlyMessage = errorMessage.toLowerCase().includes("timeout")
        ? "Automatic fix timed out. Please refresh the fragment."
        : "Automatic fix failed. Please review the sandbox and try again.";

      await step.run(
        "record-error-fix-failure",
        async (): Promise<FragmentMetadata | null> => {
          if (!supportsMetadata) {
            console.warn(
              "[WARN] Fragment metadata field not available; skipping failure metadata update",
            );
            return null;
          }

          console.log(
            "[DEBUG] Recording failure details for fragment",
            event.data.fragmentId,
          );

          let latestMetadata = initialMetadata;
          try {
            const latestFragment = await convex.query(
              api.messages.getFragmentById,
              {
                fragmentId: event.data.fragmentId as Id<"fragments">,
              },
            );

            if (latestFragment) {
              latestMetadata = toJsonObject(latestFragment.metadata);
            }
          } catch (metadataReadError) {
            console.error(
              "[ERROR] Failed to load latest metadata:",
              metadataReadError,
            );
          }

          const failureMetadata: FragmentMetadata = {
            ...latestMetadata,
            lastFixFailure: {
              message: errorMessage,
              occurredAt: new Date().toISOString(),
              friendlyMessage,
            },
          };

          try {
            await convex.mutation(api.messages.createFragmentForUser, {
              userId: project.userId,
              messageId: fragment.messageId,
              sandboxId: fragment.sandboxId || undefined,
              sandboxUrl: fragment.sandboxUrl,
              title: fragment.title,
              files: fragment.files,
              framework: frameworkToConvexEnum(fragmentFramework),
              metadata: failureMetadata,
            });
          } catch (metadataError) {
            console.error(
              "[ERROR] Failed to persist failure metadata:",
              metadataError,
            );
          }

          return failureMetadata;
        },
      );

      return {
        success: false,
        message: friendlyMessage,
        error: errorMessage,
      };
    }
  },
);

// Helper function to extract spec content from agent response
const extractSpecContent = (output: Message[]): string => {
  const textContent = output
    .filter((msg) => msg.type === "text")
    .map((msg) => {
      if (typeof msg.content === "string") {
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n");
      }
      return "";
    })
    .join("\n");

  // Extract content between <spec>...</spec> tags
  const specMatch = /<spec>([\s\S]*?)<\/spec>/i.exec(textContent);
  if (specMatch && specMatch[1]) {
    return specMatch[1].trim();
  }

  // If no tags found, return the entire response
  return textContent.trim();
};

// Spec Planning Agent Function
export const specPlanningAgentFunction = inngest.createFunction(
  { id: "spec-planning-agent" },
  { event: "spec-agent/run" },
  async ({ event, step }) => {
    console.log("[DEBUG] Starting spec-planning-agent function");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));

    // Get project details
    const project = await step.run("get-project", async () => {
      return await convex.query(api.projects.getForSystem, {
        projectId: event.data.projectId as Id<"projects">,
      });
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Get the message that triggered this spec generation
    const messageId = event.data.messageId as Id<"messages">;

    // Update message to PLANNING status
    await step.run("update-planning-status", async () => {
      await convex.mutation(api.specs.updateSpec, {
        messageId,
        specContent: "",
        status: "PLANNING",
      });
    });

    // Determine framework (use existing or detect)
    let selectedFramework: Framework =
      (project?.framework?.toLowerCase() as Framework) || "nextjs";

    if (!project?.framework) {
      console.log("[DEBUG] No framework set, running framework selector...");

      const frameworkSelectorAgent = createAgent({
        name: "framework-selector",
        description: "Determines the best framework for the user's request",
        system: FRAMEWORK_SELECTOR_PROMPT,
        model: getModelAdapter("google/gemini-2.5-flash-lite", 0.3),
      });

      const frameworkResult = await frameworkSelectorAgent.run(
        event.data.value,
      );
      const frameworkOutput = frameworkResult.output[0];

      if (frameworkOutput.type === "text") {
        const detectedFramework = (
          typeof frameworkOutput.content === "string"
            ? frameworkOutput.content
            : frameworkOutput.content.map((c) => c.text).join("")
        )
          .trim()
          .toLowerCase();

        if (
          ["nextjs", "angular", "react", "vue", "svelte"].includes(
            detectedFramework,
          )
        ) {
          selectedFramework = detectedFramework as Framework;
        }
      }

      // Update project with selected framework
      await step.run("update-project-framework", async () => {
        return await convex.mutation(api.projects.updateForUser, {
          userId: project.userId,
          projectId: event.data.projectId as Id<"projects">,
          framework: frameworkToConvexEnum(selectedFramework),
        });
      });
    }

    console.log("[DEBUG] Selected framework for spec:", selectedFramework);

    // Get framework-specific context
    const frameworkPrompt = getFrameworkPrompt(selectedFramework);

    // Create enhanced prompt that includes framework context
    const enhancedSpecPrompt = `${SPEC_MODE_PROMPT}

## Framework Context
You are creating a specification for a ${selectedFramework.toUpperCase()} application.

${frameworkPrompt}

Remember to wrap your complete specification in <spec>...</spec> tags.`;

    // Create planning agent with GPT-5.1 Codex
    const planningAgent = createAgent({
      name: "spec-planning-agent",
      description: "Creates detailed implementation specifications",
      system: enhancedSpecPrompt,
      model: getModelAdapter("openai/gpt-5.1-codex", 0.7),
    });

    console.log("[DEBUG] Running planning agent with user request");

    // Get previous messages for context
    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        try {
          const allMessages = await convex.query(api.messages.listForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
          });

          // Take last 3 messages for context (excluding current one)
          const messages = allMessages.slice(-4, -1);

          const formattedMessages: Message[] = messages.map((msg) => ({
            type: "text",
            role: msg.role === "ASSISTANT" ? "assistant" : "user",
            content: msg.content,
          }));

          return formattedMessages;
        } catch (error) {
          console.error("[ERROR] Failed to fetch previous messages:", error);
          return [];
        }
      },
    );

    // Run the planning agent
    const result = await step.run("generate-spec", async () => {
      const state = createState<AgentState>(
        {
          summary: "",
          files: {},
          selectedFramework,
          summaryRetryCount: 0,
        },
        {
          messages: previousMessages,
        },
      );

      const planResult = await planningAgent.run(event.data.value, {
        state,
      });
      return planResult;
    });

    // Extract spec content from response
    const specContent = extractSpecContent(result.output);

    console.log("[DEBUG] Spec generated, length:", specContent.length);

    // Save spec to database with AWAITING_APPROVAL status
    await step.run("save-spec", async () => {
      await convex.mutation(api.specs.updateSpec, {
        messageId,
        specContent,
        status: "AWAITING_APPROVAL",
      });
    });

    console.log("[DEBUG] Spec saved, awaiting user approval");

    return {
      success: true,
      specContent,
      framework: selectedFramework,
    };
  },
);

export const sandboxCleanupFunction = inngest.createFunction(
  { id: "sandbox-cleanup" },
  {
    cron: "0 0 * * *", // Every day at midnight UTC
  },
  async ({ step }) => {
    console.log("[DEBUG] Running sandbox cleanup job");

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - thirtyDays;
    const killedSandboxIds: string[] = [];

    await step.run("cleanup-paused-sandboxes", async () => {
      const sandboxes = await Sandbox.list();

      for (const sandbox of sandboxes) {
        const startedAt =
          sandbox.startedAt instanceof Date
            ? sandbox.startedAt.getTime()
            : new Date(sandbox.startedAt).getTime();

        if (
          sandbox.state === "paused" &&
          Number.isFinite(startedAt) &&
          startedAt <= cutoff
        ) {
          try {
            await Sandbox.kill(sandbox.sandboxId);
            killedSandboxIds.push(sandbox.sandboxId);
            console.log(
              "[DEBUG] Killed sandbox due to age:",
              sandbox.sandboxId,
            );
          } catch (error) {
            console.error(
              "[ERROR] Failed to kill sandbox",
              sandbox.sandboxId,
              error,
            );
          }
        }
      }
    });

    console.log("[DEBUG] Sandbox cleanup complete. Killed:", killedSandboxIds);

    return {
      killedSandboxIds,
    };
  },
);

// Export auto-pause function
export { autoPauseSandboxes } from "./functions/auto-pause";
//