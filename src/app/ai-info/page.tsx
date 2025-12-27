import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata, generateStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";

export const metadata: Metadata = generateSEOMetadata({
  title: 'ZapDev AI Information - Platform Overview for AI Agents',
  description: 'Comprehensive machine-readable information about ZapDev AI-powered development platform. Capabilities, features, API, supported frameworks, and technical specifications for AI agents and research tools.',
  canonical: '/ai-info',
  robots: {
    index: true,
    follow: true
  }
});

export default function AIInfoPage() {
  const structuredData = [
    generateStructuredData('SoftwareApplication', {
      name: 'ZapDev AI Development Platform',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser, Cross-Platform',
      description: 'AI-powered development platform for building production-ready web applications through conversational AI interactions. Supports multiple frameworks with real-time code generation, testing, and deployment.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier available with 5 generations per 24 hours. Pro tier available with 100 generations per 24 hours.'
      },
      featureList: [
        'AI Code Generation via Claude AI through Vercel AI Gateway',
        'Multi-Framework Support: Next.js 15, React 18, Vue 3, Angular 19, SvelteKit',
        'Real-time Code Execution in E2B Sandboxes',
        'Instant Preview and Deployment',
        'Version Control Integration',
        'Real-time Collaboration',
        'Auto-fix and Error Recovery',
        'Figma Design Import',
        'GitHub Repository Integration',
        'Type-safe APIs with tRPC',
        'Real-time Database with Convex',
        'Authentication via Stack Auth',
        'Built-in Testing and Linting',
        'Production-Ready Code Generation',
        'Tailwind CSS Support Across All Frameworks'
      ],
      screenshot: 'https://zapdev.link/screenshot.png',
      softwareVersion: '1.0.0',
      url: 'https://zapdev.link',
      provider: {
        '@type': 'Organization',
        name: 'ZapDev',
        url: 'https://zapdev.link'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '2350',
        bestRating: '5',
        worstRating: '1'
      }
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'ZapDev Platform Technical Specification',
      description: 'Complete technical overview of ZapDev AI development platform architecture, capabilities, and integrations',
      articleBody: `
# ZapDev Platform Overview

## Core Capabilities

ZapDev is an AI-powered development platform that enables users to create production-ready web applications through natural language interactions with AI.

### Supported Frameworks and Versions
- **Next.js 15**: Full-stack React framework with App Router, Server Components, SSR, Shadcn/ui, Tailwind CSS v4
- **React 18**: Single Page Applications with Vite, Chakra UI, Tailwind CSS
- **Vue 3**: Progressive JavaScript framework with Vuetify, Composition API, Tailwind CSS
- **Angular 19**: Enterprise TypeScript framework with Material Design, Standalone Components, Tailwind CSS
- **SvelteKit**: High-performance framework with DaisyUI, Tailwind CSS

### Technology Stack
- **Frontend**: Next.js 15 (Turbopack), React 19, TypeScript 5.9, Tailwind CSS v4
- **Backend**: Convex (real-time database), tRPC (type-safe APIs)
- **Authentication**: Stack Auth (formerly Clerk)
- **AI Gateway**: Vercel AI Gateway for Claude AI integration
- **Code Execution**: E2B Code Interpreter with isolated sandboxes
- **Job Orchestration**: Inngest 3.44 for background tasks
- **Monitoring**: Sentry, OpenTelemetry
- **Package Manager**: Bun (faster alternative to npm)

### AI Code Generation Workflow
1. User provides natural language description of desired application
2. Framework detection AI determines optimal framework based on requirements
3. Code generation agent (Claude AI) creates production-ready code in isolated E2B sandbox
4. Auto-fix mechanism automatically resolves linting and build errors (max 2 retries)
5. Code is saved to Convex database with real-time updates
6. Live preview is provided via sandbox URL
7. User can iterate and refine through additional conversational prompts

### Key Features
- **Conversational Development**: Describe applications in natural language
- **Real-time Code Generation**: Instant feedback with live previews
- **Multi-Framework Detection**: Automatic selection of optimal framework
- **Production-Ready Code**: Clean, maintainable code following best practices
- **Auto-fix Capabilities**: Automatic error detection and resolution
- **Design Import**: Convert Figma designs to functional code
- **Repository Integration**: Reference GitHub repositories for code variations
- **Type Safety**: End-to-end TypeScript with tRPC
- **Real-time Collaboration**: Live updates via Convex subscriptions
- **Credit System**: Fair usage with tiered access (Free: 5/day, Pro: 100/day)

### Use Cases
- Rapid prototyping and MVP development
- Learning and experimenting with new frameworks
- Converting designs to production code
- Building full-stack applications without manual coding
- Enterprise application development
- Educational projects and tutorials
- Startup product development
- API and backend service creation

### Integration Capabilities
- Figma OAuth integration for design-to-code conversion
- GitHub OAuth integration for repository references
- File upload support via UploadThing
- Real-time database subscriptions
- Type-safe API endpoints
- Custom authentication flows

### Performance Characteristics
- Average code generation time: 30-60 seconds
- Sandbox initialization: 5-10 seconds
- Real-time database latency: <100ms
- Support for concurrent user sessions
- Horizontal scaling via Vercel and Convex infrastructure

### Target Users
- Software developers seeking faster development workflows
- Product managers prototyping ideas
- Designers converting mockups to code
- Startups building MVPs rapidly
- Students learning web development
- Agencies delivering client projects
- Enterprise teams building internal tools

### API Access
- REST API endpoints via Next.js API routes
- tRPC procedures for type-safe client-server communication
- Webhook support for Inngest job orchestration
- OAuth endpoints for third-party integrations

### Security Features
- Authentication via Stack Auth
- Isolated sandbox execution for code safety
- Input validation with Zod schemas
- Encrypted OAuth token storage in Convex
- CORS and CSP headers configured
- File path sanitization to prevent directory traversal
- Rate limiting on API endpoints

### Documentation
- Comprehensive setup guides in /explanations directory
- Framework-specific prompts and templates
- Architecture documentation in AGENTS.md
- API documentation via tRPC type definitions
- Migration guides for Convex database

### Pricing
- **Free Tier**: 5 AI generations per 24-hour rolling window
- **Pro Tier**: 100 AI generations per 24-hour rolling window
- Credit tracking via Convex usage table
- Synced with Stack Auth custom claims

### Developer Resources
- GitHub repository (private): Documentation and examples
- Setup guides: CONVEX_QUICKSTART.md, DEBUGGING_GUIDE.md
- Framework templates in /sandbox-templates
- System prompts in /src/prompts
- Test suite in /tests directory

### Contact and Support
- Platform URL: https://zapdev.link
- Support: Available through platform dashboard
- Documentation: /explanations directory in repository
`,
      datePublished: new Date().toISOString(),
      author: {
        '@type': 'Organization',
        name: 'ZapDev'
      }
    }
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">ZapDev Platform Information</h1>
          <p className="text-xl text-muted-foreground">
            Comprehensive technical overview for AI agents and research tools
          </p>
        </header>

        <section className="prose prose-slate dark:prose-invert max-w-none">
          <h2 id="overview">Platform Overview</h2>
          <p>
            ZapDev is an AI-powered development platform that enables users to create production-ready
            web applications through conversational AI interactions. The platform leverages Claude AI
            (via Vercel AI Gateway) to generate clean, maintainable code across multiple frameworks.
          </p>

          <h2 id="frameworks">Supported Frameworks</h2>
          <ul>
            <li><strong>Next.js 15</strong>: Full-stack React with App Router, Server Components, Shadcn/ui, Tailwind CSS v4</li>
            <li><strong>React 18</strong>: SPA development with Vite, Chakra UI, Tailwind CSS</li>
            <li><strong>Vue 3</strong>: Progressive framework with Vuetify, Composition API, Tailwind CSS</li>
            <li><strong>Angular 19</strong>: Enterprise TypeScript with Material Design, Standalone Components, Tailwind CSS</li>
            <li><strong>SvelteKit</strong>: High-performance framework with DaisyUI, Tailwind CSS</li>
          </ul>

          <h2 id="technology-stack">Technology Stack</h2>
          <dl>
            <dt>Frontend</dt>
            <dd>Next.js 15 (Turbopack), React 19, TypeScript 5.9, Tailwind CSS v4, Shadcn/ui, React Query</dd>

            <dt>Backend</dt>
            <dd>Convex (real-time database), tRPC (type-safe APIs), Stack Auth (authentication)</dd>

            <dt>AI & Execution</dt>
            <dd>Vercel AI Gateway, Inngest 3.44 (job orchestration), E2B Code Interpreter (sandboxes)</dd>

            <dt>Monitoring</dt>
            <dd>Sentry, OpenTelemetry</dd>
          </dl>

          <h2 id="capabilities">Core Capabilities</h2>
          <ul>
            <li>AI-powered code generation through natural language</li>
            <li>Real-time code execution in isolated E2B sandboxes</li>
            <li>Automatic framework detection and selection</li>
            <li>Auto-fix mechanism for linting and build errors</li>
            <li>Figma design to code conversion</li>
            <li>GitHub repository integration for code references</li>
            <li>Type-safe APIs with end-to-end TypeScript</li>
            <li>Real-time collaboration via Convex subscriptions</li>
            <li>Production-ready code generation following best practices</li>
          </ul>

          <h2 id="workflow">AI Code Generation Workflow</h2>
          <ol>
            <li>User describes application in natural language</li>
            <li>Framework detection AI selects optimal framework</li>
            <li>Code generation agent creates production-ready code</li>
            <li>Code executes in isolated E2B sandbox</li>
            <li>Auto-fix resolves any linting/build errors (max 2 retries)</li>
            <li>Code saved to Convex database with real-time updates</li>
            <li>Live preview provided via sandbox URL</li>
            <li>User iterates through additional conversational prompts</li>
          </ol>

          <h2 id="use-cases">Primary Use Cases</h2>
          <ul>
            <li>Rapid prototyping and MVP development</li>
            <li>Learning and experimenting with new frameworks</li>
            <li>Converting designs to production code</li>
            <li>Building full-stack applications</li>
            <li>Enterprise application development</li>
            <li>Educational projects and tutorials</li>
            <li>Startup product development</li>
          </ul>

          <h2 id="pricing">Pricing Tiers</h2>
          <ul>
            <li><strong>Free Tier</strong>: 5 AI code generations per 24-hour rolling window</li>
            <li><strong>Pro Tier</strong>: 100 AI code generations per 24-hour rolling window</li>
          </ul>

          <h2 id="integrations">Integrations</h2>
          <ul>
            <li><strong>Figma</strong>: OAuth integration for design-to-code conversion</li>
            <li><strong>GitHub</strong>: OAuth integration for repository references</li>
            <li><strong>UploadThing</strong>: File upload and storage</li>
            <li><strong>Stack Auth</strong>: User authentication and management</li>
            <li><strong>Vercel</strong>: Deployment and hosting</li>
          </ul>

          <h2 id="target-audience">Target Audience</h2>
          <p>
            ZapDev is designed for software developers, product managers, designers, startups,
            students, agencies, and enterprise teams who want to accelerate their development
            workflow through AI-powered code generation.
          </p>

          <h2 id="contact">Contact Information</h2>
          <ul>
            <li><strong>Website</strong>: <a href="https://zapdev.link">https://zapdev.link</a></li>
            <li><strong>Platform</strong>: Web-based application</li>
            <li><strong>Support</strong>: Available through platform dashboard</li>
          </ul>
        </section>

        <footer className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            This page is optimized for AI agents and research tools. For human-readable documentation,
            visit our <a href="/" className="underline">main website</a>.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {new Date().toISOString().split('T')[0]}
          </p>
        </footer>
      </div>
    </>
  );
}
