# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ZapDev is an AI-powered development platform that generates production-ready web applications through conversational AI. Users describe what they want to build, and AI generates code across multiple frameworks in isolated E2B sandboxes with real-time previews.

## Development Commands

```bash
# Install dependencies (ALWAYS use bun, never npm/yarn)
bun install

# Start development (requires 2 terminals)
bun run dev              # Terminal 1: Next.js with Turbopack (http://localhost:3000)
bun run convex:dev       # Terminal 2: Convex backend

# Quality checks
bun run lint             # ESLint (flat config)
bun run build            # Production build
bun run test             # Jest tests from /tests directory

# Single test file
bun run test tests/security.test.ts

# Convex
bun run convex:deploy    # Deploy Convex to production
```

## Project Structure

```
src/
├── agents/              # AI agent system (core code generation logic)
│   ├── code-agent.ts    # Main agent orchestration & streaming
│   ├── tools.ts         # Agent tools (terminal, createOrUpdateFiles, readFiles)
│   ├── sandbox-utils.ts # E2B sandbox management
│   └── types.ts         # Model configs, framework types
├── app/
│   ├── api/
│   │   ├── agent/run/   # SSE streaming endpoint for code generation
│   │   ├── import/      # Figma & GitHub OAuth + import processing
│   │   ├── polar/       # Subscription billing (Polar.sh)
│   │   └── webhooks/    # Clerk & Polar webhooks
│   ├── dashboard/       # User projects list
│   └── projects/        # Project workspace with editor
├── prompts/             # Framework-specific AI system prompts
│   ├── nextjs.ts, angular.ts, react.ts, vue.ts, svelte.ts
│   └── framework-selector.ts
├── trpc/                # Type-safe API layer
├── components/          # React components (Shadcn/ui in ui/)
├── lib/                 # Utilities
│   ├── auth-server.ts   # Clerk authentication helpers
│   └── firecrawl.ts     # URL crawling for context
└── hooks/               # Custom React hooks

convex/
├── schema.ts            # Database schema (projects, messages, fragments, etc.)
├── projects.ts          # Project CRUD operations
├── messages.ts          # Message & fragment operations
└── sandboxSessions.ts   # Sandbox lifecycle management

sandbox-templates/       # E2B templates per framework (nextjs, angular, react, vue, svelte)
tests/                   # Jest test suite
explanations/            # All documentation files go here
```

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Shadcn/ui
- **Backend**: Convex (real-time database), tRPC, Clerk (authentication)
- **AI**: Vercel AI SDK via OpenRouter, multiple models (Claude, GPT-4, Gemini)
- **Code Execution**: E2B sandboxes (isolated containers)
- **Payments**: Polar.sh subscriptions

## Core Architecture

### AI Agent Workflow (`src/agents/code-agent.ts`)

```
User Request
  → Framework Detection (via AI using Gemini Flash)
  → Create E2B Sandbox
  → Stream AI response with tool calls
     ├── createOrUpdateFiles (write code to sandbox)
     ├── readFiles (read existing code)
     └── terminal (run npm/bun commands)
  → Build validation (auto-fix up to 1 retry)
  → Save fragment to Convex
  → Return sandbox preview URL
```

**Key constants**:
- `AUTO_FIX_MAX_ATTEMPTS = 1` - Build error auto-fix retries
- `MAX_AGENT_ITERATIONS = 8` - Max tool call rounds per request

### Data Flow

1. User submits prompt → `POST /api/agent/run`
2. Agent streams SSE events: `status`, `text`, `file-created`, `tool-call`, `complete`
3. Results stored in Convex: `messages` table + `fragments` table (code artifacts)
4. UI subscribes to Convex for real-time updates

### Framework Support

| Framework | Template | UI Library | Default |
|-----------|----------|------------|---------|
| Next.js 15 | zapdev-nextjs | Shadcn/ui | ✓ |
| Angular 19 | zapdev-angular | Material | |
| React 18 | zapdev-react | Chakra UI | |
| Vue 3 | zapdev-vue | Vuetify | |
| SvelteKit | zapdev-svelte | DaisyUI | |

Detection logic in `src/prompts/framework-selector.ts`. Next.js is default for ambiguous requests.

### Convex Schema (key tables)

- `projects` - User projects with framework preference
- `messages` - Chat history (USER/ASSISTANT roles)
- `fragments` - Generated code artifacts (1:1 with assistant messages)
- `sandboxSessions` - Active E2B sandbox tracking
- `subscriptions` - Polar subscription status

## E2B Sandbox Templates

```bash
# Install CLI
npm i -g @e2b/cli
e2b auth login

# Build template
cd sandbox-templates/nextjs
e2b template build --name zapdev-nextjs --cmd "/compile_page.sh"
```

Template names are defined in `src/agents/types.ts` under `FRAMEWORK_TEMPLATES`.

## Environment Variables

Required:
```bash
OPENROUTER_API_KEY        # AI model access
NEXT_PUBLIC_CONVEX_URL    # Convex database
CONVEX_DEPLOYMENT         # Convex project ID
E2B_API_KEY               # Sandbox execution
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Optional:
```bash
FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET  # Figma OAuth
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET # GitHub OAuth
UPLOADTHING_TOKEN                      # File uploads
```

## Testing

Tests are in `/tests/` using Jest with ts-jest:

```bash
bun run test                           # Run all tests
bun run test tests/security.test.ts    # Single file
bun run test --coverage                # With coverage
```

Key test files:
- `security.test.ts` - Input sanitization, path traversal prevention
- `agent-workflow.test.ts` - Agent flow testing
- `file-operations.test.ts` - Sandbox file operations

## Project Instructions

1. **Always use bun** - Never npm or yarn
2. **Documentation** - Put `.md` files in `/explanations/` (except CLAUDE.md, README.md)
3. **New features** - Use Convex for data, not any other database
4. **UI components** - Use Shadcn/ui from `@/components/ui/`
5. **Next.js code generation** - Must use Shadcn components (enforced by build validation)
