import Image from "next/image";
import { format } from "date-fns";
import { ChevronRightIcon, Code2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { Doc } from "@/convex/_generated/dataModel";

type MessageRole = "USER" | "ASSISTANT";
type MessageType = "RESULT" | "ERROR" | "STREAMING";

type FragmentDoc = Doc<"fragments">;
type AttachmentDoc = Doc<"attachments">;

const formatCreatedAt = (timestamp?: number) => {
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date();
  return format(date, "HH:mm 'on' MMM dd, yyyy");
};

interface UserMessageProps {
  content: string;
  attachments?: AttachmentDoc[];
}

const UserMessage = ({ content, attachments = [] }: UserMessageProps) => (
  <div className="flex justify-end pb-4 pr-2 pl-10">
    <div className="flex flex-col gap-2 max-w-[80%]">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-end">
          {attachments.map((attachment) => (
            <div key={attachment._id} className="relative">
              <Image
                src={attachment.url}
                alt="Attachment"
                width={attachment.width ?? 200}
                height={attachment.height ?? 200}
                className="rounded-lg object-cover border max-h-48 w-auto"
              />
            </div>
          ))}
        </div>
      )}
      <Card className="rounded-lg bg-muted p-3 shadow-none border-none break-words">
        {content}
      </Card>
    </div>
  </div>
);

interface FragmentPreviewButtonProps {
  fragment: FragmentDoc;
  isActive: boolean;
  onClick: (fragment: FragmentDoc) => void;
}

const FragmentPreviewButton = ({ fragment, isActive, onClick }: FragmentPreviewButtonProps) => (
  <button
    className={cn(
      "flex items-start text-start gap-2 border rounded-lg bg-muted w-fit p-3 hover:bg-secondary transition-colors",
      isActive && "bg-primary text-primary-foreground border-primary hover:bg-primary",
    )}
    onClick={() => onClick(fragment)}
  >
    <Code2Icon className="size-4 mt-0.5" />
    <div className="flex flex-col flex-1">
      <span className="text-sm font-medium line-clamp-1">
        {fragment.title}
      </span>
      <span className="text-sm">Preview</span>
    </div>
    <div className="flex items-center justify-center mt-0.5">
      <ChevronRightIcon className="size-4" />
    </div>
  </button>
);

interface AssistantMessageProps {
  content: string;
  fragment: FragmentDoc | null;
  createdAt?: number;
  isActive: boolean;
  onFragmentClick: (fragment: FragmentDoc) => void;
  type: MessageType;
  streamingContent?: string;
}

const AssistantMessage = ({
  content,
  fragment,
  createdAt,
  isActive,
  onFragmentClick,
  type,
  streamingContent,
}: AssistantMessageProps) => {
  const displayContent = streamingContent || content;
  const isStreaming = type === "STREAMING" && !!streamingContent;

  return (
    <div
      className={cn(
        "flex flex-col group px-2 pb-4",
        type === "ERROR" && "text-red-700 dark:text-red-500",
      )}
    >
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="ZapDev"
          width={18}
          height={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">ZapDev</span>
        {isStreaming && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Thinking...
          </span>
        )}
        <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {formatCreatedAt(createdAt)}
        </span>
      </div>
      <div className="pl-8.5 flex flex-col gap-y-4">
        <span className="whitespace-pre-wrap">
          {displayContent}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-primary/60 animate-pulse" />
          )}
        </span>
        {fragment && type === "RESULT" && (
          <FragmentPreviewButton
            fragment={fragment}
            isActive={isActive}
            onClick={onFragmentClick}
          />
        )}
      </div>
    </div>
  );
};

interface MessageCardProps {
  content: string;
  role: MessageRole;
  fragment: FragmentDoc | null;
  createdAt?: number;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: FragmentDoc) => void;
  type: MessageType;
  attachments?: AttachmentDoc[];
  streamingContent?: string;
}

export const MessageCard = ({
  content,
  role,
  fragment,
  createdAt,
  isActiveFragment,
  onFragmentClick,
  type,
  attachments,
  streamingContent,
}: MessageCardProps) => {
  if (role === "ASSISTANT") {
    return (
      <AssistantMessage
        content={content}
        fragment={fragment}
        createdAt={createdAt}
        isActive={isActiveFragment}
        onFragmentClick={onFragmentClick}
        type={type}
        streamingContent={streamingContent}
      />
    );
  }

  return <UserMessage content={content} attachments={attachments} />;
};
