# ZapDev - AI-Powered Code Generation Platform

**Generated**: 2026-01-04
**Commit**: [dynamic]
**Branch**: main

## OVERVIEW
AI-powered web app development platform using Next.js 15, Convex (real-time DB), tRPC, and E2B sandboxes for isolated code generation.

## STRUCTURE
```
./
├── src/
│   ├── app/              # Next.js 15 App Router
│   ├── modules/          # Feature-based: home, projects, messages, usage
│   ├── agents/           # AI agent orchestration (migrated from Inngest)
│   ├── prompts/          # Framework-specific LLM prompts
│   ├── components/ui/    # Shadcn/ui components
│   ├── lib/              # Utilities, framework config
│   └── trpc/             # Type-safe API client/server
├── convex/               # Real-time database (schema, queries, mutations)
├── sandbox-templates/    # E2B sandbox configs (nextjs, angular, react, vue, svelte)
├── tests/                # Jest test suite with mocks
└── explanations/         # Documentation (ALL .md files go here)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Frontend pages | `src/app/` | App Router, pages, layouts |
| Feature logic | `src/modules/[feature]/` | UI + server procedures per domain |
| AI agents | `src/agents/` | Code generation orchestration |
| LLM prompts | `src/prompts/` | Framework-specific system prompts |
| Database schema | `convex/schema.ts` | Single source of truth |
| tRPC API | `src/trpc/routers/` | Type-safe procedures |
| UI components | `src/components/ui/` | Shadcn/ui (copy/paste, not library) |
| Utilities | `src/lib/` | Framework config, Convex helpers |
| Tests | `tests/` | Jest with dependency mocks |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| schema.ts | Module | convex/schema.ts | Database tables, indexes |
| code-agent.ts | Module | src/agents/code-agent.ts | Main AI generation loop |
| functions.ts | Module | convex/* | DB operations (queries/mutations) |
| _app.ts | Module | src/trpc/routers/_app.ts | Root tRPC router |

## CONVENTIONS

**Package Management**: ALWAYS use `bun`, NEVER npm/pnpm/yarn
```bash
bun install          # Install deps
bun run dev          # Start Next.js (Turbopack)
bun run convex:dev   # Start Convex (separate terminal)
bun run lint         # ESLint flat config
bun run build        # Production build
```

**TypeScript**: Strict mode enabled, no `any` (warn only)
**Path Aliases**: `@/*` → `src/*`, `@/convex/*` → `convex/*`
**Auth**: Clerk with JWT, use `requireAuth(ctx)` in Convex functions

**Framework Default**: Next.js 15 for web apps unless user specifies
- Angular 19 (Material Design, enterprise)
- React 18 (Vite, Chakra UI)
- Vue 3 (Vuetify)
- SvelteKit (DaisyUI)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `npm` or `pnpm` — Bun is the package manager
- **NEVER** use `.filter()` in Convex queries — use indexes
- **NEVER** expose Clerk user IDs in public APIs
- **NEVER** start dev servers in E2B sandboxes
- **NEVER** create `.md` files in root — use `explanations/`
- **NEVER** use absolute paths in AI-generated code (e.g., `/home/user/...`)
- **DO NOT** load Tailwind as external stylesheet

## UNIQUE STYLES

**Feature-Based Modules**: Each module (home, projects, messages, usage) has `ui/` and `server/` subdirectories. Logic lives near its UI.

**Hybrid Router**: `src/app/` for main routes, `src/pages/404.tsx` for error handling (transitional).

**Mock-First Testing**: Centralized mocks in `tests/mocks/` for Convex, E2B, Inngest. Tests run in Node environment (not DOM).

**Pre-Warmed Sandboxes**: Custom `sandbox-templates/nextjs/compile_page.sh` starts Next.js dev server and pings until ready before AI generation.

**Lockfile Duplication**: Both `bun.lock` and `pnpm-lock.yaml` exist (technical debt — should be bun-only).

## COMMANDS

```bash
# Development (2 terminals required)
bun run dev              # Next.js dev server
bun run convex:dev       # Convex backend

# Building & Testing
bun run build            # Production build
bun run lint             # ESLint validation
bun run test             # Jest tests

# Database
bun run convex:deploy    # Deploy Convex to production

# E2B Templates (requires Docker)
e2b template build --name your-template-name --cmd "/compile_page.sh"
```

## NOTES

**Migration Status**: Prisma/PostgreSQL → Convex (complete). Inngest → Custom agents (migrated to `src/agents/`).

**E2B Prerequisites**: Must build sandbox templates manually before AI code generation. Not automated in CI.

**Credit System**: Free tier (5/day), Pro tier (100/day). Tracked in `convex/usage.ts` with 24-hour rolling window.

**Framework Detection**: AI chooses based on user request, defaults to Next.js. See `src/prompts/framework-selector.ts` for priority logic.

**Auto-Fix Retry**: AI agents retry build/lint failures up to 2 times with error context.

**Security**: All user inputs validated (Zod), OAuth tokens encrypted in Convex, file paths sanitized.

**Documentation**: All guides live in `explanations/` — `CONVEX_QUICKSTART.md`, `DEBUGGING_GUIDE.md`, etc.
