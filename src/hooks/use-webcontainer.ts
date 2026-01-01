"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WebContainer } from "@webcontainer/api";
import type { Framework } from "@/agents/types";

export type WebContainerStatus = 
  | "idle" 
  | "checking" 
  | "booting" 
  | "ready" 
  | "installing"
  | "starting"
  | "running" 
  | "error" 
  | "unsupported";

export interface BrowserSupport {
  isSupported: boolean;
  hasCrossOriginIsolation: boolean;
  hasSharedArrayBuffer: boolean;
  browserName: string;
  supportLevel: "full" | "limited" | "none";
  reason?: string;
}

export interface UseWebContainerOptions {
  autoStart?: boolean;
  framework?: Framework;
}

export interface UseWebContainerReturn {
  status: WebContainerStatus;
  serverUrl: string | null;
  error: string | null;
  browserSupport: BrowserSupport | null;
  boot: () => Promise<void>;
  loadFiles: (files: Record<string, string>) => Promise<void>;
  startDevServer: () => Promise<string | null>;
  runCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  dispose: () => Promise<void>;
  isReady: boolean;
}

let globalWebContainer: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

function detectBrowserSupport(): BrowserSupport {
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

function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case "nextjs": return 3000;
    case "angular": return 4200;
    case "react":
    case "vue":
    case "svelte": return 5173;
    default: return 3000;
  }
}

function getDevServerCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs": return "npm run dev";
    case "angular": return "npm run start";
    case "react":
    case "vue":
    case "svelte": return "npm run dev";
    default: return "npm run dev";
  }
}

export function useWebContainer(options: UseWebContainerOptions = {}): UseWebContainerReturn {
  const { autoStart = false, framework = "nextjs" } = options;
  
  const [status, setStatus] = useState<WebContainerStatus>("idle");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserSupport, setBrowserSupport] = useState<BrowserSupport | null>(null);
  
  const containerRef = useRef<WebContainer | null>(null);
  const devProcessRef = useRef<{ kill: () => void } | null>(null);

  useEffect(() => {
    const support = detectBrowserSupport();
    setBrowserSupport(support);
    
    if (!support.isSupported) {
      setStatus("unsupported");
      setError(support.reason || "WebContainers not supported");
    }
  }, []);

  const boot = useCallback(async () => {
    if (status === "booting" || status === "ready" || status === "running") {
      return;
    }

    if (browserSupport && !browserSupport.isSupported) {
      setStatus("unsupported");
      return;
    }

    setStatus("booting");
    setError(null);

    try {
      if (globalWebContainer) {
        containerRef.current = globalWebContainer;
        setStatus("ready");
        return;
      }

      if (bootPromise) {
        containerRef.current = await bootPromise;
        setStatus("ready");
        return;
      }

      const { WebContainer } = await import("@webcontainer/api");
      
      bootPromise = WebContainer.boot();
      const container = await bootPromise;
      
      globalWebContainer = container;
      containerRef.current = container;
      
      console.log("[WebContainer] Booted successfully");
      setStatus("ready");
    } catch (err) {
      console.error("[WebContainer] Boot failed:", err);
      setError(err instanceof Error ? err.message : "Failed to boot WebContainer");
      setStatus("error");
      bootPromise = null;
    }
  }, [status, browserSupport]);

  const loadFiles = useCallback(async (files: Record<string, string>) => {
    if (!containerRef.current) {
      throw new Error("WebContainer not initialized");
    }

    const container = containerRef.current;
    
    const dirs = new Set<string>();
    for (const path of Object.keys(files)) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length > 1) {
        let dirPath = "";
        for (let i = 0; i < parts.length - 1; i++) {
          dirPath = dirPath ? `${dirPath}/${parts[i]}` : parts[i];
          dirs.add(dirPath);
        }
      }
    }
    
    const sortedDirs = Array.from(dirs).sort((a, b) => a.split("/").length - b.split("/").length);
    for (const dir of sortedDirs) {
      try {
        await container.fs.mkdir(dir, { recursive: true });
      } catch {
        // Directory may already exist
      }
    }
    
    await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
        await container.fs.writeFile(normalizedPath, content);
      })
    );

    console.log(`[WebContainer] Loaded ${Object.keys(files).length} files`);
  }, []);

  const runCommand = useCallback(async (command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    if (!containerRef.current) {
      throw new Error("WebContainer not initialized");
    }

    const parts = command.split(" ");
    const process = await containerRef.current.spawn(parts[0], parts.slice(1));

    let stdout = "";
    const decoder = new TextDecoder();
    
    const reader = process.output.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = typeof value === "string" ? value : decoder.decode(value as Uint8Array);
      stdout += chunk;
    }

    const exitCode = await process.exit;
    
    return { stdout, stderr: "", exitCode };
  }, []);

  const startDevServer = useCallback(async (): Promise<string | null> => {
    if (!containerRef.current) {
      throw new Error("WebContainer not initialized");
    }

    const container = containerRef.current;
    const port = getFrameworkPort(framework);
    const command = getDevServerCommand(framework);

    setStatus("installing");
    console.log("[WebContainer] Installing dependencies...");
    
    try {
      const installProcess = await container.spawn("npm", ["install"]);
      await installProcess.exit;
    } catch (err) {
      console.error("[WebContainer] Install failed:", err);
    }

    setStatus("starting");
    console.log(`[WebContainer] Starting dev server: ${command}`);

    const parts = command.split(" ");
    const process = await container.spawn(parts[0], parts.slice(1));
    
    devProcessRef.current = {
      kill: () => process.kill(),
    };

    process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
          console.log(`[DevServer] ${text}`);
        },
      })
    );

    return new Promise((resolve) => {
      const unsubscribe = container.on("server-ready", (readyPort: number, url: string) => {
        if (readyPort === port) {
          console.log(`[WebContainer] Server ready at ${url}`);
          setServerUrl(url);
          setStatus("running");
          unsubscribe();
          resolve(url);
        }
      });

      setTimeout(() => {
        unsubscribe();
        if (!serverUrl) {
          setError("Dev server failed to start within timeout");
          setStatus("error");
          resolve(null);
        }
      }, 60000);
    });
  }, [framework, serverUrl]);

  const dispose = useCallback(async () => {
    if (devProcessRef.current) {
      devProcessRef.current.kill();
      devProcessRef.current = null;
    }
    setServerUrl(null);
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (autoStart && browserSupport?.isSupported && status === "idle") {
      boot();
    }
  }, [autoStart, browserSupport, status, boot]);

  useEffect(() => {
    return () => {
      if (devProcessRef.current) {
        devProcessRef.current.kill();
      }
    };
  }, []);

  return {
    status,
    serverUrl,
    error,
    browserSupport,
    boot,
    loadFiles,
    startDevServer,
    runCommand,
    dispose,
    isReady: status === "ready" || status === "running",
  };
}
