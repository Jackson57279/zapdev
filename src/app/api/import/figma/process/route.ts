import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (false) {
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

    // Get OAuth connection
    const connection = await fetchQuery((api as any).oauth.getConnection, {
      provider: "figma",
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Figma not connected" },
        { status: 401 }
      );
    }

    // Fetch file details from Figma
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

    // Create import record in Convex
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

    await inngest.send({
      name: "code-agent/process-figma-import",
      data: {
        importId: importRecord,
        projectId,
        fileKey,
        accessToken: connection.accessToken,
      },
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
