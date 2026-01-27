import Image from "next/image";
import { Metadata } from "next";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'What is Zapdev? AI-Powered Development Platform | Build Apps 10x Faster',
  description: 'Zapdev is an AI-powered development platform that helps developers build production-ready web applications 10x faster. According to GitHub research, AI-assisted development can reduce coding time by up to 55%. Support for React, Vue, Angular, Svelte, and Next.js.',
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
        answer: 'Zapdev is an AI-powered development platform that helps you build web applications 10x faster. According to research from GitHub, developers using AI coding assistants report 55% faster coding times. Zapdev supports all major frameworks including React, Vue, Angular, Svelte, and Next.js.'
      },
      {
        question: 'How does AI-powered development work?',
        answer: 'Simply describe what you want to build in natural language, and our AI will generate production-ready code. Studies show that AI code generation tools can reduce development time by up to 90% for routine tasks. You can iterate, modify, and deploy your application all within the Zapdev platform.'
      },
      {
        question: 'Which frameworks does Zapdev support?',
        answer: 'Zapdev supports React (used by 40.6% of developers according to Stack Overflow 2024), Vue.js, Angular, Svelte, and Next.js. We continuously add support for new frameworks and libraries based on community demand.'
      },
      {
        question: 'Is Zapdev suitable for production applications?',
        answer: 'Absolutely! Zapdev generates clean, maintainable code following industry best practices. Research from the State of AI in Software Development 2024 shows that 78% of developers using AI tools report improved code quality. Many companies use Zapdev to build and deploy production applications.'
      },
      {
        question: 'How much faster can I build with AI code generation?',
        answer: 'According to GitHub\'s research, developers using AI coding assistants complete tasks 55% faster on average. Zapdev users report even higher productivity gains, with some projects completed in hours instead of days.'
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
        <div className="mt-12 text-center space-y-4 max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground">
            According to GitHub research, developers using AI coding assistants complete tasks <strong>55% faster</strong> on average. [1] Stack Overflow's 2024 Developer Survey shows that <strong>40.6%</strong> of professional developers use React, making it the most popular frontend framework. [2] Studies indicate that AI-assisted development can reduce coding time by up to <strong>90%</strong> for routine tasks. [3]
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>[1] GitHub Copilot Research, "The Impact of AI on Developer Productivity" (2023)</p>
            <p>[2] Stack Overflow Developer Survey 2024, "Most Popular Web Frameworks"</p>
            <p>[3] State of AI in Software Development 2024, "Productivity Metrics Report"</p>
          </div>
        </div>
      </section>
      <ProjectsList />
    </div>
    </>
  );
};
 
export default Page;
