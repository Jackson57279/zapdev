"use client";

import { ReactNode, Suspense, lazy } from "react";

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

// CI build placeholder key - used to skip Clerk during builds
const CI_BUILD_KEY = "pk_test_ZmFrZS1pbnN0YW5jZS1pZA";

// Check if we have a valid Clerk publishable key (not a CI placeholder)
const hasValidClerkKey = () => {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // Skip if no key or if it's the CI build placeholder
  if (!key || key === CI_BUILD_KEY) {
    return false;
  }
  // Valid Clerk keys start with pk_test_ or pk_live_ and are longer than 20 chars
  return (key.startsWith("pk_test_") || key.startsWith("pk_live_")) && key.length > 20;
};

// Only import ClerkProvider when we have a valid key
const ClerkProviderLazy = hasValidClerkKey()
  ? lazy(() => import("@clerk/nextjs").then((mod) => ({ default: mod.ClerkProvider })))
  : null;

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  // During build time with placeholder key, render children without Clerk
  if (!ClerkProviderLazy) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={children}>
      <ClerkProviderLazy>{children}</ClerkProviderLazy>
    </Suspense>
  );
}
