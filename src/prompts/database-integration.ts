export const DRIZZLE_NEON_INTEGRATION_RULES = `
Database Integration (Drizzle ORM + Neon PostgreSQL + Better Auth):

Setup Files Required:
- src/db/schema.ts - Drizzle schema with Better Auth tables (user, session, account, verification)
- src/db/index.ts - Database client using @neondatabase/serverless
- drizzle.config.ts - Drizzle Kit configuration
- src/lib/auth.ts - Better Auth server configuration
- src/lib/auth-client.ts - Better Auth React client
- src/app/api/auth/[...all]/route.ts - Auth API route handler
- src/middleware.ts - Route protection middleware

Database Operations:
- Use \`db.select().from(table)\` for queries
- Use \`db.insert(table).values(data)\` for inserts
- Use \`db.update(table).set(data).where(condition)\` for updates
- Use \`db.delete(table).where(condition)\` for deletes
- Import \`eq, and, or, gt, lt\` from "drizzle-orm" for conditions

Authentication:
- Use \`signIn.email({ email, password })\` for sign in
- Use \`signUp.email({ name, email, password })\` for sign up
- Use \`signOut()\` for sign out
- Use \`useSession()\` hook for client-side session
- Use \`auth.api.getSession({ headers })\` for server-side session
- Protected routes redirect to /sign-in if not authenticated

Environment Variables Required:
- DATABASE_URL - Neon PostgreSQL connection string
- BETTER_AUTH_SECRET - Auth encryption secret (min 32 chars)
- BETTER_AUTH_URL - Base URL for auth
- NEXT_PUBLIC_APP_URL - Public app URL

Commands to Run After Setup:
- npm install drizzle-orm @neondatabase/serverless better-auth
- npm install -D drizzle-kit
- npx drizzle-kit push (to create database tables)
`;

export const CONVEX_INTEGRATION_RULES = `
Database Integration (Convex + Better Auth):

Setup Files Required:
- convex/schema.ts - Convex schema for app data
- convex/convex.config.ts - Convex app config with Better Auth component
- convex/auth.config.ts - Auth config provider
- convex/auth.ts - Better Auth integration with Convex adapter
- src/lib/auth-client.ts - Better Auth React client with Convex plugin
- src/components/convex-provider.tsx - ConvexBetterAuthProvider wrapper
- src/app/api/auth/[...all]/route.ts - Auth API route handler

Database Operations:
- Use \`useQuery(api.module.queryName)\` for reactive queries
- Use \`useMutation(api.module.mutationName)\` for mutations
- Define queries with \`query({ args: {}, handler: async (ctx) => {} })\`
- Define mutations with \`mutation({ args: {}, handler: async (ctx) => {} })\`
- Use \`ctx.db.query("table").collect()\` for reading data
- Use \`ctx.db.insert("table", data)\` for inserts
- Use \`ctx.db.patch(id, data)\` for updates
- Use \`ctx.db.delete(id)\` for deletes

Authentication:
- Use \`signIn.email({ email, password })\` for sign in
- Use \`signUp.email({ name, email, password })\` for sign up
- Use \`signOut()\` for sign out
- Use \`useSession()\` hook for client-side session
- Use \`authComponent.getAuthUser(ctx)\` in Convex functions for server-side auth
- Wrap app with ConvexClientProvider in layout.tsx

Environment Variables Required:
- NEXT_PUBLIC_CONVEX_URL - Convex deployment URL
- BETTER_AUTH_SECRET - Auth encryption secret (set via npx convex env set)
- SITE_URL - Site URL (set via npx convex env set)
- NEXT_PUBLIC_SITE_URL - Public site URL

Commands to Run After Setup:
- npm install convex @convex-dev/better-auth better-auth
- npx convex dev (creates project and starts backend)
- npx convex env set BETTER_AUTH_SECRET <your-secret>
- npx convex env set SITE_URL http://localhost:3000
`;

export function getDatabaseIntegrationRules(
  provider: "drizzle-neon" | "convex"
): string {
  return provider === "drizzle-neon"
    ? DRIZZLE_NEON_INTEGRATION_RULES
    : CONVEX_INTEGRATION_RULES;
}
