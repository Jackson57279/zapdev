"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2Icon, AlertCircleIcon, ExternalLinkIcon, CodeIcon, BotIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  starsCount: number;
}

export function GitHubImportFlow() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"project" | "dashboard" | null>(null);

  useEffect(() => {
    fetchGitHubRepos();
  }, []);

  const fetchGitHubRepos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/import/github/repos");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("GitHub connection expired. Please reconnect.");
        }
        throw new Error("Failed to fetch GitHub repositories");
      }

      const data = await response.json();
      setRepos(data.repositories || []);

      if (!data.repositories || data.repositories.length === 0) {
        setError("No repositories found. Please check your GitHub account.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repositories";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedRepo || !importMode) return;

    try {
      setIsProcessing(true);
      setError(null);

      const projectId = new URLSearchParams(window.location.search).get("projectId");

      if (importMode === "project" && !projectId) {
        throw new Error("Project ID not found");
      }

      if (importMode === "dashboard") {
        // Redirect to 10x SWE dashboard with selected repo
        window.location.href = `/dashboard/10x-swe?repo=${selectedRepo.fullName}`;
        return;
      }

      // Import to existing project
      const response = await fetch("/api/import/github/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: selectedRepo.id,
          repoName: selectedRepo.name,
          repoFullName: selectedRepo.fullName,
          repoUrl: selectedRepo.url,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start GitHub import");
      }

      toast.success("GitHub repository import started!");

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
        <p className="text-muted-foreground">Loading your GitHub repositories...</p>
      </div>
    );
  }

  if (!importMode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Choose Import Mode</h2>
          <p className="text-muted-foreground">
            How would you like to use your GitHub repository?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="p-6 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-all"
            onClick={() => setImportMode("project")}
          >
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
              <CodeIcon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Import to Project</h3>
            <p className="text-sm text-muted-foreground">
              Load your repo into a ZapDev project for code generation and modification
            </p>
          </div>

          <div
            className="p-6 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-all"
            onClick={() => setImportMode("dashboard")}
          >
            <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-lg mb-4">
              <BotIcon className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-semibold mb-2">10x SWE Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Advanced AI-powered analysis, code review, and PR assistance for your repos
            </p>
          </div>

          <div className="p-6 rounded-lg border-2 border-border/50 bg-muted/30 cursor-not-allowed opacity-60">
            <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-lg mb-4">
              <CheckIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Bulk Processing</h3>
            <p className="text-sm text-muted-foreground">
              Coming soon: Process multiple repos at once
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-end pt-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setImportMode(null)}
          className="gap-2"
        >
          ← Back
        </Button>
        <h2 className="text-2xl font-bold">
          {importMode === "project" ? "Select Repository" : "Connect to 10x SWE Dashboard"}
        </h2>
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
              onClick={fetchGitHubRepos}
              disabled={isLoading}
            >
              {isLoading ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </div>
      )}

      {!error && repos.length > 0 && (
        <div className="space-y-3">
          {repos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => setSelectedRepo(repo)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedRepo?.id === repo.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    {repo.name}
                    {selectedRepo?.id === repo.id && (
                      <CheckIcon className="w-5 h-5 text-primary" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {repo.description || "No description"}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    {repo.starsCount > 0 && <span>⭐ {repo.starsCount}</span>}
                  </div>
                </div>
                <Link
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLinkIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </div>
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
          disabled={!selectedRepo || isProcessing}
          className="gap-2"
        >
          {isProcessing && <Loader2Icon className="w-4 h-4 animate-spin" />}
          {isProcessing
            ? "Processing..."
            : importMode === "dashboard"
              ? "Open Dashboard"
              : "Import Repository"}
        </Button>
      </div>
    </div>
  );
}
