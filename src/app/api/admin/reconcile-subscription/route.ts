import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getPolarClient } from "@/lib/polar-client";

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

const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(",") || [];

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.length === 0 || ADMIN_USER_IDS.includes(userId);
}

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(authUserId)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const convex = getConvexClient();
    const body = await request.json();
    const { userId, polarSubscriptionId, pendingSubscriptionId, action } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (action === "resolve-pending" || pendingSubscriptionId) {
      if (!polarSubscriptionId && !pendingSubscriptionId) {
        return NextResponse.json(
          { error: "polarSubscriptionId or pendingSubscriptionId is required for resolve-pending action" },
          { status: 400 }
        );
      }

      const subId = polarSubscriptionId || pendingSubscriptionId;

      const pending = await convex.query(api.webhooks.getPendingSubscriptions);
      const pendingSub = pending.find((p: any) =>
        p.polarSubscriptionId === subId || p._id === pendingSubscriptionId
      );

      if (!pendingSub) {
        return NextResponse.json(
          { error: "Pending subscription not found" },
          { status: 404 }
        );
      }

      const customerId = pendingSub.customerId;
      if (customerId && customerId !== "unknown") {
        await convex.mutation(api.polar.syncCustomer, {
          userId,
          polarCustomerId: customerId,
        });
      }

      const subscription = pendingSub.eventData;
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
          source: "manual_reconciliation",
          reconciledAt: new Date().toISOString(),
          reconciledBy: authUserId,
        },
      });

      await convex.mutation(api.webhooks.resolvePendingSubscription, {
        polarSubscriptionId: subscription.id,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "Subscription reconciled successfully",
        subscription: {
          polarSubscriptionId: subscription.id,
          userId,
          status: mapPolarStatus(subscription.status),
        },
      });
    }

    if (action === "fetch-from-polar" && polarSubscriptionId) {
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

        if (customerId) {
          await convex.mutation(api.polar.syncCustomer, {
            userId,
            polarCustomerId: customerId,
          });
        }

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
            source: "manual_reconciliation_from_polar",
            reconciledAt: new Date().toISOString(),
            reconciledBy: authUserId,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Subscription fetched from Polar and reconciled",
          subscription: {
            polarSubscriptionId: subscription.id,
            userId,
            status: (subscription as any).status,
          },
        });
      } catch (error) {
        console.error("Failed to fetch from Polar:", error);
        return NextResponse.json(
          { error: "Failed to fetch subscription from Polar" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'resolve-pending' or 'fetch-from-polar'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Reconciliation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(userId)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const convex = getConvexClient();

    const [pendingSubscriptions, failedWebhooks, recentWebhooks] = await Promise.all([
      convex.query(api.webhooks.getPendingSubscriptions),
      convex.query(api.webhooks.getFailedWebhookEvents, { limit: 50 }),
      convex.query(api.webhooks.getRecentWebhookEvents, { limit: 20 }),
    ]);

    return NextResponse.json({
      pendingSubscriptions,
      failedWebhooks,
      recentWebhooks,
      summary: {
        pendingCount: pendingSubscriptions.length,
        failedWebhooksCount: failedWebhooks.length,
      },
    });
  } catch (error) {
    console.error("Failed to get reconciliation data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get data" },
      { status: 500 }
    );
  }
}
