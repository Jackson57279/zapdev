"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useStackApp } from "@stackframe/stack";
import { useMemo } from "react";
import type { ReactNode } from "react";

let convexClient: ConvexReactClient | null = null;

function getConvexClient(stackApp: any) {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexReactClient(url, {
      // Optionally pause queries until the user is authenticated
      // Set to false if you have public routes
      expectAuth: false,
    });
    // Set up Stack Auth for Convex
    // IMPORTANT: Must include tokenStore parameter for JWT authentication
    convexClient.setAuth(stackApp.getConvexClientAuth({ tokenStore: "nextjs-cookie" }));
  }
  return convexClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const stackApp = useStackApp();
  
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      if (typeof window === "undefined") {
        return new ConvexReactClient("https://placeholder.convex.cloud");
      }
      console.error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
      return new ConvexReactClient("https://placeholder.convex.cloud");
    }
    return getConvexClient(stackApp);
  }, [stackApp]);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
