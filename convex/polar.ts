import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const syncCustomer = mutation({
  args: {
    userId: v.string(),
    polarCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, polarCustomerId } = args;
    const now = Date.now();

    const existing = await ctx.db
      .query("polarCustomers")
      .withIndex("by_polarCustomerId", (q) => q.eq("polarCustomerId", polarCustomerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("polarCustomers", {
      userId,
      polarCustomerId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const getCustomerIdByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("polarCustomers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return customer?.polarCustomerId ?? null;
  },
});

export const syncSubscription = mutation({
  args: {
    polarSubscriptionId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    priceId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("trialing")
    ),
    interval: v.union(v.literal("monthly"), v.literal("yearly")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      polarSubscriptionId,
      customerId,
      productId,
      priceId,
      status,
      interval,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      canceledAt,
      trialStart,
      trialEnd,
      metadata,
      userId: optionalUserId,
    } = args;

    const now = Date.now();

    let finalUserId = optionalUserId;

    if (!finalUserId) {
      const customer = await ctx.db
        .query("polarCustomers")
        .withIndex("by_polarCustomerId", (q) => q.eq("polarCustomerId", customerId))
        .first();

      if (!customer) {
        console.error(`Customer not found for customerId: ${customerId}`);
        return null;
      }

      finalUserId = customer.userId;
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_polarSubscriptionId", (q) => q.eq("polarSubscriptionId", polarSubscriptionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customerId,
        productId,
        priceId,
        status,
        interval,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        canceledAt,
        trialStart,
        trialEnd,
        metadata,
        userId: finalUserId,
        updatedAt: now,
      });

      return existing._id;
    }

    const id = await ctx.db.insert("subscriptions", {
      userId: finalUserId,
      polarSubscriptionId,
      customerId,
      productId,
      priceId,
      status,
      interval,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      canceledAt,
      trialStart,
      trialEnd,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const getUserPolarSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return subscription;
  },
});
