 "use node";

import { action, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { oauthProviderEnum } from "./schema";
import { requireAuth } from "./helpers";
import { internal } from "./_generated/api";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.trim().length === 0) {
  throw new Error("OAUTH_ENCRYPTION_KEY environment variable is required");
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, "utf8");
if (keyBuffer.length < 32) {
  throw new Error("OAUTH_ENCRYPTION_KEY must be at least 32 bytes long");
}

const ALGORITHM = "aes-256-gcm";

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    keyBuffer.subarray(0, 32),
    iv
  );
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyBuffer.subarray(0, 32),
    iv
  );
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

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

    const encryptedAccessToken = encryptToken(args.accessToken);
    const encryptedRefreshToken = args.refreshToken ? encryptToken(args.refreshToken) : undefined;

    if (existing) {
      // Update existing connection
      return await ctx.db.patch(existing._id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || existing.refreshToken,
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
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
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

export const getGithubAccessToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", "github"),
      )
      .first();

    if (!connection?.accessToken) {
      return null;
    }

    try {
      return decryptToken(connection.accessToken);
    } catch {
      return null;
    }
  },
});

export const getGithubAccessTokenForCurrentUser = action({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }
    return await ctx.runQuery(internal.oauth.getGithubAccessToken, {
      userId: identity.subject,
    });
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

export const getAnthropicAccessToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", "anthropic"),
      )
      .first();

    if (!connection?.accessToken) {
      return null;
    }

    try {
      return decryptToken(connection.accessToken);
    } catch {
      return null;
    }
  },
});

export const getAnthropicAccessTokenForCurrentUser = action({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }
    return await ctx.runQuery(internal.oauth.getAnthropicAccessToken, {
      userId: identity.subject,
    });
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
