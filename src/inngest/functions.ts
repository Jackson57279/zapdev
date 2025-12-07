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
  getStepTools,
  type NetworkRun,
  type AgentResult,
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
import { crawlUrl, type CrawledContent } from "@/lib/firecrawl";
import { sanitizeTextForDatabase, sanitizeJsonForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { inngest } from "./client";
import { type Framework, type AgentState } from "./types";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  parseAgentOutput,
  createSandboxWithRetry,
  validateSandboxHealth,
  ensureDevServerRunning,
} from "./utils";
import { e2bCircuitBreaker } from "./circuit-breaker";

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

const AUTO_FIX_MAX_ATTEMPTS = 2;

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

const usesShadcnComponents = (files: Record<string, string>) => {
  return Object.entries(files).some(([path, content]) => {
    if (!path.endsWith(".tsx")) {
      return false;
    }
    return content.includes("@/components/ui/");
  });
};

const shouldTriggerAutoFix = (message?: string): boolean => {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const URL_REGEX = /(https?:\/\/[^\s\]\)"'<>]+)/gi;

const extractUrls = (value: string) => {
  const matches = value.matchAll(URL_REGEX);
  const urls = new Set<string>();

  for (const match of matches) {
    try {
      const parsed = new URL(match[0]);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        urls.add(parsed.toString());
      }
    } catch {
      // skip invalid URLs
    }
  }

  return Array.from(urls);
};

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

const getLastAssistantMessage = (
  networkRun: NetworkRun<AgentState>,
): string | undefined => {
  const results = networkRun.state.results;

  if (results.length === 0) {
    return undefined;
  }

  const latestResult = results[results.length - 1];

  return lastAssistantTextMessageContent(latestResult);
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
const MAX_SCREENSHOTS = 20;
const FILE_READ_TIMEOUT_MS = 3000; // Reduced from 5000 to 3000ms for faster failure detection
const BUILD_TIMEOUT_MS = 120000; // 2 minutes for build operations (increased from 60s)
const INNGEST_STEP_OUTPUT_SIZE_LIMIT = 1024 * 1024;
const FILES_PER_STEP_BATCH = 50;

const ALLOWED_WORKSPACE_PATHS = ["/home/user", "."];
type SandboxWithHost = Sandbox & {
  getHost?: (port: number) => string | undefined;
};

const escapeShellPattern = (pattern: string): string => {
  return pattern.replace(/'/g, "'\"'\"'");
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

const getFindCommand = (framework: Framework): string => {
  const baseIgnorePatterns = [
    "*/node_modules/*",
    "*/.git/*",
    "*/dist/*",
    "*/build/*",
  ];

  const frameworkSpecificIgnores: Record<Framework, string[]> = {
    nextjs: ["*/.next/*"],
    angular: ["*/.angular/*"],
    react: [],
    vue: [],
    svelte: ["*/.svelte-kit/*"],
  };

  const ignorePatterns = [
    ...baseIgnorePatterns,
    ...(frameworkSpecificIgnores[framework] || []),
  ];
  const escapedPatterns = ignorePatterns.map(
    (pattern) => `-not -path '${escapeShellPattern(pattern)}'`,
  );
  const ignoreFlags = escapedPatterns.join(" ");

  return `find /home/user -type f ${ignoreFlags} 2>/dev/null || find . -type f ${ignoreFlags} 2>/dev/null`;
};

const isValidScreenshotUrl = (url: string): boolean => {
  if (!url || typeof url !== "string" || url.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return url.startsWith("data:image/");
  }
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

const calculateFilesMapSize = (filesMap: Record<string, string>): number => {
  let totalSize = 0;
  for (const [path, content] of Object.entries(filesMap)) {
    totalSize += path.length + content.length;
  }
  return totalSize;
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

const CRITICAL_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
];

const validateMergeStrategy = (
  agentFiles: Record<string, string>,
  sandboxFiles: Record<string, string>,
): { warnings: string[]; isValid: boolean } => {
  const warnings: string[] = [];

  const agentFilePaths = new Set(Object.keys(agentFiles));
  const sandboxFilePaths = new Set(Object.keys(sandboxFiles));

  const overwrittenCriticalFiles = CRITICAL_FILES.filter(
    (file) =>
      sandboxFilePaths.has(file) &&
      agentFilePaths.has(file) &&
      agentFiles[file] !== sandboxFiles[file],
  );

  if (overwrittenCriticalFiles.length > 0) {
    warnings.push(
      `Critical files were overwritten by agent: ${overwrittenCriticalFiles.join(", ")}`,
    );
  }

  const missingCriticalFiles = CRITICAL_FILES.filter(
    (file) => sandboxFilePaths.has(file) && !agentFilePaths.has(file),
  );

  if (missingCriticalFiles.length > 0) {
    warnings.push(
      `Critical files from sandbox not in agent files (will be preserved): ${missingCriticalFiles.join(", ")}`,
    );
  }

  const agentFileCount = agentFilePaths.size;
  const sandboxFileCount = sandboxFilePaths.size;

  if (agentFileCount > 0 && sandboxFileCount > agentFileCount * 10) {
    warnings.push(
      `Large discrepancy: sandbox has ${sandboxFileCount} files but agent only tracked ${agentFileCount} files`,
    );
  }

  return {
    warnings,
    isValid:
      warnings.length === 0 ||
      warnings.every((w) => !w.includes("discrepancy")),
  };
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

    console.log("[DEBUG] Starting code-agent function");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));
    console.log("[DEBUG] E2B_API_KEY present:", !!process.env.E2B_API_KEY);
    console.log(
      "[DEBUG] AI_GATEWAY_API_KEY present:",
      !!process.env.AI_GATEWAY_API_KEY,
    );

    // Get project to check if framework is already set
    const project = await step.run("get-project", async () => {
      return await convex.query(api.projects.getForSystem, {
        projectId: event.data.projectId as Id<"projects">,
      });
    });

    if (!project) {
      const missingProjectId = String(event.data.projectId ?? "unknown");
      console.error(
        "[ERROR] Project not found for code-agent run:",
        missingProjectId,
      );
      throw new Error(
        `Project not found. Unable to run code agent for project ${missingProjectId}.`,
      );
    }

    let selectedFramework: Framework =
      (project?.framework?.toLowerCase() as Framework) || "nextjs";

    // If project doesn't have a framework set, use framework selector
    if (!project?.framework) {
      console.log("[DEBUG] No framework set, running framework selector...");

      try {
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

          console.log("[DEBUG] Framework selector output:", detectedFramework);

          if (
            ["nextjs", "angular", "react", "vue", "svelte"].includes(
              detectedFramework,
            )
          ) {
            selectedFramework = detectedFramework as Framework;
          }
        }

        console.log("[DEBUG] Selected framework:", selectedFramework);

        // Update project with selected framework
        await step.run("update-project-framework", async () => {
          return await convex.mutation(api.projects.updateForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
            framework: frameworkToConvexEnum(selectedFramework),
          });
        });
      } catch (frameworkError) {
        const errorMessage =
          frameworkError instanceof Error
            ? frameworkError.message
            : String(frameworkError);
        console.error("[ERROR] Framework selection failed:", errorMessage);
        console.warn(
          "[WARN] Falling back to default framework (Next.js) due to framework selector error",
        );
        selectedFramework = "nextjs";
      }
    } else {
      console.log("[DEBUG] Using existing framework:", selectedFramework);
    }

    // Run mode configuration: "fast" (default) or "safe" (full validation)
    type RunMode = "fast" | "safe";

    const requestedMode = (event.data.mode as RunMode | undefined) ?? "fast";
    const mode: RunMode = requestedMode === "safe" ? "safe" : "fast";
    console.log("[DEBUG] Code agent run mode:", mode);

    // Model selection logic
    const requestedModel =
      (event.data.model as ModelId) || project?.modelPreference || "auto";
    console.log("[DEBUG] Requested model:", requestedModel);

    // Validate that the requested model exists in MODEL_CONFIGS
    let validatedModel: ModelId = requestedModel;
    if (requestedModel !== "auto" && !(requestedModel in MODEL_CONFIGS)) {
      console.warn(
        `[WARN] Invalid model requested: "${requestedModel}". Falling back to "auto".`,
      );
      validatedModel = "auto";
    }

    // Enforce Pro restriction for Gemini model - REMOVED TEMPORARILY
    // if (validatedModel === "google/gemini-3-pro-preview" && usage?.planType !== "pro") {
    //   console.warn(
    //     `[WARN] Pro model requested by non-pro user. Falling back to "auto".`,
    //   );
    //   validatedModel = "auto";
    // }

    const selectedModel: keyof typeof MODEL_CONFIGS =
      validatedModel === "auto"
        ? selectModelForTask(event.data.value, selectedFramework)
        : (validatedModel as keyof typeof MODEL_CONFIGS);

    // Enforce Pro plan for Gemini 3 Pro - REMOVED TEMPORARILY
    // if (selectedModel === "google/gemini-3-pro-preview") {
    //   const usage = await step.run("check-user-plan", async () => {
    //     return await convex.query(api.usage.getUsageForUser, {
    //       userId: project.userId,
    //     });
    //   });

    //   if (usage.planType !== "pro") {
    //     console.warn(
    //       `[WARN] User ${project.userId} is not Pro but selected Gemini. Falling back to Haiku.`,
    //     );
    //     selectedModel = "anthropic/claude-haiku-4.5";
    //   }
    // }

    console.log("[DEBUG] Selected model:", selectedModel);
    console.log("[DEBUG] Model config:", MODEL_CONFIGS[selectedModel]);

    const sandboxId = await step.run("get-sandbox-id", async () => {
      console.log(
        "[DEBUG] Creating E2B sandbox for framework:",
        selectedFramework,
      );
      console.log("[E2B_METRICS]", {
        event: "sandbox_create_start",
        framework: selectedFramework,
        template: getE2BTemplate(selectedFramework),
        circuitBreakerState: e2bCircuitBreaker.getState(),
        timestamp: Date.now(),
      });

      // Check rate limit before attempting creation
      try {
        const rateLimitStatus = await convex.query(
          api.e2bRateLimits.checkRateLimit,
          {
            operation: "sandbox_create",
            maxPerHour: 100, // Adjust based on your E2B plan
          },
        );

        if (rateLimitStatus.exceeded) {
          console.error("[E2B_METRICS]", {
            event: "rate_limit_exceeded",
            count: rateLimitStatus.count,
            limit: rateLimitStatus.limit,
            timestamp: Date.now(),
          });
          throw new Error(
            `E2B rate limit exceeded: ${rateLimitStatus.count}/${rateLimitStatus.limit} requests in last hour`,
          );
        }

        // Warn at 80% usage
        if (rateLimitStatus.count >= rateLimitStatus.limit * 0.8) {
          console.warn("[E2B_METRICS]", {
            event: "rate_limit_warning",
            count: rateLimitStatus.count,
            limit: rateLimitStatus.limit,
            remaining: rateLimitStatus.remaining,
            percentUsed: Math.round(
              (rateLimitStatus.count / rateLimitStatus.limit) * 100,
            ),
            timestamp: Date.now(),
          });
        }
      } catch (rateLimitError) {
        console.warn("[WARN] Failed to check rate limit:", rateLimitError);
        // Don't block sandbox creation if rate limit check fails
      }

      const template = getE2BTemplate(selectedFramework);

      try {
        // Check if circuit breaker is open - queue the request instead
        if (e2bCircuitBreaker.getState() === "OPEN") {
          console.warn("[E2B_METRICS]", {
            event: "circuit_breaker_open_queue",
            framework: selectedFramework,
            timestamp: Date.now(),
          });

          // Queue the request for later processing
          const jobId = await convex.mutation(api.jobQueue.enqueue, {
            type: "code_generation",
            projectId: event.data.projectId as Id<"projects">,
            userId: project.userId,
            payload: event.data,
            priority: "normal",
          });

          // Notify user
          await convex.mutation(api.messages.createForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
            content:
              "E2B service is temporarily unavailable. Your request has been queued and will be processed automatically when the service recovers. You'll be notified when it's ready.",
            role: "ASSISTANT",
            type: "RESULT",
            status: "COMPLETE",
          });

          console.log("[E2B_METRICS]", {
            event: "request_queued",
            jobId,
            timestamp: Date.now(),
          });

          // Throw error to stop current execution (request is queued)
          throw new Error(
            "E2B service unavailable - request queued for later processing",
          );
        }

        // Use circuit breaker to prevent cascading failures
        const sandbox = await e2bCircuitBreaker.execute(async () => {
          // Try framework-specific template first
          try {
            return await createSandboxWithRetry(template, 3);
          } catch {
            // Fallback to default zapdev template if framework-specific doesn't exist
            console.log(
              "[DEBUG] Framework template not found, using default 'zapdev' template",
            );
            selectedFramework = "nextjs"; // Reset to default framework
            return await createSandboxWithRetry("zapdev", 3);
          }
        });

        console.log("[DEBUG] Sandbox created successfully:", sandbox.sandboxId);

        // Record rate limit usage
        try {
          await convex.mutation(api.e2bRateLimits.recordRequest, {
            operation: "sandbox_create",
          });
        } catch (recordError) {
          console.warn("[WARN] Failed to record rate limit:", recordError);
        }

        // Validate sandbox is healthy before proceeding
        const isHealthy = await validateSandboxHealth(sandbox);
        if (!isHealthy) {
          console.warn("[WARN] Sandbox health check failed, but continuing...");
        }

        return sandbox.sandboxId;
      } catch (error) {
        console.error("[ERROR] Failed to create E2B sandbox:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Log failure metrics
        console.error("[E2B_METRICS]", {
          event: "sandbox_create_critical_failure",
          framework: selectedFramework,
          template,
          error: errorMessage,
          circuitBreakerState: e2bCircuitBreaker.getState(),
          timestamp: Date.now(),
        });

        throw new Error(`E2B sandbox creation failed: ${errorMessage}`);
      }
    });

    // Create sandbox session in Convex to track persistence state
    await step.run("create-sandbox-session", async () => {
      try {
        console.log(
          "[DEBUG] Creating sandbox session for sandboxId:",
          sandboxId,
        );
        await convex.mutation(api.sandboxSessions.create, {
          sandboxId,
          projectId: event.data.projectId as Id<"projects">,
          userId: project.userId,
          framework: frameworkToConvexEnum(selectedFramework),
          autoPauseTimeout: 10 * 60 * 1000, // Default 10 minutes
        });
        console.log("[DEBUG] Sandbox session created successfully");
      } catch (error) {
        console.error("[ERROR] Failed to create sandbox session:", error);
        // Don't throw - continue without session tracking
      }
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        console.log(
          "[DEBUG] Fetching previous messages for project:",
          event.data.projectId,
        );
        const formattedMessages: Message[] = [];

        try {
          const allMessages = await convex.query(api.messages.listForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
          });

          // Take last 3 messages for context
          const messages = allMessages.slice(-3);

          console.log("[DEBUG] Found", messages.length, "previous messages");

          for (const message of messages) {
            // Add text message
            formattedMessages.push({
              type: "text",
              role: message.role === "ASSISTANT" ? "assistant" : "user",
              content: message.content,
            });

            // Add image attachments if present
            if (
              message.Attachment &&
              Array.isArray(message.Attachment) &&
              message.Attachment.length > 0
            ) {
              const imageAttachments = message.Attachment.filter(
                (att) => att.type === "IMAGE",
              );

              if (imageAttachments.length > 0) {
                console.log(
                  `[DEBUG] Found ${imageAttachments.length} image attachment(s) for message ${message._id}`,
                );

                const imageUrls = imageAttachments
                  .map((att) => att.url)
                  .filter(
                    (url): url is string =>
                      typeof url === "string" && url.length > 0,
                  );

                // Convert image URLs to AI-compatible image messages
                const imageMessages = await createImageMessages(imageUrls);
                formattedMessages.push(...imageMessages);

                console.log(
                  `[DEBUG] Added ${imageMessages.length} image message(s) to context`,
                );
              }
            }
          }

          return formattedMessages;
        } catch (error) {
          console.error("[ERROR] Failed to fetch previous messages:", error);
          return [];
        }
      },
    );

    await step.run("notify-screenshots", async () => {
      const urls = extractUrls(event.data.value ?? "").slice(0, 2);
      if (urls.length === 0) {
        return;
      }

      try {
        for (const url of urls) {
          const content = sanitizeTextForDatabase(
            `📸 Taking screenshot of ${url}...`,
          );
          const messageContent =
            content.length > 0 ? content : "Taking screenshot...";

          await convex.mutation(api.messages.createForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
            content: messageContent,
            role: "ASSISTANT",
            type: "RESULT",
            status: "COMPLETE",
          });
        }
      } catch (error) {
        console.error(
          "[ERROR] Failed to create screenshot notifications:",
          error,
        );
      }
    });

    const crawledContexts = await step.run("crawl-url-context", async () => {
      try {
        const urls = extractUrls(event.data.value ?? "").slice(0, 2);

        if (urls.length === 0) {
          return [] as CrawledContent[];
        }

        console.log("[DEBUG] Found URLs in input:", urls);

        const crawlWithTimeout = async (
          url: string,
        ): Promise<CrawledContent | null> => {
          try {
            return await Promise.race([
              crawlUrl(url),
              new Promise<null>((resolve) =>
                setTimeout(() => {
                  console.warn("[DEBUG] Crawl timeout for URL:", url);
                  resolve(null);
                }, 10000),
              ),
            ]);
          } catch (error) {
            console.error("[ERROR] Crawl error for URL:", url, error);
            return null;
          }
        };

        const results = await Promise.all(
          urls.map((url) => crawlWithTimeout(url)),
        );

        return results.filter(
          (crawled): crawled is CrawledContent => crawled !== null,
        );
      } catch (error) {
        console.error("[ERROR] Failed to crawl URLs", error);
        return [] as CrawledContent[];
      }
    });

    const contextMessages: Message[] = (crawledContexts ?? []).map(
      (context) => ({
        type: "text",
        role: "user",
        content: `Crawled context from ${context.url}:\n${context.content}`,
      }),
    );

    const initialMessages = [...contextMessages, ...previousMessages];

    const buildAgentState = () =>
      createState<AgentState>(
        {
          summary: "",
          files: {},
          selectedFramework,
          summaryRetryCount: 0,
        },
        {
          messages: initialMessages,
        },
      );

    type AgentStateInstance = ReturnType<typeof buildAgentState>;

    // Check if this message has an approved spec
    const currentMessage = await step.run("get-current-message", async () => {
      try {
        const allMessages = await convex.query(api.messages.listForUser, {
          userId: project.userId,
          projectId: event.data.projectId as Id<"projects">,
        });
        // Find the most recent user message (should be the one that triggered this)
        return allMessages.filter((m) => m.role === "USER").pop();
      } catch (error) {
        console.error("[ERROR] Failed to fetch current message:", error);
        return null;
      }
    });

    const hasApprovedSpec = currentMessage?.specMode === "APPROVED";
    const specContent = currentMessage?.specContent;

    let frameworkPrompt = getFrameworkPrompt(selectedFramework);

    // If there's an approved spec, enhance the prompt with it
    if (hasApprovedSpec && specContent) {
      console.log("[DEBUG] Using approved spec for code generation");
      frameworkPrompt = `${frameworkPrompt}

## IMPORTANT: Implementation Specification

The user has approved the following detailed implementation specification. Follow it closely:

${specContent}

Your task is to implement this specification accurately. Refer to the spec for:
- Component structure and architecture
- Feature requirements and user interactions
- Technical approach and patterns
- Implementation steps and order

Generate code that matches the approved specification.`;
    }

    console.log("[DEBUG] Using prompt for framework:", selectedFramework);

    const modelConfig = MODEL_CONFIGS[selectedModel];
    console.log("[MODEL_SELECTION] Creating agent with:", {
      model: selectedModel,
      modelName: modelConfig.name,
      provider: modelConfig.provider,
      framework: selectedFramework,
      temperature: modelConfig.temperature,
      autoSelected: validatedModel === "auto",
    });

    const codeAgentLifecycle = {
      onResponse: async ({
        result,
        network,
      }: {
        result: AgentResult;
        network?: NetworkRun<AgentState>;
      }) => {
        const lastAssistantMessageText =
          lastAssistantTextMessageContent(result);

        if (lastAssistantMessageText && network) {
          const containsSummaryTag =
            lastAssistantMessageText.includes("<task_summary>");
          console.log(
            `[DEBUG] Agent response received (contains summary tag: ${containsSummaryTag})`,
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
    };

    const codeAgent = createAgent<AgentState>({
      name: `${selectedFramework}-code-agent`,
      description: `An expert ${selectedFramework} coding agent powered by ${modelConfig.name}`,
      system: frameworkPrompt,
      model: getModelAdapter(selectedModel, modelConfig.temperature),
      tools: createCodeAgentTools(sandboxId),
      lifecycle: codeAgentLifecycle,
    });

    const createCodeAgentNetwork = (
      agent: ReturnType<typeof createAgent<AgentState>>,
    ) =>
      createNetwork<AgentState>({
        name: "coding-agent-network",
        agents: [agent],
        maxIter: 8,
        defaultState: buildAgentState(),
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
            return agent;
          }

          const currentRetry = network.state.data.summaryRetryCount ?? 0;
          if (currentRetry >= 2) {
            console.warn(
              "[WARN] Missing <task_summary> after multiple attempts despite generated files; proceeding with fallback handling.",
            );
            return;
          }

          const nextRetry = currentRetry + 1;
          network.state.data.summaryRetryCount = nextRetry;
          console.log(
            `[DEBUG] No <task_summary> yet; retrying agent to request summary (attempt ${nextRetry}).`,
          );

          return agent;
        },
      });

    const resolveStepContext = async (stepContext?: typeof step) => {
      try {
        const contextStep = await getStepTools();
        if (contextStep?.run) {
          return { stepTools: contextStep, source: "async-context" };
        }
      } catch (contextError) {
        console.warn(
          "[WARN] Unable to read step tools from async context:",
          contextError,
        );
      }

      if (stepContext?.run) {
        return { stepTools: stepContext, source: "direct-step" };
      }

      return { stepTools: undefined, source: "missing" };
    };

    const runNetwork = async (
      stepContext: typeof step | undefined,
      _label: string,
      agent: ReturnType<typeof createAgent<AgentState>>,
      stateOverride?: AgentStateInstance,
      userInput?: string,
    ): Promise<NetworkRun<AgentState>> => {
      const network = createCodeAgentNetwork(agent);
      const stateForRun = stateOverride ?? buildAgentState();
      const inputForRun = userInput ?? event.data.value;

      const { stepTools, source } = await resolveStepContext(stepContext);

      if (stepTools?.run) {
        console.log(
          `[DEBUG] Running network via step context source: ${source}`,
        );
        return stepTools.run(_label, () =>
          network.run(inputForRun, { state: stateForRun }),
        );
      }

      console.warn(
        "[WARN] Step context unavailable; running network without step.run()",
      );
      return network.run(inputForRun, { state: stateForRun });
    };

    console.log("[DEBUG] Running network with input:", event.data.value);
    let result: NetworkRun<AgentState>;
    const activeAgent = codeAgent;
    try {
      result = await runNetwork(
        step,
        "run-code-agent-network",
        codeAgent,
        undefined,
        event.data.value,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[ERROR] Network run failed with error:", errorMessage);
      if (error instanceof Error && error.stack) {
        console.error("[ERROR] Stack trace:", error.stack);
      }
      if (errorMessage.toLowerCase().includes("step")) {
        console.error(
          "[ERROR] Inngest step context missing; ensure asyncContext is enabled and the route uses the nodejs runtime.",
        );
      }
      throw new Error(
        `Code generation failed: ${errorMessage}. Check server logs for details.`,
      );
    }

    // Post-network fallback: If no summary but files exist, make one more explicit request
    let summaryText = extractSummaryText(result.state.data.summary ?? "");
    const hasGeneratedFiles =
      Object.keys(result.state.data.files || {}).length > 0;

    if (!summaryText && hasGeneratedFiles) {
      console.log(
        "[DEBUG] No summary detected after network run, requesting explicitly...",
      );
      try {
        result = await runNetwork(
          step,
          "run-code-agent-network-summary-request",
          activeAgent,
          result.state,
          "IMPORTANT: You have successfully generated files, but you forgot to provide the <task_summary> tag. Please provide it now with a brief description of what you built. This is required to complete the task.",
        );
      } catch (summaryError) {
        const errorMessage =
          summaryError instanceof Error
            ? summaryError.message
            : String(summaryError);
        console.error("[ERROR] Failed to generate summary:", errorMessage);
        // Don't throw - continue with fallback
      }

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

    // Post-execution validation: Check if expected entry point file was modified
    const generatedFiles = result.state.data.files || {};
    const fileKeys = Object.keys(generatedFiles);

    // Define expected entry points by framework
    const entryPointsByFramework: Record<Framework, string[]> = {
      nextjs: ["app/page.tsx", "pages/index.tsx"],
      angular: ["src/app/app.component.ts", "src/app/app.component.html"],
      react: ["src/App.tsx", "src/main.tsx", "src/index.tsx"],
      vue: ["src/App.vue", "src/main.ts"],
      svelte: ["src/routes/+page.svelte", "src/App.svelte"],
    };

    const expectedEntryPoints = entryPointsByFramework[selectedFramework] || [];
    const modifiedEntryPoint = expectedEntryPoints.some((entry) =>
      fileKeys.includes(entry),
    );

    if (hasGeneratedFiles && !modifiedEntryPoint) {
      console.warn(
        `[VALIDATION_WARNING] Expected entry point file not modified for ${selectedFramework}`,
        {
          model: selectedModel,
          expectedFiles: expectedEntryPoints,
          actualFiles: fileKeys.slice(0, 10),
          userRequest: event.data.value.slice(0, 200),
        },
      );

      // Log specific warning for OpenAI models (GPT-5.1)
      if (modelConfig.provider === "openai") {
        console.error(
          "[MODEL_BEHAVIOR] OpenAI model did not edit the expected entry point file!",
          {
            model: selectedModel,
            framework: selectedFramework,
            expectedFiles: expectedEntryPoints,
            filesGenerated: fileKeys.length,
          },
        );
      }
    } else if (modifiedEntryPoint) {
      console.log(
        `[VALIDATION_SUCCESS] Entry point file correctly modified for ${selectedFramework}`,
        {
          model: selectedModel,
          modifiedFile: fileKeys.find((key) =>
            expectedEntryPoints.includes(key),
          ),
        },
      );
    }

    // Post-completion validation: Run lint and build checks to catch any errors the agent missed
    console.log("[DEBUG] Running post-completion validation checks...");
    let lintErrors: string | null = null;
    let buildErrors: string | null = null;

    if (mode === "safe") {
      [lintErrors, buildErrors] = (await Promise.all([
        step.run("post-completion-lint-check", async () => {
          return await runLintCheck(sandboxId);
        }),
        step.run("post-completion-build-check", async () => {
          return await runBuildCheck(sandboxId);
        }),
      ])) as [string | null, string | null];
    } else {
      console.log(
        "[DEBUG] Fast mode: skipping lint/build validation checks and auto-fix loop",
      );
    }

    let autoFixAttempts = 0;
    let lastAssistantMessage = getLastAssistantMessage(result);

    if (selectedFramework === "nextjs") {
      const currentFiles = (result.state.data.files || {}) as Record<
        string,
        string
      >;
      if (
        Object.keys(currentFiles).length > 0 &&
        !usesShadcnComponents(currentFiles)
      ) {
        const shadcnErrorMessage =
          "[ERROR] Missing Shadcn UI usage. Rebuild the UI using components imported from '@/components/ui/*' instead of plain HTML elements.";
        console.warn("[WARN] Shadcn usage check failed. Triggering auto-fix.");
        if (!shouldTriggerAutoFix(lastAssistantMessage)) {
          lastAssistantMessage = shadcnErrorMessage;
        } else {
          lastAssistantMessage = `${lastAssistantMessage}\n${shadcnErrorMessage}`;
        }
      }
    }

    if (mode === "safe") {
      // Collect all validation errors
      let validationErrors = [lintErrors, buildErrors]
        .filter(Boolean)
        .join("\n\n");

      // Always include validation errors in the error message if they exist
      if (validationErrors) {
        console.log("[DEBUG] Validation errors detected:", validationErrors);
        if (
          !lastAssistantMessage ||
          !shouldTriggerAutoFix(lastAssistantMessage)
        ) {
          lastAssistantMessage = `Validation Errors Detected:\n${validationErrors}`;
        } else {
          lastAssistantMessage = `${lastAssistantMessage}\n\nValidation Errors:\n${validationErrors}`;
        }
      }

      // Auto-fix loop: continue until errors are resolved or max attempts reached
      while (
        autoFixAttempts < AUTO_FIX_MAX_ATTEMPTS &&
        (shouldTriggerAutoFix(lastAssistantMessage) || validationErrors)
      ) {
        autoFixAttempts += 1;
        const errorDetails =
          validationErrors ||
          lastAssistantMessage ||
          "No error details provided.";

        console.log(
          `\n[DEBUG] Auto-fix triggered (attempt ${autoFixAttempts}). Errors detected.\n${errorDetails}\n`,
        );

        try {
          result = await runNetwork(
            step,
            `run-code-agent-network-auto-fix-${autoFixAttempts}`,
            activeAgent,
            result.state,
            `CRITICAL ERROR DETECTED - IMMEDIATE FIX REQUIRED

The previous attempt encountered an error that must be corrected before proceeding.

Error details:
${errorDetails}

REQUIRED ACTIONS:
1. Carefully analyze the error message to identify the root cause
2. Check for common issues:
   - Missing imports or incorrect import paths
   - TypeScript type errors or incorrect type usage
   - Missing package installations
   - Syntax errors or typos
   - Security vulnerabilities (XSS, injection, etc.)
   - Runtime errors (undefined variables, null references)
3. Apply the necessary fix to resolve the error completely
4. Verify the fix by checking the code logic and types
5. If needed, install missing packages or update configurations
6. Rerun any commands that failed and verify they now succeed
7. Provide an updated <task_summary> only after the error is fully resolved

DO NOT proceed until the error is completely fixed. The fix must be thorough and address the root cause, not just mask the symptoms.`,
          );
        } catch (autoFixError) {
          const fixErrorMessage =
            autoFixError instanceof Error
              ? autoFixError.message
              : String(autoFixError);
          console.error(
            `[ERROR] Auto-fix attempt ${autoFixAttempts} failed:`,
            fixErrorMessage,
          );
          // Break out of auto-fix loop on network error
          break;
        }

        lastAssistantMessage = getLastAssistantMessage(result);

        // Re-run validation checks to verify if errors are actually fixed
        console.log(
          "[DEBUG] Re-running validation checks after auto-fix attempt...",
        );
        const [newLintErrors, newBuildErrors] = await Promise.all([
          step.run(`post-fix-lint-check-${autoFixAttempts}`, async () => {
            return await runLintCheck(sandboxId);
          }),
          step.run(`post-fix-build-check-${autoFixAttempts}`, async () => {
            return await runBuildCheck(sandboxId);
          }),
        ]);

        validationErrors = [newLintErrors, newBuildErrors]
          .filter(Boolean)
          .join("\n\n");

        if (validationErrors) {
          console.log(
            "[DEBUG] Validation errors still present after fix attempt:",
            validationErrors,
          );
        } else {
          console.log("[DEBUG] All validation errors resolved!");
        }

        // Update lastAssistantMessage with validation results if still present
        if (validationErrors) {
          if (!shouldTriggerAutoFix(lastAssistantMessage)) {
            lastAssistantMessage = `Validation Errors Still Present:\n${validationErrors}`;
          } else {
            lastAssistantMessage = `${lastAssistantMessage}\n\nValidation Errors:\n${validationErrors}`;
          }
        }
      }
    }

    lastAssistantMessage = getLastAssistantMessage(result);

    const files = (result.state.data.files || {}) as Record<string, string>;
    const filePaths = Object.keys(files);
    const hasFiles = filePaths.length > 0;

    summaryText = extractSummaryText(
      typeof result.state.data.summary === "string"
        ? result.state.data.summary
        : "",
    );
    const agentProvidedSummary = summaryText.length > 0;
    const agentReportedError = shouldTriggerAutoFix(lastAssistantMessage);

    if (!agentProvidedSummary && hasFiles) {
      const previewFiles = filePaths.slice(0, 5);
      const remainingCount = filePaths.length - previewFiles.length;
      summaryText = `Generated or updated ${filePaths.length} file${filePaths.length === 1 ? "" : "s"}: ${previewFiles.join(", ")}${remainingCount > 0 ? ` (and ${remainingCount} more)` : ""}.`;
      console.warn(
        "[WARN] Missing <task_summary> from agent despite generated files; using fallback summary.",
      );
    }

    result.state.data.summary = summaryText;

    const hasSummary = summaryText.length > 0;

    console.log(
      `[DEBUG] Network run complete. Summary status: ${hasSummary ? "present" : "missing"}`,
    );
    if (hasSummary) {
      console.log("[DEBUG] Summary preview:", summaryText.slice(0, 160));
    }
    console.log("[DEBUG] Files generated:", filePaths.length);
    if (filePaths.length > 0) {
      console.log("[DEBUG] File list preview:", filePaths.slice(0, 10));
    }
    if (agentReportedError) {
      console.warn(
        "[WARN] Last assistant message still signals an unresolved error.",
      );
    }

    const errorReasons: string[] = [];
    const warningReasons: string[] = [];
    const shadcnCompliant =
      selectedFramework !== "nextjs" || usesShadcnComponents(files);

    if (!hasFiles) {
      errorReasons.push("no files generated");
    }
    if (!hasSummary) {
      errorReasons.push("no summary available");
    }
    if (agentReportedError) {
      errorReasons.push("agent reported unresolved error");
    }
    if (!shadcnCompliant) {
      warningReasons.push("missing Shadcn UI components");
    }

    const isError = errorReasons.length > 0;
    if (isError) {
      console.warn(
        `[WARN] Completion flagged as error: ${errorReasons.join(", ")}`,
      );
    } else {
      console.log("[DEBUG] Completion flagged as success.");
    }
    if (warningReasons.length > 0) {
      console.warn(
        `[WARN] Completion generated warnings: ${warningReasons.join(", ")}`,
      );
    }

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      // Ensure the dev server is running before returning the URL
      let sandbox: Sandbox | null = null;
      try {
        sandbox = await getSandbox(sandboxId);
        await ensureDevServerRunning(sandbox, selectedFramework);
        console.log(
          "[DEBUG] Dev server confirmed running, returning sandbox URL",
        );
      } catch (error) {
        console.warn("[WARN] Failed to ensure dev server is running:", error);
        // Continue anyway - the sandbox URL might still work if the template starts it
      }

      // Prefer E2B SDK helper when available so we follow their host format
      try {
        const port = getFrameworkPort(selectedFramework);
        const sandboxWithHost = sandbox as SandboxWithHost | null;
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
          "[WARN] Failed to resolve sandbox host via E2B SDK, using fallback URL:",
          hostError,
        );
      }

      // Fallback to legacy pattern if getHost is unavailable
      console.warn(
        "[WARN] E2B sandbox getHost() not available; using fallback https://${sandboxId}.sandbox.e2b.dev",
      );
      return `https://${sandboxId}.sandbox.e2b.dev`;
    });

    let fragmentTitleOutput: Message[] | undefined;
    let responseOutput: Message[] | undefined;

    if (!isError && hasSummary && hasFiles) {
      try {
        // Reuse the already-selected model for metadata generation so we
        // 1) stay on the Vercel AI gateway and
        // 2) avoid unsupported Gemini endpoints returning 405.
        const metadataModelId =
          selectedModel in MODEL_CONFIGS
            ? selectedModel
            : ("anthropic/claude-haiku-4.5" as keyof typeof MODEL_CONFIGS);

        let titleModel;
        try {
          titleModel = getModelAdapter(
            metadataModelId,
            MODEL_CONFIGS[metadataModelId].temperature,
          );
        } catch (adapterError) {
          const errorMessage =
            adapterError instanceof Error
              ? adapterError.message
              : String(adapterError);
          console.error(
            "[ERROR] Failed to initialize model adapter for metadata generation:",
            errorMessage,
          );
          throw adapterError;
        }

        const fragmentTitleGenerator = createAgent({
          name: "fragment-title-generator",
          description: "A fragment title generator",
          system: FRAGMENT_TITLE_PROMPT,
          model: titleModel,
        });

        const responseGenerator = createAgent({
          name: "response-generator",
          description: "A response generator",
          system: RESPONSE_PROMPT,
          model: titleModel,
        });

        const [titleResult, responseResult] = await Promise.all([
          fragmentTitleGenerator.run(summaryText),
          responseGenerator.run(summaryText),
        ]);

        fragmentTitleOutput = titleResult.output;
        responseOutput = responseResult.output;
      } catch (gatewayError) {
        const errorMessage =
          gatewayError instanceof Error
            ? gatewayError.message
            : String(gatewayError);
        console.error(
          "[ERROR] Failed to generate fragment metadata:",
          errorMessage,
        );
        if (gatewayError instanceof Error && gatewayError.stack) {
          console.error("[ERROR] Stack trace:", gatewayError.stack);
        }
        fragmentTitleOutput = undefined;
        responseOutput = undefined;
      }
    }

    const allScreenshots = await step.run("collect-screenshots", async () => {
      const screenshots: string[] = [];
      for (const context of crawledContexts) {
        if (context.screenshots && Array.isArray(context.screenshots)) {
          screenshots.push(...context.screenshots);
        }
      }

      const validScreenshots = screenshots.filter(isValidScreenshotUrl);
      const uniqueScreenshots = Array.from(new Set(validScreenshots));

      if (screenshots.length > uniqueScreenshots.length) {
        console.log(
          `[DEBUG] Deduplicated ${screenshots.length - uniqueScreenshots.length} duplicate screenshots`,
        );
      }

      if (uniqueScreenshots.length > MAX_SCREENSHOTS) {
        console.warn(
          `[WARN] Screenshot count (${uniqueScreenshots.length}) exceeds limit (${MAX_SCREENSHOTS}), keeping first ${MAX_SCREENSHOTS}`,
        );
        return uniqueScreenshots.slice(0, MAX_SCREENSHOTS);
      }

      return uniqueScreenshots;
    });

    let filePathsList: string[] = [];
    const sandboxFiles: Record<string, string> = {};

    if (!isError && mode === "safe") {
      filePathsList = await step.run("find-sandbox-files", async () => {
        try {
          const sandbox = await getSandbox(sandboxId);
          const findCommand = getFindCommand(selectedFramework);
          const findResult = await sandbox.commands.run(findCommand);

          const filePaths = findResult.stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(
              (line) => line.length > 0 && !line.includes("Permission denied"),
            )
            .filter(isValidFilePath);

          console.log(`[DEBUG] Found ${filePaths.length} files in sandbox`);

          if (filePaths.length === 0) {
            console.warn("[WARN] No files found in sandbox");
            return [];
          }

          const totalFiles = Math.min(filePaths.length, MAX_FILE_COUNT);
          if (filePaths.length > MAX_FILE_COUNT) {
            console.warn(
              `[WARN] File count (${filePaths.length}) exceeds limit (${MAX_FILE_COUNT}), reading first ${MAX_FILE_COUNT} files`,
            );
          }

          return filePaths.slice(0, totalFiles);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[ERROR] Failed to find sandbox files:", errorMessage);
          return [];
        }
      });

      if (filePathsList.length > 0) {
        const numBatches = Math.ceil(
          filePathsList.length / FILES_PER_STEP_BATCH,
        );

        for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
          const batchStart = batchIndex * FILES_PER_STEP_BATCH;
          const batchEnd = Math.min(
            batchStart + FILES_PER_STEP_BATCH,
            filePathsList.length,
          );
          const batchFilePaths = filePathsList.slice(batchStart, batchEnd);

          const batchFiles = await step.run(
            `read-sandbox-files-batch-${batchIndex}`,
            async () => {
              const sandbox = await getSandbox(sandboxId);
              const batchFilesMap: Record<string, string> = {};

              for (const filePath of batchFilePaths) {
                const content = await readFileWithTimeout(
                  sandbox,
                  filePath,
                  FILE_READ_TIMEOUT_MS,
                );
                if (content !== null) {
                  batchFilesMap[filePath] = content;
                }
              }

              const batchSize = calculateFilesMapSize(batchFilesMap);
              if (batchSize > INNGEST_STEP_OUTPUT_SIZE_LIMIT) {
                console.warn(
                  `[WARN] Batch ${batchIndex} size (${batchSize} bytes) exceeds Inngest limit, filtering large files`,
                );
                const filteredBatch: Record<string, string> = {};
                let currentSize = 0;

                for (const [path, content] of Object.entries(batchFilesMap)) {
                  const fileSize = path.length + content.length;
                  if (
                    currentSize + fileSize <=
                    INNGEST_STEP_OUTPUT_SIZE_LIMIT * 0.9
                  ) {
                    filteredBatch[path] = content;
                    currentSize += fileSize;
                  } else {
                    console.warn(
                      `[WARN] Skipping large file in batch: ${path} (${fileSize} bytes)`,
                    );
                  }
                }

                return filteredBatch;
              }

              return batchFilesMap;
            },
          );

          Object.assign(sandboxFiles, batchFiles);
          console.log(
            `[DEBUG] Processed batch ${batchIndex + 1}/${numBatches} (${Object.keys(batchFiles).length} files)`,
          );
        }

        console.log(
          `[DEBUG] Successfully read ${Object.keys(sandboxFiles).length} files from sandbox in ${numBatches} batches`,
        );
      }
    } else {
      console.log(
        "[DEBUG] Fast mode or error state: skipping sandbox filesystem scan; using agent files only",
      );
    }

    const agentFiles = result.state.data.files || {};

    let finalFiles: Record<string, string>;

    if (!isError && mode === "safe" && Object.keys(sandboxFiles).length > 0) {
      const mergeValidation = validateMergeStrategy(agentFiles, sandboxFiles);

      if (mergeValidation.warnings.length > 0) {
        console.warn(
          `[WARN] Merge strategy warnings: ${mergeValidation.warnings.join("; ")}`,
        );
      }

      // Filter out E2B sandbox system files and configuration boilerplate
      const filteredSandboxFiles = filterAIGeneratedFiles(sandboxFiles);
      const removedFileCount =
        Object.keys(sandboxFiles).length -
        Object.keys(filteredSandboxFiles).length;
      console.log(
        `[DEBUG] Filtered sandbox files: ${Object.keys(sandboxFiles).length} → ${Object.keys(filteredSandboxFiles).length} files (removed ${removedFileCount} system/config files)`,
      );

      // Merge strategy: Agent files take priority over sandbox files
      const mergedFiles = { ...filteredSandboxFiles, ...agentFiles };

      const overwrittenFiles = Object.keys(agentFiles).filter(
        (path) => filteredSandboxFiles[path] !== undefined,
      );
      if (overwrittenFiles.length > 0) {
        console.log(
          `[DEBUG] Agent files overwriting ${overwrittenFiles.length} sandbox files: ${overwrittenFiles
            .slice(0, 5)
            .join(", ")}${overwrittenFiles.length > 5 ? "..." : ""}`,
        );
      }

      // Validate all file paths in merged files to prevent path traversal
      const validatedMergedFiles: Record<string, string> = {};
      let invalidPathCount = 0;

      for (const [path, content] of Object.entries(mergedFiles)) {
        if (isValidFilePath(path)) {
          validatedMergedFiles[path] = content as string;
        } else {
          invalidPathCount++;
          console.warn(
            `[WARN] Filtered out invalid file path from merged files: ${path}`,
          );
        }
      }

      if (invalidPathCount > 0) {
        console.warn(
          `[WARN] Filtered out ${invalidPathCount} invalid file paths from merged files`,
        );
      }

      // Validate aggregate size to prevent exceeding Convex document limits
      const totalSizeBytes = Object.values(validatedMergedFiles).reduce(
        (sum, content) => sum + content.length,
        0,
      );
      const totalSizeMB = totalSizeBytes / (1024 * 1024);
      const fileCount = Object.keys(validatedMergedFiles).length;

      console.log(
        `[DEBUG] Merged files size: ${totalSizeMB.toFixed(2)} MB (${fileCount} files, ${totalSizeBytes.toLocaleString()} bytes)`,
      );

      // Convex document size limits: warn at 4MB, fail at 5MB
      const WARN_SIZE_MB = 4;
      const MAX_SIZE_MB = 5;

      if (totalSizeMB > MAX_SIZE_MB) {
        throw new Error(
          `Merged files size (${totalSizeMB.toFixed(2)} MB) exceeds maximum limit (${MAX_SIZE_MB} MB). ` +
            `This usually indicates that large build artifacts or dependencies were not filtered out. ` +
            `File count: ${fileCount}. Please review the file filtering logic.`,
        );
      }

      if (totalSizeMB > WARN_SIZE_MB) {
        console.warn(
          `[WARN] Merged files size (${totalSizeMB.toFixed(2)} MB) is approaching limit (${MAX_SIZE_MB} MB). ` +
            `Current file count: ${fileCount}. Consider reviewing file filtering to reduce size.`,
        );
      }

      finalFiles = validatedMergedFiles;
    } else {
      finalFiles = agentFiles;
      if (mode === "fast") {
        console.log(
          "[DEBUG] Fast mode: using only agent-generated files (no sandbox merge)",
        );
      } else if (isError) {
        console.log(
          "[DEBUG] Error state: using only agent-generated files (no sandbox merge)",
        );
      } else {
        console.log(
          "[DEBUG] No sandbox files found; using only agent-generated files",
        );
      }
    }

    let fragmentTitleForReturn: string | null = null;

    await step.run("save-result", async () => {
      if (isError) {
        // Provide more specific error messages based on the failure reasons
        let errorMessage = "Something went wrong. ";

        if (!hasFiles && !hasSummary) {
          errorMessage =
            "I wasn't able to generate any code for your request. This could be due to:\n\n" +
            "• The request was unclear or too complex\n" +
            "• A temporary issue with the AI model\n" +
            "• The dev server failed to start\n\n" +
            "Please try:\n" +
            "• Rephrasing your request with more specific details\n" +
            "• Breaking complex requests into smaller steps\n" +
            "• Trying again in a moment";
        } else if (!hasFiles) {
          errorMessage =
            "I understood your request but couldn't generate the code files. Please try again or rephrase your request.";
        } else if (agentReportedError) {
          errorMessage =
            "I encountered an error while generating code. The AI agent reported issues. Please try again.";
        }

        const errorContent = sanitizeTextForDatabase(errorMessage);
        const messageContent =
          errorContent.length > 0
            ? errorContent
            : "An unexpected error occurred.";

        return await convex.mutation(api.messages.createForUser, {
          userId: project.userId,
          projectId: event.data.projectId as Id<"projects">,
          content: messageContent,
          role: "ASSISTANT",
          type: "ERROR",
          status: "COMPLETE",
        });
      }

      const parsedResponse = parseAgentOutput(responseOutput);
      const parsedTitle = parseAgentOutput(fragmentTitleOutput);

      const sanitizedResponse = sanitizeTextForDatabase(parsedResponse ?? "");
      const baseResponseContent =
        sanitizedResponse.length > 0
          ? sanitizedResponse
          : "Generated code is ready.";
      const warningsNote =
        warningReasons.length > 0
          ? sanitizeTextForDatabase(
              `\n\nWarnings:\n- ${warningReasons.join("\n- ")}`,
            )
          : "";
      const responseContent = sanitizeTextForDatabase(
        `${baseResponseContent}${warningsNote}`,
      );

      const sanitizedTitle = sanitizeTextForDatabase(parsedTitle ?? "");
      const fragmentTitle =
        sanitizedTitle.length > 0 ? sanitizedTitle : "Generated Fragment";

      // Capture for function return so preview uses the real fragment title
      fragmentTitleForReturn = fragmentTitle;

      const metadata: FragmentMetadata = {
        model: selectedModel,
        modelName: MODEL_CONFIGS[selectedModel].name,
        provider: MODEL_CONFIGS[selectedModel].provider,
        ...(allScreenshots.length > 0 && { screenshots: allScreenshots }),
        ...(warningReasons.length > 0 && { warnings: warningReasons }),
      };

      console.log(
        `[DEBUG] Preparing to save fragment with ${Object.keys(finalFiles).length} files`,
      );
      console.log(
        `[DEBUG] Sample file paths:`,
        Object.keys(finalFiles).slice(0, 10),
      );

      // Create message first
      const messageId = await convex.mutation(api.messages.createForUser, {
        userId: project.userId,
        projectId: event.data.projectId as Id<"projects">,
        content: responseContent,
        role: "ASSISTANT",
        type: "RESULT",
        status: "COMPLETE",
      });

      console.log(
        `[DEBUG] Created message ${messageId}, now creating fragment...`,
      );

      // Then create fragment linked to the message
      const fragmentId = await convex.mutation(
        api.messages.createFragmentForUser,
        {
          userId: project.userId,
          messageId: messageId as Id<"messages">,
          sandboxId: sandboxId || undefined,
          sandboxUrl: sandboxUrl,
          title: fragmentTitle,
          files: finalFiles,
          framework: frameworkToConvexEnum(selectedFramework),
          metadata: metadata,
        },
      );

      console.log(
        `[DEBUG] Fragment ${fragmentId} created successfully with ${Object.keys(finalFiles).length} files`,
      );

      return messageId;
    });

    return {
      url: sandboxUrl,
      title: fragmentTitleForReturn ?? "Fragment",
      files: finalFiles,
      summary: summaryText,
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
