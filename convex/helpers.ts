import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.warn("No user identity found in context");
      return null;
    }
    if (!identity.subject) {
      console.warn("User identity found but no subject field");
      return null;
    }
    return identity.subject;
  } catch (error) {
    console.error("Error getting user identity:", error);
    return null;
  }
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    console.error("Authentication failed: No user ID found");
    console.error("Context auth details:", {
      hasAuth: !!ctx.auth,
      hasGetUserIdentity: typeof ctx.auth?.getUserIdentity === 'function'
    });
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function hasProAccess(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (!subscription) {
    return false;
  }

  return subscription.productId === process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID;
}

export async function hasUnlimitedAccess(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (!subscription) {
    return false;
  }

  return subscription.productId === process.env.NEXT_PUBLIC_POLAR_UNLIMITED_PRODUCT_ID;
}

export async function hasPlan(
  ctx: QueryCtx | MutationCtx,
  planProductId: string
): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  return subscription?.productId === planProductId;
}

export async function hasFeature(
  ctx: QueryCtx | MutationCtx,
  featureId: string
): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (!subscription || !subscription.metadata) {
    return false;
  }

  const features = subscription.metadata as any;

  if (!features) {
    return false;
  }

  return features?.includes(featureId) ?? false;
}

export async function getCurrentUserClerkId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  return getCurrentUserId(ctx);
}

export async function getCurrentUserPolarCustomerId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return null;

  const customer = await ctx.db
    .query("polarCustomers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  return customer?.polarCustomerId ?? null;
}
