
## Task 2: Convex Skill CRUD Decisions (2026-01-27)

### Return Validator Design
- Created a shared `skillReturnValidator` constant to avoid duplicating the full skill object validator across 8+ functions
- Includes all schema fields plus system fields `_id` and `_creationTime`

### Search Implementation
- Chose in-memory search (collect all + filter) over adding a search index
- Rationale: Skill catalog is expected to be small (<1000 entries). Adding a search index would require schema changes and is premature optimization
- If scale becomes an issue, add `withSearchIndex` to schema.ts

### Internal vs Public Function Split
- `getForSystem` and `getCoreSkillContents` are `internalQuery` — agents call these without user auth
- `upsertFromGithub` and `seedCoreSkills` are `internalMutation` — only callable from other Convex functions (seeding scripts use actions that call these)
- All user-facing CRUD is public with `requireAuth`

### Ownership Model
- User-created skills: `userId` set to auth user, `isGlobal: false`, `isCore: false`
- Global skills: `isGlobal: true`, may or may not have `userId`
- Core skills: `isCore: true`, `isGlobal: true`, cannot be deleted via public API
- Update/delete checks: owner match OR global ownership check

## Task 6: PrebuiltUI Scraper Design Decisions (2026-01-27)

### Decision: Hybrid GitHub + Website Approach
- **Context**: Task says "use GitHub repo ONLY" but repo has only 2 components
- **Decision**: Clone repo first (gets 1 target component), then discover remaining from website category pages
- **Rationale**: Impossible to meet 50+ component requirement from repo alone; website is the authoritative source
- **Alternative**: Could have only extracted 2 components and reported failure

### Decision: HTML-to-React Conversion
- **Context**: Most components only have HTML code, but task requires React as primary format
- **Decision**: Convert HTML to React by replacing class→className, for→htmlFor, self-closing void elements
- **Rationale**: Tailwind CSS components are mostly markup; conversion is straightforward

### Decision: Category-Specific Placeholder Templates
- **Context**: Some components might not have fetchable code
- **Decision**: Built category-specific placeholder templates (hero, navbar, card, cta, footer, form, features)
- **Outcome**: Not needed - all 62 components had real code extracted. Templates remain as fallback.

## Task 7: Seed Skills Script Decisions

### Admin Auth for Internal Mutations
**Decision**: Use `ConvexHttpClient.setAdminAuth(CONVEX_DEPLOY_KEY)` to call `internal.skills.upsertFromGithub`.
**Rationale**: The `upsertFromGithub` mutation is intentionally internal (no auth required, system-only). The deploy key approach is the official Convex way to call internal functions from external scripts.
**Alternative considered**: Creating a public mutation wrapper — rejected because it would expose seeding to unauthenticated users.

### Graceful Fallback for YAML Parsing
**Decision**: If `parseSkillYaml()` throws (e.g., no frontmatter), fall back to using the raw content with hardcoded fallback name/description from the config.
**Rationale**: GitHub skill files may change format. The script should still work even if frontmatter is missing or malformed.

### Separate Parser Module
**Decision**: Created `src/lib/skill-yaml-parser.ts` as a standalone module rather than inlining parsing in the script.
**Rationale**: The parser will be reused by other parts of the system (e.g., skill loader, future skill import UI). Keeping it in `src/lib/` makes it importable from anywhere.

## Task 8: Static Fallback Design

### Decision: Export `loadStaticCoreSkills()` as a named export
- **Why**: Allows direct unit testing of the fallback path without needing to mock Convex failure
- **Alternative**: Could have been a private function, but testability wins

### Decision: Use `readFileSync` for static files (not dynamic import)
- **Why**: Static markdown files aren't TypeScript modules. `readFileSync` is the simplest way to read them at runtime. This code runs server-side only (in code-agent.ts), so sync I/O is acceptable.
- **Alternative**: Could use `import()` with raw loader, but adds build complexity for no benefit

### Decision: Fallback triggers on empty array OR exception
- **Why**: Convex might return `[]` if skills table exists but isn't seeded yet. Both cases should trigger fallback.
- **Alternative**: Only fallback on exception — but that misses the "not seeded" case

### Decision: CORE_SKILL_STATIC_FILES as a constant array
- **Why**: Makes it trivial to add more core skills later. Each entry maps name/slug/filename.
- **Alternative**: Hardcode paths inline — less maintainable

## Tasks 13-15: Architectural Decisions (2026-01-27)

### Decision: Keep sandboxId in ToolContext alongside adapter
**Why**: `runErrorFix` reconnects to existing E2B sandboxes by ID. It doesn't create a new adapter — it uses the legacy `getSandbox(sandboxId)` path. Making adapter optional preserves this without breaking the error fix flow.

### Decision: instanceof checks for E2B-specific streaming
**Why**: The `terminal` tool needs real-time stdout/stderr streaming via callbacks. This is an E2B-specific API (`sandbox.commands.run(cmd, { onStdout, onStderr })`). Rather than adding streaming to ISandboxAdapter (which WebContainer doesn't support in the same way), we use `instanceof E2BSandboxAdapter` to access the underlying sandbox. This keeps the interface clean.

### Decision: Lazy dynamic imports in adapter methods
**Why**: `E2BSandboxAdapter` imports from `@/agents/sandbox-utils` and `WebContainerAdapter` imports from `@/lib/webcontainer-*`. Using `await import()` inside methods prevents circular dependencies and avoids loading E2B code when using WebContainer (and vice versa).

### Decision: AGENTS.md updated with both skill system and sandbox adapter sections
**Why**: These are the two major new subsystems. The AGENTS.md serves as the primary entry point for understanding the codebase. Added CODE MAP entries for sandbox-adapter.ts and skill-loader.ts.
