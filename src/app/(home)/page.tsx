import Image from "next/image";
import { Metadata } from "next";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'What is Zapdev? AI-Powered Development Platform | Build Apps 10x Faster',
  description: 'Zapdev is an AI-powered development platform that helps developers build production-ready web applications 10x faster. Support for React, Vue, Angular, Svelte, and Next.js.',
  canonical: '/',
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
        answer: 'Zapdev is an AI-powered development platform that helps you build web applications 10x faster. Zapdev supports all major frameworks including React, Vue, Angular, Svelte, and Next.js.'
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
        question: 'How much faster can I build with AI code generation?',
        answer: 'Zapdev users report significant productivity gains, with some projects completed in hours instead of days.'
      },
      {
        question: 'What makes Zapdev different from other AI coding tools?',
        answer: 'Zapdev offers isolated sandbox environments, real-time collaboration powered by Convex, and multi-framework support in one platform. Unlike single-framework tools, Zapdev lets you build with React, Vue, Angular, Svelte, or Next.js, all with the same AI-powered workflow.'
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
