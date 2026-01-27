# ZapDev - Project Context for Blackbox AI

## Project Overview

**ZapDev** is an AI-powered development platform that enables users to create web applications through conversational interactions with AI agents. The platform provides real-time Next.js application development in isolated E2B sandboxes with live preview capabilities, file exploration, and comprehensive project management.

### Core Purpose
- Generate full-stack web applications through natural language conversations
- Provide real-time code execution and preview in secure sandboxes
- Support multiple frontend frameworks (Next.js, React, Vue, Angular, Svelte)
- Track usage and manage subscriptions with credit-based billing

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Backend**: tRPC for type-safe APIs
- **Database**: Convex (real-time database with built-in auth)
- **Authentication**: Stack Auth (migrated from Better Auth)
- **AI Gateway**: Vercel AI Gateway (supports OpenAI, Anthropic, Grok, etc.)
- **Code Execution**: E2B Code Interpreter (sandboxed environments)
- **Background Jobs**: Inngest (AI code generation workflows)
- **Payments**: Polar.sh (subscription management)
- **Monitoring**: Sentry (error tracking)
- **Deployment**: Vercel

---

## Building and Running

### Prerequisites
- Node.js 18+ or Bun
- Docker (required for E2B template building)
- PostgreSQL database (or use Convex)
- E2B account and API key
- Stack Auth account
- Vercel AI Gateway API key

### Installation

```bash
# Install dependencies
npm install
# or
bun install

# Set up environment variables
cp env.example .env
# Fill in all required API keys and configuration
```

### Environment Variables

Required variables (see `env.example` for complete list):

```bash
# Database
DATABASE_URL="postgresql://..."

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Vercel AI Gateway (replaces direct OpenAI)
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# E2B Sandboxes
E2B_API_KEY="your-e2b-api-key"

# Stack Auth (current auth provider)
NEXT_PUBLIC_STACK_PROJECT_ID="your-stack-project-id"
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY="your-stack-key"
STACK_SECRET_SERVER_KEY="your-stack-secret"

# Convex (real-time database)
CONVEX_DEPLOYMENT="your-convex-deployment"
NEXT_PUBLIC_CONVEX_URL="https://your-convex-url"

# Inngest (background jobs)
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"

# Polar.sh (subscriptions)
POLAR_ACCESS_TOKEN="your-polar-token"
POLAR_WEBHOOK_SECRET="your-polar-webhook-secret"
```

### E2B Template Setup (CRITICAL)

Before running the app, you MUST build the E2B sandbox template:

```bash
# Install E2B CLI
npm i -g @e2b/cli
# or
brew install e2b

# Login to E2B
e2b auth login

# Navigate to template directory
cd sandbox-templates/nextjs

# Build the template
e2b template build --name your-template-name --cmd "/compile_page.sh"

# Update template name in src/inngest/functions.ts (line 22)
# Replace "zapdev" with your template name
```

### Development Commands

```bash
# Start Next.js development server (with Turbopack)
npm run dev

# Start Convex development server (in separate terminal)
npm run convex:dev
# or
bunx convex dev

# Start Inngest development server (optional, for local testing)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# Build for production
npm run build

# Start production server
npm run start

# Linting
npm run lint

# Database operations (if using Prisma)
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Run migrations
```

### Testing Scripts

```bash
# Test Vercel AI Gateway connection
node test-vercel-ai-gateway.js

# Test E2B sandbox
node test-e2b-sandbox.js

# Test Inngest AI functions
node test-inngest-ai.js
```

---

## Project Structure

```
/home/dih/zapdev/
├── convex/                    # Convex database schema and functions
│   ├── schema.ts             # Database schema (projects, messages, usage, etc.)
│   ├── auth.config.ts        # Stack Auth configuration
│   ├── helpers.ts            # Auth helpers and utilities
│   ├── projects.ts           # Project CRUD operations
│   ├── messages.ts           # Message and fragment operations
│   ├── usage.ts              # Credit tracking and billing
│   └── ...
├── sandbox-templates/         # E2B sandbox configurations
│   └── nextjs/               # Next.js sandbox template
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (home)/          # Home page and landing
│   │   ├── api/             # API routes (tRPC, webhooks, imports)
│   │   ├── projects/        # Project pages and chat interface
│   │   ├── frameworks/      # Framework-specific pages
│   │   ├── import/          # Import flows (Figma, GitHub)
│   │   └── ...
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Shadcn/ui components
│   │   ├── file-explorer/   # Code file browser
│   │   ├── navbar/          # Navigation components
│   │   └── ...
│   ├── modules/              # Feature modules
│   │   ├── projects/        # Project management logic
│   │   ├── messages/        # Message handling
│   │   ├── usage/           # Usage tracking
│   │   └── ...
│   ├── inngest/              # Background job functions
│   │   ├── functions.ts     # AI code generation workflows
│   │   └── client.ts        # Inngest client setup
│   ├── trpc/                 # tRPC setup
│   │   ├── server.ts        # Server-side tRPC router
│   │   └── client.tsx       # Client-side tRPC hooks
│   ├── lib/                  # Utilities and helpers
│   │   ├── auth-server.ts   # Server-side auth utilities
│   │   ├── convex.ts        # Convex client setup
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── prompts/              # AI prompt templates
│   └── types.ts              # Shared TypeScript types
├── scripts/                   # Utility scripts
├── tests/                     # Test files
├── public/                    # Static assets
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── next.config.mjs           # Next.js configuration
├── eslint.config.mjs         # ESLint configuration
├── components.json           # Shadcn/ui configuration
└── README.md                 # Main documentation
```

---

## Development Conventions

### Code Style

1. **TypeScript**: Strict mode enabled, all code must be typed
2. **React**: Use functional components with hooks (React 19)
3. **Naming Conventions**:
   - Components: PascalCase (`UserProfile.tsx`)
   - Utilities: camelCase (`getUserData.ts`)
   - Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
   - Files: kebab-case for non-components (`auth-server.ts`)

4. **Import Order**:
   ```typescript
   // 1. External dependencies
   import { useState } from "react";
   
   // 2. Internal modules
   import { Button } from "@/components/ui/button";
   
   // 3. Relative imports
   import { helper } from "./utils";
   ```

5. **Path Aliases**:
   - `@/*` → `src/*`
   - `@/convex/*` → `convex/*`

### Component Patterns

1. **Server Components by Default**: Use React Server Components unless client interactivity is needed
2. **Client Components**: Add `"use client"` directive when using hooks or browser APIs
3. **Shadcn/ui**: Use existing UI components from `@/components/ui/`
4. **Styling**: Tailwind CSS utility classes (v4 syntax)

### Database Patterns (Convex)

1. **Schema**: All tables defined in `convex/schema.ts`
2. **Queries**: Read-only operations, automatically reactive
3. **Mutations**: Write operations, atomic and transactional
4. **Actions**: Can call external APIs, not transactional
5. **Authentication**: Use `getCurrentUserId(ctx)` helper in Convex functions

### API Patterns

1. **tRPC**: Type-safe API calls between client and server
2. **API Routes**: Use for webhooks and external integrations
3. **Error Handling**: Use `try-catch` with proper error messages
4. **Rate Limiting**: Implemented via Convex `rateLimits` table

### Authentication Flow

1. **Stack Auth**: Current authentication provider
2. **Client-side**: Use `useUser()` hook from `@stackframe/stack`
3. **Server-side**: Use `getUser()` from `@/lib/auth-server`
4. **Convex**: Use `ctx.auth.getUserIdentity()` in functions
5. **Auth Pages**: Handled by Stack Auth at `/handler/*` routes

### Background Jobs (Inngest)

1. **AI Code Generation**: Triggered via Inngest events
2. **Functions**: Defined in `src/inngest/functions.ts`
3. **Local Dev**: Use Inngest Dev Server at `http://localhost:8288`
4. **Production**: Use Inngest Cloud with webhook sync

---

## Key Features and Workflows

### 1. Project Creation
- User creates a project with a name and framework selection
- Project stored in Convex `projects` table
- Associated with user via Stack Auth user ID

### 2. AI Code Generation
- User sends message describing desired functionality
- Message triggers Inngest background job
- AI agent (via Vercel AI Gateway) generates code
- Code executed in E2B sandbox
- Results streamed back to user in real-time

### 3. Sandbox Management
- Each project gets an isolated E2B sandbox
- Sandboxes auto-pause after 10 minutes of inactivity
- Sandbox state tracked in `sandboxSessions` table
- Files persisted in `fragments` and `fragmentDrafts` tables

### 4. Usage Tracking
- Credit-based system: 1 credit per generation
- Free tier: 5 generations per 24 hours
- Pro tier: 100 generations per 24 hours
- Credits tracked in `usage` table with expiration

### 5. Import Flows
- **Figma**: Import designs from Figma files
- **GitHub**: Import code from GitHub repositories
- OAuth connections stored encrypted in `oauthConnections` table
- Import history tracked in `imports` table

### 6. Subscription Management
- Powered by Polar.sh
- Plans: Free, Pro, Enterprise
- Subscription data in `subscriptions` table
- Webhooks handle subscription events

---

## Migration Status

### Recent Migrations

1. **Better Auth → Stack Auth** (✅ Complete)
   - Migrated from Better Auth to Stack Auth for simpler integration
   - See `STACK_AUTH_MIGRATION_COMPLETE.md` for details
   - Auth pages now at `/handler/*` routes

2. **PostgreSQL → Convex** (🟡 In Progress)
   - Schema created and functions implemented
   - Convex provides real-time updates and built-in auth
   - See `MIGRATION_STATUS.md` for status
   - Both systems currently coexist

3. **Direct OpenAI → Vercel AI Gateway** (✅ Complete)
   - All AI requests now routed through Vercel AI Gateway
   - Better monitoring and multi-provider support

### Current State
- **Authentication**: Stack Auth (fully migrated)
- **Database**: Convex (schema ready, migration in progress)
- **AI**: Vercel AI Gateway (fully migrated)
- **Payments**: Polar.sh (integrated)

---

## Important Files and Documentation

### Configuration Files
- `package.json` - Dependencies and scripts
- `next.config.mjs` - Next.js configuration with security headers
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - Linting rules
- `components.json` - Shadcn/ui configuration
- `convex/schema.ts` - Database schema

### Documentation Files
- `README.md` - Main project documentation
- `MIGRATION_STATUS.md` - Convex migration progress
- `STACK_AUTH_MIGRATION_COMPLETE.md` - Stack Auth migration details
- `DEPLOYMENT_CHECKLIST.md` - Production deployment guide
- `POLAR_QUICK_START.md` - Polar.sh integration guide
- `SANDBOX_PERSISTENCE_IMPLEMENTATION.md` - E2B sandbox persistence
- `SEO_IMPROVEMENTS.md` - SEO optimization details
- `ERROR_DETECTION_IMPROVEMENTS.md` - Error handling improvements

### Key Source Files
- `src/app/layout.tsx` - Root layout with providers
- `src/lib/auth-server.ts` - Server-side auth utilities
- `src/inngest/functions.ts` - AI code generation logic
- `convex/helpers.ts` - Convex auth helpers
- `convex/usage.ts` - Credit system implementation

---

## Testing and Quality Assurance

### Linting
```bash
npm run lint
```
- ESLint configured with Next.js and TypeScript rules
- Ignores generated files in `src/generated/`
- Warns on `any` types, errors on unused variables

### Type Checking
```bash
npx tsc --noEmit
```
- Strict TypeScript mode enabled
- All code must be properly typed

### Build Verification
```bash
npm run build
```
- Ensures production build succeeds
- Checks for type errors and build issues
- Uses Turbopack for faster builds

---

## Deployment

### Vercel Deployment (Recommended)

1. **Prerequisites**:
   - Convex deployed (`bunx convex deploy`)
   - Stack Auth configured with production URLs
   - Inngest Cloud account set up
   - All environment variables ready

2. **Deploy**:
   ```bash
   # Deploy to Vercel
   vercel deploy --prod
   ```

3. **Post-Deployment**:
   - Sync Inngest webhook: `https://your-app.vercel.app/api/inngest`
   - Update Stack Auth redirect URLs
   - Configure Polar.sh webhook endpoint
   - Test authentication flow
   - Verify AI code generation works

See `DEPLOYMENT_CHECKLIST.md` for complete deployment guide.

---

## Common Tasks

### Adding a New UI Component
```bash
# Use Shadcn CLI to add components
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Creating a New Convex Function
1. Add function to appropriate file in `convex/`
2. Export as query, mutation, or action
3. Use in client with `useQuery()` or `useMutation()`

### Adding a New API Route
1. Create file in `src/app/api/[route]/route.ts`
2. Export `GET`, `POST`, etc. handlers
3. Use `getUser()` for authentication
4. Return `NextResponse.json()`

### Updating Database Schema
1. Modify `convex/schema.ts`
2. Push changes: `bunx convex dev` (auto-deploys schema)
3. No migration files needed (Convex handles it)

---

## Troubleshooting

### Common Issues

1. **E2B Sandbox Fails**:
   - Verify E2B_API_KEY is set
   - Check template name in `src/inngest/functions.ts`
   - Ensure Docker is running for template builds

2. **Authentication Not Working**:
   - Verify Stack Auth environment variables
   - Check redirect URLs in Stack Auth dashboard
   - Ensure `StackProvider` wraps app in `layout.tsx`

3. **Convex Connection Issues**:
   - Run `bunx convex dev` in separate terminal
   - Verify NEXT_PUBLIC_CONVEX_URL is set
   - Check Convex dashboard for deployment status

4. **Inngest Jobs Not Running**:
   - For local dev: Start Inngest Dev Server
   - For production: Verify webhook is synced in Inngest Cloud
   - Check INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY

5. **Build Errors**:
   - Clear `.next` folder: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`
   - Check for TypeScript errors: `npx tsc --noEmit`

---

## Additional Resources

### External Documentation
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Convex Docs](https://docs.convex.dev)
- [Stack Auth Docs](https://docs.stack-auth.com)
- [E2B Docs](https://e2b.dev/docs)
- [Inngest Docs](https://www.inngest.com/docs)
- [Polar.sh Docs](https://docs.polar.sh)
- [Shadcn/ui Docs](https://ui.shadcn.com)

### Internal Documentation
- See `explanations/` directory for detailed guides
- Check `*.md` files in root for specific topics
- Review `sandbox-templates/` for E2B configuration

---

## Notes for AI Assistants

### When Making Changes:

1. **Always check existing patterns** before implementing new features
2. **Use Convex for data operations** (migration in progress, prefer Convex over Prisma)
3. **Use Stack Auth** for authentication (not Clerk or Better Auth)
4. **Use Vercel AI Gateway** for AI requests (not direct OpenAI)
5. **Follow Tailwind CSS v4 syntax** (no `@apply` in CSS files)
6. **Use Server Components** by default, add `"use client"` only when needed
7. **Check `convex/schema.ts`** for database structure before querying
8. **Use tRPC** for type-safe API calls when possible
9. **Test locally** with `npm run dev` and `bunx convex dev` running
10. **Build before committing** to catch type errors early

### Project Conventions:
- **No icons from lucide-react** unless explicitly requested
- **No modifying `src/app/globals.css`** (critical rule)
- **Use existing Shadcn components** from `@/components/ui/`
- **Follow existing file structure** in `src/` directory
- **Add proper TypeScript types** for all functions and components
- **Use `getCurrentUserId(ctx)`** in Convex functions for auth
- **Handle errors gracefully** with try-catch and user-friendly messages

---

**Last Updated**: December 11, 2025  
**Project Version**: 0.1.0  
**Status**: Active Development
