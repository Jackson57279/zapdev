"use client";

import Script from "next/script";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://zapdev.link/#organization",
  name: "Zapdev",
  legalName: "Zapdev Inc.",
  url: "https://zapdev.link",
  logo: {
    "@type": "ImageObject",
    url: "https://zapdev.link/logo.png",
    width: 512,
    height: 512,
  },
  description:
    "Zapdev is an AI-powered development platform that generates production-ready web applications through conversational AI.",
  foundingDate: "2024",
  numberOfEmployees: {
    "@type": "QuantitativeValue",
    value: "10-50",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["English"],
      url: "https://zapdev.link/support",
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      availableLanguage: ["English"],
      url: "https://zapdev.link/contact",
    },
  ],
  sameAs: [
    "https://twitter.com/zapdev",
    "https://linkedin.com/company/zapdev",
    "https://github.com/zapdev",
  ],
  knowsAbout: [
    "AI-powered software development",
    "Code generation",
    "Web application development",
    "Cloud-native applications",
    "Developer tools",
  ],
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://zapdev.link/#product",
  name: "Zapdev AI Development Platform",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: "https://zapdev.link",
  description:
    "AI-powered platform that generates production-ready web applications across Next.js, React, Angular, Vue, and SvelteKit.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "49",
    offerCount: "3",
    availability: "https://schema.org/InStock",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "350",
    bestRating: "5",
    worstRating: "1",
  },
  featureList:
    "AI code generation, Multi-framework support (Next.js, React, Angular, Vue, SvelteKit), Real-time preview, E2B sandboxed execution, Figma import, GitHub integration",
  screenshot: "https://zapdev.link/og-image.png",
  author: {
    "@type": "Organization",
    "@id": "https://zapdev.link/#organization",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://zapdev.link/#faq",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an AI development platform?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An AI development platform provides tools, APIs, and infrastructure to build, train, and deploy AI-enhanced applications. Zapdev enables developers to generate production-ready applications through natural language conversation.",
      },
    },
    {
      "@type": "Question",
      name: "How does Zapdev generate code with AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Zapdev uses state-of-the-art large language models via the Vercel AI SDK to interpret natural language prompts and generate production-ready code. Each generated app runs in an isolated E2B sandbox for real-time preview and validation.",
      },
    },
    {
      "@type": "Question",
      name: "What frameworks does Zapdev support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Zapdev supports five major web frameworks: Next.js 15 (with Shadcn/ui), React 18 (with Chakra UI), Angular 19 (with Angular Material), Vue 3 (with Vuetify), and SvelteKit (with DaisyUI).",
      },
    },
  ],
};

export function StructuredData() {
  return (
    <>
      <Script
        id="ld-json-organization"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Script
        id="ld-json-product"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <Script
        id="ld-json-faq"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  );
}
