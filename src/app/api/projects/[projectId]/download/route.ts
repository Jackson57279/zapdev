import JSZip from "jszip";
import { NextResponse } from "next/server";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexClientWithAuth, getUser } from "@/lib/auth-server";
import { filterAIGeneratedFiles } from "@/lib/filter-ai-files";

type FragmentFileMap = Record<string, string>;

type MessageWithFragment = {
  _id: Id<"messages">;
  createdAt?: number;
  _creationTime: number;
  Fragment: {
    _id: Id<"fragments">;
    files?: unknown;
    updatedAt?: number;
    createdAt?: number;
  } | null;
};

const normalizeFiles = (value: unknown): FragmentFileMap => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<FragmentFileMap>(
    (acc, [path, content]) => {
      if (typeof content === "string") {
        acc[path] = content;
      }
      return acc;
    },
    {},
  );
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const convex = await getConvexClientWithAuth();
    const convexProjectId = projectId as Id<"projects">;

    // Ensure the project exists and belongs to the user
    await convex.query(api.projects.get, { projectId: convexProjectId });

    const messages = await convex.query(api.messages.list, {
      projectId: convexProjectId,
    }) as MessageWithFragment[];

    const latestWithFragment = [...messages].reverse().find(
      (message) => message.Fragment,
    );

    const fragment = latestWithFragment?.Fragment;
    if (!fragment) {
      return NextResponse.json(
        { error: "No AI-generated files are ready to download." },
        { status: 404 },
      );
    }

    const normalizedFiles = normalizeFiles(fragment.files);
    const aiFiles = filterAIGeneratedFiles(normalizedFiles);

    const fileEntries = Object.entries(aiFiles);
    if (fileEntries.length === 0) {
      return NextResponse.json(
        { error: "No AI-generated files are ready to download." },
        { status: 404 },
      );
    }

    const zip = new JSZip();
    fileEntries.forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    const archive = await zip.generateAsync({ type: "uint8array" });
    const archiveBuffer = new ArrayBuffer(archive.byteLength);
    new Uint8Array(archiveBuffer).set(archive);
    const filename = `project-${projectId}-latest-fragment.zip`;

    return new NextResponse(archiveBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("unauthorized")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (message.includes("not found")) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    console.error("[ERROR] Failed to prepare project download:", error);
    return NextResponse.json(
      { error: "Failed to prepare download" },
      { status: 500 },
    );
  }
}

