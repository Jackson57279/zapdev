"use server";

import { headers } from "next/headers";
import { normalizePolarSubscription } from "@/lib/polar";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  const headerPayload = await headers();
  const signature = headerPayload.get("Polar-Signature");

  if (!signature) {
    return new Response("No signature found", { status: 401 });
  }

  const body = await request.json();
  const bodyString = JSON.stringify(body);

  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", process.env.POLAR_WEBHOOK_SECRET!);
  const digest = hmac.update(bodyString).digest("hex");

  const signatureParts = signature.split(",");
  const signatureValue = signatureParts.find((part: string) => part.startsWith("v1="));

  if (!signatureValue) {
    return new Response("Invalid signature", { status: 401 });
  }

  const expectedSignature = `v1=${digest}`;

  if (!crypto.timingSafeEqual(Buffer.from(signatureValue), Buffer.from(expectedSignature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = (body as any).type;
  const eventData = (body as any).data;

  console.log(`🎣 Polar webhook received: ${eventType}`);

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    switch (eventType) {
      case "checkout.completed": {
        await handleCheckoutCompleted(eventData, convex);
        break;
      }

      case "subscription.created":
      case "subscription.updated": {
        await handleSubscription(eventData, convex);
        break;
      }

      case "subscription.canceled": {
        await handleSubscriptionCanceled(eventData, convex);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return new Response("", { status: 200 });
  } catch (error) {
    console.error("Error processing Polar webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

async function handleCheckoutCompleted(checkout: any, convex: ConvexHttpClient) {
  console.log("🛒 Checkout completed:", checkout.id);

  const userId = checkout.metadata?.userId;
  const customerId = checkout.customer_id;
  const subscriptionId = checkout.subscription_id;

  if (!userId || !customerId || !subscriptionId) {
    console.error("Missing required checkout data:", { userId, customerId, subscriptionId });
    return;
  }

  try {
    await convex.mutation(api.polar.syncCustomer, {
      userId,
      polarCustomerId: customerId,
    });
    console.log(`✅ Synced customer ${customerId} for user ${userId}`);
  } catch (error) {
    console.error("Failed to sync customer:", error);
  }
}

async function handleSubscription(subscription: any, convex: ConvexHttpClient) {
  console.log("📦 Subscription created/updated:", subscription.id);

  try {
    const normalized = normalizePolarSubscription(subscription);

    await convex.mutation(api.polar.syncSubscription, normalized);
    console.log(`✅ Synced subscription ${subscription.id}`);
  } catch (error) {
    console.error("Failed to sync subscription:", error);
    throw error;
  }
}

async function handleSubscriptionCanceled(subscription: any, convex: ConvexHttpClient) {
  console.log("🗑️ Subscription canceled:", subscription.id);

  try {
    const normalized = normalizePolarSubscription(subscription);

    await convex.mutation(api.polar.syncSubscription, normalized);
    console.log(`✅ Updated canceled subscription ${subscription.id}`);
  } catch (error) {
    console.error("Failed to update canceled subscription:", error);
    throw error;
  }
}
