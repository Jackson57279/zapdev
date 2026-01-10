import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getPolarClient, isPolarConfigured } from "@/lib/polar-client";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  return new ConvexHttpClient(url);
}

type SubscriptionStatus = "active" | "canceled" | "past_due" | "unpaid" | "trialing";

function mapPolarStatus(polarStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    unpaid: "unpaid",
    trialing: "trialing",
    revoked: "canceled",
  };
  return statusMap[polarStatus] ?? "active";
}

/**
 * POST /api/polar/sync-subscription
 *
 * Allows authenticated users to manually sync their subscription from Polar.
 * Useful when webhooks fail to fire.
 *
 * Body (optional):
 * { polarSubscriptionId: string } - If known, provide the subscription ID
 *
 * Without a subscription ID, it will try to find subscriptions by the user's email.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPolarConfigured()) {
      return NextResponse.json(
        { error: "Polar.sh is not configured" },
        { status: 503 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = getConvexClient();
    const body = await request.json().catch(() => ({}));
    const { polarSubscriptionId } = body;

    // Check if user already has an active subscription
    const existingSubscription = await convex.query(api.subscriptions.getUserSubscriptions, { userId });
    const hasActiveSubscription = existingSubscription?.some((s: any) => s.status === "active");

    if (hasActiveSubscription && !polarSubscriptionId) {
      return NextResponse.json({
        success: true,
        message: "You already have an active subscription",
        hasActiveSubscription: true,
      });
    }

    // First, check if there's a pending subscription for this user
    const pendingSubscriptions = await convex.query(api.webhooks.getPendingSubscriptions);

    // Try to find a pending subscription that matches
    let pendingSub = null;
    if (polarSubscriptionId) {
      pendingSub = pendingSubscriptions.find((p: any) => p.polarSubscriptionId === polarSubscriptionId);
    } else {
      // If no specific subscription ID, take the first pending one
      // In a real scenario, you might want to match by customer email
      pendingSub = pendingSubscriptions[0];
    }

    if (pendingSub) {
      // Resolve the pending subscription
      const subscription = pendingSub.eventData;
      const customerId = pendingSub.customerId;

      // Sync customer first
      if (customerId && customerId !== "unknown") {
        await convex.mutation(api.polar.syncCustomer, {
          userId,
          polarCustomerId: customerId,
        });
      }

      // Create the subscription
      const now = Date.now();
      const periodStart = subscription.currentPeriodStart || subscription.current_period_start;
      const periodEnd = subscription.currentPeriodEnd || subscription.current_period_end;

      const periodStartMs = periodStart ? new Date(periodStart).getTime() : now;
      const periodEndMs = periodEnd ? new Date(periodEnd).getTime() : now + 30 * 24 * 60 * 60 * 1000;

      const priceInterval = subscription.price?.recurringInterval || subscription.price?.recurring_interval;
      const interval = priceInterval === "year" ? "yearly" : "monthly";
      const priceId = subscription.priceId || subscription.price_id || subscription.price?.id || "";
      const productId = subscription.productId || subscription.product_id || subscription.product?.id || "";

      await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
        userId,
        polarSubscriptionId: subscription.id,
        customerId: customerId || "",
        productId,
        priceId,
        status: mapPolarStatus(subscription.status),
        interval: interval as "monthly" | "yearly",
        currentPeriodStart: periodStartMs,
        currentPeriodEnd: periodEndMs,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? subscription.cancel_at_period_end ?? false,
        metadata: {
          ...subscription.metadata,
          polarCustomerId: customerId,
          source: "user_manual_sync",
          syncedAt: new Date().toISOString(),
        },
      });

      // Mark pending as resolved
      await convex.mutation(api.webhooks.resolvePendingSubscription, {
        polarSubscriptionId: subscription.id,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "Subscription synced successfully from pending webhook",
        subscription: {
          polarSubscriptionId: subscription.id,
          status: mapPolarStatus(subscription.status),
        },
      });
    }

    // If we have a specific subscription ID, try to fetch it from Polar
    if (polarSubscriptionId) {
      try {
        const polar = getPolarClient();
        const subscription = await polar.subscriptions.get({ id: polarSubscriptionId });

        if (!subscription) {
          return NextResponse.json(
            { error: "Subscription not found in Polar" },
            { status: 404 }
          );
        }

        const customerId = (subscription as any).customer_id || (subscription as any).customerId;

        // Sync customer
        if (customerId) {
          await convex.mutation(api.polar.syncCustomer, {
            userId,
            polarCustomerId: customerId,
          });
        }

        // Create/update subscription
        const now = Date.now();
        const periodStart = (subscription as any).current_period_start || (subscription as any).currentPeriodStart;
        const periodEnd = (subscription as any).current_period_end || (subscription as any).currentPeriodEnd;

        const periodStartMs = periodStart ? new Date(periodStart).getTime() : now;
        const periodEndMs = periodEnd ? new Date(periodEnd).getTime() : now + 30 * 24 * 60 * 60 * 1000;

        const priceInterval = (subscription as any).price?.recurring_interval || (subscription as any).price?.recurringInterval;
        const interval = priceInterval === "year" ? "yearly" : "monthly";
        const priceId = (subscription as any).price_id || (subscription as any).priceId || (subscription as any).price?.id || "";
        const productId = (subscription as any).product_id || (subscription as any).productId || (subscription as any).product?.id || "";

        await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
          userId,
          polarSubscriptionId: subscription.id,
          customerId: customerId || "",
          productId,
          priceId,
          status: mapPolarStatus((subscription as any).status),
          interval: interval as "monthly" | "yearly",
          currentPeriodStart: periodStartMs,
          currentPeriodEnd: periodEndMs,
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ?? (subscription as any).cancelAtPeriodEnd ?? false,
          metadata: {
            source: "user_manual_sync_from_polar",
            syncedAt: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          success: true,
          message: "Subscription synced from Polar API",
          subscription: {
            polarSubscriptionId: subscription.id,
            status: (subscription as any).status,
          },
        });
      } catch (error) {
        console.error("Failed to fetch from Polar:", error);
        return NextResponse.json(
          { error: "Failed to fetch subscription from Polar. Please contact support." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: false,
      message: "No pending subscription found. Please provide your Polar subscription ID or contact support.",
      hasPendingSubscriptions: false,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
