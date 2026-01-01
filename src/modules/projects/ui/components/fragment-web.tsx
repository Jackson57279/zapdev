"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, AlertTriangleIcon } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Doc } from "@/convex/_generated/dataModel";

interface Props {
  data: Doc<"fragments">;
}

function detectWebContainerSupport(): { supported: boolean; reason?: string } {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Server-side rendering" };
  }
  
  const hasCrossOriginIsolation = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  
  if (!hasCrossOriginIsolation) {
    return { supported: false, reason: "Missing Cross-Origin-Isolation headers" };
  }
  
  if (!hasSharedArrayBuffer) {
    return { supported: false, reason: "SharedArrayBuffer not available" };
  }
  
  const ua = navigator.userAgent.toLowerCase();
  const isChromiumBased = ua.includes("chrome") || ua.includes("edg");
  
  if (!isChromiumBased) {
    return { supported: false, reason: "Please use Chrome or Edge for best experience" };
  }
  
  return { supported: true };
}

export function FragmentWeb({ data }: Props) {
  const [webContainerSupport, setWebContainerSupport] = useState<{ supported: boolean; reason?: string } | null>(null);

  useEffect(() => {
    setWebContainerSupport(detectWebContainerSupport());
  }, []);

  const hasLocalFiles = useCallback(() => {
    return data.files && typeof data.files === "object" && Object.keys(data.files).length > 0;
  }, [data.files]);

  if (webContainerSupport === null) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Checking browser compatibility...</p>
      </div>
    );
  }

  if (!webContainerSupport.supported) {
    return (
      <div className="flex flex-col w-full h-full p-4">
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>WebContainer Required</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{webContainerSupport.reason}</p>
            <p className="text-sm">
              WebContainers run code directly in your browser for the fastest possible experience.
              Please use Chrome or Edge with proper security headers.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasLocalFiles()) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-background">
        <p className="text-sm text-muted-foreground">No files to preview</p>
      </div>
    );
  }

  const WebContainerPreview = require("./webcontainer-preview").WebContainerPreview;
  return <WebContainerPreview data={data} />;
}
