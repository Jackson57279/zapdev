# Draft: Skill System + PrebuiltUI Integration + WebContainer Migration

## ALL DECISIONS FINALIZED — READY FOR PLAN GENERATION

## Requirements (confirmed)

### User's Vision
1. **Skills = Prompt Augmentation** (skills.sh compatible) — curated knowledge baked into agent system prompts
2. **PrebuiltUI components** scraped from GitHub repo, stored in Convex as skills
3. **WebContainer migration** from E2B (Hybrid: Option C) — agent stays server-side, WebContainer is client-side preview
4. **Core skills pre-installed**: `context7` + `frontend-design` always injected into all agent prompts
5. **Both global + user-created skills** in Convex
6. **Skills.sh format compatible**: skill.yaml with YAML frontmatter + markdown instructions
7. **Parallel tracks**: Skills and WebContainer migration developed independently

### Skills.sh Ecosystem
- Skills are GitHub repos with `skills/` directory containing `skill.yaml` files
- Format: YAML frontmatter (name, description) + markdown body (instructions)
- Compatible with: Claude Code, Cursor, Codex, etc.
- Pre-install: `intellectronica/agent-skills/context7` and `anthropics/skills/frontend-design`
- These get baked into the ZapDev codebase at build time

## Technical Decisions (ALL CONFIRMED)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Skill type | Prompt augmentation | Not dynamic tool plugins |
| 2 | Skill format | skills.sh compatible (skill.yaml) | Access to existing ecosystem (27K+ installs) |
| 3 | Injection timing | Always (all agents) for core skills | context7 + frontend-design always injected |
| 4 | Skill storage | Convex database | Real-time, consistent with existing arch |
| 5 | Installation model | Baked into codebase | Run npx skills add during dev, content embedded in source |
| 6 | WebContainer arch | Hybrid (Option C) | Agent server-side, WebContainer client-side preview only |
| 7 | Build validation | Client-side in WebContainer | npm run build/lint runs in browser WebContainer |
| 8 | Phase ordering | Parallel tracks | Skills + WebContainer developed independently |
| 9 | PrebuiltUI ingestion | GitHub scrape | Clone prebuiltui/prebuiltui, parse, store in Convex |
| 10 | Test strategy | TDD with existing Jest | RED-GREEN-REFACTOR using tests/ infrastructure |

## Scope Boundaries

### IN SCOPE
- WebContainer client-side preview engine (replace E2B for preview)
- WebContainer client-side build validation
- Skill database schema (Convex)
- Skill CRUD API (tRPC)
- skills.sh format parser
- Core skill baking (context7, frontend-design)
- Skill prompt injection in code-agent.ts
- PrebuiltUI GitHub scrape + Convex ingestion
- Skill search/discovery
- TDD test coverage

### OUT OF SCOPE
- CLI package (deferred — core skills are baked in, not installed via CLI)
- User-facing skill marketplace UI
- Skill monetization
- Custom tool creation via skills
- Skill analytics/ratings
- E2B full removal (keep as fallback during migration)

### DEFERRED
- CLI tool for user-managed skills (`npx @zapdev/skills add`)
- Skill versioning/pinning
- User skill creation UI
- Skill dependency management
