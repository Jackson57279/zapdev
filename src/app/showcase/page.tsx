import { Metadata } from 'next';
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/seo/structured-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star, GitBranch, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Project Showcase - See What Others Built with Zapdev',
  description: 'Explore amazing projects built with Zapdev. Get inspired by real applications created using our AI-powered development platform across React, Vue, Angular, and more.',
  keywords: [
    'project showcase',
    'app gallery',
    'portfolio examples',
    'React projects',
    'Vue.js examples',
    'Angular applications',
    'web app showcase',
    'AI-built projects',
    'developer portfolio'
  ],
  canonical: '/showcase',
  openGraph: {
    title: 'Zapdev Project Showcase - Real Apps Built with AI',
    description: 'Discover inspiring projects built by developers using Zapdev\'s AI-powered platform',
    type: 'website'
  }
});

async function getShowcaseProjects(): Promise<Array<{ id?: string; name: string; createdAt: Date | number; framework?: string; messageCount?: number; hasFragment?: boolean }>> {
  try {
    const projects = await fetchQuery(api.projects.listShowcase, {});

    return projects.map((project) => ({
      id: project._id,
      name: project.name,
      framework: project.framework,
      createdAt: project.createdAt ?? Date.now(),
      messageCount: project.messageCount ?? 0,
      hasFragment: project.hasFragment ?? false,
    }));
  } catch (error) {
    console.error('Error fetching showcase projects:', error);
    return [];
  }
}

const frameworkDetails = {
  REACT: { icon: '⚛️', color: 'bg-blue-100 text-blue-800' },
  VUE: { icon: '🟢', color: 'bg-green-100 text-green-800' },
  ANGULAR: { icon: '🅰️', color: 'bg-red-100 text-red-800' },
  SVELTE: { icon: '🔥', color: 'bg-orange-100 text-orange-800' },
  NEXTJS: { icon: '▲', color: 'bg-gray-100 text-gray-800' }
};

export default async function ShowcasePage() {
  const projects = await getShowcaseProjects();
  
  const structuredData = [
    generateStructuredData('WebApplication', {
      name: 'Zapdev Project Showcase',
      description: 'Gallery of projects built with Zapdev AI-powered development platform',
      applicationCategory: 'Gallery'
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Zapdev Project Showcase',
      description: metadata.description,
      url: 'https://zapdev.link/showcase',
      hasPart: projects.map(project => ({
        '@type': 'CreativeWork',
        name: project.name,
        dateCreated: typeof project.createdAt === 'number' ? new Date(project.createdAt).toISOString() : project.createdAt.toISOString(),
        creator: {
          '@type': 'Organization',
          name: 'Zapdev Community'
        }
      }))
    }
  ];

  const stats = {
    totalProjects: projects.length,
    frameworks: [...new Set(projects.map(p => p.framework).filter(Boolean))].length,
    totalInteractions: projects.reduce((acc, p) => acc + (p.messageCount || 0), 0)
  };

  return (
    <>
      <StructuredData data={structuredData} />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            What can you build with Zapdev?
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            This showcase is a gallery of real applications built with Zapdev across React, Vue, Angular, Svelte, and Next.js.
            Use it to find inspiration, validate ideas, and start building faster with AI.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mb-8">
            Ready to build? Explore <Link href="/solutions" className="underline underline-offset-4">solutions</Link> or pick a stack in <Link href="/frameworks" className="underline underline-offset-4">frameworks</Link>.
          </p>
          
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.totalProjects}</div>
              <div className="text-muted-foreground">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.frameworks}</div>
              <div className="text-muted-foreground">Frameworks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.totalInteractions}</div>
              <div className="text-muted-foreground">AI Interactions</div>
            </div>
          </div>
          
          <Button size="lg" className="gap-2">
            <Star className="h-5 w-5" />
            Submit Your Project
          </Button>
        </div>

        <div className="mb-12">
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="outline" className="px-4 py-2">All Projects</Badge>
            {Object.entries(frameworkDetails).map(([key, details]) => (
              <Badge
                key={key}
                variant="outline"
                className="px-4 py-2 cursor-pointer hover:bg-muted"
              >
                <span className="mr-2">{details.icon}</span>
                {key}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {projects.map((project) => {
            const framework = frameworkDetails[project.framework as keyof typeof frameworkDetails] || frameworkDetails.REACT;
            
            return (
              <Link
                key={project.id || project.name}
                href={project.id ? `/projects/${project.id}` : '#'}
                className="block transition-transform hover:scale-105"
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={framework.color}>
                        <span className="mr-1">{framework.icon}</span>
                        {project.framework || 'UNKNOWN'}
                      </Badge>
                      {project.hasFragment && (
                        <Badge variant="secondary">
                          Live Demo
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl line-clamp-2">
                      {project.name}
                    </CardTitle>
                    <CardDescription>
                      Built {formatDistanceToNow(project.createdAt, { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-4 w-4" />
                          {project.messageCount} iterations
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Quick build
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground mb-4">
              No showcase projects yet. Be the first to build something amazing!
            </p>
            <Button size="lg">
              Start Building <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        <section className="bg-muted/50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Why do developers love building with Zapdev?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">10x Faster Development</h3>
              <p className="text-muted-foreground">
                Turn ideas into working applications in minutes, not days or weeks
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Production-Ready Code</h3>
              <p className="text-muted-foreground">
                AI generates clean, maintainable code following best practices
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">Instant Deployment</h3>
              <p className="text-muted-foreground">
                Deploy to production with one click and share your creation
              </p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Build Your Next Project?
          </h2>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join our community of developers creating amazing applications with AI assistance
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="gap-2">
              <Star className="h-5 w-5" />
              Start Building
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <Users className="h-5 w-5" />
              Join Community
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
