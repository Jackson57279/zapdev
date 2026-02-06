import { NextResponse } from "next/server";
import { getUser, getToken } from "@/lib/auth-server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    const accessToken = await fetchAction(
      api.oauth.getAccessTokenForCurrentUser,
      { provider: "figma" as const },
      { token: token ?? undefined },
    ) as string | null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Figma not connected" },
        { status: 401 }
      );
    }

    // Fetch files from Figma API
    const response = await fetch("https://api.figma.com/v1/files", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
