import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
});

// Plan configuration
export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    credits: 5,
    features: [
      "5 AI generations per day",
      "All frameworks supported",
      "Basic code preview",
      "Community support",
    ],
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 29,
    credits: 100,
    features: [
      "100 AI generations per day",
      "All frameworks supported",
      "Advanced code preview",
      "Priority support",
      "Export to GitHub",
      "Custom templates",
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  // Search for existing customer by metadata
  const existingCustomers = await stripe.customers.list({
    limit: 1,
    email,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    // Update metadata if needed
    if (customer.metadata?.userId !== userId) {
      return await stripe.customers.update(customer.id, {
        metadata: { userId },
      });
    }
    return customer;
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        customerId,
      },
    },
  });
}

/**
 * Create a customer portal session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Get active subscription for a customer
 */
export async function getActiveSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  return subscriptions.data[0] || null;
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export type { Stripe };
