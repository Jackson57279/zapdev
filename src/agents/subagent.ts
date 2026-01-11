import { generateText } from "ai";
import { getClientForModel } from "./client";
import { MODEL_CONFIGS } from "./types";

export type ResearchTaskType = "research" | "documentation" | "comparison";

export interface SubagentRequest {
  taskId: string;
  taskType: ResearchTaskType;
  query: string;
  sources?: string[];
  maxResults?: number;
  timeout?: number;
}

export interface SubagentResponse {
  taskId: string;
  status: "complete" | "timeout" | "error" | "partial";
  findings?: {
    summary: string;
    keyPoints: string[];
    examples?: Array<{ code: string; description: string }>;
    sources: Array<{ url: string; title: string; snippet: string }>;
  };
  comparisonResults?: {
    items: Array<{ name: string; pros: string[]; cons: string[] }>;
    recommendation: string;
  };
  error?: string;
  elapsedTime: number;
}

export interface ResearchDetection {
  needs: boolean;
  taskType: ResearchTaskType | null;
  query: string | null;
}

export function detectResearchNeed(prompt: string): ResearchDetection {
  // Truncate input to prevent ReDoS attacks
  const truncatedPrompt = prompt.slice(0, 1000);
  const lowercasePrompt = truncatedPrompt.toLowerCase();
  
  const researchPatterns: Array<{ pattern: RegExp; type: ResearchTaskType }> = [
    { pattern: /look\s+up/i, type: "research" },
    { pattern: /research/i, type: "research" },
    { pattern: /find\s+(documentation|docs|info|information|examples)/i, type: "documentation" },
    { pattern: /check\s+(docs|documentation)/i, type: "documentation" },
    { pattern: /how\s+does\s+(\w+\s+)?work/i, type: "research" },
    { pattern: /latest\s+version/i, type: "research" },
    { pattern: /compare\s+(?:(?!\s+(?:vs|versus|and)\s+).){1,200}?\s+(vs|versus|and)\s+/i, type: "comparison" },
    { pattern: /search\s+for|find\s+(info|documentation|docs|examples?)/i, type: "research" },
    { pattern: /best\s+practices/i, type: "research" },
    { pattern: /how\s+to\s+use/i, type: "documentation" },
  ];

  for (const { pattern, type } of researchPatterns) {
    const match = lowercasePrompt.match(pattern);
    if (match) {
      return {
        needs: true,
        taskType: type,
        query: extractResearchQuery(truncatedPrompt),
      };
    }
  }

  return {
    needs: false,
    taskType: null,
    query: null,
  };
}

function extractResearchQuery(prompt: string): string {
  // Truncate input to prevent ReDoS attacks
  const truncatedPrompt = prompt.slice(0, 500);

  const researchPhrases = [
    /research\s+(.{1,200}?)(?:\.|$)/i,
    /look up\s+(.{1,200}?)(?:\.|$)/i,
    /find\s+(?:documentation|docs|info|information)\s+(?:for|about)\s+(.{1,200}?)(?:\.|$)/i,
    /how (?:does|do|to)\s+(.{1,200}?)(?:\?|$)/i,
    /compare\s+(.{1,200}?)\s+(?:vs|versus|and)/i,
    /best\s+practices\s+(?:for|of)\s+(.{1,200}?)(?:\.|$)/i,
  ];

  for (const pattern of researchPhrases) {
    const match = truncatedPrompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return truncatedPrompt.slice(0, 100);
}

export function shouldUseSubagent(
  modelId: keyof typeof MODEL_CONFIGS,
  prompt: string
): boolean {
  const config = MODEL_CONFIGS[modelId];
  
  if (!config.supportsSubagents) {
    return false;
  }

  const detection = detectResearchNeed(prompt);
  return detection.needs;
}

const SUBAGENT_MODEL = "morph/morph-v3-large";
const DEFAULT_TIMEOUT = 30_000;
const MAX_RESULTS = 5;

export async function spawnSubagent(
  request: SubagentRequest
): Promise<SubagentResponse> {
  const startTime = Date.now();
  const timeout = request.timeout || DEFAULT_TIMEOUT;
  
  console.log(`[SUBAGENT] Spawning ${SUBAGENT_MODEL} for ${request.taskType} task`);
  console.log(`[SUBAGENT] Query: ${request.query}`);

  try {
    const prompt = buildSubagentPrompt(request);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Subagent timeout")), timeout);
    });

    const generatePromise = generateText({
      model: getClientForModel(SUBAGENT_MODEL).chat(SUBAGENT_MODEL),
      prompt,
      temperature: MODEL_CONFIGS[SUBAGENT_MODEL].temperature,
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const elapsedTime = Date.now() - startTime;

    console.log(`[SUBAGENT] Task completed in ${elapsedTime}ms`);

    const parsedResult = parseSubagentResponse(result.text, request.taskType);

    return {
      taskId: request.taskId,
      status: "complete",
      ...parsedResult,
      elapsedTime,
    };
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[SUBAGENT] Error after ${elapsedTime}ms:`, errorMessage);

    if (errorMessage.includes("timeout")) {
      return {
        taskId: request.taskId,
        status: "timeout",
        error: "Subagent research timed out",
        elapsedTime,
      };
    }

    return {
      taskId: request.taskId,
      status: "error",
      error: errorMessage,
      elapsedTime,
    };
  }
}

function buildSubagentPrompt(request: SubagentRequest): string {
  const { taskType, query, maxResults = MAX_RESULTS } = request;

  const baseInstructions = `You are a research assistant. Your task is to provide accurate, concise information.

IMPORTANT: Format your response as JSON with the following structure:
{
  "summary": "2-3 sentence overview",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "sources": [
    {"url": "https://...", "title": "...", "snippet": "..."}
  ]
}`;

  if (taskType === "research") {
    return `${baseInstructions}

Research Task: ${query}

Find the top ${maxResults} most relevant pieces of information about this topic.
Focus on: latest information, best practices, and practical examples.

Return your findings in the JSON format specified above.`;
  }

  if (taskType === "documentation") {
    return `${baseInstructions}

Documentation Lookup Task: ${query}

Find official documentation and API references for this topic.
Focus on: usage examples, API methods, and code snippets.

Include code examples in this format:
{
  ...,
  "examples": [
    {"code": "...", "description": "..."}
  ]
}

Return your findings in the JSON format specified above.`;
  }

  if (taskType === "comparison") {
    return `You are a research assistant specialized in comparisons.

Comparison Task: ${query}

Compare the options mentioned in the query.

Format your response as JSON:
{
  "summary": "Brief comparison overview",
  "items": [
    {"name": "Option 1", "pros": ["Pro 1", "Pro 2"], "cons": ["Con 1", "Con 2"]},
    {"name": "Option 2", "pros": ["Pro 1", "Pro 2"], "cons": ["Con 1", "Con 2"]}
  ],
  "recommendation": "When to use each option",
  "sources": [
    {"url": "https://...", "title": "...", "snippet": "..."}
  ]
}`;
  }

  return `${baseInstructions}\n\nTask: ${query}`;
}

function parseSubagentResponse(
  responseText: string,
  taskType: ResearchTaskType
): Partial<SubagentResponse> {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[SUBAGENT] No JSON found in response, using fallback parsing");
      return {
        findings: {
          summary: responseText.slice(0, 500),
          keyPoints: extractKeyPointsFallback(responseText),
          sources: [],
        },
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (taskType === "comparison" && parsed.items) {
      return {
        comparisonResults: {
          items: parsed.items || [],
          recommendation: parsed.recommendation || "",
        },
        findings: {
          summary: parsed.summary || "",
          keyPoints: [],
          sources: parsed.sources || [],
        },
      };
    }

    return {
      findings: {
        summary: parsed.summary || "",
        keyPoints: parsed.keyPoints || [],
        examples: parsed.examples || [],
        sources: parsed.sources || [],
      },
    };
  } catch (error) {
    console.error("[SUBAGENT] Failed to parse JSON response:", error);
    return {
      findings: {
        summary: responseText.slice(0, 500),
        keyPoints: extractKeyPointsFallback(responseText),
        sources: [],
      },
    };
  }
}

function extractKeyPointsFallback(text: string): string[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines.slice(0, 5).map((line) => line.trim());
}

export async function spawnParallelSubagents(
  requests: SubagentRequest[]
): Promise<SubagentResponse[]> {
  const MAX_PARALLEL = 3;
  const batches: SubagentRequest[][] = [];
  
  for (let i = 0; i < requests.length; i += MAX_PARALLEL) {
    batches.push(requests.slice(i, i + MAX_PARALLEL));
  }

  const allResults: SubagentResponse[] = [];
  
  for (const batch of batches) {
    console.log(`[SUBAGENT] Spawning ${batch.length} parallel subagents`);
    const results = await Promise.all(batch.map(spawnSubagent));
    allResults.push(...results);
  }

  return allResults;
}
