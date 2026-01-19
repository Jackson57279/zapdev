import { tool } from "ai";
import { z } from "zod";
import { getSandbox, writeFilesBatch, readFileFast } from "./sandbox-utils";
import {
  autumnConfigTemplate,
  getPaymentTemplate,
  paymentEnvExample,
} from "@/lib/payment-templates";
import type { AgentState } from "./types";

export interface ToolContext {
  sandboxId: string;
  state: AgentState;
  updateFiles: (files: Record<string, string>) => void;
  onFileCreated?: (path: string, content: string) => void;
  onToolCall?: (tool: string, args: unknown) => void;
  onToolOutput?: (source: "stdout" | "stderr", chunk: string) => void;
}

export function createAgentTools(context: ToolContext) {
  const { sandboxId, state, updateFiles, onFileCreated, onToolCall, onToolOutput } = context;

  return {
    terminal: tool({
      description: "Use the terminal to run commands",
      inputSchema: z.object({
        command: z.string().describe("The command to execute"),
      }),
      execute: async ({ command }) => {
        const buffers = { stdout: "", stderr: "" };
        console.log("[DEBUG] Terminal tool called with command:", command);
        onToolCall?.("terminal", { command });

        try {
          const sandbox = await getSandbox(sandboxId);
          const result = await sandbox.commands.run(command, {
            onStdout: (data: string) => {
              buffers.stdout += data;
              onToolOutput?.("stdout", data);
            },
            onStderr: (data: string) => {
              buffers.stderr += data;
              onToolOutput?.("stderr", data);
            },
          });
          console.log("[DEBUG] Terminal command completed");
          return result.stdout || buffers.stdout;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] Terminal command failed:", errorMessage);
          console.error("[ERROR] stdout:", buffers.stdout.substring(0, 500));
          console.error("[ERROR] stderr:", buffers.stderr.substring(0, 500));
          return `Command failed: ${errorMessage} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
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
          const sandbox = await getSandbox(sandboxId);
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
              await writeFilesBatch(sandbox, filesToWrite);
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
          const sandbox = await getSandbox(sandboxId);

          const results = await Promise.all(
            files.map(async (file) => {
              const content = await readFileFast(sandbox, file);
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
  };
}
