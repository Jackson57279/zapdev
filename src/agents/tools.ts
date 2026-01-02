import { tool } from "ai";
import { z } from "zod";
import { getSandbox, writeFilesBatch, readFileFast } from "./sandbox-utils";
import type { AgentState } from "./types";

export interface ToolContext {
  sandboxId: string;
  state: AgentState;
  updateFiles: (files: Record<string, string>) => void;
  onFileCreated?: (path: string, content: string) => void;
  onToolOutput?: (source: "stdout" | "stderr", chunk: string) => void;
}

export function createAgentTools(context: ToolContext) {
  const { sandboxId, state, updateFiles, onFileCreated, onToolOutput } = context;

  return {
    terminal: tool({
      description: "Use the terminal to run commands",
      inputSchema: z.object({
        command: z.string().describe("The command to execute"),
      }),
      execute: async ({ command }) => {
        const buffers = { stdout: "", stderr: "" };

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
          return result.stdout || buffers.stdout;
        } catch (e) {
          console.error(
            `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
          );
          return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
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
        try {
          const sandbox = await getSandbox(sandboxId);
          const updatedFiles = { ...state.files };

          // Convert array to record for batch writing
          const filesToWrite: Record<string, string> = {};
          for (const file of files) {
            filesToWrite[file.path] = file.content;
            updatedFiles[file.path] = file.content;
          }

          // Use batch write for O(1) API calls instead of O(N)
          await writeFilesBatch(sandbox, filesToWrite);

          // Emit file created events for streaming
          for (const file of files) {
            onFileCreated?.(file.path, file.content);
          }

          updateFiles(updatedFiles);
          return `Successfully created/updated ${files.length} file(s)`;
        } catch (e) {
          return "Error: " + e;
        }
      },
    }),

    readFiles: tool({
      description: "Read files from the sandbox",
      inputSchema: z.object({
        files: z.array(z.string()).describe("Array of file paths to read"),
      }),
      execute: async ({ files }) => {
        try {
          const sandbox = await getSandbox(sandboxId);
          
          // Parallel file reading for speed
          const results = await Promise.all(
            files.map(async (file) => {
              const content = await readFileFast(sandbox, file);
              return { path: file, content: content || "" };
            })
          );

          return JSON.stringify(results);
        } catch (e) {
          return "Error: " + e;
        }
      },
    }),
  };
}
