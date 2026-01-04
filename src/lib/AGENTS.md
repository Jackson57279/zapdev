# AGENTS.md - Utilities & Framework Config

**Generated**: 2026-01-04
**Directory**: `src/lib/`

## OVERVIEW
Core utility functions, framework configurations, and service integrations powering ZapDev's application logic and third-party connections.

## WHERE TO LOOK

| Component | File | Role |
|-----------|------|------|
| **Frameworks** | `frameworks.ts` | Centralized config for supported frameworks (React, Vue, Angular, Svelte, Next.js). |
| **Database Helpers** | `convex-api.ts` | Re-exports Convex API; primary entry point for database interactions. |
| **Server Auth** | `auth-server.ts` | Clerk-to-Convex token handling and authenticated Convex client factory. |
| **Sanitization** | `utils.ts` | Data cleaning (NULL byte removal for Postgres), `cn()` utility, and file-tree converters. |
| **Validation** | `env-validation.ts` | Runtime environment variable checks with helpful setup instructions. |
| **SEO & Meta** | `seo.ts` | Next.js 15 Metadata generation and JSON-LD structured data helpers. |
| **Performance** | `performance.ts` | Image loaders, critical asset preloading, and Web Vitals reporting logic. |
| **Service APIs** | `polar.ts`, `firecrawl.ts`, `uploadthing.ts` | Integrations for payments, web scraping, and file uploads. |

## CONVENTIONS

- **Path Aliases**: Always use `@/lib/[filename]` for internal imports to maintain modularity.
- **Convex Auth**: Use `getConvexClientWithAuth()` in Server Components/Actions to ensure database operations are authenticated.
- **PostgreSQL Safety**: Large text or AI-generated JSON MUST be passed through `sanitizeAnyForDatabase()` to prevent `22P05` (NULL byte) errors.
- **Framework Detection**: UI components should consume `frameworks.ts` metadata (slugs, icons, colors) rather than hardcoding framework details.
- **Metadata**: Use `generateMetadata()` from `seo.ts` in root layouts or dynamic routes for consistent SEO.
