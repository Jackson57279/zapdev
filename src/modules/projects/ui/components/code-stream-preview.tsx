"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, CodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeStreamPreviewProps {
  code: string;
}

export const CodeStreamPreview = ({ code }: CodeStreamPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!code) return null;

  return (
    <div className="space-y-2 border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <CodeIcon className="size-4 text-primary" />
          <span className="text-sm font-medium">Code Preview</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7"
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="size-4 mr-1" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-4 mr-1" />
              Expand
            </>
          )}
        </Button>
      </div>

      <div
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isExpanded ? "max-h-[500px]" : "max-h-[150px]"
        )}
      >
        <pre className="text-xs font-mono p-4 overflow-auto whitespace-pre-wrap">
          {code}
        </pre>
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
};

