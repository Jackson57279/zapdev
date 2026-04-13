"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  getWebContainerInstance,
  releaseWebContainerInstance,
  writeFilesToWebContainer,
  readFilesFromWebContainer,
  serializeFilesForWebContainer,
  type FileRecord,
  type Framework,
} from "@/lib/webcontainer-manager";

const WEB_CONTAINER_RUN_NOTE = "zapdev-webcontainer-run.txt";

const createFallbackFiles = (prompt: string): FileRecord => ({
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

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getFramework = (value: Framework): Framework => value;

/**
 * Run code inside WebContainer and return the resulting files
 */
const runInsideWebContainer = async (
  files: FileRecord,
  prompt: string
): Promise<FileRecord> => {
  const webcontainer = await getWebContainerInstance();

  try {
    // Write all files to WebContainer
    await writeFilesToWebContainer(webcontainer, files);

    // Run node to verify it works
    const nodeProcess = await webcontainer.spawn("node", ["-v"]);
    await nodeProcess.exit;

    // Create a run note
    const runNote = [
      "WebContainer run completed.",
      `Prompt: ${prompt}`,
      `Timestamp: ${new Date().toISOString()}`,
      "Command executed: node -v",
    ].join("\n");

    await webcontainer.fs.writeFile(WEB_CONTAINER_RUN_NOTE, runNote);

    // Read all files back (including any generated/modified files)
    const finalFiles = await readFilesFromWebContainer(webcontainer);

    return {
      ...finalFiles,
      [WEB_CONTAINER_RUN_NOTE]: runNote,
    };
  } finally {
    // Release the instance reference
    await releaseWebContainerInstance();
  }
};

export const useWebContainerRunner = (projectId: string) => {
  const pendingRuns = useQuery(api.agentRuns.listPendingForProject, {
    projectId: projectId as Id<"projects">,
  });
  const claimRun = useMutation(api.agentRuns.claimRun);
  const completeRun = useMutation(api.agentRuns.completeRun);
  const failRun = useMutation(api.agentRuns.failRun);
  // @ts-expect-error - webcontainerFiles types are generated after Convex compile
  const saveFiles = useMutation(api.webcontainerFiles?.saveFiles);
  
  const isProcessingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

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

        // Prepare files - use base files or fallback
        const baseFiles = serializeFilesForWebContainer(claimed.baseFiles);
        const files =
          Object.keys(baseFiles).length > 0
            ? baseFiles
            : createFallbackFiles(claimed.value);

        // Run inside WebContainer
        const updatedFiles = await runInsideWebContainer(files, claimed.value);
        
        // Reset error counter on success
        consecutiveErrorsRef.current = 0;

        // Save files to backend storage
        try {
          await saveFiles({
            projectId: projectId as Id<"projects">,
            files: updatedFiles,
            framework: getFramework(claimed.framework),
            metadata: {
              source: "webcontainer-runner",
              runId: claimed.runId,
              timestamp: Date.now(),
            },
          });
        } catch (saveError) {
          console.warn("[WebContainer Runner] Failed to save files to backend:", saveError);
          // Non-fatal - continue with completion
        }

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
        consecutiveErrorsRef.current++;
        const errorMessage = normalizeError(error);
        
        console.error("[WebContainer Runner] Error:", errorMessage);
        
        // Check if this is an instance limit error
        if (errorMessage.includes("Unable to create more instances")) {
          console.warn(`[WebContainer Runner] Instance limit error (consecutive: ${consecutiveErrorsRef.current})`);
        }
        
        if (activeRunId) {
          await failRun({
            runId: activeRunId,
            error: errorMessage,
          });
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    void processRun();
  }, [pendingRuns, claimRun, completeRun, failRun, saveFiles, projectId]);
};
