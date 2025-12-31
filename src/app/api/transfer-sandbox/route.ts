import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getSandbox,
  startDevServer,
  frameworkToConvexEnum,
  type Framework,
} from "@/agents";

let convexClient: ConvexHttpClient | null = null;
function getConvexClient() {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fragmentId } = body;

    if (!fragmentId) {
      return NextResponse.json(
        { error: "Fragment ID is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    const fragment = await convex.query(api.messages.getFragmentById, {
      fragmentId: fragmentId as Id<"fragments">,
    });

    if (!fragment) {
      return NextResponse.json(
        { error: "Fragment not found" },
        { status: 404 }
      );
    }

    if (!fragment.sandboxId) {
      return NextResponse.json(
        { error: "Fragment has no sandbox" },
        { status: 400 }
      );
    }

    const message = await convex.query(api.messages.get, {
      messageId: fragment.messageId as Id<"messages">,
    });
    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const project = await convex.query(api.projects.getForSystem, {
      projectId: message.projectId as Id<"projects">,
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const framework = (fragment.framework?.toLowerCase() ||
      "nextjs") as Framework;
    const sandboxId = fragment.sandboxId;

    try {
      const sandbox = await getSandbox(sandboxId);
      const sandboxUrl = await startDevServer(sandbox, framework);

      await convex.mutation(api.messages.createFragmentForUser, {
        userId: project.userId,
        messageId: fragment.messageId,
        sandboxId: fragment.sandboxId || undefined,
        sandboxUrl: sandboxUrl,
        title: fragment.title,
        files: fragment.files,
        framework: frameworkToConvexEnum(framework),
        metadata: fragment.metadata,
      });

      return NextResponse.json({
        success: true,
        sandboxId,
        sandboxUrl,
      });
    } catch (error) {
      console.error("[ERROR] Failed to resume sandbox:", error);
      return NextResponse.json(
        { error: "Sandbox is no longer active. Please trigger a new build." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[ERROR] Failed to transfer sandbox:", error);
    return NextResponse.json(
      { error: "Failed to transfer sandbox" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
