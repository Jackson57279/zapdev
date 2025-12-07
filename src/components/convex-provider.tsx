"use client";

import { useMemo, type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const missingConfig = !convexUrl || !clerkPublishableKey;

  if (missingConfig) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Missing Convex/Clerk environment configuration. Set NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY."
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-lg space-y-2">
          <p className="text-lg font-semibold">Environment configuration required</p>
          <p className="text-sm text-muted-foreground">
            Add NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your environment to enable authentication and real-time features.
          </p>
        </div>
      </div>
    );
  }

  const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
  const clerkJSUrl =
    process.env.NEXT_PUBLIC_CLERK_JS_URL ??
    "https://clerk.clerk.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
  const useProxy = proxyUrl?.startsWith("/");

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      clerkJSUrl={clerkJSUrl}
      {...(useProxy ? { proxyUrl } : {})}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
