import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { taskStatusEnum, taskStageEnum } from "./schema";

export const updateProgress = mutation({
  args: {
    taskId: v.string(),
    status: taskStatusEnum,
    stage: taskStageEnum,
    message: v.string(),
    streamedContent: v.optional(v.string()),
    files: v.optional(v.any()), // Record<string, string> - maps file paths to file contents
    error: v.optional(v.string()),
  },
  returns: v.id("taskProgress"),
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
  returns: v.optional(
    v.object({
      _id: v.id("taskProgress"),
      taskId: v.string(),
      status: taskStatusEnum,
      stage: taskStageEnum,
      message: v.string(),
      streamedContent: v.optional(v.string()),
      files: v.optional(v.any()),
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskProgress")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
  },
});

export const deleteProgress = mutation({
  args: { taskId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskProgress")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
