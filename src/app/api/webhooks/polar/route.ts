import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getPolarWebhookSecret } from "@/lib/polar-client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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

async function lookupUserIdByCustomerId(convex: ConvexHttpClient, customerId: string): Promise<string | null> {
  try {
    const customer = await convex.query(api.polar.getCustomerByPolarId, { polarCustomerId: customerId });
    return customer?.userId ?? null;
  } catch (error) {
    console.error("Failed to lookup customer:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const convex = getConvexClient();
    const body = await request.text();
    const signature = request.headers.get("webhook-signature");

    if (!signature) {
      console.error("❌ Missing webhook signature");
      return NextResponse.json(
        { error: "Missing webhook signature" },
        { status: 401 }
      );
    }

    let webhookSecret: string;
    try {
      webhookSecret = getPolarWebhookSecret();
    } catch {
      console.error("❌ Webhook secret not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event;
    try {
      event = validateEvent(body, Object.fromEntries(request.headers.entries()), webhookSecret);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error("❌ Webhook verification failed:", error.message);
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
      throw error;
    }

    console.log(`📥 Polar webhook: ${event.type}`, JSON.stringify(event.data, null, 2));

    switch (event.type) {
      case "checkout.created": {
        console.log(`🛒 Checkout created: ${event.data.id}`);
        break;
      }

      case "checkout.updated": {
        const checkout = event.data as any;
        console.log(`🛒 Checkout updated: ${checkout.id}, status: ${checkout.status}`);

        // When checkout is confirmed/succeeded, sync the customer
        if (checkout.status === "succeeded" || checkout.status === "confirmed") {
          const userId = checkout.metadata?.userId as string | undefined;
          const customerId = checkout.customerId || checkout.customer_id;

          if (userId && customerId) {
            try {
              await convex.mutation(api.polar.syncCustomer, {
                userId,
                polarCustomerId: customerId,
              });
              console.log(`✅ Synced customer ${customerId} for user ${userId} from checkout`);
            } catch (error) {
              console.error("Failed to sync customer from checkout:", error);
            }
          }
        }
        break;
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
        const subscription = event.data as any;

        // Try to get userId from metadata first
        let userId = subscription.metadata?.userId as string | undefined;

        // If no userId in metadata, try to look it up via customer_id
        const customerId = subscription.customerId || subscription.customer_id;
        if (!userId && customerId) {
          console.log(`🔍 No userId in metadata, looking up by customerId: ${customerId}`);
          userId = await lookupUserIdByCustomerId(convex, customerId) ?? undefined;
        }

        if (!userId) {
          console.error("❌ Could not determine userId for subscription:", subscription.id);
          console.error("Metadata:", subscription.metadata);
          console.error("CustomerId:", customerId);
          // Still return 200 to avoid webhook retries - log the issue instead
          return NextResponse.json({ received: true, warning: "userId not found" });
        }

        // First, ensure the customer is synced
        if (customerId) {
          try {
            await convex.mutation(api.polar.syncCustomer, {
              userId,
              polarCustomerId: customerId,
            });
          } catch (error) {
            console.error("Failed to sync customer:", error);
          }
        }

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
          interval,
          currentPeriodStart: periodStartMs,
          currentPeriodEnd: periodEndMs,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? subscription.cancel_at_period_end ?? false,
          metadata: {
            ...subscription.metadata,
            polarCustomerId: customerId,
            source: "polar",
          },
        });

        console.log(`✅ Subscription ${event.type} for user ${userId}`);
        break;
      }

      case "subscription.canceled": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.markSubscriptionForCancellation, {
            polarSubscriptionId: subscription.id,
          });
          console.log(`✅ Subscription marked for cancellation: ${subscription.id}`);
        } catch (error) {
          console.error("Failed to mark subscription for cancellation:", error);
        }
        break;
      }

      case "subscription.revoked": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.revokeSubscription, {
            polarSubscriptionId: subscription.id,
          });
          console.log(`✅ Subscription revoked: ${subscription.id}`);
        } catch (error) {
          console.error("Failed to revoke subscription:", error);
        }
        break;
      }

      case "subscription.uncanceled": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.reactivateSubscription, {
            polarSubscriptionId: subscription.id,
          });
          console.log(`✅ Subscription reactivated: ${subscription.id}`);
        } catch (error) {
          console.error("Failed to reactivate subscription:", error);
        }
        break;
      }

      case "order.created": {
        const order = event.data as any;
        console.log(`📦 Order created: ${order.id}`);

        // Orders can also trigger customer sync
        const userId = order.metadata?.userId as string | undefined;
        const customerId = order.customerId || order.customer_id;

        if (userId && customerId) {
          try {
            await convex.mutation(api.polar.syncCustomer, {
              userId,
              polarCustomerId: customerId,
            });
            console.log(`✅ Synced customer ${customerId} for user ${userId} from order`);
          } catch (error) {
            console.error("Failed to sync customer from order:", error);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
