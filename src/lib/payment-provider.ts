export type BillingInterval = "monthly" | "yearly";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface CheckoutSessionRequest {
  customerId: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface SubscriptionLookup {
  subscriptionId: string;
}

export interface SubscriptionSummary {
  id: string;
  customerId: string;
  productId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}

export interface UpdateSubscriptionRequest {
  subscriptionId: string;
  productId: string;
}

export interface BillingPortalRequest {
  customerId: string;
  returnUrl: string;
}

export interface UsageEvent {
  customerId: string;
  meterId: string;
  quantity: number;
}

export interface FeatureCheckRequest {
  customerId: string;
  featureId: string;
}

export interface FeatureCheckResult {
  allowed: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}

export interface PaymentProvider {
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession>;
  getSubscription(input: SubscriptionLookup): Promise<SubscriptionSummary | null>;
  updateSubscription(input: UpdateSubscriptionRequest): Promise<SubscriptionSummary>;
  cancelSubscription(input: CancelSubscriptionRequest): Promise<SubscriptionSummary>;
  createBillingPortalSession(input: BillingPortalRequest): Promise<{ url: string }>;
  trackUsage(input: UsageEvent): Promise<void>;
  checkFeature(input: FeatureCheckRequest): Promise<FeatureCheckResult>;
}

interface AutumnConfig {
  apiKey: string;
  baseUrl?: string;
}

type AutumnRequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown>;
};

export class AutumnStripeProvider implements PaymentProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AutumnConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.useautumn.com";
  }

  async createCheckoutSession(
    input: CheckoutSessionRequest
  ): Promise<CheckoutSession> {
    return this.request<CheckoutSession>("/v1/checkout", {
      method: "POST",
      body: {
        customerId: input.customerId,
        productId: input.productId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: input.metadata,
      },
    });
  }

  async getSubscription(
    input: SubscriptionLookup
  ): Promise<SubscriptionSummary | null> {
    const url = `${this.baseUrl}/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Autumn API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as SubscriptionSummary;
  }

  async updateSubscription(
    input: UpdateSubscriptionRequest
  ): Promise<SubscriptionSummary> {
    return this.request<SubscriptionSummary>(
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
      {
        method: "PATCH",
        body: {
          productId: input.productId,
        },
      }
    );
  }

  async cancelSubscription(
    input: CancelSubscriptionRequest
  ): Promise<SubscriptionSummary> {
    return this.request<SubscriptionSummary>(
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`,
      {
        method: "POST",
        body: {
          cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? true,
        },
      }
    );
  }

  async createBillingPortalSession(
    input: BillingPortalRequest
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>("/v1/portal", {
      method: "POST",
      body: {
        customerId: input.customerId,
        returnUrl: input.returnUrl,
      },
    });
  }

  async trackUsage(input: UsageEvent): Promise<void> {
    await this.request<{ ok: boolean }>("/v1/usage", {
      method: "POST",
      body: {
        customerId: input.customerId,
        meterId: input.meterId,
        quantity: input.quantity,
      },
    });
  }

  async checkFeature(input: FeatureCheckRequest): Promise<FeatureCheckResult> {
    return this.request<FeatureCheckResult>("/v1/features/check", {
      method: "POST",
      body: {
        customerId: input.customerId,
        featureId: input.featureId,
      },
    });
  }

  private async request<T>(
    path: string,
    options: AutumnRequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Autumn API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  }
}
