import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { oauthProviderEnum } from "./schema";
import { requireAuth } from "./helpers";

// Store OAuth connection
export const storeConnection = mutation({
  args: {
    provider: oauthProviderEnum,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Check if connection already exists
    const existing = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing connection
      return await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken || existing.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        metadata: args.metadata || existing.metadata,
        updatedAt: now,
      });
    }

    // Create new connection
    return await ctx.db.insert("oauthConnections", {
      userId,
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

// Get OAuth connection
export const getConnection = query({
  args: {
    provider: oauthProviderEnum,
  },
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

export const getGithubAccessToken = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", "github"),
      )
      .first();

    return connection?.accessToken ?? null;
  },
});

// List all OAuth connections for user
export const listConnections = query({
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    return await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Revoke OAuth connection
export const revokeConnection = mutation({
  args: {
    provider: oauthProviderEnum,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    if (connection) {
      return await ctx.db.delete(connection._id);
    }

    return null;
  },
});

// Update OAuth connection metadata
export const updateMetadata = mutation({
  args: {
    provider: oauthProviderEnum,
    metadata: v.any(),
  },
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

    return await ctx.db.patch(connection._id, {
      metadata: args.metadata,
      updatedAt: Date.now(),
    });
  },
});
