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
 * Get subscription by Stripe subscription ID (for webhook use)
 */
export const getSubscriptionByStripeId = query({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    return subscription;
  },
});

/**
 * Get customer by Stripe customer ID
 */
export const getCustomerByStripeId = query({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    return customer;
  },
});

/**
 * Get customer by user ID
 */
export const getCustomerByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return customer;
  },
});

/**
 * Get current user's customer record
 */
export const getCustomer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return customer;
  },
});

/**
 * Create or update a customer (called from checkout or webhook)
 */
export const createOrUpdateCustomer = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if customer already exists
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing customer
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        email: args.email,
        name: args.name,
        updatedAt: now,
      });

      return existing._id;
    } else {
      // Create new customer
      const customerId = await ctx.db.insert("customers", {
        userId: args.userId,
        stripeCustomerId: args.stripeCustomerId,
        email: args.email,
        name: args.name,
        createdAt: now,
        updatedAt: now,
      });

      return customerId;
    }
  },
});

/**
 * Create or update a subscription (called from Stripe webhook handler)
 */
export const createOrUpdateSubscription = mutation({
  args: {
    userId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    stripePriceId: v.string(),
    planName: v.string(),
    status: v.union(
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("paused")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status,
        stripePriceId: args.stripePriceId,
        planName: args.planName,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        endedAt: args.endedAt,
        metadata: args.metadata,
        updatedAt: now,
      });

      return existing._id;
    } else {
      // Create new subscription
      const subscriptionId = await ctx.db.insert("subscriptions", {
        userId: args.userId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
        stripePriceId: args.stripePriceId,
        planName: args.planName,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        endedAt: args.endedAt,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });

      return subscriptionId;
    }
  },
});

/**
 * Update subscription status (for webhook events like payment_failed)
 */
export const updateSubscriptionStatus = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.union(
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("paused")
    ),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const updateData: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = args.cancelAtPeriodEnd;
    }
    if (args.canceledAt !== undefined) {
      updateData.canceledAt = args.canceledAt;
    }
    if (args.endedAt !== undefined) {
      updateData.endedAt = args.endedAt;
    }

    await ctx.db.patch(subscription._id, updateData);

    return subscription._id;
  },
});

/**
 * Delete a subscription (for cleanup or when subscription is deleted)
 */
export const deleteSubscription = mutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
    }
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

/**
 * Check if user has an active Pro subscription
 */
export const hasActiveProSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return subscription?.planName === "Pro";
  },
});
