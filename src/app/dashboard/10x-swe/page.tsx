"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  BarChartIcon,
  GitPullRequestIcon,
  SparklesIcon,
} from "lucide-react";

function TenXSweDashboardContent() {
  const searchParams = useSearchParams();
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("analysis");

  useEffect(() => {
    const repo = searchParams?.get("repo");
    if (repo) {
      setSelectedRepo(repo);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeftIcon className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <SparklesIcon className="size-8 text-primary" />
                10x SWE Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                AI-powered code analysis, review, and development assistance
              </p>
            </div>
          </div>
        </div>

        {/* Repository Selector */}
        <div className="mb-8 p-6 rounded-lg border border-border bg-card">
          <h2 className="font-semibold mb-4">Connected Repository</h2>
          {selectedRepo ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
              <div>
                <p className="font-medium">{selectedRepo}</p>
                <p className="text-sm text-muted-foreground">
                  Connected GitHub repository
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = "/import?source=github"}
              >
                Change Repository
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No repository selected. Connect a GitHub repository to get started.
              </p>
              <Button onClick={() => window.location.href = "/import?source=github"}>
                Connect Repository
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {selectedRepo && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChartIcon className="size-4" />
                Repository Analysis
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <SparklesIcon className="size-4" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-2">
                <GitPullRequestIcon className="size-4" />
                Code Review & PRs
              </TabsTrigger>
            </TabsList>

            {/* Repository Analysis Tab */}
            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold mb-2">Repository Name</h3>
                  <p className="text-2xl font-bold text-primary">
                    {selectedRepo?.split("/")[1] || "N/A"}
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold mb-2">Primary Language</h3>
                  <p className="text-2xl font-bold text-primary">Analyzing...</p>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold mb-2">Total Files</h3>
                  <p className="text-2xl font-bold text-primary">-</p>
                </div>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-xl font-semibold mb-4">Codebase Structure</h2>
                <div className="space-y-2 text-muted-foreground text-sm">
                  <p>• Analyzing repository structure...</p>
                  <p>• Identifying key modules and dependencies</p>
                  <p>• Mapping architecture patterns</p>
                </div>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-xl font-semibold mb-4">Dependencies</h2>
                <div className="space-y-2 text-muted-foreground text-sm">
                  <p>• Scanning package.json, requirements.txt, Gemfile, etc.</p>
                  <p>• Checking for outdated dependencies</p>
                  <p>• Identifying security vulnerabilities</p>
                </div>
              </div>
            </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <SparklesIcon className="size-5 text-primary" />
                  AI-Powered Insights
                </h2>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Architecture Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Claude is analyzing your codebase architecture to identify patterns,
                      anti-patterns, and refactoring opportunities.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Code Quality Assessment</h3>
                    <p className="text-sm text-muted-foreground">
                      Evaluating code quality, maintainability, and adherence to best
                      practices.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Refactoring Suggestions</h3>
                    <p className="text-sm text-muted-foreground">
                      AI-generated suggestions for improving code performance, readability,
                      and maintainability.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Documentation Gaps</h3>
                    <p className="text-sm text-muted-foreground">
                      Identifying areas where documentation is missing and generating
                      recommendations.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Code Review & PRs Tab */}
            <TabsContent value="review" className="space-y-6">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <GitPullRequestIcon className="size-5 text-primary" />
                  Code Review & Pull Request Assistance
                </h2>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">AI-Assisted Code Review</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatic code review for pull requests highlighting:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc space-y-1">
                      <li>Potential bugs and security issues</li>
                      <li>Performance improvements</li>
                      <li>Code style and best practices</li>
                      <li>Test coverage gaps</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">PR Summary Generation</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate comprehensive PR descriptions and changelogs
                      from your code changes.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Test Suggestions</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate test cases and suggestions for improved test coverage based
                      on changes.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50">
                    <h3 className="font-semibold text-sm mb-2">Merge Readiness Check</h3>
                    <p className="text-sm text-muted-foreground">
                      AI assessment of whether a PR is ready to merge with checklist of
                      concerns.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Coming soon:</strong> Real-time PR analysis integration with GitHub
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default function TenXSweDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>}>
      <TenXSweDashboardContent />
    </Suspense>
  );
}
