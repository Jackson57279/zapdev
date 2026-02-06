import { NextResponse } from "next/server";
import { getUser, getToken } from "@/lib/auth-server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { repoId, repoName, repoFullName, repoUrl, projectId } = body;

    if (!repoId || !projectId || !repoName || !repoFullName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const token = await getToken();
    const accessToken = await fetchAction(
      api.oauth.getAccessTokenForCurrentUser,
      { provider: "github" as const },
      { token: token ?? undefined },
    ) as string | null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 401 }
      );
    }

    // Fetch repository details
    const repoResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "ZapDev",
        },
      }
    );

    if (!repoResponse.ok) {
      throw new Error("Failed to fetch GitHub repository details");
    }

    const repoData = await repoResponse.json();

    // Create import record in Convex
    const importRecord = await fetchMutation((api as any).imports.createImport, {
      projectId,
      source: "GITHUB",
      sourceId: repoId.toString(),
      sourceName: repoName,
      sourceUrl: repoUrl || repoData.html_url,
      metadata: {
        githubRepoData: {
          fullName: repoData.full_name,
          description: repoData.description,
          language: repoData.language,
          defaultBranch: repoData.default_branch,
          topics: repoData.topics || [],
          isPrivate: repoData.private,
        },
      },
    });

    // TODO: Trigger Inngest job to process GitHub import
    // await inngest.send({
    //   name: "code-agent/process-github-import",
    //   data: { importId, projectId, repoFullName, repoUrl }
    // });

    return NextResponse.json({
      success: true,
      importId: importRecord,
      message: "GitHub repository import started",
    });
  } catch (error) {
    console.error("Error processing GitHub import:", error);
    return NextResponse.json(
      { error: "Failed to process GitHub import" },
      { status: 500 }
    );
  }
}
