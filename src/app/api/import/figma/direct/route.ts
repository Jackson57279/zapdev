import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchMutation } from "convex/nextjs";
import type { FunctionReference } from "convex/server";
import { api } from "@/convex/_generated/api";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Use multipart/form-data" }, { status: 400 });
    }

    const form = await request.formData();
    const projectId = form.get("projectId")?.toString();
    const figmaUrl = form.get("figmaUrl")?.toString().trim() || "";
    const file = form.get("figmaFile") as File | null;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    if (!figmaUrl && !file) {
      return NextResponse.json({ error: "Provide figmaUrl or figmaFile" }, { status: 400 });
    }

    let fileBase64: string | undefined;
    let fileName: string | undefined;

    if (file) {
      fileName = file.name;
      if (!fileName.toLowerCase().endsWith(".fig")) {
        return NextResponse.json({ error: "Only .fig files are supported" }, { status: 400 });
      }
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      fileBase64 = fileBuffer.toString("base64");
    }

    const sourceId = figmaUrl || fileName || "figma-direct";
    const sourceUrl = figmaUrl || "figma-file-upload";
    const sourceName = fileName || (figmaUrl ? "Figma link" : "Figma upload");

    const importId = await fetchMutation(api.imports.createImport as unknown as FunctionReference<"mutation">, {
      projectId,
      source: "FIGMA",
      sourceId,
      sourceName,
      sourceUrl,
      metadata: {
        inputType: fileBase64 ? "file" : "link",
        fileName,
        figmaUrl: figmaUrl || undefined,
      },
    });

    await inngest.send({
      name: "agent/figma-import.run",
      data: {
        projectId,
        importId,
        figmaUrl: figmaUrl || undefined,
        fileBase64,
        fileName,
      },
    });

    return NextResponse.json({
      success: true,
      importId,
      message: "Figma import started",
    });
  } catch (error) {
    console.error("Error processing direct Figma import:", error);
    return NextResponse.json({ error: "Failed to process Figma import" }, { status: 500 });
  }
}
