"use client";

import { useState, useEffect } from "react";
import { XIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrowserSupport {
  isSupported: boolean;
  hasCrossOriginIsolation: boolean;
  hasSharedArrayBuffer: boolean;
  browserName: string;
  supportLevel: "full" | "limited" | "none";
}

function detectBrowserSupport(): BrowserSupport {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      hasCrossOriginIsolation: false,
      hasSharedArrayBuffer: false,
      browserName: "server",
      supportLevel: "none",
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  let browserName = "your browser";
  let supportLevel: "full" | "limited" | "none" = "none";
  
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browserName = "Chrome";
    supportLevel = "full";
  } else if (ua.includes("edg")) {
    browserName = "Edge";
    supportLevel = "full";
  } else if (ua.includes("firefox")) {
    browserName = "Firefox";
    supportLevel = "limited";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browserName = "Safari";
    supportLevel = "limited";
  }

  const hasCrossOriginIsolation = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const isSupported = hasCrossOriginIsolation && hasSharedArrayBuffer && supportLevel === "full";

  return {
    isSupported,
    hasCrossOriginIsolation,
    hasSharedArrayBuffer,
    browserName,
    supportLevel,
  };
}

export function BrowserCompatibilityBanner() {
  const [support, setSupport] = useState<BrowserSupport | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const result = detectBrowserSupport();
    setSupport(result);
    
    const wasDismissed = localStorage.getItem("webcontainer-banner-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("webcontainer-banner-dismissed", "true");
  };

  if (!support || support.isSupported || dismissed) {
    return null;
  }

  if (support.supportLevel === "full" && !support.hasCrossOriginIsolation) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <ZapIcon className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {support.supportLevel === "limited" ? (
              <>
                <strong>{support.browserName}</strong> has limited WebContainer support. 
                For the fastest experience, use{" "}
                <a 
                  href="https://www.google.com/chrome/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Chrome
                </a>{" "}
                or{" "}
                <a 
                  href="https://www.microsoft.com/edge" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Edge
                </a>.
              </>
            ) : (
              <>
                Your browser doesn&apos;t support WebContainers. 
                Using cloud sandboxes instead (slightly slower).
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
