import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import * as Sentry from "@sentry/node";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GitHubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  private: z.boolean(),
  language: z.string().nullable(),
  updated_at: z.string(),
  stargazers_count: z.number(),
});

type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

const GitHubReposSchema = z.array(GitHubRepoSchema);

export async function GET() {
  const stackUser = await getUser();
  if (!stackUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stackUser.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const convex = await getConvexClientWithAuth();
    // Get OAuth connection
    const connection = await convex.query(api.oauth.getConnection, {
      provider: "github",
    });

    if (!connection) {
      return Response.json(
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
        return Response.json(
          { error: "GitHub token invalid, please reconnect" },
          { status: 401 }
        );
      }
      throw new Error("Failed to fetch GitHub repositories");
    }

    const jsonData = await response.json();

    // Validate response shape with Zod
    let repos: GitHubRepo[];
    try {
      repos = GitHubReposSchema.parse(jsonData) as GitHubRepo[];
    } catch (validationError) {
      Sentry.captureException(validationError, {
        tags: {
          context: "github_repos_validation",
        },
      });
      return Response.json(
        { error: "Invalid GitHub API response format" },
        { status: 502 }
      );
    }

    return Response.json({
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
    Sentry.captureException(error);
    console.error("Error fetching GitHub repositories:", error);
    return Response.json(
      { error: "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}
