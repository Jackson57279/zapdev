# tRPC & API Infrastructure

## OVERVIEW
Type-safe API layer using tRPC v11 and React Query for seamless client-server communication.

## STRUCTURE
```
src/trpc/
├── routers/          # Router composition (_app.ts)
├── init.ts           # Context, middlewares, and procedure factories
├── client.tsx        # Client-side TRPCReactProvider
├── server.tsx        # Server-side caller and options proxy
└── query-client.ts   # React Query client configuration
```

## WHERE TO LOOK

| Component | Location | Role |
|-----------|----------|------|
| Root Router | `src/trpc/routers/_app.ts` | Entry point merging all feature routers |
| Base Logic | `src/trpc/init.ts` | Context (auth) and Procedure factories |
| Feature APIs | `src/modules/*/server/procedures.ts` | Feature-specific API implementations |
| Client Hooks | `src/trpc/client.tsx` | `useTRPC` hook and `TRPCReactProvider` |
| Server Calls | `src/trpc/server.tsx` | `caller()` for server-side invocations |

## CONVENTIONS

- **Procedure Location**: Always define feature-specific routers in their respective `src/modules/[feature]/server/procedures.ts` and merge them in `_app.ts`.
- **Authentication**: Use `protectedProcedure` for any endpoint requiring an authenticated user session (verified via Clerk).
- **Context**: The `createTRPCContext` provides access to the current user (from `@/lib/auth-server`).
- **Type Safety**: Avoid `any`. Let tRPC infer types from procedures for full end-to-end type safety.
- **Serialization**: `superjson` is the default transformer for handling complex types (Dates, BigInts).
- **Query Config**: Default `staleTime` is 1 minute. Mutations do not retry by default. See `query-client.ts`.
