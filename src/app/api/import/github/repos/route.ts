import { NextResponse } from "next/server";
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  updated_at: string;
  stargazers_count: number;
}

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
    const connection = await convex.query(api.oauth.getConnection, {
      provider: "github",
    });

    if (!connection) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 401 }
      );
    }

    // Fetch repositories from GitHub API
    const response = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "User-Agent": "ZapDev",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired or revoked
        return NextResponse.json(
          { error: "GitHub token invalid, please reconnect" },
          { status: 401 }
        );
      }
      throw new Error("Failed to fetch GitHub repositories");
    }

    const repos = await response.json() as GitHubRepo[];

    return NextResponse.json({
      repositories: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        private: repo.private,
        language: repo.language,
        updatedAt: repo.updated_at,
        starsCount: repo.stargazers_count,
      })),
    });
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}
