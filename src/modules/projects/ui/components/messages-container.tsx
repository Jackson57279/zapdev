import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { MessageLoading } from "./message-loading";

interface Props {
  projectId: string;
  activeFragment: Doc<"fragments"> | null;
  setActiveFragment: (fragment: Doc<"fragments"> | null) => void;
}

type MessageWithRelations = Doc<"messages"> & {
  Fragment: Doc<"fragments"> | null;
  Attachment: Doc<"attachments">[];
};

export const MessagesContainer = ({
  projectId,
  activeFragment,
  setActiveFragment
}: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamUpdate = useCallback((content: string) => {
    setStreamingContent((prev) => prev + content);
  }, []);

  const handleStreamStart = useCallback(() => {
    setStreamingContent("");
    setIsStreaming(true);
  }, []);

  const handleStreamEnd = useCallback(() => {
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  const messages = useQuery(api.messages.list, {
    projectId: projectId as Id<"projects">
  }) as MessageWithRelations[] | undefined;

  useEffect(() => {
    if (!messages) return;

    const lastAssistantMessage = [...messages].reverse().find(
      (message) => message.role === "ASSISTANT"
    );

    if (
      lastAssistantMessage?.Fragment &&
      lastAssistantMessage.status === "COMPLETE" &&
      lastAssistantMessage._id !== lastAssistantMessageIdRef.current
    ) {
      setActiveFragment(lastAssistantMessage.Fragment);
      lastAssistantMessageIdRef.current = lastAssistantMessage._id;
    }
  }, [messages, setActiveFragment]);

  useEffect(() => {
    if (messages) {
      bottomRef.current?.scrollIntoView();
    }
  }, [messages?.length, streamingContent]);

  if (!messages) {
    return <div className="flex flex-col flex-1 min-h-0 items-center justify-center">Loading...</div>;
  }

  const lastMessage = messages[messages.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";
  const lastStreamingMessage = messages.find(
    (m) => m.role === "ASSISTANT" && m.status === "STREAMING"
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="pt-2 pr-1">
          {messages.map((message) => (
            <MessageCard
              key={message._id}
              content={message.content}
              role={message.role}
              fragment={message.Fragment}
              createdAt={message.createdAt ?? message._creationTime}
              isActiveFragment={activeFragment?._id === message.Fragment?._id}
              onFragmentClick={setActiveFragment}
              type={message.type}
              attachments={message.Attachment}
              streamingContent={
                message.status === "STREAMING" && isStreaming
                  ? streamingContent
                  : undefined
              }
            />
          ))}
          {isLastMessageUser && !lastStreamingMessage && <MessageLoading />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="relative p-3 pt-1">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <MessageForm
          projectId={projectId}
          onStreamUpdate={handleStreamUpdate}
          onStreamStart={handleStreamStart}
          onStreamEnd={handleStreamEnd}
        />
      </div>
    </div>
  );
};
