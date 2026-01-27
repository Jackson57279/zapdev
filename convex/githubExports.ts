import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";
import { githubExportStatusEnum } from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildTreeEntries,
  createBranchRef,
  createCommit,
  createTree,
  getBranchRef,
  getCommitTreeSha,
  getRepository,
  updateBranchRef,
  withDefaultFiles,
  type ProjectFramework,
} from "../src/lib/github-api";
import { filterFilesForDownload } from "../src/lib/filter-ai-files";

const githubExportRecord = v.object({
  _id: v.id("githubExports"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.string(),
  repositoryName: v.string(),
  repositoryUrl: v.string(),
  repositoryFullName: v.string(),
  branch: v.optional(v.string()),
  commitSha: v.optional(v.string()),
  status: githubExportStatusEnum,
  error: v.optional(v.string()),
  fileCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeFiles = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
  }

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content === "string") {
      files[path] = content;
    }
  }

  return files;
};

type MessageWithFragment = {
  _id: Id<"messages">;
  _creationTime: number;
  Fragment: {
    _id: Id<"fragments">;
    files?: unknown;
    framework: ProjectFramework;
  } | null;
};

export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(githubExportRecord),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("githubExports")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    exportId: v.id("githubExports"),
  },
  returns: githubExportRecord,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const exportRecord = await ctx.db.get(args.exportId);
    if (!exportRecord) {
      throw new Error("Export not found");
    }
    if (exportRecord.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return exportRecord;
  },
});

export const getLatest = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(githubExportRecord, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("githubExports")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    repositoryName: v.string(),
    repositoryUrl: v.string(),
    repositoryFullName: v.string(),
    branch: v.optional(v.string()),
  },
  returns: v.id("githubExports"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    return await ctx.db.insert("githubExports", {
      projectId: args.projectId,
      userId,
      repositoryName: args.repositoryName,
      repositoryUrl: args.repositoryUrl,
      repositoryFullName: args.repositoryFullName,
      branch: args.branch,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    exportId: v.id("githubExports"),
    status: githubExportStatusEnum,
    error: v.optional(v.string()),
  },
  returns: v.id("githubExports"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const exportRecord = await ctx.db.get(args.exportId);
    if (!exportRecord) {
      throw new Error("Export not found");
    }
    if (exportRecord.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.exportId, {
      status: args.status,
      ...(args.error !== undefined && { error: args.error }),
      updatedAt: Date.now(),
    });

    return args.exportId;
  },
});

export const complete = mutation({
  args: {
    exportId: v.id("githubExports"),
    commitSha: v.string(),
    branch: v.string(),
    fileCount: v.number(),
  },
  returns: v.id("githubExports"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const exportRecord = await ctx.db.get(args.exportId);
    if (!exportRecord) {
      throw new Error("Export not found");
    }
    if (exportRecord.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.exportId, {
      commitSha: args.commitSha,
      branch: args.branch,
      fileCount: args.fileCount,
      status: "complete",
      updatedAt: Date.now(),
    });

    return args.exportId;
  },
});

export const exportToGitHub = action({
  args: {
    exportId: v.id("githubExports"),
    branch: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    includeGitignore: v.optional(v.boolean()),
    commitMessage: v.optional(v.string()),
  },
  returns: v.object({
    exportId: v.id("githubExports"),
    repositoryUrl: v.string(),
    repositoryFullName: v.string(),
    branch: v.string(),
    commitSha: v.string(),
    fileCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("Unauthorized");
    }

    const exportRecord: Doc<"githubExports"> = await ctx.runQuery(
      api.githubExports.get,
      { exportId: args.exportId },
    );

    await ctx.runMutation(api.githubExports.updateStatus, {
      exportId: args.exportId,
      status: "processing",
    });

    try {
      const project: Doc<"projects"> = await ctx.runQuery(api.projects.get, {
        projectId: exportRecord.projectId,
      });

      const messages: Array<MessageWithFragment> = await ctx.runQuery(
        api.messages.list,
        { projectId: exportRecord.projectId },
      );

      const latestWithFragment = [...messages]
        .reverse()
        .find((message) => message.Fragment);

      const fragment = latestWithFragment?.Fragment;
      if (!fragment) {
        throw new Error("No AI-generated files are ready to export.");
      }

      const normalized = normalizeFiles(fragment.files);
      const filtered = filterFilesForDownload(normalized);
      if (Object.keys(filtered).length === 0) {
        throw new Error("No AI-generated files are ready to export.");
      }

      const includeReadme = args.includeReadme ?? true;
      const includeGitignore = args.includeGitignore ?? true;
      const files = withDefaultFiles(
        filtered,
        {
          projectName: project.name,
          framework: fragment.framework,
        },
        includeReadme,
        includeGitignore,
      );

      const treeEntries = buildTreeEntries(files);
      const accessToken = await ctx.runQuery(internal.oauth.getGithubAccessToken, {
        userId: identity.subject,
      });
      if (!accessToken) {
        throw new Error("GitHub connection not found. Please connect GitHub.");
      }

      const repository = await getRepository(
        accessToken,
        exportRecord.repositoryFullName,
      );
      const defaultBranch = repository.default_branch ?? "main";
      const targetBranch = args.branch ?? exportRecord.branch ?? defaultBranch;

      let baseCommitSha: string | null = null;
      let baseTreeSha: string | undefined;
      let needsCreateBranch = false;

      try {
        baseCommitSha = await getBranchRef(
          accessToken,
          repository.full_name,
          targetBranch,
        );
        baseTreeSha = await getCommitTreeSha(
          accessToken,
          repository.full_name,
          baseCommitSha,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "GitHub error";
        if (
          targetBranch !== defaultBranch &&
          message.toLowerCase().includes("not found")
        ) {
          baseCommitSha = await getBranchRef(
            accessToken,
            repository.full_name,
            defaultBranch,
          );
          baseTreeSha = await getCommitTreeSha(
            accessToken,
            repository.full_name,
            baseCommitSha,
          );
          needsCreateBranch = true;
        } else {
          throw error;
        }
      }

      if (!baseCommitSha) {
        throw new Error("Unable to resolve base branch for export.");
      }

      const treeSha = await createTree(
        accessToken,
        repository.full_name,
        treeEntries,
        baseTreeSha,
      );
      const commitSha = await createCommit(
        accessToken,
        repository.full_name,
        args.commitMessage ?? "Export project from ZapDev",
        treeSha,
        baseCommitSha ? [baseCommitSha] : [],
      );

      if (needsCreateBranch) {
        await createBranchRef(
          accessToken,
          repository.full_name,
          targetBranch,
          commitSha,
        );
      } else {
        await updateBranchRef(
          accessToken,
          repository.full_name,
          targetBranch,
          commitSha,
        );
      }

      await ctx.runMutation(api.githubExports.complete, {
        exportId: args.exportId,
        commitSha,
        branch: targetBranch,
        fileCount: treeEntries.length,
      });

      return {
        exportId: args.exportId,
        repositoryUrl: exportRecord.repositoryUrl,
        repositoryFullName: exportRecord.repositoryFullName,
        branch: targetBranch,
        commitSha,
        fileCount: treeEntries.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      await ctx.runMutation(api.githubExports.updateStatus, {
        exportId: args.exportId,
        status: "failed",
        error: message,
      });
      throw error;
    }
  },
});
