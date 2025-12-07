"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2Icon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FigmaFile {
  key: string;
  name: string;
  file_key: string;
  thumbnail_url: string;
  lastModified: string;
}

export function FigmaImportFlow() {
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFigmaFiles();
  }, []);

  const fetchFigmaFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/import/figma/files");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Figma connection expired. Please reconnect.");
        }
        throw new Error("Failed to fetch Figma files");
      }

      const data = await response.json();
      setFiles(data.files || []);

      if (!data.files || data.files.length === 0) {
        setError("No Figma files found. Please create or share a file in Figma.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load files";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      setError(null);

      // Get the current project ID from the URL or use a default
      const projectId = new URLSearchParams(window.location.search).get("projectId");

      if (!projectId) {
        throw new Error("Project ID not found");
      }

      const response = await fetch("/api/import/figma/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: selectedFile.file_key || selectedFile.key,
          projectId,
          fileName: selectedFile.name,
          fileUrl: `https://figma.com/file/${selectedFile.file_key || selectedFile.key}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start Figma import");
      }

      toast.success("Figma file import started! Generating code from your design...");

      // Redirect to project page
      setTimeout(() => {
        window.location.href = `/projects/${projectId}`;
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2Icon className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your Figma files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Figma Design</h2>
        <p className="text-muted-foreground">
          Choose a Figma file to convert into production-ready code
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircleIcon className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Error</p>
            <p className="text-sm text-destructive/80">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={fetchFigmaFiles}
              disabled={isLoading}
            >
              {isLoading ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </div>
      )}

      {!error && files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.key}
              onClick={() => setSelectedFile(file)}
              className={`relative rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
                selectedFile?.key === file.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {file.thumbnail_url && (
                <Image
                  src={file.thumbnail_url}
                  alt={file.name}
                  width={200}
                  height={120}
                  className="w-full h-24 object-cover"
                />
              )}
              <div className="p-3 space-y-2">
                <p className="font-medium text-sm line-clamp-2">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(file.lastModified).toLocaleDateString()}
                </p>
              </div>
              {selectedFile?.key === file.key && (
                <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                  <CheckCircleIcon className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 justify-end pt-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!selectedFile || isProcessing}
          className="gap-2"
        >
          {isProcessing && <Loader2Icon className="w-4 h-4 animate-spin" />}
          {isProcessing ? "Processing..." : "Import Design"}
        </Button>
      </div>
    </div>
  );
}
