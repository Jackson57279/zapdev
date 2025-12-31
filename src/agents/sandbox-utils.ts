import { Sandbox } from "@e2b/code-interpreter";
import { SANDBOX_TIMEOUT, type Framework } from "./types";

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes (extended from 5 minutes for better reuse)

const clearCacheEntry = (sandboxId: string) => {
  setTimeout(() => {
    SANDBOX_CACHE.delete(sandboxId);
  }, CACHE_EXPIRY);
};

export async function getSandbox(sandboxId: string): Promise<Sandbox> {
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) {
    return cached;
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    SANDBOX_CACHE.set(sandboxId, sandbox);
    clearCacheEntry(sandboxId);

    console.log(
      `[DEBUG] Connected to sandbox ${sandboxId} (auto-resumed if paused)`
    );

    return sandbox;
  } catch (error) {
    console.error("[ERROR] Failed to connect to E2B sandbox:", error);
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("not exist")
    ) {
      console.warn(
        `[WARN] Sandbox ${sandboxId} not found - may be expired or deleted`
      );
    }

    throw new Error(`E2B sandbox connection failed: ${errorMessage}`);
  }
}

export async function createSandbox(framework: Framework): Promise<Sandbox> {
  const template = getE2BTemplate(framework);

  try {
    let sandbox: Sandbox;
    try {
      console.log(
        "[DEBUG] Attempting to create sandbox with template:",
        template
      );
      sandbox = await (Sandbox as any).betaCreate(template, {
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: SANDBOX_TIMEOUT,
        autoPause: true,
      });
    } catch {
      console.log(
        "[DEBUG] Framework template not found, using default 'zapdev' template"
      );
      try {
        sandbox = await (Sandbox as any).betaCreate("zapdev", {
          apiKey: process.env.E2B_API_KEY,
          timeoutMs: SANDBOX_TIMEOUT,
          autoPause: true,
        });
      } catch {
        console.log(
          "[DEBUG] betaCreate not available, falling back to Sandbox.create"
        );
        sandbox = await Sandbox.create("zapdev", {
          apiKey: process.env.E2B_API_KEY,
          timeoutMs: SANDBOX_TIMEOUT,
        });
      }
    }

    console.log("[DEBUG] Sandbox created successfully:", sandbox.sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    SANDBOX_CACHE.set(sandbox.sandboxId, sandbox);
    clearCacheEntry(sandbox.sandboxId);

    return sandbox;
  } catch (error) {
    console.error("[ERROR] Failed to create E2B sandbox:", error);
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox creation failed: ${errorMessage}`);
  }
}

// Clean .next directory before build to avoid permission errors
export async function cleanNextDirectory(sandboxId: string): Promise<void> {
  try {
    const sandbox = await getSandbox(sandboxId);
    await sandbox.commands.run("rm -rf .next 2>/dev/null || true", {
      timeoutMs: 5000,
    });
  } catch (error) {
    console.warn("[WARN] Failed to clean .next directory:", error);
    // Continue anyway - build will overwrite if needed
  }
}

export function getE2BTemplate(framework: Framework): string {
  switch (framework) {
    case "nextjs":
      return "zapdev";
    case "angular":
      return "zapdev-angular";
    case "react":
      return "zapdev-react";
    case "vue":
      return "zapdev-vue";
    case "svelte":
      return "zapdev-svelte";
    default:
      return "zapdev";
  }
}

export function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case "nextjs":
      return 3000;
    case "angular":
      return 4200;
    case "react":
    case "vue":
    case "svelte":
      return 5173;
    default:
      return 3000;
  }
}

export function getDevServerCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs":
      return "npm run dev";
    case "angular":
      return "npm run start -- --host 0.0.0.0 --port 4200";
    case "react":
    case "vue":
    case "svelte":
      return "npm run dev -- --host 0.0.0.0 --port 5173";
    default:
      return "npm run dev";
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 500;
const FILE_READ_TIMEOUT_MS = 5000;

const ALLOWED_WORKSPACE_PATHS = ["/home/user", "."];

export const isValidFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }

  const normalizedPath = filePath.trim();

  if (normalizedPath.length === 0 || normalizedPath.length > 4096) {
    return false;
  }

  if (normalizedPath.includes("..")) {
    return false;
  }

  if (
    normalizedPath.includes("\0") ||
    normalizedPath.includes("\n") ||
    normalizedPath.includes("\r")
  ) {
    return false;
  }

  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(
    (basePath) =>
      normalizedPath === basePath ||
      normalizedPath.startsWith(`${basePath}/`) ||
      normalizedPath.startsWith(`./`)
  );

  const isRelativePath = !normalizedPath.startsWith("/");

  return (
    isInWorkspace || normalizedPath.startsWith("/home/user/") || isRelativePath
  );
};

export const readFileWithTimeout = async (
  sandbox: Sandbox,
  filePath: string,
  timeoutMs: number = FILE_READ_TIMEOUT_MS
): Promise<string | null> => {
  if (!isValidFilePath(filePath)) {
    console.warn(`[WARN] Invalid file path detected, skipping: ${filePath}`);
    return null;
  }

  try {
    const readPromise = sandbox.files.read(filePath);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const content = await Promise.race([readPromise, timeoutPromise]);

    if (content === null) {
      console.warn(`[WARN] File read timeout for ${filePath}`);
      return null;
    }

    if (typeof content === "string" && content.length > MAX_FILE_SIZE) {
      console.warn(
        `[WARN] File ${filePath} exceeds size limit (${content.length} bytes), skipping`
      );
      return null;
    }

    return typeof content === "string" ? content : null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Failed to read file ${filePath}:`, errorMessage);
    return null;
  }
};

export const readFilesInBatches = async (
  sandbox: Sandbox,
  filePaths: string[],
  batchSize: number = 50
): Promise<Record<string, string>> => {
  const allFilesMap: Record<string, string> = {};

  const validFilePaths = filePaths.filter(isValidFilePath);
  const invalidCount = filePaths.length - validFilePaths.length;

  if (invalidCount > 0) {
    console.warn(
      `[WARN] Filtered out ${invalidCount} invalid file paths (path traversal attempts or invalid paths)`
    );
  }

  const totalFiles = Math.min(validFilePaths.length, MAX_FILE_COUNT);

  if (validFilePaths.length > MAX_FILE_COUNT) {
    console.warn(
      `[WARN] File count (${validFilePaths.length}) exceeds limit (${MAX_FILE_COUNT}), reading first ${MAX_FILE_COUNT} files`
    );
  }

  const filesToRead = validFilePaths.slice(0, totalFiles);

  for (let i = 0; i < filesToRead.length; i += batchSize) {
    const batch = filesToRead.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const content = await readFileWithTimeout(sandbox, filePath);
        return { filePath, content };
      })
    );

    for (const { filePath, content } of batchResults) {
      if (content !== null) {
        allFilesMap[filePath] = content;
      }
    }

    console.log(
      `[DEBUG] Processed ${Math.min(i + batchSize, filesToRead.length)}/${filesToRead.length} files`
    );
  }

  return allFilesMap;
};

const escapeShellPattern = (pattern: string): string => {
  return pattern.replace(/'/g, "'\"'\"'");
};

export const getFindCommand = (framework: Framework): string => {
  const baseIgnorePatterns = [
    "*/node_modules/*",
    "*/.git/*",
    "*/dist/*",
    "*/build/*",
  ];

  const frameworkSpecificIgnores: Record<Framework, string[]> = {
    nextjs: ["*/.next/*"],
    angular: ["*/.angular/*"],
    react: [],
    vue: [],
    svelte: ["*/.svelte-kit/*"],
  };

  const ignorePatterns = [
    ...baseIgnorePatterns,
    ...(frameworkSpecificIgnores[framework] || []),
  ];
  const escapedPatterns = ignorePatterns.map(
    (pattern) => `-not -path '${escapeShellPattern(pattern)}'`
  );
  const ignoreFlags = escapedPatterns.join(" ");

  return `find /home/user -type f ${ignoreFlags} 2>/dev/null || find . -type f ${ignoreFlags} 2>/dev/null`;
};

export const runLintCheck = async (
  sandboxId: string
): Promise<string | null> => {
  try {
    const sandbox = await getSandbox(sandboxId);
    const buffers: { stdout: string; stderr: string } = {
      stdout: "",
      stderr: "",
    };

    const result = await sandbox.commands.run("npm run lint", {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      },
    });

    const output = buffers.stdout + buffers.stderr;

    if (result.exitCode === 127) {
      console.warn(
        "[WARN] Lint script not found in package.json, skipping lint check"
      );
      return null;
    }

    if (result.exitCode !== 0 && output.length > 0) {
      if (/error|✖/i.test(output)) {
        console.log("[DEBUG] Lint check found ERRORS:\n", output);
        return output;
      }
      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        console.log("[DEBUG] Lint check found issues:\n", output);
        return output;
      }
    }

    console.log("[DEBUG] Lint check passed with no errors");
    return null;
  } catch (error) {
    console.error("[DEBUG] Lint check failed:", error);
    return null;
  }
};

export const runBuildCheck = async (
  sandboxId: string
): Promise<string | null> => {
  const sandbox = await getSandbox(sandboxId);
  const buffers: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  try {
    const buildCommand = "npm run build";
    console.log("[DEBUG] Running build check with command:", buildCommand);

    const result = await sandbox.commands.run(buildCommand, {
      onStdout: (data: string) => {
        buffers.stdout += data;
      },
      onStderr: (data: string) => {
        buffers.stderr += data;
      },
      timeoutMs: 60000,
    });

    const output = buffers.stdout + buffers.stderr;

    if (result.exitCode === 127) {
      console.warn(
        "[WARN] Build script not found in package.json, skipping build check"
      );
      return null;
    }

    if (result.exitCode !== 0) {
      console.log(
        "[DEBUG] Build check FAILED with exit code:",
        result.exitCode
      );
      console.log("[DEBUG] Build output:\n", output);

      if (AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(output))) {
        return `Build failed with errors:\n${output}`;
      }

      return `Build failed with exit code ${result.exitCode}:\n${output}`;
    }

    console.log("[DEBUG] Build check passed successfully");
    return null;
  } catch (error) {
    const output = buffers.stdout + buffers.stderr;

    console.error("[DEBUG] Build check failed with exception:", error);
    console.log("[DEBUG] Build output from buffers:\n", output);

    if (output && output.trim().length > 0) {
      const lines = output.split("\n");
      const errorLines = lines.filter(
        (line: string) =>
          AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(line)) ||
          line.includes("Error:") ||
          line.includes("error ") ||
          line.includes("ERROR")
      );

      if (errorLines.length > 0) {
        return `Build failed with errors:\n${errorLines.join("\n")}\n\nFull output:\n${output}`;
      }

      return `Build failed with errors:\n${output}`;
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return `Build check exception: ${errorMessage}`;
  }
};

export const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i,
  /\[ERROR\]/i,
  /ERROR/,
  /Failed\b/i,
  /failure\b/i,
  /Exception\b/i,
  /SyntaxError/i,
  /TypeError/i,
  /ReferenceError/i,
  /Module not found/i,
  /Cannot find module/i,
  /Failed to resolve/i,
  /Build failed/i,
  /Compilation error/i,
  /undefined is not/i,
  /null is not/i,
  /Cannot read propert/i,
  /is not a function/i,
  /is not defined/i,
  /ESLint/i,
  /Type error/i,
  /TS\d+/i,
  /Parsing.*failed/i,
  /Unexpected token/i,
  /Expected.*identifier/i,
  /ecmascript/i,
];

export const shouldTriggerAutoFix = (message?: string): boolean => {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

type SandboxWithHost = Sandbox & {
  getHost?: (port: number) => string | undefined;
};

export async function getSandboxUrl(
  sandbox: Sandbox,
  framework: Framework
): Promise<string> {
  const port = getFrameworkPort(framework);

  if (typeof (sandbox as SandboxWithHost).getHost === "function") {
    try {
      const host = (sandbox as SandboxWithHost).getHost!(port);
      if (host && host.length > 0) {
        const url = host.startsWith("http") ? host : `https://${host}`;
        console.log("[DEBUG] Using port-based sandbox URL:", url);
        return url;
      }
    } catch (error) {
      console.warn(
        "[WARN] Failed to get port-based URL, using fallback:",
        error
      );
    }
  }

  const fallbackHost = `https://${port}-${sandbox.sandboxId}.e2b.dev`;
  console.log("[DEBUG] Using fallback sandbox URL:", fallbackHost);
  return fallbackHost;
}

export async function startDevServer(
  sandbox: Sandbox,
  framework: Framework
): Promise<string> {
  const port = getFrameworkPort(framework);
  const devCommand = getDevServerCommand(framework);

  console.log(
    `[DEBUG] Starting dev server for ${framework} on port ${port}...`
  );

  sandbox.commands.run(devCommand, { background: true });

  const maxAttempts = 60;
  let serverReady = false;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const checkResult = await sandbox.commands.run(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`,
        { timeoutMs: 3000 }
      );

      const statusCode = checkResult.stdout.trim();
      if (
        statusCode &&
        /^\d{3}$/.test(statusCode) &&
        statusCode !== "000"
      ) {
        serverReady = true;
        console.log(
          `[DEBUG] Dev server ready after ${(i + 1) * 0.5} seconds (status: ${statusCode})`
        );
        break;
      }
    } catch {
      // Server not ready yet, continue waiting
    }
  }

  if (!serverReady) {
    console.warn(
      "[WARN] Dev server did not respond within timeout, using fallback URL"
    );
  }

  return getSandboxUrl(sandbox, framework);
}
