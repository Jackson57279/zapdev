import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

/**
 * Check and increment rate limit for a given key
 * Returns whether the request is allowed and rate limit information
 */
export const checkRateLimit = mutation({
  args: {
    key: v.string(),
    limit: v.number(), // Max requests allowed in window
    windowMs: v.number(), // Window duration in milliseconds
  },
  handler: async (ctx, args): Promise<RateLimitResult> => {
    const { key, limit, windowMs } = args;
    const now = Date.now();

    // Find existing rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      // Check if window has expired
      if (now - existing.windowStart >= existing.windowMs) {
        // Reset window
        await ctx.db.patch(existing._id, {
          count: 1,
          windowStart: now,
          limit,
          windowMs,
        });
        return {
          success: true,
          remaining: limit - 1,
          resetTime: now + windowMs,
        };
      }

      // Check if limit exceeded
      if (existing.count >= existing.limit) {
        const resetTime = existing.windowStart + existing.windowMs;
        return {
          success: false,
          remaining: 0,
          resetTime,
          message: `Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)} seconds.`,
        };
      }

      // Increment count
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
      });

      return {
        success: true,
        remaining: existing.limit - existing.count - 1,
        resetTime: existing.windowStart + existing.windowMs,
      };
    }

    // Create new rate limit record
    await ctx.db.insert("rateLimits", {
      key,
      count: 1,
      windowStart: now,
      limit,
      windowMs,
    });

    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  },
});

/**
 * Reset rate limits that have expired (cleanup function)
 */
export const resetExpiredRateLimits = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now();

    // Find all rate limits and filter expired ones in memory
    // (Convex doesn't support arithmetic in query filters)
    const allLimits = await ctx.db.query("rateLimits").collect();

    const expiredLimits = allLimits.filter(
      (limit) => limit.windowStart + limit.windowMs < now
    );

    // Delete expired records
    for (const limit of expiredLimits) {
      await ctx.db.delete(limit._id);
    }

    return expiredLimits.length;
  },
});

/**
 * Get current rate limit status for a key (for monitoring/debugging)
 */
export const getRateLimitStatus = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args): Promise<{
    count: number;
    limit: number;
    windowStart: number;
    resetTime: number;
    remaining: number;
  } | null> => {
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!existing) {
      return null;
    }

    const resetTime = existing.windowStart + existing.windowMs;
    const remaining = Math.max(0, existing.limit - existing.count);

    return {
      count: existing.count,
      limit: existing.limit,
      windowStart: existing.windowStart,
      resetTime,
      remaining,
    };
  },
});

/**
 * Helper function to generate rate limit keys
 */
export const generateRateLimitKey = {
  byUser: (userId: string, action?: string) =>
    action ? `user_${userId}_${action}` : `user_${userId}`,

  byIP: (ip: string, action?: string) =>
    action ? `ip_${ip}_${action}` : `ip_${ip}`,

  byEndpoint: (endpoint: string) => `endpoint_${endpoint}`,
};
