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
    console.error("[Webhook] Failed to lookup customer:", error);
    return null;
  }
}

async function processPendingSubscriptionsForCustomer(
  convex: ConvexHttpClient,
  customerId: string,
  userId: string
): Promise<void> {
  try {
    const pending = await convex.query(api.webhooks.getPendingSubscriptionByCustomerId, { customerId });
    if (pending) {
      console.log(`[Webhook] Found pending subscription for customer ${customerId}, resolving with userId ${userId}`);
      const result = await convex.mutation(api.webhooks.resolvePendingSubscription, {
        polarSubscriptionId: pending.polarSubscriptionId,
        userId,
      });

      if (result) {
        await processSubscriptionEvent(convex, result.eventData, userId);
        console.log(`[Webhook] Successfully resolved pending subscription ${pending.polarSubscriptionId}`);
      }
    }
  } catch (error) {
    console.error("[Webhook] Failed to process pending subscriptions:", error);
  }
}

async function processSubscriptionEvent(
  convex: ConvexHttpClient,
  subscription: any,
  userId: string
): Promise<void> {
  const customerId = subscription.customerId || subscription.customer_id;
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
}

function generateEventId(event: any): string {
  if (event.data?.id) {
    return `${event.type}_${event.data.id}_${Date.now()}`;
  }
  return `${event.type}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export async function POST(request: NextRequest) {
  const convex = getConvexClient();
  let eventId = "";
  let eventType = "";

  try {
    const body = await request.text();
    const signature = request.headers.get("webhook-signature");

    if (!signature) {
      console.error("[Webhook] Missing webhook signature");
      return NextResponse.json(
        { error: "Missing webhook signature" },
        { status: 401 }
      );
    }

    let webhookSecret: string;
    try {
      webhookSecret = getPolarWebhookSecret();
    } catch {
      console.error("[Webhook] Webhook secret not configured");
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
        console.error("[Webhook] Verification failed:", error.message);
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
      throw error;
    }

    eventId = generateEventId(event);
    eventType = event.type;

    // Log the webhook event for debugging and retry purposes
    await convex.mutation(api.webhooks.logWebhookEvent, {
      eventId,
      eventType,
      payload: event.data,
    });

    console.log(`[Webhook] Received: ${event.type}`, JSON.stringify({
      eventId,
      dataId: event.data?.id,
      timestamp: new Date().toISOString(),
    }));

    switch (event.type) {
      case "checkout.created": {
        console.log(`[Webhook] Checkout created: ${event.data.id}`);
        break;
      }

      case "checkout.updated": {
        const checkout = event.data as any;
        console.log(`[Webhook] Checkout updated: ${checkout.id}, status: ${checkout.status}`);

        if (checkout.status === "succeeded" || checkout.status === "confirmed") {
          const userId = checkout.metadata?.userId as string | undefined;
          const customerId = checkout.customerId || checkout.customer_id;

          if (userId && customerId) {
            try {
              await convex.mutation(api.polar.syncCustomer, {
                userId,
                polarCustomerId: customerId,
              });
              console.log(`[Webhook] Synced customer ${customerId} for user ${userId} from checkout`);

              // Process any pending subscriptions for this customer
              await processPendingSubscriptionsForCustomer(convex, customerId, userId);
            } catch (error) {
              console.error("[Webhook] Failed to sync customer from checkout:", error);
              // Don't fail the webhook - the subscription event might still work
            }
          } else {
            console.warn(`[Webhook] Checkout succeeded but missing data - userId: ${userId}, customerId: ${customerId}`);
          }
        }
        break;
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
        const subscription = event.data as any;
        const customerId = subscription.customerId || subscription.customer_id;

        // Try to get userId from multiple sources
        let userId = subscription.metadata?.userId as string | undefined;

        // Fallback 1: Try to look up via customer_id
        if (!userId && customerId) {
          console.log(`[Webhook] No userId in metadata, looking up by customerId: ${customerId}`);
          userId = await lookupUserIdByCustomerId(convex, customerId) ?? undefined;
        }

        // Fallback 2: Try customer email from the subscription object
        if (!userId && subscription.customer?.email) {
          console.log(`[Webhook] Attempting email-based user lookup for: ${subscription.customer.email}`);
          // Note: This would require a Clerk API call to lookup user by email
          // For now, we save as pending and let reconciliation handle it
        }

        if (!userId) {
          console.warn(`[Webhook] Could not determine userId for subscription: ${subscription.id}`);
          console.warn(`[Webhook] Metadata:`, JSON.stringify(subscription.metadata));
          console.warn(`[Webhook] CustomerId: ${customerId}`);

          // Save as pending subscription for later reconciliation
          await convex.mutation(api.webhooks.savePendingSubscription, {
            polarSubscriptionId: subscription.id,
            customerId: customerId || "unknown",
            eventData: subscription,
            error: "Could not determine userId - saved for reconciliation",
          });

          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "failed",
            error: "Could not determine userId - subscription saved as pending",
          });

          // Return 200 to prevent Polar from retrying, but we've logged it for manual review
          return NextResponse.json({
            received: true,
            warning: "userId not found - subscription saved as pending for reconciliation",
            pendingSubscriptionId: subscription.id,
          });
        }

        // Ensure the customer is synced first
        if (customerId) {
          try {
            await convex.mutation(api.polar.syncCustomer, {
              userId,
              polarCustomerId: customerId,
            });
          } catch (error) {
            console.error("[Webhook] Failed to sync customer:", error);
          }
        }

        // Process the subscription
        await processSubscriptionEvent(convex, subscription, userId);

        await convex.mutation(api.webhooks.updateWebhookEventStatus, {
          eventId,
          status: "processed",
        });

        console.log(`[Webhook] Subscription ${event.type} processed for user ${userId}`);
        break;
      }

      case "subscription.canceled": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.markSubscriptionForCancellation, {
            polarSubscriptionId: subscription.id,
          });
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "processed",
          });
          console.log(`[Webhook] Subscription marked for cancellation: ${subscription.id}`);
        } catch (error) {
          console.error("[Webhook] Failed to mark subscription for cancellation:", error);
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        break;
      }

      case "subscription.revoked": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.revokeSubscription, {
            polarSubscriptionId: subscription.id,
          });
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "processed",
          });
          console.log(`[Webhook] Subscription revoked: ${subscription.id}`);
        } catch (error) {
          console.error("[Webhook] Failed to revoke subscription:", error);
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        break;
      }

      case "subscription.uncanceled": {
        const subscription = event.data;

        try {
          await convex.mutation(api.subscriptions.reactivateSubscription, {
            polarSubscriptionId: subscription.id,
          });
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "processed",
          });
          console.log(`[Webhook] Subscription reactivated: ${subscription.id}`);
        } catch (error) {
          console.error("[Webhook] Failed to reactivate subscription:", error);
          await convex.mutation(api.webhooks.updateWebhookEventStatus, {
            eventId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        break;
      }

      case "order.created": {
        const order = event.data as any;
        console.log(`[Webhook] Order created: ${order.id}`);

        const userId = order.metadata?.userId as string | undefined;
        const customerId = order.customerId || order.customer_id;

        if (userId && customerId) {
          try {
            await convex.mutation(api.polar.syncCustomer, {
              userId,
              polarCustomerId: customerId,
            });
            console.log(`[Webhook] Synced customer ${customerId} for user ${userId} from order`);

            // Process any pending subscriptions for this customer
            await processPendingSubscriptionsForCustomer(convex, customerId, userId);
          } catch (error) {
            console.error("[Webhook] Failed to sync customer from order:", error);
          }
        }

        await convex.mutation(api.webhooks.updateWebhookEventStatus, {
          eventId,
          status: "processed",
        });
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        await convex.mutation(api.webhooks.updateWebhookEventStatus, {
          eventId,
          status: "processed",
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Processing error:", error);

    if (eventId) {
      try {
        await convex.mutation(api.webhooks.updateWebhookEventStatus, {
          eventId,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } catch {
        // Ignore logging errors
      }
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET endpoint for webhook health check
export async function GET() {
  try {
    // Verify configuration
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    const checks = {
      webhookSecretConfigured: !!webhookSecret,
      convexUrlConfigured: !!convexUrl,
      timestamp: new Date().toISOString(),
    };

    const allPassing = Object.values(checks).every(v => v === true || typeof v === "string");

    return NextResponse.json({
      status: allPassing ? "healthy" : "degraded",
      checks,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
