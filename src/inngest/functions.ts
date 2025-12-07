import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { openai, gemini, createAgent, createTool, createNetwork, type Tool, type Message, createState, type NetworkRun } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inspect } from "util";

import { crawlUrl, type CrawledContent } from "@/lib/firecrawl";
import { sanitizeJsonForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import {
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
  FRAMEWORK_SELECTOR_PROMPT,
  NEXTJS_PROMPT,
  ANGULAR_PROMPT,
  REACT_PROMPT,
  VUE_PROMPT,
  SVELTE_PROMPT,
} from "@/prompt";

import { inngest } from "./client";
import { SANDBOX_TIMEOUT, type Framework, type AgentState } from "./types";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";
// Multi-agent workflow removed; only single code agent is used.

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

  // Speed-critical tasks favor Kimi
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
  }

  // Use OpenAI adapter for all other models
  return openai({
    apiKey,
    baseUrl,
    model: modelId,
    defaultParameters: {
      temperature: temp,
    },
  });
}

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

type SandboxWithHost = Sandbox & {
  getHost?: (port: number) => string | undefined;
};

const AUTO_FIX_MAX_ATTEMPTS = 2;

const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i, /\[ERROR\]/i, /ERROR/, /Failed\b/i, /failure\b/i, /Exception\b/i,
  /SyntaxError/i, /TypeError/i, /ReferenceError/i, /Module not found/i,
  /Cannot find module/i, /Failed to resolve/i, /Build failed/i,
  /Compilation error/i, /undefined is not/i, /null is not/i,
  /Cannot read propert/i, /is not a function/i, /is not defined/i,
  /ESLint/i, /Type error/i, /TS\d+/i,
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
  try {
    const sandbox = await getSandbox(sandboxId);
    const buffers: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

    const result = await sandbox.commands.run("bun run lint", {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      }
    });

    const output = buffers.stdout + buffers.stderr;

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
    console.error("[DEBUG] Lint check failed:", error);
    // Don't fail the entire process if lint check fails
    return null;
  }
};

const runBuildCheck = async (sandboxId: string): Promise<string | null> => {
  try {
    const sandbox = await getSandbox(sandboxId);
    const buffers: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

    // Try to build the project to catch build-time errors
    const buildCommand = 'bun run build';
    console.log("[DEBUG] Running build check with command:", buildCommand);

    const result = await sandbox.commands.run(buildCommand, {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      },
      timeoutMs: 60000, // 60 second timeout for build
    });

    const output = buffers.stdout + buffers.stderr;

    // If build failed (non-zero exit code)
    if (result.exitCode !== 0) {
      console.log("[DEBUG] Build check FAILED with exit code:", result.exitCode);
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
    console.error("[DEBUG] Build check failed with exception:", error);
    if (error instanceof Error && error.stack) {
      console.error("[DEBUG] Stack trace:", error.stack);
    } else {
      console.error("[DEBUG] Serialized exception:", inspect(error, { depth: null }));
    }

    const serializedError = error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ""}`.trim()
      : inspect(error, { depth: null });

    // Return the error as it likely indicates a build problem
    return `Build check exception: ${serializedError}`;
  }
};

const getE2BTemplate = (framework: Framework): string => {
  switch (framework) {
    case 'nextjs':
      return 'zapdev';
    case 'angular':
      return 'zapdev-angular';
    case 'react':
      return 'zapdev-react';
    case 'vue':
      return 'zapdev-vue';
    case 'svelte':
      return 'zapdev-svelte';
    default:
      return 'zapdev';
  }
};

const getFrameworkPort = (framework: Framework): number => {
  switch (framework) {
    case 'nextjs':
      return 3000;
    case 'angular':
      return 4200;
    case 'react':
    case 'vue':
    case 'svelte':
      return 5173;
    default:
      return 3000;
  }
};

const getFrameworkPrompt = (framework: Framework): string => {
  switch (framework) {
    case 'nextjs':
      return NEXTJS_PROMPT;
    case 'angular':
      return ANGULAR_PROMPT;
    case 'react':
      return REACT_PROMPT;
    case 'vue':
      return VUE_PROMPT;
    case 'svelte':
      return SVELTE_PROMPT;
    default:
      return NEXTJS_PROMPT;
  }
}
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 500;
const MAX_SCREENSHOTS = 20;
const FILE_READ_BATCH_SIZE = 10;
const FILE_READ_TIMEOUT_MS = 5000;

const ALLOWED_WORKSPACE_PATHS = ['/home/user', '.'];

const escapeShellPattern = (pattern: string): string => {
  return pattern.replace(/'/g, "'\"'\"'");
};

const isValidFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  const normalizedPath = filePath.trim();

  if (normalizedPath.length === 0 || normalizedPath.length > 4096) {
    return false;
  }

  if (normalizedPath.includes('..')) {
    return false;
  }

  if (normalizedPath.includes('\0') || normalizedPath.includes('\n') || normalizedPath.includes('\r')) {
    return false;
  }

  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(basePath =>
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`) ||
    normalizedPath.startsWith(`./`)
  );

  return isInWorkspace || normalizedPath.startsWith('/home/user/');
};

const getFindCommand = (framework: Framework): string => {
  const baseIgnorePatterns = [
    '*/node_modules/*',
    '*/.git/*',
    '*/dist/*',
    '*/build/*',
  ];

  const frameworkSpecificIgnores: Record<Framework, string[]> = {
    nextjs: ['*/.next/*'],
    angular: ['*/.angular/*'],
    react: [],
    vue: [],
    svelte: ['*/.svelte-kit/*'],
  };

  const ignorePatterns = [...baseIgnorePatterns, ...(frameworkSpecificIgnores[framework] || [])];
  const escapedPatterns = ignorePatterns.map(pattern => `-not -path '${escapeShellPattern(pattern)}'`);
  const ignoreFlags = escapedPatterns.join(' ');

  return `find /home/user -type f ${ignoreFlags} 2>/dev/null || find . -type f ${ignoreFlags} 2>/dev/null`;
};

const isValidScreenshotUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string' || url.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return url.startsWith('data:image/');
  }
};

const readFileWithTimeout = async (
  sandbox: Sandbox,
  filePath: string,
  timeoutMs: number
): Promise<string | null> => {
  if (!isValidFilePath(filePath)) {
    console.warn(`[WARN] Invalid file path detected, skipping: ${filePath}`);
    return null;
  }

  try {
    const readPromise = sandbox.files.read(filePath);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const content = await Promise.race([readPromise, timeoutPromise]);

    if (content === null) {
      console.warn(`[WARN] File read timeout for ${filePath}`);
      return null;
    }

    if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
      console.warn(`[WARN] File ${filePath} exceeds size limit (${content.length} bytes), skipping`);
      return null;
    }

    return typeof content === 'string' ? content : null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Failed to read file ${filePath}:`, errorMessage);
    return null;
  }
};

const readFilesInBatches = async (
  sandbox: Sandbox,
  filePaths: string[],
  batchSize: number
): Promise<Record<string, string>> => {
  const allFilesMap: Record<string, string> = {};

  const validFilePaths = filePaths.filter(isValidFilePath);
  const invalidCount = filePaths.length - validFilePaths.length;

  if (invalidCount > 0) {
    console.warn(`[WARN] Filtered out ${invalidCount} invalid file paths (path traversal attempts or invalid paths)`);
  }

  const totalFiles = Math.min(validFilePaths.length, MAX_FILE_COUNT);

  if (validFilePaths.length > MAX_FILE_COUNT) {
    console.warn(`[WARN] File count (${validFilePaths.length}) exceeds limit (${MAX_FILE_COUNT}), reading first ${MAX_FILE_COUNT} files`);
  }

  const filesToRead = validFilePaths.slice(0, totalFiles);

  for (let i = 0; i < filesToRead.length; i += batchSize) {
    const batch = filesToRead.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const content = await readFileWithTimeout(sandbox, filePath, FILE_READ_TIMEOUT_MS);
        return { filePath, content };
      })
    );

    for (const { filePath, content } of batchResults) {
      if (content !== null) {
        allFilesMap[filePath] = content;
      }
    }

    console.log(`[DEBUG] Processed ${Math.min(i + batchSize, filesToRead.length)}/${filesToRead.length} files`);
  }

  return allFilesMap;
};

const CRITICAL_FILES = ['package.json', 'tsconfig.json', 'next.config.ts', 'next.config.js', 'tailwind.config.ts', 'tailwind.config.js'];

const validateMergeStrategy = (
  agentFiles: Record<string, string>,
  sandboxFiles: Record<string, string>
): { warnings: string[]; isValid: boolean } => {
  const warnings: string[] = [];

  const agentFilePaths = new Set(Object.keys(agentFiles));
  const sandboxFilePaths = new Set(Object.keys(sandboxFiles));

  const overwrittenCriticalFiles = CRITICAL_FILES.filter(
    file => sandboxFilePaths.has(file) && agentFilePaths.has(file) &&
      agentFiles[file] !== sandboxFiles[file]
  );

  if (overwrittenCriticalFiles.length > 0) {
    warnings.push(`Critical files were overwritten by agent: ${overwrittenCriticalFiles.join(', ')}`);
  }

  const missingCriticalFiles = CRITICAL_FILES.filter(
    file => sandboxFilePaths.has(file) && !agentFilePaths.has(file)
  );

  if (missingCriticalFiles.length > 0) {
    warnings.push(`Critical files from sandbox not in agent files (will be preserved): ${missingCriticalFiles.join(', ')}`);
  }

  const agentFileCount = agentFilePaths.size;
  const sandboxFileCount = sandboxFilePaths.size;

  if (agentFileCount > 0 && sandboxFileCount > agentFileCount * 10) {
    warnings.push(`Large discrepancy: sandbox has ${sandboxFileCount} files but agent only tracked ${agentFileCount} files`);
  }

  return {
    warnings,
    isValid: warnings.length === 0 || warnings.every(w => !w.includes('discrepancy')),
  };
};

const createCodeAgentTools = (sandboxId: string) => [
  createTool({
    name: "terminal",
    description: "Use the terminal to run commands",
    parameters: z.object({
      command: z.string(),
    }),
    handler: async (
      { command }: { command: string },
      opts: Tool.Options<AgentState>
    ) => {
      return await opts.step?.run("terminal", async () => {
        const buffers: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

        try {
          const sandbox = await getSandbox(sandboxId);
          const result = await sandbox.commands.run(command, {
            onStdout: (data: string) => {
              buffers.stdout += data;
            },
            onStderr: (data: string) => {
              buffers.stderr += data;
            }
          });
          return result.stdout;
        } catch (e) {
          console.error(
            `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
          );
          return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
        }
      });
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
    handler: async (
      { files },
      { step, network }: Tool.Options<AgentState>
    ) => {
      const newFiles = await step?.run("createOrUpdateFiles", async () => {
        try {
          const updatedFiles = network.state.data.files || {};
          const sandbox = await getSandbox(sandboxId);
          for (const file of files) {
            await sandbox.files.write(file.path, file.content);
            updatedFiles[file.path] = file.content;
          }

          return updatedFiles;
        } catch (e) {
          return "Error: " + e;
        }
      });

      if (typeof newFiles === "object") {
        network.state.data.files = newFiles;
      }
    }
  }),
  createTool({
    name: "readFiles",
    description: "Read files from the sandbox",
    parameters: z.object({
      files: z.array(z.string()),
    }),
    handler: async ({ files }, { step }) => {
      return await step?.run("readFiles", async () => {
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
      })
    },
  })
];

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    console.log("[DEBUG] Starting code-agent function");
    console.log("[DEBUG] Event data:", JSON.stringify(event.data));
    console.log("[DEBUG] E2B_API_KEY present:", !!process.env.E2B_API_KEY);
    console.log("[DEBUG] AI_GATEWAY_API_KEY present:", !!process.env.AI_GATEWAY_API_KEY);

    // Get project to check if framework is already set
    const project = await step.run("get-project", async () => {
      return await convex.query(api.projects.getForSystem, {
        projectId: event.data.projectId as Id<"projects">,
      });
    });

    if (!project) {
      const missingProjectId = String(event.data.projectId ?? "unknown");
      console.error("[ERROR] Project not found for code-agent run:", missingProjectId);
      throw new Error(
        `Project not found. Unable to run code agent for project ${missingProjectId}.`,
      );
    }

    let selectedFramework: Framework = project?.framework?.toLowerCase() as Framework || 'nextjs';

    // If project doesn't have a framework set, use framework selector
    if (!project?.framework) {
      console.log("[DEBUG] No framework set, running framework selector...");

      const frameworkSelectorAgent = createAgent({
        name: "framework-selector",
        description: "Determines the best framework for the user's request",
        system: FRAMEWORK_SELECTOR_PROMPT,
        model: openai({
          model: "google/gemini-2.5-flash-lite",
          apiKey: process.env.AI_GATEWAY_API_KEY!,
          baseUrl: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
          defaultParameters: {
            temperature: 0.3,
          },
        }),
      });

      const frameworkResult = await frameworkSelectorAgent.run(event.data.value);
      const frameworkOutput = frameworkResult.output[0];

      if (frameworkOutput.type === "text") {
        const detectedFramework = (typeof frameworkOutput.content === "string"
          ? frameworkOutput.content
          : frameworkOutput.content.map((c) => c.text).join("")).trim().toLowerCase();

        console.log("[DEBUG] Framework selector output:", detectedFramework);

        if (['nextjs', 'angular', 'react', 'vue', 'svelte'].includes(detectedFramework)) {
          selectedFramework = detectedFramework as Framework;
        }
      }

      console.log("[DEBUG] Selected framework:", selectedFramework);

      // Update project with selected framework
      await step.run("update-project-framework", async () => {
        return await convex.mutation(api.projects.update, {
          projectId: event.data.projectId as Id<"projects">,
          framework: frameworkToConvexEnum(selectedFramework),
        });
      });
    } else {
      console.log("[DEBUG] Using existing framework:", selectedFramework);
    }

    const sandboxId = await step.run("get-sandbox-id", async () => {
      console.log("[DEBUG] Creating E2B sandbox for framework:", selectedFramework);
      const template = getE2BTemplate(selectedFramework);

      try {
        let sandbox;
        try {
          console.log("[DEBUG] Attempting to create sandbox with template:", template);
          sandbox = await Sandbox.create(template, {
            apiKey: process.env.E2B_API_KEY,
            timeoutMs: SANDBOX_TIMEOUT,
          });
        } catch {
          // Fallback to default zapdev template if framework-specific doesn't exist
          console.log("[DEBUG] Framework template not found, using default 'zapdev' template");
          sandbox = await Sandbox.create("zapdev", {
            apiKey: process.env.E2B_API_KEY,
            timeoutMs: SANDBOX_TIMEOUT,
          });
          // Fallback framework to nextjs if template doesn't exist
          selectedFramework = 'nextjs';
        }

        console.log("[DEBUG] Sandbox created successfully:", sandbox.sandboxId);
        await sandbox.setTimeout(SANDBOX_TIMEOUT);
        return sandbox.sandboxId;
      } catch (error) {
        console.error("[ERROR] Failed to create E2B sandbox:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`E2B sandbox creation failed: ${errorMessage}`);
      }
    });

    const previousMessages = await step.run("get-previous-messages", async () => {
      console.log("[DEBUG] Fetching previous messages for project:", event.data.projectId);
      const formattedMessages: Message[] = [];

      try {
        const messages = await convex.query(api.messages.list, {
          projectId: event.data.projectId as Id<"projects">,
        });

        // Get the last 3 messages
        const recentMessages = messages.slice(-3);

        console.log("[DEBUG] Found", recentMessages.length, "previous messages");

        for (const message of recentMessages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          })
        }

        return formattedMessages;
      } catch (error) {
        console.error("[ERROR] Failed to fetch previous messages:", error);
        return [];
      }
    });

    await step.run("notify-screenshots", async () => {
      const urls = extractUrls(event.data.value ?? "").slice(0, 2);
      if (urls.length === 0) {
        return;
      }

      try {
        for (const url of urls) {
          await convex.mutation(api.messages.createForUser, {
            userId: project.userId,
            projectId: event.data.projectId as Id<"projects">,
            content: `📸 Taking screenshot of ${url}...`,
            role: "ASSISTANT",
            type: "RESULT",
            status: "COMPLETE",
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to create screenshot notifications:", error);
      }
    });

    const crawledContexts = await step.run("crawl-url-context", async () => {
      try {
        const urls = extractUrls(event.data.value ?? "").slice(0, 2);

        if (urls.length === 0) {
          return [] as CrawledContent[];
        }

        console.log("[DEBUG] Found URLs in input:", urls);

        const crawlWithTimeout = async (url: string): Promise<CrawledContent | null> => {
          try {
            return await Promise.race([
              crawlUrl(url),
              new Promise<null>((resolve) =>
                setTimeout(() => {
                  console.warn("[DEBUG] Crawl timeout for URL:", url);
                  resolve(null);
                }, 10000)
              ),
            ]);
          } catch (error) {
            console.error("[ERROR] Crawl error for URL:", url, error);
            return null;
          }
        };

        const results = await Promise.all(
          urls.map(url => crawlWithTimeout(url))
        );

        return results.filter((crawled): crawled is CrawledContent => crawled !== null);
      } catch (error) {
        console.error("[ERROR] Failed to crawl URLs", error);
        return [] as CrawledContent[];
      }
    });

    const contextMessages: Message[] = (crawledContexts ?? []).map((context) => ({
      type: "text",
      role: "system",
      content: `Crawled context from ${context.url}:\n${context.content}`,
    }));

    const initialMessages = [...contextMessages, ...previousMessages];

    const state = createState<AgentState>(
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

    const frameworkPrompt = getFrameworkPrompt(selectedFramework);
    console.log("[DEBUG] Using prompt for framework:", selectedFramework);

    const codeAgent = createAgent<AgentState>({
      name: `${selectedFramework}-code-agent`,
      description: `An expert ${selectedFramework} coding agent`,
      system: frameworkPrompt,
      model: openai({
        model: "anthropic/claude-haiku-4.5",
        apiKey: process.env.AI_GATEWAY_API_KEY!,
        baseUrl: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
        defaultParameters: {
          temperature: 0.7,
          frequency_penalty: 0.5,
        },
      }),
      tools: createCodeAgentTools(sandboxId),
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            const containsSummaryTag = lastAssistantMessageText.includes("<task_summary>");
            console.log(
              `[DEBUG] Agent response received (contains summary tag: ${containsSummaryTag})`
            );
            if (containsSummaryTag) {
              network.state.data.summary = extractSummaryText(lastAssistantMessageText);
              network.state.data.summaryRetryCount = 0;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 8,
      defaultState: state,
      router: async ({ network, callCount }) => {
        const summaryText = extractSummaryText(network.state.data.summary ?? "");
        const fileEntries = network.state.data.files ?? {};
        const fileCount = Object.keys(fileEntries).length;

        console.log(`[DEBUG] Router: callCount=${callCount}, fileCount=${fileCount}, hasSummary=${summaryText.length > 0}`);

        // Always run the code agent on the first call
        if (callCount === 0) {
          console.log("[DEBUG] First iteration - running code agent");
          return codeAgent;
        }

        // Only complete if we have BOTH files AND a summary
        if (fileCount > 0 && summaryText.length > 0) {
          console.log("[DEBUG] Files generated and summary present - completing");
          return;
        }

        // If no files yet, always continue
        if (fileCount === 0) {
          console.log("[DEBUG] No files generated yet - continuing with code agent");
          network.state.data.summaryRetryCount = 0;
          return codeAgent;
        }

        // Have files but no summary - retry for summary
        const currentRetry = network.state.data.summaryRetryCount ?? 0;
        if (currentRetry >= 2) {
          console.warn(
            "[WARN] Missing <task_summary> after multiple attempts despite generated files; proceeding with fallback handling."
          );
          return;
        }

        const nextRetry = currentRetry + 1;
        network.state.data.summaryRetryCount = nextRetry;
        console.log(
          `[DEBUG] No <task_summary> yet; retrying agent to request summary (attempt ${nextRetry}).`
        );
        return codeAgent;
      },
    });

    console.log("[DEBUG] Running network with input:", event.data.value);
    let result = await network.run(event.data.value, { state });

    // Post-completion validation: Run lint and build checks to catch any errors the agent missed
    console.log("[DEBUG] Running post-completion validation checks...");
    const [lintErrors, buildErrors] = await Promise.all([
      step.run("post-completion-lint-check", async () => {
        return await runLintCheck(sandboxId);
      }),
      step.run("post-completion-build-check", async () => {
        return await runBuildCheck(sandboxId);
      })
    ]);

    let autoFixAttempts = 0;
    let lastAssistantMessage = getLastAssistantMessage(result);

    if (selectedFramework === 'nextjs') {
      const currentFiles = (result.state.data.files || {}) as Record<string, string>;
      if (Object.keys(currentFiles).length > 0 && !usesShadcnComponents(currentFiles)) {
        const shadcnErrorMessage = "[ERROR] Missing Shadcn UI usage. Rebuild the UI using components imported from '@/components/ui/*' instead of plain HTML elements.";
        console.warn("[WARN] Shadcn usage check failed. Triggering auto-fix.");
        if (!shouldTriggerAutoFix(lastAssistantMessage)) {
          lastAssistantMessage = shadcnErrorMessage;
        } else {
          lastAssistantMessage = `${lastAssistantMessage}\n${shadcnErrorMessage}`;
        }
      }
    }

    // Collect all validation errors
    let validationErrors = [lintErrors, buildErrors].filter(Boolean).join("\n\n");

    // Always include validation errors in the error message if they exist
    if (validationErrors) {
      console.log("[DEBUG] Validation errors detected:", validationErrors);
      if (!lastAssistantMessage || !shouldTriggerAutoFix(lastAssistantMessage)) {
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
      const errorDetails = validationErrors || lastAssistantMessage || "No error details provided.";

      console.log(
        `\n[DEBUG] Auto-fix triggered (attempt ${autoFixAttempts}). Errors detected.\n${errorDetails}\n`
      );

      result = await network.run(
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
        { state: result.state }
      );

      lastAssistantMessage = getLastAssistantMessage(result);

      // Re-run validation checks to verify if errors are actually fixed
      console.log("[DEBUG] Re-running validation checks after auto-fix attempt...");
      const [newLintErrors, newBuildErrors] = await Promise.all([
        step.run(`post-fix-lint-check-${autoFixAttempts}`, async () => {
          return await runLintCheck(sandboxId);
        }),
        step.run(`post-fix-build-check-${autoFixAttempts}`, async () => {
          return await runBuildCheck(sandboxId);
        })
      ]);

      validationErrors = [newLintErrors, newBuildErrors].filter(Boolean).join("\n\n");

      if (validationErrors) {
        console.log("[DEBUG] Validation errors still present after fix attempt:", validationErrors);
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

    lastAssistantMessage = getLastAssistantMessage(result);

    const files = (result.state.data.files || {}) as Record<string, string>;
    const filePaths = Object.keys(files);
    const hasFiles = filePaths.length > 0;

    let summaryText = extractSummaryText(
      typeof result.state.data.summary === "string" ? result.state.data.summary : ""
    );
    const agentProvidedSummary = summaryText.length > 0;
    const agentReportedError = shouldTriggerAutoFix(lastAssistantMessage);

    if (!agentProvidedSummary && hasFiles) {
      const previewFiles = filePaths.slice(0, 5);
      const remainingCount = filePaths.length - previewFiles.length;
      summaryText = `Generated or updated ${filePaths.length} file${filePaths.length === 1 ? "" : "s"}: ${previewFiles.join(", ")}${remainingCount > 0 ? ` (and ${remainingCount} more)` : ""}.`;
      console.warn(
        "[WARN] Missing <task_summary> from agent despite generated files; using fallback summary."
      );
    }

    result.state.data.summary = summaryText;

    const hasSummary = summaryText.length > 0;

    console.log(
      `[DEBUG] Network run complete. Summary status: ${hasSummary ? "present" : "missing"}`
    );
    if (hasSummary) {
      console.log("[DEBUG] Summary preview:", summaryText.slice(0, 160));
    }
    console.log("[DEBUG] Files generated:", filePaths.length);
    if (filePaths.length > 0) {
      console.log("[DEBUG] File list preview:", filePaths.slice(0, 10));
    }
    if (agentReportedError) {
      console.warn("[WARN] Last assistant message still signals an unresolved error.");
    }

    const errorReasons: string[] = [];
    const shadcnCompliant = selectedFramework !== 'nextjs' || usesShadcnComponents(files);

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
      errorReasons.push("missing Shadcn UI components");
    }

    const isError = errorReasons.length > 0;
    if (isError) {
      console.warn(`[WARN] Completion flagged as error: ${errorReasons.join(", ")}`);
    } else {
      console.log("[DEBUG] Completion flagged as success.");
    }

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);

      if (typeof (sandbox as SandboxWithHost).getHost === "function") {
        const host = (sandbox as SandboxWithHost).getHost(getFrameworkPort(selectedFramework));

        if (host && host.length > 0) {
          return host.startsWith("http") ? host : `https://${host}`;
        }
      }

      const fallbackHost = `https://${sandboxId}.sandbox.e2b.dev`;
      console.warn("[WARN] Using fallback sandbox host:", fallbackHost);
      return fallbackHost;
    });

    let fragmentTitleOutput: Message[] | undefined;
    let responseOutput: Message[] | undefined;

    if (!isError && hasSummary && hasFiles) {
      try {
        const titleModel = openai({
          model: "google/gemini-2.5-flash-lite",
          apiKey: process.env.AI_GATEWAY_API_KEY!,
          baseUrl: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
          defaultParameters: {
            temperature: 0.3,
          },
        });

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
        console.error("[ERROR] Failed to generate fragment metadata:", gatewayError);
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
        console.log(`[DEBUG] Deduplicated ${screenshots.length - uniqueScreenshots.length} duplicate screenshots`);
      }

      if (uniqueScreenshots.length > MAX_SCREENSHOTS) {
        console.warn(`[WARN] Screenshot count (${uniqueScreenshots.length}) exceeds limit (${MAX_SCREENSHOTS}), keeping first ${MAX_SCREENSHOTS}`);
        return uniqueScreenshots.slice(0, MAX_SCREENSHOTS);
      }

      return uniqueScreenshots;
    });

    const allSandboxFiles = await step.run("read-all-sandbox-files", async () => {
      if (isError) {
        return {};
      }

      try {
        const sandbox = await getSandbox(sandboxId);
        const findCommand = getFindCommand(selectedFramework);
        const findResult = await sandbox.commands.run(findCommand);

        const filePaths = findResult.stdout
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.includes('Permission denied'));

        console.log(`[DEBUG] Found ${filePaths.length} files in sandbox`);

        if (filePaths.length === 0) {
          console.warn("[WARN] No files found in sandbox");
          return {};
        }

        const startTime = Date.now();
        const allFilesMap = await readFilesInBatches(sandbox, filePaths, FILE_READ_BATCH_SIZE);
        const duration = Date.now() - startTime;

        console.log(`[DEBUG] Successfully read ${Object.keys(allFilesMap).length} files from sandbox in ${duration}ms`);
        return allFilesMap;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[ERROR] Failed to read all sandbox files:", errorMessage);
        return {};
      }
    });

    const agentFiles = result.state.data.files || {};

    const mergeValidation = validateMergeStrategy(agentFiles, allSandboxFiles);

    if (mergeValidation.warnings.length > 0) {
      console.warn(`[WARN] Merge strategy warnings: ${mergeValidation.warnings.join('; ')}`);
    }

    // Merge strategy: Agent files take priority over sandbox files
    // This ensures that any files explicitly created/modified by the agent
    // overwrite the corresponding files from the sandbox filesystem.
    // This is intentional as agent files represent the final state of the project.
    // Critical files from sandbox are preserved if not in agent files.
    const mergedFiles = { ...allSandboxFiles, ...agentFiles };

    const overwrittenFiles = Object.keys(agentFiles).filter(path => allSandboxFiles[path] !== undefined);
    if (overwrittenFiles.length > 0) {
      console.log(`[DEBUG] Agent files overwriting ${overwrittenFiles.length} sandbox files: ${overwrittenFiles.slice(0, 5).join(', ')}${overwrittenFiles.length > 5 ? '...' : ''}`);
    }

    // Validate all file paths in merged files to prevent path traversal
    const validatedMergedFiles: Record<string, string> = {};
    let invalidPathCount = 0;

    for (const [path, content] of Object.entries(mergedFiles)) {
      if (isValidFilePath(path)) {
        validatedMergedFiles[path] = content;
      } else {
        invalidPathCount++;
        console.warn(`[WARN] Filtered out invalid file path from merged files: ${path}`);
      }
    }

    if (invalidPathCount > 0) {
      console.warn(`[WARN] Filtered out ${invalidPathCount} invalid file paths from merged files`);
    }

    const finalFiles = validatedMergedFiles;

    await step.run("save-result", async () => {
      if (isError) {
        return await convex.mutation(api.messages.createForUser, {
          userId: project.userId,
          projectId: event.data.projectId as Id<"projects">,
          content: "Something went wrong. Please try again.",
          role: "ASSISTANT",
          type: "ERROR",
          status: "COMPLETE",
        });
      }

      const parsedResponse = parseAgentOutput(responseOutput);
      const parsedTitle = parseAgentOutput(fragmentTitleOutput);

      const metadata: FragmentMetadata | undefined =
        allScreenshots.length > 0
          ? { screenshots: allScreenshots }
          : undefined;

      // First create the message
      const messageId = await convex.mutation(api.messages.createForUser, {
        userId: project.userId,
        projectId: event.data.projectId as Id<"projects">,
        content: parsedResponse ?? "Generated code is ready.",
        role: "ASSISTANT",
        type: "RESULT",
        status: "COMPLETE",
      });

      // Then create the fragment for the message
      await convex.mutation(api.messages.createFragment, {
        messageId: messageId as Id<"messages">,
        sandboxId: sandboxId,
        sandboxUrl: sandboxUrl,
        title: parsedTitle ?? "Generated Fragment",
        files: sanitizeJsonForDatabase(finalFiles),
        framework: frameworkToConvexEnum(selectedFramework),
        metadata: metadata ? sanitizeJsonForDatabase(metadata) : undefined,
      });

      return messageId;
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: finalFiles,
      summary: result.state.data.summary,
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
      return await convex.query(api.messages.getFragmentForSystem, {
        fragmentId: event.data.fragmentId as Id<"fragments">,
      });
    });

    if (!fragment) {
      throw new Error("Fragment not found");
    }

    if (!fragment.sandboxId) {
      throw new Error("Fragment has no sandbox");
    }

    const sandboxId = fragment.sandboxId;
    const framework = (fragment.framework?.toLowerCase() || "nextjs") as Framework;

    const sandbox = await step.run("resume-sandbox", async () => {
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
      if (typeof (sandbox as SandboxWithHost).getHost === "function") {
        const host = (sandbox as SandboxWithHost).getHost(getFrameworkPort(framework));
        if (host && host.length > 0) {
          return host.startsWith("http") ? host : `https://${host}`;
        }
      }

      const fallbackHost = `https://${sandboxId}.sandbox.e2b.dev`;
      console.warn("[WARN] Using fallback sandbox host:", fallbackHost);
      return fallbackHost;
    });

    await step.run("update-fragment", async () => {
      return await convex.mutation(api.messages.updateFragmentForSystem, {
        fragmentId: event.data.fragmentId as Id<"fragments">,
        sandboxUrl,
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
      return await convex.query(api.messages.getFragmentForSystem, {
        fragmentId: event.data.fragmentId as Id<"fragments">,
      });
    });

    if (!fragment) {
      throw new Error("Fragment not found");
    }

    if (!fragment.sandboxId) {
      throw new Error("Fragment has no active sandbox");
    }

    const fragmentFramework = (fragment.framework?.toLowerCase() || 'nextjs') as Framework;
    const sandboxId = fragment.sandboxId;

    await step.run("validate-sandbox", async () => {
      try {
        await getSandbox(sandboxId);
      } catch (error) {
        console.error("[ERROR] Sandbox validation failed:", error);
        throw new Error("Sandbox is no longer active. Please refresh the fragment.");
      }
    });

    const toJsonObject = (value: unknown): FragmentMetadata => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {} as FragmentMetadata;
      }

      return { ...(value as FragmentMetadata) };
    };

    const fragmentRecord = fragment as Record<string, unknown>;
    const supportsMetadata = Object.prototype.hasOwnProperty.call(fragmentRecord, "metadata");
    const initialMetadata = supportsMetadata ? toJsonObject(fragmentRecord.metadata) : ({} as FragmentMetadata);

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
      })
    ]);

    const validationErrors = [lintErrors, buildErrors].filter(Boolean).join("\n\n");

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
        summary: (fragmentRecord.metadata as Record<string, unknown>)?.summary as string ?? "",
        files: fragmentFiles,
        selectedFramework: fragmentFramework,
        summaryRetryCount: 0,
      },
      {
        messages: [],
      },
    );

    const frameworkPrompt = getFrameworkPrompt(fragmentFramework);
    const codeAgent = createAgent<AgentState>({
      name: `${fragmentFramework}-error-fix-agent`,
      description: `An expert ${fragmentFramework} coding agent for fixing errors`,
      system: frameworkPrompt,
      model: openai({
        model: "minimax/minimax-m2",
        apiKey: process.env.AI_GATEWAY_API_KEY!,
        baseUrl: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
        defaultParameters: {
          temperature: 0.5,
          frequency_penalty: 0.5,
        },
      }),
      tools: createCodeAgentTools(sandboxId),
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText && network) {
            const containsSummaryTag = lastAssistantMessageText.includes("<task_summary>");
            console.log(
              `[DEBUG] Error-fix agent response received (contains summary tag: ${containsSummaryTag})`
            );
            if (containsSummaryTag) {
              network.state.data.summary = extractSummaryText(lastAssistantMessageText);
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
      router: async ({ network, callCount }) => {
        const summaryText = extractSummaryText(network.state.data.summary ?? "");
        const fileEntries = network.state.data.files ?? {};
        const fileCount = Object.keys(fileEntries).length;

        console.log(`[DEBUG] Error-fix Router: callCount=${callCount}, fileCount=${fileCount}, hasSummary=${summaryText.length > 0}`);

        // Always run the code agent on the first call
        if (callCount === 0) {
          console.log("[DEBUG] First error-fix iteration - running code agent");
          return codeAgent;
        }

        // Only complete if we have BOTH files AND a summary
        if (fileCount > 0 && summaryText.length > 0) {
          console.log("[DEBUG] Error-fix: Files generated and summary present - completing");
          return;
        }

        // If no files yet, always continue
        if (fileCount === 0) {
          console.log("[DEBUG] Error-fix: No files generated yet - continuing with code agent");
          network.state.data.summaryRetryCount = 0;
          return codeAgent;
        }

        // Have files but no summary - retry for summary
        const currentRetry = network.state.data.summaryRetryCount ?? 0;
        if (currentRetry >= 3) {
          console.warn(
            "[WARN] Error-fix agent missing <task_summary> after multiple retries; proceeding with collected fixes."
          );
          return;
        }

        const nextRetry = currentRetry + 1;
        network.state.data.summaryRetryCount = nextRetry;
        console.log(
          `[DEBUG] Error-fix agent missing <task_summary>; retrying (attempt ${nextRetry}).`
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
      const result = await network.run(fixPrompt, { state });

      // Re-run validation checks to verify if errors are actually fixed
      console.log("[DEBUG] Re-running validation checks after error fix...");
      const [newLintErrors, newBuildErrors] = await Promise.all([
        step.run("error-fix-verification-lint-check", async () => {
          return await runLintCheck(sandboxId);
        }),
        step.run("error-fix-verification-build-check", async () => {
          return await runBuildCheck(sandboxId);
        })
      ]);

      const remainingErrors = [newLintErrors, newBuildErrors].filter(Boolean).join("\n\n");

      if (remainingErrors) {
        console.warn("[WARN] Some errors remain after fix attempt:", remainingErrors);
      } else {
        console.log("[DEBUG] All errors resolved!");
      }

      // Ensure all fixed files are written back to the sandbox
      await step.run("sync-fixed-files-to-sandbox", async () => {
        const fixedFiles = result.state.data.files || {};
        const sandbox = await getSandbox(sandboxId);

        console.log("[DEBUG] Writing fixed files back to sandbox:", Object.keys(fixedFiles).length);

        for (const [path, content] of Object.entries(fixedFiles)) {
          try {
            await sandbox.files.write(path, content);
          } catch (error) {
            console.error(`[ERROR] Failed to write file ${path} to sandbox:`, error);
          }
        }

        console.log("[DEBUG] All fixed files synced to sandbox");
      });

      const backupMetadata = await step.run("backup-original-files", async () => {
        if (!supportsMetadata) {
          console.warn("[WARN] Fragment metadata field not available; skipping backup snapshot");
          return null;
        }

        console.log("[DEBUG] Backing up original files before applying fixes");
        const metadata: FragmentMetadata = {
          ...initialMetadata,
          previousFiles: originalFiles,
          fixedAt: new Date().toISOString(),
        };

        await convex.mutation(api.messages.updateFragmentForSystem, {
          fragmentId: event.data.fragmentId as Id<"fragments">,
          metadata: sanitizeJsonForDatabase(metadata),
        });

        return metadata;
      });

      await step.run("update-fragment-files", async () => {
        const metadataUpdate = supportsMetadata
          ? ({
            ...((backupMetadata ?? initialMetadata) as FragmentMetadata),
            previousFiles: originalFiles,
            fixedAt: new Date().toISOString(),
            lastFixSuccess: {
              summary: result.state.data.summary,
              occurredAt: new Date().toISOString(),
            },
          } as FragmentMetadata)
          : null;

        return await convex.mutation(api.messages.updateFragmentForSystem, {
          fragmentId: event.data.fragmentId as Id<"fragments">,
          files: sanitizeJsonForDatabase(result.state.data.files || {}),
          ...(metadataUpdate
            ? {
              metadata: sanitizeJsonForDatabase(metadataUpdate),
            }
            : {}),
        });
      });

      console.log("[DEBUG] Error fix complete");

      return {
        success: true,
        message: remainingErrors ? "Some errors may remain. Please check the sandbox." : "Errors fixed successfully",
        summary: result.state.data.summary,
        remainingErrors: remainingErrors || undefined,
      };
    } catch (error) {
      console.error("[ERROR] Error fix failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const friendlyMessage = errorMessage.toLowerCase().includes("timeout")
        ? "Automatic fix timed out. Please refresh the fragment."
        : "Automatic fix failed. Please review the sandbox and try again.";

      await step.run("record-error-fix-failure", async () => {
        if (!supportsMetadata) {
          console.warn("[WARN] Fragment metadata field not available; skipping failure metadata update");
          return null;
        }

        console.log("[DEBUG] Recording failure details for fragment", event.data.fragmentId);

        let latestMetadata = initialMetadata;
        try {
          const latestFragment = await convex.query(api.messages.getFragmentForSystem, {
            fragmentId: event.data.fragmentId as Id<"fragments">,
          });

          if (latestFragment) {
            const fragmentData = latestFragment as Record<string, unknown>;
            latestMetadata = toJsonObject(fragmentData.metadata);
          }
        } catch (metadataReadError) {
          console.error("[ERROR] Failed to load latest metadata:", metadataReadError);
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
          await convex.mutation(api.messages.updateFragmentForSystem, {
            fragmentId: event.data.fragmentId as Id<"fragments">,
            metadata: sanitizeJsonForDatabase(failureMetadata),
          });
        } catch (metadataError) {
          console.error("[ERROR] Failed to persist failure metadata:", metadataError);
        }

        return failureMetadata;
      });

      return {
        success: false,
        message: friendlyMessage,
        error: errorMessage,
      };
    }
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
        const startedAt = sandbox.startedAt instanceof Date ? sandbox.startedAt.getTime() : new Date(sandbox.startedAt).getTime();

        if (
          sandbox.state === "paused" &&
          Number.isFinite(startedAt) &&
          startedAt <= cutoff
        ) {
          try {
            await Sandbox.kill(sandbox.sandboxId);
            killedSandboxIds.push(sandbox.sandboxId);
            console.log("[DEBUG] Killed sandbox due to age:", sandbox.sandboxId);
          } catch (error) {
            console.error("[ERROR] Failed to kill sandbox", sandbox.sandboxId, error);
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
