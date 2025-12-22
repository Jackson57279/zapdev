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

  return new Polar({
    accessToken,
  });
}

export function getPolarClient(): Polar {
  if (!polarClientInstance) {
    polarClientInstance = createPolarClient();
  }
  return polarClientInstance;
}

export const polarClient = new Proxy({} as Polar, {
  get(_target, prop: string | symbol) {
    return getPolarClient()[prop as keyof Polar];
  },
});

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

export function getPolarWebhookSecret(): string {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "POLAR_WEBHOOK_SECRET is not configured. " +
      "Get your webhook secret from https://polar.sh/dashboard/settings/webhooks"
    );
  }
  return secret;
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

export function isPolarConfigured(): boolean {
  return !!(
    process.env.POLAR_ACCESS_TOKEN?.trim() &&
    process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID?.trim() &&
    process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID?.trim()
  );
}



