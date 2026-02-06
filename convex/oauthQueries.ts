import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { oauthProviderEnum } from "./schema";
import { requireAuth } from "./helpers";

export const getConnectionInternal = internalQuery({
  args: {
    userId: v.string(),
    provider: oauthProviderEnum,
  },
  returns: v.union(
    v.object({
      _id: v.id("oauthConnections"),
      _creationTime: v.number(),
      userId: v.string(),
      provider: oauthProviderEnum,
      accessToken: v.string(),
      refreshToken: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      scope: v.string(),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider)
      )
      .first();
  },
});

export const getConnection = query({
  args: {
    provider: oauthProviderEnum,
  },
  returns: v.union(
    v.object({
      _id: v.id("oauthConnections"),
      _creationTime: v.number(),
      userId: v.string(),
      provider: oauthProviderEnum,
      accessToken: v.string(),
      refreshToken: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      scope: v.string(),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    return await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();
  },
});

export const storeConnectionInternal = internalMutation({
  args: {
    userId: v.string(),
    provider: oauthProviderEnum,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.id("oauthConnections"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken || existing.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        metadata: args.metadata || existing.metadata,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("oauthConnections", {
      userId: args.userId,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listConnections = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("oauthConnections"),
      userId: v.string(),
      provider: oauthProviderEnum,
      scope: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const connections = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return connections.map((conn) => ({
      _id: conn._id,
      userId: conn.userId,
      provider: conn.provider,
      scope: conn.scope,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
  },
});

export const revokeConnection = mutation({
  args: {
    provider: oauthProviderEnum,
  },
  returns: v.union(v.id("oauthConnections"), v.null()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    if (connection) {
      await ctx.db.delete(connection._id);
      return connection._id;
    }

    return null;
  },
});

export const updateMetadata = mutation({
  args: {
    provider: oauthProviderEnum,
    metadata: v.any(),
  },
  returns: v.id("oauthConnections"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    if (!connection) {
      throw new Error(`No ${args.provider} connection found`);
    }

    await ctx.db.patch(connection._id, {
      metadata: args.metadata,
      updatedAt: Date.now(),
    });

    return connection._id;
  },
});

export const hasAnthropicConnection = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", "anthropic")
      )
      .first();

    return !!connection?.accessToken;
  },
});
