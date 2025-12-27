import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, hasProAccess } from "./helpers";

// Constants matching the existing system
const FREE_POINTS = 5;
const PRO_POINTS = 100;
const DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const GENERATION_COST = 1;

/**
 * Check and consume credits for a generation
 * Returns true if credits were successfully consumed, false if insufficient credits
 */
export const checkAndConsumeCredit = mutation({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; remaining: number; message?: string }> => {
    const userId = await requireAuth(ctx);

    // Check user's plan
    const isPro = await hasProAccess(ctx);
    const maxPoints = isPro ? PRO_POINTS : FREE_POINTS;

    // Get current usage
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    const expiryTime = now + DURATION_MS;

    // If no usage record or expired, create/reset with max points
    if (!usage || (usage.expire && usage.expire < now)) {
      if (usage) {
        // Reset expired usage
        await ctx.db.patch(usage._id, {
          points: maxPoints - GENERATION_COST,
          expire: expiryTime,
          planType: isPro ? "pro" : "free",
        });
      } else {
        // Create new usage record
        await ctx.db.insert("usage", {
          userId,
          points: maxPoints - GENERATION_COST,
          expire: expiryTime,
          planType: isPro ? "pro" : "free",
        });
      }
      return { success: true, remaining: maxPoints - GENERATION_COST };
    }

    // Check if user has enough points
    if (usage.points < GENERATION_COST) {
      const timeUntilReset = usage.expire ? Math.ceil((usage.expire - now) / 1000 / 60) : 0;
      return {
        success: false,
        remaining: usage.points,
        message: `Insufficient credits. Your credits will reset in ${timeUntilReset} minutes.`
      };
    }

    // Consume the credit
    await ctx.db.patch(usage._id, {
      points: usage.points - GENERATION_COST,
    });

    return { success: true, remaining: usage.points - GENERATION_COST };
  },
});

/**
 * Get current usage stats for a user
 */
export const getUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const isPro = await hasProAccess(ctx);
    const maxPoints = isPro ? PRO_POINTS : FREE_POINTS;

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    // If no usage or expired, return max points
    if (!usage || (usage.expire && usage.expire < now)) {
      const expire = now + DURATION_MS;
      return {
        points: maxPoints,
        maxPoints,
        expire,
        planType: isPro ? "pro" : "free",
        // Aliases for compatibility
        remainingPoints: maxPoints,
        creditsRemaining: maxPoints,
        msBeforeNext: DURATION_MS,
      };
    }

    const expire = usage.expire || now + DURATION_MS;
    return {
      points: usage.points,
      maxPoints,
      expire,
      planType: usage.planType || (isPro ? "pro" : "free"),
      // Aliases for compatibility
      remainingPoints: usage.points,
      creditsRemaining: usage.points,
      msBeforeNext: expire - now,
    };
  },
});

/**
 * Admin function to reset usage for a user
 */
export const resetUsage = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // In production, add admin authorization check here
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (usage) {
      await ctx.db.delete(usage._id);
    }
  },
});

/**
 * Internal: Get usage for a specific user (for use from actions/background jobs)
 */
export const getUsageInternal = async (
  ctx: any,
  userId: string
): Promise<{
  points: number;
  maxPoints: number;
  expire: number;
  planType: string;
  remainingPoints: number;
  creditsRemaining: number;
  msBeforeNext: number;
}> => {
  const isPro = await hasProAccess(ctx, userId).catch(() => false);
  const maxPoints = isPro ? PRO_POINTS : FREE_POINTS;

  const usage = await ctx.db
    .query("usage")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  const now = Date.now();

  if (!usage || (usage.expire && usage.expire < now)) {
    const expire = now + DURATION_MS;
    return {
      points: maxPoints,
      maxPoints,
      expire,
      planType: isPro ? "pro" : "free",
      remainingPoints: maxPoints,
      creditsRemaining: maxPoints,
      msBeforeNext: DURATION_MS,
    };
  }

  const expire = usage.expire || now + DURATION_MS;
  return {
    points: usage.points,
    maxPoints,
    expire,
    planType: usage.planType || (isPro ? "pro" : "free"),
    remainingPoints: usage.points,
    creditsRemaining: usage.points,
    msBeforeNext: expire - now,
  };
};

/**
 * Wrapper query for getting usage with explicit user ID (for use from actions)
 */
export const getUsageForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return getUsageInternal(ctx, args.userId);
  },
});

/**
 * Wrapper mutation for checking and consuming credit with explicit user ID (for use from actions)
 */
export const checkAndConsumeCreditForUser = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return checkAndConsumeCreditInternal(ctx, args.userId);
  },
});

/**
 * Internal: Check and consume credit for a specific user (for use from actions/background jobs)
 */
export const checkAndConsumeCreditInternal = async (
  ctx: any,
  userId: string
): Promise<{ success: boolean; remaining: number; message?: string }> => {
  const isPro = await hasProAccess(ctx, userId).catch(() => false);
  const maxPoints = isPro ? PRO_POINTS : FREE_POINTS;

  const usage = await ctx.db
    .query("usage")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  const now = Date.now();
  const expiryTime = now + DURATION_MS;

  if (!usage || (usage.expire && usage.expire < now)) {
    if (usage) {
      await ctx.db.patch(usage._id, {
        points: maxPoints - GENERATION_COST,
        expire: expiryTime,
        planType: isPro ? "pro" : "free",
      });
    } else {
      await ctx.db.insert("usage", {
        userId,
        points: maxPoints - GENERATION_COST,
        expire: expiryTime,
        planType: isPro ? "pro" : "free",
      });
    }
    return { success: true, remaining: maxPoints - GENERATION_COST };
  }

  if (usage.points < GENERATION_COST) {
    const timeUntilReset = usage.expire ? Math.ceil((usage.expire - now) / 1000 / 60) : 0;
    return {
      success: false,
      remaining: usage.points,
      message: `Insufficient credits. Your credits will reset in ${timeUntilReset} minutes.`
    };
  }

  await ctx.db.patch(usage._id, {
    points: usage.points - GENERATION_COST,
  });

  return { success: true, remaining: usage.points - GENERATION_COST };
};
