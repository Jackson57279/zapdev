"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WebContainerProcess } from "@webcontainer/api";

import {
  getWebContainerInstance,
  releaseWebContainerInstance,
  writeFilesToWebContainer,
  prepareProjectFiles,
  serializeFilesForWebContainer,
  type FileRecord,
} from "@/lib/webcontainer-manager";

interface Props {
  files: Record<string, string>;
  refreshKey: number;
  projectId?: string;
  fragmentId?: string;
  onPreviewUrlChange?: (url: string | null) => void;
  onFilesChange?: (files: Record<string, string>) => void;
}

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const WebContainerPreview = forwardRef<HTMLIFrameElement, Props>(function WebContainerPreview({
  files,
  refreshKey,
  projectId,
  fragmentId,
  onPreviewUrlChange,
  onFilesChange,
}, forwardedRef) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>("Initializing...");
  const [error, setError] = useState<string>("");
  
  const internalRef = useRef<HTMLIFrameElement>(null);
  const runProcessRef = useRef<WebContainerProcess | null>(null);
  const cancelledRef = useRef(false);
  const teardownRef = useRef<(() => void) | null>(null);
  
  const saveFiles = useMutation(api.webcontainerFiles.saveFiles);

  // Prepare files for WebContainer (handles Next.js -> Vite conversion)
  const projectConfig = useMemo(() => {
    // Serialize files to prevent DataCloneError
    const serializedFiles = serializeFilesForWebContainer(files);
    return prepareProjectFiles(serializedFiles);
  }, [files]);

  useEffect(() => {
    cancelledRef.current = false;
    let activeTimeout: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setLoading(true);
      setError("");
      setPreviewUrl("");
      onPreviewUrlChange?.(null);
      setStatus("Booting WebContainer...");

      try {
        // Get WebContainer instance (singleton with retry logic)
        const webcontainer = await getWebContainerInstance();

        // Setup teardown handler
        teardownRef.current = () => {
          runProcessRef.current?.kill();
          runProcessRef.current = null;
        };

        // Listen for server-ready event
        webcontainer.on("server-ready", (_, url) => {
          if (cancelledRef.current) return;
          if (activeTimeout) {
            clearTimeout(activeTimeout);
            activeTimeout = null;
          }
          const validUrl = url ?? "";
          setPreviewUrl(validUrl);
          onPreviewUrlChange?.(validUrl || null);
          setLoading(false);
        });

        // Write all files to WebContainer
        setStatus("Writing files...");
        await writeFilesToWebContainer(webcontainer, projectConfig.files);

        // Save files to Convex backend for persistence
        if (projectId && Object.keys(projectConfig.files).length > 0) {
          try {
            void saveFiles({
              projectId: projectId as Id<"projects">,
              files: projectConfig.files,
              fragmentId: fragmentId as Id<"fragments"> | undefined,
              framework: undefined, // Auto-detected from files
              metadata: {
                source: "webcontainer-preview",
                isViteProject: projectConfig.isViteProject,
                timestamp: Date.now(),
              },
            });
          } catch (saveError) {
            console.warn("[WebContainer] Failed to save files to backend:", saveError);
            // Non-fatal - continue with preview
          }
        }

        if (cancelledRef.current) return;

        // Start the appropriate server based on project type
        if (projectConfig.isViteProject) {
          await startViteServer(webcontainer);
        } else if (projectConfig.isNpmProject) {
          await startNpmProject(webcontainer, projectConfig.files);
        } else if (projectConfig.hasServerEntry) {
          await startServerEntry(webcontainer, projectConfig.files);
        } else {
          await startFallbackServer(webcontainer, projectConfig.files);
        }
      } catch (previewError) {
        if (!cancelledRef.current) {
          setLoading(false);
          const errorMessage = previewError instanceof Error 
            ? previewError.message 
            : String(previewError);
          setError(errorMessage);
          console.error("[WebContainer Preview] Error:", previewError);
        }
      }
    };

    const startViteServer = async (webcontainer: Awaited<ReturnType<typeof getWebContainerInstance>>) => {
      setStatus("Installing dependencies (~30-60s)...");
      
      const installProcess = await webcontainer.spawn("npm", [
        "install",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
        "--legacy-peer-deps",
      ]);

      // Stream install output
      const writable = new WritableStream<string>({
        write(chunk) {
          if (!cancelledRef.current) {
            const text = String(chunk).trim();
            // Show last 60 chars of progress
            setStatus(`Installing… ${text.slice(-60)}`);
          }
        },
      });
      
      installProcess.output.pipeTo(writable).catch(() => {
        // Stream errors are non-fatal
      });

      const installCode = await installProcess.exit;
      if (cancelledRef.current) return;
      
      if (installCode !== 0) {
        throw new Error("npm install failed — check your package.json");
      }

      setStatus("Starting Vite dev server...");
      runProcessRef.current = await webcontainer.spawn("npx", [
        "vite",
        "--host",
        "--port",
        "3000",
      ]);

      // 3 minute timeout for Vite + npm install
      activeTimeout = setTimeout(() => {
        if (cancelledRef.current) return;
        setLoading(false);
        setError("Preview timed out. Vite dev server did not start within 3 minutes.");
      }, 180_000);
    };

    const startNpmProject = async (
      webcontainer: Awaited<ReturnType<typeof getWebContainerInstance>>,
      files: FileRecord
    ) => {
      setStatus("Installing dependencies...");
      
      const packageJson = safeParseJson<{ scripts?: Record<string, string> }>(files["package.json"]);
      const hasDevScript = Boolean(packageJson?.scripts?.dev);
      
      const installProcess = await webcontainer.spawn("npm", [
        "install",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
      ]);
      
      await installProcess.exit;
      if (cancelledRef.current) return;

      setStatus("Starting server...");
      runProcessRef.current = hasDevScript
        ? await webcontainer.spawn("npm", ["run", "dev"])
        : await webcontainer.spawn("node", ["server.mjs"]);

      activeTimeout = setTimeout(() => {
        if (cancelledRef.current) return;
        setLoading(false);
        setError("Preview timed out before server became ready.");
      }, 120_000);
    };

    const startServerEntry = async (
      webcontainer: Awaited<ReturnType<typeof getWebContainerInstance>>,
      files: FileRecord
    ) => {
      setStatus("Starting server...");
      const entry = "server.mjs" in files ? "server.mjs" : "server.js";
      runProcessRef.current = await webcontainer.spawn("node", [entry]);

      activeTimeout = setTimeout(() => {
        if (cancelledRef.current) return;
        setLoading(false);
        setError("Preview timed out before server became ready.");
      }, 30_000);
    };

    const startFallbackServer = async (
      webcontainer: Awaited<ReturnType<typeof getWebContainerInstance>>,
      files: FileRecord
    ) => {
      setStatus("Starting preview server...");
      const fileList = Object.keys(files)
        .map((f) => `<li>${f}</li>`)
        .join("");
      
      const inlineServer = `import { createServer } from "node:http"
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(\`<!doctype html><html><head><meta charset="UTF-8"/><title>ZapDev Preview</title></head><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:auto"><h2>Generated Files</h2><ul>${fileList}</ul><p style="color:#666;margin-top:1rem">These files are available in the Code tab.</p></body></html>\`)
})
server.listen(3000, () => console.log("ready"))
`;
      await webcontainer.fs.writeFile("__preview_server.mjs", inlineServer);
      runProcessRef.current = await webcontainer.spawn("node", ["__preview_server.mjs"]);

      activeTimeout = setTimeout(() => {
        if (cancelledRef.current) return;
        setLoading(false);
        setError("Preview server did not start.");
      }, 15_000);
    };

    void run();

    return () => {
      cancelledRef.current = true;
      if (activeTimeout) clearTimeout(activeTimeout);
      onPreviewUrlChange?.(null);
      teardownRef.current?.();
      
      // Release our reference to the WebContainer instance
      void releaseWebContainerInstance();
    };
  }, [projectConfig, projectId, fragmentId, refreshKey, onPreviewUrlChange, saveFiles]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="text-center max-w-xs">{status ?? "Loading..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-8">
        <p className="text-sm text-destructive font-medium">Preview failed</p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Reload Page
        </button>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Waiting for preview URL...
      </div>
    );
  }

  return (
    <iframe
      ref={forwardedRef || internalRef}
      className="h-full w-full"
      sandbox="allow-forms allow-modals allow-scripts allow-same-origin allow-popups"
      loading="lazy"
      src={previewUrl}
      title="WebContainer Preview"
    />
  );
});
