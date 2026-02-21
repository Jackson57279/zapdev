import { useState } from "react";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import type { Doc } from "@/convex/_generated/dataModel";
import { WebContainerPreview } from "./webcontainer-preview";

interface Props {
  data: Doc<"fragments">;
};

const WEB_CONTAINER_PREVIEW_URL = "webcontainer://local";

export function FragmentWeb({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);
  const isWebContainerPreview = data.sandboxUrl === WEB_CONTAINER_PREVIEW_URL;
  const normalizedFiles =
    typeof data.files === "object" && data.files !== null
      ? Object.entries(data.files as Record<string, unknown>).reduce<Record<string, string>>(
          (acc, [path, content]) => {
            if (typeof content === "string") {
              acc[path] = content;
            }
            return acc;
          },
          {}
        )
      : {};

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.sandboxUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!data.sandboxUrl || copied || isWebContainerPreview}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">
              {isWebContainerPreview ? "webcontainer://preview" : data.sandboxUrl}
            </span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!data.sandboxUrl || isWebContainerPreview}
            variant="outline"
            onClick={() => {
              if (!data.sandboxUrl) return;
              window.open(data.sandboxUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      {isWebContainerPreview ? (
        <WebContainerPreview files={normalizedFiles} refreshKey={fragmentKey} />
      ) : (
        <iframe
          key={fragmentKey}
          className="h-full w-full"
          sandbox="allow-forms allow-scripts allow-same-origin"
          loading="lazy"
          src={data.sandboxUrl}
        />
      )}
    </div>
  );
};
