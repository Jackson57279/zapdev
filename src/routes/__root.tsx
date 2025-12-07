import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "@/app/globals.css";
import NotFound from "@/app/not-found";

export const Route = createRootRouteWithContext({
  component: RootComponent,
  notFoundComponent: () => <NotFound />,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://ai-gateway.vercel.sh" />
        <link rel="preconnect" href="https://api.convex.dev" />
        <link rel="preconnect" href="https://sandbox.e2b.dev" />
        <link rel="dns-prefetch" href="https://clerk.com" />
        <link rel="dns-prefetch" href="https://vercel.com" />
      </head>
      <body className="antialiased">
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster />
            <WebVitalsReporter />
            <Outlet />
          </ThemeProvider>
        </ConvexClientProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
