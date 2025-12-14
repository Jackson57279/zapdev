import { useState, useEffect } from "react";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import type { Doc } from "@/convex/_generated/dataModel";

interface Props {
  data: Doc<"fragments">;
};

export function FragmentWeb({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(data.sandboxUrl);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if sandbox is older than 55 minutes and auto-transfer
  useEffect(() => {
    const checkAndTransferSandbox = async () => {
      // Convex createdAt is a number (timestamp) or optional
      if (!data.createdAt) return;

      const sandboxAge = Date.now() - data.createdAt;
      const FIFTY_FIVE_MINUTES = 55 * 60 * 1000;

      if (sandboxAge >= FIFTY_FIVE_MINUTES) {
        setIsTransferring(true);

        try {
          const response = await fetch("/api/transfer-sandbox", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fragmentId: data._id,
            }),
          });

          if (!response.ok) {
            throw new Error("Transfer failed");
          }

          // Poll for the updated fragment
          let attempts = 0;
          const maxAttempts = 120; // 4 minutes total (120 * 2 seconds)

          const pollInterval = setInterval(async () => {
            attempts++;

            try {
              const checkResponse = await fetch(`/api/fragment/${data._id}`);
              if (checkResponse.ok) {
                const updatedFragment = await checkResponse.json();

                if (updatedFragment.sandboxUrl !== currentUrl) {
                  setCurrentUrl(updatedFragment.sandboxUrl);
                  setFragmentKey((prev) => prev + 1);
                  clearInterval(pollInterval);
                  setIsTransferring(false);
                }
              }
            } catch (err) {
              console.error("Polling error:", err);
            }

            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setIsTransferring(false);
              console.error("Sandbox transfer polling timeout after 4 minutes");
            }
          }, 2000);
        } catch (error) {
          console.error("Transfer error:", error);
          setIsTransferring(false);
        }
      }
    };

    checkAndTransferSandbox();
  }, [data._id, data.createdAt, currentUrl]);

  if (isTransferring) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Transferring to Fresh Sandbox</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your app is being moved to a new sandbox. This will take a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!currentUrl || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">
              {currentUrl}
            </span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!currentUrl}
            variant="outline"
            onClick={() => {
              if (!currentUrl) return;
              window.open(currentUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      <iframe
        key={fragmentKey}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={currentUrl}
      />
    </div>
  )
};
