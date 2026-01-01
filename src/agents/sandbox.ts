/**
 * Unified Sandbox Abstraction Layer
 * 
 * Provides a common interface for both WebContainer (browser-based, WAY FASTER)
 * and E2B (cloud-based, fallback) code execution environments.
 * 
 * WebContainer is preferred for speed when available:
 * - Chrome/Edge: Full support
 * - Safari/Firefox: Limited support
 * - Requires COOP/COEP headers
 * - Browser-side only, loses state on refresh
 */

import type { Framework } from "./types";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SandboxBackendType = "webcontainer" | "e2b" | "memory";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface FileInfo {
  path: string;
  content: string;
  size: number;
}

export interface SandboxCapabilities {
  supportsNode: boolean;
  supportsPython: boolean;
  supportsBash: boolean;
  supportsBackgroundProcesses: boolean;
  persistsOnRefresh: boolean;
  maxFileSizeMB: number;
}

/**
 * Common interface for all sandbox backends.
 * Both WebContainer and E2B implement this interface.
 */
export interface SandboxBackend {
  readonly id: string;
  readonly type: SandboxBackendType;
  readonly capabilities: SandboxCapabilities;
  
  // File operations
  writeFile(path: string, content: string): Promise<void>;
  writeFiles(files: Record<string, string>): Promise<void>;
  readFile(path: string): Promise<string | null>;
  readFiles(paths: string[]): Promise<Record<string, string>>;
  listFiles(directory?: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;
  
  // Command execution
  runCommand(command: string, options?: CommandOptions): Promise<CommandResult>;
  spawnProcess(command: string, args?: string[]): Promise<ProcessHandle>;
  
  // Server management
  getServerUrl(port: number): Promise<string | null>;
  startDevServer(framework: Framework): Promise<string>;
  
  // Lifecycle
  dispose(): Promise<void>;
  isActive(): boolean;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface ProcessHandle {
  pid: string;
  kill(): Promise<void>;
  onExit(callback: (code: number) => void): void;
}

// ============================================================================
// Browser Detection & Feature Support
// ============================================================================

export interface BrowserSupport {
  isSupported: boolean;
  hasCrossOriginIsolation: boolean;
  hasSharedArrayBuffer: boolean;
  browserName: string;
  supportLevel: "full" | "limited" | "none";
  reason?: string;
}

/**
 * Detect if WebContainers are supported in the current browser environment.
 * Must be called in browser context only.
 */
export function detectBrowserSupport(): BrowserSupport {
  // Server-side: no browser support
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isSupported: false,
      hasCrossOriginIsolation: false,
      hasSharedArrayBuffer: false,
      browserName: "server",
      supportLevel: "none",
      reason: "WebContainers require a browser environment",
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  let browserName = "unknown";
  let supportLevel: "full" | "limited" | "none" = "none";
  
  // Detect browser
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browserName = "chrome";
    supportLevel = "full";
  } else if (ua.includes("edg")) {
    browserName = "edge";
    supportLevel = "full";
  } else if (ua.includes("firefox")) {
    browserName = "firefox";
    supportLevel = "limited";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browserName = "safari";
    supportLevel = "limited";
  }

  // Check for required features
  const hasCrossOriginIsolation = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";

  const isSupported = hasCrossOriginIsolation && hasSharedArrayBuffer && supportLevel !== "none";

  let reason: string | undefined;
  if (!hasCrossOriginIsolation) {
    reason = "Missing Cross-Origin-Isolation headers (COOP/COEP)";
  } else if (!hasSharedArrayBuffer) {
    reason = "SharedArrayBuffer not available";
  } else if (supportLevel === "none") {
    reason = `Browser ${browserName} is not supported`;
  } else if (supportLevel === "limited") {
    reason = `Browser ${browserName} has limited WebContainer support`;
  }

  return {
    isSupported,
    hasCrossOriginIsolation,
    hasSharedArrayBuffer,
    browserName,
    supportLevel,
    reason,
  };
}

/**
 * Check if WebContainers should be preferred based on environment.
 */
export function shouldUseWebContainer(): boolean {
  // Only use WebContainer on client side
  if (typeof window === "undefined") {
    return false;
  }
  
  const support = detectBrowserSupport();
  return support.isSupported && support.supportLevel === "full";
}

// ============================================================================
// Sandbox Session Manager
// ============================================================================

interface SandboxSessionState {
  backend: SandboxBackend | null;
  framework: Framework;
  createdAt: number;
  lastActivity: number;
}

const SANDBOX_SESSIONS = new Map<string, SandboxSessionState>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a sandbox session with automatic backend selection.
 */
export async function getSandboxSession(
  sessionId: string,
  framework: Framework,
  preferredBackend?: SandboxBackendType
): Promise<SandboxBackend> {
  const existing = SANDBOX_SESSIONS.get(sessionId);
  
  if (existing?.backend?.isActive()) {
    existing.lastActivity = Date.now();
    return existing.backend;
  }

  const backendType = preferredBackend ?? (shouldUseWebContainer() ? "webcontainer" : "memory");
  
  const backend = await createSandboxBackend(backendType, framework);
  
  SANDBOX_SESSIONS.set(sessionId, {
    backend,
    framework,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  });

  // Schedule cleanup
  scheduleSessionCleanup(sessionId);

  return backend;
}

export async function createSandboxBackend(
  type: SandboxBackendType,
  framework: Framework
): Promise<SandboxBackend> {
  if (type === "webcontainer") {
    const { createWebContainerBackend } = await import("./webcontainer-utils");
    return createWebContainerBackend(framework);
  } else if (type === "memory") {
    const { createMemoryBackend } = await import("./memory-backend");
    return createMemoryBackend(framework);
  } else {
    const { createE2BBackend } = await import("./e2b-backend");
    return createE2BBackend(framework);
  }
}

/**
 * Schedule automatic cleanup of idle sessions.
 */
function scheduleSessionCleanup(sessionId: string): void {
  setTimeout(async () => {
    const session = SANDBOX_SESSIONS.get(sessionId);
    if (!session) return;

    const idleTime = Date.now() - session.lastActivity;
    if (idleTime >= SESSION_TIMEOUT) {
      console.log(`[Sandbox] Cleaning up idle session: ${sessionId}`);
      await session.backend?.dispose();
      SANDBOX_SESSIONS.delete(sessionId);
    } else {
      // Reschedule check
      scheduleSessionCleanup(sessionId);
    }
  }, SESSION_TIMEOUT);
}

/**
 * Dispose a specific sandbox session.
 */
export async function disposeSandboxSession(sessionId: string): Promise<void> {
  const session = SANDBOX_SESSIONS.get(sessionId);
  if (session?.backend) {
    await session.backend.dispose();
  }
  SANDBOX_SESSIONS.delete(sessionId);
}

/**
 * Dispose all sandbox sessions.
 */
export async function disposeAllSandboxSessions(): Promise<void> {
  const disposals = Array.from(SANDBOX_SESSIONS.entries()).map(async ([id, session]) => {
    try {
      await session.backend?.dispose();
    } catch (error) {
      console.error(`[Sandbox] Error disposing session ${id}:`, error);
    }
  });
  await Promise.all(disposals);
  SANDBOX_SESSIONS.clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

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

export function getInstallCommand(_framework: Framework): string {
  return "bun install";
}

export function getBuildCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs": return "npm run build";
    case "angular": return "npm run build";
    case "react":
    case "vue":
    case "svelte": return "npm run build";
    default: return "npm run build";
  }
}

/**
 * Validate file path for security.
 */
export function isValidFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  const normalized = filePath.trim();
  if (normalized.length === 0 || normalized.length > 4096) return false;
  if (normalized.includes("..")) return false;
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) return false;
  return true;
}

/**
 * Filter out files that shouldn't be included in results.
 */
export function shouldIncludeFile(path: string): boolean {
  const excludePatterns = [
    "node_modules/",
    ".git/",
    ".next/",
    "dist/",
    "build/",
    ".svelte-kit/",
    ".angular/",
    ".cache/",
    ".turbo/",
  ];
  
  return !excludePatterns.some(pattern => path.includes(pattern));
}

// ============================================================================
// Error Detection
// ============================================================================

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
  /Build failed/i,
  /Compilation error/i,
];

export function shouldTriggerAutoFix(message?: string): boolean {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_COUNT = 500;
export const FILE_READ_TIMEOUT_MS = 5000;
