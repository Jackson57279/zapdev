import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Get the current authenticated user's ID from Clerk (via Convex JWT)
 */
export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  // Get user ID from Convex auth context
  // Convex's auth system provides the subject (user ID) via ctx.auth
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject || null;
}

/**
 * Get the current authenticated user's ID or throw an error
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/**
 * Check if user has pro access
 * Checks for active Stripe subscription with Pro plan
 */
export async function hasProAccess(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;
  
  return hasProAccessForUser(ctx, userId);
}

/**
 * Check if a specific user has pro access (for use when userId is passed as argument)
 * Checks for active Stripe subscription with Pro plan
 */
export async function hasProAccessForUser(ctx: QueryCtx | MutationCtx, userId: string): Promise<boolean> {
  // Check active subscription from Stripe
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();
  
  // Pro access if active subscription exists and planName is "Pro"
  if (subscription && subscription.planName === "Pro") {
    return true;
  }
  
  // Fallback to legacy usage table check for backwards compatibility
  const usage = await ctx.db
    .query("usage")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  
  return usage?.planType === "pro";
}

/**
 * Check if user has a specific plan
 * @param ctx - Query or Mutation context
 * @param planName - Name of the plan to check (e.g., "Free", "Pro")
 */
export async function hasPlan(
  ctx: QueryCtx | MutationCtx,
  planName: string
): Promise<boolean> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return false;
  
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();
  
  return subscription?.planName === planName;
}

/**
 * Get user's Stripe customer ID
 */
export async function getStripeCustomerId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) return null;
  
  const customer = await ctx.db
    .query("customers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  
  return customer?.stripeCustomerId || null;
}

/**
 * Legacy compatibility: Get user ID (now just returns Clerk user ID)
 * @deprecated Use getCurrentUserId instead
 */
export async function getCurrentUserClerkId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  return getCurrentUserId(ctx);
}
