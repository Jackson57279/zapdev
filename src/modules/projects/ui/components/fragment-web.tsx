import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, DownloadIcon, BotIcon, Loader2Icon, CodeIcon, EyeIcon } from "lucide-react";
import { toast } from "sonner";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { FileExplorer } from "@/components/file-explorer";
import type { Doc } from "@/convex/_generated/dataModel";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";
import { cn } from "@/lib/utils";

interface FragmentWebProps {
  data: Doc<"fragments">;
  projectId: string;
}

const normalizeFiles = (value: Doc<"fragments">["files"]): Record<string, string> => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [path, content]) => {
      if (typeof content === "string") {
        acc[path] = content;
      }
      return acc;
    },
    {}
  );
};

export function FragmentWeb({ data, projectId }: FragmentWebProps) {
  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);
  const [isResuming, setIsResuming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(data.sandboxUrl);
  const [sandboxId, setSandboxId] = useState<string | null>(data.sandboxId ?? null);
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false);
  const resumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeAttemptRef = useRef(0);

  const files = useMemo(() => normalizeFiles(data.files), [data.files]);
  const aiGeneratedFiles = useMemo(() => filterAIGeneratedFiles(files), [files]);
  const hasDownloadableFiles = Object.keys(aiGeneratedFiles).length > 0;

  const modelInfo = useMemo(() => {
    const metadata = data.metadata as Record<string, unknown> | undefined;
    if (!metadata) return null;

    const modelName = metadata.modelName as string | undefined;
    const provider = metadata.provider as string | undefined;

    if (!modelName) return null;

    return { modelName, provider };
  }, [data.metadata]);

  const clearResumePoll = useCallback(() => {
    if (resumePollRef.current) {
      clearInterval(resumePollRef.current);
      resumePollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearResumePoll();
    };
  }, [clearResumePoll]);

  useEffect(() => {
    const nextId = data.sandboxId ?? null;
    setSandboxId((prev) => {
      if (prev === nextId) {
        return prev;
      }
      setHasAttemptedResume(false);
      resumeAttemptRef.current = 0;
      return nextId;
    });
    setCurrentUrl(data.sandboxUrl);
  }, [data.sandboxId, data.sandboxUrl]);

  useEffect(() => {
    resumeAttemptRef.current = 0;
  }, [sandboxId]);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (isDownloading) {
      return;
    }

    if (!hasDownloadableFiles) {
      toast.error("No AI-generated files are ready to download.");
      return;
    }

    setIsDownloading(true);

    let objectUrl: string | null = null;
    let downloadLink: HTMLAnchorElement | null = null;

    try {
      const response = await fetch(`/api/projects/${projectId}/download?fragmentId=${data._id}`, {
        method: "GET",
        headers: {
          "Accept": "application/zip",
        },
      });

      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({ error: "Not found" }));
        toast.error(errorData.error || "No AI-generated files are ready to download.");
        return;
      }

      if (response.status === 401 || response.status === 403) {
        toast.error("You don't have permission to download this project.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Download failed" }));
        throw new Error(errorData.error || `Download failed with status ${response.status}`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        toast.error("Downloaded file is empty. Please try again.");
        return;
      }

      // Verify it's actually a zip file
      if (blob.type && !blob.type.includes("zip") && !blob.type.includes("octet-stream")) {
        console.warn("Unexpected content type:", blob.type);
      }

      const disposition = response.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename = filenameMatch?.[1] ?? `project-${projectId}-latest.zip`;

      objectUrl = URL.createObjectURL(blob);
      downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();

      // Small delay before cleanup to ensure download starts
      await new Promise(resolve => setTimeout(resolve, 100));

      toast.success(`Download started: ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download files";
      toast.error(errorMessage + ". Please try again.");
    } finally {
      // Cleanup
      if (downloadLink && downloadLink.parentNode) {
        downloadLink.remove();
      }

      if (objectUrl) {
        // Delay cleanup to ensure download completes
        const urlToRevoke = objectUrl;
        setTimeout(() => {
          URL.revokeObjectURL(urlToRevoke);
        }, 1000);
      }

      setIsDownloading(false);
    }
  };

  const resumeSandbox = useCallback(
    async (force = false) => {
      if (!sandboxId || isResuming) {
        return;
      }

      if (!force && hasAttemptedResume) {
        return;
      }

      const MAX_ATTEMPTS = 3;
      if (resumeAttemptRef.current >= MAX_ATTEMPTS) {
        console.error("Sandbox resume attempts exceeded");
        return;
      }

      resumeAttemptRef.current += 1;
      setIsResuming(true);
      setHasAttemptedResume(true);

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
          throw new Error("Resume failed");
        }

        let attempts = 0;
        const maxAttempts = 60;

        clearResumePoll();
        resumePollRef.current = setInterval(async () => {
          attempts += 1;

          try {
            const checkResponse = await fetch(`/api/fragment/${data._id}`);
            if (checkResponse.ok) {
              const updatedFragment = await checkResponse.json();

              if (updatedFragment.sandboxUrl) {
                setCurrentUrl(updatedFragment.sandboxUrl);
                setSandboxId(updatedFragment.sandboxId ?? null);
                setFragmentKey((prev) => prev + 1);
                clearResumePoll();
                resumeAttemptRef.current = 0;
                setIsResuming(false);
              }
            }
          } catch (pollError) {
            console.error("Polling error:", pollError);
          }

          if (attempts >= maxAttempts) {
            clearResumePoll();
            setIsResuming(false);
            console.error("Sandbox resume polling timeout");
          }
        }, 1000);
      } catch (error) {
        console.error("Resume error:", error);
        setIsResuming(false);
      }
    },
    [sandboxId, isResuming, hasAttemptedResume, clearResumePoll, data._id],
  );

  useEffect(() => {
    if (!sandboxId || hasAttemptedResume) {
      return;
    }

    if (!data.sandboxUrl) {
      resumeSandbox();
    }
  }, [sandboxId, hasAttemptedResume, data.sandboxUrl, resumeSandbox]);

  const handleIframeError = useCallback(() => {
    setHasAttemptedResume(false);
    resumeSandbox(true);
  }, [resumeSandbox]);

  if (isResuming && !currentUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Resuming Sandbox</h3>
            <p className="text-sm text-muted-foreground mt-1">Restoring your environment. This usually takes a few seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full h-full">
      {isResuming && currentUrl && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <h3 className="text-base font-semibold">Resuming Sandbox</h3>
            <p className="text-xs text-muted-foreground mt-1">Trying to restore the environment while keeping the preview available.</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="preview" className="flex flex-col w-full h-full">
        <TabsList className="w-full h-12 p-1 bg-muted/50 rounded-lg">
          <TabsTrigger
            value="preview"
            className="flex-1 h-full gap-x-2 text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <EyeIcon className="size-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger
            value="code"
            className="flex-1 h-full gap-x-2 text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <CodeIcon className="size-4" />
            Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 w-full h-full data-[state=inactive]:hidden m-0 p-0 border-none">
          <iframe
            key={fragmentKey}
            className="h-full w-full"
            sandbox="allow-forms allow-scripts allow-same-origin"
            loading="lazy"
            src={currentUrl}
            onError={handleIframeError}
          />
        </TabsContent>

        <TabsContent value="code" className="flex-1 w-full h-full data-[state=inactive]:hidden m-0 p-0 border-none overflow-hidden">
          <FileExplorer files={aiGeneratedFiles} />
        </TabsContent>
      </Tabs >
    </div >
  );
};
