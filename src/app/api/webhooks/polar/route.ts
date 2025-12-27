import { NextRequest, NextResponse } from "next/server";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getPolarWebhookSecret } from "@/lib/polar-client";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

/**
 * Polar.sh Webhook Handler
 * Handles subscription lifecycle events and syncs to Convex
 * 
 * IMPORTANT: Polar does NOT follow 3xx redirects. This endpoint must return
 * a direct 2xx response without any redirects.
 * Configured endpoint: https://zapdev.link/api/webhooks/polar
 */

// Handle OPTIONS for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔔 Webhook POST request received at /api/webhooks/polar");
    console.log("URL:", request.url);
    console.log("Headers:", Object.fromEntries(request.headers.entries()));
    
    // Get the raw body for signature verification
    const body = await request.text();
    console.log("Body length:", body.length);
    console.log("Body preview:", body.substring(0, 200));

    // Convert Next.js headers to plain object for validateEvent
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Verify webhook signature
    let event;
    try {
      const secret = getPolarWebhookSecret();
      console.log("Webhook secret length:", secret.length);
      event = validateEvent(body, headers, secret);
      console.log("✅ Signature verified");
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      return NextResponse.json(
        { error: "Invalid webhook signature", details: String(err) },
        { status: 401 }
      );
    }

    // Initialize Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    console.log("✅ Polar webhook event received:", event.type);
    console.log("Event timestamp:", event.timestamp);
    console.log("Event data preview:", JSON.stringify(event.data).substring(0, 200) + "...");

    // Handle different webhook events
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated": {
        const subscription = event.data;

        // Extract user ID from metadata (passed during checkout)
        const userId = subscription.metadata?.userId as string;
        if (!userId) {
          console.error("Missing userId in subscription metadata");
          return NextResponse.json(
            { error: "Missing userId in metadata" },
            { status: 400 }
          );
        }

        // Determine product name from subscription
        const productName = subscription.product?.name || "Pro";

        // Sync subscription to Convex
        await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
          userId,
          polarCustomerId: subscription.customerId,
          polarSubscriptionId: subscription.id,
          productId: subscription.productId,
          productName,
          status: subscription.status as any,
          currentPeriodStart: subscription.currentPeriodStart
            ? new Date(subscription.currentPeriodStart).getTime()
            : Date.now(),
          currentPeriodEnd: subscription.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd).getTime()
            : Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now as fallback
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
          metadata: subscription.metadata,
        });

        // Update usage credits based on subscription status
        if (subscription.status === "active") {
          // Grant Pro credits (100/day)
          await convex.mutation(api.usage.resetUsage, {
            userId,
          });
        }

        console.log(`✅ Subscription ${event.type} processed for user ${userId}, status: ${subscription.status}`);
        break;
      }

      case "subscription.canceled": {
        const subscription = event.data;

        // Mark subscription for cancellation (end of period)
        await convex.mutation(api.subscriptions.markSubscriptionForCancellation, {
          polarSubscriptionId: subscription.id,
        });

        console.log(`Subscription marked for cancellation: ${subscription.id}`);
        break;
      }

      case "subscription.revoked": {
        const subscription = event.data;

        // Immediately revoke subscription
        await convex.mutation(api.subscriptions.revokeSubscription, {
          polarSubscriptionId: subscription.id,
        });

        // Reset to free tier credits
        const userId = subscription.metadata?.userId as string;
        if (userId) {
          await convex.mutation(api.usage.resetUsage, {
            userId,
          });
        }

        console.log(`Subscription revoked: ${subscription.id}`);
        break;
      }

      case "subscription.uncanceled": {
        const subscription = event.data;

        // Reactivate subscription
        await convex.mutation(api.subscriptions.reactivateSubscription, {
          polarSubscriptionId: subscription.id,
        });

        console.log(`Subscription reactivated: ${subscription.id}`);
        break;
      }

      case "order.created": {
        const order = event.data;

        // Log renewal events
        if (order.billingReason === "subscription_cycle") {
          console.log(`Subscription renewal for customer ${order.customerId}`);
        }
        break;
      }

      case "customer.created":
      case "customer.updated":
      case "customer.deleted": {
        // Log customer events for debugging
        console.log(`Customer event: ${event.type}`, event.data.id);
        break;
      }

      case "customer.state_changed": {
        // Unified handler for all customer state changes (subscriptions, benefits, etc.)
        const customerState = event.data;
        const externalId = customerState.externalId; // Stack Auth user ID

        if (!externalId) {
          console.log("Customer state change without external ID, skipping sync");
          break;
        }

        console.log(`Processing customer.state_changed for user ${externalId}`);

        // Get active subscriptions from state
        const activeSubscriptions = customerState.activeSubscriptions || [];
        const grantedBenefits = customerState.grantedBenefits || [];

        // Update/create subscription records for each active subscription
        for (const sub of activeSubscriptions) {
          // Map Polar status to our status enum (Polar uses "active" | "trialing", we need to map to our values)
          const mappedStatus = sub.status === "trialing" ? "active" : sub.status;

          await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
            userId: externalId,
            polarCustomerId: customerState.id,
            polarSubscriptionId: sub.id,
            productId: sub.productId,
            // CustomerStateSubscription doesn't have product.name, use "Pro" as default
            // The productId can be used to determine the plan if needed
            productName: "Pro",
            status: mappedStatus as "incomplete" | "active" | "canceled" | "past_due" | "unpaid",
            currentPeriodStart: sub.currentPeriodStart instanceof Date
              ? sub.currentPeriodStart.getTime()
              : Date.now(),
            currentPeriodEnd: sub.currentPeriodEnd instanceof Date
              ? sub.currentPeriodEnd.getTime()
              : Date.now() + 30 * 24 * 60 * 60 * 1000,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
            metadata: {
              benefits: grantedBenefits.map((b) => ({ id: b.id, type: b.benefitType })),
              syncedAt: Date.now(),
            },
          });

          console.log(`Synced subscription ${sub.id} for user ${externalId}`);
        }

        // If no active subscriptions, revoke all user subscriptions
        if (activeSubscriptions.length === 0) {
          try {
            await convex.mutation(api.subscriptions.revokeAllUserSubscriptions, {
              userId: externalId,
            });
            console.log(`Revoked all subscriptions for user ${externalId} (no active subscriptions)`);
          } catch (err) {
            console.log(`No subscriptions to revoke for user ${externalId}`);
          }
        }

        // Reset usage credits based on new subscription state
        await convex.mutation(api.usage.resetUsage, {
          userId: externalId,
        });

        console.log(`✅ Customer state updated for user ${externalId}: ${activeSubscriptions.length} active subscriptions, ${grantedBenefits.length} benefits`);
        break;
      }

      default:
        console.log(`⚠️ Unhandled webhook event type: ${event.type}`);
    }

    // Return 200 OK to acknowledge receipt - CRITICAL: Polar requires 2xx response
    console.log(`✅ Webhook processed successfully: ${event.type}`);
    return NextResponse.json(
      { received: true, eventType: event.type },
      { 
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
