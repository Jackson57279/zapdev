import { tool } from "ai";
import { z } from "zod";
import { getSandbox, writeFilesBatch, readFileFast, runCodeCommand } from "./sandbox-utils";
import type { AgentState } from "./types";

export interface ClaudeCodeToolContext {
  sandboxId: string;
  state: AgentState;
  updateFiles: (files: Record<string, string>) => void;
  onFileCreated?: (path: string, content: string) => void;
  onToolCall?: (tool: string, args: unknown) => void;
  onToolOutput?: (source: "stdout" | "stderr", chunk: string) => void;
}

export function createClaudeCodeTools(context: ClaudeCodeToolContext) {
  const { sandboxId, state, updateFiles, onFileCreated, onToolCall, onToolOutput } = context;

  return {
    execute_command: tool({
      description: "Execute a shell command in the sandbox environment. Use for running build scripts, installing packages, or running tests.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
        workingDirectory: z.string().optional().describe("Working directory for the command (defaults to /home/user)"),
      }),
      execute: async ({ command, workingDirectory }) => {
        console.log("[CLAUDE-CODE] execute_command:", command);
        onToolCall?.("execute_command", { command, workingDirectory });

        try {
          const sandbox = await getSandbox(sandboxId);
          const fullCommand = workingDirectory 
            ? `cd ${workingDirectory} && ${command}`
            : command;
          
          const result = await runCodeCommand(sandbox, fullCommand);
          
          if (result.stdout) {
            onToolOutput?.("stdout", result.stdout);
          }
          if (result.stderr) {
            onToolOutput?.("stderr", result.stderr);
          }

          return JSON.stringify({
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] execute_command failed:", errorMessage);
          return JSON.stringify({ error: errorMessage, exitCode: 1 });
        }
      },
    }),

    write_files: tool({
      description: "Write or update multiple files in the sandbox. Use for creating new files or modifying existing ones.",
      inputSchema: z.object({
        files: z.array(
          z.object({
            path: z.string().describe("File path relative to /home/user"),
            content: z.string().describe("Complete file content"),
          })
        ).describe("Array of files to write"),
      }),
      execute: async ({ files }) => {
        console.log("[CLAUDE-CODE] write_files:", files.length, "files");
        onToolCall?.("write_files", { fileCount: files.length, paths: files.map(f => f.path) });

        try {
          const sandbox = await getSandbox(sandboxId);
          const updatedFiles = { ...state.files };
          const filesToWrite: Record<string, string> = {};

          for (const file of files) {
            filesToWrite[file.path] = file.content;
            updatedFiles[file.path] = file.content;
          }

          await writeFilesBatch(sandbox, filesToWrite);

          for (const file of files) {
            onFileCreated?.(file.path, file.content);
          }

          updateFiles(updatedFiles);
          console.log("[CLAUDE-CODE] Successfully wrote", files.length, "files");
          
          return JSON.stringify({
            success: true,
            filesWritten: files.map(f => f.path),
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] write_files failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    read_files: tool({
      description: "Read the contents of one or more files from the sandbox.",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("Array of file paths to read"),
      }),
      execute: async ({ paths }) => {
        console.log("[CLAUDE-CODE] read_files:", paths.length, "files");
        onToolCall?.("read_files", { paths });

        try {
          const sandbox = await getSandbox(sandboxId);
          const results: Array<{ path: string; content: string | null; error?: string }> = [];

          for (const path of paths) {
            try {
              const content = await readFileFast(sandbox, path);
              results.push({ path, content });
            } catch (e) {
              results.push({ 
                path, 
                content: null, 
                error: e instanceof Error ? e.message : String(e) 
              });
            }
          }

          return JSON.stringify(results);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] read_files failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    search_files: tool({
      description: "Search for files matching a pattern or containing specific text in the sandbox.",
      inputSchema: z.object({
        pattern: z.string().optional().describe("File name pattern (glob-style, e.g., '*.tsx')"),
        textSearch: z.string().optional().describe("Text to search for within files"),
        directory: z.string().optional().describe("Directory to search in (defaults to /home/user)"),
      }),
      execute: async ({ pattern, textSearch, directory = "/home/user" }) => {
        console.log("[CLAUDE-CODE] search_files:", { pattern, textSearch, directory });
        onToolCall?.("search_files", { pattern, textSearch, directory });

        try {
          const sandbox = await getSandbox(sandboxId);
          let command: string;

          if (textSearch) {
            command = `grep -rl "${textSearch}" ${directory} --include="${pattern || '*'}" 2>/dev/null | head -50`;
          } else if (pattern) {
            command = `find ${directory} -name "${pattern}" -type f 2>/dev/null | head -50`;
          } else {
            command = `find ${directory} -type f 2>/dev/null | head -50`;
          }

          const result = await runCodeCommand(sandbox, command);
          const files = result.stdout.trim().split('\n').filter(f => f.length > 0);

          return JSON.stringify({
            matches: files,
            count: files.length,
            truncated: files.length >= 50,
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] search_files failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    list_directory: tool({
      description: "List contents of a directory in the sandbox.",
      inputSchema: z.object({
        path: z.string().describe("Directory path to list"),
        recursive: z.boolean().optional().describe("Whether to list recursively"),
      }),
      execute: async ({ path, recursive = false }) => {
        console.log("[CLAUDE-CODE] list_directory:", path, { recursive });
        onToolCall?.("list_directory", { path, recursive });

        try {
          const sandbox = await getSandbox(sandboxId);
          const command = recursive 
            ? `find ${path} -type f 2>/dev/null | head -100`
            : `ls -la ${path} 2>/dev/null`;

          const result = await runCodeCommand(sandbox, command);

          if (recursive) {
            const files = result.stdout.trim().split('\n').filter(f => f.length > 0);
            return JSON.stringify({ files, count: files.length });
          } else {
            return JSON.stringify({ listing: result.stdout });
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] list_directory failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    delete_files: tool({
      description: "Delete files or directories from the sandbox.",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("Paths to delete"),
        recursive: z.boolean().optional().describe("Whether to delete directories recursively"),
      }),
      execute: async ({ paths, recursive = false }) => {
        console.log("[CLAUDE-CODE] delete_files:", paths);
        onToolCall?.("delete_files", { paths, recursive });

        try {
          const sandbox = await getSandbox(sandboxId);
          const flag = recursive ? "-rf" : "-f";
          const command = `rm ${flag} ${paths.map(p => `"${p}"`).join(' ')}`;

          const result = await runCodeCommand(sandbox, command);
          
          const updatedFiles = { ...state.files };
          for (const path of paths) {
            delete updatedFiles[path];
          }
          updateFiles(updatedFiles);

          return JSON.stringify({
            success: result.exitCode === 0,
            deleted: paths,
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] delete_files failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    get_file_info: tool({
      description: "Get metadata about a file (size, permissions, modification time).",
      inputSchema: z.object({
        path: z.string().describe("Path to the file"),
      }),
      execute: async ({ path }) => {
        console.log("[CLAUDE-CODE] get_file_info:", path);
        onToolCall?.("get_file_info", { path });

        try {
          const sandbox = await getSandbox(sandboxId);
          const result = await runCodeCommand(sandbox, `stat "${path}" 2>/dev/null`);

          if (result.exitCode !== 0) {
            return JSON.stringify({ error: "File not found", path });
          }

          return JSON.stringify({ info: result.stdout });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[CLAUDE-CODE] get_file_info failed:", errorMessage);
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),
  };
}
