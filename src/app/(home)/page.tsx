import Image from "next/image";
import { Metadata } from "next";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Zapdev - #1 AI Website Builder | Best Lovable Alternative 2026',
  description: 'The #1 AI website builder and top Lovable alternative. Build full-stack web apps, SaaS products, and production sites from a single prompt. Better than Bolt.new, v0, and Replit for real applications.',
  canonical: '/',
  keywords: [
    'AI website builder',
    'Lovable alternative',
    'best AI app builder',
    'Bolt.new vs Lovable',
    'v0.dev alternative',
    'Replit Agent alternative',
    'full stack AI builder',
    'AI SaaS builder',
    'vibe coding tool',
    'AI startup builder'
  ]
});

const Page = () => {
  const structuredData = [
    generateStructuredData('Organization', {}),
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
        answer: 'Zapdev supports React, Vue.js, Angular, Svelte, and Next.js. We continuously add support for new frameworks and libraries based on community demand.'
      },
      {
        question: 'Is Zapdev suitable for production applications?',
        answer: 'Absolutely! Zapdev generates clean, maintainable code following industry best practices. Many companies use Zapdev to build and deploy production applications.'
      },
      {
        question: 'What is the best Lovable alternative?',
        answer: 'Zapdev is the top-rated Lovable alternative for developers who need full-stack applications with real backend logic, databases, authentication, and API endpoints. While Lovable excels at frontend demos and landing pages, Zapdev generates complete production-ready SaaS applications.'
      },
      {
        question: 'Is Zapdev better than Bolt.new?',
        answer: 'Zapdev offers faster deployment, cleaner architecture, and more robust backend generation than Bolt.new. While Bolt.new provides developer control, Zapdev delivers a more complete full-stack experience with automated build validation and multi-framework support.'
      },
      {
        question: 'How does Zapdev compare to v0 by Vercel?',
        answer: 'v0.dev generates excellent React UI components. Zapdev builds complete applications including frontend, backend, database, auth, and deployment. If you need more than a component library, Zapdev is the full-stack solution.'
      },
      {
        question: 'Why choose Zapdev over Replit Agent?',
        answer: 'Replit Agent is powerful but requires more setup and locks you into the Replit ecosystem. Zapdev gives you exportable code that runs anywhere, with faster iteration and better deployment integration.'
      }
    ])
  ];

  return (
    <>
      <StructuredData data={structuredData} />
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <section className="space-y-6 py-[16vh] 2xl:py-48">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="ZapDev"
            width={50}
            height={50}
            className="hidden md:block"
          />
        </div>
        <h1 className="text-2xl md:text-5xl font-bold text-center">
          Build something with ZapDev
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground text-center">
          Create apps and websites by chatting with AI
        </p>
        <div className="max-w-3xl mx-auto w-full">
          <ProjectForm />
        </div>
      </section>
      <ProjectsList />
    </div>
    </>
  );
};
 
export default Page;
