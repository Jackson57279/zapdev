import type { PaymentTemplateBundle } from "./types";

export const vuePaymentTemplate: PaymentTemplateBundle = {
  framework: "vue",
  description: "Vue 3 payment integration with Autumn + Stripe",
  files: {
    "server/autumn-client.ts": `
type AutumnRequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown>;
};

export const createAutumnClient = () => {
  const apiKey = process.env.AUTUMN_API_KEY;
  const baseUrl = process.env.AUTUMN_API_BASE_URL ?? "https://api.useautumn.com";
  if (!apiKey) {
    throw new Error("AUTUMN_API_KEY is required");
  }

  const request = async <T>(path: string, options: AutumnRequestOptions): Promise<T> => {
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

  return { request };
};
`,
    "server/routes/billing.ts": `
import type { Request, Response } from "express";
import { Router } from "express";
import { createAutumnClient } from "../autumn-client";

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

const router = Router();
const autumn = createAutumnClient();

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    if (!isCheckoutRequest(req.body)) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const checkout = await autumn.request<{ url: string; id: string }>("/v1/checkout", {
      method: "POST",
      body: req.body,
    });
    res.json(checkout);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/portal", async (req: Request, res: Response) => {
  try {
    const { customerId, returnUrl } = req.body as {
      customerId?: string;
      returnUrl?: string;
    };
    if (!customerId || !returnUrl) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const portal = await autumn.request<{ url: string }>("/v1/portal", {
      method: "POST",
      body: { customerId, returnUrl },
    });
    res.json(portal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.patch("/subscription", async (req: Request, res: Response) => {
  try {
    const { subscriptionId, productId } = req.body as {
      subscriptionId?: string;
      productId?: string;
    };
    if (!subscriptionId || !productId) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const updated = await autumn.request<unknown>(
      "/v1/subscriptions/" + encodeURIComponent(subscriptionId),
      {
        method: "PATCH",
        body: { productId },
      }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.delete("/subscription", async (req: Request, res: Response) => {
  try {
    const { subscriptionId, cancelAtPeriodEnd } = req.body as {
      subscriptionId?: string;
      cancelAtPeriodEnd?: boolean;
    };
    if (!subscriptionId) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const canceled = await autumn.request<unknown>(
      "/v1/subscriptions/" + encodeURIComponent(subscriptionId) + "/cancel",
      {
        method: "POST",
        body: { cancelAtPeriodEnd: cancelAtPeriodEnd ?? true },
      }
    );
    res.json(canceled);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/feature-check", async (req: Request, res: Response) => {
  try {
    const { customerId, featureId } = req.body as {
      customerId?: string;
      featureId?: string;
    };
    if (!customerId || !featureId) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const result = await autumn.request<unknown>("/v1/features/check", {
      method: "POST",
      body: { customerId, featureId },
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/usage", async (req: Request, res: Response) => {
  try {
    const { customerId, meterId, quantity } = req.body as {
      customerId?: string;
      meterId?: string;
      quantity?: number;
    };
    if (!customerId || !meterId || typeof quantity !== "number") {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    await autumn.request("/v1/usage", {
      method: "POST",
      body: { customerId, meterId, quantity },
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
`,
    "server/routes/webhooks.ts": `
import type { Request, Response } from "express";
import { Router } from "express";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const router = Router();

const verifySignature = (signature: string, payload: string, secret: string) => {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);
  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }
  return timingSafeEqual(signatureBuffer, digestBuffer);
};

router.post("/autumn", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const secret = process.env.AUTUMN_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Missing webhook secret" });
    return;
  }
  const signature = req.headers["autumn-signature"];
  const signatureValue = Array.isArray(signature) ? signature[0] : signature ?? "";
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);
  if (!verifySignature(signatureValue, rawBody, secret)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  try {
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
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid JSON" });
  }
});

export default router;
`,
    "server/index.ts": `
import express from "express";
import billingRoutes from "./routes/billing";
import webhookRoutes from "./routes/webhooks";

const app = express();

app.use("/api/webhooks", webhookRoutes);
app.use(express.json());
app.use("/api/billing", billingRoutes);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(\`Billing API listening on \${port}\`);
});
`,
    "src/components/CheckoutButton.vue": `
<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  productId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  label?: string;
}>();

const loading = ref(false);

const startCheckout = async () => {
  loading.value = true;
  try {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: props.productId,
        customerId: props.customerId,
        successUrl: props.successUrl,
        cancelUrl: props.cancelUrl,
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
    loading.value = false;
  }
};
</script>

<template>
  <button
    type="button"
    :disabled="loading"
    class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
    @click="startCheckout"
  >
    {{ loading ? "Redirecting..." : props.label ?? "Upgrade" }}
  </button>
</template>
`,
    "src/components/FeatureGate.vue": `
<script setup lang="ts">
defineProps<{
  allowed: boolean;
  fallback?: string;
}>();
</script>

<template>
  <slot v-if="allowed" />
  <span v-else>{{ fallback ?? "" }}</span>
</template>
`,
    "src/composables/useUsage.ts": `
export interface UsagePayload {
  customerId: string;
  meterId: string;
  quantity: number;
}

export const useUsage = () => {
  const trackUsage = async (payload: UsagePayload): Promise<void> => {
    await fetch("/api/billing/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  return { trackUsage };
};
`,
    "src/pages/BillingSuccess.vue": `
<template>
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
</template>
`,
    "src/pages/BillingCancel.vue": `
<template>
  <div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
    <h1 class="text-3xl font-semibold">Checkout canceled</h1>
    <p class="text-muted-foreground">
      Your checkout was canceled. You can restart the process at any time.
    </p>
    <a href="/" class="inline-flex w-fit items-center rounded-md border border-gray-200 px-4 py-2">
      Return to app
    </a>
  </div>
</template>
`,
  },
};
