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
    const file = form.get("figmaFile") as File | null;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Please upload a .fig file" }, { status: 400 });
    }

    const fileName = file.name;
    if (!fileName.toLowerCase().endsWith(".fig")) {
      return NextResponse.json({ error: "Only .fig files are supported" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileBase64 = fileBuffer.toString("base64");

    const sourceId = fileName;
    const sourceUrl = "figma-file-upload";

    const importId = await fetchMutation(api.imports.createImport as unknown as FunctionReference<"mutation">, {
      projectId,
      source: "FIGMA",
      sourceId,
      sourceName: fileName,
      sourceUrl,
      metadata: {
        inputType: "file",
        fileName,
      },
    });

    await inngest.send({
      name: "agent/figma-import.run",
      data: {
        projectId,
        importId,
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
