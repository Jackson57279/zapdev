"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

// Check if we have a valid Clerk publishable key
const hasValidClerkKey = () => {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // Valid Clerk keys start with pk_test_ or pk_live_ followed by actual key content
  return key && (key.startsWith("pk_test_") || key.startsWith("pk_live_")) && key.length > 20;
};

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  // During build time with placeholder key, render children without Clerk
  if (!hasValidClerkKey()) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
