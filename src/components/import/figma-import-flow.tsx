"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, UploadIcon, LinkIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FigmaImportFlow() {
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figFile, setFigFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const projectId = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("projectId");

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error("Project ID not found");
      return;
    }

    if (!figmaUrl && !figFile) {
      toast.error("Provide a Figma link or upload a .fig file");
      return;
    }

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("projectId", projectId);
      if (figmaUrl) {
        formData.append("figmaUrl", figmaUrl);
      }
      if (figFile) {
        formData.append("figmaFile", figFile);
      }

      const response = await fetch("/api/import/figma/direct", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to start Figma import");
      }

      toast.success("Import started! We’ll generate code from your design.");
      setTimeout(() => {
        window.location.href = `/projects/${projectId}`;
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const inputDisabled = isProcessing;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Import from Figma</h2>
        <p className="text-muted-foreground">
          Paste a public Figma link or upload a .fig file. No Figma API token required.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground" />
            Public Figma link (optional)
          </span>
          <input
            type="url"
            placeholder="https://www.figma.com/file/..."
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            disabled={inputDisabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <FileIcon className="w-4 h-4 text-muted-foreground" />
            Upload .fig file (optional)
          </span>
          <input
            type="file"
            accept=".fig"
            disabled={inputDisabled}
            onChange={(e) => setFigFile(e.target.files?.[0] || null)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {figFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {figFile.name} ({Math.round(figFile.size / 1024)} KB)
            </p>
          )}
        </label>
      </div>

      <div className="flex gap-4 justify-end pt-4">
        <Button variant="outline" onClick={() => window.history.back()} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || (!figmaUrl && !figFile)}
          className="gap-2"
        >
          {isProcessing && <Loader2Icon className="w-4 h-4 animate-spin" />}
          <UploadIcon className="w-4 h-4" />
          {isProcessing ? "Starting..." : "Start Import"}
        </Button>
      </div>
    </div>
  );
}
