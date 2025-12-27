import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSolution, getAllSolutions } from '@/lib/solutions';
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Only generate static params in production with valid Clerk key
export async function generateStaticParams() {
  // Skip static generation during CI builds without valid Clerk credentials
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_build_placeholder')) {
    return [];
  }
  const solutions = getAllSolutions();
  return solutions.map((solution) => ({
    slug: solution.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  
  if (!solution) {
    return generateSEOMetadata({
      title: 'Solution Not Found',
      description: 'The requested solution page could not be found.',
      robots: { index: false, follow: false }
    });
  }

  return generateSEOMetadata({
    title: `${solution.title} | Zapdev`,
    description: solution.metaDescription,
    keywords: solution.keywords,
    canonical: `/solutions/${solution.slug}`,
    openGraph: {
      title: solution.title,
      description: solution.metaDescription,
      type: 'article',
      images: [{
        url: `/og-images/solution-${solution.slug}.png`,
        width: 1200,
        height: 630,
        alt: solution.title
      }]
    }
  });
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolution(slug);
  
  if (!solution) {
    notFound();
  }

  const faqs = [
    {
      question: `How does ${solution.heading.toLowerCase()} work?`,
      answer: `Our AI analyzes your requirements and generates production-ready code instantly. Simply describe what you need, and our platform handles the technical implementation, ensuring best practices and optimal performance.`
    },
    {
      question: 'What frameworks and languages are supported?',
      answer: 'We support all major web frameworks including React, Vue, Angular, Svelte, and Next.js. Our AI generates TypeScript and JavaScript code with full type safety when needed.'
    },
    {
      question: 'Can I customize the generated code?',
      answer: 'Absolutely! All generated code is fully customizable. You can modify, extend, or refactor the code as needed. Our AI can also help you make specific changes based on your requirements.'
    },
    {
      question: 'Is this suitable for production applications?',
      answer: 'Yes! Our AI generates clean, maintainable, production-ready code that follows industry best practices. Many companies use Zapdev to build and deploy production applications.'
    }
  ];

  const structuredData = [
    generateStructuredData('Service', {
      name: solution.heading,
      description: solution.description,
      provider: {
        '@type': 'Organization',
        name: 'Zapdev'
      }
    }),
    generateFAQStructuredData(faqs),
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to use ${solution.heading}`,
      description: solution.description,
      step: [
        {
          '@type': 'HowToStep',
          name: 'Sign up for Zapdev',
          text: 'Create your free account to get started'
        },
        {
          '@type': 'HowToStep',
          name: 'Describe your project',
          text: 'Tell our AI what you want to build in natural language'
        },
        {
          '@type': 'HowToStep',
          name: 'Review and customize',
          text: 'Review the generated code and make any necessary adjustments'
        },
        {
          '@type': 'HowToStep',
          name: 'Deploy your application',
          text: 'Deploy your application with one click to production'
        }
      ]
    }
  ];

  const breadcrumbItems = [
    { name: 'Solutions', url: '/solutions' },
    { name: solution.heading, url: `/solutions/${solution.slug}` }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {solution.heading}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            {solution.description}
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Start Building Free
            </Button>
            <Button size="lg" variant="outline">
              Watch Demo
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {solution.features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <div className="text-4xl mb-4">{feature.icon}</div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-6">Key Benefits</h2>
            <div className="space-y-4">
              {solution.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-lg">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6">Use Cases</h2>
            <div className="space-y-6">
              {solution.useCases.map((useCase, index) => (
                <div key={index}>
                  <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-muted-foreground">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Describe', desc: 'Tell us what you want to build' },
              { step: '2', title: 'Generate', desc: 'AI creates your application' },
              { step: '3', title: 'Customize', desc: 'Modify and extend as needed' },
              { step: '4', title: 'Deploy', desc: 'Launch to production instantly' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-primary/10 rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {solution.cta.title}
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {solution.cta.description}
          </p>
          <Button size="lg" className="gap-2">
            Get Started Now <ArrowRight className="h-5 w-5" />
          </Button>
        </section>
      </div>
    </>
  );
}
