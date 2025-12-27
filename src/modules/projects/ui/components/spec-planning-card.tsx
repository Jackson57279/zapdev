"use client";

import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { CheckIcon, XIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex-api";
import type { Id } from "@/convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SpecMode = "PLANNING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";

interface SpecPlanningCardProps {
  messageId: Id<"messages">;
  specContent: string;
  status: SpecMode;
}

export const SpecPlanningCard = ({
  messageId,
  specContent,
  status,
}: SpecPlanningCardProps) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const approveSpecMutation = useMutation(api.specs.approveSpec);
  const rejectSpecMutation = useMutation(api.specs.rejectSpec);

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const result = await approveSpecMutation({ messageId });

      // Trigger code generation via Inngest
      await fetch("/api/inngest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          value: result.messageContent,
          model: result.selectedModel || "auto",
          specContent: result.specContent,
          isFromApprovedSpec: true,
        }),
      });

      toast.success("Spec approved! Starting code generation...");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to approve spec");
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      toast.error("Please provide feedback for revision");
      return;
    }

    try {
      const result = await rejectSpecMutation({
        messageId,
        feedback: feedback.trim(),
      });

      // Trigger spec re-generation with feedback
      await fetch("/api/inngest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          value: `${result.messageContent}\n\nUser Feedback: ${feedback}`,
          model: result.selectedModel || "openai/gpt-5.1-codex",
          messageId,
          isSpecRevision: true,
        }),
      });

      toast.success("Spec rejected. AI is revising based on your feedback...");
      setIsRejecting(false);
      setFeedback("");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to reject spec");
      }
    }
  };

  if (status === "PLANNING") {
    return (
      <Card className="p-6 my-4 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <Loader2Icon className="size-5 animate-spin text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <SparklesIcon className="size-4" />
              Planning Your Project
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI is analyzing your requirements and creating a detailed implementation plan...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === "APPROVED") {
    return (
      <Card className="p-6 my-4 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-green-500 flex items-center justify-center">
            <CheckIcon className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Specification Approved</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Code generation has started based on the approved specification.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === "REJECTED") {
    return (
      <Card className="p-6 my-4 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10">
        <div className="flex items-center gap-3">
          <Loader2Icon className="size-5 animate-spin text-orange-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Revising Specification</h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI is updating the spec based on your feedback...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // AWAITING_APPROVAL state
  return (
    <Card className="p-6 my-4 border-primary">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-8 rounded-full bg-primary flex items-center justify-center">
          <SparklesIcon className="size-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Implementation Specification</h3>
          <p className="text-sm text-muted-foreground">
            Review the plan and approve to start building
          </p>
        </div>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none mb-6 p-4 rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
        <ReactMarkdown
          components={{
            // Customize markdown rendering for better styling
            h1: ({ node, ...props }) => (
              <h1 className="text-xl font-bold mt-4 mb-2" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-base font-semibold mt-2 mb-1" {...props} />
            ),
            code: ({ node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || "");
              return match ? (
                <code
                  className={cn(
                    "block bg-black/80 text-green-400 p-3 rounded text-xs overflow-x-auto",
                    className,
                  )}
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <code
                  className="bg-primary/10 text-primary px-1 py-0.5 rounded text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
            ),
          }}
        >
          {specContent}
        </ReactMarkdown>
      </div>

      {!isRejecting ? (
        <div className="flex gap-3">
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1"
            size="lg"
          >
            {isApproving ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckIcon className="size-4 mr-2" />
                Looks good, start building
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsRejecting(true)}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <XIcon className="size-4 mr-2" />
            Revise spec
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">
              What would you like to change?
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="E.g., 'Add dark mode support' or 'Use a different component library'..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleReject} className="flex-1" size="lg">
              Submit Feedback
            </Button>
            <Button
              onClick={() => {
                setIsRejecting(false);
                setFeedback("");
              }}
              variant="ghost"
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
