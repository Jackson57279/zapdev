import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getPolarWebhookSecret } from "@/lib/polar-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("webhook-signature");

    if (!signature) {
      console.error("Missing webhook signature");
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
    }

    let webhookSecret: string;
    try {
      webhookSecret = getPolarWebhookSecret();
    } catch {
      console.error("Webhook secret not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    let event;
    try {
      event = validateEvent(body, Object.fromEntries(request.headers.entries()), webhookSecret);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error("Webhook verification failed:", error.message);
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
      throw error;
    }

    console.log(`Polar webhook: ${event.type}`);

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.active":
      case "subscription.canceled":
      case "subscription.revoked":
      case "subscription.uncanceled":
        console.log(`Polar subscription event ${event.type} - handled by Stripe webhooks`);
        break;

      case "order.created":
        console.log(`Polar order created: ${event.data.id}`);
        break;

      default:
        console.log(`Unhandled Polar event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
