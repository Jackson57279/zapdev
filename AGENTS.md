# AGENTS.md - AI Coding Agent Guidelines

**Always use `bun`** for all commands (never npm/yarn/pnpm).

## Commands
```bash
bun install                         # Install dependencies
bun run dev                         # Next.js dev (+ bun run convex:dev in another terminal)
bun run build                       # Production build
bun run lint                        # ESLint check
bun run test                        # Run all Jest tests
bun run test -- path/to/file.test.ts  # Run single test file
bun run convex:dev                  # Convex backend dev server
bun run convex:deploy               # Deploy Convex to production
```

## Code Style

**TypeScript**: Strict mode, avoid `any`, use proper interfaces/types. Unused vars prefix with `_`.

**Imports**: Use `@/` for src paths, `@/convex/` for convex imports. Group: React → external → internal → types.

**Formatting**: 2-space indent, single quotes, trailing commas. Let ESLint/Prettier handle it.

**Naming**: camelCase for variables/functions, PascalCase for components/types, SCREAMING_SNAKE for constants.

**Error Handling**: Use Sentry for production errors. Validate inputs with Zod. Use TRPCError for API errors.

**React**: Functional components, default to Server Components (add "use client" only for interactivity/hooks/browser APIs).

**Convex**: Always use new function syntax with args/returns validators. Use `requireAuth()` for auth checks. Use indexes for queries (never full table scans). Follow `.cursor/rules/convex_rules.mdc` strictly.

**File Placement**: Tests in `/tests/`, docs in `/explanations/` (except AGENTS.md/CLAUDE.md/README.md in root).

See `.cursor/rules/zapdev_rules.mdc` and `.cursor/rules/convex_rules.mdc` for comprehensive guidelines.

```
src/
  app/              # Next.js App Router pages and layouts
  components/       # Reusable UI components (Shadcn/ui based)
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

### E2B Templates
Before running AI code generation:
1. Build E2B templates with Docker
2. Templates available: nextjs, angular, react, vue, svelte

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
- Test locally: `cd sandbox-templates/[framework] && bun run lint && bun run build`
