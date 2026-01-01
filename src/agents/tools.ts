import { tool } from "ai";
import { z } from "zod";
import type { SandboxBackend } from "./sandbox";
import type { AgentState } from "./types";

export interface ToolContext {
  backend: SandboxBackend;
  state: AgentState;
  updateFiles: (files: Record<string, string>) => void;
}

export function createAgentTools(context: ToolContext) {
  const { backend, state, updateFiles } = context;

  return {
    terminal: tool({
      description: "Use the terminal to run commands",
      inputSchema: z.object({
        command: z.string().describe("The command to execute"),
      }),
      execute: async ({ command }) => {
        const buffers = { stdout: "", stderr: "" };

        try {
          const result = await backend.runCommand(command, {
            onStdout: (data: string) => {
              buffers.stdout += data;
            },
            onStderr: (data: string) => {
              buffers.stderr += data;
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
          const updatedFiles = { ...state.files };

          for (const file of files) {
            await backend.writeFile(file.path, file.content);
            updatedFiles[file.path] = file.content;
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
          const contents = [];

          for (const file of files) {
            const content = await backend.readFile(file);
            if (content !== null) {
              contents.push({ path: file, content });
            }
          }

          return JSON.stringify(contents);
        } catch (e) {
          return "Error: " + e;
        }
      },
    }),
  };
}
