# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Common Commands

### Development
```bash
bun install          # Install dependencies (always use bun, not npm/pnpm)
bun run dev          # Start Next.js dev server with Turbopack
bun run build        # Build for production
bun run lint         # Run ESLint
bun run start        # Start production server
```

### Convex (Backend Database)
```bash
bun run convex:dev     # Start Convex dev server (run in separate terminal)
bun run convex:deploy  # Deploy Convex to production
bun run migrate:convex # Migrate data from PostgreSQL to Convex
```

### Testing
```bash
bun run test           # Run Jest tests (if configured)
# Test files in tests/ directory
```

### E2B Sandbox Templates
```bash
# Build E2B templates for AI code generation (requires Docker)
cd sandbox-templates/[framework]  # nextjs, angular, react, vue, or svelte
e2b template build --name your-template-name --cmd "/compile_page.sh"
# Update template name in src/inngest/functions.ts after building
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Shadcn/ui
- **Backend**: Convex (real-time database), tRPC (type-safe APIs)
- **Auth**: Clerk with JWT authentication
- **AI**: Vercel AI Gateway (Claude via Anthropic), Inngest Agent Kit
- **Code Execution**: E2B Code Interpreter (isolated sandboxes)
- **Background Jobs**: Inngest

### Core Architecture

**AI-Powered Code Generation Flow**
1. User creates project and sends message describing desired app
2. Framework selector agent chooses appropriate framework (Next.js/Angular/React/Vue/Svelte)
3. Single code generation agent runs inside E2B sandbox:
   - Writes/updates files using sandbox file APIs
   - Runs commands (install, lint, build) via terminal tool
   - Follows framework-specific prompts from `src/prompts/`
   - Produces `<task_summary>` when complete
4. Automatic validation: `bun run lint` and `bun run build` in sandbox
5. Generated files and metadata saved to Convex as project fragments

**Data Flow**
- User actions → tRPC mutations → Convex database
- AI processing → Inngest background jobs → E2B sandboxes → Convex
- Real-time updates → Convex subscriptions → React components

### Directory Structure

```
src/
  app/              # Next.js App Router pages and layouts
  components/       # Reusable UI components (Shadcn/ui based)
  inngest/          # Background job functions and AI agent logic
    functions/      # Inngest function definitions
    functions.ts    # Main agent orchestration (framework selection, code generation)
  lib/              # Utilities (Convex API, utils, frameworks config)
  modules/          # Feature modules (home, projects, messages, usage)
  prompts/          # Framework-specific AI prompts (nextjs.ts, angular.ts, etc.)
  trpc/             # tRPC router and client setup
convex/             # Convex backend (schema, queries, mutations, actions)
  schema.ts         # Database schema (projects, messages, fragments, usage, etc.)
  projects.ts       # Project CRUD operations
  messages.ts       # Message CRUD and streaming
  usage.ts          # Credit system (Free: 5/day, Pro: 100/day)
sandbox-templates/  # E2B sandbox templates for each framework
```

### Key Components

**Convex Schema** (`convex/schema.ts`)
- `projects`: User projects with framework selection
- `messages`: Conversation history (USER/ASSISTANT roles, streaming status)
- `fragments`: Generated code artifacts linked to messages
- `usage`: Daily credit tracking for rate limiting
- `attachments`: Figma/GitHub imports
- `imports`: Import job status tracking

**Inngest Functions** (`src/inngest/functions.ts`)
- Framework detection using AI
- Code generation agents with tools: `createOrUpdateFiles`, `readFiles`, `terminal`
- Auto-fix retry logic for build/lint errors (max 2 attempts)
- URL crawling and web content integration
- Figma/GitHub import processing

**Code Standards for AI Agents**
- Strict TypeScript (avoid `any`)
- Modern framework patterns (Next.js App Router, React hooks)
- Accessibility and responsive design
- Never start dev servers in sandboxes
- Always run `bun run lint` and `bun run build` for validation

## Important Notes

### Cursor Rules
- Documentation files (*.md) should go in `explanations/` folder, not root
- Avoid creating unnecessary .md files

### Package Management
- **Always use `bun`** for installing packages and running scripts
- Do not use npm or pnpm

### Environment Variables
Required for development:
- `NEXT_PUBLIC_CONVEX_URL`: Convex backend URL
- `OPENROUTER_API_KEY`: OpenRouter API key
- `OPENROUTER_BASE_URL`: https://openrouter.ai/api/v1
- `E2B_API_KEY`: E2B sandbox API key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk auth
- `CLERK_SECRET_KEY`: Clerk secret
- `INNGEST_EVENT_KEY`: Inngest event key
- `INNGEST_SIGNING_KEY`: Inngest signing key

### E2B Templates
Before running AI code generation:
1. Build E2B templates with Docker
2. Update template name in `src/inngest/functions.ts` (line ~22)
3. Templates available: nextjs, angular, react, vue, svelte

### Convex Development
- Run `bun run convex:dev` in separate terminal during development
- Convex uses real-time subscriptions for live updates
- Schema changes auto-migrate in dev mode
- See `README_CONVEX.md` for migration from PostgreSQL

## Troubleshooting

**Framework Detection Errors**
- Check `FRAMEWORK_SELECTOR_PROMPT` in `src/prompts/framework-selector.ts`
- Ensure recent messages exist for context

**Code Generation Failures**
- Verify E2B sandbox templates are built and accessible
- Check AI Gateway credentials in environment
- Review framework prompt instructions in `src/prompts/`

**Build or Lint Failures in Sandbox**
- Inspect Inngest logs for command output
- Auto-fix will retry up to 2 times for detected errors
- Test locally: `cd sandbox-templates/[framework] && bun run lint && bun run build`
