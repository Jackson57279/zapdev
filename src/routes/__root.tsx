import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "@/app/globals.css";
import NotFound from "@/app/not-found";

export const Route = createRootRouteWithContext()({
  component: RootComponent,
  notFoundComponent: () => <NotFound />,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ZapDev - AI-Powered Development Platform</title>
        <meta name="description" content="Build applications faster with AI-powered development tools. ZapDev provides intelligent code generation, sandboxed environments, and seamless integrations." />
        <meta name="keywords" content="AI development, code generation, sandbox, development platform, AI tools" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://zapdev.link/" />
        <meta property="og:title" content="ZapDev - AI-Powered Development Platform" />
        <meta property="og:description" content="Build applications faster with AI-powered development tools" />
        <meta property="og:image" content="https://zapdev.link/og-image.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://zapdev.link/" />
        <meta property="twitter:title" content="ZapDev - AI-Powered Development Platform" />
        <meta property="twitter:description" content="Build applications faster with AI-powered development tools" />
        <meta property="twitter:image" content="https://zapdev.link/og-image.png" />
        
        {/* Performance & Resource Hints */}
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
