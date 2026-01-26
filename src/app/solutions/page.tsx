import { Metadata } from 'next';
import Link from 'next/link';
import { getAllSolutions } from '@/lib/solutions';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = generateSEOMetadata({
  title: 'What AI development solutions are available? Code Generation & More | Zapdev',
  description: 'AI development solutions: Code generation (10x faster), rapid prototyping (MVP in minutes), no-code development, and enterprise AI. Choose the solution that fits your needs.',
  keywords: [
    'AI development solutions',
    'code generation platform',
    'rapid prototyping',
    'no-code development',
    'enterprise AI',
    'development automation',
    'AI programming tools',
    'what is AI code generation',
    'AI development tools'
  ],
  canonical: '/solutions',
  openGraph: {
    title: 'AI Development Solutions: What options are available?',
    description: 'Explore AI code generation, rapid prototyping, no-code development, and enterprise AI solutions. Find the right solution for your project.',
    type: 'website'
  }
});

export default function SolutionsPage() {
  const solutions = getAllSolutions();
  
  const structuredData = [
    generateStructuredData('Service', {
      name: 'Zapdev AI Development Solutions',
      description: 'Comprehensive AI-powered development solutions for all needs',
      provider: {
        '@type': 'Organization',
        name: 'Zapdev'
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Development Solutions',
        itemListElement: solutions.map(solution => ({
          '@type': 'Service',
          name: solution.heading,
          description: solution.description
        }))
      }
    })
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Which AI development solution fits your project?
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Zapdev provides AI-powered solutions for code generation, rapid prototyping, and enterprise development.
            Pick a solution based on your goal, then build faster and ship with confidence.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-4">
            Prefer to start with a framework? Browse <Link href="/frameworks" className="underline underline-offset-4">frameworks</Link> or get inspiration from the <Link href="/showcase" className="underline underline-offset-4">project showcase</Link>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {solutions.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="block transition-transform hover:scale-105"
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-2xl">{solution.heading}</CardTitle>
                  <CardDescription className="text-base">
                    {solution.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {solution.features.slice(0, 2).map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-xl">{feature.icon}</span>
                          <span className="text-sm">{feature.title}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center text-primary font-medium">
                      Learn more <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="text-center bg-muted/50 rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-6">
            Not Sure Which Solution is Right for You?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our AI can help you choose the perfect solution based on your specific needs and requirements.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/home/sign-up">
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Get Personalized Recommendation
              </button>
            </Link>
            <Link href="/frameworks">
              <button className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors">
                Browse by Framework
              </button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}