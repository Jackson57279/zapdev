import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

/**
 * Get the current user's active subscription
 */
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return subscription;
  },
});

/**
 * Get subscription by Clerk subscription ID (for internal use)
 */
export const getSubscriptionByClerkId = query({
  args: {
    clerkSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerkSubscriptionId", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId)
      )
      .first();

    return subscription;
  },
});

/**
 * Create or update a subscription (called from Clerk webhook handler)
 */
export const createOrUpdateSubscription = mutation({
  args: {
    userId: v.string(),
    clerkSubscriptionId: v.string(),
    planId: v.string(),
    planName: v.string(),
    status: v.union(
      v.literal("incomplete"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("trialing"),
      v.literal("revoked")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    features: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerkSubscriptionId", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId)
      )
      .first();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status,
        planId: args.planId,
        planName: args.planName,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        features: args.features,
        metadata: args.metadata,
        updatedAt: now,
      });

      return existing._id;
    } else {
      // Create new subscription
      const subscriptionId = await ctx.db.insert("subscriptions", {
        userId: args.userId,
        clerkSubscriptionId: args.clerkSubscriptionId,
        planId: args.planId,
        planName: args.planName,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        features: args.features,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });

      return subscriptionId;
    }
  },
});

/**
 * Cancel a subscription (sets cancel_at_period_end flag)
 * The actual cancellation happens via Clerk Billing API, this just updates local state
 */
export const markSubscriptionForCancellation = mutation({
  args: {
    clerkSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerkSubscriptionId", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(subscription._id, {
      cancelAtPeriodEnd: true,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});

/**
 * Reactivate a canceled subscription
 */
export const reactivateSubscription = mutation({
  args: {
    clerkSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerkSubscriptionId", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(subscription._id, {
      cancelAtPeriodEnd: false,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});

/**
 * Update subscription status to canceled (called when subscription is revoked)
 */
export const revokeSubscription = mutation({
  args: {
    clerkSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerkSubscriptionId", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(subscription._id, {
      status: "revoked",
      cancelAtPeriodEnd: false,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});

/**
 * Get all subscriptions for a user (admin function)
 */
export const getUserSubscriptions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return subscriptions;
  },
});
