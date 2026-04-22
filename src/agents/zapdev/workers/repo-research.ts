import { generateText } from "ai";

import { openrouter } from "../../client";
import { REPO_RESEARCH_PROMPT } from "../prompts";
import { safeParseAIJSON } from "../utils";
import type { RepoResearchInput, ResearchArtifact } from "../types";

const REPO_MODEL = "x-ai/grok-4.1-fast";
const MAX_SNIPPET = 600;

/**
 * For zapdev, repo research operates over a seed of project files
 * (framework boilerplate or prior-session files). The caller provides
 * `projectFiles` so we don't couple this to a specific storage backend.
 */
export async function runRepoResearch(
  input: RepoResearchInput & { projectFiles?: Record<string, string> }
): Promise<ResearchArtifact> {
  const { userMessage, focusAreas, projectFiles = {} } = input;

  const SENSITIVE_SEGMENTS = new Set([".git", "node_modules", "vendor"]);
  const SENSITIVE_FILES = new Set([".env", "env", "credentials"]);

  const isSensitive = (path: string): boolean => {
    const segments = path.split(/[/\\]/);
    const basename = segments.at(-1) ?? "";
    if (basename.startsWith(".")) return true;
    if (SENSITIVE_FILES.has(basename)) return true;
    return segments.some((s) => SENSITIVE_SEGMENTS.has(s));
  };

  const fileEntries = Object.entries(projectFiles).filter(([name]) => !isSensitive(name));
  const fileTree = fileEntries.map(([name]) => `[file] ${name}`).join("\n");
  const keySnippets = fileEntries
    .slice(0, 8)
    .map(([name, content]) => `--- ${name} ---\n${content.slice(0, MAX_SNIPPET)}`)
    .join("\n\n");

  const focusLine = focusAreas.length > 0 ? focusAreas.join(", ") : "general";

  try {
    const { text } = await generateText({
      model: openrouter(REPO_MODEL),
      prompt: `${REPO_RESEARCH_PROMPT}

User request: "${userMessage}"
Focus areas: ${focusLine}

Project files:
${fileTree || "(empty project — fresh generation)"}

Key file contents:
${keySnippets || "(no existing files)"}`,
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

    const parsed = safeParseAIJSON<ResearchArtifact>(text);
    if (parsed?.summary) {
      let relevantFiles = parsed.relevantFiles;
      const isValidRelevantFile = (f: unknown): f is { name: string; snippet: string } =>
        f != null &&
        typeof (f as Record<string, unknown>).name === "string" &&
        typeof (f as Record<string, unknown>).snippet === "string";
      if (Array.isArray(relevantFiles)) {
        relevantFiles = relevantFiles.filter(isValidRelevantFile);
      } else if (typeof relevantFiles === "string") {
        try {
          const parsedArr = JSON.parse(relevantFiles);
          relevantFiles = Array.isArray(parsedArr) ? parsedArr : [];
        } catch {
          relevantFiles = [];
        }
      } else if (relevantFiles != null && typeof relevantFiles === "object") {
        relevantFiles = [relevantFiles as { name: string; snippet: string }];
      } else {
        relevantFiles = [];
      }
      return {
        summary: parsed.summary,
        relevantFiles,
      };
    }
    return { summary: text, relevantFiles: [] };
  } catch (error) {
    console.error("[REPO_RESEARCH] Error:", error);
    return { summary: "", relevantFiles: [] };
  }
}
