import type { PaymentTemplateBundle } from "./types";

export const nextjsPaymentTemplate: PaymentTemplateBundle = {
  framework: "nextjs",
  description: "Next.js App Router payment integration with Autumn + Stripe",
  files: {
    "lib/autumn-client.ts": `
type AutumnRequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown>;
};

const getAutumnConfig = () => {
  const apiKey = process.env.AUTUMN_API_KEY;
  const baseUrl = process.env.AUTUMN_API_BASE_URL ?? "https://api.useautumn.com";
  if (!apiKey) {
    throw new Error("AUTUMN_API_KEY is required");
  }
  return { apiKey, baseUrl };
};

export async function autumnRequest<T>(
  path: string,
  options: AutumnRequestOptions
): Promise<T> {
  const { apiKey, baseUrl } = getAutumnConfig();
  const response = await fetch(\`\${baseUrl}\${path}\`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${apiKey}\`,
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`Autumn API error: \${response.status} - \${errorText}\`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
`,
    "app/api/billing/checkout/route.ts": `
import { NextResponse } from "next/server";
import { autumnRequest } from "@/lib/autumn-client";

type CheckoutRequest = {
  productId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
};

const isCheckoutRequest = (value: unknown): value is CheckoutRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.productId === "string" &&
    typeof data.customerId === "string" &&
    typeof data.successUrl === "string" &&
    typeof data.cancelUrl === "string"
  );
};

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isCheckoutRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const checkout = await autumnRequest<{ url: string; id: string }>(
    "/v1/checkout",
    {
      method: "POST",
      body: {
        productId: body.productId,
        customerId: body.customerId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      },
    }
  );

  return NextResponse.json(checkout);
}
`,
    "app/api/billing/portal/route.ts": `
import { NextResponse } from "next/server";
import { autumnRequest } from "@/lib/autumn-client";

type PortalRequest = {
  customerId: string;
  returnUrl: string;
};

const isPortalRequest = (value: unknown): value is PortalRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.customerId === "string" && typeof data.returnUrl === "string";
};

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isPortalRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const portal = await autumnRequest<{ url: string }>("/v1/portal", {
    method: "POST",
    body: {
      customerId: body.customerId,
      returnUrl: body.returnUrl,
    },
  });

  return NextResponse.json(portal);
}
`,
    "app/api/billing/subscription/route.ts": `
import { NextResponse } from "next/server";
import { autumnRequest } from "@/lib/autumn-client";

type UpdateRequest = {
  subscriptionId: string;
  productId: string;
};

type CancelRequest = {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
};

const isUpdateRequest = (value: unknown): value is UpdateRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.subscriptionId === "string" &&
    typeof data.productId === "string"
  );
};

const isCancelRequest = (value: unknown): value is CancelRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.subscriptionId === "string" &&
    (data.cancelAtPeriodEnd === undefined || typeof data.cancelAtPeriodEnd === "boolean")
  );
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscriptionId");

  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }

  const subscription = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(subscriptionId)}\`,
    { method: "GET" }
  );

  return NextResponse.json(subscription);
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isUpdateRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(body.subscriptionId)}\`,
    {
      method: "PATCH",
      body: { productId: body.productId },
    }
  );

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isCancelRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const canceled = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(body.subscriptionId)}/cancel\`,
    {
      method: "POST",
      body: { cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? true },
    }
  );

  return NextResponse.json(canceled);
}
`,
    "app/api/billing/usage/route.ts": `
import { NextResponse } from "next/server";
import { autumnRequest } from "@/lib/autumn-client";

type UsageRequest = {
  customerId: string;
  meterId: string;
  quantity: number;
};

const isUsageRequest = (value: unknown): value is UsageRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.customerId === "string" &&
    typeof data.meterId === "string" &&
    typeof data.quantity === "number"
  );
};

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isUsageRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await autumnRequest("/v1/usage", {
    method: "POST",
    body: {
      customerId: body.customerId,
      meterId: body.meterId,
      quantity: body.quantity,
    },
  });

  return NextResponse.json({ ok: true });
}
`,
    "app/api/billing/feature-check/route.ts": `
import { NextResponse } from "next/server";
import { autumnRequest } from "@/lib/autumn-client";

type FeatureCheckRequest = {
  customerId: string;
  featureId: string;
};

const isFeatureCheckRequest = (
  value: unknown
): value is FeatureCheckRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.customerId === "string" && typeof data.featureId === "string"
  );
};

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  if (!isFeatureCheckRequest(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await autumnRequest<unknown>("/v1/features/check", {
    method: "POST",
    body: {
      customerId: body.customerId,
      featureId: body.featureId,
    },
  });

  return NextResponse.json(result);
}
`,
    "app/api/webhooks/autumn/route.ts": `
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const verifySignature = (
  signature: string,
  payload: string,
  secret: string
): boolean => {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);
  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }
  return timingSafeEqual(signatureBuffer, digestBuffer);
};

export async function POST(req: Request) {
  const secret = process.env.AUTUMN_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const signature = req.headers.get("autumn-signature") ?? "";
  const rawBody = await req.text();

  if (!verifySignature(signature, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as { type: string; data: unknown };

  switch (event.type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.canceled": {
      break;
    }
    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      break;
    }
    default: {
      break;
    }
  }

  return NextResponse.json({ received: true });
}
`,
    "components/billing/checkout-button.tsx": `
"use client";

import { useState } from "react";

interface CheckoutButtonProps {
  productId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  label?: string;
}

export function CheckoutButton({
  productId,
  customerId,
  successUrl,
  cancelUrl,
  label = "Upgrade",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerId,
          successUrl,
          cancelUrl,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Checkout failed");
      }
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={startCheckout}
      disabled={loading}
      className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
    >
      {loading ? "Redirecting..." : label}
    </button>
  );
}
`,
    "components/billing/feature-gate.tsx": `
import type { ReactNode } from "react";

interface FeatureGateProps {
  allowed: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ allowed, fallback, children }: FeatureGateProps) {
  if (!allowed) {
    return <>{fallback ?? null}</>;
  }
  return <>{children}</>;
}
`,
    "lib/usage.ts": `
interface UsagePayload {
  customerId: string;
  meterId: string;
  quantity: number;
}

export async function trackUsage(payload: UsagePayload): Promise<void> {
  const response = await fetch("/api/billing/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to track usage");
  }
}
`,
    "app/billing/success/page.tsx": `
export default function BillingSuccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Payment successful</h1>
      <p className="text-muted-foreground">
        Your subscription is active. You can return to the app and start using
        your new plan immediately.
      </p>
      <a
        href="/"
        className="inline-flex w-fit items-center rounded-md bg-black px-4 py-2 text-white"
      >
        Return to app
      </a>
    </div>
  );
}
`,
    "app/billing/cancel/page.tsx": `
export default function BillingCancelPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Checkout canceled</h1>
      <p className="text-muted-foreground">
        Your checkout was canceled. You can restart the process at any time.
      </p>
      <a
        href="/"
        className="inline-flex w-fit items-center rounded-md border border-gray-200 px-4 py-2"
      >
        Return to app
      </a>
    </div>
  );
}
`,
  },
};
