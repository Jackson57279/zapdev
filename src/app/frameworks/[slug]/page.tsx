import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getFramework, getRelatedFrameworks, getAllFrameworks } from '@/lib/frameworks';
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, CheckCircle2, Zap, Code2, Rocket } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const frameworks = getAllFrameworks();
  return frameworks.map((framework) => ({
    slug: framework.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const framework = getFramework(slug);
  
  if (!framework) {
    return generateSEOMetadata({
      title: 'Framework Not Found',
      description: 'The requested framework page could not be found.',
      robots: { index: false, follow: false }
    });
  }

  return generateSEOMetadata({
    title: `${framework.name} Development with AI | Build ${framework.name} Apps Faster`,
    description: framework.metaDescription,
    keywords: framework.keywords,
    canonical: `/frameworks/${framework.slug}`,
    openGraph: {
      title: framework.title,
      description: framework.metaDescription,
      type: 'article',
      images: [{
        url: `/og-images/framework-${framework.slug}.png`,
        width: 1200,
        height: 630,
        alt: `${framework.name} Development with Zapdev`
      }]
    },
    twitter: {
      card: 'summary_large_image',
      title: framework.title,
      description: framework.metaDescription
    }
  });
}

export default async function FrameworkPage({ params }: PageProps) {
  const { slug } = await params;
  const framework = getFramework(slug);
  
  if (!framework) {
    notFound();
  }

  const relatedFrameworks = getRelatedFrameworks(framework.slug);
  
  const faqs = [
    {
      question: `What makes Zapdev ideal for ${framework.name} development?`,
      answer: `Zapdev&apos;s AI is specifically trained on ${framework.name} best practices, patterns, and ecosystem. It generates optimized, production-ready code that follows ${framework.name} conventions and leverages the framework&apos;s unique features.`
    },
    {
      question: `Can I use TypeScript with ${framework.name} on Zapdev?`,
      answer: `Yes! Zapdev fully supports TypeScript for ${framework.name} development. Our AI generates type-safe code with proper type definitions, interfaces, and generics when you choose TypeScript.`
    },
    {
      question: `How fast can I build a ${framework.name} app with Zapdev?`,
      answer: `With Zapdev&apos;s AI assistance, you can create a functional ${framework.name} application in minutes. Complex features that typically take hours can be implemented in seconds with our intelligent code generation.`
    },
    {
      question: `Does Zapdev support ${framework.name}&apos;s latest features?`,
      answer: `Absolutely! Our AI models are continuously updated to support the latest ${framework.name} features, APIs, and best practices. We ensure compatibility with the most recent stable versions.`
    }
  ];

  const structuredData = [
    generateStructuredData('SoftwareApplication', {
      name: `${framework.name} Development Platform`,
      description: framework.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '1250',
        bestRating: '5',
        worstRating: '1'
      }
    }),
    generateFAQStructuredData(faqs),
    generateStructuredData('Article', {
      headline: framework.title,
      description: framework.metaDescription,
      author: {
        '@type': 'Organization',
        name: 'Zapdev'
      },
      datePublished: new Date().toISOString(),
      dateModified: new Date().toISOString()
    })
  ];

  const breadcrumbItems = [
    { name: 'Frameworks', url: '/frameworks' },
    { name: framework.name, url: `/frameworks/${framework.slug}` }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />
        
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-6xl">{framework.icon}</span>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">
                  {framework.title}
                </h1>
                <p className="text-xl text-muted-foreground">
                  {framework.description}
                </p>
                <p className="text-base text-muted-foreground mt-4">
                  Zapdev helps you build {framework.name} apps faster with AI-generated, production-ready code, best-practice defaults, and one-click deployment.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
              <Button size="lg" className="gap-2">
                <Rocket className="h-5 w-5" />
                Start Building with {framework.name}
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <Code2 className="h-5 w-5" />
                View Examples
              </Button>
            </div>

            <Tabs defaultValue="features" className="mb-12">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="use-cases">Use Cases</TabsTrigger>
                <TabsTrigger value="advantages">Advantages</TabsTrigger>
              </TabsList>
              
              <TabsContent value="features" className="mt-6">
                <h2 className="text-2xl font-bold mb-4">What features help you build faster?</h2>
                <div className="grid gap-4">
                  {framework.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold">{feature}</h3>
                        <p className="text-muted-foreground">
                          Leverage {framework.name}&apos;s {feature.toLowerCase()} to build better applications faster.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="use-cases" className="mt-6">
                <h2 className="text-2xl font-bold mb-4">What projects fit {framework.name} best?</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {framework.useCases.map((useCase) => (
                    <Card key={useCase}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{useCase}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Build {useCase.toLowerCase()} with {framework.name} and deploy instantly.
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="advantages" className="mt-6">
                <h2 className="text-2xl font-bold mb-4">Why Choose {framework.name}?</h2>
                <div className="space-y-4">
                  {framework.advantages.map((advantage) => (
                    <div key={advantage} className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold">{advantage}</h3>
                        <p className="text-muted-foreground">
                          {framework.name} provides {advantage.toLowerCase()} for modern web development.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>How do you get started?</CardTitle>
                <CardDescription>
                  Get started with {framework.name} in seconds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm">1. Choose {framework.name} as your framework</p>
                  <p className="text-sm">2. Describe your application idea</p>
                  <p className="text-sm">3. Let AI generate your code</p>
                  <p className="text-sm">4. Deploy with one click</p>
                  <Button className="w-full mt-4">
                    Start Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Explore <Link href="/solutions" className="underline underline-offset-4">AI solutions</Link> or see real apps in the <Link href="/showcase" className="underline underline-offset-4">showcase</Link>.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Which tools are popular in the ecosystem?</CardTitle>
                <CardDescription>
                  Popular tools and libraries for {framework.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {framework.ecosystem.map((tool) => (
                    <Link
                      key={tool.name}
                      href={tool.url}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <h4 className="font-semibold">{tool.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Which related frameworks should you consider?</CardTitle>
                <CardDescription>
                  Explore other popular frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {relatedFrameworks.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/frameworks/${related.slug}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{related.icon}</span>
                        <span className="font-medium">{related.name}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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

        <section className="bg-primary/10 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Build with {framework.name}?
          </h2>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join thousands of developers using Zapdev to build {framework.name} applications faster than ever before.
          </p>
          <Button size="lg" className="gap-2">
            <Rocket className="h-5 w-5" />
            Start Building for Free
          </Button>
        </section>
      </div>
    </>
  );
}
