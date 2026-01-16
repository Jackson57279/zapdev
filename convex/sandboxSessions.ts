import { mutation, query, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Create a new sandbox session
 */
export const create = mutation({
  args: {
    sandboxId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    framework: v.union(
      v.literal("NEXTJS"),
      v.literal("ANGULAR"),
      v.literal("REACT"),
      v.literal("VUE"),
      v.literal("SVELTE"),
      v.literal("EXPO")
    ),
    autoPauseTimeout: v.optional(v.number()), // Default 10 minutes
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const autoPauseTimeout = args.autoPauseTimeout || 10 * 60 * 1000; // Default 10 minutes

    const sessionId = await ctx.db.insert("sandboxSessions", {
      sandboxId: args.sandboxId,
      projectId: args.projectId,
      userId: args.userId,
      framework: args.framework,
      state: "RUNNING",
      lastActivity: now,
      autoPauseTimeout,
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

/**
 * Get sandbox session by ID
 */
export const getById = query({
  args: {
    sessionId: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Get sandbox session by sandbox ID
 */
export const getBySandboxId = query({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxSessions")
      .filter((q) => q.eq(q.field("sandboxId"), args.sandboxId))
      .first();
  },
});

/**
 * Get all active sessions for a project
 */
export const getByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxSessions")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Get all active sessions for a user
 */
export const getByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Get all running sessions (for auto-pause job)
 */
export const getRunning = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sandboxSessions")
      .withIndex("by_state", (q) => q.eq("state", "RUNNING"))
      .collect();
  },
});

/**
 * Update sandbox state (RUNNING, PAUSED, KILLED)
 */
export const updateState = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    state: v.union(
      v.literal("RUNNING"),
      v.literal("PAUSED"),
      v.literal("KILLED")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updateData: any = {
      state: args.state,
      updatedAt: now,
    };

    if (args.state === "PAUSED") {
      updateData.pausedAt = now;
    }

    await ctx.db.patch(args.sessionId, updateData);
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Update last activity timestamp
 */
export const updateLastActivity = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      lastActivity: now,
      updatedAt: now,
      // Resume if paused
      state: "RUNNING",
    });
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Update last activity by sandbox ID (for tRPC endpoint)
 */
export const updateLastActivityBySandboxId = mutation({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sandboxSessions")
      .filter((q) => q.eq(q.field("sandboxId"), args.sandboxId))
      .first();

    if (!session) {
      throw new Error(`Sandbox session not found: ${args.sandboxId}`);
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      lastActivity: now,
      updatedAt: now,
      // Resume if paused
      state: "RUNNING",
    });
    return await ctx.db.get(session._id);
  },
});

/**
 * Delete sandbox session
 */
export const delete_ = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sessionId);
  },
});

/**
 * Delete sandbox session by sandbox ID
 */
export const deleteBySandboxId = mutation({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sandboxSessions")
      .filter((q) => q.eq(q.field("sandboxId"), args.sandboxId))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

/**
 * Internal mutation to clean up expired sandboxes (>30 days old)
 * Call this periodically to remove old sandbox sessions
 */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const expired = await ctx.db
      .query("sandboxSessions")
      .collect()
      .then((sessions) =>
        sessions.filter((session) => session.createdAt < thirtyDaysAgo)
      );

    let deletedCount = 0;
    for (const session of expired) {
      try {
        await ctx.db.delete(session._id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete sandbox session ${session._id}:`, error);
      }
    }

    return {
      deletedCount,
      totalExpired: expired.length,
    };
  },
});
