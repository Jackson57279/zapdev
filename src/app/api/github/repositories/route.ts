import { NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { getUser } from "@/lib/auth-server";
import { listRepositories } from "@/lib/github-api";

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await fetchAction(api.oauth.getGithubAccessTokenForCurrentUser, {});
    if (!accessToken) {
      return NextResponse.json(
        { error: "GitHub connection not found. Please connect GitHub." },
        { status: 400 },
      );
    }

    const repositories = await listRepositories(accessToken);

    return NextResponse.json({
      repositories: repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch ?? "main",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
