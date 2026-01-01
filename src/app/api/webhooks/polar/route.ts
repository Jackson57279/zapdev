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

type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid" | "trialing";

function mapPolarStatus(polarStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    incomplete: "unpaid",
    incomplete_expired: "unpaid",
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    unpaid: "unpaid",
    trialing: "trialing",
    revoked: "canceled",
  };
  return statusMap[polarStatus] ?? "unpaid";
}

function extractPlanName(productName: string | undefined): string {
  if (!productName) return "Free";
  const lower = productName.toLowerCase();
  if (lower.includes("pro")) return "Pro";
  if (lower.includes("enterprise")) return "Enterprise";
  return productName;
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

    console.log(`📥 Polar webhook: ${event.type}`);

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
        const subscription = event.data;
        const userId = subscription.metadata?.userId as string | undefined;

        if (!userId) {
          console.error("❌ Missing userId in subscription metadata");
          return NextResponse.json(
            { error: "Missing userId in metadata" },
            { status: 400 }
          );
        }

        const now = Date.now();
        const periodStart = subscription.currentPeriodStart 
          ? new Date(subscription.currentPeriodStart).getTime() 
          : now;
        const periodEnd = subscription.currentPeriodEnd 
          ? new Date(subscription.currentPeriodEnd).getTime() 
          : now + 30 * 24 * 60 * 60 * 1000;

        await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
          userId,
          polarSubscriptionId: subscription.id,
          customerId: subscription.customerId,
          productId: subscription.productId,
          priceId: subscription.prices?.[0]?.id ?? subscription.productId,
          status: mapPolarStatus(subscription.status),
          interval: subscription.recurringInterval === "year" ? "yearly" : "monthly",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          metadata: {
            ...subscription.metadata,
            planName: extractPlanName(subscription.product?.name),
            source: "polar",
          },
        });

        console.log(`✅ Subscription ${event.type} for user ${userId}`);
        break;
      }

      case "subscription.canceled": {
        const subscription = event.data;
        
        await convex.mutation(api.subscriptions.markSubscriptionForCancellation, {
          polarSubscriptionId: subscription.id,
        });

        console.log(`✅ Subscription marked for cancellation: ${subscription.id}`);
        break;
      }

      case "subscription.revoked": {
        const subscription = event.data;
        
        await convex.mutation(api.subscriptions.revokeSubscription, {
          polarSubscriptionId: subscription.id,
        });

        console.log(`✅ Subscription revoked: ${subscription.id}`);
        break;
      }

      case "subscription.uncanceled": {
        const subscription = event.data;
        
        await convex.mutation(api.subscriptions.reactivateSubscription, {
          polarSubscriptionId: subscription.id,
        });

        console.log(`✅ Subscription reactivated: ${subscription.id}`);
        break;
      }

      case "order.created": {
        console.log(`📦 Order created: ${event.data.id}`);
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

