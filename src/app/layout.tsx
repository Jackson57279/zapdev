import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { StackProvider, StackTheme, StackServerApp } from "@stackframe/stack";

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
  description: "Zapdev is a leading software development company specializing in building scalable web applications, mobile apps, and enterprise solutions. Transform your ideas into reality with our expert development team.",
  keywords: ["software development", "web development", "mobile apps", "enterprise solutions", "Zapdev", "app development", "custom software"],
  authors: [{ name: "Zapdev" }],
  creator: "Zapdev",
  publisher: "Zapdev",
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
    title: "Zapdev - Build Fast, Scale Smart",
    description: "Zapdev is a leading software development company specializing in building scalable web applications, mobile apps, and enterprise solutions.",
    siteName: "Zapdev",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zapdev - Build Fast, Scale Smart",
    description: "Zapdev is a leading software development company specializing in building scalable web applications, mobile apps, and enterprise solutions.",
    creator: "@zapdev",
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
};

const stackProjectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const stackServerApp = stackProjectId
  ? new StackServerApp({
      tokenStore: "nextjs-cookie",
      urls: {
        // Keep handler routes as fallback for direct URL access
        signIn: "/handler/sign-in",
        signUp: "/handler/sign-up",
        afterSignIn: "/",
        afterSignUp: "/",
      },
    })
  : null;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appShell = (
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
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        {stackServerApp ? (
          <StackProvider app={stackServerApp}>
            <StackTheme>{appShell}</StackTheme>
          </StackProvider>
        ) : (
          appShell
        )}
      </body>
      <SpeedInsights />
    </html>
  );
};
