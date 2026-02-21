import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import type { FunctionReference } from "convex/server";
import { api } from "@/convex/_generated/api";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileKey, projectId, fileName, fileUrl } = body as {
      fileKey?: string;
      projectId?: string;
      fileName?: string;
      fileUrl?: string;
    };

    if (!fileKey || !projectId || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const connection = await fetchQuery(api.oauth.getConnection as unknown as FunctionReference<"query">, {
      provider: "figma",
    });

    if (!connection) {
      return NextResponse.json({ error: "Figma not connected" }, { status: 401 });
    }

    const importRecord = await fetchMutation(api.imports.createImport as unknown as FunctionReference<"mutation">, {
      projectId,
      source: "FIGMA",
      sourceId: fileKey,
      sourceName: fileName,
      sourceUrl: fileUrl || `https://figma.com/file/${fileKey}`,
      metadata: { figmaFileKey: fileKey },
    });

    await inngest.send({
      name: "agent/figma-import.run",
      data: {
        projectId,
        importId: importRecord,
        fileKey,
        accessToken: connection.accessToken as string,
      },
    });

    return NextResponse.json({
      success: true,
      importId: importRecord,
      message: "Figma file import started",
    });
  } catch (error) {
    console.error("Error processing Figma import:", error);
    return NextResponse.json({ error: "Failed to process Figma import" }, { status: 500 });
  }
}
