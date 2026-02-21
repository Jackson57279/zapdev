"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import type { Id } from "@/convex/_generated/dataModel";

const WEB_CONTAINER_RUN_NOTE = "zapdev-webcontainer-run.txt";

type Framework = "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE";

const createFallbackFiles = (prompt: string): Record<string, string> => ({
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZapDev WebContainer Preview</title>
  </head>
  <body>
    <h1>WebContainer Run</h1>
    <pre id="prompt"></pre>
    <script>
      document.getElementById("prompt").textContent = ${JSON.stringify(prompt)};
    </script>
  </body>
</html>`,
  "server.mjs": `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3000, () => {
  console.log("server-ready:3000");
});
`,
});

const runInsideWebContainer = async (
  files: Record<string, string>,
  prompt: string
): Promise<Record<string, string>> => {
  const { WebContainer } = await import("@webcontainer/api");
  const webcontainer = await WebContainer.boot();

  try {
    for (const [filePath, contents] of Object.entries(files)) {
      const segments = filePath.split("/").filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      if (segments.length > 1) {
        const directoryPath = segments.slice(0, -1).join("/");
        await webcontainer.fs.mkdir(directoryPath, { recursive: true });
      }
      await webcontainer.fs.writeFile(filePath, contents);
    }

    const nodeProcess = await webcontainer.spawn("node", ["-v"]);
    await nodeProcess.exit;

    const runNote = [
      "WebContainer run completed.",
      `Prompt: ${prompt}`,
      `Timestamp: ${new Date().toISOString()}`,
      "Command executed: node -v",
    ].join("\n");

    await webcontainer.fs.writeFile(WEB_CONTAINER_RUN_NOTE, runNote);

    return {
      ...files,
      [WEB_CONTAINER_RUN_NOTE]: runNote,
    };
  } finally {
    webcontainer.teardown();
  }
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getFramework = (value: Framework): Framework => value;

export const useWebContainerRunner = (projectId: string) => {
  const pendingRuns = useQuery(api.agentRuns.listPendingForProject, {
    projectId: projectId as Id<"projects">,
  });
  const claimRun = useMutation(api.agentRuns.claimRun);
  const completeRun = useMutation(api.agentRuns.completeRun);
  const failRun = useMutation(api.agentRuns.failRun);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!pendingRuns || pendingRuns.length === 0 || isProcessingRef.current) {
      return;
    }

    const firstPendingRun = pendingRuns[0];
    if (!firstPendingRun) {
      return;
    }

    isProcessingRef.current = true;
    let activeRunId: Id<"agentRuns"> | null = null;

    const processRun = async () => {
      try {
        const claimed = await claimRun({
          runId: firstPendingRun._id,
        });

        activeRunId = claimed.runId;

        const files =
          Object.keys(claimed.baseFiles).length > 0
            ? claimed.baseFiles
            : createFallbackFiles(claimed.value);
        const updatedFiles = await runInsideWebContainer(files, claimed.value);

        await completeRun({
          runId: claimed.runId,
          summary: `WebContainer run finished for prompt: "${claimed.value.slice(0, 120)}"`,
          files: updatedFiles,
          framework: getFramework(claimed.framework),
          metadata: {
            source: "webcontainer-queue",
            mode: "browser",
          },
        });
      } catch (error) {
        if (activeRunId) {
          await failRun({
            runId: activeRunId,
            error: normalizeError(error),
          });
        } else {
          console.error("[WebContainer Runner] Failed to claim run:", error);
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    void processRun();
  }, [pendingRuns, claimRun, completeRun, failRun]);
};
