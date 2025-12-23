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
# Update template name in API route after building
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Shadcn/ui
- **Backend**: Convex (real-time database), tRPC (type-safe APIs)
- **Auth**: Stack Auth with JWT authentication (migrated from Clerk)
- **AI**: Vercel AI SDK (multi-provider: Anthropic, OpenAI, Google, Qwen, Grok)
- **Code Execution**: E2B Code Interpreter (isolated sandboxes)
- **Streaming**: Server-Sent Events (SSE) for real-time progress updates

### Core Architecture

**Streaming-First AI Code Generation**
1. User creates project and sends message describing desired app
2. `/api/generate-ai-code-stream` handles request:
   - Selects appropriate AI model based on task complexity
   - Streams AI responses via Server-Sent Events (SSE)
   - Maintains conversation state in memory (or Convex in production)
3. `/api/apply-ai-code-stream` processes AI response:
   - Parses `<file>` XML tags from AI output
   - Detects npm packages from import statements
   - Writes files to E2B sandbox
   - Installs detected packages via npm
   - Streams progress updates via SSE
4. Dev server runs in background sandbox on port 3000
5. Generated files accessible via live preview iframe

**Data Flow**
- User actions → tRPC mutations → Convex database
- AI generation → API routes → E2B sandboxes → Real-time SSE updates
- Real-time updates → Convex subscriptions → React components

### Directory Structure

```
src/
  app/              # Next.js App Router pages and layouts
    api/            # API routes (streaming code generation)
      generate-ai-code-stream/  # AI code generation endpoint
      apply-ai-code-stream/      # Apply code to sandbox endpoint
      fix-errors/                # Error fixing endpoint
      transfer-sandbox/          # Sandbox resume endpoint
      import/                    # Figma/GitHub import endpoints
  components/       # Reusable UI components (Shadcn/ui based)
  lib/              # Utilities (Convex API, utils, frameworks config)
    streaming/       # Streaming utilities (SSE, types, providers)
  modules/          # Feature modules (home, projects, messages, usage, sandbox)
    sandbox/         # Sandbox management module
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
- `sandboxSessions`: E2B sandbox persistence tracking
- `subscriptions`: Subscription management (Polar billing)

**API Routes**
- `src/app/api/generate-ai-code-stream/route.ts`:
  - Handles AI code generation with streaming
  - Model selection (auto, Anthropic, OpenAI, Google, Qwen)
  - Conversation context management
  - Server-Sent Events for real-time streaming
- `src/app/api/apply-ai-code-stream/route.ts`:
  - Applies AI-generated code to E2B sandbox
  - Parses `<file>` XML tags and `<package>` tags
  - Auto-detects npm packages from imports
  - Installs packages via npm in sandbox
  - Streams progress via SSE

**Streaming Library** (`src/lib/streaming/`)
- `index.ts`: Main streaming utilities
- `sse.ts`: Server-Sent Events helper functions
- `ai-provider.ts`: AI provider configuration
- `types.ts`: TypeScript types for streaming
- `context-selector.ts`: Context-aware prompt building

**Code Standards**
- Strict TypeScript (avoid `any`)
- Modern framework patterns (Next.js App Router, React hooks)
- Accessibility and responsive design
- Streaming-first architecture (no blocking operations)
- Use Tailwind CSS classes only (no custom CSS imports)

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
- `AI_GATEWAY_API_KEY`: Vercel AI Gateway key
- `AI_GATEWAY_BASE_URL`: https://ai-gateway.vercel.sh/v1/
- `E2B_API_KEY`: E2B sandbox API key
- Stack Auth keys (migrated from Clerk):
  - `NEXT_PUBLIC_STACK_APP_ID`: Stack App ID
  - `NEXT_PUBLIC_STACK_PROJECT_ID`: Stack Project ID
  - `STACK_SECRET_KEY`: Stack Secret Key

### E2B Templates
Before running AI code generation:
1. Build E2B templates with Docker
2. Update template name in relevant API route
3. Templates available: nextjs, angular, react, vue, svelte

### Convex Development
- Run `bun run convex:dev` in separate terminal during development
- Convex uses real-time subscriptions for live updates
- Schema changes auto-migrate in dev mode

## Troubleshooting

**Code Generation Failures**
- Verify E2B sandbox templates are built and accessible
- Check AI Gateway credentials in environment
- Check API route logs for streaming errors

**Sandbox Connection Issues**
- Ensure E2B_API_KEY is valid
- Check sandbox template exists and is accessible
- Use global `activeSandbox` for reuse across requests

**Package Installation Failures**
- Check npm is working in sandbox
- Verify network connectivity in sandbox
- Look at npm stderr in API route logs

**Streaming Issues**
- Ensure `dynamic = 'force-dynamic'` is set in API routes
- Check SSE headers are correctly set
- Verify client-side EventSource is properly configured
