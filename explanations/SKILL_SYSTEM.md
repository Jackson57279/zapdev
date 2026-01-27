# Skill System Documentation

## Overview

ZapDev's skill system provides **prompt augmentation** — markdown instructions that are injected into AI agent system prompts to enhance code generation quality. Skills are compatible with the [skills.sh](https://skills.sh) format.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Agent Pipeline                     │
│                                                     │
│  code-agent.ts                                      │
│    ├── loadSkillsForAgent(projectId, userId)        │
│    │     ├── Convex: getCoreSkillContents()         │
│    │     ├── Convex: getInstalledSkillContents()    │
│    │     └── Fallback: src/data/core-skills/*.md    │
│    │                                                │
│    └── systemPrompt = frameworkPrompt               │
│                     + databaseRules                 │
│                     + skillContent  ← injected here │
└─────────────────────────────────────────────────────┘
```

### Key Files

| File | Role |
|------|------|
| `src/agents/skill-loader.ts` | Loads skill content for prompt injection with token budgets |
| `convex/skills.ts` | Convex queries/mutations for skill CRUD |
| `convex/schema.ts` | `skills` and `skillInstallations` table definitions |
| `src/data/core-skills/` | Static fallback markdown files for core skills |
| `src/modules/skills/server/procedures.ts` | tRPC router for skill management API |
| `src/lib/skill-yaml-parser.ts` | Parser for skills.sh YAML frontmatter format |

## Core Skills

Two skills are **always injected** into every agent run:

### context7
- **Source**: [intellectronica/agent-skills](https://github.com/intellectronica/agent-skills)
- **Purpose**: Instructs the agent to use Context7 API for up-to-date library documentation
- **Static fallback**: `src/data/core-skills/context7.md`

### frontend-design
- **Source**: [anthropics/skills](https://github.com/anthropics/skills)
- **Purpose**: UI/UX design guidelines for generating visually polished interfaces
- **Static fallback**: `src/data/core-skills/frontend-design.md`

## Skill Format (skills.sh Compatible)

Skills use YAML frontmatter + markdown body:

```yaml
---
name: my-skill
description: What this skill does
version: "1.0"
---
# Skill Instructions

Markdown body with agent instructions...
```

## Token Budget

The skill loader enforces strict token budgets to prevent prompt bloat:

- **Per-skill limit**: 4,000 tokens (~16,000 characters)
- **Total limit**: 12,000 tokens (~48,000 characters)
- **Estimation**: `tokens ≈ content.length / 4`

Skills exceeding the per-skill limit are truncated with `...[truncated]`. When the total budget is exhausted, remaining skills are skipped.

## Loading Priority

1. **Core skills** (always loaded first, `isCore: true`)
2. **Project-installed skills** (from `skillInstallations` table)
3. Deduplication: installed skills matching core skill slugs are skipped

## Fallback Behaviour

The skill loader is designed to **never break agent generation**:

```
1. Try loading from Convex (getCoreSkillContents)
2. If Convex fails or returns empty → load from src/data/core-skills/*.md
3. If static files also fail → return empty string
4. Agent continues with whatever skills were loaded
```

## Caching

Loaded skills are cached for **30 minutes** using the `cache.getOrCompute()` utility (same pattern as framework detection caching). Cache key: `skills:{projectId}:{userId}`.

## Convex Schema

### `skills` table

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name (e.g., "frontend-design") |
| `slug` | `string` | URL-safe identifier |
| `description` | `string` | From skill.yaml frontmatter |
| `content` | `string` | Full markdown body (the actual instructions) |
| `source` | `enum` | "github" \| "prebuiltui" \| "custom" |
| `sourceRepo` | `string?` | e.g., "anthropics/skills" |
| `category` | `string?` | e.g., "design", "framework" |
| `framework` | `enum?` | If framework-specific |
| `isGlobal` | `boolean` | Global (curated) vs user-created |
| `isCore` | `boolean` | Core skills always injected |
| `userId` | `string?` | null for global skills |
| `tokenCount` | `number?` | Estimated token count |

### `skillInstallations` table

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | `Id<"skills">` | Reference to skill |
| `projectId` | `Id<"projects">?` | Project-specific installation |
| `userId` | `string` | Who installed it |
| `isActive` | `boolean` | Whether currently active |

## Adding New Skills

### Via Convex (recommended)
```typescript
// Use the tRPC skills router
const skill = await trpc.skills.create.mutate({
  name: "my-skill",
  slug: "my-skill",
  description: "Custom skill for...",
  content: "# Instructions\n...",
  source: "custom",
});
```

### Via Seed Script
```bash
bun run scripts/seed-skills.ts
```

### Static Core Skills
To update core skill content:
1. Edit `src/data/core-skills/context7.md` or `frontend-design.md`
2. Run `bun run scripts/seed-skills.ts` to sync to Convex

## Integration with Agent

The skill content is injected in `code-agent.ts` at the system prompt composition step:

```typescript
const skillContent = await loadSkillsForAgent(projectId, project.userId);
const systemPrompt = [frameworkPrompt, databaseIntegrationRules, skillContent]
  .filter(Boolean)
  .join('\n\n');
```

A `"skills-loaded"` StreamEvent is emitted for UI feedback:
```typescript
yield { type: "skills-loaded", data: { skillCount } };
```
