import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = {
  get customers() { return getStripe().customers; },
  get subscriptions() { return getStripe().subscriptions; },
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
};

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

export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  const stripeClient = getStripe();
  
  const existingCustomers = await stripeClient.customers.list({
    limit: 1,
    email,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    if (customer.metadata?.userId !== userId) {
      return await stripeClient.customers.update(customer.id, {
        metadata: { userId },
      });
    }
    return customer;
  }

  return await stripeClient.customers.create({
    email,
    name,
    metadata: { userId },
  });
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return await getStripe().checkout.sessions.create({
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

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function getActiveSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subscriptions = await getStripe().subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  return subscriptions.data[0] || null;
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export type { Stripe };
