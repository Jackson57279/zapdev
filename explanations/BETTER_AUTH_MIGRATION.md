# Better Auth + Convex Migration Guide

This guide documents the migration from Clerk to Better Auth integrated with Convex for the ZapDev application.

## Overview

**Date**: November 12, 2025  
**Migration Type**: Authentication Provider Replacement  
**From**: Clerk Authentication  
**To**: Better Auth + Convex Integration

### Why Migrate?

1. **Self-Hosted Control**: Full control over authentication flows
2. **Single Database**: Authentication data stored alongside application data in Convex
3. **No Vendor Lock-in**: Open-source authentication solution
4. **Cost Efficiency**: No per-user pricing
5. **Better Integration**: Seamless integration with Convex backend

### Problem Solved

The migration fixes the CORS errors occurring between `www.zapdev.link` and `zapdev.link` domains:
- **Error**: `Access-Control-Allow-Origin` header missing
- **Error**: 307 redirects blocking CORS preflight requests
- **Root Cause**: Domain mismatch and missing CORS configuration

## Implementation Summary

### Phase 1: Dependencies Installed

```bash
bun add @convex-dev/better-auth better-auth@1.3.27 --exact
bun add convex@latest  # Updated to 1.29.0
```

### Phase 2: Convex Configuration

#### Files Created/Modified:

1. **`convex/convex.config.ts`** (NEW)
   - Registers Better Auth component
   - Configures Convex app instance

2. **`convex/auth.config.ts`** (UPDATED)
   - Changed from `CLERK_JWT_ISSUER_DOMAIN` to `CONVEX_SITE_URL`
   - Maintains `applicationID: "convex"`

3. **`convex/auth.ts`** (NEW)
   - Better Auth instance with Convex adapter
   - Email/password authentication (no verification initially)
   - Google & GitHub OAuth support
   - `getCurrentUser()` query helper

4. **`convex/http.ts`** (NEW)
   - HTTP router with Better Auth routes
   - Handles authentication API endpoints

### Phase 3: API Routes

5. **`src/app/api/auth/[...all]/route.ts`** (NEW)
   - Next.js API route proxy
   - Forwards auth requests to Convex deployment

### Phase 4: Client & Server Setup

6. **`src/lib/auth-client.ts`** (NEW)
   - Better Auth client with Convex plugin
   - Used in React components

7. **`src/lib/auth-server.ts`** (NEW)
   - Token helper for server-side authentication
   - Used in Server Components and Actions

8. **`src/components/convex-provider.tsx`** (UPDATED)
   - Replaced `ConvexProviderWithClerk` → `ConvexBetterAuthProvider`
   - Removed `useAuth` from Clerk
   - Added `authClient` from Better Auth

9. **`src/app/layout.tsx`** (UPDATED)
   - Removed `ClerkProvider` wrapper
   - Simplified layout structure
   - Authentication now handled by `ConvexBetterAuthProvider`

### Phase 5: Middleware & Configuration

10. **`src/middleware.ts`** (UPDATED)
    - Removed Clerk middleware
    - Simplified route protection
    - Authentication checks moved to component level

11. **`next.config.mjs`** (UPDATED)
    - Added CORS headers for `/api/auth/*` routes:
      - `Access-Control-Allow-Credentials: true`
      - `Access-Control-Allow-Origin: https://zapdev.link`
      - `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
      - `Access-Control-Allow-Headers: [auth headers]`

12. **`vercel.json`** (UPDATED)
    - Added 308 permanent redirect: `www.zapdev.link` → `zapdev.link`
    - Ensures consistent origin for CORS
    - Prevents redirect issues during authentication

### Phase 6: Environment Variables

#### `.env.local` Updates:
```bash
# Convex URLs
NEXT_PUBLIC_CONVEX_URL=https://dependable-trout-339.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://dependable-trout-339.convex.site
NEXT_PUBLIC_APP_URL=https://zapdev.link

# Better Auth
BETTER_AUTH_SECRET=<generated-with-openssl>
SITE_URL=https://zapdev.link
```

#### Convex Environment Variables:
```bash
convex env set BETTER_AUTH_SECRET <secret>
convex env set SITE_URL https://zapdev.link
# Note: CONVEX_SITE_URL is built-in, no need to set manually
```

## Authentication Flow

### Old Flow (Clerk)
```
User → ClerkProvider → Clerk API → Clerk Database → JWT → Convex
```

### New Flow (Better Auth)
```
User → authClient (Better Auth) 
  → /api/auth/* (Next.js Proxy) 
  → Convex HTTP Router 
  → Better Auth Instance 
  → Convex Database
  → Session Token → Convex Queries
```

## Database Schema Changes

Better Auth automatically creates these Convex tables:
- `user` - User accounts
- `session` - Active sessions
- `account` - Social login accounts (Google, GitHub)
- `verification` - Email verification tokens (if enabled)

Existing tables remain unchanged:
- `projects`
- `messages`
- `fragments`
- `usage`
- `oauthConnections`
- `imports`

## Migration Steps for Components

### Before (Clerk):
```typescript
import { useUser } from "@clerk/nextjs";

function MyComponent() {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded) return <Loading />;
  if (!user) return <SignIn />;
  
  return <div>Hello {user.firstName}</div>;
}
```

### After (Better Auth):
```typescript
import { authClient } from "@/lib/auth-client";

function MyComponent() {
  const { data: session, isPending } = authClient.useSession();
  
  if (isPending) return <Loading />;
  if (!session) return <SignIn />;
  
  return <div>Hello {session.user.name}</div>;
}
```

## API Usage Examples

### Client-Side Authentication

```typescript
import { authClient } from "@/lib/auth-client";

// Sign up with email/password
await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe",
});

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword",
});

// Sign in with Google
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
});

// Sign out
await authClient.signOut();

// Get current session
const session = authClient.useSession();
```

### Server-Side Authentication

```typescript
import { getToken } from "@/lib/auth-server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// In Server Component or API Route
const token = await getToken();
const user = await fetchQuery(
  api.auth.getCurrentUser,
  {},
  { token }
);
```

### Convex Functions with Auth

```typescript
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getMyProjects = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    return ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .collect();
  },
});
```

## Testing Checklist

- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Sign in with GitHub OAuth
- [ ] Session persistence across page reloads
- [ ] Sign out functionality
- [ ] Protected routes redirect to sign-in
- [ ] Public routes accessible without auth
- [ ] API endpoints respect authentication
- [ ] CORS working for auth endpoints
- [ ] www redirect working correctly

## Deployment Steps

### 1. Update Production Environment Variables

In Vercel dashboard:
```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
NEXT_PUBLIC_APP_URL=https://zapdev.link
SITE_URL=https://zapdev.link
```

In Convex dashboard:
```bash
BETTER_AUTH_SECRET=<production-secret>
SITE_URL=https://zapdev.link
```

### 2. Deploy Convex Backend

```bash
bun run convex:deploy
```

### 3. Deploy Frontend

Push to main branch or run:
```bash
vercel --prod
```

### 4. Verify Domain Configuration

- Ensure `zapdev.link` is the primary domain
- Verify `www.zapdev.link` redirects to `zapdev.link`
- Test authentication flow on production

## Rollback Plan

If issues arise, to rollback:

1. Revert the following files to previous versions:
   - `src/app/layout.tsx`
   - `src/components/convex-provider.tsx`
   - `src/middleware.ts`
   - `next.config.mjs`
   - `vercel.json`

2. Remove Better Auth files:
   ```bash
   rm convex/convex.config.ts
   rm convex/auth.ts
   rm convex/http.ts
   rm -rf src/app/api/auth
   rm src/lib/auth-client.ts
   rm src/lib/auth-server.ts
   ```

3. Restore Clerk environment variables

4. Redeploy both Convex and frontend

## Known Issues & Solutions

### Issue: "Components not found" error
**Solution**: Run `bun run convex:dev` to regenerate component types

### Issue: CORS still failing after deployment
**Solution**: Verify `NEXT_PUBLIC_APP_URL` matches your actual domain and that www redirect is active

### Issue: OAuth providers not working
**Solution**: Update OAuth callback URLs in Google/GitHub console to `https://zapdev.link/api/auth/callback/{provider}`

## Next Steps

After successful migration:

1. **Remove Clerk Dependencies**:
   ```bash
   bun remove @clerk/nextjs @clerk/themes
   ```

2. **Update All Components**: Replace Clerk hooks with Better Auth equivalents

3. **Update tRPC Context**: Replace Clerk auth with Better Auth tokens

4. **Data Migration**: Create script to migrate existing user data from Clerk to Better Auth format

5. **Enable Email Verification**: Update `convex/auth.ts`:
   ```typescript
   emailAndPassword: {
     enabled: true,
     requireEmailVerification: true, // Enable this
   }
   ```

6. **Add Additional OAuth Providers**: Better Auth supports many providers (Twitter, Discord, etc.)

## Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Convex + Better Auth Guide](https://convex-better-auth.netlify.app/)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [Convex Documentation](https://docs.convex.dev/)

## Support

For issues or questions:
- Check Better Auth Discord
- Review Convex community forums
- Open issue in project repository
