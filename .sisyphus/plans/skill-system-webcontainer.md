# Skill System + WebContainer Migration

## Context

### Original Request
Build a backend skill system where AI agents can leverage skills (skills.sh compatible), integrate PrebuiltUI.com components as skills, and migrate from E2B sandboxes to WebContainers for client-side preview and build validation.

### Interview Summary
**Key Discussions**:
- Skills are **prompt augmentation** (not tool plugins) — markdown instructions injected into agent system prompts
- **skills.sh format** compatible — skill.yaml with YAML frontmatter + markdown body
- Two core skills **baked into codebase**: `context7` (intellectronica/agent-skills) and `frontend-design` (anthropics/skills)
- WebContainer migration: **Hybrid Option C** — agent stays server-side, WebContainer is client-side preview engine + build validator
- PrebuiltUI: **GitHub scrape** of prebuiltui/prebuiltui repo, store components in Convex
- **Parallel tracks**: Skills and WebContainer developed independently
- **TDD** with existing Jest infrastructure

**Research Findings**:
- E2B sandbox usage mapped across 12 files — primary surface in `sandbox-utils.ts` (499 lines), `code-agent.ts` (1378 lines), `tools.ts` (189 lines)
- WebContainer API: `boot()`, `fs.writeFile/readFile`, `spawn()`, `on('server-ready')`. Requires COOP/COEP headers. Browser-only.
- skills.sh ecosystem: 27K+ installs, skill.yaml format, `npx skills add <owner/repo>` CLI
- PrebuiltUI: 360+ components, 36 categories, HTML/React/Vue formats, open source GitHub repo

### Gap Analysis (Self-Review)
**Identified Gaps** (addressed in guardrails):
- COOP/COEP headers can break third-party auth (Clerk) popups → scope to preview routes only
- WebContainer browser compatibility (Safari limited) → keep E2B as feature-flagged fallback
- Skill token budget → cap at 4000 tokens per skill injection
- claude-code-tools.ts also uses sandbox → included in migration surface
- PrebuiltUI is HTML/React/Vue code, not skill.yaml → conversion layer needed

---

## Work Objectives

### Core Objective
Enable ZapDev agents to leverage a skills.sh-compatible skill ecosystem for enhanced code generation, with PrebuiltUI components as a first-party skill source, while modernizing the execution environment from server-side E2B to client-side WebContainers.

### Concrete Deliverables
- **Track A (Skills)**: Convex skill tables, tRPC skill API, skill parser, prompt injection, PrebuiltUI ingestion script, baked-in core skills
- **Track B (WebContainer)**: WebContainer singleton provider, file mounting from SSE, client-side build validation, scoped COOP/COEP headers, feature-flag for E2B fallback

### Definition of Done
- [ ] Core skills (context7 + frontend-design) are injected into every agent run
- [ ] Skills stored in Convex and queryable via tRPC
- [ ] PrebuiltUI components stored as skills in Convex
- [ ] WebContainer boots in browser and displays live preview of generated code
- [ ] Build validation (`npm run build`) runs in WebContainer
- [ ] E2B still works as feature-flagged fallback
- [ ] All new code has TDD test coverage

### Must Have
- skills.sh format compatibility (skill.yaml parsing)
- Core skills always injected (context7, frontend-design)
- WebContainer preview rendering generated files
- Client-side build validation
- E2B fallback behind feature flag
- Type-safe throughout (Convex validators, tRPC types, TypeScript strict)

### Must NOT Have (Guardrails)
- Do NOT apply COOP/COEP headers globally — scope to preview/WebContainer routes only
- Do NOT remove E2B code — keep as fallback behind `NEXT_PUBLIC_USE_WEBCONTAINERS` flag
- Do NOT allow user skills to override core skills (context7, frontend-design)
- Do NOT inject skills exceeding 4000 tokens per skill into prompts
- Do NOT create a separate CLI package — core skills are baked into the codebase
- Do NOT scrape PrebuiltUI via web scraping — use GitHub repo clone only
- Do NOT modify existing Convex schema fields — only ADD new tables
- Do NOT break existing agent functionality during migration
- Do NOT start Convex dev server without user permission (per AGENTS.md)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (`tests/` directory, Jest config, `tests/mocks/`)
- **User wants tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Jest with existing mock infrastructure

### TDD Approach
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

Test commands:
```bash
bun run test            # Run all tests
bun run test -- --watch # Watch mode
```

---

## Task Flow

```
TRACK A (Skills):      1 → 2 → 3 → 4 → 5 → 6 → 7
                              ↘ 8 (parallel with 3)
TRACK B (WebContainer): 9 → 10 → 11 → 12 → 13 → 14
INTEGRATION:           15 (depends on A + B both complete)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A-Core | 1, 9 | Independent tracks start simultaneously |
| A-Schema+Parse | 2, 8 | Schema and parser are independent |
| A-Sequential | 3, 4, 5, 6, 7 | Each builds on previous |
| B-Sequential | 10, 11, 12, 13, 14 | Each builds on previous |
| Final | 15 | Depends on both tracks |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Needs Convex schema from task 1 |
| 3 | 2 | Needs skill CRUD mutations |
| 4 | 3 | Needs skills in DB to query |
| 5 | 4 | Needs skill content to inject |
| 6 | 5 | Needs injection working to test with PrebuiltUI |
| 7 | 6 | Needs PrebuiltUI skills to validate |
| 8 | 1 | Needs schema types but independent of CRUD |
| 10 | 9 | Needs WebContainer provider |
| 11 | 10 | Needs file mounting working |
| 12 | 11 | Needs process spawning |
| 13 | 12 | Needs build to work in WC |
| 14 | 13 | Needs full WC pipeline |
| 15 | 7, 14 | Needs both tracks complete |

---

## TODOs

### TRACK A: SKILL SYSTEM

---

- [ ] 1. Convex Schema for Skills

  **What to do**:
  - Add new tables to `convex/schema.ts`: `skills`, `skillInstallations`
  - `skills` table stores skill metadata and content
  - `skillInstallations` table tracks which skills are active per project/user
  - Define enums: `skillSourceEnum` (github, prebuiltui, custom), `skillStatusEnum` (active, disabled, draft)
  - Add proper indexes for querying by userId, category, source, name

  **Schema Design**:
  ```
  skills:
    name: v.string()               // e.g., "frontend-design"
    slug: v.string()               // URL-safe identifier
    description: v.string()        // From skill.yaml frontmatter
    content: v.string()            // Full markdown body (the actual instructions)
    source: skillSourceEnum        // "github" | "prebuiltui" | "custom"
    sourceRepo: v.optional(v.string())  // e.g., "anthropics/skills"
    sourceUrl: v.optional(v.string())   // Full URL
    category: v.optional(v.string())    // e.g., "design", "framework", "component"
    framework: v.optional(frameworkEnum) // If framework-specific
    isGlobal: v.boolean()          // Global (curated) vs user-created
    isCore: v.boolean()            // Core skills always injected (context7, frontend-design)
    userId: v.optional(v.string()) // null for global skills
    version: v.optional(v.string())
    tokenCount: v.optional(v.number()) // Estimated token count for budget
    metadata: v.optional(v.any())  // Extra data (PrebuiltUI: component variants, preview URL)
    createdAt: v.number()
    updatedAt: v.number()

  Indexes:
    by_slug: ["slug"]
    by_source: ["source"]
    by_userId: ["userId"]
    by_isGlobal: ["isGlobal"]
    by_isCore: ["isCore"]
    by_category: ["category"]
    by_name: ["name"]

  skillInstallations:
    skillId: v.id("skills")
    projectId: v.optional(v.id("projects"))
    userId: v.string()
    isActive: v.boolean()
    createdAt: v.number()

  Indexes:
    by_userId: ["userId"]
    by_projectId: ["projectId"]
    by_skillId_userId: ["skillId", "userId"]
  ```

  **Must NOT do**:
  - Do NOT modify existing tables
  - Do NOT use `.filter()` — use indexes
  - Do NOT use `v.any()` for typed fields (only for truly dynamic metadata)

  **Parallelizable**: YES (with task 9 — different track)

  **References** (CRITICAL):
  
  **Pattern References**:
  - `convex/schema.ts:101-340` — Follow exact naming conventions: camelCase fields, `v.number()` timestamps, `v.union(v.literal())` enums, `"by_fieldName"` index names
  - `convex/schema.ts:4-10` — Enum definition pattern using `v.union(v.literal())`
  - `convex/schema.ts:93-99` — Table definition pattern with `.index()` chaining

  **API/Type References**:
  - `convex/schema.ts:4` — `frameworkEnum` type to reuse for framework-specific skills

  **Documentation References**:
  - `.cursor/rules/convex_rules.mdc` — FULL Convex conventions (validators, indexes, function syntax)

  **Acceptance Criteria**:
  - [ ] Test: Create a test that validates skill schema types compile correctly
  - [ ] `convex/schema.ts` contains `skills` and `skillInstallations` table definitions
  - [ ] All indexes follow `"by_fieldName"` convention
  - [ ] Enums `skillSourceEnum` and `skillStatusEnum` defined at file top
  - [ ] TypeScript compiles: `bun run build` (or at minimum `npx tsc --noEmit`)
  - [ ] No existing tables modified

  **Commit**: YES
  - Message: `feat(convex): add skills and skillInstallations schema tables`
  - Files: `convex/schema.ts`
  - Pre-commit: `bun run lint`

---

- [ ] 2. Convex Skill CRUD Functions

  **What to do**:
  - Create `convex/skills.ts` with queries and mutations for skill management
  - Public queries: `list`, `getBySlug`, `getByCategory`, `getCoreSkills`, `search`
  - Public mutations: `create`, `update`, `remove`
  - Internal queries: `getForSystem` (no auth required, for agent use), `getCoreSkillContents`
  - Internal mutations: `upsertFromGithub` (for scraping/import), `seedCoreSkills`
  - All functions MUST use `requireAuth(ctx)` for public functions
  - Use index-based queries, NEVER `.filter()`

  **Must NOT do**:
  - Do NOT allow deletion of core skills (isCore: true)
  - Do NOT allow users to modify global skills
  - Do NOT expose internal functions publicly

  **Parallelizable**: NO (depends on task 1)

  **References**:

  **Pattern References**:
  - `convex/projects.ts` — Query/mutation patterns with `requireAuth`, `withIndex`, error handling
  - `convex/helpers.ts` — `requireAuth(ctx)` authentication pattern
  - `convex/messages.ts` — CRUD pattern with projectId/userId relationships, index usage
  - `convex/sandboxSessions.ts` — State management patterns (create, update, getBy*)

  **API/Type References**:
  - `convex/schema.ts` — `skills` table definition (from task 1)
  - `convex/_generated/api` — For `internal` function references
  - `convex/_generated/dataModel` — For `Doc<"skills">`, `Id<"skills">` types

  **Documentation References**:
  - `.cursor/rules/convex_rules.mdc` — Function syntax with `args`, `returns`, `handler`. MUST include return validators.

  **Acceptance Criteria**:
  - [ ] Test: `tests/convex/skills.test.ts` with mocked Convex context
  - [ ] `convex/skills.ts` contains all CRUD operations
  - [ ] Public functions use `requireAuth(ctx)`
  - [ ] All queries use `withIndex()`, not `.filter()`
  - [ ] Core skills cannot be deleted (throws error)
  - [ ] All functions have `args` and `returns` validators
  - [ ] `bun run lint` passes

  **Commit**: YES
  - Message: `feat(convex): add skill CRUD queries and mutations`
  - Files: `convex/skills.ts`, `tests/convex/skills.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 3. tRPC Skills Router

  **What to do**:
  - Create `src/modules/skills/server/procedures.ts` with tRPC router
  - Procedures: `list`, `getBySlug`, `search`, `getCategories`, `create` (user skills), `update`, `remove`
  - Register in `src/trpc/routers/_app.ts`
  - Use `protectedProcedure` for all endpoints
  - Input validation with Zod schemas
  - Call Convex functions via the Convex client

  **Must NOT do**:
  - Do NOT expose internal Convex functions via tRPC
  - Do NOT allow creating skills with `isCore: true` via API
  - Do NOT duplicate business logic — tRPC procedures should be thin wrappers around Convex

  **Parallelizable**: NO (depends on task 2)

  **References**:

  **Pattern References**:
  - `src/modules/sandbox/server/procedures.ts` — tRPC router pattern with protectedProcedure, Convex integration
  - `src/trpc/init.ts:25-44` — `protectedProcedure` definition, auth middleware pattern
  - `src/trpc/routers/_app.ts:1-15` — Router composition pattern

  **API/Type References**:
  - `src/trpc/init.ts` — `createTRPCRouter`, `protectedProcedure` exports
  - `convex/skills.ts` — Convex function references (from task 2)

  **Acceptance Criteria**:
  - [ ] Test: `tests/modules/skills/procedures.test.ts`
  - [ ] `src/modules/skills/server/procedures.ts` exists with all procedures
  - [ ] `src/trpc/routers/_app.ts` includes `skills: skillsRouter`
  - [ ] All procedures use `protectedProcedure`
  - [ ] Zod validation on all inputs
  - [ ] `bun run lint` passes

  **Commit**: YES
  - Message: `feat(trpc): add skills router with CRUD procedures`
  - Files: `src/modules/skills/server/procedures.ts`, `src/trpc/routers/_app.ts`, `tests/modules/skills/procedures.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 4. Skill Content Loader for Agents

  **What to do**:
  - Create `src/agents/skill-loader.ts` — module that loads skill content for agent prompt injection
  - Function `loadSkillsForAgent(projectId, userId)`: returns combined skill content string
  - Always loads core skills (isCore: true) from Convex
  - Optionally loads project-specific installed skills
  - Enforces token budget: max 4000 tokens per skill, max 12000 total
  - Returns formatted string ready for prompt injection
  - Caches loaded skills for the session duration (Map-based, like existing sandbox cache)

  **Token Budget Logic**:
  ```
  1. Load core skills (always) — context7, frontend-design
  2. Load project-installed skills (if any)
  3. For each skill, estimate tokens (content.length / 4)
  4. Truncate individual skills at 4000 tokens
  5. Truncate total at 12000 tokens
  6. Format as: "## Skill: {name}\n{content}\n---"
  ```

  **Must NOT do**:
  - Do NOT call Convex from client-side (this runs server-side in code-agent.ts)
  - Do NOT include skill metadata in prompt — only the markdown instruction content
  - Do NOT make network calls for every generation — use caching

  **Parallelizable**: NO (depends on task 2 for Convex functions)

  **References**:

  **Pattern References**:
  - `src/agents/code-agent.ts:60-76` — ConvexHttpClient proxy pattern for server-side Convex access
  - `src/agents/code-agent.ts:184-213` — `detectFramework()` pattern with caching (use same pattern for skill loading)
  - `src/lib/cache.ts` — `cache.getOrCompute()` utility for TTL-based caching

  **API/Type References**:
  - `convex/skills.ts` — `getCoreSkillContents` internal query (from task 2)
  - `src/agents/types.ts:6-12` — `AgentState` interface (may need extending)

  **Acceptance Criteria**:
  - [ ] Test: `tests/agents/skill-loader.test.ts` with mocked Convex
  - [ ] `src/agents/skill-loader.ts` exports `loadSkillsForAgent()`
  - [ ] Core skills always returned regardless of project/user
  - [ ] Token budget enforced (individual 4000, total 12000)
  - [ ] Results cached with TTL (30 minutes, like framework cache)
  - [ ] Empty string returned if no skills found (does not break agent)
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `feat(agents): add skill content loader with token budgeting`
  - Files: `src/agents/skill-loader.ts`, `tests/agents/skill-loader.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 5. Agent Prompt Integration

  **What to do**:
  - Modify `src/agents/code-agent.ts` to inject loaded skills into the system prompt
  - Call `loadSkillsForAgent()` early in `runCodeAgent()` (after project load, parallel with framework detection)
  - Compose final prompt: `frameworkPrompt + databaseIntegrationRules + skillContent`
  - Add `"skill-loaded"` StreamEvent type for UI feedback
  - Update `StreamEvent` type union to include new event

  **Integration Point** (code-agent.ts ~line 644-651):
  ```
  // CURRENT:
  const systemPrompt = databaseIntegrationRules
    ? `${frameworkPrompt}\n${databaseIntegrationRules}`
    : frameworkPrompt;

  // NEW:
  const skillContent = await loadSkillsForAgent(projectId, project.userId);
  const systemPrompt = [frameworkPrompt, databaseIntegrationRules, skillContent]
    .filter(Boolean)
    .join('\n\n');
  ```

  **Must NOT do**:
  - Do NOT change the agent's tool definitions
  - Do NOT make skill loading blocking if it fails — fallback to empty string
  - Do NOT change the agent's streaming behavior
  - Do NOT increase MAX_AGENT_ITERATIONS

  **Parallelizable**: NO (depends on task 4)

  **References**:

  **Pattern References**:
  - `src/agents/code-agent.ts:644-651` — Current prompt composition (EXACT integration point)
  - `src/agents/code-agent.ts:286-303` — StreamEvent type definition (add new type)
  - `src/agents/code-agent.ts:411-416` — Parallel Promise.all pattern (load skills in parallel with sandbox creation)

  **API/Type References**:
  - `src/agents/skill-loader.ts` — `loadSkillsForAgent()` (from task 4)
  - `src/agents/code-agent.ts:286` — `StreamEvent` type to extend

  **Acceptance Criteria**:
  - [ ] Test: Update `tests/agents/code-agent.test.ts` to verify skill injection
  - [ ] Skills are injected into system prompt for every agent run
  - [ ] Skill loading failure does NOT break agent (graceful fallback)
  - [ ] New `"skill-loaded"` event yielded with skill names
  - [ ] Skill loading runs in parallel with sandbox creation (Promise.all)
  - [ ] `bun run test` passes
  - [ ] `bun run lint` passes

  **Commit**: YES
  - Message: `feat(agents): inject skill content into agent system prompts`
  - Files: `src/agents/code-agent.ts`, `tests/agents/code-agent.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 6. PrebuiltUI GitHub Scraper

  **What to do**:
  - Create `scripts/scrape-prebuiltui.ts` — standalone script to clone and parse PrebuiltUI repo
  - Clone `prebuiltui/prebuiltui` GitHub repo (or use GitHub API)
  - Parse component directories to extract: category, name, HTML/React/Vue code, description
  - Convert each component to skill.yaml-compatible format
  - Output: JSON file at `src/data/prebuiltui-components.json`
  - Each component becomes a skill entry ready for Convex seeding

  **Component-to-Skill Conversion**:
  ```
  PrebuiltUI component → skill entry:
    name: "prebuiltui-{category}-{slug}"
    description: "PrebuiltUI {title} component for Tailwind CSS"
    content: React code (primary format for ZapDev)
    source: "prebuiltui"
    category: "component-{prebuiltui-category}"
    framework: null (Tailwind CSS is framework-agnostic)
    isGlobal: true
    isCore: false
    metadata: { htmlCode, vueCode, previewUrl, originalSlug }
  ```

  **Must NOT do**:
  - Do NOT scrape the website — use GitHub repo ONLY
  - Do NOT include all 360+ components initially — start with top categories (Hero, Navbar, Card, CTA, Footer, Form, Feature Sections)
  - Do NOT embed component code directly into Convex mutations — use JSON intermediate file

  **Parallelizable**: YES (with task 3, independent work)

  **References**:

  **Pattern References**:
  - PrebuiltUI GitHub repo structure: `prebuiltui/prebuiltui` — examine component directory layout
  - `scripts/` directory pattern — ZapDev already has script utilities

  **External References**:
  - `https://github.com/prebuiltui/prebuiltui` — Source repo to scrape
  - `https://prebuiltui.com/components/about` — Category/component structure reference

  **Acceptance Criteria**:
  - [ ] Test: `tests/scripts/scrape-prebuiltui.test.ts` validating parser output format
  - [ ] `scripts/scrape-prebuiltui.ts` runs with `bun run scripts/scrape-prebuiltui.ts`
  - [ ] Outputs `src/data/prebuiltui-components.json` with valid skill entries
  - [ ] At least 50 components from top 7 categories parsed
  - [ ] Each entry has: name, description, content (React), source, category
  - [ ] Script handles missing/malformed components gracefully (skip, don't crash)

  **Commit**: YES
  - Message: `feat(scripts): add PrebuiltUI GitHub scraper and component parser`
  - Files: `scripts/scrape-prebuiltui.ts`, `src/data/prebuiltui-components.json`, `tests/scripts/scrape-prebuiltui.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 7. Seed Core Skills + PrebuiltUI into Convex

  **What to do**:
  - Create `scripts/seed-skills.ts` — seeds core skills and PrebuiltUI components into Convex
  - Fetch content from `intellectronica/agent-skills/context7` skill.yaml
  - Fetch content from `anthropics/skills/frontend-design` skill.yaml
  - Parse skill.yaml files (YAML frontmatter + markdown body)
  - Load PrebuiltUI components from `src/data/prebuiltui-components.json`
  - Upsert all into Convex via `internal.skills.upsertFromGithub` mutation
  - Create `src/lib/skill-yaml-parser.ts` for parsing skill.yaml format

  **skill.yaml Format**:
  ```yaml
  ---
  name: my-skill
  description: What this skill does
  ---
  # Skill Instructions
  Markdown body with agent instructions...
  ```

  **Must NOT do**:
  - Do NOT hardcode skill content in source — fetch from GitHub at seed time
  - Do NOT run this script automatically — it's a manual operation
  - Do NOT overwrite user-modified skills (upsert by slug, check isGlobal)

  **Parallelizable**: NO (depends on tasks 2, 6)

  **References**:

  **Pattern References**:
  - `convex/skills.ts` — `upsertFromGithub` internal mutation (from task 2)
  - skills.sh skill.yaml format specification (from research)

  **External References**:
  - `https://github.com/intellectronica/agent-skills` — context7 skill source
  - `https://github.com/anthropics/skills` — frontend-design skill source
  - `https://skills.sh/docs/cli` — skill.yaml format reference

  **Acceptance Criteria**:
  - [ ] Test: `tests/scripts/seed-skills.test.ts` with mocked Convex client
  - [ ] Test: `tests/lib/skill-yaml-parser.test.ts` validating YAML+markdown parsing
  - [ ] `scripts/seed-skills.ts` runs with `bun run scripts/seed-skills.ts`
  - [ ] Core skills (context7, frontend-design) seeded with `isCore: true`
  - [ ] PrebuiltUI components seeded with `source: "prebuiltui"`, `isGlobal: true`
  - [ ] `src/lib/skill-yaml-parser.ts` correctly parses skill.yaml format
  - [ ] Idempotent — running twice doesn't create duplicates

  **Commit**: YES
  - Message: `feat(scripts): add skill seeding script with skill.yaml parser`
  - Files: `scripts/seed-skills.ts`, `src/lib/skill-yaml-parser.ts`, `tests/scripts/seed-skills.test.ts`, `tests/lib/skill-yaml-parser.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 8. Bake Core Skill Content into Source (Static Fallback)

  **What to do**:
  - Create `src/data/core-skills/context7.md` — static copy of context7 skill content
  - Create `src/data/core-skills/frontend-design.md` — static copy of frontend-design skill content
  - Update `src/agents/skill-loader.ts` to use static fallback if Convex query fails
  - This ensures core skills work even if Convex is unreachable or skills aren't seeded

  **Fallback Logic**:
  ```
  1. Try loading from Convex (getCoreSkillContents)
  2. If Convex fails or returns empty → load from src/data/core-skills/*.md
  3. Never fail — always return at least the static content
  ```

  **Must NOT do**:
  - Do NOT make static files the primary source — Convex is primary, static is fallback
  - Do NOT auto-update static files — they're manually refreshed

  **Parallelizable**: YES (with task 3 — only needs schema from task 1)

  **References**:

  **Pattern References**:
  - `src/agents/skill-loader.ts` — Loader module (from task 4)
  - `src/lib/payment-templates.ts` — Pattern for static template data baked into source

  **External References**:
  - `https://skills.sh/intellectronica/agent-skills/context7` — context7 skill content
  - `https://skills.sh/anthropics/skills/frontend-design` — frontend-design skill content

  **Acceptance Criteria**:
  - [ ] Test: Update `tests/agents/skill-loader.test.ts` to verify fallback behavior
  - [ ] `src/data/core-skills/context7.md` contains valid skill instructions
  - [ ] `src/data/core-skills/frontend-design.md` contains valid skill instructions
  - [ ] Skill loader returns static content when Convex fails
  - [ ] Static content is valid markdown instructions
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `feat(data): bake core skill content as static fallback`
  - Files: `src/data/core-skills/context7.md`, `src/data/core-skills/frontend-design.md`, `src/agents/skill-loader.ts`, `tests/agents/skill-loader.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

### TRACK B: WEBCONTAINER MIGRATION

---

- [ ] 9. WebContainer Singleton Provider

  **What to do**:
  - Install `@webcontainer/api` package: `bun add @webcontainer/api`
  - Create `src/lib/webcontainer.ts` — singleton WebContainer boot with lazy initialization
  - Create `src/hooks/use-webcontainer.ts` — React hook for WebContainer access
  - Create `src/providers/webcontainer-provider.tsx` — React context provider
  - Add COOP/COEP headers to Next.js config (scoped to preview routes)
  - Add `NEXT_PUBLIC_USE_WEBCONTAINERS` environment variable for feature flag

  **Singleton Pattern**:
  ```typescript
  let instance: WebContainer | null = null;
  let booting: Promise<WebContainer> | null = null;

  export async function getWebContainer(): Promise<WebContainer> {
    if (instance) return instance;
    if (booting) return booting;
    booting = WebContainer.boot();
    instance = await booting;
    booting = null;
    return instance;
  }
  ```

  **COOP/COEP Headers** (next.config.ts):
  ```
  Only apply to routes under /preview/* or routes that render WebContainer iframe
  Do NOT apply globally — breaks Clerk auth popups and third-party embeds
  ```

  **Must NOT do**:
  - Do NOT call WebContainer.boot() on server-side — browser only
  - Do NOT apply COOP/COEP headers to auth routes (/sign-in, /sign-up)
  - Do NOT remove E2B dependencies yet

  **Parallelizable**: YES (with task 1 — different track)

  **References**:

  **Pattern References**:
  - `src/agents/sandbox-utils.ts:4-12` — SANDBOX_CACHE singleton pattern (similar concept, client-side version)
  - `src/providers/` — Existing provider patterns in the codebase

  **External References**:
  - WebContainer API docs: `https://webcontainers.io/guides/quickstart`
  - COOP/COEP headers: `https://webcontainers.io/guides/configuring-headers`
  - React hook pattern: `https://github.com/nicholasgriffintn/bolt.diy/blob/main/app/lib/webcontainer/index.ts` (reference)

  **Acceptance Criteria**:
  - [ ] Test: `tests/lib/webcontainer.test.ts` (mock WebContainer.boot)
  - [ ] `bun add @webcontainer/api` installed
  - [ ] `src/lib/webcontainer.ts` exports `getWebContainer()` singleton
  - [ ] `src/hooks/use-webcontainer.ts` exports `useWebContainer()` hook
  - [ ] `src/providers/webcontainer-provider.tsx` provides context
  - [ ] COOP/COEP headers added to `next.config.ts` (scoped to preview routes)
  - [ ] `NEXT_PUBLIC_USE_WEBCONTAINERS` env variable documented in `env.example`
  - [ ] Feature flag checked: if false, skip WebContainer initialization

  **Commit**: YES
  - Message: `feat(webcontainer): add singleton provider, hook, and scoped COOP/COEP headers`
  - Files: `src/lib/webcontainer.ts`, `src/hooks/use-webcontainer.ts`, `src/providers/webcontainer-provider.tsx`, `next.config.ts`, `env.example`, `tests/lib/webcontainer.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 10. WebContainer File Mounting from SSE Stream

  **What to do**:
  - Create `src/lib/webcontainer-sync.ts` — converts agent file output to WebContainer FileSystemTree
  - Listen for SSE `files` events (already emitted by code-agent.ts)
  - Convert `Record<string, string>` (agent output format) to `FileSystemTree` format
  - Mount files into WebContainer: `webcontainer.mount(fileSystemTree)`
  - Handle incremental file updates (re-mount changed files only)
  - Integrate with existing SSE event handling in the client

  **FileSystemTree Conversion**:
  ```
  Agent output: { "src/app/page.tsx": "content...", "src/lib/utils.ts": "content..." }
  WebContainer: { src: { directory: { app: { directory: { "page.tsx": { file: { contents: "content..." } } } } } } }
  ```

  **Must NOT do**:
  - Do NOT modify code-agent.ts for this — consume existing SSE events
  - Do NOT mount node_modules — let WebContainer install packages itself
  - Do NOT block on mount — fire and forget, let WebContainer process

  **Parallelizable**: NO (depends on task 9)

  **References**:

  **Pattern References**:
  - `src/agents/code-agent.ts:1005` — `yield { type: "files", data: state.files }` — EXACT event to consume
  - `src/agents/code-agent.ts:286-303` — StreamEvent types for understanding event format

  **External References**:
  - WebContainer FileSystemTree: `https://webcontainers.io/guides/working-with-the-file-system`
  - Mount API: `webcontainer.mount(fileSystemTree)` — mounts entire file tree

  **Acceptance Criteria**:
  - [ ] Test: `tests/lib/webcontainer-sync.test.ts` validating file tree conversion
  - [ ] `src/lib/webcontainer-sync.ts` exports `convertToFileSystemTree()` and `mountFiles()`
  - [ ] Correctly converts flat path map to nested FileSystemTree
  - [ ] Handles deeply nested paths (`src/app/api/auth/route.ts`)
  - [ ] Handles path edge cases (leading slashes, `/home/user/` prefix stripping)
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `feat(webcontainer): add file system tree conversion and mounting`
  - Files: `src/lib/webcontainer-sync.ts`, `tests/lib/webcontainer-sync.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 11. WebContainer Process Spawning + Dev Server

  **What to do**:
  - Create `src/lib/webcontainer-process.ts` — process management for WebContainer
  - Implement `installDependencies(wc)`: spawn `npm install` and await completion
  - Implement `startDevServer(wc, framework)`: spawn framework-specific dev command
  - Listen for `server-ready` event to get preview URL
  - Stream process output to UI (stdout/stderr)
  - Handle process errors and restarts

  **Dev Server Flow**:
  ```
  1. Files mounted (from task 10)
  2. Run npm install
  3. Start dev server (npm run dev)
  4. Listen for server-ready event
  5. Return preview URL (WebContainer provides it)
  ```

  **Must NOT do**:
  - Do NOT use E2B port mapping — WebContainer provides its own URLs
  - Do NOT start dev servers for build-only operations
  - Do NOT keep zombie processes — clean up on unmount

  **Parallelizable**: NO (depends on task 10)

  **References**:

  **Pattern References**:
  - `src/agents/sandbox-utils.ts:461-498` — `startDevServer()` E2B version (replicate logic for WebContainer)
  - `src/agents/sandbox-utils.ts:321-330` — `getFrameworkPort()` and `getDevServerCommand()` (reuse these)

  **External References**:
  - WebContainer spawn: `https://webcontainers.io/guides/running-processes`
  - Process output piping: `process.output.pipeTo(new WritableStream({...}))`
  - Server-ready event: `webcontainer.on('server-ready', (port, url) => {...})`

  **Acceptance Criteria**:
  - [ ] Test: `tests/lib/webcontainer-process.test.ts` with mocked WebContainer
  - [ ] `src/lib/webcontainer-process.ts` exports `installDependencies()`, `startDevServer()`, `spawnProcess()`
  - [ ] npm install completes before dev server starts
  - [ ] Preview URL captured from `server-ready` event
  - [ ] Process cleanup on React component unmount
  - [ ] Framework-specific dev commands supported (all 5 frameworks)
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `feat(webcontainer): add process spawning, npm install, and dev server management`
  - Files: `src/lib/webcontainer-process.ts`, `tests/lib/webcontainer-process.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 12. Client-Side Build Validation in WebContainer

  **What to do**:
  - Create `src/lib/webcontainer-build.ts` — build validation via WebContainer
  - Implement `runBuildCheck(wc)`: spawn `npm run build`, capture output, parse errors
  - Implement `runLintCheck(wc)`: spawn `npm run lint`, capture output
  - Return structured error output compatible with existing auto-fix loop
  - Parse build errors into format code-agent.ts expects for auto-fix

  **Build Validation Flow**:
  ```
  1. Agent generates files (server-side)
  2. Files mounted in WebContainer (client-side, from task 10)
  3. npm install runs (from task 11)
  4. npm run build runs in WebContainer
  5. Errors captured and sent back to server via API call
  6. Server feeds errors to agent auto-fix loop
  ```

  **Client → Server Error Reporting**:
  - POST `/api/agent/build-errors` with `{ projectId, errors: string }`
  - Agent auto-fix loop picks up errors for next iteration

  **Must NOT do**:
  - Do NOT remove server-side build check yet — this runs in parallel initially
  - Do NOT change auto-fix retry count
  - Do NOT expose build output to unauthorized users

  **Parallelizable**: NO (depends on task 11)

  **References**:

  **Pattern References**:
  - `src/agents/sandbox-utils.ts:236-262` — `runBuildCheck()` E2B version (replicate return format)
  - `src/agents/code-agent.ts:909-1003` — Auto-fix loop that consumes build errors (the consumer of this output)
  - `src/agents/sandbox-utils.ts:432-441` — `AUTO_FIX_ERROR_PATTERNS` and `shouldTriggerAutoFix()` (error format to match)

  **Acceptance Criteria**:
  - [ ] Test: `tests/lib/webcontainer-build.test.ts` with mocked WebContainer
  - [ ] `src/lib/webcontainer-build.ts` exports `runBuildCheck()`, `runLintCheck()`
  - [ ] Build errors returned in same format as E2B `runBuildCheck()` (string or null)
  - [ ] Error patterns match `AUTO_FIX_ERROR_PATTERNS` regex
  - [ ] Build timeout of 120 seconds (matching E2B timeout)
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `feat(webcontainer): add client-side build and lint validation`
  - Files: `src/lib/webcontainer-build.ts`, `tests/lib/webcontainer-build.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 13. Feature Flag + Sandbox Abstraction Layer

  **What to do**:
  - Create `src/lib/sandbox-adapter.ts` — abstraction layer over E2B and WebContainer
  - Interface: `ISandboxAdapter` with methods matching current E2B usage
  - Two implementations: `E2BSandboxAdapter` (wraps existing), `WebContainerAdapter` (new)
  - Factory: `createSandboxAdapter(framework, options)` — checks feature flag
  - Update `src/agents/code-agent.ts` to use adapter instead of direct E2B calls
  - Environment variable: `NEXT_PUBLIC_USE_WEBCONTAINERS=true|false`

  **Adapter Interface**:
  ```typescript
  interface ISandboxAdapter {
    id: string;
    writeFiles(files: Record<string, string>): Promise<void>;
    readFile(path: string): Promise<string | null>;
    runCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    startDevServer(framework: Framework): Promise<string>; // returns URL
    runBuildCheck(): Promise<string | null>; // returns errors or null
    getPreviewUrl(framework: Framework): Promise<string>;
    cleanup(): Promise<void>;
  }
  ```

  **Must NOT do**:
  - Do NOT remove E2B code — it stays as the default for now
  - Do NOT change the agent's external API (StreamEvent types, SSE format)
  - Do NOT force WebContainers — always respect feature flag

  **Parallelizable**: NO (depends on task 12)

  **References**:

  **Pattern References**:
  - `src/agents/sandbox-utils.ts` — ALL functions to abstract (createSandbox, getSandbox, writeFilesBatch, readFileFast, runBuildCheck, startDevServer, getSandboxUrl)
  - `src/agents/tools.ts:24-188` — Tool functions that call sandbox operations (must use adapter)
  - `src/agents/code-agent.ts` — Agent that creates and uses sandbox

  **Acceptance Criteria**:
  - [ ] Test: `tests/lib/sandbox-adapter.test.ts` testing both implementations
  - [ ] `ISandboxAdapter` interface defined with all necessary methods
  - [ ] `E2BSandboxAdapter` wraps existing sandbox-utils functions (no behavior change)
  - [ ] `WebContainerAdapter` delegates to webcontainer-*.ts modules
  - [ ] Feature flag `NEXT_PUBLIC_USE_WEBCONTAINERS` controls which adapter is created
  - [ ] When flag is false, E2B is used (existing behavior, zero regression)
  - [ ] `bun run test` passes
  - [ ] `bun run build` passes

  **Commit**: YES
  - Message: `feat(sandbox): add abstraction layer with E2B and WebContainer adapters`
  - Files: `src/lib/sandbox-adapter.ts`, `tests/lib/sandbox-adapter.test.ts`
  - Pre-commit: `bun run test && bun run lint`

---

- [ ] 14. Integrate Sandbox Adapter into Agent Pipeline

  **What to do**:
  - Update `src/agents/code-agent.ts` to use `ISandboxAdapter` instead of direct E2B calls
  - Update `src/agents/tools.ts` to accept adapter instead of sandboxId
  - Update `src/agents/sandbox-utils.ts` — keep existing functions, add adapter factory export
  - Update `ToolContext` interface to use adapter
  - Verify all existing E2B flows still work with adapter wrapping
  - Update `src/app/api/cron/cleanup-sandboxes/route.ts` for dual cleanup

  **Key Changes in code-agent.ts**:
  ```
  // BEFORE: const sandbox = await createSandbox(detectedFramework);
  // AFTER:  const adapter = await createSandboxAdapter(detectedFramework, { useWebContainers: flag });

  // BEFORE: tools use sandboxId to get sandbox
  // AFTER:  tools receive adapter directly
  ```

  **Must NOT do**:
  - Do NOT break existing tests
  - Do NOT change SSE event format
  - Do NOT remove sandboxSessions database operations (still needed for E2B fallback)

  **Parallelizable**: NO (depends on task 13)

  **References**:

  **Pattern References**:
  - `src/agents/code-agent.ts:410-416` — Sandbox creation point (change here)
  - `src/agents/code-agent.ts:603-636` — Tool creation with sandbox context (change here)
  - `src/agents/tools.ts:15-22` — `ToolContext` interface (update)
  - `src/agents/tools.ts:24-188` — Tool implementations using sandbox (update all)

  **Acceptance Criteria**:
  - [ ] Test: Update all existing agent tests to pass with adapter
  - [ ] `code-agent.ts` uses `createSandboxAdapter()` instead of `createSandbox()`
  - [ ] `tools.ts` receives adapter via `ToolContext`
  - [ ] With `NEXT_PUBLIC_USE_WEBCONTAINERS=false`: exact same behavior as before (regression test)
  - [ ] With `NEXT_PUBLIC_USE_WEBCONTAINERS=true`: WebContainer path executes
  - [ ] All existing `bun run test` tests pass
  - [ ] `bun run build` passes

  **Commit**: YES
  - Message: `feat(agents): integrate sandbox adapter into code-agent and tools pipeline`
  - Files: `src/agents/code-agent.ts`, `src/agents/tools.ts`, `src/agents/sandbox-utils.ts`, updated tests
  - Pre-commit: `bun run test && bun run lint`

---

### INTEGRATION

---

- [ ] 15. End-to-End Integration Test + Documentation

  **What to do**:
  - Create integration test: agent run with skills + WebContainer preview
  - Verify: skills loaded → prompt composed → agent generates → files mounted → preview renders
  - Update `AGENTS.md` with skill system documentation
  - Update `src/agents/AGENTS.md` with skill loader and adapter documentation
  - Update `env.example` with new environment variables
  - Update `explanations/` with skill system guide

  **Integration Test Scenario**:
  ```
  1. Seed core skills into Convex (mock)
  2. Run agent with "Build a landing page" prompt
  3. Verify system prompt contains context7 + frontend-design skill content
  4. Verify files generated
  5. Verify files can be converted to FileSystemTree
  6. Verify build check returns clean (mock)
  ```

  **Must NOT do**:
  - Do NOT create documentation in project root — use `explanations/` per AGENTS.md
  - Do NOT require running Convex dev server for tests

  **Parallelizable**: NO (depends on tasks 7 and 14)

  **References**:

  **Pattern References**:
  - `tests/` — Existing test infrastructure and mock patterns
  - `tests/mocks/` — Mock setup for Convex, E2B
  - `AGENTS.md` — Root documentation to update
  - `explanations/` — Documentation directory

  **Acceptance Criteria**:
  - [ ] Integration test passes: `bun run test -- --testPathPattern integration`
  - [ ] `AGENTS.md` updated with skill system and WebContainer sections
  - [ ] `env.example` includes `NEXT_PUBLIC_USE_WEBCONTAINERS`
  - [ ] `explanations/SKILL_SYSTEM.md` documents skill format, loading, and management
  - [ ] All `bun run test` passes
  - [ ] `bun run build` passes
  - [ ] `bun run lint` passes

  **Commit**: YES
  - Message: `feat: add integration tests and documentation for skills + WebContainer`
  - Files: `tests/integration/`, `AGENTS.md`, `env.example`, `explanations/SKILL_SYSTEM.md`
  - Pre-commit: `bun run test && bun run lint && bun run build`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat(convex): add skills and skillInstallations schema tables` | `convex/schema.ts` | `bun run lint` |
| 2 | `feat(convex): add skill CRUD queries and mutations` | `convex/skills.ts` | `bun run test && bun run lint` |
| 3 | `feat(trpc): add skills router with CRUD procedures` | `src/modules/skills/server/procedures.ts`, `_app.ts` | `bun run test && bun run lint` |
| 4 | `feat(agents): add skill content loader with token budgeting` | `src/agents/skill-loader.ts` | `bun run test && bun run lint` |
| 5 | `feat(agents): inject skill content into agent system prompts` | `src/agents/code-agent.ts` | `bun run test && bun run lint` |
| 6 | `feat(scripts): add PrebuiltUI GitHub scraper and component parser` | `scripts/scrape-prebuiltui.ts` | `bun run test && bun run lint` |
| 7 | `feat(scripts): add skill seeding script with skill.yaml parser` | `scripts/seed-skills.ts`, `src/lib/skill-yaml-parser.ts` | `bun run test && bun run lint` |
| 8 | `feat(data): bake core skill content as static fallback` | `src/data/core-skills/` | `bun run test && bun run lint` |
| 9 | `feat(webcontainer): add singleton provider, hook, and scoped COOP/COEP headers` | `src/lib/webcontainer.ts`, `next.config.ts` | `bun run test && bun run lint` |
| 10 | `feat(webcontainer): add file system tree conversion and mounting` | `src/lib/webcontainer-sync.ts` | `bun run test && bun run lint` |
| 11 | `feat(webcontainer): add process spawning and dev server management` | `src/lib/webcontainer-process.ts` | `bun run test && bun run lint` |
| 12 | `feat(webcontainer): add client-side build and lint validation` | `src/lib/webcontainer-build.ts` | `bun run test && bun run lint` |
| 13 | `feat(sandbox): add abstraction layer with E2B and WebContainer adapters` | `src/lib/sandbox-adapter.ts` | `bun run test && bun run lint` |
| 14 | `feat(agents): integrate sandbox adapter into code-agent and tools pipeline` | `src/agents/code-agent.ts`, `tools.ts` | `bun run test && bun run build` |
| 15 | `feat: add integration tests and documentation for skills + WebContainer` | `tests/integration/`, `AGENTS.md` | `bun run test && bun run build && bun run lint` |

---

## Success Criteria

### Verification Commands
```bash
bun run test                    # All tests pass (including new TDD tests)
bun run build                   # Production build succeeds
bun run lint                    # No lint errors
bun run scripts/seed-skills.ts  # Skills seeded into Convex
```

### Final Checklist
- [ ] Core skills (context7 + frontend-design) injected into every agent run
- [ ] Skills stored in Convex, queryable via tRPC
- [ ] PrebuiltUI components parsed and stored as skills
- [ ] Skill.yaml parser handles skills.sh format correctly
- [ ] WebContainer boots in browser with feature flag enabled
- [ ] Files mount correctly from SSE stream into WebContainer
- [ ] Dev server starts and provides preview URL
- [ ] Build validation runs in WebContainer
- [ ] Sandbox adapter abstracts E2B vs WebContainer
- [ ] Feature flag controls which sandbox engine is used
- [ ] E2B fallback works when WebContainer is disabled
- [ ] All existing tests still pass (zero regression)
- [ ] All new code has TDD test coverage
- [ ] Documentation updated (AGENTS.md, explanations/)
