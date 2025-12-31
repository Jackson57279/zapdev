import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { processFigmaImport } from "@/agents/figma-import";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileKey, projectId, fileName, fileUrl } = body;

    if (!fileKey || !projectId || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const connection = await fetchQuery((api as any).oauth.getConnection, {
      provider: "figma",
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Figma not connected" },
        { status: 401 }
      );
    }

    const fileResponse = await fetch(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
        },
      }
    );

    if (!fileResponse.ok) {
      throw new Error("Failed to fetch Figma file details");
    }

    const fileData = await fileResponse.json();

    const importRecord = await fetchMutation((api as any).imports.createImport, {
      projectId,
      source: "FIGMA",
      sourceId: fileKey,
      sourceName: fileName,
      sourceUrl: fileUrl || `https://figma.com/file/${fileKey}`,
      metadata: {
        figmaFileData: {
          name: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version,
          pages: fileData.pages?.length || 0,
        },
      },
    });

    processFigmaImport({
      importId: importRecord,
      projectId,
      fileKey,
      accessToken: connection.accessToken,
    }).catch((error) => {
      console.error("[ERROR] Background Figma import failed:", error);
    });

    return NextResponse.json({
      success: true,
      importId: importRecord,
      message: "Figma file import started",
    });
  } catch (error) {
    console.error("Error processing Figma import:", error);
    return NextResponse.json(
      { error: "Failed to process Figma import" },
      { status: 500 }
    );
  }
}
