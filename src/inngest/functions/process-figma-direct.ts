import { Buffer } from "node:buffer";
import { inngest } from "@/inngest/client";
import { ConvexClient } from "convex/browser";
import { api } from "@/lib/convex-api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  extractDesignSystem,
  extractPageStructure,
  generateFigmaCodePrompt,
  parseFigmaFigFile,
} from "@/lib/figma-processor";

let convexClient: ConvexClient | null = null;
function getConvexClient() {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexClient(url);
  }
  return convexClient;
}

const convex = new Proxy({} as ConvexClient, {
  get(_target, prop) {
    return getConvexClient()[prop as keyof ConvexClient];
  },
});

interface DirectFigmaImportEvent {
  importId: Id<"imports">;
  projectId: string;
  figmaUrl?: string;
  fileBase64?: string;
  fileName?: string;
}

async function decodeFigJson(fileBase64?: string) {
  if (!fileBase64) return null;
  const buffer = Buffer.from(fileBase64, "base64");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const figJson = await parseFigmaFigFile(arrayBuffer);
  return figJson;
}

export const processFigmaDirect = inngest.createFunction(
  { id: "process-figma-direct" },
  { event: "code-agent/process-figma-direct" },
  async ({ event, step }) => {
    const { importId, projectId, figmaUrl, fileBase64, fileName } = event.data as DirectFigmaImportEvent;

    try {
      await step.run("mark-processing", async () => {
        return await convex.mutation(api.imports.markProcessing, { importId });
      });

      const figmaData = await step.run("parse-figma-file", async () => {
        return await decodeFigJson(fileBase64);
      });

      const designSystem = figmaData ? await step.run("extract-design-system", async () => extractDesignSystem(figmaData)) : null;
      const aiPrompt = figmaData && designSystem
        ? await step.run("generate-ai-prompt", async () => generateFigmaCodePrompt(figmaData, designSystem))
        : null;
      const structureInfo = figmaData
        ? await step.run("extract-structure", async () => extractPageStructure(figmaData))
        : figmaUrl
          ? `Figma shared link provided: ${figmaUrl}`
          : "Figma upload provided (structure unavailable)";

      const message = await step.run("create-message", async () => {
        return await convex.action(api.messages.createWithAttachments, {
          value: aiPrompt
            ? `Convert this Figma design to code:\n\n${structureInfo}\n\n${aiPrompt}`
            : `Convert this Figma design to code. Source: ${structureInfo}`,
          projectId,
          attachments: [
            {
              url: figmaUrl || "",
              size: 0,
              importId,
              sourceMetadata: {
                figmaFile: fileName || figmaUrl || "Figma design",
                designSystem: designSystem || undefined,
              },
              type: "FIGMA_FILE",
            },
          ],
        });
      });

      await step.run("mark-complete", async () => {
        return await convex.mutation(api.imports.markComplete, {
          importId,
          metadata: {
            designSystem,
            messageId: message.messageId,
            fileData: {
              name: fileName || figmaUrl || "Figma design",
            },
          },
        });
      });

      return {
        success: true,
        importId,
        messageId: message.messageId,
      };
    } catch (error) {
      await step.run("mark-failed", async () => {
        return await convex.mutation(api.imports.markFailed, {
          importId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });

      throw error;
    }
  }
);

