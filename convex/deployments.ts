import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./helpers";

const deploymentStatusEnum = v.union(
  v.literal("pending"),
  v.literal("building"),
  v.literal("ready"),
  v.literal("error")
);

export const createDeployment = mutation({
  args: {
    projectId: v.id("projects"),
    platform: v.literal("netlify"),
    siteId: v.string(),
    siteUrl: v.string(),
    deployId: v.optional(v.string()),
    status: deploymentStatusEnum,
    isPreview: v.optional(v.boolean()),
    branch: v.optional(v.string()),
    commitRef: v.optional(v.string()),
  },
  returns: v.id("deployments"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const counter = await ctx.db
      .query("projectDeploymentCounters")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .first();

    const now = Date.now();
    let nextDeployNumber: number;

    if (counter) {
      nextDeployNumber = counter.deployNumber + 1;
      await ctx.db.patch(counter._id, {
        deployNumber: nextDeployNumber,
        updatedAt: now,
      });
    } else {
      nextDeployNumber = 1;
      await ctx.db.insert("projectDeploymentCounters", {
        projectId: args.projectId,
        deployNumber: nextDeployNumber,
        createdAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.insert("deployments", {
      projectId: args.projectId,
      userId,
      platform: args.platform,
      siteId: args.siteId,
      siteUrl: args.siteUrl,
      deployId: args.deployId,
      deployNumber: nextDeployNumber,
      commitRef: args.commitRef,
      branch: args.branch,
      isPreview: args.isPreview ?? false,
      status: args.status,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDeployment = mutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.optional(deploymentStatusEnum),
    deployId: v.optional(v.string()),
    error: v.optional(v.string()),
    buildLog: v.optional(v.string()),
    buildTime: v.optional(v.number()),
  },
  returns: v.id("deployments"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.deploymentId, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.deployId !== undefined ? { deployId: args.deployId } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
      ...(args.buildLog !== undefined ? { buildLog: args.buildLog } : {}),
      ...(args.buildTime !== undefined ? { buildTime: args.buildTime } : {}),
      updatedAt: Date.now(),
    });

    return args.deploymentId;
  },
});

export const getDeployment = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("deployments"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.string(),
      platform: v.literal("netlify"),
      siteId: v.string(),
      siteUrl: v.string(),
      deployId: v.optional(v.string()),
      deployNumber: v.optional(v.number()),
      commitRef: v.optional(v.string()),
      branch: v.optional(v.string()),
      isPreview: v.optional(v.boolean()),
      buildLog: v.optional(v.string()),
      buildTime: v.optional(v.number()),
      previousDeployId: v.optional(v.id("deployments")),
      status: deploymentStatusEnum,
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("deployments")
      .withIndex("by_projectId_deployNumber", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
  },
});

export const listDeployments = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("deployments"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.string(),
      platform: v.literal("netlify"),
      siteId: v.string(),
      siteUrl: v.string(),
      deployId: v.optional(v.string()),
      deployNumber: v.optional(v.number()),
      commitRef: v.optional(v.string()),
      branch: v.optional(v.string()),
      isPreview: v.optional(v.boolean()),
      buildLog: v.optional(v.string()),
      buildTime: v.optional(v.number()),
      previousDeployId: v.optional(v.id("deployments")),
      status: deploymentStatusEnum,
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("deployments")
      .withIndex("by_projectId_deployNumber", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});
