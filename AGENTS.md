# ZapDev - AI-Powered Code Generation Platform

**Generated**: 2026-01-04
**Commit**: [dynamic]
**Branch**: main

## OVERVIEW
AI-powered web app development platform using Next.js 15, Convex (real-time DB), tRPC, and E2B sandboxes for isolated code generation. Includes a skills.sh-compatible skill system for prompt augmentation and a WebContainer-based client-side preview engine (feature-flagged).

## STRUCTURE
```
./
├── src/
│   ├── app/              # Next.js 15 App Router
│   ├── modules/          # Feature-based: home, projects, messages, usage
│   ├── agents/           # AI agent orchestration (migrated from Inngest)
│   ├── prompts/          # Framework-specific LLM prompts
│   ├── components/ui/    # Shadcn/ui components
│   ├── lib/              # Utilities, framework config, sandbox adapter
│   ├── data/             # Static data (core skills, PrebuiltUI components)
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
| Skill system | `src/agents/skill-loader.ts`, `convex/skills.ts` | Skill loading and storage |
| Sandbox adapter | `src/lib/sandbox-adapter.ts` | E2B/WebContainer abstraction |
| WebContainer | `src/lib/webcontainer*.ts` | Browser-side preview engine |
| Tests | `tests/` | Jest with dependency mocks |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| schema.ts | Module | convex/schema.ts | Database tables, indexes |
| code-agent.ts | Module | src/agents/code-agent.ts | Main AI generation loop |
| sandbox-adapter.ts | Module | src/lib/sandbox-adapter.ts | ISandboxAdapter interface + E2B/WC implementations |
| skill-loader.ts | Module | src/agents/skill-loader.ts | Skill content loading with token budgets |
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

## SKILL SYSTEM

**Overview**: Skills are prompt augmentation — markdown instructions injected into agent system prompts. Compatible with [skills.sh](https://skills.sh) format.

**Core Skills** (always injected):
- `context7` — Documentation lookup via Context7 API
- `frontend-design` — UI/UX design guidelines

**Architecture**:
- `convex/skills.ts` — Skill CRUD (Convex queries/mutations)
- `src/agents/skill-loader.ts` — Loads skills for agent prompt injection
- `src/data/core-skills/` — Static fallback when Convex is unavailable
- Token budget: 4000 tokens/skill, 12000 tokens total

**See**: `explanations/SKILL_SYSTEM.md` for full documentation.

## SANDBOX ADAPTER (E2B / WebContainer)

**Overview**: `ISandboxAdapter` abstracts over E2B sandboxes (server-side, default) and WebContainers (browser-side, feature-flagged).

**Feature Flag**: `NEXT_PUBLIC_USE_WEBCONTAINERS=true|false` (default: `false`)

**Architecture**:
- `src/lib/sandbox-adapter.ts` — Interface + factory + both implementations
- `src/lib/webcontainer.ts` — Singleton WebContainer boot
- `src/lib/webcontainer-sync.ts` — File mounting (flat path → FileSystemTree)
- `src/lib/webcontainer-process.ts` — npm install, dev server spawning
- `src/lib/webcontainer-build.ts` — Client-side build/lint validation

**Usage in Agent**:
```typescript
// code-agent.ts creates the adapter via factory
const adapter = await createSandboxAdapter(framework);
// tools.ts receives adapter via ToolContext
const tools = createAgentTools({ adapter, sandboxId: adapter.id, state, ... });
```

**COOP/COEP Headers**: Scoped to `/preview/*` routes only (see `next.config.mjs`). Do NOT apply globally — breaks Clerk auth popups.

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `npm` or `pnpm` — Bun is the package manager
- **NEVER** use `.filter()` in Convex queries — use indexes
- **NEVER** expose Clerk user IDs in public APIs
- **NEVER** start dev servers in E2B sandboxes
- **NEVER** create `.md` files in root — use `explanations/`
- **NEVER** use absolute paths in AI-generated code (e.g., `/home/user/...`)
- **DO NOT** load Tailwind as external stylesheet
- **DO NOT** use 'as' or 'any' when you see a Typescript error.
- **DO NOT** Run bun convex dev or anything equivlent without user premission ask before using.
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

**Auto-Fix Retry**: AI agents retry build/lint failures up to 1 time with error context.

**Security**: All user inputs validated (Zod), OAuth tokens encrypted in Convex, file paths sanitized.

**Documentation**: All guides live in `explanations/` — `CONVEX_QUICKSTART.md`, `DEBUGGING_GUIDE.md`, `SKILL_SYSTEM.md`, etc.
