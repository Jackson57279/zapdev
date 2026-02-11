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

    listFiles: tool({
      description: "List files and directories in a given path. Use this to explore the project structure before reading files.",
      inputSchema: z.object({
        path: z.string().describe("Directory path to list (relative to project root)"),
        recursive: z.boolean().optional().describe("If true, lists files recursively (use sparingly for large directories)"),
      }),
      execute: async ({ path, recursive }) => {
        console.log("[DEBUG] listFiles tool called for path:", path);
        onToolCall?.("listFiles", { path, recursive });
        try {
          const command = recursive 
            ? `find ${path} -type f 2>/dev/null | head -50`
            : `ls -la ${path} 2>/dev/null`;
          const result = await adapter.runCommand(command);
          const output = result.stdout || result.stderr || "";
          console.log("[INFO] Listed files in", path);
          return output;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] listFiles failed:", errorMessage);
          return `Error listing files: ${errorMessage}`;
        }
      },
    }),

    searchFiles: tool({
      description: "Search for files containing a pattern. Useful for finding imports, function definitions, or specific code patterns across the project.",
      inputSchema: z.object({
        pattern: z.string().describe("Pattern to search for (regex or string)"),
        filePattern: z.string().optional().describe("File glob pattern to limit search (e.g., '*.tsx', '*.ts')"),
        path: z.string().optional().describe("Directory path to search in (default: project root)"),
      }),
      execute: async ({ pattern, filePattern, path }) => {
        console.log("[DEBUG] searchFiles tool called with pattern:", pattern);
        onToolCall?.("searchFiles", { pattern, filePattern, path });
        try {
          const searchPath = path || ".";
          const includePattern = filePattern ? `--include="${filePattern}"` : "";
          const command = `grep -r ${includePattern} -l "${pattern}" ${searchPath} 2>/dev/null | head -20`;
          const result = await adapter.runCommand(command);
          const files = result.stdout.split("\n").filter(f => f.trim());
          console.log("[INFO] Found", files.length, "files matching pattern");
          return JSON.stringify({ files, count: files.length });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] searchFiles failed:", errorMessage);
          return JSON.stringify({ files: [], count: 0, error: errorMessage });
        }
      },
    }),

    installDependencies: tool({
      description: "Install npm/bun/pnpm dependencies. Automatically detects package manager from lock files.",
      inputSchema: z.object({
        packages: z.array(z.string()).describe("Package names to install"),
        dev: z.boolean().optional().describe("If true, installs as dev dependencies"),
      }),
      execute: async ({ packages, dev }) => {
        console.log("[DEBUG] installDependencies tool called for", packages.length, "packages");
        onToolCall?.("installDependencies", { packages, dev });
        try {
          const pkgManagerCmd = await adapter.runCommand("test -f bun.lock && echo 'bun' || test -f pnpm-lock.yaml && echo 'pnpm' || echo 'npm'");
          const pkgManager = pkgManagerCmd.stdout.trim();
          const devFlag = dev ? (pkgManager === "npm" ? "--save-dev" : "--dev") : "";
          const command = `${pkgManager} install ${devFlag} ${packages.join(" ")}`;
          console.log("[INFO] Running:", command);
          const result = await adapter.runCommand(command);
          if (result.stdout) onToolOutput?.("stdout", result.stdout);
          if (result.stderr) onToolOutput?.("stderr", result.stderr);
          return `Installed ${packages.length} package(s) with ${pkgManager}`;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] installDependencies failed:", errorMessage);
          return `Error installing packages: ${errorMessage}`;
        }
      },
    }),

    runBuildAndLint: tool({
      description: "Run both build and lint checks in parallel. Returns combined results for faster validation.",
      inputSchema: z.object({
        framework: z.enum(["nextjs", "react", "vue", "angular", "svelte"]).describe("Framework to determine build command"),
      }),
      execute: async ({ framework }) => {
        console.log("[DEBUG] runBuildAndLint tool called for", framework);
        onToolCall?.("runBuildAndLint", { framework });
        try {
          const buildCmd = framework === "nextjs" ? "npm run build" : "npm run build";
          const lintCmd = "npm run lint";
          
          const [buildResult, lintResult] = await Promise.allSettled([
            adapter.runCommand(buildCmd),
            adapter.runCommand(lintCmd),
          ]);

          const results = {
            build: buildResult.status === "fulfilled" 
              ? { success: true, output: buildResult.value.stdout, error: buildResult.value.stderr }
              : { success: false, error: buildResult.reason?.message || "Build failed" },
            lint: lintResult.status === "fulfilled"
              ? { success: true, output: lintResult.value.stdout, error: lintResult.value.stderr }
              : { success: false, error: lintResult.reason?.message || "Lint failed" },
          };

          const hasErrors = !results.build.success || !results.lint.success;
          if (hasErrors) {
            const errors = [
              results.build.error || "",
              results.lint.error || "",
            ].filter(Boolean).join("\n");
            console.error("[ERROR] Build/lint failed:", errors.substring(0, 200));
            return `Build/Lint Errors:\n${errors}`;
          }

          console.log("[INFO] Build and lint completed successfully");
          return "Build and lint checks passed successfully";
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] runBuildAndLint failed:", errorMessage);
          return `Error: ${errorMessage}`;
        }
      },
    }),

    getFileStructure: tool({
      description: "Get a quick overview of the project structure including key config files. Returns package.json, tsconfig.json, and directory listing in one call.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log("[DEBUG] getFileStructure tool called");
        onToolCall?.("getFileStructure", {});
        try {
          const [packageJson, tsconfigJson, dirListing] = await Promise.allSettled([
            adapter.readFile("package.json"),
            adapter.readFile("tsconfig.json"),
            adapter.runCommand("ls -la"),
          ]);

          const result = {
            packageJson: packageJson.status === "fulfilled" ? JSON.parse(packageJson.value || "{}") : null,
            tsconfigJson: tsconfigJson.status === "fulfilled" ? JSON.parse(tsconfigJson.value || "{}") : null,
            rootFiles: dirListing.status === "fulfilled" ? dirListing.value.stdout : "",
          };

          console.log("[INFO] Retrieved file structure overview");
          return JSON.stringify(result, null, 2);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[ERROR] getFileStructure failed:", errorMessage);
          return `Error: ${errorMessage}`;
        }
      },
    }),
  };
}
