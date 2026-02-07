import { tool } from "ai";
import { z } from "zod";
import {
  autumnConfigTemplate,
  getPaymentTemplate,
  paymentEnvExample,
} from "@/lib/payment-templates";
import {
  getDatabaseTemplate,
  databaseEnvExamples,
} from "@/lib/database-templates";
import type { AgentState } from "./types";
import type { ISandboxAdapter } from "@/lib/sandbox-adapter";

export interface ToolContext {
  /** The sandbox adapter. */
  adapter: ISandboxAdapter;
  state: AgentState;
  updateFiles: (files: Record<string, string>) => void;
  onFileCreated?: (path: string, content: string) => void;
  onToolCall?: (tool: string, args: unknown) => void;
  onToolOutput?: (source: "stdout" | "stderr", chunk: string) => void;
}

export function createAgentTools(context: ToolContext) {
  const { adapter, state, updateFiles, onFileCreated, onToolCall, onToolOutput } = context;

  return {
    terminal: tool({
      description: "Use the terminal to run commands",
      inputSchema: z.object({
        command: z.string().describe("The command to execute"),
      }),
      execute: async ({ command }) => {
        console.log("[DEBUG] Terminal tool called with command:", command);
        onToolCall?.("terminal", { command });

        try {
          const result = await adapter.runCommand(command);
          if (result.stdout) onToolOutput?.("stdout", result.stdout);
          if (result.stderr) onToolOutput?.("stderr", result.stderr);
          console.log("[DEBUG] Terminal command completed");
          return result.stdout || result.stderr || "";
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] Terminal command failed:", errorMessage);
          return `Command failed: ${errorMessage}`;
        }
      },
    }),

    createOrUpdateFiles: tool({
      description: "Create or update files in the sandbox",
      inputSchema: z.object({
        files: z.array(
          z.object({
            path: z.string().describe("File path relative to project root"),
            content: z.string().describe("File content"),
          })
        ),
      }),
      execute: async ({ files }) => {
        console.log("[DEBUG] createOrUpdateFiles tool called with", files.length, "files");
        onToolCall?.("createOrUpdateFiles", { files });
        try {
          const updatedFiles = { ...state.files };

          const filesToWrite: Record<string, string> = {};
          for (const file of files) {
            filesToWrite[file.path] = file.content;
            updatedFiles[file.path] = file.content;
            console.log("[DEBUG] Queuing file for write:", file.path, `(${file.content.length} bytes)`);
          }

           // Retry logic for file writes (max 2 attempts)
           let lastError: Error | null = null;
           for (let attempt = 1; attempt <= 2; attempt++) {
             try {
               await adapter.writeFiles(filesToWrite);
               lastError = null;
               break; // Success
             } catch (e) {
               lastError = e instanceof Error ? e : new Error(String(e));
               console.warn(`[WARN] File write attempt ${attempt} failed:`, lastError.message);
               if (attempt < 2) {
                 console.log("[DEBUG] Retrying file write in 2 seconds...");
                 await new Promise(resolve => setTimeout(resolve, 2000));
               }
             }
           }

          if (lastError) {
            throw lastError;
          }

          for (const file of files) {
            onFileCreated?.(file.path, file.content);
          }

          updateFiles(updatedFiles);
          console.log("[INFO] Successfully created/updated", files.length, "file(s)");
          return `Successfully created/updated ${files.length} file(s)`;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] createOrUpdateFiles failed after all retries:", errorMessage);
          return `Error writing files: ${errorMessage}. The sandbox may not be responsive. Please try again.`;
        }
      },
    }),

    readFiles: tool({
      description: "Read files from the sandbox",
      inputSchema: z.object({
        files: z.array(z.string()).describe("Array of file paths to read"),
      }),
      execute: async ({ files }) => {
        console.log("[DEBUG] readFiles tool called with", files.length, "files");
        onToolCall?.("readFiles", { files });
        try {
           const results = await Promise.all(
             files.map(async (file) => {
               const content = await adapter.readFile(file);
               console.log("[DEBUG] Read file:", file, content ? `(${content.length} bytes)` : "(empty or not found)");
               return { path: file, content: content || "" };
             })
           );

          console.log("[INFO] Successfully read", results.length, "file(s)");
          return JSON.stringify(results);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] readFiles failed:", errorMessage);
          return `Error: ${errorMessage}`;
        }
      },
    }),
    paymentTemplates: tool({
      description:
        "Get Stripe + Autumn payment integration templates for a framework",
      inputSchema: z.object({
        framework: z.enum(["nextjs", "react", "vue", "angular", "svelte"]),
      }),
      execute: async ({ framework }) => {
        const template = getPaymentTemplate(framework);
        return JSON.stringify({
          ...template,
          autumnConfigTemplate,
          paymentEnvExample,
        });
      },
    }),

    databaseTemplates: tool({
      description:
        "Get database integration templates (Drizzle+Neon or Convex) with Better Auth for a framework",
      inputSchema: z.object({
        framework: z.enum(["nextjs", "react", "vue", "angular", "svelte"]),
        provider: z.enum(["drizzle-neon", "convex"]),
      }),
      execute: async ({ framework, provider }) => {
        const template = getDatabaseTemplate(provider, framework);
        if (!template) {
          return JSON.stringify({
            error: `Database template not available for ${provider} + ${framework}. Currently only Next.js is supported.`,
            supportedFrameworks: ["nextjs"],
          });
        }
        return JSON.stringify({
          ...template,
          envExample: databaseEnvExamples[provider] || "",
        });
      },
    }),
  };
}
