import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Enqueue a job when E2B service is unavailable
 */
export const enqueue = mutation({
  args: {
    type: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    payload: v.any(),
    priority: v.optional(
      v.union(v.literal("high"), v.literal("normal"), v.literal("low"))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const jobId = await ctx.db.insert("jobQueue", {
      type: args.type,
      projectId: args.projectId,
      userId: args.userId,
      payload: args.payload,
      priority: args.priority || "normal",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });

    return jobId;
  },
});

/**
 * Get next pending job (highest priority first, then FIFO)
 */
export const getNextJob = query({
  args: {},
  handler: async (ctx) => {
    // Try high priority first
    let job = await ctx.db
      .query("jobQueue")
      .withIndex("by_status_priority", (q) =>
        q.eq("status", "PENDING").eq("priority", "high")
      )
      .order("asc")
      .first();

    if (job) return job;

    // Then normal priority
    job = await ctx.db
      .query("jobQueue")
      .withIndex("by_status_priority", (q) =>
        q.eq("status", "PENDING").eq("priority", "normal")
      )
      .order("asc")
      .first();

    if (job) return job;

    // Finally low priority
    job = await ctx.db
      .query("jobQueue")
      .withIndex("by_status_priority", (q) =>
        q.eq("status", "PENDING").eq("priority", "low")
      )
      .order("asc")
      .first();

    return job;
  },
});

/**
 * Get pending jobs for a specific user
 */
export const getUserJobs = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobQueue")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("status"), "COMPLETED"))
      .collect();
  },
});

/**
 * Get pending jobs for a specific project
 */
export const getProjectJobs = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobQueue")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.neq(q.field("status"), "COMPLETED"))
      .collect();
  },
});

/**
 * Mark job as processing
 */
export const markProcessing = mutation({
  args: {
    jobId: v.id("jobQueue"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    await ctx.db.patch(args.jobId, {
      status: "PROCESSING",
      attempts: job.attempts + 1,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.jobId);
  },
});

/**
 * Mark job as completed
 */
export const markCompleted = mutation({
  args: {
    jobId: v.id("jobQueue"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "COMPLETED",
      processedAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(args.jobId);
  },
});

/**
 * Mark job as failed
 */
export const markFailed = mutation({
  args: {
    jobId: v.id("jobQueue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    // If max attempts reached, mark as FAILED
    // Otherwise, return to PENDING for retry
    const maxAttempts = job.maxAttempts || 3;
    const shouldFail = job.attempts >= maxAttempts;

    await ctx.db.patch(args.jobId, {
      status: shouldFail ? "FAILED" : "PENDING",
      error: args.error,
      processedAt: shouldFail ? now : undefined,
      updatedAt: now,
    });

    return await ctx.db.get(args.jobId);
  },
});

/**
 * Get queue statistics
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("jobQueue").collect();

    const stats = {
      total: allJobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      byPriority: {
        high: 0,
        normal: 0,
        low: 0,
      },
      oldestPending: null as number | null,
    };

    let oldestPendingTime = Infinity;

    for (const job of allJobs) {
      // Count by status
      if (job.status === "PENDING") {
        stats.pending++;
        if (job.createdAt < oldestPendingTime) {
          oldestPendingTime = job.createdAt;
        }
      } else if (job.status === "PROCESSING") {
        stats.processing++;
      } else if (job.status === "COMPLETED") {
        stats.completed++;
      } else if (job.status === "FAILED") {
        stats.failed++;
      }

      // Count by priority (only for non-completed jobs)
      if (job.status !== "COMPLETED") {
        stats.byPriority[job.priority]++;
      }
    }

    if (oldestPendingTime !== Infinity) {
      stats.oldestPending = oldestPendingTime;
    }

    return stats;
  },
});

/**
 * Clean up old completed/failed jobs (cron)
 */
export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000; // 7 days

    // Find old completed/failed jobs
    const oldJobs = await ctx.db
      .query("jobQueue")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "COMPLETED"),
            q.eq(q.field("status"), "FAILED")
          ),
          q.lt(q.field("processedAt"), weekAgo)
        )
      )
      .collect();

    let deletedCount = 0;
    // Delete in batches
    for (const job of oldJobs.slice(0, 100)) {
      try {
        await ctx.db.delete(job._id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete job ${job._id}:`, error);
      }
    }

    return {
      deletedCount,
      totalOld: oldJobs.length,
      timestamp: now,
    };
  },
});
