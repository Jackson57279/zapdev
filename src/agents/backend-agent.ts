import { generateText } from "ai";
import { openrouter } from "./client";
import { CONVEX_BACKEND_PROMPT } from "@/prompts/backend/convex-backend";

const BACKEND_MODEL = "moonshotai/kimi-k2.5:nitro";

export interface BackendAgentResult {
  files: Record<string, string>;
  success: boolean;
  error?: string;
  summary?: string;
}

export async function runBackendImplementerAgent(
  userPrompt: string,
  schemaProposal: string,
  plan?: string
): Promise<BackendAgentResult> {
  console.log("[BACKEND] Starting implementation...");

  try {
    const augmentedPrompt = [
      "## User Request",
      userPrompt,
      "",
      "## Approved Schema Design",
      schemaProposal,
      "",
      plan ? `## Implementation Plan\n${plan}\n` : "",
      "## Your Task",
      "Generate the complete Convex backend implementation based on the approved schema.",
      "Create all necessary files with their full content.",
      "",
      "Output format:",
      '1. First, output all file contents using <zapdev_file path="convex/schema.ts"> tags',
      "2. Each file should contain the complete, production-ready code",
      "3. End with a <task_summary> describing what was created",
      "",
      "Example:",
      '<zapdev_file path="convex/schema.ts">',
      "// schema content here",
      "</zapdev_file>",
      '<zapdev_file path="convex/tasks/queries.ts">',
      "// queries content here", 
      "</zapdev_file>",
      "",
      "<task_summary>",
      "Created Convex backend with schema and CRUD operations for tasks",
      "</task_summary>",
    ].join("\n");

    const { text } = await generateText({
      model: openrouter(BACKEND_MODEL),
      system: CONVEX_BACKEND_PROMPT,
      prompt: augmentedPrompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const files = parseGeneratedFiles(text);
    
    const summary = text.includes("<task_summary>")
      ? text.match(/<task_summary>([\s\S]*?)<\/task_summary>/)?.[1]?.trim()
      : "Generated Convex backend files";

    if (Object.keys(files).length === 0) {
      return {
        files,
        success: false,
        error: "No files were generated",
        summary,
      };
    }

    console.log("[BACKEND] Completed successfully");

    return {
      files,
      success: true,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[BACKEND] Error:", errorMessage);

    return {
      files: {},
      success: false,
      error: errorMessage,
    };
  }
}

function parseGeneratedFiles(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  const fileRegex = /<zapdev_file path="([^"]+)">([\s\S]*?)<\/zapdev_file>/g;
  let match;
  
  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1];
    const content = match[2].trim();
    files[path] = content;
  }
  
  return files;
}
