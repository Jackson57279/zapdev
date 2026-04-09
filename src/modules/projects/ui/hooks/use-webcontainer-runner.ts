"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import type { Id } from "@/convex/_generated/dataModel";

const WEB_CONTAINER_RUN_NOTE = "zapdev-webcontainer-run.txt";

// WebContainer type definition based on @webcontainer/api
interface WebContainerInstance {
  fs: {
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
  spawn: (command: string, args?: string[]) => Promise<{ exit: Promise<number> }>;
  teardown: () => void;
}

// Global ref to track WebContainer instance state across hook instances
// This prevents multiple simultaneous boot attempts which cause "Unable to create more instances"
const globalWebContainerState = {
  isBooting: false,
  instance: null as WebContainerInstance | null,
  bootPromise: null as Promise<WebContainerInstance> | null,
};

// Maximum retry attempts for WebContainer boot
const MAX_BOOT_RETRIES = 3;
const BOOT_RETRY_DELAY_MS = 2000;

type Framework = "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE";

const createFallbackFiles = (prompt: string): Record<string, string> => ({
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZapDev WebContainer Preview</title>
  </head>
  <body>
    <h1>WebContainer Run</h1>
    <pre id="prompt"></pre>
    <script>
      document.getElementById("prompt").textContent = ${JSON.stringify(prompt)};
    </script>
  </body>
</html>`,
  "server.mjs": `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3000, () => {
  console.log("server-ready:3000");
});
`,
});

// Sleep utility for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Boot WebContainer with retry logic to handle "Unable to create more instances" errors
const bootWebContainerWithRetry = async (retries = MAX_BOOT_RETRIES): Promise<WebContainerInstance> => {
  const { WebContainer } = await import("@webcontainer/api");
   
  // Check if already booting - wait for existing boot
  if (globalWebContainerState.bootPromise) {
    console.log("[WebContainer] Waiting for existing boot process...");
    return globalWebContainerState.bootPromise;
  }
   
  // Check if already have a running instance
  if (globalWebContainerState.instance) {
    console.log("[WebContainer] Reusing existing instance");
    return globalWebContainerState.instance;
  }
   
  // Create boot promise
  globalWebContainerState.isBooting = true;
  globalWebContainerState.bootPromise = (async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[WebContainer] Boot attempt ${attempt}/${retries}...`);
        const webcontainer = await WebContainer.boot() as WebContainerInstance;
        console.log(`[WebContainer] Boot successful on attempt ${attempt}`);
        
        globalWebContainerState.instance = webcontainer;
        return webcontainer;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        
        // Check if this is the "Unable to create more instances" error
        if (errorMessage.includes("Unable to create more instances")) {
          console.warn(`[WebContainer] Instance limit reached on attempt ${attempt}, waiting before retry...`);
          
          // Try to cleanup any existing instance first
          if (globalWebContainerState.instance) {
            try {
              globalWebContainerState.instance.teardown();
              globalWebContainerState.instance = null;
            } catch (cleanupError) {
              console.warn("[WebContainer] Cleanup error:", cleanupError);
            }
          }
          
          if (attempt < retries) {
            // Exponential backoff: 2s, 4s, 8s
            const delay = BOOT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[WebContainer] Retrying in ${delay}ms...`);
            await sleep(delay);
          }
        } else {
          // Different error, throw immediately
          throw lastError;
        }
      }
    }
    
    throw lastError || new Error("Failed to boot WebContainer after maximum retries");
  })();
  
  try {
    const result = await globalWebContainerState.bootPromise;
    if (!result) {
      throw new Error("WebContainer boot returned null");
    }
    return result;
  } finally {
    globalWebContainerState.isBooting = false;
    globalWebContainerState.bootPromise = null;
  }
};

const runInsideWebContainer = async (
  files: Record<string, string>,
  prompt: string
): Promise<Record<string, string>> => {
  const webcontainer = await bootWebContainerWithRetry();

  try {
    for (const [filePath, contents] of Object.entries(files)) {
      const segments = filePath.split("/").filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      if (segments.length > 1) {
        const directoryPath = segments.slice(0, -1).join("/");
        await webcontainer.fs.mkdir(directoryPath, { recursive: true });
      }
      await webcontainer.fs.writeFile(filePath, contents);
    }

    const nodeProcess = await webcontainer.spawn("node", ["-v"]);
    await nodeProcess.exit;

    const runNote = [
      "WebContainer run completed.",
      `Prompt: ${prompt}`,
      `Timestamp: ${new Date().toISOString()}`,
      "Command executed: node -v",
    ].join("\n");

    await webcontainer.fs.writeFile(WEB_CONTAINER_RUN_NOTE, runNote);

    return {
      ...files,
      [WEB_CONTAINER_RUN_NOTE]: runNote,
    };
  } finally {
    // Only teardown if we're not reusing instances
    // Keep instance alive for potential reuse to avoid boot overhead
    // But mark it as available
  }
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getFramework = (value: Framework): Framework => value;

// Cleanup function to teardown WebContainer instance
export const cleanupWebContainer = async (): Promise<void> => {
  if (globalWebContainerState.instance) {
    try {
      console.log("[WebContainer] Cleaning up instance...");
      globalWebContainerState.instance.teardown();
      globalWebContainerState.instance = null;
      globalWebContainerState.bootPromise = null;
      console.log("[WebContainer] Cleanup complete");
    } catch (error) {
      console.error("[WebContainer] Cleanup error:", error);
      // Still clear the state even if teardown failed
      globalWebContainerState.instance = null;
      globalWebContainerState.bootPromise = null;
    }
  }
};

export const useWebContainerRunner = (projectId: string) => {
  const pendingRuns = useQuery(api.agentRuns.listPendingForProject, {
    projectId: projectId as Id<"projects">,
  });
  const claimRun = useMutation(api.agentRuns.claimRun);
  const completeRun = useMutation(api.agentRuns.completeRun);
  const failRun = useMutation(api.agentRuns.failRun);
  const isProcessingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  // Cleanup WebContainer on unmount
  useEffect(() => {
    return () => {
      // Don't immediately cleanup on unmount - other components might need it
      // Instead, let the global state manage the lifecycle
    };
  }, []);

  useEffect(() => {
    if (!pendingRuns || pendingRuns.length === 0 || isProcessingRef.current) {
      return;
    }

    const firstPendingRun = pendingRuns[0];
    if (!firstPendingRun) {
      return;
    }

    isProcessingRef.current = true;
    let activeRunId: Id<"agentRuns"> | null = null;

    const processRun = async () => {
      try {
        const claimed = await claimRun({
          runId: firstPendingRun._id,
        });

        activeRunId = claimed.runId;

        const files =
          Object.keys(claimed.baseFiles).length > 0
            ? claimed.baseFiles
            : createFallbackFiles(claimed.value);
        const updatedFiles = await runInsideWebContainer(files, claimed.value);
        
        // Reset error counter on success
        consecutiveErrorsRef.current = 0;

        await completeRun({
          runId: claimed.runId,
          summary: `WebContainer run finished for prompt: "${claimed.value.slice(0, 120)}"`,
          files: updatedFiles,
          framework: getFramework(claimed.framework),
          metadata: {
            source: "webcontainer-queue",
            mode: "browser",
          },
        });
      } catch (error) {
        consecutiveErrorsRef.current++;
        const errorMessage = normalizeError(error);
        
        console.error("[WebContainer Runner] Error:", errorMessage);
        
        // Check if this is an instance limit error
        if (errorMessage.includes("Unable to create more instances")) {
          console.warn(`[WebContainer Runner] Instance limit error (consecutive: ${consecutiveErrorsRef.current})`);
          
          // If we've had multiple consecutive instance errors, force cleanup
          if (consecutiveErrorsRef.current >= 2) {
            console.log("[WebContainer Runner] Forcing cleanup after multiple instance errors...");
            await cleanupWebContainer();
            consecutiveErrorsRef.current = 0;
          }
        }
        
        if (activeRunId) {
          await failRun({
            runId: activeRunId,
            error: errorMessage,
          });
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    void processRun();
  }, [pendingRuns, claimRun, completeRun, failRun]);
};
