import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Get the current authenticated user's ID from Stack Auth
 * Stack Auth automatically sets ctx.auth when a user is authenticated
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
 * Checks for active Polar.sh subscription with Pro or Enterprise tier
 */
export async function hasProAccess(
  ctx: QueryCtx | MutationCtx,
  userId?: string
): Promise<boolean> {
  // If userId is not provided, try to get it from auth context
  const targetUserId = userId ?? (await getCurrentUserId(ctx));
  if (!targetUserId) return false;
  
  // Check active subscription from Polar
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", targetUserId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();
  
  // Pro access if active subscription exists and productName contains "Pro" or "Enterprise" (case-insensitive)
  // We use word boundary check to match "Pro", "Pro Plan", "Enterprise Plan" etc.
  // but avoid false positives like "Project Management" or "Professional" (if those are not intended to be Pro)
  // This aligns with the client-side check in src/app/dashboard/subscription/page.tsx
  if (subscription && (
    /\b(pro|enterprise)\b/i.test(subscription.productName)
  )) {
    return true;
  }
  
  // Fallback to legacy usage table check for backwards compatibility
  const usage = await ctx.db
    .query("usage")
    .withIndex("by_userId", (q) => q.eq("userId", targetUserId))
    .first();
  
  return usage?.planType === "pro";
}

/**
 * Legacy compatibility: Get user ID (now just returns Stack Auth user ID)
 * @deprecated Use getCurrentUserId instead
 */
export async function getCurrentUserClerkId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  return getCurrentUserId(ctx);
}
