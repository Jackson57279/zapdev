import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-12-15.clover" });
  }
  return _stripe;
}

let _convex: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

function getPlanNameFromPriceId(priceId: string): string {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (priceId === proPriceId) {
    return "Pro";
  }
  return "Free";
}

interface SubscriptionData {
  id: string;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
  status: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: number | null;
  endedAt?: number | null;
  metadata?: Record<string, string>;
  items: {
    data: Array<{ price: { id: string } }>;
  };
}

interface InvoiceData {
  subscription?: string | null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
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
        const subscription = event.data.object as unknown as SubscriptionData;
        
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
        
        const now = Date.now();
        const periodStart = subscription.currentPeriodStart 
          ? subscription.currentPeriodStart * 1000 
          : now;
        const periodEnd = subscription.currentPeriodEnd 
          ? subscription.currentPeriodEnd * 1000 
          : now + 30 * 24 * 60 * 60 * 1000;

        await getConvex().mutation(api.subscriptions.createOrUpdateSubscription, {
          userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: priceId,
          planName,
          status: subscription.status as "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          canceledAt: subscription.canceledAt ? subscription.canceledAt * 1000 : undefined,
          endedAt: subscription.endedAt ? subscription.endedAt * 1000 : undefined,
          metadata: subscription.metadata,
        });

        console.log(`Subscription ${event.type} processed for user ${userId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as SubscriptionData;

        await getConvex().mutation(api.subscriptions.updateSubscriptionStatus, {
          stripeSubscriptionId: subscription.id,
          status: "canceled",
          canceledAt: subscription.canceledAt ? subscription.canceledAt * 1000 : Date.now(),
          endedAt: subscription.endedAt ? subscription.endedAt * 1000 : Date.now(),
        });

        console.log(`Subscription deleted: ${subscription.id}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as InvoiceData;
        
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          ) as unknown as SubscriptionData;

          await getConvex().mutation(api.subscriptions.updateSubscriptionStatus, {
            stripeSubscriptionId: subscription.id,
            status: subscription.status as "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused",
          });

          console.log(`Invoice payment succeeded for subscription: ${subscription.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as InvoiceData;
        
        if (invoice.subscription) {
          await getConvex().mutation(api.subscriptions.updateSubscriptionStatus, {
            stripeSubscriptionId: invoice.subscription,
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
          await getConvex().mutation(api.subscriptions.createOrUpdateCustomer, {
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
