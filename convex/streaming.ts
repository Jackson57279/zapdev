import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateProgress = mutation({
  args: {
    taskId: v.string(),
    status: v.string(),
    stage: v.string(),
    message: v.string(),
    streamedContent: v.optional(v.string()),
    files: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskProgress")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        stage: args.stage,
        message: args.message,
        streamedContent: args.streamedContent,
        files: args.files,
        error: args.error,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("taskProgress", {
        taskId: args.taskId,
        status: args.status,
        stage: args.stage,
        message: args.message,
        streamedContent: args.streamedContent,
        files: args.files,
        error: args.error,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const getProgress = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskProgress")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
  },
});

export const deleteProgress = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskProgress")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
