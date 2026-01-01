import { Polar } from "@polar-sh/sdk";

let polarClientInstance: Polar | null = null;

function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function createPolarClient(): Polar {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    if (isBuildTime()) {
      console.warn("⚠️ POLAR_ACCESS_TOKEN not configured - using placeholder for build");
      return new Polar({ accessToken: "build-time-placeholder" });
    }
    throw new Error(
      "POLAR_ACCESS_TOKEN is not configured. " +
      "Get your access token from https://polar.sh/dashboard/settings"
    );
  }

  const server = getServer();

  return new Polar({
    accessToken,
    server: server === "sandbox" ? "sandbox" : undefined,
  });
}

export function getPolarClient(): Polar {
  if (!polarClientInstance) {
    polarClientInstance = createPolarClient();
  }
  return polarClientInstance;
}

export function getServer(): "sandbox" | "production" {
  return (process.env.NEXT_PUBLIC_POLAR_SERVER as "sandbox" | "production") || "production";
}

export function getPolarOrganizationId(): string {
  const orgId = process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID?.trim();
  if (!orgId) {
    throw new Error(
      "NEXT_PUBLIC_POLAR_ORGANIZATION_ID is not configured. " +
      "Get your organization ID from https://polar.sh/dashboard/settings"
    );
  }
  return orgId;
}

export function getPolarProProductId(): string {
  const productId = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID?.trim();
  if (!productId) {
    throw new Error(
      "NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID is not configured. " +
      "Get your product ID from https://polar.sh/dashboard/products"
    );
  }
  return productId;
}

export function getPolarProPriceIds(): {
  monthly: string;
  yearly: string;
} {
  const monthly = process.env.NEXT_PUBLIC_POLAR_PRO_PRICE_ID?.trim();
  const yearly = process.env.NEXT_PUBLIC_POLAR_PRO_YEARLY_PRICE_ID?.trim();

  if (!monthly || !yearly) {
    throw new Error(
      "NEXT_PUBLIC_POLAR_PRO_PRICE_ID or NEXT_PUBLIC_POLAR_PRO_YEARLY_PRICE_ID is not configured. " +
      "Get your price IDs from https://polar.sh/dashboard/products"
    );
  }

  return { monthly, yearly };
}

export function getPolarWebhookSecret(): string {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "POLAR_WEBHOOK_SECRET is not configured. " +
      "Get your webhook secret from https://polar.sh/dashboard/webhooks"
    );
  }
  return secret;
}

export function isPolarConfigured(): boolean {
  return !!(
    process.env.POLAR_ACCESS_TOKEN?.trim() &&
    process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID?.trim() &&
    process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID?.trim() &&
    process.env.POLAR_WEBHOOK_SECRET?.trim()
  );
}

export type PolarSubscriptionData = {
  polarSubscriptionId: string;
  customerId: string;
  productId: string;
  priceId: string;
  status: "active" | "past_due" | "canceled" | "unpaid" | "trialing";
  interval: "monthly" | "yearly";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | undefined;
  trialStart: number | undefined;
  trialEnd: number | undefined;
  metadata: Record<string, any> | undefined;
};

export function normalizePolarSubscription(subscription: any): PolarSubscriptionData {
  return {
    polarSubscriptionId: subscription.id,
    customerId: subscription.customer_id,
    productId: subscription.product_id,
    priceId: subscription.price_id,
    status: subscription.status,
    interval: subscription.price?.recurring_interval || "monthly",
    currentPeriodStart: new Date(subscription.current_period_start).getTime(),
    currentPeriodEnd: new Date(subscription.current_period_end).getTime(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at).getTime() : undefined,
    trialStart: subscription.trial_start ? new Date(subscription.trial_start).getTime() : undefined,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end).getTime() : undefined,
    metadata: subscription.metadata || undefined,
  };
}

export async function createCheckout(options: {
  priceId: string;
  successUrl: string;
  cancelUrl?: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, any>;
}) {
  const polar = getPolarClient();
  const { priceId, successUrl, customerEmail, customerName, metadata = {} } = options;

  const checkout = await polar.checkouts.create({
    products: [priceId],
    successUrl,
    customerEmail,
    customerName,
    metadata,
  });

  return checkout;
}

export async function getSubscription(subscriptionId: string) {
  const polar = getPolarClient();

  const result = await polar.subscriptions.get({
    id: subscriptionId,
  });

  return result;
}

export async function updateSubscription(subscriptionId: string, update: any) {
  const polar = getPolarClient();

  const result = await polar.subscriptions.update({
    id: subscriptionId,
    subscriptionUpdate: update,
  });

  return result;
}

export async function cancelSubscription(subscriptionId: string) {
  const polar = getPolarClient();

  const result = await polar.subscriptions.update({
    id: subscriptionId,
    subscriptionUpdate: {
      cancelAtPeriodEnd: true,
    },
  });

  return result;
}

export async function revokeSubscription(subscriptionId: string) {
  const polar = getPolarClient();

  const result = await polar.subscriptions.revoke({
    id: subscriptionId,
  });

  return result;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = getPolarWebhookSecret();
  const crypto = require("crypto");

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(body).digest("hex");

  const signatureParts = signature.split(",");
  const signatureValue = signatureParts.find((part: string) => part.startsWith("v1="));

  if (!signatureValue) {
    return false;
  }

  const expectedSignature = `v1=${digest}`;

  return crypto.timingSafeEqual(
    Buffer.from(signatureValue),
    Buffer.from(expectedSignature)
  );
}
