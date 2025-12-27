import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack";

import { Toaster } from "@/components/ui/sonner";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zapdev - Build Fast, Scale Smart",
    template: "%s | Zapdev"
  },
  description: "Zapdev is an AI-powered development platform specializing in building scalable web applications across React, Vue, Angular, Svelte, and Next.js. Transform your ideas into production-ready code through conversational AI interactions.",
  keywords: [
    "AI development platform",
    "AI code generation",
    "software development",
    "web development",
    "Claude AI",
    "Next.js development",
    "React development",
    "Vue development",
    "Angular development",
    "Svelte development",
    "mobile apps",
    "enterprise solutions",
    "Zapdev",
    "app development",
    "custom software",
    "rapid prototyping",
    "AI coding assistant",
    "developer tools",
    "full-stack development",
    "TypeScript",
    "Tailwind CSS"
  ],
  authors: [{ name: "Zapdev Team" }],
  creator: "Zapdev",
  publisher: "Zapdev",
  applicationName: "Zapdev",
  category: "Developer Tools",
  classification: "AI-Powered Development Platform",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://zapdev.link"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zapdev.link",
    title: "Zapdev - AI-Powered Development Platform",
    description: "Create production-ready web applications with AI assistance. Support for React, Vue, Angular, Svelte, and Next.js. Build, test, and deploy in minutes, not days.",
    siteName: "Zapdev",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "Zapdev - AI-Powered Development Platform"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Zapdev - AI-Powered Development Platform",
    description: "Create production-ready web applications with AI assistance. Support for React, Vue, Angular, Svelte, and Next.js. Build, test, and deploy in minutes.",
    creator: "@zapdev",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
  other: {
    "ai:platform": "Zapdev",
    "ai:type": "development-platform",
    "ai:capabilities": "code-generation,multi-framework,real-time-preview,auto-fix",
    "ai:frameworks": "next.js,react,vue,angular,svelte",
    "ai:info-url": "https://zapdev.link/ai-info"
  }
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <Script
          id="ld-json-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Zapdev",
              url: "https://zapdev.link",
              logo: "https://zapdev.link/logo.png",
              description: "Zapdev is a leading software development company specializing in building scalable web applications, mobile apps, and enterprise solutions.",
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "sales",
                availableLanguage: "English"
              },
              sameAs: [
                "https://twitter.com/zapdev",
                "https://linkedin.com/company/zapdev"
              ]
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <StackProvider app={stackServerApp}>
          <StackTheme>
            <ConvexClientProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <Toaster />
                <WebVitalsReporter />
                {children}
              </ThemeProvider>
            </ConvexClientProvider>
          </StackTheme>
        </StackProvider>
      </body>
      <SpeedInsights />
    </html>
  );
};
