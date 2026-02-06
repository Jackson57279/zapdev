import { generateText, streamText, stepCountIs } from "ai";
import { Sandbox } from "@e2b/code-interpreter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { getClientForModel, isCerebrasModel } from "./client";
import { createAgentTools } from "./tools";
import { createBraveTools } from "./brave-tools";
import {
  type Framework,
  type AgentState,
  type AgentRunInput,
  type ModelId,
  MODEL_CONFIGS,
  selectModelForTask,
  frameworkToConvexEnum,
} from "./types";
import {
  createSandbox,
  getSandbox,
  runBuildCheck,
  shouldTriggerAutoFix,
  getFindCommand,
  readFilesInBatches,
  isValidFilePath,
  startDevServer,
  cleanNextDirectory,
} from "./sandbox-utils";
import { crawlUrl, type CrawledContent } from "@/lib/firecrawl";
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
import { sanitizeTextForDatabase } from "@/lib/utils";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { cache } from "@/lib/cache";
import { withRateLimitRetry, isRateLimitError, isRetryableError, isServerError, isInvalidRequestError } from "./rate-limit";
import { TimeoutManager, estimateComplexity } from "./timeout-manager";
import { 
  detectResearchNeed, 
  spawnSubagent, 
  spawnParallelSubagents,
  type SubagentRequest,
  type SubagentResponse 
} from "./subagent";

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

const AUTO_FIX_MAX_ATTEMPTS = 1;
const MAX_AGENT_ITERATIONS = 8;
const FRAMEWORK_CACHE_TTL_30_MINUTES = 1000 * 60 * 30;

type FragmentMetadata = Record<string, unknown>;

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

  return "";
};

const isModelNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  if (message.includes("model not found") || message.includes("model_not_found")) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const causeMessage = cause.message.toLowerCase();
    if (causeMessage.includes("model not found") || causeMessage.includes("model_not_found")) {
      return true;
    }
  }

  return error.name === "GatewayModelNotFoundError";
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

const usesShadcnComponents = (files: Record<string, string>) => {
  return Object.entries(files).some(([path, content]) => {
    if (!path.endsWith(".tsx")) {
      return false;
    }
    return content.includes("@/components/ui/");
  });
};

async function detectFramework(prompt: string): Promise<Framework> {
  const cacheKey = `framework:${prompt.slice(0, 200)}`;

  return cache.getOrCompute(
    cacheKey,
    async () => {
      const { text } = await withRateLimitRetry(
        () => generateText({
          model: getClientForModel("google/gemini-2.5-flash-lite").chat(
            "google/gemini-2.5-flash-lite"
          ),
          system: FRAMEWORK_SELECTOR_PROMPT,
          prompt,
          temperature: 0.3,
        }),
        { context: "detectFramework" }
      );

      const detectedFramework = text.trim().toLowerCase();
      if (
        ["nextjs", "angular", "react", "vue", "svelte"].includes(detectedFramework)
      ) {
        return detectedFramework as Framework;
      }

      return "nextjs";
    },
    FRAMEWORK_CACHE_TTL_30_MINUTES
  );
}

async function generateFragmentMetadata(
  summary: string
): Promise<{ title: string; response: string }> {
  try {
    const [titleResult, responseResult] = await Promise.all([
      withRateLimitRetry(
        () => generateText({
          model: getClientForModel("openai/gpt-5-nano").chat(
            "openai/gpt-5-nano"
          ),
          system: FRAGMENT_TITLE_PROMPT,
          prompt: summary,
          temperature: 0.3,
        }),
        { context: "generateFragmentTitle" }
      ),
      withRateLimitRetry(
        () => generateText({
          model: getClientForModel("openai/gpt-5-nano").chat(
            "openai/gpt-5-nano"
          ),
          system: RESPONSE_PROMPT,
          prompt: summary,
          temperature: 0.3,
        }),
        { context: "generateFragmentResponse" }
      ),
    ]);

    return {
      title: titleResult.text || "Generated Fragment",
      response: responseResult.text || summary,
    };
  } catch (error) {
    console.error("[ERROR] Failed to generate fragment metadata:", error);
    return {
      title: "Generated Fragment",
      response: summary,
    };
  }
}

export interface StreamEvent {
  type:
    | "status"
    | "text"
    | "tool-call"
    | "tool-output"
    | "file-created"
    | "file-updated"
    | "progress"
    | "files"
    | "research-start"
    | "research-complete"
    | "time-budget"
    | "error"
    | "complete";
  data: unknown;
  timestamp?: number;
}

// Type guards for stream events
export function isTextEvent(event: StreamEvent): event is StreamEvent & { type: "text"; data: string } {
  return event.type === "text";
}

export function isFileCreatedEvent(event: StreamEvent): event is StreamEvent & { type: "file-created"; data: { path: string; content: string; size: number } } {
  return event.type === "file-created";
}

export function isToolOutputEvent(event: StreamEvent): event is StreamEvent & { type: "tool-output"; data: { source: "stdout" | "stderr"; chunk: string } } {
  return event.type === "tool-output";
}

export function isToolCallEvent(event: StreamEvent): event is StreamEvent & { type: "tool-call"; data: { tool: string; args: unknown } } {
  return event.type === "tool-call";
}

export async function* runCodeAgent(
  input: AgentRunInput
): AsyncGenerator<StreamEvent> {
  const { projectId, value, model: requestedModel } = input;

  console.log("[INFO] [Agent Run] Received request:", {
    projectId,
    valueLength: value.length,
    model: requestedModel,
    timestamp: new Date().toISOString(),
  });

  console.log("[DEBUG] Starting code-agent with AI SDK");
  console.log("[DEBUG] E2B_API_KEY present:", !!process.env.E2B_API_KEY);
  console.log(
    "[DEBUG] OPENROUTER_API_KEY present:",
    !!process.env.OPENROUTER_API_KEY
  );

  const timeoutManager = new TimeoutManager();
  const complexity = estimateComplexity(value);
  timeoutManager.adaptBudget(complexity);
  
  console.log(`[INFO] Task complexity: ${complexity}`);

  timeoutManager.startStage("initialization");
  yield { type: "status", data: "Initializing project..." };

  try {
    const project = await convex.query(api.projects.getForSystem, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      console.error("[ERROR] Project not found:", projectId);
      throw new Error("Project not found");
    }

    console.log("[INFO] Project loaded:", {
      projectId: project._id,
      framework: project.framework,
      modelPreference: project.modelPreference,
    });
    
    timeoutManager.endStage("initialization");

    let selectedFramework: Framework =
      (project?.framework?.toLowerCase() as Framework) || "nextjs";

    const needsFrameworkDetection = !project?.framework;

    if (needsFrameworkDetection) {
      console.log("[INFO] Framework detection required");
    } else {
      console.log("[INFO] Using existing framework:", selectedFramework);
    }

    yield { type: "status", data: "Setting up environment..." };

    console.log("[DEBUG] Creating sandbox...");
    const [detectedFramework, sandbox] = await Promise.all([
      needsFrameworkDetection ? detectFramework(value) : Promise.resolve(selectedFramework),
      createSandbox(selectedFramework),
    ]);

    console.log("[DEBUG] Sandbox created:", sandbox.sandboxId);

    if (needsFrameworkDetection) {
      selectedFramework = detectedFramework;
      console.log("[INFO] Detected framework:", selectedFramework);

      try {
        await convex.mutation(api.projects.updateForUser, {
          userId: project.userId,
          projectId: projectId as Id<"projects">,
          framework: frameworkToConvexEnum(selectedFramework),
        });
        console.log("[INFO] Framework saved to project");
      } catch (error) {
        console.warn("[WARN] Failed to save framework to project:", error);
      }
    }

    const sandboxId = sandbox.sandboxId;

    const modelPref = project?.modelPreference;
    const isValidModel = (m: string | undefined): m is ModelId =>
      m === "auto" || (m !== undefined && m in MODEL_CONFIGS);
    let validatedModel: ModelId =
      requestedModel || (isValidModel(modelPref) ? modelPref : "auto");

    if (validatedModel !== "auto" && !(validatedModel in MODEL_CONFIGS)) {
      console.warn(
        `[WARN] Invalid model requested: "${validatedModel}". Falling back to "auto".`
      );
      validatedModel = "auto";
    }

    const selectedModel: keyof typeof MODEL_CONFIGS =
      validatedModel === "auto"
        ? selectModelForTask(value, selectedFramework)
        : (validatedModel as keyof typeof MODEL_CONFIGS);

    console.log("[INFO] Selected model:", {
      model: selectedModel,
      name: MODEL_CONFIGS[selectedModel].name,
      provider: MODEL_CONFIGS[selectedModel].provider,
    });

    try {
      await convex.mutation(api.sandboxSessions.create, {
        sandboxId,
        projectId: projectId as Id<"projects">,
        userId: project.userId,
        framework: frameworkToConvexEnum(selectedFramework),
        autoPauseTimeout: 10 * 60 * 1000,
      });
      console.log("[INFO] Sandbox session created");
    } catch (error) {
      console.error("[ERROR] Failed to create sandbox session:", error);
    }

    console.log("[DEBUG] Loading previous messages...");
    const previousMessages = await convex.query(api.messages.listForUser, {
      userId: project.userId,
      projectId: projectId as Id<"projects">,
    });

    console.log("[DEBUG] Loaded", previousMessages.length, "previous messages");

    const contextMessages = previousMessages.slice(-3).map((msg) => ({
      role: msg.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: msg.content,
    }));

    const urls = extractUrls(value).slice(0, 2);
    let crawledContexts: CrawledContent[] = [];

    if (urls.length > 0) {
      console.log("[INFO] Found", urls.length, "URL(s) to crawl:", urls);
      yield { type: "status", data: "Analyzing URLs in prompt..." };

      const crawlResults = await Promise.allSettled(
        urls.map((url) =>
          Promise.race([
            crawlUrl(url),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ])
        )
      );

      crawledContexts = crawlResults
        .filter(
          (r): r is PromiseFulfilledResult<CrawledContent | null> =>
            r.status === "fulfilled" && r.value !== null
        )
        .map((r) => r.value as CrawledContent);

      console.log(
        "[INFO] Successfully crawled",
        crawledContexts.length,
        "URL(s)"
      );
    }

    const crawlMessages = crawledContexts.map((ctx) => ({
      role: "user" as const,
      content: `Crawled context from ${ctx.url}:\n${ctx.content}`,
    }));

    let researchResults: SubagentResponse[] = [];
    const selectedModelConfig = MODEL_CONFIGS[selectedModel];
    
    if (selectedModelConfig.supportsSubagents && !timeoutManager.shouldSkipStage("research")) {
      const researchDetection = detectResearchNeed(value);
      
      if (researchDetection.needs && researchDetection.query) {
        timeoutManager.startStage("research");
        yield { type: "status", data: "Conducting research via subagents..." };
        yield { 
          type: "research-start", 
          data: { 
            taskType: researchDetection.taskType, 
            query: researchDetection.query 
          } 
        };
        
        console.log(`[SUBAGENT] Detected ${researchDetection.taskType} need for: ${researchDetection.query}`);
        
        const subagentRequest: SubagentRequest = {
          taskId: `research_${Date.now()}`,
          taskType: researchDetection.taskType || "research",
          query: researchDetection.query,
          maxResults: 5,
          timeout: 30_000,
        };

        try {
          const result = await spawnSubagent(subagentRequest);
          researchResults.push(result);
          
          yield { 
            type: "research-complete", 
            data: { 
              taskId: result.taskId,
              status: result.status,
              elapsedTime: result.elapsedTime 
            } 
          };
          
          console.log(`[SUBAGENT] Research completed in ${result.elapsedTime}ms`);
        } catch (error) {
          console.error("[SUBAGENT] Research failed:", error);
          yield { type: "status", data: "Research failed, proceeding with internal knowledge..." };
        }
        
        timeoutManager.endStage("research");
      }
    }

    const researchMessages = researchResults
      .filter((r) => r.status === "complete" && r.findings)
      .map((r) => ({
        role: "user" as const,
        content: `Research findings:\n${JSON.stringify(r.findings, null, 2)}`,
      }));

    const state: AgentState = {
      summary: "",
      files: {},
      selectedFramework,
      summaryRetryCount: 0,
    };

    const pendingEvents: StreamEvent[] = [];
    const queueEvent = (event: StreamEvent) => {
      pendingEvents.push({ ...event, timestamp: Date.now() });
    };

    console.log("[DEBUG] Creating agent tools...");
    const baseTools = createAgentTools({
      sandboxId,
      state,
      updateFiles: (files) => {
        state.files = files;
      },
      onFileCreated: (path, content) => {
        console.log("[DEBUG] File created:", path, `(${content.length} bytes)`);
        queueEvent({
          type: "file-created",
          data: {
            path,
            content,
            size: content.length,
          },
        });
      },
      onToolCall: (tool, args) => {
        queueEvent({
          type: "tool-call",
          data: { tool, args },
        });
      },
      onToolOutput: (source, chunk) => {
        if (chunk.includes("error") || chunk.includes("Error")) {
          console.log(`[${source.toUpperCase()}]`, chunk.trim());
        }
        queueEvent({
          type: "tool-output",
          data: { source, chunk },
        });
      },
    });
    
    const braveTools = process.env.BRAVE_SEARCH_API_KEY && selectedModelConfig.supportsSubagents 
      ? createBraveTools() 
      : {};
    
    const tools = { ...baseTools, ...braveTools };

    const frameworkPrompt = getFrameworkPrompt(selectedFramework);
    const modelConfig = MODEL_CONFIGS[selectedModel];

    timeoutManager.startStage("codeGeneration");
    
    const timeoutCheck = timeoutManager.checkTimeout();
    if (timeoutCheck.isEmergency) {
      yield { type: "status", data: timeoutCheck.message || "Emergency: Approaching timeout" };
      console.error("[TIMEOUT]", timeoutCheck.message);
    }

    yield { type: "status", data: `Running ${modelConfig.name} agent...` };
    yield { 
      type: "time-budget", 
      data: { 
        remaining: timeoutManager.getRemaining(), 
        stage: "generating" 
      } 
    };
    console.log("[INFO] Starting AI generation...");

    const messages = [
      ...crawlMessages,
      ...researchMessages,
      ...contextMessages,
      { role: "user" as const, content: value },
    ];

    const modelOptions: Record<string, unknown> = {
      temperature: modelConfig.temperature,
    };

    if (
      modelConfig.supportsFrequencyPenalty &&
      "frequencyPenalty" in modelConfig
    ) {
      modelOptions.frequencyPenalty = modelConfig.frequencyPenalty;
    }

    console.log("[DEBUG] Beginning AI stream...");

    let fullText = "";
    let chunkCount = 0;
    let useGatewayFallbackForStream = false;
    let skipProviderOptions = false;
    let retryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    const FALLBACK_MODEL: keyof typeof MODEL_CONFIGS = "openai/gpt-5.1-codex";
    let currentModel: keyof typeof MODEL_CONFIGS = selectedModel;

    while (retryCount < MAX_STREAM_RETRIES) {
      try {
        const client = getClientForModel(currentModel, { useGatewayFallback: useGatewayFallbackForStream });

        const providerOptions: Record<string, Record<string, unknown>> = {};

        if (!skipProviderOptions && useGatewayFallbackForStream && isCerebrasModel(currentModel)) {
          providerOptions.gateway = { only: ['cerebras'] };
        }

        const result = streamText({
          model: client.chat(currentModel),
          providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions as any : undefined,
          system: frameworkPrompt,
          messages,
          tools,
          stopWhen: stepCountIs(MAX_AGENT_ITERATIONS),
          ...modelOptions,
          onFinish: async ({ text }) => {
            const summaryMatch = extractSummaryText(text);
            if (summaryMatch) {
              state.summary = summaryMatch;
              console.log("[DEBUG] Summary extracted:", summaryMatch.substring(0, 100) + "...");
            }
          },
        });

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            fullText += part.text;
            chunkCount++;
            if (chunkCount % 10 === 0) {
              console.log("[DEBUG] Streamed", chunkCount, "chunks");
              yield {
                type: "progress",
                data: { stage: "generating", chunks: chunkCount },
              };
            }
            yield { type: "text", data: part.text };
          }

          while (pendingEvents.length > 0) {
            const nextEvent = pendingEvents.shift();
            if (nextEvent) {
              yield nextEvent;
            }
          }
        }

        while (pendingEvents.length > 0) {
          const nextEvent = pendingEvents.shift();
          if (nextEvent) {
            yield nextEvent;
          }
        }

        break;
       } catch (streamError) {
         retryCount++;
         const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
         const isRateLimit = isRateLimitError(streamError);
         const isServer = isServerError(streamError);
         const isModelNotFound = isModelNotFoundError(streamError);
         const isInvalidRequest = isInvalidRequestError(streamError);
         const canRetry = isRateLimit || isServer || isInvalidRequest;

         if (isInvalidRequest && retryCount === 1) {
           console.log(`[INVALID-REQUEST] Stream: 400 error on attempt ${retryCount}/${MAX_STREAM_RETRIES}. Retrying without provider options...`);
           skipProviderOptions = true;
           continue;
         }

         if (useGatewayFallbackForStream && isModelNotFound) {
           console.log(`[GATEWAY-FALLBACK] Model not found in gateway for ${selectedModel}. Switching to direct Cerebras API...`);
           useGatewayFallbackForStream = false;
           continue;
         }

         if (
           !useGatewayFallbackForStream &&
           isRateLimit &&
           isCerebrasModel(currentModel)
         ) {
           console.log(`[GATEWAY-FALLBACK] Rate limit hit for ${currentModel}. Switching to Vercel AI Gateway with Cerebras-only routing...`);
           useGatewayFallbackForStream = true;
           continue;
         }

         if (
           useGatewayFallbackForStream &&
           isRateLimit &&
           isCerebrasModel(currentModel)
         ) {
           console.log(`[MODEL-FALLBACK] Gateway also rate limited. Switching to ${FALLBACK_MODEL}...`);
           currentModel = FALLBACK_MODEL;
           useGatewayFallbackForStream = false;
           skipProviderOptions = false;
           continue;
         }

        if (isModelNotFound || retryCount >= MAX_STREAM_RETRIES || !canRetry) {
          console.error(`[ERROR] Stream: ${canRetry ? `All ${MAX_STREAM_RETRIES} attempts failed` : "Non-retryable error"}. Error: ${errorMessage}`);
          throw streamError;
        }

        if (isRateLimit) {
          const waitMs = 60_000;
          console.log(`[RATE-LIMIT] Stream: Rate limit hit on attempt ${retryCount}/${MAX_STREAM_RETRIES}. Waiting 60s...`);
          yield { type: "status", data: `Rate limit hit. Waiting 60 seconds before retry (attempt ${retryCount}/${MAX_STREAM_RETRIES})...` };
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else if (isServer) {
          const backoffMs = 2000 * Math.pow(2, retryCount - 1);
          console.log(`[SERVER-ERROR] Stream: Server error on attempt ${retryCount}/${MAX_STREAM_RETRIES}: ${errorMessage}. Retrying in ${backoffMs / 1000}s...`);
          yield { type: "status", data: `Server error. Retrying in ${backoffMs / 1000}s (attempt ${retryCount}/${MAX_STREAM_RETRIES})...` };
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          const backoffMs = 1000 * Math.pow(2, retryCount - 1);
          console.log(`[ERROR] Stream: Error on attempt ${retryCount}/${MAX_STREAM_RETRIES}: ${errorMessage}. Retrying in ${backoffMs / 1000}s...`);
          yield { type: "status", data: `Error occurred. Retrying in ${backoffMs / 1000}s (attempt ${retryCount}/${MAX_STREAM_RETRIES})...` };
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        fullText = "";
        chunkCount = 0;
        console.log(`[RETRY] Stream: Retrying stream (attempt ${retryCount + 1}/${MAX_STREAM_RETRIES})...`);
        yield { type: "status", data: `Retrying AI generation (attempt ${retryCount + 1}/${MAX_STREAM_RETRIES})...` };
      }
    }

    console.log("[INFO] AI generation complete:", {
      totalChunks: chunkCount,
      totalLength: fullText.length,
    });

    timeoutManager.endStage("codeGeneration");

    const resultText = fullText;
    let summaryText = extractSummaryText(state.summary || resultText || "");

    const hasGeneratedFiles = Object.keys(state.files).length > 0;
    console.log("[INFO] Files generated:", Object.keys(state.files).length);

    if (!summaryText && hasGeneratedFiles) {
      console.log("[DEBUG] No summary detected, requesting explicitly...");
      yield { type: "status", data: "Generating summary..." };

      let summaryUseGatewayFallback = false;
      let summaryRetries = 0;
      const MAX_SUMMARY_RETRIES = 3;
      let followUpResult: { text: string } | null = null;
      let summaryModel: keyof typeof MODEL_CONFIGS = selectedModel;

      while (summaryRetries < MAX_SUMMARY_RETRIES) {
        try {
          const client = getClientForModel(summaryModel, { useGatewayFallback: summaryUseGatewayFallback });

          const providerOptions: Record<string, Record<string, unknown>> = {};

          if (summaryUseGatewayFallback && isCerebrasModel(summaryModel)) {
            providerOptions.gateway = { only: ['cerebras'] };
          }

          followUpResult = await generateText({
            model: client.chat(summaryModel),
            providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions as any : undefined,
            system: frameworkPrompt,
            messages: [
              ...messages,
              {
                role: "assistant" as const,
                content: resultText,
              },
              {
                role: "user" as const,
                content:
                  "You have completed the file generation. Now provide your final <task_summary> tag with a brief description of what was built. This is required to complete the task.",
              },
            ],
            tools,
            stopWhen: stepCountIs(2),
            ...modelOptions,
          });
          summaryText = extractSummaryText(followUpResult.text || "");
          break;
        } catch (error) {
          const lastError = error instanceof Error ? error : new Error(String(error));
          summaryRetries++;

          if (summaryRetries >= MAX_SUMMARY_RETRIES) {
            console.error(`[GATEWAY-FALLBACK] Summary generation failed after ${MAX_SUMMARY_RETRIES} attempts: ${lastError.message}`);
            break;
          }

          if (summaryUseGatewayFallback && isModelNotFoundError(error)) {
            console.log(`[GATEWAY-FALLBACK] Summary model not found in gateway. Switching to direct Cerebras API...`);
            summaryUseGatewayFallback = false;
          } else if (
            isRateLimitError(error) &&
            !summaryUseGatewayFallback &&
            isCerebrasModel(summaryModel)
          ) {
            console.log(`[GATEWAY-FALLBACK] Rate limit hit for summary. Switching to Vercel AI Gateway...`);
            summaryUseGatewayFallback = true;
          } else if (
            isRateLimitError(error) &&
            summaryUseGatewayFallback &&
            isCerebrasModel(summaryModel)
          ) {
            console.log(`[MODEL-FALLBACK] Gateway also rate limited for summary. Switching to ${FALLBACK_MODEL}...`);
            summaryModel = FALLBACK_MODEL;
            summaryUseGatewayFallback = false;
          } else if (isRateLimitError(error)) {
            const waitMs = 60_000;
            console.log(`[GATEWAY-FALLBACK] Gateway rate limit for summary. Waiting ${waitMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          } else {
            const backoffMs = 1000 * Math.pow(2, summaryRetries - 1);
            console.log(`[GATEWAY-FALLBACK] Summary error: ${lastError.message}. Retrying in ${backoffMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      summaryText = extractSummaryText(followUpResult?.text || "");
      if (summaryText) {
        state.summary = summaryText;
        console.log("[DEBUG] Summary generated successfully");
      }
    }

    let validationErrors = "";
    let autoFixAttempts = 0;

    if (hasGeneratedFiles) {
      yield { type: "status", data: "Validating build..." };
      console.log("[INFO] Running build validation...");

      await cleanNextDirectory(sandbox);
      console.log("[DEBUG] Cleaned .next directory");

      const buildErrors = await runBuildCheck(sandbox);
      validationErrors = buildErrors || "";

      if (validationErrors) {
        console.log("[ERROR] Build validation failed:", validationErrors.substring(0, 500));
      } else {
        console.log("[INFO] Build validation passed");
      }

      if (selectedFramework === "nextjs" && !usesShadcnComponents(state.files)) {
        const shadcnError =
          "[ERROR] Missing Shadcn UI usage. Rebuild the UI using components imported from '@/components/ui/*' instead of plain HTML elements.";
        validationErrors = validationErrors
          ? `${validationErrors}\n${shadcnError}`
          : shadcnError;
        console.log("[WARN] Shadcn UI components not detected");
      }
    } else {
      console.warn("[WARN] No files generated, skipping validation");
    }

    let lastErrorMessage = validationErrors || resultText;

    while (
      autoFixAttempts < AUTO_FIX_MAX_ATTEMPTS &&
      (shouldTriggerAutoFix(lastErrorMessage) || validationErrors)
    ) {
      autoFixAttempts += 1;
      console.log("[INFO] Auto-fix attempt", autoFixAttempts, "of", AUTO_FIX_MAX_ATTEMPTS);
      yield {
        type: "status",
        data: `Auto-fixing errors (attempt ${autoFixAttempts}/${AUTO_FIX_MAX_ATTEMPTS})...`,
      };

      const fixPrompt = `CRITICAL BUILD ERROR - FIX REQUIRED (Attempt ${autoFixAttempts}/${AUTO_FIX_MAX_ATTEMPTS})

Your previous code generation resulted in build errors. You MUST fix these errors now.

=== ERROR OUTPUT ===
${validationErrors || lastErrorMessage || "No error details provided."}

=== DEBUGGING STEPS ===
1. READ THE ERROR CAREFULLY: Look for specific file names, line numbers, and error types
2. IDENTIFY THE ROOT CAUSE
3. FIX THE ERROR using createOrUpdateFiles
4. VERIFY YOUR FIX by running: npm run build
5. PROVIDE SUMMARY with <task_summary> once fixed`;

      const fixResult = await withRateLimitRetry(
        () => generateText({
          model: getClientForModel(selectedModel).chat(selectedModel),
          providerOptions: undefined,
          system: frameworkPrompt,
          messages: [
            ...messages,
            { role: "assistant" as const, content: resultText },
            { role: "user" as const, content: fixPrompt },
          ],
          tools,
          stopWhen: stepCountIs(MAX_AGENT_ITERATIONS),
          ...modelOptions,
        }),
        { context: "autoFix" }
      );

      console.log("[DEBUG] Auto-fix generation complete");

      const fixSummary = extractSummaryText(fixResult.text || "");
      if (fixSummary) {
        state.summary = fixSummary;
        summaryText = fixSummary;
        console.log("[DEBUG] Auto-fix summary extracted");
      }

      console.log("[DEBUG] Re-running build check...");
      const newBuildErrors = await runBuildCheck(sandbox);
      validationErrors = newBuildErrors || "";

      if (!validationErrors) {
        console.log("[INFO] All validation errors resolved!");
        break;
      }

      console.log("[ERROR] Validation errors remain:", validationErrors.substring(0, 300));
      lastErrorMessage = validationErrors;
    }

    yield { type: "files", data: state.files };

    const hasFiles = Object.keys(state.files).length > 0;

    if (!summaryText && hasFiles) {
      const previewFiles = Object.keys(state.files).slice(0, 5);
      const remainingCount = Object.keys(state.files).length - previewFiles.length;
      summaryText = `Generated or updated ${Object.keys(state.files).length} file(s): ${previewFiles.join(", ")}${remainingCount > 0 ? ` (and ${remainingCount} more)` : ""}.`;
      console.log("[DEBUG] Generated default summary");
    }

    const criticalErrorReasons: string[] = [];
    const warningReasons: string[] = [];

    if (!hasFiles) {
      criticalErrorReasons.push("no files generated");
    }
    if (!summaryText) {
      criticalErrorReasons.push("no summary available");
    }
    if (validationErrors && hasFiles) {
      warningReasons.push("validation errors detected");
    }
    if (
      selectedFramework === "nextjs" &&
      hasFiles &&
      !usesShadcnComponents(state.files)
    ) {
      warningReasons.push("missing Shadcn UI components");
    }

    const isCriticalError = criticalErrorReasons.length > 0;

    if (isCriticalError) {
      console.error(
        `[ERROR] Generation failed: ${criticalErrorReasons.join(", ")}`
      );
      yield {
        type: "error",
        data: `Generation failed: ${criticalErrorReasons.join(", ")}`,
      };

      try {
        await convex.mutation(api.messages.createForUser, {
          userId: project.userId,
          projectId: projectId as Id<"projects">,
          content: "Something went wrong. Please try again.",
          role: "ASSISTANT",
          type: "ERROR",
          status: "COMPLETE",
        });
        console.log("[INFO] Error message saved to database");
      } catch (error) {
        console.error("[ERROR] Failed to save error message:", error);
      }

      return;
    }

    if (warningReasons.length > 0) {
      console.log("[WARN] Warnings:", warningReasons.join(", "));
    }

    yield { type: "status", data: "Reading sandbox files..." };
    console.log("[DEBUG] Reading sandbox files...");

    const findCommand = getFindCommand(selectedFramework);
    const findResult = await sandbox.commands.run(findCommand);
    const filePaths = findResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.includes("Permission denied"))
      .filter(isValidFilePath);

    console.log("[DEBUG] Found", filePaths.length, "files in sandbox");

    const sandboxFiles = await readFilesInBatches(sandbox, filePaths);
    console.log("[DEBUG] Read", Object.keys(sandboxFiles).length, "files from sandbox");

    const filteredSandboxFiles = filterAIGeneratedFiles(sandboxFiles);
    console.log("[DEBUG] Filtered to", Object.keys(filteredSandboxFiles).length, "files");

    const mergedFiles = { ...filteredSandboxFiles, ...state.files };

    const validatedMergedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(mergedFiles)) {
      if (isValidFilePath(path)) {
        validatedMergedFiles[path] = content;
      }
    }

    console.log("[INFO] Final file count:", Object.keys(validatedMergedFiles).length);

    yield { type: "status", data: "Starting dev server..." };
    console.log("[INFO] Starting dev server...");

    const [sandboxUrl, { title: fragmentTitle, response: responseContent }] =
      await Promise.all([
        startDevServer(sandbox, selectedFramework),
        generateFragmentMetadata(summaryText),
      ]);

    console.log(`[INFO] Dev server URL: ${sandboxUrl}`);
    console.log("[INFO] Fragment metadata generated:", {
      title: fragmentTitle,
      responseLength: responseContent.length,
    });

    const sanitizedResponse = sanitizeTextForDatabase(responseContent);
    const warningsNote =
      warningReasons.length > 0
        ? sanitizeTextForDatabase(
            `\n\n Warning:\n- ${warningReasons.join("\n- ")}`
          )
        : "";
    const finalResponse = sanitizeTextForDatabase(
      `${sanitizedResponse}${warningsNote}`
    );

    const metadata: FragmentMetadata = {
      model: selectedModel,
      modelName: MODEL_CONFIGS[selectedModel].name,
      provider: MODEL_CONFIGS[selectedModel].provider,
      ...(warningReasons.length > 0 && { warnings: warningReasons }),
    };

    console.log("[DEBUG] Saving message to database...");
    const messageId = await convex.mutation(api.messages.createForUser, {
      userId: project.userId,
      projectId: projectId as Id<"projects">,
      content: finalResponse || "Generated code is ready.",
      role: "ASSISTANT",
      type: "RESULT",
      status: "COMPLETE",
    });

    console.log("[DEBUG] Saving fragment to database...");
    await convex.mutation(api.messages.createFragmentForUser, {
      userId: project.userId,
      messageId: messageId as Id<"messages">,
      sandboxId: sandboxId || undefined,
      sandboxUrl: sandboxUrl,
      title: sanitizeTextForDatabase(fragmentTitle) || "Generated Fragment",
      files: validatedMergedFiles,
      framework: frameworkToConvexEnum(selectedFramework),
      metadata: metadata,
    });

    console.log("[INFO] Agent run completed successfully");

    yield {
      type: "complete",
      data: {
        url: sandboxUrl,
        title: fragmentTitle,
        files: validatedMergedFiles,
        summary: summaryText,
        sandboxId,
        framework: selectedFramework,
      },
    };
  } catch (error) {
    console.error("[FATAL ERROR] Agent run failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ERROR] Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    yield {
      type: "error",
      data: `Agent run failed: ${errorMessage}`,
    };

    try {
      const project = await convex.query(api.projects.getForSystem, {
        projectId: projectId as Id<"projects">,
      });

      if (project) {
        await convex.mutation(api.messages.createForUser, {
          userId: project.userId,
          projectId: projectId as Id<"projects">,
          content: `An error occurred: ${errorMessage}`,
          role: "ASSISTANT",
          type: "ERROR",
          status: "COMPLETE",
        });
        console.log("[INFO] Error message saved to database");
      }
    } catch (dbError) {
      console.error("[ERROR] Failed to save error to database:", dbError);
    }

    throw error;
  }
}

export async function runErrorFix(fragmentId: string): Promise<{
  success: boolean;
  message: string;
  summary?: string;
  remainingErrors?: string;
}> {
  const fragment = await convex.query(api.messages.getFragmentById, {
    fragmentId: fragmentId as Id<"fragments">,
  });

  if (!fragment) {
    throw new Error("Fragment not found");
  }

  if (!fragment.sandboxId) {
    throw new Error("Fragment has no active sandbox");
  }

  const message = await convex.query(api.messages.get, {
    messageId: fragment.messageId as Id<"messages">,
  });
  if (!message) {
    throw new Error("Message not found");
  }

  const project = await convex.query(api.projects.getForSystem, {
    projectId: message.projectId as Id<"projects">,
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const fragmentFramework = (fragment.framework?.toLowerCase() ||
    "nextjs") as Framework;
  const sandboxId = fragment.sandboxId;

  let sandbox: Sandbox;
  try {
    sandbox = await getSandbox(sandboxId);
  } catch {
    throw new Error("Sandbox is no longer active. Please refresh the fragment.");
  }

  const fragmentMetadata =
    typeof fragment.metadata === "object" && fragment.metadata !== null
      ? (fragment.metadata as Record<string, unknown>)
      : {};

  const fragmentModel =
    (fragmentMetadata.model as keyof typeof MODEL_CONFIGS) ||
    "anthropic/claude-haiku-4.5";

  // Skip lint check for speed - only run build validation
  const buildErrors = await runBuildCheck(sandbox);

  const validationErrors = buildErrors || "";

  if (!validationErrors) {
    return {
      success: true,
      message: "No errors detected",
    };
  }

  const state: AgentState = {
    summary: "",
    files: fragment.files as Record<string, string>,
    selectedFramework: fragmentFramework,
    summaryRetryCount: 0,
  };

  const tools = createAgentTools({
    sandboxId,
    state,
    updateFiles: (files) => {
      state.files = files;
    },
  });

  const frameworkPrompt = getFrameworkPrompt(fragmentFramework);
  const modelConfig = MODEL_CONFIGS[fragmentModel];

  const fixPrompt = `CRITICAL ERROR FIX REQUEST

The following errors were detected in the application and need to be fixed immediately:

${validationErrors}

REQUIRED ACTIONS:
1. Carefully analyze the error messages to identify the root cause
2. Check for common issues: missing imports, type errors, syntax errors, missing packages
3. Apply the necessary fixes to resolve ALL errors completely
4. Verify the fixes by ensuring the code is syntactically correct
5. Provide a <task_summary> explaining what was fixed`;

  const result = await withRateLimitRetry(
    () => generateText({
      model: getClientForModel(fragmentModel).chat(fragmentModel),
      providerOptions: undefined,
      system: frameworkPrompt,
      messages: [{ role: "user", content: fixPrompt }],
      tools,
      stopWhen: stepCountIs(10),
      temperature: modelConfig.temperature,
    }),
    { context: "runErrorFix" }
  );

  const summaryText = extractSummaryText(result.text || "");
  if (summaryText) {
    state.summary = summaryText;
  }

  // Skip lint check for speed - only run build validation
  const newBuildErrors = await runBuildCheck(sandbox);

  const remainingErrors = newBuildErrors || "";

  for (const [path, content] of Object.entries(state.files)) {
    try {
      await sandbox.files.write(path, content);
    } catch (error) {
      console.error(`[ERROR] Failed to write file ${path}:`, error);
    }
  }

  await convex.mutation(api.messages.createFragmentForUser, {
    userId: project.userId,
    messageId: fragment.messageId,
    sandboxId: fragment.sandboxId || undefined,
    sandboxUrl: fragment.sandboxUrl,
    title: fragment.title,
    files: state.files,
    framework: frameworkToConvexEnum(fragmentFramework),
    metadata: {
      ...fragmentMetadata,
      previousFiles: fragment.files,
      fixedAt: new Date().toISOString(),
    },
  });

  return {
    success: !remainingErrors,
    message: remainingErrors
      ? "Some errors may remain. Please check the sandbox."
      : "Errors fixed successfully",
    summary: state.summary,
    remainingErrors: remainingErrors || undefined,
  };
}
