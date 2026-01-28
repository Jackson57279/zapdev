# Skill System - Learnings

## Task 1: Convex Schema for Skills (2026-01-27)

### Schema Conventions Observed
- Enums are defined as top-level exports using `v.union(v.literal(...))` pattern
- Tables use `defineTable({...}).index(...)` chaining with 2-space indentation for indexes
- Index naming convention: `by_fieldName` for single fields, `by_field1_field2` for compound
- `createdAt`/`updatedAt` are `v.number()` (not optional) in newer tables; some older tables use `v.optional(v.number())`
- `metadata` fields use `v.optional(v.any())`
- Foreign keys use `v.id("tableName")` validator

### Pre-existing Issues
- `bun run lint` / `next lint` is broken — `next lint` interprets "lint" as a directory path argument
- ESLint has circular structure error in config (react plugin)
- TypeScript errors exist in `src/lib/payment-templates/` (angular.ts, react.ts) and `convex/oauth.ts` — all pre-existing
- `convex/schema.ts` compiles cleanly with no errors

### Schema Placement
- Enums placed after `subscriptionIntervalEnum` (line 91), before `polarCustomers` definition
- Tables placed at end of `defineSchema` block, after `projectDeploymentCounters`
- `skillStatusEnum` is defined but not currently used in the schema (no `status` field on `skills` table) — may be used later in queries/mutations

## Task 2: Convex Skill CRUD Functions (2026-01-27)

### Patterns Observed
- Convex functions MUST have `args` + `returns` validators (per convex_rules.mdc)
- `requireAuth(ctx)` from `convex/helpers.ts` returns userId string (Clerk subject)
- Public functions use `query`/`mutation`, internal use `internalQuery`/`internalMutation`
- Index-based queries: `.withIndex("by_fieldName", (q) => q.eq("fieldName", value))`
- Return validators must include `_id` and `_creationTime` system fields
- `v.union(validator, v.null())` for nullable returns (e.g., getBySlug)
- Existing codebase has pre-existing TS errors in `convex/oauth.ts` and `src/lib/payment-templates/` — not related to our changes
- `sandboxSessions.ts` uses `.filter()` in some places (anti-pattern) — we avoided this

### Conventions Applied
- Used `skillReturnValidator` shared constant to avoid duplication across all return validators
- Used `internalQuery`/`internalMutation` for system functions (getForSystem, getCoreSkillContents, upsertFromGithub, seedCoreSkills)
- All public functions call `requireAuth(ctx)` first
- `remove` mutation returns `v.null()` and explicitly `return null`
- Cascade delete: `remove` also deletes related `skillInstallations`
- `create` mutation forces `isGlobal: false, isCore: false` — users cannot set these via public API
- `search` uses in-memory filtering since no search index is defined on skills table

### Key Decisions
- `filterSkills` helper is a plain function (not a Convex query) for secondary filtering after index-based primary filter — this is acceptable for small result sets
- `search` fetches all skills and filters in-memory — acceptable for a small skill catalog, would need a search index for scale
- `seedCoreSkills` accepts an array of skills for batch seeding — idempotent via slug-based upsert

## Task 4: Skill Content Loader (2026-01-27)

### Patterns Used
- **ConvexHttpClient proxy pattern** from `code-agent.ts:60-76` — lazy singleton via Proxy for deferred initialization
- **`cache.getOrCompute()` pattern** from `code-agent.ts:184-213` — 30-minute TTL caching identical to `detectFramework()`
- **Graceful fallback** — outer try/catch returns empty string, inner try/catch for installed skills allows core skills to still load

### Key Decisions
- Added `getInstalledSkillContents` internal query to `convex/skills.ts` (line 603+) since it didn't exist
- Used `internalQuery` (not `query`) since this runs server-side from agents, no auth needed
- Deduplication: installed skills that match core skill slugs are skipped to avoid prompt bloat
- Token budget: individual skill 4000 tokens, total 12000 tokens, with partial inclusion when budget is tight

### Files Modified
- `convex/skills.ts` — appended `getInstalledSkillContents` internal query
- `src/agents/skill-loader.ts` — new file, exports `loadSkillsForAgent()`

## Task 5: Agent Prompt Integration

- `code-agent.ts` uses `Promise.all` at line ~411 for parallel sandbox creation + database detection. Adding skill loading as a third parallel promise was straightforward — destructure as `[detectedDatabase, sandbox, skillContent]`.
- `StreamEvent` type is a simple string union at line ~287. Adding new event types is just adding another `| "type-name"` line.
- The system prompt composition was a ternary (`databaseIntegrationRules ? ... : frameworkPrompt`). Replaced with `[...].filter(Boolean).join('\n\n')` which is cleaner and extensible.
- `loadSkillsForAgent()` already returns empty string on failure (graceful fallback built into skill-loader.ts), so no try/catch needed at the call site.
- Skill count is derived by counting `## Skill:` headers in the returned content string — simple heuristic that works because skill-loader formats each skill with that header.
- Pre-existing lint script issue: `next lint` fails with path error — not related to our changes.
- TypeScript compiles cleanly with zero errors in code-agent.ts after changes.

## Task 6: PrebuiltUI GitHub Scraper (2026-01-27)

### Key Findings
- The `prebuiltui/prebuiltui` GitHub repo is very sparse - only 2 categories (`buttons`, `card`) with 1 component each
- The website (prebuiltui.com) has 360+ components across 37 categories
- Component code is embedded in `srcDoc` attributes of iframes on category pages
- Each component has a unique slug like `hero-section-with-banner-84fb` (name + 4-char hash)
- Components have `component.html` and optionally `component.jsx` files in the repo
- The playground at `play.prebuiltui.com?slug=SLUG` can be used to preview components

### Approach Taken
1. Clone repo → extract 1 component from `components/` directory (only card/blog-card had code in target categories)
2. Scrape website category pages → extract component slugs from `play.prebuiltui.com?slug=` links
3. Fetch component HTML from embedded iframes in category pages (srcDoc attribute)
4. Convert HTML to React components (class→className, self-closing tags, etc.)
5. Output 62 components across all 7 target categories

### Component Structure in Repo
```
components/
  buttons/
    glowing-button-with-hover-effect/
      button.html
      button.jsx
  card/
    blog-card-component/
      card.html
      card.jsx
```

### Output Format
Each entry in `src/data/prebuiltui-components.json` has:
- `name`: `prebuiltui-{category}-{slug}`
- `description`: Human-readable description
- `content`: React/JSX code (primary format)
- `source`: "prebuiltui"
- `category`: `component-{category-slug}`
- `metadata.htmlCode`: Original HTML
- `metadata.originalSlug`: Component slug for reference

## Task 7: Seed Skills Script + YAML Parser

### Patterns Discovered
- **ConvexHttpClient.setAdminAuth(deployKey)** enables calling internal functions from scripts. Standard `ConvexHttpClient` only supports public functions via `api.*`. For `internal.*` functions, you need `CONVEX_DEPLOY_KEY` and `setAdminAuth()`.
- **Existing script pattern**: Scripts in `scripts/` use `ConvexHttpClient` from `convex/browser`, import from `../convex/_generated/api`, and check env vars at top with `process.exit(1)` on failure.
- **gray-matter** package has bundled TypeScript types at `gray-matter.d.ts` — no `@types/gray-matter` needed.
- **skill.yaml format**: YAML frontmatter (`---` delimited) with `name` and `description` required fields, followed by markdown body. Both context7 and frontend-design skills use this format on GitHub.
- **Context7 skill URL**: Lives at `intellectronica/agent-skills/main/skills/context7/SKILL.md` (note the `skills/` subdirectory).
- **Frontend-design skill URL**: Lives at `anthropics/skills/main/skills/frontend-design/SKILL.md`.
- **PrebuiltUI data**: Already scraped to `src/data/prebuiltui-components.json` by `scripts/scrape-prebuiltui.ts`. Each entry has `name`, `description`, `content` (React code), `source: "prebuiltui"`, `category`, `metadata` with `htmlCode`, `vueCode`, `previewUrl`, `originalSlug`.
- **ESLint has pre-existing circular structure error** — not related to new code.
- **Pre-existing TS errors** in `src/lib/payment-templates/` — not related to new code.

### Key Decisions
- Used `import.meta.dir` (Bun-specific) for resolving relative paths in the seed script, consistent with Bun being the project's package manager.
- Added fallback metadata for skills that fail YAML parsing (e.g., if a skill has no frontmatter).
- Script requires `CONVEX_DEPLOY_KEY` env var since it calls `internal.skills.upsertFromGithub`.

## Task 8: Static Fallback for Core Skills

### Patterns
- skill-loader.ts uses a lazy Convex proxy singleton (same as code-agent.ts)
- Tests use `jest.resetModules()` + re-mock + dynamic `import()` to test different Convex behaviors in the same file
- Existing test failures in `agent-workflow.test.ts`, `file-operations.test.ts`, `security.test.ts`, `model-selection.test.ts` are pre-existing (reference removed `src/inngest/functions`)
- Static skill files live at `src/data/core-skills/*.md` with full YAML frontmatter + markdown body
- The `loadStaticCoreSkills()` function is exported separately for testability

### GitHub Repo Structure
- intellectronica/agent-skills: skills are under `skills/context7/SKILL.md` (not root `context7/SKILL.md`)
- anthropics/skills: skills are under `skills/frontend-design/SKILL.md`
- Both use YAML frontmatter with `name` and `description` fields

### Test Infrastructure
- Jest config at `jest.config.js`, tests in `tests/` directory (flat, not nested)
- Run tests with `npx jest <pattern>` (not `bun run test --`)
- `bun run test` script doesn't support passing args properly
- Mock files in `tests/mocks/` for convex-browser, convex-generated-api, etc.

## Task 9: WebContainer Singleton Provider

### Key Findings
- Active Next.js config is `next.config.mjs` (not `.ts` — there's a `.ts.bak` backup)
- Env file is `env.example` (not `.env.example`)
- `src/providers/` directory did not exist — had to create it
- `src/hooks/` already existed with 4 hooks (use-scroll, use-mobile, use-current-theme, use-adaptive-polling)
- `src/lib/` has 25+ files — well-established utility directory
- TypeScript path aliases (`@/`) only resolve via full project `tsc --noEmit`, not individual file checks
- Pre-existing TS errors in `src/lib/payment-templates/react.ts` — not related to our changes
- WebContainer API v1.6.1 installed successfully via bun

### Patterns Used
- Singleton with boot guard (instance + booting promise) — matches task spec exactly
- `typeof window === "undefined"` guard for SSR safety
- `useRef(false)` to prevent double-boot in React StrictMode
- Feature flag via `NEXT_PUBLIC_USE_WEBCONTAINERS` env var — checked in both singleton and provider
- COOP/COEP headers scoped to `/preview/:path*` only — avoids breaking Clerk auth popups

## Tasks 10-12: WebContainer File Ops, Process Mgmt, Build Validation (2026-01-27)

### Key patterns discovered:
- `@webcontainer/api` v1.6.1 is already installed in the project
- `FileSystemTree` uses nested `{ directory: { ... } }` and `{ file: { contents: string } }` nodes
- `WebContainerProcess.output` is a `ReadableStream<string>` — must use `.getReader()` to consume
- `WebContainerProcess.exit` is a `Promise<number>` — no callback needed
- `wc.on("server-ready", (port, url) => ...)` fires when dev server is ready — no polling needed (unlike E2B's curl loop)
- `wc.mount(tree, { mountPoint })` accepts optional mount point
- E2B `runBuildCheck()` returns `string | null` — we provide both structured `BuildCheckResult` and compat `runBuildCheckCompat()` for drop-in replacement
- `AUTO_FIX_ERROR_PATTERNS` duplicated from sandbox-utils.ts to keep modules independent (client vs server)
- Framework port/command mappings mirror sandbox-utils.ts exactly

### File locations:
- `src/lib/webcontainer-sync.ts` — convertToFileSystemTree(), mountFiles()
- `src/lib/webcontainer-process.ts` — installDependencies(), startDevServer(), killProcess()
- `src/lib/webcontainer-build.ts` — runBuildCheck(), runLintCheck(), runBuildCheckCompat(), shouldTriggerAutoFix()

### TypeScript:
- All 3 files compile cleanly with project tsconfig (0 errors from our files)
- 42 pre-existing TS errors in the project (not ours)

## Tasks 13-15: Sandbox Adapter + Integration + Documentation (2026-01-27)

### Patterns Discovered
- **Adapter pattern with instanceof checks**: The `terminal` tool in tools.ts needs E2B-specific streaming callbacks (`onStdout`/`onStderr`). Used `instanceof E2BSandboxAdapter` to access the underlying `Sandbox` for streaming, while WebContainer adapter uses non-streaming `runCommand`. This is a pragmatic compromise vs. adding streaming to the interface.
- **Lazy imports in adapter**: Used `await import()` for both E2B and WebContainer modules inside adapter methods. This prevents pulling E2B deps when using WebContainer and vice versa.
- **Legacy sandboxId backward compatibility**: The `ToolContext` keeps `sandboxId` alongside `adapter` because `runErrorFix` reconnects to existing E2B sandboxes by ID. The adapter is optional in ToolContext.
- **Pre-existing test failures**: 4 test suites (model-selection, file-operations, security, agent-workflow) were already failing before changes. All failures are due to stale imports from the Inngest migration or mock setup issues.

### Successful Approaches
- Python script for targeted multi-line replacements in code-agent.ts — more reliable than sed for complex multi-line patterns
- Running `git stash` + test + `git stash pop` to verify pre-existing failures
- 21 comprehensive adapter tests covering both implementations, factory, and interface contract
