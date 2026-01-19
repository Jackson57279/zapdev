"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type GitHubRepoOption = {
  id: number;
  name: string;
  fullName: string;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
};

type ExportResult = {
  exportId: string;
  repositoryUrl: string;
  repositoryFullName: string;
  branch: string;
  commitSha: string;
  fileCount: number;
};

type GitHubExportModalProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const exportResultSchema = z.object({
  exportId: z.string(),
  repositoryUrl: z.string(),
  repositoryFullName: z.string(),
  branch: z.string(),
  commitSha: z.string(),
  fileCount: z.number(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isRepoOption = (value: unknown): value is GitHubRepoOption => {
  if (!isRecord(value)) {
    return false;
  }

  const record = value;
  return (
    typeof record.id === "number" &&
    typeof record.name === "string" &&
    typeof record.fullName === "string" &&
    typeof record.url === "string" &&
    typeof record.isPrivate === "boolean" &&
    typeof record.defaultBranch === "string"
  );
};

const parseRepositories = (value: unknown): Array<GitHubRepoOption> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const repos: Array<GitHubRepoOption> = [];
  for (const repo of value) {
    if (isRepoOption(repo)) {
      repos.push(repo);
    }
  }

  return repos;
};

export const GitHubExportModal = ({
  projectId,
  open,
  onOpenChange,
}: GitHubExportModalProps) => {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [repos, setRepos] = useState<Array<GitHubRepoOption>>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [includeReadme, setIncludeReadme] = useState(true);
  const [includeGitignore, setIncludeGitignore] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const selectedRepoOption = useMemo(() => {
    return repos.find((repo) => repo.fullName === selectedRepo) ?? null;
  }, [repos, selectedRepo]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setResult(null);
      setIsExporting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadRepositories = async () => {
      setIsLoadingRepos(true);
      setError(null);
      try {
        const response = await fetch("/api/github/repositories");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load repositories");
        }

        const parsedRepos = parseRepositories(payload.repositories);
        setRepos(parsedRepos);
        if (parsedRepos.length === 0) {
          setError("No repositories found in this GitHub account.");
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load repositories";
        setError(message);
      } finally {
        setIsLoadingRepos(false);
      }
    };

    void loadRepositories();
  }, [open]);

  useEffect(() => {
    if (mode !== "existing" || !selectedRepoOption || branch) {
      return;
    }

    setBranch(selectedRepoOption.defaultBranch);
  }, [mode, selectedRepoOption, branch]);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        branch: branch.trim() || undefined,
        includeReadme,
        includeGitignore,
        commitMessage: commitMessage.trim() || undefined,
      };

      if (mode === "existing") {
        if (!selectedRepo) {
          throw new Error("Select a repository to export to.");
        }
        payload.repositoryFullName = selectedRepo;
      } else {
        const trimmedName = repoName.trim();
        if (!trimmedName) {
          throw new Error("Repository name is required.");
        }
        payload.repositoryName = trimmedName;
        payload.description = repoDescription.trim() || undefined;
        payload.isPrivate = isPrivate;
      }

      const response = await fetch(`/api/projects/${projectId}/export/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Export failed");
      }

      const parsedResult = exportResultSchema.safeParse(data);
      if (!parsedResult.success) {
        throw new Error("Unexpected export response.");
      }

      setResult(parsedResult.data);
      toast.success("GitHub export complete");
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Export failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const isReady =
    mode === "existing" ? selectedRepo.length > 0 : repoName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export to GitHub</DialogTitle>
          <DialogDescription>
            Export your latest AI-generated files to a GitHub repository.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{result.repositoryFullName}</div>
              <div className="text-muted-foreground">
                Branch: {result.branch}
              </div>
              <div className="text-muted-foreground">
                Files exported: {result.fileCount}
              </div>
              <div className="text-muted-foreground">
                Commit: {result.commitSha.slice(0, 10)}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button asChild>
                <a href={result.repositoryUrl} target="_blank" rel="noreferrer">
                  Open GitHub
                  <ExternalLinkIcon className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Repository</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => {
                  if (value === "new" || value === "existing") {
                    setMode(value);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="github-export-new" />
                  <Label htmlFor="github-export-new">New repository</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="github-export-existing" />
                  <Label htmlFor="github-export-existing">Existing repository</Label>
                </div>
              </RadioGroup>
            </div>

            {mode === "new" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="repo-name">Repository name</Label>
                  <Input
                    id="repo-name"
                    placeholder="zapdev-export"
                    value={repoName}
                    onChange={(event) => setRepoName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repo-description">Description</Label>
                  <Input
                    id="repo-description"
                    placeholder="Optional description"
                    value={repoDescription}
                    onChange={(event) => setRepoDescription(event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Private repository</p>
                    <p className="text-xs text-muted-foreground">
                      Limit visibility to collaborators.
                    </p>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Select repository</Label>
                <Select
                  value={selectedRepo}
                  onValueChange={setSelectedRepo}
                  disabled={isLoadingRepos}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.fullName} value={repo.fullName}>
                        {repo.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder={selectedRepoOption?.defaultBranch ?? "main"}
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commit-message">Commit message</Label>
                <Input
                  id="commit-message"
                  placeholder="Export project from ZapDev"
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Include README</p>
                  <p className="text-xs text-muted-foreground">
                    Adds a basic project overview.
                  </p>
                </div>
                <Switch checked={includeReadme} onCheckedChange={setIncludeReadme} />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Include .gitignore</p>
                  <p className="text-xs text-muted-foreground">
                    Adds framework defaults.
                  </p>
                </div>
                <Switch
                  checked={includeGitignore}
                  onCheckedChange={setIncludeGitignore}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={!isReady || isExporting}>
                {isExporting && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                {isExporting ? "Exporting..." : "Export to GitHub"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
