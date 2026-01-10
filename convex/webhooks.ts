import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logWebhookEvent = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("webhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      status: "received",
      payload: args.payload,
      retryCount: 0,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const updateWebhookEventStatus = mutation({
  args: {
    eventId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!event) {
      return null;
    }

    await ctx.db.patch(event._id, {
      status: args.status,
      error: args.error,
      processedAt: args.status === "processed" || args.status === "failed" ? Date.now() : undefined,
      retryCount: args.status === "retrying" ? event.retryCount + 1 : event.retryCount,
    });

    return event._id;
  },
});

export const getWebhookEvent = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

export const getFailedWebhookEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(limit);
  },
});

export const getRecentWebhookEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

export const savePendingSubscription = mutation({
  args: {
    polarSubscriptionId: v.string(),
    customerId: v.string(),
    eventData: v.any(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_polarSubscriptionId", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        eventData: args.eventData,
        error: args.error,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("pendingSubscriptions", {
      polarSubscriptionId: args.polarSubscriptionId,
      customerId: args.customerId,
      eventData: args.eventData,
      status: "pending",
      error: args.error,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const getPendingSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const getPendingSubscriptionByCustomerId = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
  },
});

export const resolvePendingSubscription = mutation({
  args: {
    polarSubscriptionId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_polarSubscriptionId", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    if (!pending) {
      return null;
    }

    await ctx.db.patch(pending._id, {
      status: "resolved",
      resolvedUserId: args.userId,
      resolvedAt: Date.now(),
    });

    return { pendingId: pending._id, eventData: pending.eventData };
  },
});

export const markPendingSubscriptionFailed = mutation({
  args: {
    polarSubscriptionId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_polarSubscriptionId", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    if (!pending) {
      return null;
    }

    await ctx.db.patch(pending._id, {
      status: "failed",
      error: args.error,
    });

    return pending._id;
  },
});

export const getPendingSubscriptionsByStatus = query({
  args: {
    status: v.union(v.literal("pending"), v.literal("resolved"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingSubscriptions")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const getAllPendingSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("pendingSubscriptions")
      .collect();
  },
});
