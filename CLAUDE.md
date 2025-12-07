# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ZapDev is an AI-powered development platform that enables users to create web applications through conversational AI interactions. Claude AI (via Vercel AI Gateway) generates production-ready code across multiple frameworks in isolated E2B sandboxes with real-time previews.

## Technology Stack

**Frontend**: TanStack Start + Router, React 19, TypeScript 5.9, Tailwind CSS v4, Shadcn/ui, React Query
**Backend**: Convex (real-time database), tRPC (type-safe APIs), Clerk (authentication)
**AI & Execution**: Vercel AI Gateway, Inngest 3.46 (job orchestration), E2B Code Interpreter (sandboxes)
**Build**: Vite 6.0, @tanstack/router-vite-plugin
**Monitoring**: Sentry, OpenTelemetry 2.2

## Development Commands

### Package Management
```bash
bun install              # Install dependencies
bun add <package>        # Add new package
bun remove <package>     # Remove package
```
Always use `bun`, not npm or yarn.

### Running the Application

```bash
bun run dev              # Start Vite dev server with SSR (http://localhost:3000)
bun run convex:dev       # Start Convex backend (run in separate terminal)
```
Both terminals required for local development: Vite + TanStack Start frontend + Convex backend.

### Linting & Building

```bash
bun run lint             # Run ESLint (TypeScript rules, flat config)
bun run build            # Build for production (dist/ directory via Vite)
bun run start            # Start production server (requires prior `build`)
```

### Testing

```bash
bun run test             # Run Jest tests from /tests directory
```
- **Patterns**: `**/__tests__/**/*.ts`, `**/?(*.)+(spec|test).ts`
- **Coverage scope**: `src/**/*.ts` (excludes .d.ts, /generated)

### Convex & Database

```bash
bun run convex:deploy    # Deploy to production
bun run migrate:convex   # Migrate data from PostgreSQL to Convex (one-time)
```

### E2B Sandbox Templates

```bash
npm i -g @e2b/cli        # Install E2B CLI
e2b auth login           # Authenticate
cd sandbox-templates/[framework]  # Navigate to framework folder
e2b template build --name your-template-name --cmd "/compile_page.sh"
# Update template name in src/inngest/functions.ts (line ~22)
```

## Project Structure

```
src/
├── routes/                 # TanStack Router file-based routes
│   ├── index.tsx           # Home page route
│   ├── dashboard.tsx       # User projects dashboard
│   ├── projects.$projectId.tsx  # Project workspace + editor
│   └── __root.tsx          # Root layout with providers
├── app/                    # Legacy route handlers (being migrated)
│   ├── api/                # API routes (tRPC, Inngest webhooks, Convex operations)
│   ├── robots.ts           # robots.txt generator
│   └── sitemap.ts          # sitemap.xml generator
├── server/                 # Server-side utilities
│   └── api-handler.ts      # Custom API route handler for TanStack Start
├── inngest/                # Background job orchestration (59KB)
│   ├── functions.ts        # Main agent functions & orchestration
│   └── functions/          # Individual function modules
├── prompts/                # AI system prompts per framework
│   ├── nextjs.ts, angular.ts, react.ts, vue.ts, svelte.ts
│   └── framework-selector.ts, shared.ts
├── trpc/                   # Type-safe API client & server
├── components/             # React components (ui/, file-explorer, editor)
├── modules/                # Feature-specific business logic
├── lib/                    # Utilities (frameworks-config, firecrawl)
└── hooks/                  # Custom React hooks
convex/
├── schema.ts               # Database tables (projects, messages, fragments, usage, oauth, imports)
├── projects.ts, messages.ts, usage.ts
└── helpers.ts, auth.config.ts, oauth.ts
sandbox-templates/         # E2B templates (nextjs, angular, react, vue, svelte)
tests/                      # Jest test suite
explanations/              # Documentation (guides, setup, debugging)
```

## Key Architectural Patterns

### 1. AI Agent Workflow

**Single Agent Mode** (current):
```
User Request
  → Framework Detection (AI)
  → Code Generation Agent (in E2B sandbox)
     ├── createOrUpdateFiles (write code)
     ├── readFiles (read existing code)
     ├── terminal (run npm/bun/yarn commands)
     └── Auto-fix retry (max 2 attempts on lint/build errors)
  → Save to Convex (fragments)
  → Display Preview (sandbox URL)
```

**Auto-fix Logic**: Detects SyntaxError, TypeError, Build failed patterns. Retries with error context. Runs `bun run lint && bun run build` for validation.

### 2. Framework Support & Detection

Supported frameworks:
- **Next.js 15** (default) — Full-stack React, SSR, Shadcn/ui, Tailwind
- **Angular 19** — Enterprise apps, Material Design, Tailwind
- **React 18** — SPA with Vite, Chakra UI, Tailwind
- **Vue 3** — Progressive apps, Vuetify, Tailwind
- **SvelteKit** — High-performance, DaisyUI, Tailwind

**Detection priority**:
1. Explicit user mention → use specified framework
2. Default → Next.js (ambiguous requests)
3. Enterprise indicators → Angular
4. Material Design preference → Angular/Vue
5. Performance critical → Svelte

### 3. Convex Database Layer

Real-time database replacing PostgreSQL. Key tables:
- `projects` (indexed: by_userId, by_userId_createdAt)
- `messages` (indexed: by_projectId, by_projectId_createdAt)
- `fragments` (code artifacts, indexed: by_messageId)
- `usage` (credit tracking with 24-hour rolling window)
- `oauthConnections` (Figma/GitHub OAuth tokens, encrypted)
- `imports` (Figma/GitHub import job tracking)

Subscriptions enable real-time UI updates when data changes.

### 4. Message & Fragment Processing

**Message Flow**:
1. User input → stored in Convex `messages` table
2. Inngest picks up via `code-agent/run` function
3. Agent generates code → stored in `fragments` table
4. UI subscribes to changes → real-time updates
5. Streaming response sent back for long operations

**Fragment Structure**: One-to-one mapping with message. Contains complete generated code + metadata.

### 5. Credit System

- **Free tier**: 5 generations per 24 hours
- **Pro tier**: 100 generations per 24 hours
- **Tracked**: In `usage` table with rolling 24-hour expiration window
- **Synced**: With Clerk custom claim `plan: "pro"`

### 6. OAuth & Imports

**Figma Integration**: OAuth → design-to-code generation via AI
**GitHub Integration**: OAuth → code reference for variations
**Attachments**: Stored in Convex `attachments` table (IMAGE, FIGMA_FILE, GITHUB_REPO)

## Type Safety & APIs

**End-to-end TypeScript**:
- Frontend uses tRPC client hooks (`useQuery`, `useMutation` from `src/trpc/client.tsx`)
- Backend uses tRPC procedures defined in `src/trpc/routers/`
- Convex queries/mutations auto-typed via `@convex-dev/react`
- Clerk authentication middleware in `src/middleware.ts`

**Query Client**: React Query configured in `src/trpc/query-client.ts` for caching, refetching, and optimistic updates.

## Configuration

### Environment Variables (17 required)

```bash
# AI Gateway
AI_GATEWAY_API_KEY
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1/

# Convex Database
NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOYMENT

# Code Execution
E2B_API_KEY

# Authentication (Clerk)
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY

# File Upload (UploadThing)
UPLOADTHING_TOKEN  # Get from https://uploadthing.com/dashboard

# Background Jobs (Inngest)
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY

# OAuth (Optional)
FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# Application
NEXT_PUBLIC_APP_URL
NODE_ENV
```

### Build & Deployment Configuration

**Vercel**:
- SPA preload enabled
- Security headers configured (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.)
- Image optimization (AVIF, WebP)
- Bundle splitting & code splitting enabled

**Vite** (`vite.config.ts`):
- TanStack Router plugin with automatic route generation
- SSR with TanStack Start
- React plugin for Fast Refresh
- TypeScript path resolution
- SSR externals for optimal bundle splitting

**ESLint** (`eslint.config.mjs` - Flat Config):
- TypeScript strict mode
- Rules: no-explicit-any (warn), no-unused-vars (error with underscore exception)
- Ignores: `/src/generated/*`, `/src/routeTree.gen.ts`

**Jest** (`jest.config.js`):
- ts-jest preset
- Node.js environment
- Test roots: `<rootDir>/tests`

## Common Tasks

| Task | Command | Notes |
|------|---------|-------|
| Start dev | `bun run dev` + `bun run convex:dev` (2 terminals) | Vite + SSR enabled |
| Type check | Implicit in `bun run build` | Or use `tsc --noEmit` |
| Add dependency | `bun add <pkg>` | Always use bun |
| Debug Convex | `bun run convex:dev` → Dashboard | Real-time data viewer |
| View DB | Convex Dashboard | Tables, subscriptions, indexes |
| Fix lint errors | `bun run lint` output | ESLint flat config |
| Build & test | `bun run build && bun run test` | Pre-deployment |
| Generate routes | Auto on file save | TanStack Router vite plugin |

## Documentation Location

All guides live in `/explanations/`:
- `CONVEX_QUICKSTART.md` — 5-minute setup
- `CONVEX_SETUP.md` — Complete setup with screenshots
- `DEBUGGING_GUIDE.md` — Troubleshooting
- `DATA_MIGRATION_GUIDE.md` — PostgreSQL → Convex
- `IMPORT_QUICK_START.md` — Figma/GitHub setup
- `vercel_ai_gateway_optimization.md` — AI optimization
- `streaming_implementation.md` — Real-time streaming
- `PERFORMANCE_AND_SEO_IMPROVEMENTS.md` — Optimizations

Root-level:
- `AGENTS.md` — Qoder AI architecture & commands
- `MIGRATION_STATUS.md` — Convex migration progress
- `README.md` — Project overview

## Project Instructions

**Always use bun** for all package management. Never use npm or yarn.

**Documentation placement**: Put all `.md` files in `@/explanations/` directory, unless part of core setup (CLAUDE.md, README.md).

**Convex over PostgreSQL**: Migration in progress. Use Convex (`src/api/convex/*`) for all new data operations. PostgreSQL schema (`prisma/`) deprecated.

**Framework**: TanStack Start with file-based routing. Routes auto-generated in `src/routeTree.gen.ts`. Check `src/prompts/framework-selector.ts` for sandbox framework detection logic (Next.js, Angular, React, Vue, Svelte).

**E2B sandbox timeout**: 60 minutes max execution time per sandbox instance.

**Testing**: All tests in `/tests/`. Use Jest patterns. Include security, sanitization, and file operation tests.

**Error handling**: Leverage Sentry integration (`src/instrumentation.ts`) for production errors. OpenTelemetry for distributed tracing.

**Security**:
- Validate all user inputs (Zod schemas in prompts)
- Sanitize file paths to prevent directory traversal
- Keep OAuth tokens encrypted in Convex
- Never expose API keys in client-side code (use NEXT_PUBLIC_ prefix only for public values)


**Routing**
- Use TanStack Router file-based routing in `src/routes/`
- Route files auto-generate type-safe route tree in `src/routeTree.gen.ts`
- Use `Link` component from `@tanstack/react-router` with `to` prop
- Use `useNavigate()` from `@tanstack/react-router` for programmatic navigation
- Navigation shims in `src/next-compat/navigation.ts` provide `notFound()` and deprecated Next.js hooks

**Components**
- Use native `<img>` tags instead of Next.js Image (no optimization needed with Vite)
- Use TanStack Router `<Link to="/path">` instead of Next.js `<Link href="/path">`
- API routes return `Response.json()` instead of `NextResponse.json()`

**Extra Things**
- Never use 'as' or 'as any' type assertions (violates strict TypeScript)
