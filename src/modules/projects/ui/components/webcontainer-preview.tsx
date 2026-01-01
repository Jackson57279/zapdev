"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ExternalLinkIcon, 
  RefreshCcwIcon, 
  AlertTriangleIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { Doc } from "@/convex/_generated/dataModel";
import { useWebContainer, type WebContainerStatus } from "@/hooks/use-webcontainer";
import type { Framework } from "@/agents/types";

interface Props {
  data: Doc<"fragments">;
}

const STATUS_MESSAGES: Record<WebContainerStatus, string> = {
  idle: "Initializing...",
  checking: "Checking browser support...",
  booting: "Starting WebContainer...",
  ready: "WebContainer ready",
  installing: "Installing dependencies...",
  starting: "Starting dev server...",
  running: "Running",
  error: "Error occurred",
  unsupported: "WebContainer not supported",
};

const STATUS_PROGRESS: Record<WebContainerStatus, number> = {
  idle: 0,
  checking: 10,
  booting: 25,
  ready: 40,
  installing: 60,
  starting: 80,
  running: 100,
  error: 0,
  unsupported: 0,
};

export function WebContainerPreview({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const framework = (data.framework?.toLowerCase() || "nextjs") as Framework;
  
  const {
    status,
    serverUrl,
    error,
    browserSupport,
    boot,
    loadFiles,
    startDevServer,
    isReady,
  } = useWebContainer({ framework });

  const initializeWebContainer = useCallback(async () => {
    if (hasInitialized) return;
    setHasInitialized(true);

    try {
      await boot();
      
      if (data.files && typeof data.files === "object") {
        const files = data.files as Record<string, string>;
        await loadFiles(files);
      }
      
      await startDevServer();
    } catch (err) {
      console.error("[WebContainerPreview] Initialization failed:", err);
    }
  }, [hasInitialized, boot, loadFiles, startDevServer, data.files]);

  useEffect(() => {
    if (browserSupport?.isSupported && !hasInitialized) {
      initializeWebContainer();
    }
  }, [browserSupport, hasInitialized, initializeWebContainer]);

  const handleCopy = () => {
    if (serverUrl) {
      navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    if (serverUrl) {
      const iframe = document.querySelector("iframe");
      if (iframe) {
        iframe.src = serverUrl;
      }
    }
  };

  if (status === "unsupported") {
    return (
      <div className="flex flex-col w-full h-full">
        <Alert className="m-4" variant="default">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Browser Not Supported</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{browserSupport?.reason || "WebContainers require Chrome or Edge browser."}</p>
            <p className="text-sm text-muted-foreground">
              Detected: {browserSupport?.browserName} | 
              Cross-Origin-Isolation: {browserSupport?.hasCrossOriginIsolation ? "Yes" : "No"} | 
              SharedArrayBuffer: {browserSupport?.hasSharedArrayBuffer ? "Yes" : "No"}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col w-full h-full">
        <Alert className="m-4" variant="destructive">
          <XCircleIcon className="h-4 w-4" />
          <AlertTitle>WebContainer Error</AlertTitle>
          <AlertDescription>
            <p>{error || "An error occurred while running the WebContainer."}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (status !== "running") {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-background gap-4 p-8">
        <div className="flex flex-col items-center gap-4 max-w-md w-full">
          <div className="relative">
            <LoaderIcon className="h-12 w-12 text-primary animate-spin" />
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {STATUS_MESSAGES[status]}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {status === "booting" && "This only happens once per session"}
              {status === "installing" && "Installing npm packages..."}
              {status === "starting" && "Starting the development server..."}
            </p>
          </div>

          <div className="w-full space-y-2">
            <Progress value={STATUS_PROGRESS[status]} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {STATUS_PROGRESS[status]}% complete
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              WebContainer (Browser-based)
            </span>
            <span>|</span>
            <span>WAY FASTER than cloud</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <div className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-600 rounded-md">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          WebContainer
        </div>
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCcwIcon className="h-4 w-4" />
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!serverUrl || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">
              {serverUrl || "Loading..."}
            </span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!serverUrl}
            variant="outline"
            onClick={() => {
              if (serverUrl) {
                window.open(serverUrl, "_blank");
              }
            }}
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </Button>
        </Hint>
      </div>
      {serverUrl && (
        <iframe
          className="h-full w-full"
          src={serverUrl}
          title="WebContainer Preview"
        />
      )}
    </div>
  );
}
