import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET() {
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
