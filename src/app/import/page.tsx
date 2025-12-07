"use client";

import { useState, useEffect, Suspense } from "react";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FigmaImportFlow } from "@/components/import/figma-import-flow";
import { GitHubImportFlow } from "@/components/import/github-import-flow";

function ImportPageContent() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const [isLoading, setIsLoading] = useState(true);

  const source = searchParams?.source;
  const status = searchParams?.status;
  const error = searchParams?.error;

  useEffect(() => {
    if (error) {
      toast.error(`Import error: ${error}`);
    }
    if (status === "connected") {
      toast.success("Successfully connected!");
    }
    setIsLoading(false);
  }, [error, status]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading import flow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Import Your Design or Code</h1>
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
        </div>

        {source === "figma" ? (
          <FigmaImportFlow />
        ) : source === "github" ? (
          <GitHubImportFlow />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => {
                window.location.href = "/api/import/figma/auth";
              }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-[#0ACE4E] rounded-lg mb-4">
                <svg
                  viewBox="0 0 38 57"
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                >
                  <path d="M19 28.5a4.75 4.75 0 1 0 0-9.5 4.75 4.75 0 0 0 0 9.5Z" />
                  <path d="M0 14.25a4.75 4.75 0 0 1 4.75-4.75h9.5v9.5h-9.5A4.75 4.75 0 0 1 0 14.25Z" />
                  <path d="M0 28.5a4.75 4.75 0 0 1 4.75-4.75h9.5v9.5h-9.5A4.75 4.75 0 0 1 0 28.5Z" />
                  <path d="M14.25 42.75a4.75 4.75 0 0 1 4.75-4.75h9.5v9.5h-9.5a4.75 4.75 0 0 1-4.75-4.75Z" />
                  <path d="M28.5 0a4.75 4.75 0 0 1 4.75 4.75v9.5h-9.5v-9.5A4.75 4.75 0 0 1 28.5 0Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Import from Figma</h3>
              <p className="text-muted-foreground text-sm">
                Convert your Figma designs directly into production-ready code.
              </p>
            </div>

            <div
              className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => {
                window.location.href = "/api/import/github/auth";
              }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-black rounded-lg mb-4">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Import from GitHub</h3>
              <p className="text-muted-foreground text-sm">
                Connect your repos for code analysis, review, and AI-assisted development.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading import flow...</p>
        </div>
      </div>
    }>
      <ImportPageContent />
    </Suspense>
  );
}
