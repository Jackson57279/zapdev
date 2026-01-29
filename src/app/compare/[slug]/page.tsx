import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { getComparison } from '@/lib/comparisons';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return [
    { slug: 'zapdev-vs-lovable' },
    { slug: 'zapdev-vs-bolt' },
    { slug: 'zapdev-vs-github-copilot' },
    { slug: 'best-ai-code-generation-tools' }
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  
  if (!comparison) {
    return generateSEOMetadata({
      title: 'Comparison Not Found',
      description: 'The requested comparison page could not be found.',
      robots: { index: false, follow: false }
    });
  }

  return generateSEOMetadata({
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    keywords: comparison.keywords,
    canonical: `/compare/${comparison.slug}`,
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      type: 'article',
    }
  });
}

export default async function ComparisonPage({ params }: PageProps) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  
  if (!comparison) {
    notFound();
  }

  const structuredData = [
    generateStructuredData('Article', {
      headline: comparison.title,
      description: comparison.metaDescription,
      author: 'Zapdev Team',
      datePublished: comparison.publishedDate,
      dateModified: comparison.lastUpdated
    }),
    generateFAQStructuredData(comparison.faqs),
    {
      '@context': 'https://schema.org',
      '@type': 'Comparison',
      name: comparison.title,
      description: comparison.metaDescription,
      itemListElement: comparison.comparisonTable.map((row, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: row.feature,
        item: {
          '@type': 'Product',
          name: comparison.products[0].name,
          feature: row.zapdevValue
        }
      }))
    }
  ];

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Comparisons', url: '/compare' },
    { name: comparison.title, url: `/compare/${comparison.slug}` }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {comparison.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            {comparison.intro}
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: {new Date(comparison.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {comparison.statistics && (
          <div className="bg-muted/50 rounded-lg p-6 mb-12">
            <h2 className="text-2xl font-bold mb-4">Key Statistics</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {comparison.statistics.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  {stat.source && (
                    <div className="text-xs text-muted-foreground mt-1">Source: {stat.source}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {comparison.products.map((product) => (
            <Card key={product.name} className={product.isZapdev ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="text-2xl">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Pros:</h4>
                    <ul className="space-y-1">
                      {product.pros.map((pro, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Cons:</h4>
                    <ul className="space-y-1">
                      {product.cons.map((con, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-4">
                    <h4 className="font-semibold mb-2">Best For:</h4>
                    <p className="text-sm text-muted-foreground">{product.bestFor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Head-to-Head Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Feature</th>
                  <th className="text-left p-4">ZapDev</th>
                  {comparison.products.filter(p => !p.isZapdev).map((product) => (
                    <th key={product.name} className="text-left p-4">{product.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.comparisonTable.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4">
                      {row.zapdevValue === 'Yes' || row.zapdevValue === '✅' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <span>{row.zapdevValue}</span>
                      )}
                    </td>
                    {row.competitorValues?.map((value, idx) => (
                      <td key={idx} className="p-4">
                        {value === 'Yes' || value === '✅' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : value === 'No' || value === '❌' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span>{value}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {comparison.expertQuote && (
          <section className="bg-muted/50 rounded-lg p-8 mb-12">
            <blockquote className="text-lg italic mb-4">
              "{comparison.expertQuote.quote}"
            </blockquote>
            <div className="text-sm text-muted-foreground">
              — {comparison.expertQuote.author}, {comparison.expertQuote.title}
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Which Should You Choose?</h2>
          <div className="space-y-6">
            {comparison.recommendations.map((rec, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>{rec.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{rec.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="grid gap-6">
            {comparison.faqs.map((faq, index) => (
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
            Ready to Try ZapDev?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the difference with ZapDev's AI-powered development platform. Start building for free today.
          </p>
          <Button size="lg" className="gap-2" asChild>
            <Link href="/">
              Get Started Free <ArrowRight size={20} />
            </Link>
          </Button>
        </section>

        <section className="mt-12 pt-8 border-t">
          <h2 className="text-2xl font-bold mb-4">Sources and Citations</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            {comparison.citations.map((citation, index) => (
              <p key={index}>
                [{index + 1}] {citation}
              </p>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
