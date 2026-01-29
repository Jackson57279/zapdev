import { Metadata } from 'next';
import Link from 'next/link';
import { getAllComparisons } from '@/lib/comparisons';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = generateSEOMetadata({
  title: 'AI Code Generation Tool Comparisons: ZapDev vs Competitors',
  description: 'Compare ZapDev vs Lovable, Bolt, GitHub Copilot, and other AI code generation tools. See detailed feature comparisons, pricing, and recommendations for choosing the best platform.',
  keywords: [
    'AI code generation comparison',
    'ZapDev vs Lovable',
    'code generation tools comparison',
    'best AI coding platform',
    'AI development tools comparison'
  ],
  canonical: '/compare',
  openGraph: {
    title: 'AI Code Generation Tool Comparisons',
    description: 'Compare the best AI code generation platforms. See detailed comparisons of ZapDev vs competitors.',
    type: 'website'
  }
});

export default function ComparePage() {
  const comparisons = getAllComparisons();
  
  const structuredData = [
    generateStructuredData('WebPage', {
      name: 'AI Code Generation Tool Comparisons',
      description: 'Comprehensive comparisons of AI code generation platforms',
      url: '/compare'
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'AI Code Generation Tool Comparisons',
      itemListElement: comparisons.map((comparison, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: comparison.title,
        url: `https://zapdev.link/compare/${comparison.slug}`
      }))
    }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Compare AI Code Generation Tools
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Make informed decisions by comparing ZapDev with other leading AI code generation platforms. 
            According to GitHub research, developers using AI coding assistants report 55% faster coding times. [1]
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-4">
            Source: GitHub Copilot Research, "The Impact of AI on Developer Productivity" (2023)
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {comparisons.map((comparison) => (
            <Link
              key={comparison.slug}
              href={`/compare/${comparison.slug}`}
              className="block transition-transform hover:scale-105"
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-2xl">{comparison.title}</CardTitle>
                  <CardDescription className="text-base">
                    {comparison.intro.substring(0, 150)}...
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary font-medium">
                    Read full comparison <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last updated: {new Date(comparison.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="bg-muted/50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Why Compare AI Code Generation Tools?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2">Data-Driven Decisions</h3>
              <p className="text-muted-foreground">
                Compare features, pricing, and performance metrics to make informed choices
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚖️</div>
              <h3 className="text-xl font-semibold mb-2">Fair Comparisons</h3>
              <p className="text-muted-foreground">
                Objective analysis based on real-world usage data and developer feedback
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Find Your Fit</h3>
              <p className="text-muted-foreground">
                Understand which platform matches your specific needs and workflow
              </p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Try ZapDev?
          </h2>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Experience why ZapDev ranks #1 in comprehensive comparisons. Start building for free today.
          </p>
          <Button asChild>
            <Link href="/">
              Get Started Free
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
