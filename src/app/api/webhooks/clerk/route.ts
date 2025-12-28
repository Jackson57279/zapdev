import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";

type ClerkEvent = 
  | WebhookEvent 
  | { type: "subscription.created"; data: unknown }
  | { type: "subscription.updated"; data: unknown }
  | { type: "subscription.deleted"; data: unknown };

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET is required");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Clerk webhook: ${eventType}`);

  switch (eventType) {
    case "user.created":
    case "user.updated":
      console.log(`User event: ${eventType}`);
      break;

    case "organization.created":
    case "organization.updated":
      console.log(`Organization event: ${eventType}`);
      break;

    case "subscription.created":
    case "subscription.updated":
    case "subscription.deleted":
      console.log(`Subscription event ${eventType} - handled by Stripe webhooks`);
      break;

    default:
      console.log(`Unhandled event: ${eventType}`);
  }

  return new Response("OK", { status: 200 });
}
