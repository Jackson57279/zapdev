# Convex - Real-Time Backend & Database

**Overview**: Single source of truth for real-time database schema, server-side procedures, and background orchestration.

## WHERE TO LOOK

| Component | Location | Role |
|-----------|----------|------|
| Database Schema | `convex/schema.ts` | Table definitions, indexes, and type-safe enums |
| Auth Helpers | `convex/helpers.ts` | `requireAuth(ctx)` and Clerk/Polar identity checks |
| Core Entities | `convex/{projects,messages,usage}.ts` | Business logic for primary data models |
| HTTP Webhooks | `convex/http.ts` | External endpoints (Polar subscriptions, Clerk sync) |
| System Logic | `convex/{rateLimit,oauth}.ts` | Infrastructure and integration logic |

## CONVENTIONS

- **Function Syntax**: ALWAYS use object-based syntax with explicit `args` and `handler`.
- **Validators**: Every argument MUST have a `v.*` validator. Use `returns: v.null()` for void functions.
- **Authentication**: Use `const userId = await requireAuth(ctx)` at the start of protected handlers.
- **Internal Functions**: Use `internalQuery`/`internalMutation` for system-only tasks (e.g., Inngest triggers).
- **Real-Time**: Queries are reactive by default; ensure they are optimized for frequent re-runs.
- **Data Integrity**: Use `ctx.db.patch` for partial updates and `ctx.db.replace` for full overrides.

## ANTI-PATTERNS

- **NEVER** use `.filter()` in queries — use `withIndex` to avoid O(N) scans.
- **NEVER** use `ctx.db` inside an `action` — use `ctx.runQuery` or `ctx.runMutation` instead.
- **NEVER** perform side effects (API calls, emails) in queries/mutations — use `actions`.
- **NEVER** expose internal IDs or sensitive metadata in public return values.
- **DO NOT** use `any` in function signatures; leverage `Doc<"table">` or `Id<"table">`.
- **AVOID** calling actions from other actions unless crossing runtimes (V8 to Node).
