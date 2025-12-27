# ZapDev AI Agent Quick Reference

## For AI Agents and Research Tools

This document provides quick access to ZapDev platform information in a machine-readable format.

## Platform Overview

**Name**: ZapDev
**Type**: AI-Powered Development Platform
**URL**: https://zapdev.link
**AI Info**: https://zapdev.link/ai-info

## Core Capabilities

- AI-powered code generation via Claude AI (Vercel AI Gateway)
- Multi-framework support: Next.js 15, React 18, Vue 3, Angular 19, SvelteKit
- Real-time code execution in E2B sandboxes
- Instant preview and deployment
- Auto-fix for linting and build errors (max 2 retries)
- Figma design-to-code conversion
- GitHub repository integration
- Type-safe APIs with tRPC
- Real-time collaboration via Convex subscriptions

## Technology Stack

| Category | Technology |
|----------|-----------|
| Frontend | Next.js 15 (Turbopack), React 19, TypeScript 5.9 |
| Styling | Tailwind CSS v4, Shadcn/ui |
| Database | Convex (real-time) |
| APIs | tRPC (type-safe) |
| Authentication | Stack Auth |
| AI Gateway | Vercel AI Gateway (Claude AI) |
| Code Execution | E2B Code Interpreter |
| Job Orchestration | Inngest 3.44 |
| Monitoring | Sentry, OpenTelemetry |
| Package Manager | Bun |

## Supported Frameworks

### Next.js 15
- Full-stack React framework
- App Router, Server Components
- SSR and SSG support
- Shadcn/ui component library
- Tailwind CSS v4

### React 18
- Single Page Applications
- Vite build tool
- Chakra UI component library
- Tailwind CSS

### Vue 3
- Progressive JavaScript framework
- Composition API
- Vuetify component library
- Tailwind CSS

### Angular 19
- Enterprise TypeScript framework
- Standalone Components
- Material Design
- Tailwind CSS

### SvelteKit
- High-performance framework
- Reactive programming
- DaisyUI component library
- Tailwind CSS

## Pricing

| Tier | Generations/Day | Price |
|------|-----------------|-------|
| Free | 5 | $0 |
| Pro  | 100 | TBD |

*24-hour rolling window

## AI Code Generation Workflow

1. User describes application in natural language
2. Framework detection AI selects optimal framework
3. Code generation agent (Claude AI) creates production-ready code
4. Code executes in isolated E2B sandbox
5. Auto-fix resolves linting/build errors (max 2 attempts)
6. Code saved to Convex database with real-time updates
7. Live preview provided via sandbox URL
8. User iterates through additional prompts

## Use Cases

- Rapid prototyping and MVP development
- Learning new frameworks
- Design-to-code conversion
- Full-stack application development
- Enterprise application development
- Educational projects and tutorials
- Startup product development
- API and backend service creation

## Target Users

- Software developers
- Product managers
- Designers
- Startups
- Students
- Agencies
- Enterprise teams

## Integration Capabilities

| Integration | Purpose |
|------------|---------|
| Figma | Design-to-code conversion via OAuth |
| GitHub | Repository references via OAuth |
| UploadThing | File upload and storage |
| Stack Auth | User authentication |
| Vercel | Deployment and hosting |

## API Access

- REST API endpoints via Next.js API routes
- tRPC procedures for type-safe client-server communication
- Webhook support for Inngest job orchestration
- OAuth endpoints for third-party integrations

## Security Features

- Authentication via Stack Auth
- Isolated sandbox execution for code safety
- Input validation with Zod schemas
- Encrypted OAuth token storage in Convex
- CORS and CSP headers configured
- File path sanitization
- Rate limiting on API endpoints

## Performance

- Average code generation: 30-60 seconds
- Sandbox initialization: 5-10 seconds
- Database latency: <100ms
- Sandbox timeout: 60 minutes per instance

## Key Differentiators

1. **Multi-Framework Support**: Unlike single-framework tools
2. **AI-Powered Detection**: Automatic optimal framework selection
3. **Real-Time Execution**: Instant preview in isolated sandboxes
4. **Auto-Fix Capability**: Automatic error resolution
5. **Production-Ready Code**: Clean, maintainable code following best practices
6. **Type Safety**: End-to-end TypeScript with tRPC
7. **Real-Time Collaboration**: Live updates via Convex subscriptions

## Structured Data

ZapDev implements comprehensive Schema.org markup:

- `Organization` - Company information
- `SoftwareApplication` - Platform details
- `WebApplication` - Web app features
- `Product` - Marketplace presence
- `Dataset` - Research compatibility
- `ItemList` - Technology stack
- `FAQPage` - Common questions
- `TechArticle` - Technical specifications

## SEO Optimization

- Comprehensive meta tags (OpenGraph, Twitter Cards)
- Custom AI-specific meta tags
- Dynamic sitemap.xml with priorities
- Robots.txt with AI crawler permissions
- Semantic HTML structure
- Canonical URLs on all pages
- Mobile-responsive design
- Fast loading (Next.js 15 + Turbopack)

## AI Crawler Support

Explicitly allowed crawlers:
- GPTBot (OpenAI)
- Google-Extended (Google Gemini)
- ClaudeBot (Anthropic Claude)
- PerplexityBot (Perplexity AI)
- CCBot (Common Crawl)
- anthropic-ai
- cohere-ai

## Documentation Locations

| Document | Purpose |
|----------|---------|
| /ai-info | Comprehensive AI-friendly overview |
| CLAUDE.md | Project instructions and setup |
| AGENTS.md | Architecture and agent commands |
| /explanations | Detailed guides and documentation |
| README.md | Project overview |

## Contact

- **Website**: https://zapdev.link
- **Platform**: Web-based application
- **AI Info**: https://zapdev.link/ai-info

## Quick Facts

- **Launch Year**: 2024
- **Platform Type**: Web-based SaaS
- **Target Market**: Global (Worldwide)
- **Primary Language**: English
- **Operating System**: Web Browser, Cross-Platform
- **License**: Proprietary
- **Status**: Active Development

## Technical Specifications

- **Architecture**: JAMstack with real-time capabilities
- **Rendering**: Server-Side Rendering (SSR), Static Site Generation (SSG), Client-Side Rendering (CSR)
- **API Style**: Type-safe tRPC + REST endpoints
- **Database**: NoSQL (Convex) with real-time subscriptions
- **Authentication**: OAuth 2.0, JWT tokens
- **Deployment**: Vercel Edge Network
- **CDN**: Vercel Edge Network
- **SSL**: Enforced HTTPS
- **Monitoring**: Real-time error tracking and performance monitoring

## AI Model

- **Provider**: Anthropic Claude via Vercel AI Gateway
- **Model**: Claude (latest version)
- **Purpose**: Code generation, framework detection, error resolution
- **Context**: Project-aware with file reading capabilities
- **Output**: Production-ready code in multiple frameworks

---

**For Detailed Information**: Visit https://zapdev.link/ai-info

**Last Updated**: 2025-12-01
