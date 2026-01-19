import { NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClientWithAuth, getUser } from "@/lib/auth-server";
import {
  createRepository,
  getRepository,
  type CreateRepositoryInput,
} from "@/lib/github-api";

const exportRequestSchema = z
  .object({
    repositoryName: z.string().trim().min(1).optional(),
    repositoryFullName: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    isPrivate: z.boolean().optional(),
    branch: z.string().trim().optional(),
    includeReadme: z.boolean().optional(),
    includeGitignore: z.boolean().optional(),
    commitMessage: z.string().trim().optional(),
  })
  .refine((data) => data.repositoryFullName || data.repositoryName, {
    message: "Repository name is required.",
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const body = exportRequestSchema.parse(await request.json());
    
    // We don't need the access token here anymore since the export action handles it
    // But we still need to check if the connection exists
    const connection = await fetchQuery(api.oauth.getConnection, { provider: "github" }, { token: (await getToken()) ?? undefined });

    if (!connection) {
      return NextResponse.json(
        { error: "GitHub connection not found. Please connect GitHub." },
        { status: 400 },
      );
    }

    let repository;
    if (body.repositoryFullName) {
      repository = await getRepository(accessToken, body.repositoryFullName);
    } else {
      if (!body.repositoryName) {
        return NextResponse.json(
          { error: "Repository name is required." },
          { status: 400 },
        );
      }

      const input: CreateRepositoryInput = {
        name: body.repositoryName,
        description: body.description,
        isPrivate: body.isPrivate ?? false,
      };
      repository = await createRepository(accessToken, input);
    }

    const branch = body.branch ?? repository.default_branch ?? "main";

    const exportId = await fetchMutation(api.githubExports.create, {
      projectId: projectId as Id<"projects">,
      repositoryName: repository.name,
      repositoryUrl: repository.html_url,
      repositoryFullName: repository.full_name,
      branch,
    });

    const convex = await getConvexClientWithAuth();
    const result = await convex.action(api.githubExports.exportToGitHub, {
      exportId,
      branch,
      includeReadme: body.includeReadme,
      includeGitignore: body.includeGitignore,
      commitMessage: body.commitMessage,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const exportId = searchParams.get("exportId");

    if (!exportId) {
      return NextResponse.json({ error: "Missing exportId" }, { status: 400 });
    }

    const record = await fetchQuery(api.githubExports.get, {
      exportId: exportId as Id<"githubExports">,
    });

    if (!record) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
