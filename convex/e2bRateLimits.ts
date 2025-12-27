import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record an E2B API request for rate limit tracking
 */
export const recordRequest = mutation({
  args: {
    operation: v.string(), // "sandbox_create", "sandbox_connect", etc.
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000; // 1 hour ago

    // Clean up old records (older than 1 hour) to prevent table bloat
    const oldRecords = await ctx.db
      .query("e2bRateLimits")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", hourAgo))
      .collect();

    // Delete old records in batches to avoid timeout
    const deletePromises = oldRecords.slice(0, 100).map((record) =>
      ctx.db.delete(record._id)
    );
    await Promise.all(deletePromises);

    // Record new request
    await ctx.db.insert("e2bRateLimits", {
      operation: args.operation,
      timestamp: now,
    });

    return { recorded: true, timestamp: now };
  },
});

/**
 * Check if rate limit is exceeded for a specific operation
 */
export const checkRateLimit = query({
  args: {
    operation: v.string(),
    maxPerHour: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const recentRequests = await ctx.db
      .query("e2bRateLimits")
      .withIndex("by_operation_timestamp", (q) =>
        q.eq("operation", args.operation).gt("timestamp", hourAgo)
      )
      .collect();

    const count = recentRequests.length;
    const exceeded = count >= args.maxPerHour;
    const remaining = Math.max(0, args.maxPerHour - count);

    return {
      count,
      limit: args.maxPerHour,
      exceeded,
      remaining,
      resetAt: hourAgo + 60 * 60 * 1000, // When the oldest record expires
    };
  },
});

/**
 * Get rate limit stats for all operations
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const recentRequests = await ctx.db
      .query("e2bRateLimits")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", hourAgo))
      .collect();

    // Group by operation
    const statsByOperation = recentRequests.reduce(
      (acc, request) => {
        if (!acc[request.operation]) {
          acc[request.operation] = 0;
        }
        acc[request.operation]++;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalRequests: recentRequests.length,
      byOperation: statsByOperation,
      timeWindow: "1 hour",
      timestamp: now,
    };
  },
});

/**
 * Clean up old rate limit records (cron job)
 * Run this periodically to prevent table bloat
 */
export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const oldRecords = await ctx.db
      .query("e2bRateLimits")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", hourAgo))
      .collect();

    let deletedCount = 0;
    // Delete in batches to avoid timeout
    for (const record of oldRecords.slice(0, 500)) {
      try {
        await ctx.db.delete(record._id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete rate limit record ${record._id}:`, error);
      }
    }

    return {
      deletedCount,
      totalOldRecords: oldRecords.length,
      timestamp: now,
    };
  },
});
