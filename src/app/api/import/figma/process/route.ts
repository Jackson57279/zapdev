import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stackUser = await getUser();
  if (!stackUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stackUser.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileKey, projectId, fileName, fileUrl } = body;

    if (!fileKey || !projectId || !fileName) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const convex = await getConvexClientWithAuth();

    // Get OAuth connection
    const connection = await convex.query(api.oauth.getConnection, {
      provider: "figma",
    });

    if (!connection) {
      return Response.json(
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
    const importRecord = await convex.mutation(api.imports.createImport, {
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

    return Response.json({
      success: true,
      importId: importRecord,
      message: "Figma file import started",
    });
  } catch (error) {
    console.error("Error processing Figma import:", error);
    return Response.json(
      { error: "Failed to process Figma import" },
      { status: 500 }
    );
  }
}
