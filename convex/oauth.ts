"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import crypto from "crypto";

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error("OAUTH_ENCRYPTION_KEY environment variable is required");
  }
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("OAUTH_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }
  return keyBuffer;
}

const ALGORITHM = "aes-256-gcm";

export function encryptToken(token: string): string {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const keyBuffer = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export const storeConnection = action({
  args: {
    provider: v.union(v.literal("github"), v.literal("anthropic")),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.id("oauthConnections"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("Unauthorized");
    }
    const userId = identity.subject;

    const encryptedAccessToken = encryptToken(args.accessToken);
    const encryptedRefreshToken = args.refreshToken ? encryptToken(args.refreshToken) : undefined;

    const connectionId: Id<"oauthConnections"> = await ctx.runMutation(internal.oauthQueries.storeConnectionInternal, {
      userId,
      provider: args.provider,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      metadata: args.metadata,
    });
    return connectionId;
  },
});

export const getGithubAccessToken = internalAction({
  args: { userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const connection = await ctx.runQuery(internal.oauthQueries.getConnectionInternal, {
      userId: args.userId,
      provider: "github",
    });

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
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }
    return await ctx.runAction(internal.oauth.getGithubAccessToken, {
      userId: identity.subject,
    });
  },
});

export const getAnthropicAccessToken = internalAction({
  args: { userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const connection = await ctx.runQuery(internal.oauthQueries.getConnectionInternal, {
      userId: args.userId,
      provider: "anthropic",
    });

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
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }
    return await ctx.runAction(internal.oauth.getAnthropicAccessToken, {
      userId: identity.subject,
    });
  },
});
