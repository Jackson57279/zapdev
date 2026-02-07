import { useCallback, useRef, useEffect } from "react";
import type { SandboxRequest, SandboxResponse } from "@/lib/sandbox-adapter";
import { WebContainerAdapter } from "@/lib/sandbox-adapter";
import type { Framework } from "@/agents/types";

export function useSandboxExecutor() {
  const adapterRef = useRef<WebContainerAdapter | null>(null);
  const sandboxIdRef = useRef<string | null>(null);

  const getAdapter = useCallback(async (): Promise<WebContainerAdapter> => {
    if (adapterRef.current) return adapterRef.current;
    const { getWebContainer } = await import("@/lib/webcontainer");
    const wc = await getWebContainer();
    adapterRef.current = new WebContainerAdapter(wc);
    return adapterRef.current;
  }, []);

  const handleSandboxRequest = useCallback(
    async (sandboxId: string, request: SandboxRequest) => {
      sandboxIdRef.current = sandboxId;
      let response: SandboxResponse;

      try {
        const adapter = await getAdapter();

        switch (request.type) {
          case "write-files": {
            await adapter.writeFiles(request.files);
            response = { type: "write-files", requestId: request.id, success: true };
            break;
          }
          case "read-file": {
            const content = await adapter.readFile(request.path);
            response = { type: "read-file", requestId: request.id, content };
            break;
          }
          case "run-command": {
            const result = await adapter.runCommand(request.command);
            response = {
              type: "run-command",
              requestId: request.id,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            };
            break;
          }
          case "start-dev-server": {
            const url = await adapter.startDevServer(request.framework as Framework);
            response = { type: "start-dev-server", requestId: request.id, url };
            break;
          }
          case "build-check": {
            const error = await adapter.runBuildCheck();
            response = { type: "build-check", requestId: request.id, error };
            break;
          }
          case "get-preview-url": {
            const url = await adapter.getPreviewUrl(request.framework as Framework);
            response = { type: "get-preview-url", requestId: request.id, url };
            break;
          }
          case "cleanup": {
            await adapter.cleanup();
            adapterRef.current = null;
            response = { type: "cleanup", requestId: request.id, success: true };
            break;
          }
          default: {
            const exhaustiveCheck: never = request;
            response = {
              type: "error",
              requestId: (exhaustiveCheck as SandboxRequest).id,
              error: `Unknown request type: ${(exhaustiveCheck as SandboxRequest).type}`,
            };
          }
        }
      } catch (error) {
        response = {
          type: "error",
          requestId: request.id,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      try {
        await fetch("/api/agent/sandbox-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, response }),
        });
      } catch (postError) {
        console.error("[sandbox-executor] Failed to POST result:", postError);
      }
    },
    [getAdapter]
  );

  const cleanup = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.cleanup().catch(() => {});
      adapterRef.current = null;
    }
    sandboxIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { handleSandboxRequest, cleanup };
}
