import type { PaymentTemplateBundle } from "./types";

export const sveltePaymentTemplate: PaymentTemplateBundle = {
  framework: "svelte",
  description: "SvelteKit payment integration with Autumn + Stripe",
  files: {
    "src/lib/server/autumn.ts": `
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

export const autumnRequest = async <T>(
  path: string,
  options: AutumnRequestOptions
): Promise<T> => {
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
};
`,
    "src/routes/api/billing/checkout/+server.ts": `
import { json } from "@sveltejs/kit";
import { autumnRequest } from "$lib/server/autumn";
import type { RequestHandler } from "./$types";

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

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as unknown;
  if (!isCheckoutRequest(body)) {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  const checkout = await autumnRequest<{ url: string; id: string }>("/v1/checkout", {
    method: "POST",
    body,
  });
  return json(checkout);
};
`,
    "src/routes/api/billing/portal/+server.ts": `
import { json } from "@sveltejs/kit";
import { autumnRequest } from "$lib/server/autumn";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    customerId?: string;
    returnUrl?: string;
  };
  if (!body.customerId || !body.returnUrl) {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  const portal = await autumnRequest<{ url: string }>("/v1/portal", {
    method: "POST",
    body: {
      customerId: body.customerId,
      returnUrl: body.returnUrl,
    },
  });
  return json(portal);
};
`,
    "src/routes/api/billing/usage/+server.ts": `
import { json } from "@sveltejs/kit";
import { autumnRequest } from "$lib/server/autumn";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    customerId?: string;
    meterId?: string;
    quantity?: number;
  };
  if (!body.customerId || !body.meterId || typeof body.quantity !== "number") {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  await autumnRequest("/v1/usage", {
    method: "POST",
    body: {
      customerId: body.customerId,
      meterId: body.meterId,
      quantity: body.quantity,
    },
  });
  return json({ ok: true });
};
`,
    "src/routes/api/billing/subscription/+server.ts": `
import { json } from "@sveltejs/kit";
import { autumnRequest } from "$lib/server/autumn";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const subscriptionId = url.searchParams.get("subscriptionId");
  if (!subscriptionId) {
    return json({ error: "subscriptionId is required" }, { status: 400 });
  }
  const subscription = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(subscriptionId)}\`,
    { method: "GET" }
  );
  return json(subscription);
};

export const PATCH: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    subscriptionId?: string;
    productId?: string;
  };
  if (!body.subscriptionId || !body.productId) {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  const updated = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(body.subscriptionId)}\`,
    {
      method: "PATCH",
      body: { productId: body.productId },
    }
  );
  return json(updated);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    subscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
  };
  if (!body.subscriptionId) {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  const canceled = await autumnRequest<unknown>(
    \`/v1/subscriptions/\${encodeURIComponent(body.subscriptionId)}/cancel\`,
    {
      method: "POST",
      body: { cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? true },
    }
  );
  return json(canceled);
};
`,
    "src/routes/api/billing/feature-check/+server.ts": `
import { json } from "@sveltejs/kit";
import { autumnRequest } from "$lib/server/autumn";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    customerId?: string;
    featureId?: string;
  };
  if (!body.customerId || !body.featureId) {
    return json({ error: "Invalid payload" }, { status: 400 });
  }
  const result = await autumnRequest<unknown>("/v1/features/check", {
    method: "POST",
    body: { customerId: body.customerId, featureId: body.featureId },
  });
  return json(result);
};
`,
    "src/routes/api/webhooks/autumn/+server.ts": `
import { json } from "@sveltejs/kit";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "./$types";

const verifySignature = (signature: string, payload: string, secret: string) => {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);
  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }
  return timingSafeEqual(signatureBuffer, digestBuffer);
};

export const POST: RequestHandler = async ({ request }) => {
  const secret = process.env.AUTUMN_WEBHOOK_SECRET;
  if (!secret) {
    return json({ error: "Missing webhook secret" }, { status: 500 });
  }
  const signature = request.headers.get("autumn-signature") ?? "";
  const rawBody = await request.text();
  if (!verifySignature(signature, rawBody, secret)) {
    return json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = JSON.parse(rawBody) as { type: string; data: unknown };
  switch (event.type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.canceled":
    case "invoice.payment_failed":
    case "invoice.payment_succeeded":
      break;
    default:
      break;
  }
  return json({ received: true });
};
`,
    "src/lib/components/CheckoutButton.svelte": `
<script lang="ts">
  export let productId: string;
  export let customerId: string;
  export let successUrl: string;
  export let cancelUrl: string;
  export let label = "Upgrade";

  let loading = false;

  const startCheckout = async () => {
    loading = true;
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, customerId, successUrl, cancelUrl }),
      });
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      loading = false;
    }
  };
</script>

<button
  type="button"
  class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
  disabled={loading}
  on:click={startCheckout}
>
  {loading ? "Redirecting..." : label}
</button>
`,
    "src/lib/components/FeatureGate.svelte": `
<script lang="ts">
  export let allowed = false;
  export let fallback = "";
</script>

{#if allowed}
  <slot />
{:else}
  {fallback}
{/if}
`,
    "src/lib/usage.ts": `
export interface UsagePayload {
  customerId: string;
  meterId: string;
  quantity: number;
}

export const trackUsage = async (payload: UsagePayload): Promise<void> => {
  await fetch("/api/billing/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};
`,
    "src/routes/billing/success/+page.svelte": `
<div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
  <h1 class="text-3xl font-semibold">Payment successful</h1>
  <p class="text-muted-foreground">
    Your subscription is active. You can return to the app and start using
    your new plan immediately.
  </p>
  <a href="/" class="inline-flex w-fit items-center rounded-md bg-black px-4 py-2 text-white">
    Return to app
  </a>
</div>
`,
    "src/routes/billing/cancel/+page.svelte": `
<div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
  <h1 class="text-3xl font-semibold">Checkout canceled</h1>
  <p class="text-muted-foreground">
    Your checkout was canceled. You can restart the process at any time.
  </p>
  <a href="/" class="inline-flex w-fit items-center rounded-md border border-gray-200 px-4 py-2">
    Return to app
  </a>
</div>
`,
  },
};
