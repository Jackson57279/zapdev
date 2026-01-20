import { Metadata } from 'next';
import Link from 'next/link';
import { getAllFrameworks } from '@/lib/frameworks';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = generateSEOMetadata({
  title: 'AI-Powered Development for All Frameworks | Zapdev',
  description: 'Build applications with React, Vue, Angular, Svelte, and Next.js using AI assistance. Compare frameworks and choose the best for your project.',
  keywords: [
    'React development',
    'Vue.js development', 
    'Angular development',
    'Svelte development',
    'Next.js development',
    'framework comparison',
    'JavaScript frameworks',
    'web development frameworks',
    'AI code generation'
  ],
  canonical: '/frameworks',
  openGraph: {
    title: 'Choose Your Framework - AI-Powered Development',
    description: 'Build faster with AI assistance for React, Vue, Angular, Svelte, and Next.js',
    type: 'website'
  }
});

export default function FrameworksPage() {
  const frameworks = getAllFrameworks();
  
  const structuredData = [
    generateStructuredData('WebApplication', {
      name: 'Zapdev Framework Hub',
      description: 'AI-powered development platform supporting multiple frameworks',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '99',
        priceCurrency: 'USD',
        offerCount: frameworks.length
      }
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: frameworks.map((framework, index) => ({
        '@type': 'SoftwareApplication',
        position: index + 1,
        name: `${framework.name} Development with AI`,
        description: framework.metaDescription,
        applicationCategory: 'WebApplication',
        url: `https://zapdev.link/frameworks/${framework.slug}`
      }))
    }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Which framework should you build with?
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Zapdev lets you build production-ready applications with AI across React, Vue, Angular, Svelte, and Next.js.
            Compare frameworks, see what each is best for, and start building in minutes.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-4">
            Want outcomes instead of tools? Explore <Link href="/solutions" className="underline underline-offset-4">AI development solutions</Link> or see the <Link href="/showcase" className="underline underline-offset-4">project showcase</Link>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {frameworks.map((framework) => (
            <Link
              key={framework.slug}
              href={`/frameworks/${framework.slug}`}
              className="block transition-transform hover:scale-105"
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{framework.icon}</span>
                    <Badge variant="secondary">
                      {framework.popularity}% Popular
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl">{framework.name}</CardTitle>
                  <CardDescription className="text-base">
                    {framework.metaDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Community Adoption</span>
                        <span>{framework.popularity}%</span>
                      </div>
                      <Progress value={framework.popularity} className="h-2" />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {framework.features.slice(0, 3).map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
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

        <section className="bg-muted/50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Why Choose Zapdev for Framework Development?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Speed</h3>
              <p className="text-muted-foreground">
                Generate production-ready code instantly with our advanced AI models trained on best practices
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Framework Expertise</h3>
              <p className="text-muted-foreground">
                Deep understanding of each framework&apos;s patterns, optimizations, and ecosystem
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Instant Deployment</h3>
              <p className="text-muted-foreground">
                Deploy your applications with one click to production-ready infrastructure
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">How do these frameworks compare?</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Framework</th>
                  <th className="text-left p-4">Best For</th>
                  <th className="text-left p-4">Learning Curve</th>
                  <th className="text-left p-4">Performance</th>
                  <th className="text-left p-4">Ecosystem</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">React</td>
                  <td className="p-4">Large-scale apps, component libraries</td>
                  <td className="p-4">Moderate</td>
                  <td className="p-4">Excellent</td>
                  <td className="p-4">Massive</td>
                </tr>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">Vue.js</td>
                  <td className="p-4">Progressive enhancement, rapid prototyping</td>
                  <td className="p-4">Easy</td>
                  <td className="p-4">Excellent</td>
                  <td className="p-4">Large</td>
                </tr>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">Angular</td>
                  <td className="p-4">Enterprise applications, TypeScript-first</td>
                  <td className="p-4">Steep</td>
                  <td className="p-4">Good</td>
                  <td className="p-4">Comprehensive</td>
                </tr>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">Svelte</td>
                  <td className="p-4">Performance-critical apps, small bundles</td>
                  <td className="p-4">Easy</td>
                  <td className="p-4">Outstanding</td>
                  <td className="p-4">Growing</td>
                </tr>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">Next.js</td>
                  <td className="p-4">Full-stack React apps, SEO-critical sites</td>
                  <td className="p-4">Moderate</td>
                  <td className="p-4">Excellent</td>
                  <td className="p-4">React + More</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
