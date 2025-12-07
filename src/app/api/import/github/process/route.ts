import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stackUser = await getUser();
  if (!stackUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

   if (!stackUser.id) {
     return Response.json({ error: "Unauthorized" }, { status: 401 });
   }

   try {
    const body = await request.json();
    const { repoId, repoName, repoFullName, repoUrl, projectId } = body;

    if (!repoId || !projectId || !repoName || !repoFullName) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    // Fetch repository details
    const repoResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}`,
      {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "User-Agent": "ZapDev",
        },
      }
    );

    if (!repoResponse.ok) {
      throw new Error("Failed to fetch GitHub repository details");
    }

    const repoData = await repoResponse.json();

    // Create import record in Convex
    const importRecord = await convex.mutation(api.imports.createImport, {
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

    return Response.json({
      success: true,
      importId: importRecord,
      message: "GitHub repository import started",
    });
  } catch (error) {
    console.error("Error processing GitHub import:", error);
    return Response.json(
      { error: "Failed to process GitHub import" },
      { status: 500 }
    );
  }
}
