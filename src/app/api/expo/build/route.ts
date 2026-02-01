import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, projectId, fragmentId, profile = "preview" } = body;

    if (!platform || !["ios", "android", "all"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be 'ios', 'android', or 'all'" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();
    const fragment = fragmentId
      ? await convex.query(api.messages.getFragmentById, {
          fragmentId: fragmentId as Id<"fragments">,
        })
      : null;

    if (fragmentId && !fragment) {
      return NextResponse.json(
        { error: "Fragment not found" },
        { status: 404 }
      );
    }

    const expoToken = process.env.EXPO_ACCESS_TOKEN;
    if (!expoToken) {
      return NextResponse.json(
        {
          error: "EAS builds require EXPO_ACCESS_TOKEN environment variable",
          helpUrl: "https://expo.dev/accounts/[account]/settings/access-tokens",
        },
        { status: 503 }
      );
    }

    const buildRequest = {
      platform,
      profile,
      projectId,
      fragmentId,
      sandboxId: fragment?.sandboxId,
      requestedAt: Date.now(),
    };

    console.log("[EAS Build] Build request received:", buildRequest);

    return NextResponse.json({
      success: true,
      message: `EAS ${platform} build queued for ${profile} profile`,
      build: {
        ...buildRequest,
        status: "queued",
        estimatedTime:
          platform === "ios"
            ? "10-15 minutes"
            : platform === "android"
              ? "5-10 minutes"
              : "15-20 minutes",
      },
    });
  } catch (error) {
    console.error("[EAS Build] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to queue EAS build",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const buildId = searchParams.get("buildId");

  if (!buildId) {
    return NextResponse.json(
      { error: "buildId query parameter is required" },
      { status: 400 }
    );
  }

  const expoToken = process.env.EXPO_ACCESS_TOKEN;
  if (!expoToken) {
    return NextResponse.json(
      { error: "EXPO_ACCESS_TOKEN not configured" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`https://api.expo.dev/v2/builds/${buildId}`, {
      headers: {
        Authorization: `Bearer ${expoToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch build status: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      buildId,
      status: data.status,
      platform: data.platform,
      artifacts: data.artifacts,
      error: data.error,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
    });
  } catch (error) {
    console.error("[EAS Build Status] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch build status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
