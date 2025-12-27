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
