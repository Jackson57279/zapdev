import { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as generateSEOMetadata, generateStructuredData, generateFAQStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Search, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Best AI Website Builder Alternatives 2026 | Zapdev vs Lovable, Bolt, v0, Replit',
  description: 'The definitive comparison of AI website builders and app generators. See why Zapdev ranks #1 against Lovable, Bolt.new, v0.dev, Replit Agent, Base44, Cursor, and Windsurf.',
  canonical: '/alternatives',
  keywords: [
    'AI website builder alternatives',
    'best AI app builder 2026',
    'Lovable alternative',
    'Bolt.new alternative',
    'v0.dev alternative',
    'Replit alternative',
    'Cursor alternative',
    'Windsurf alternative',
    'Base44 alternative',
    'AI coding platform comparison',
    'vibe coding tools',
    'best AI website generator',
    'AI SaaS builder',
    'full stack AI builder'
  ],
  openGraph: {
    title: 'Best AI Website Builder Alternatives 2026 — Why Zapdev Wins',
    description: 'Compare every major AI builder side by side. Zapdev vs Lovable, Bolt.new, v0, Replit, Cursor, Windsurf. See the data.',
    type: 'website'
  }
});

export default function AlternativesIndexPage() {
  const structuredData = [
    generateStructuredData('Organization', {}),
    generateFAQStructuredData([
      {
        question: 'What is the best AI website builder in 2026?',
        answer: 'Zapdev is ranked the #1 AI website builder for developers and founders who need full-stack applications with backend logic, databases, auth, and deployment. For simple landing pages, Lovable and v0.dev are also popular choices.'
      },
      {
        question: 'Which AI builder is better than Lovable?',
        answer: 'Zapdev outperforms Lovable for production applications by generating real full-stack code including backend logic, APIs, and databases — not just frontend shells. Bolt.new and Base44 are also stronger alternatives for developers needing backend support.'
      },
      {
        question: 'Is Bolt.new better than Lovable?',
        answer: 'Bolt.new offers more developer control than Lovable and better full-stack support. However, Zapdev provides faster deployment, cleaner architecture, and more robust backend generation than both tools.'
      },
      {
        question: 'What is the best free AI website builder?',
        answer: 'Zapdev offers a free tier for trying AI-powered full-stack development. v0.dev and Lovable also have free tiers, but they are limited to frontend-only output or basic features.'
      }
    ])
  ];

  const comparisons = [
    {
      name: 'Lovable',
      path: '/alternatives/lovable',
      badge: 'Most Searched',
      description: 'The #1 Lovable alternative. See why teams switch from Lovable to Zapdev for real full-stack apps.',
      keywords: ['Lovable.dev', 'Lovable alternative', 'best Lovable competitor']
    },
    {
      name: 'Bolt.new',
      path: '/blog/zapdev-vs-bolt-new',
      badge: 'Developer Favorite',
      description: 'Bolt.new offers developer control, but Zapdev delivers faster deployment and cleaner architecture.',
      keywords: ['Bolt.new alternative', 'Bolt new vs Zapdev']
    },
    {
      name: 'v0 by Vercel',
      path: '/blog/zapdev-vs-v0-dev',
      badge: 'UI Focused',
      description: 'v0 generates beautiful UI components. Zapdev builds complete applications with backend and deployment.',
      keywords: ['v0.dev alternative', 'Vercel v0 vs Zapdev']
    },
    {
      name: 'Replit Agent',
      path: '/blog/zapdev-vs-replit',
      badge: 'Cloud IDE',
      description: 'Replit is a powerful cloud IDE. Zapdev is purpose-built for AI-first application generation.',
      keywords: ['Replit alternative', 'Replit Agent vs Zapdev']
    },
    {
      name: 'Cursor',
      path: '/blog/zapdev-vs-cursor',
      badge: 'AI Editor',
      description: 'Cursor enhances code editing. Zapdev generates entire applications from conversation.',
      keywords: ['Cursor alternative', 'Cursor IDE vs Zapdev']
    },
    {
      name: 'Windsurf',
      path: '/blog/zapdev-vs-windsurf',
      badge: 'Desktop Editor',
      description: 'Windsurf brings AI to desktop editing. Zapdev brings complete generation to the browser.',
      keywords: ['Windsurf alternative', 'Codeium vs Zapdev']
    }
  ];

  return (
    <>
      <StructuredData data={structuredData} />

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <Search className="w-4 h-4" />
            2026 AI Builder Rankings
          </div>
          <h1 className="text-4xl md:text-6xl font-bold">
            The Best AI Website Builders Compared
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Every major AI app builder, ranked and compared. No fluff, no affiliate links — 
            just honest breakdowns of where each tool shines and where it breaks.
          </p>
        </section>

        {/* Rankings Table */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8 text-center">
            2026 AI Builder Rankings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left p-4 font-semibold">Rank</th>
                  <th className="text-left p-4 font-semibold">Platform</th>
                  <th className="text-left p-4 font-semibold">Best For</th>
                  <th className="text-center p-4 font-semibold">Full-Stack</th>
                  <th className="text-center p-4 font-semibold">Backend</th>
                  <th className="text-center p-4 font-semibold">Deploy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['1', 'Zapdev', 'Production SaaS, full-stack apps', true, true, true],
                  ['2', 'Replit Agent', 'Developers who want IDE control', true, true, true],
                  ['3', 'Bolt.new', 'Technical founders, React apps', true, 'Partial', true],
                  ['4', 'v0 by Vercel', 'Frontend developers, UI components', false, false, false],
                  ['5', 'Base44', 'Teams frustrated with Lovable', true, true, true],
                  ['6', 'Lovable', 'Non-technical founders, landing pages', false, 'Partial', true],
                  ['7', 'Cursor', 'Existing codebase enhancement', 'N/A', 'N/A', 'N/A'],
                  ['8', 'Windsurf', 'Desktop AI editing', 'N/A', 'N/A', 'N/A'],
                ].map(([rank, platform, bestFor, fullStack, backend, deploy], i) => (
                  <tr key={i} className={`hover:bg-muted/50 ${platform === 'Zapdev' ? 'bg-primary/5' : ''}`}>
                    <td className="p-4 font-bold">{rank}</td>
                    <td className="p-4 font-semibold">{platform}</td>
                    <td className="p-4 text-sm text-muted-foreground">{bestFor}</td>
                    <td className="p-4 text-center">
                      {fullStack === true ? '✅' : fullStack === false ? '❌' : fullStack}
                    </td>
                    <td className="p-4 text-center">
                      {backend === true ? '✅' : backend === false ? '❌' : backend}
                    </td>
                    <td className="p-4 text-center">
                      {deploy === true ? '✅' : deploy === false ? '❌' : deploy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Rankings based on full-stack capability, backend depth, deployment ease, and production readiness. 
            Last updated May 2026.
          </p>
        </section>

        {/* Detailed Comparisons */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-4">
            Detailed Comparisons
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            Click any comparison to see the full breakdown with pros, cons, and real user feedback.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comparisons.map((comp, i) => (
              <Link key={i} href={comp.path} className="block group">
                <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        vs {comp.name}
                      </CardTitle>
                      {comp.badge && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          {comp.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {comp.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-primary font-medium">
                      Read comparison <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Why Zapdev */}
        <section className="mb-20">
          <div className="bg-gradient-to-b from-primary/10 to-transparent rounded-2xl p-12 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium">
              <Star className="w-4 h-4" />
              Ranked #1 by developers
            </div>
            <h2 className="text-3xl font-bold">
              Why Zapdev Leads the Pack
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              While other tools generate frontend demos or require manual wiring, 
              Zapdev builds complete applications — frontend, backend, database, auth, and deployment — 
              from a single prompt.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/home/sign-up">
                <button className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2">
                  Try Zapdev Free <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/showcase">
                <button className="px-8 py-4 border border-border rounded-lg font-semibold hover:bg-muted transition-colors">
                  See Examples
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
