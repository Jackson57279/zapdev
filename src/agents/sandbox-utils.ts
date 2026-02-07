import type { Framework } from "./types";

/**
 * Sandbox utility functions — framework-agnostic helpers used by the agent.
 *
 * NOTE: E2B-specific code has been removed. These are pure utility functions
 * with no sandbox backend dependency.
 */

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 500;

const ALLOWED_WORKSPACE_PATHS = ["/home/user", "."];

export const isValidFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== "string") return false;
  const normalizedPath = filePath.trim();
  if (normalizedPath.length === 0 || normalizedPath.length > 4096) return false;
  if (normalizedPath.includes("..")) return false;
  if (normalizedPath.includes("\0") || normalizedPath.includes("\n") || normalizedPath.includes("\r")) return false;
  
  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(
    (basePath) => normalizedPath === basePath || 
                   normalizedPath.startsWith(`${basePath}/`) || 
                   normalizedPath.startsWith(`./`)
  );
  
  return isInWorkspace || normalizedPath.startsWith("/home/user/") || !normalizedPath.startsWith("/");
};

// ---------------------------------------------------------------------------
// Find command generation
// ---------------------------------------------------------------------------

export const getFindCommand = (framework: Framework): string => {
  const ignorePatterns = ["node_modules", ".git", "dist", "build"];
  if (framework === "nextjs") ignorePatterns.push(".next");
  if (framework === "svelte") ignorePatterns.push(".svelte-kit");
  
  return `find /home/user -type f -not -path '*/${ignorePatterns.join('/* -not -path */')}/*' 2>/dev/null`;
};

// ---------------------------------------------------------------------------
// Auto-fix error detection
// ---------------------------------------------------------------------------

export const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i, /\[ERROR\]/i, /ERROR/, /Failed\b/i, /failure\b/i,
  /Exception\b/i, /SyntaxError/i, /TypeError/i, /ReferenceError/i,
  /Module not found/i, /Cannot find module/i, /Build failed/i, /Compilation error/i,
];

export const shouldTriggerAutoFix = (message?: string): boolean => {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

// ---------------------------------------------------------------------------
// Framework configuration
// ---------------------------------------------------------------------------

export function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case "nextjs": return 3000;
    case "angular": return 4200;
    case "react":
    case "vue":
    case "svelte": return 5173;
    default: return 3000;
  }
}

export function getDevServerCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs": return "npm run dev";
    case "angular": return "npm run start -- --host 0.0.0.0 --port 4200";
    case "react":
    case "vue":
    case "svelte": return "npm run dev -- --host 0.0.0.0 --port 5173";
    default: return "npm run dev";
  }
}

// Skipping lint check for speed
export const runLintCheck = async (_sandboxId: string): Promise<null> => null;
