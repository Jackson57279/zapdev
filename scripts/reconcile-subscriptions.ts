#!/usr/bin/env bun
/**
 * Subscription Reconciliation Script
 *
 * This script helps reconcile subscriptions that failed to sync from Polar webhooks.
 *
 * Usage:
 *   bun run scripts/reconcile-subscriptions.ts --list
 *   bun run scripts/reconcile-subscriptions.ts --reconcile --user-id <clerk_user_id> --subscription-id <polar_subscription_id>
 *   bun run scripts/reconcile-subscriptions.ts --reconcile-pending --user-id <clerk_user_id>
 *   bun run scripts/reconcile-subscriptions.ts --fetch-from-polar --user-id <clerk_user_id> --subscription-id <polar_subscription_id>
 *
 * Required Environment Variables:
 *   - NEXT_PUBLIC_CONVEX_URL
 *   - POLAR_ACCESS_TOKEN (for --fetch-from-polar)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

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

async function listPendingSubscriptions() {
  console.log("📋 Fetching pending subscriptions...\n");

  try {
    const pending = await convex.query(api.webhooks.getPendingSubscriptions);

    if (pending.length === 0) {
      console.log("✅ No pending subscriptions found!");
      return;
    }

    console.log(`Found ${pending.length} pending subscription(s):\n`);

    for (const sub of pending) {
      console.log("─".repeat(60));
      console.log(`Polar Subscription ID: ${sub.polarSubscriptionId}`);
      console.log(`Customer ID: ${sub.customerId}`);
      console.log(`Status: ${sub.status}`);
      console.log(`Created At: ${new Date(sub.createdAt).toISOString()}`);
      if (sub.error) {
        console.log(`Error: ${sub.error}`);
      }
      if (sub.eventData) {
        console.log(`Subscription Status: ${sub.eventData.status}`);
        if (sub.eventData.customer?.email) {
          console.log(`Customer Email: ${sub.eventData.customer.email}`);
        }
      }
      console.log();
    }

    console.log("─".repeat(60));
    console.log("\nTo reconcile a pending subscription, run:");
    console.log("  bun run scripts/reconcile-subscriptions.ts --reconcile-pending --user-id <clerk_user_id>\n");
  } catch (error) {
    console.error("❌ Failed to fetch pending subscriptions:", error);
  }
}

async function listFailedWebhooks() {
  console.log("📋 Fetching failed webhook events...\n");

  try {
    const failed = await convex.query(api.webhooks.getFailedWebhookEvents, { limit: 20 });

    if (failed.length === 0) {
      console.log("✅ No failed webhook events found!");
      return;
    }

    console.log(`Found ${failed.length} failed webhook event(s):\n`);

    for (const event of failed) {
      console.log("─".repeat(60));
      console.log(`Event ID: ${event.eventId}`);
      console.log(`Event Type: ${event.eventType}`);
      console.log(`Created At: ${new Date(event.createdAt).toISOString()}`);
      if (event.error) {
        console.log(`Error: ${event.error}`);
      }
      console.log();
    }
  } catch (error) {
    console.error("❌ Failed to fetch failed webhooks:", error);
  }
}

async function reconcilePending(userId: string, polarSubscriptionId?: string) {
  console.log(`🔄 Reconciling pending subscription for user ${userId}...\n`);

  try {
    const pending = await convex.query(api.webhooks.getPendingSubscriptions);

    let targetSub;
    if (polarSubscriptionId) {
      targetSub = pending.find((p: any) => p.polarSubscriptionId === polarSubscriptionId);
    } else {
      // If no specific subscription ID, take the first pending one
      targetSub = pending[0];
    }

    if (!targetSub) {
      console.log("❌ No pending subscription found to reconcile");
      return;
    }

    console.log(`Found pending subscription: ${targetSub.polarSubscriptionId}`);

    const subscription = targetSub.eventData;
    const customerId = targetSub.customerId;

    // Sync customer first
    if (customerId && customerId !== "unknown") {
      console.log(`Syncing customer ${customerId}...`);
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

    console.log(`Creating subscription record...`);
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
        source: "manual_reconciliation_script",
        reconciledAt: new Date().toISOString(),
      },
    });

    // Mark pending as resolved
    await convex.mutation(api.webhooks.resolvePendingSubscription, {
      polarSubscriptionId: subscription.id,
      userId,
    });

    console.log(`\n✅ Successfully reconciled subscription!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Polar Subscription ID: ${subscription.id}`);
    console.log(`   Status: ${mapPolarStatus(subscription.status)}`);
    console.log(`   Interval: ${interval}`);
  } catch (error) {
    console.error("❌ Reconciliation failed:", error);
  }
}

async function fetchFromPolar(userId: string, polarSubscriptionId: string) {
  console.log(`🔄 Fetching subscription ${polarSubscriptionId} from Polar...\n`);

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("❌ POLAR_ACCESS_TOKEN is not set");
    return;
  }

  try {
    // Use the Polar SDK
    const { Polar } = await import("@polar-sh/sdk");
    const polar = new Polar({ accessToken });

    const subscription = await polar.subscriptions.get({ id: polarSubscriptionId });

    if (!subscription) {
      console.log("❌ Subscription not found in Polar");
      return;
    }

    console.log(`Found subscription in Polar:`);
    console.log(`  Status: ${(subscription as any).status}`);
    console.log(`  Customer ID: ${(subscription as any).customer_id || (subscription as any).customerId}`);

    const customerId = (subscription as any).customer_id || (subscription as any).customerId;

    // Sync customer
    if (customerId) {
      console.log(`Syncing customer ${customerId}...`);
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

    console.log(`Creating subscription record...`);
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
      },
    });

    console.log(`\n✅ Successfully reconciled subscription from Polar!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Polar Subscription ID: ${subscription.id}`);
    console.log(`   Status: ${(subscription as any).status}`);
  } catch (error) {
    console.error("❌ Failed to fetch from Polar:", error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    console.log(`
Subscription Reconciliation Script

Usage:
  bun run scripts/reconcile-subscriptions.ts --list
    List all pending subscriptions and failed webhook events

  bun run scripts/reconcile-subscriptions.ts --reconcile-pending --user-id <clerk_user_id>
    Reconcile the first pending subscription for the given user

  bun run scripts/reconcile-subscriptions.ts --reconcile-pending --user-id <clerk_user_id> --subscription-id <polar_sub_id>
    Reconcile a specific pending subscription for the given user

  bun run scripts/reconcile-subscriptions.ts --fetch-from-polar --user-id <clerk_user_id> --subscription-id <polar_sub_id>
    Fetch subscription directly from Polar API and create it for the user

Examples:
  bun run scripts/reconcile-subscriptions.ts --list
  bun run scripts/reconcile-subscriptions.ts --reconcile-pending --user-id user_abc123
  bun run scripts/reconcile-subscriptions.ts --fetch-from-polar --user-id user_abc123 --subscription-id sub_xyz789
`);
    return;
  }

  if (args.includes("--list")) {
    await listPendingSubscriptions();
    console.log();
    await listFailedWebhooks();
    return;
  }

  const userIdIndex = args.indexOf("--user-id");
  const subscriptionIdIndex = args.indexOf("--subscription-id");

  const userId = userIdIndex !== -1 ? args[userIdIndex + 1] : undefined;
  const subscriptionId = subscriptionIdIndex !== -1 ? args[subscriptionIdIndex + 1] : undefined;

  if (args.includes("--reconcile-pending")) {
    if (!userId) {
      console.error("❌ --user-id is required for --reconcile-pending");
      process.exit(1);
    }
    await reconcilePending(userId, subscriptionId);
    return;
  }

  if (args.includes("--fetch-from-polar")) {
    if (!userId || !subscriptionId) {
      console.error("❌ Both --user-id and --subscription-id are required for --fetch-from-polar");
      process.exit(1);
    }
    await fetchFromPolar(userId, subscriptionId);
    return;
  }

  console.error("❌ Unknown command. Use --help for usage information.");
  process.exit(1);
}

main().catch(console.error);
