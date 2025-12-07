"use client";

import { Link } from "@tanstack/react-router";
import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import { EyeIcon, CodeIcon, CrownIcon } from "lucide-react";
import { useQuery } from "convex/react";
import { useUser } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";

import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { ProjectHeader } from "../components/project-header";
import { MessagesContainer } from "../components/messages-container";
import { ErrorBoundary } from "react-error-boundary";
import type { Doc } from "@/convex/_generated/dataModel";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";

// Dynamically import heavy components
const FileExplorer = dynamic(() => import("@/components/file-explorer").then(m => m.FileExplorer), {
  loading: () => <p className="p-4">Loading file explorer...</p>,
  ssr: false,
});

const FragmentWeb = dynamic(() => import("../components/fragment-web").then(m => m.FragmentWeb), {
  loading: () => <p className="p-4">Loading preview...</p>,
  ssr: false,
});

interface Props {
  projectId: string;
};

export const ProjectView = ({ projectId }: Props) => {
  const user = useUser();
  const isAuthenticated = !!user;
  const usage = useQuery(api.usage.getUsage, isAuthenticated ? {} : "skip");
  const hasProAccess = isAuthenticated && usage?.planType === "pro";

  const [activeFragment, setActiveFragment] = useState<Doc<"fragments"> | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");

  // Add authentication check with loading state
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Authenticating...</p>
      </div>
    );
  }

  const explorerFiles = useMemo(() => {
    if (!activeFragment) {
      console.debug('[ProjectView] No active fragment');
      return {} as Record<string, string>;
    }

    console.log('[ProjectView] Active fragment:', {
      id: activeFragment._id,
      filesType: typeof activeFragment.files,
      filesIsNull: activeFragment.files === null,
      filesKeys: activeFragment.files ? Object.keys(activeFragment.files as Record<string, unknown>).length : 0,
    });

    if (typeof activeFragment.files !== "object" || activeFragment.files === null) {
      console.error('[ProjectView] CRITICAL: Fragment files is not a valid object:', {
        type: typeof activeFragment.files,
        value: activeFragment.files,
        fragmentId: activeFragment._id
      });
      return {} as Record<string, string>;
    }

    // Normalize files: convert any non-string values to strings if possible
    const normalizedFiles = Object.entries(activeFragment.files as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [path, content]) => {
        if (typeof content === "string") {
          acc[path] = content;
        } else if (content !== null && content !== undefined) {
          // Attempt to recover non-string content
          try {
            const stringified = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
            acc[path] = stringified;
            console.warn(`[ProjectView] Converted non-string content to string for: ${path}`, {
              originalType: typeof content,
              convertedLength: stringified.length
            });
          } catch (err) {
            console.error(`[ProjectView] Failed to convert content for: ${path}`, err);
          }
        } else {
          console.warn(`[ProjectView] Skipping null/undefined content for: ${path}`);
        }
        return acc;
      },
      {}
    );

    const normalizedCount = Object.keys(normalizedFiles).length;
    console.log(`[ProjectView] Normalized ${normalizedCount} files from ${Object.keys(activeFragment.files).length} raw files`);

    if (normalizedCount === 0) {
      console.error('[ProjectView] CRITICAL: No valid files found after normalization!', {
        fragmentId: activeFragment._id,
        rawFilesCount: Object.keys(activeFragment.files).length,
        samplePaths: Object.keys(activeFragment.files).slice(0, 5)
      });
      // Return empty object to show "No files" message
      return {} as Record<string, string>;
    }

    // Filter out E2B sandbox system files - only show AI-generated code
    const filtered = filterAIGeneratedFiles(normalizedFiles);
    const filteredCount = Object.keys(filtered).length;

    console.log(`[ProjectView] After filtering: ${filteredCount} files (removed ${normalizedCount - filteredCount} system files)`);

    // The filter function now has built-in fallback, so we trust its output
    if (filteredCount === 0) {
      console.error('[ProjectView] WARNING: No files remain after filtering', {
        fragmentId: activeFragment._id,
        normalizedCount,
        sampleNormalizedPaths: Object.keys(normalizedFiles).slice(0, 10)
      });
    }

    return filtered;
  }, [activeFragment]);

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <ErrorBoundary fallback={<p>Project header error</p>}>
            <Suspense fallback={<p>Loading project...</p>}>
              <ProjectHeader projectId={projectId} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary fallback={<p>Messages container error</p>}>
            <Suspense fallback={<p>Loading messages...</p>}>
              <MessagesContainer
                projectId={projectId}
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
              />
            </Suspense>
          </ErrorBoundary>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-primary transition-colors" />
        <ResizablePanel
          defaultSize={65}
          minSize={50}
        >
          <Tabs
            className="h-full gap-y-0"
            defaultValue="preview"
            value={tabState}
            onValueChange={(value) => setTabState(value as "preview" | "code")}
          >
            <div className="w-full flex items-center p-2 border-b gap-x-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger value="preview" className="rounded-md">
                  <EyeIcon /> <span>Demo</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="rounded-md">
                  <CodeIcon /> <span>Code</span>
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-x-2">
                {!hasProAccess && (
                  <Button asChild size="sm" variant="tertiary">
                    <Link to="/pricing">
                      <CrownIcon /> Upgrade
                    </Link>
                  </Button>
                )}
                <UserControl />
              </div>
            </div>
            <TabsContent value="preview">
              {!!activeFragment && <FragmentWeb data={activeFragment} />}
            </TabsContent>
            <TabsContent value="code" className="min-h-0">
              {activeFragment && (
                <FileExplorer
                  files={explorerFiles}
                  fragmentId={activeFragment._id}
                  allFiles={activeFragment.files as Record<string, unknown>}
                />
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
