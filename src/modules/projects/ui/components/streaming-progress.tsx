"use client";

import { Loader2Icon, CheckCircleIcon, FileCodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamingProgressProps {
  status: string;
  components: Array<{ name: string; path: string }>;
  isComplete?: boolean;
}

export const StreamingProgress = ({ status, components, isComplete = false }: StreamingProgressProps) => {
  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircleIcon className="size-4 text-green-500" />
        ) : (
          <Loader2Icon className="size-4 animate-spin text-primary" />
        )}
        <span className="text-sm font-medium">{status}</span>
      </div>

      {components.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground font-medium">Generated Components:</div>
          <div className="space-y-1">
            {components.map((component, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 text-xs p-2 rounded border bg-background/50",
                  "animate-in slide-in-from-left-2 duration-300"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <FileCodeIcon className="size-3 text-primary" />
                <span className="font-mono">{component.name}</span>
                <span className="text-muted-foreground text-[10px] ml-auto truncate max-w-[200px]">
                  {component.path}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

