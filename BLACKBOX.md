# ZapDev - Project Context for Blackbox AI

## Project Overview

**ZapDev** is an AI-powered development platform that enables users to create web applications through conversational interactions with AI agents. The platform provides real-time code generation in isolated E2B sandboxes with live preview capabilities, file exploration, and comprehensive project management.

### Core Purpose
- Generate full-stack web applications through natural language conversations
- Provide real-time code execution and preview in secure E2B sandboxes
- Support multiple frontend frameworks (Next.js, React, Vue, Angular, Svelte)
- Track usage and manage subscriptions with credit-based billing via Stripe

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Backend**: tRPC for type-safe APIs
- **Database**: Convex (real-time database)
- **Authentication**: Clerk
- **AI Gateway**: OpenRouter (supports OpenAI, Anthropic, and more)
- **Code Execution**: E2B Code Interpreter (sandboxed environments)
- **Payments**: Stripe (subscription management)
- **Monitoring**: Sentry (error tracking)
- **Deployment**: Vercel

---

## Building and Running

### Prerequisites
- Node.js 18+ or Bun
- Docker (required for E2B template building)
- E2B account and API key
- Clerk account
- OpenRouter API key
- Stripe account (for billing)

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
# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
CLERK_WEBHOOK_SECRET=""
CLERK_JWT_ISSUER_DOMAIN=""
CLERK_JWT_TEMPLATE_NAME="convex"

# Stripe Billing
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRO_PRICE_ID=""

# OpenRouter (AI Gateway)
OPENROUTER_API_KEY=""
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# E2B Sandboxes
E2B_API_KEY=""

# Convex (real-time database)
NEXT_PUBLIC_CONVEX_URL=""
NEXT_PUBLIC_CONVEX_SITE_URL=""

# Inngest (background jobs - optional)
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# Sentry (error tracking)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_DSN=""
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

# Update template name in src/agents/sandbox.ts
# The FRAMEWORK_TEMPLATES object maps frameworks to E2B template names
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

# Run tests
npm test
```

### Testing Scripts

```bash
# Test OpenRouter connection
node test-openrouter.js

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
│   ├── auth.config.ts        # Clerk JWT authentication configuration
│   ├── helpers.ts            # Auth helpers and utilities
│   ├── projects.ts           # Project CRUD operations
│   ├── messages.ts           # Message and fragment operations
│   ├── usage.ts              # Credit tracking and billing
│   ├── subscriptions.ts      # Stripe subscription management
│   └── ...
├── sandbox-templates/         # E2B sandbox configurations
│   └── nextjs/               # Next.js sandbox template
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (home)/          # Home page, pricing, subscription
│   │   ├── api/             # API routes (tRPC, webhooks, imports)
│   │   ├── projects/        # Project pages and chat interface
│   │   ├── frameworks/      # Framework-specific pages
│   │   ├── import/          # Import flows (Figma, GitHub)
│   │   └── ...
│   ├── agents/               # AI agent system
│   │   ├── index.ts         # Agent exports
│   │   ├── client.ts        # AI model client (OpenRouter)
│   │   ├── sandbox.ts       # E2B sandbox manager
│   │   ├── tools.ts         # Agent tools (file ops, terminal)
│   │   ├── prompts/         # Framework-specific prompts
│   │   └── agents/          # Specialized agents
│   │       ├── code-generation.ts  # Main code generation agent
│   │       ├── framework-selector.ts
│   │       ├── validation.ts
│   │       └── error-fixer.ts
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Shadcn/ui components
│   │   ├── file-explorer.tsx # Code file browser
│   │   └── ...
│   ├── modules/              # Feature modules
│   │   ├── projects/        # Project management logic
│   │   ├── messages/        # Message handling
│   │   ├── usage/           # Usage tracking
│   │   └── ...
│   ├── trpc/                 # tRPC setup
│   │   ├── server.tsx       # Server-side tRPC router
│   │   └── client.tsx       # Client-side tRPC hooks
│   ├── lib/                  # Utilities and helpers
│   │   ├── auth-server.ts   # Server-side auth utilities
│   │   ├── stripe/          # Stripe integration
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── prompts/              # AI prompt templates
│   └── types.ts              # Shared TypeScript types
├── tests/                     # Test files
├── scripts/                   # Utility scripts
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

1. **Clerk**: Current authentication provider
2. **Client-side**: Use Clerk hooks (`useUser()`, `useAuth()`)
3. **Server-side**: Use `getUser()` from `@/lib/auth-server`
4. **Convex**: Use `ctx.auth.getUserIdentity()` in functions
5. **JWT Template**: Clerk JWT template named "convex" for Convex auth

---

## Key Features and Workflows

### 1. Project Creation
- User creates a project with a name and framework selection
- Project stored in Convex `projects` table
- Associated with user via Clerk user ID

### 2. AI Code Generation
- User sends message describing desired functionality
- Message triggers AI agent via `/api/generate` route
- AI agent (via OpenRouter) generates code using tools
- Code executed in E2B sandbox
- Results streamed back to user in real-time

### 3. Sandbox Management
- Each project gets an isolated E2B sandbox
- Sandboxes auto-pause after inactivity
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
- Powered by Stripe
- Plans: Free, Pro
- Subscription data in `subscriptions` table
- Webhooks handle subscription events at `/api/webhooks/stripe`

---

## AI Agent System

### Agent Architecture

The AI agent system is located in `src/agents/` and consists of:

1. **Model Client** (`client.ts`): Manages AI model connections via OpenRouter
2. **Sandbox Manager** (`sandbox.ts`): Handles E2B sandbox lifecycle
3. **Tools** (`tools.ts`): Agent capabilities (file operations, terminal commands)
4. **Prompts** (`prompts/`): Framework-specific system prompts

### Available Agents

- **Code Generation** (`agents/code-generation.ts`): Main agent for generating code
- **Framework Selector** (`agents/framework-selector.ts`): Determines best framework
- **Validation** (`agents/validation.ts`): Validates generated code
- **Error Fixer** (`agents/error-fixer.ts`): Fixes code errors

### Agent Tools

The code generation agent has access to:
- `createOrUpdateFiles`: Write files to sandbox
- `readFiles`: Read existing files
- `terminal`: Run shell commands
- `listFiles`: List directory contents

### Supported Frameworks

- Next.js (default)
- React
- Vue
- Angular
- Svelte

Each framework has a corresponding E2B template and system prompt.

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
- `DEPLOYMENT_CHECKLIST.md` - Production deployment guide
- `CLERK_BILLING_MIGRATION.md` - Billing migration details

### Key Source Files
- `src/app/layout.tsx` - Root layout with providers
- `src/lib/auth-server.ts` - Server-side auth utilities
- `src/agents/agents/code-generation.ts` - AI code generation logic
- `src/agents/sandbox.ts` - E2B sandbox management
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
- Uses Turbopack for faster builds

### Unit Tests
```bash
npm test
```
- Jest configured for testing
- Test files in `tests/` directory

---

## Deployment

### Vercel Deployment (Recommended)

1. **Prerequisites**:
   - Convex deployed (`bunx convex deploy`)
   - Clerk configured with production URLs
   - Stripe webhooks configured
   - All environment variables ready

2. **Deploy**:
   ```bash
   vercel deploy --prod
   ```

3. **Post-Deployment**:
   - Configure Stripe webhook: `https://your-app.vercel.app/api/webhooks/stripe`
   - Configure Clerk webhook: `https://your-app.vercel.app/api/webhooks/clerk`
   - Update Clerk redirect URLs
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
   - Check template name in `src/agents/sandbox.ts`
   - Ensure Docker is running for template builds

2. **Authentication Not Working**:
   - Verify Clerk environment variables
   - Check redirect URLs in Clerk dashboard
   - Ensure `ClerkProviderWrapper` wraps app in `layout.tsx`

3. **Convex Connection Issues**:
   - Run `bunx convex dev` in separate terminal
   - Verify NEXT_PUBLIC_CONVEX_URL is set
   - Check Convex dashboard for deployment status

4. **AI Generation Fails**:
   - Verify OPENROUTER_API_KEY is set
   - Check OpenRouter dashboard for API status
   - Review error logs in Sentry

5. **Build Errors**:
   - Clear `.next` folder: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`
   - Check for TypeScript errors: `npx tsc --noEmit`

---

## Notes for AI Assistants

### When Making Changes:

1. **Always check existing patterns** before implementing new features
2. **Use Convex for data operations** (primary database)
3. **Use Clerk** for authentication
4. **Use OpenRouter** for AI requests
5. **Follow Tailwind CSS v4 syntax** (no `@apply` in CSS files)
6. **Use Server Components** by default, add `"use client"` only when needed
7. **Check `convex/schema.ts`** for database structure before querying
8. **Use tRPC** for type-safe API calls when possible
9. **Test locally** with `npm run dev` and `bunx convex dev` running
10. **Build before committing** to catch type errors early

### Project Conventions:
- **Use existing Shadcn components** from `@/components/ui/`
- **Follow existing file structure** in `src/` directory
- **Add proper TypeScript types** for all functions and components
- **Use `getCurrentUserId(ctx)`** in Convex functions for auth
- **Handle errors gracefully** with try-catch and user-friendly messages
- **NEVER modify `src/app/globals.css`** (critical rule)

---

**Last Updated**: December 28, 2025  
**Project Version**: 0.1.0  
**Status**: Active Development
