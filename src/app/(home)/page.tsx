import { Metadata } from "next";
import { Suspense } from "react";

import PageContent from "./page-content";
import {
  generateMetadata as generateSEOMetadata,
  generateStructuredData,
  generateFAQStructuredData,
  generateSoftwareApplicationStructuredData,
  generateProductStructuredData,
  generateDatasetStructuredData,
  generateTechStackStructuredData
} from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Zapdev - AI-Powered Development Platform | Build Apps 10x Faster',
  description: 'Create production-ready web applications with AI assistance. Support for React, Vue, Angular, Svelte, and Next.js. Build, test, and deploy in minutes, not days.',
  canonical: '/',
});

const Page = () => {
  const structuredData = [
    generateStructuredData('Organization', {}),
    generateSoftwareApplicationStructuredData(),
    generateProductStructuredData(),
    generateDatasetStructuredData(),
    generateTechStackStructuredData(),
    generateStructuredData('WebApplication', {
      name: 'Zapdev Platform',
      description: 'AI-powered development platform for building web applications',
      screenshot: 'https://zapdev.link/screenshot.png',
      featureList: [
        'AI Code Generation',
        'Multi-Framework Support',
        'Instant Deployment',
        'Real-time Collaboration',
        'Version Control Integration'
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '2350'
      }
    }),
    generateFAQStructuredData([
      {
        question: 'What is Zapdev?',
        answer: 'Zapdev is an AI-powered development platform that helps you build web applications 10x faster. It supports all major frameworks including React, Vue, Angular, Svelte, and Next.js.'
      },
      {
        question: 'How does AI-powered development work?',
        answer: 'Simply describe what you want to build in natural language, and our AI will generate production-ready code. You can iterate, modify, and deploy your application all within the Zapdev platform.'
      },
      {
        question: 'Which frameworks does Zapdev support?',
        answer: 'Zapdev supports React 18, Vue 3, Angular 19, Svelte, and Next.js 15. We continuously add support for new frameworks and libraries based on community demand.'
      },
      {
        question: 'Is Zapdev suitable for production applications?',
        answer: 'Absolutely! Zapdev generates clean, maintainable code following industry best practices. Many companies use Zapdev to build and deploy production applications.'
      },
      {
        question: 'What technology stack does Zapdev use?',
        answer: 'Zapdev uses Next.js 15 with React 19, TypeScript 5.9, Tailwind CSS v4, Convex for real-time database, tRPC for type-safe APIs, and Claude AI via Vercel AI Gateway for code generation. Code runs in isolated E2B sandboxes.'
      },
      {
        question: 'How much does Zapdev cost?',
        answer: 'Zapdev offers a free tier with 5 AI code generations per 24 hours, and a Pro tier with 100 generations per 24 hours. Both tiers provide access to all frameworks and features.'
      }
    ])
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <Suspense fallback={
        <div className="flex flex-col max-w-5xl mx-auto w-full items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      }>
        <PageContent />
      </Suspense>
    </>
  );
};
 
export default Page;
