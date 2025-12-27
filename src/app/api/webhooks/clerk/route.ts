import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Extend WebhookEvent type to include Clerk Billing subscription events
// These events are sent by Clerk Billing but not yet in the official types
type ClerkBillingEvent = 
  | WebhookEvent 
  | { type: "subscription.created"; data: any }
  | { type: "subscription.updated"; data: any }
  | { type: "subscription.deleted"; data: any };

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkBillingEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkBillingEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Initialize Convex client
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const eventType = evt.type;

  console.log(`Webhook with type of ${eventType}`);

  try {
    switch (eventType) {
      // Handle user events
      case "user.created":
      case "user.updated":
        // TODO: Sync user data if needed
        break;

      // Handle organization events (if using organizations)
      case "organization.created":
      case "organization.updated":
        // TODO: Sync organization data if needed
        break;

      // Handle Clerk Billing subscription events
      case "subscription.created":
      case "subscription.updated": {
        const subscription = evt.data as any;
        
        // Extract subscription data from Clerk webhook
        const userId = subscription.user_id || subscription.userId;
        const clerkSubscriptionId = subscription.id;
        const planId = subscription.plan_id || subscription.planId;
        const planName = subscription.plan_name || subscription.planName || "Unknown";
        const status = subscription.status;
        const currentPeriodStart = subscription.current_period_start 
          ? subscription.current_period_start * 1000 
          : Date.now();
        const currentPeriodEnd = subscription.current_period_end 
          ? subscription.current_period_end * 1000 
          : Date.now() + 30 * 24 * 60 * 60 * 1000; // Default to 30 days
        const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
        const features = subscription.features || [];
        const metadata = subscription.metadata || {};

        if (userId && clerkSubscriptionId && planId) {
          await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
            userId,
            clerkSubscriptionId,
            planId,
            planName,
            status,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            features,
            metadata,
          });
          console.log(`Subscription ${eventType} processed for user ${userId}`);
        } else {
          console.error("Missing required subscription data:", { userId, clerkSubscriptionId, planId });
        }
        break;
      }

      case "subscription.deleted": {
        const subscription = evt.data as any;
        const clerkSubscriptionId = subscription.id;

        if (clerkSubscriptionId) {
          await convex.mutation(api.subscriptions.revokeSubscription, {
            clerkSubscriptionId,
          });
          console.log(`Subscription deleted: ${clerkSubscriptionId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    return new Response("", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}
