import type { PaymentTemplateBundle } from "./types";

export const angularPaymentTemplate: PaymentTemplateBundle = {
  framework: "angular",
  description: "Angular payment integration with Autumn + Stripe",
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
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
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
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
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

router.post("/autumn", async (req: Request, res: Response) => {
  const secret = process.env.AUTUMN_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Missing webhook secret" });
    return;
  }
  const signature = req.headers["autumn-signature"];
  const signatureValue = Array.isArray(signature) ? signature[0] : signature ?? "";
  const rawBody = (req as any).rawBody;
  if (!rawBody || !verifySignature(signatureValue, rawBody, secret)) {
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
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use("/api/billing", billingRoutes);
app.use("/api/webhooks", webhookRoutes);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(\`Billing API listening on \${port}\`);
});
`,
    "src/app/services/billing.service.ts": `
import { Injectable } from "@angular/core";

interface CheckoutPayload {
  productId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}

@Injectable({ providedIn: "root" })
export class BillingService {
  async startCheckout(payload: CheckoutPayload): Promise<void> {
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    }
  }

  async checkFeature(customerId: string, featureId: string): Promise<boolean> {
    const response = await fetch("/api/billing/feature-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, featureId }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = data?.error || "Feature check failed";
      throw new Error(message);
    }

    const data = (await response.json()) as { allowed?: boolean };
    return data.allowed === true;
  }

  async trackUsage(customerId: string, meterId: string, quantity: number): Promise<void> {
    const response = await fetch("/api/billing/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, meterId, quantity }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = data?.error || "Usage tracking failed";
      throw new Error(message);
    }
  }
}
`,
    "src/app/guards/feature.guard.ts": `
import { Injectable } from "@angular/core";
import type { CanActivateFn, ActivatedRouteSnapshot } from "@angular/router";
import { BillingService } from "../services/billing.service";

@Injectable({ providedIn: "root" })
export class FeatureGuard {
  constructor(private billingService: BillingService) {}

  canActivate: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
    const featureId = route.data?.["featureId"];
    const customerId = route.data?.["customerId"];
    if (typeof featureId !== "string" || typeof customerId !== "string") {
      return false;
    }
    return this.billingService.checkFeature(customerId, featureId);
  };
}
`,
    "src/app/components/checkout-button/checkout-button.component.ts": `
import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BillingService } from "../../services/billing.service";

@Component({
  selector: "app-checkout-button",
  standalone: true,
  imports: [CommonModule],
  template: \`
    <button
      type="button"
      class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
      [disabled]="loading"
      (click)="startCheckout()"
    >
      {{ loading ? "Redirecting..." : (label ?? "Upgrade") }}
    </button>
  \`,
})
export class CheckoutButtonComponent {
  @Input({ required: true }) productId = "";
  @Input({ required: true }) customerId = "";
  @Input({ required: true }) successUrl = "";
  @Input({ required: true }) cancelUrl = "";
  @Input() label?: string;

  loading = false;

  constructor(private billingService: BillingService) {}

  async startCheckout() {
    this.loading = true;
    try {
      await this.billingService.startCheckout({
        productId: this.productId,
        customerId: this.customerId,
        successUrl: this.successUrl,
        cancelUrl: this.cancelUrl,
      });
    } finally {
      this.loading = false;
    }
  }
}
`,
    "src/app/components/billing-success/billing-success.component.ts": `
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-billing-success",
  standalone: true,
  imports: [CommonModule],
  template: \`
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
  \`,
})
export class BillingSuccessComponent {}
`,
    "src/app/components/billing-cancel/billing-cancel.component.ts": `
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-billing-cancel",
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 class="text-3xl font-semibold">Checkout canceled</h1>
      <p class="text-muted-foreground">
        Your checkout was canceled. You can restart the process at any time.
      </p>
      <a href="/" class="inline-flex w-fit items-center rounded-md border border-gray-200 px-4 py-2">
        Return to app
      </a>
    </div>
  \`,
})
export class BillingCancelComponent {}
`,
  },
};
