import { NextResponse } from "next/server";
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { runErrorFix } from "@/agents/code-agent";

type FixErrorsRequestBody = {
  fragmentId: string;
};

function isFixErrorsRequestBody(value: unknown): value is FixErrorsRequestBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const fragmentId = (value as { fragmentId?: unknown }).fragmentId;
  return typeof fragmentId === "string" && fragmentId.length > 0;
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexClient = await getConvexClientWithAuth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!isFixErrorsRequestBody(body)) {
      return NextResponse.json(
        { error: "Fragment ID is required" },
        { status: 400 }
      );
    }

    const { fragmentId } = body;

    try {
      await convexClient.query(api.messages.getFragmentByIdAuth, {
        fragmentId: fragmentId as Id<"fragments">,
      });

      const result = await runErrorFix(fragmentId);

      return NextResponse.json({
        success: result.success,
        message: result.message,
        summary: result.summary,
        remainingErrors: result.remainingErrors,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }
  } catch (error) {
    console.error("[ERROR] Failed to run error fix:", error);
    return NextResponse.json(
      { error: "Failed to run error fix" },
      { status: 500 }
    );
  }
}

export const maxDuration = 120;
