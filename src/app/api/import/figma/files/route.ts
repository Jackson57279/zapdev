import { NextResponse } from "next/server";
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const stackUser = await getUser();
  if (!stackUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stackUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const convex = await getConvexClientWithAuth();
    // Get OAuth connection
    const connection = await convex.query((api as any).oauth.getConnection, {
      provider: "figma",
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Figma not connected" },
        { status: 401 }
      );
    }

    // Fetch files from Figma API
    const response = await fetch("https://api.figma.com/v1/files", {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired
        return NextResponse.json(
          { error: "Figma token expired, please reconnect" },
          { status: 401 }
        );
      }
      throw new Error("Failed to fetch Figma files");
    }

    const data = await response.json();

    return NextResponse.json({
      files: data.files || [],
    });
  } catch (error) {
    console.error("Error fetching Figma files:", error);
    return NextResponse.json(
      { error: "Failed to fetch Figma files" },
      { status: 500 }
    );
  }
}
