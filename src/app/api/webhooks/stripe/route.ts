import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Convex client for database operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Map Stripe price IDs to plan names
function getPlanNameFromPriceId(priceId: string): string {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (priceId === proPriceId) {
    return "Pro";
  }
  return "Free";
}

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Get customer to find userId
        const customer = await stripe.customers.retrieve(
          subscription.customer as string
        );
        
        if (customer.deleted) {
          console.error("Customer was deleted");
          break;
        }

        const userId = customer.metadata?.userId;
        if (!userId) {
          console.error("No userId found in customer metadata");
          break;
        }

        const priceId = subscription.items.data[0]?.price.id || "";
        const planName = getPlanNameFromPriceId(priceId);

        await convex.mutation(api.subscriptions.createOrUpdateSubscription, {
          userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: priceId,
          planName,
          status: subscription.status as "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused",
          currentPeriodStart: subscription.current_period_start * 1000,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : undefined,
          endedAt: subscription.ended_at ? subscription.ended_at * 1000 : undefined,
          metadata: subscription.metadata,
        });

        console.log(`Subscription ${event.type} processed for user ${userId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await convex.mutation(api.subscriptions.updateSubscriptionStatus, {
          stripeSubscriptionId: subscription.id,
          status: "canceled",
          canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : Date.now(),
          endedAt: subscription.ended_at ? subscription.ended_at * 1000 : Date.now(),
        });

        console.log(`Subscription deleted: ${subscription.id}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          // Refresh subscription status after successful payment
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );

          await convex.mutation(api.subscriptions.updateSubscriptionStatus, {
            stripeSubscriptionId: subscription.id,
            status: subscription.status as "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused",
          });

          console.log(`Invoice payment succeeded for subscription: ${subscription.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          await convex.mutation(api.subscriptions.updateSubscriptionStatus, {
            stripeSubscriptionId: invoice.subscription as string,
            status: "past_due",
          });

          console.log(`Invoice payment failed for subscription: ${invoice.subscription}`);
        }
        break;
      }

      case "customer.created":
      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        const userId = customer.metadata?.userId;

        if (userId && customer.email) {
          await convex.mutation(api.subscriptions.createOrUpdateCustomer, {
            userId,
            stripeCustomerId: customer.id,
            email: customer.email,
            name: customer.name || undefined,
          });

          console.log(`Customer ${event.type} for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
}
