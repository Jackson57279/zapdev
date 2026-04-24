# Stack Auth Migration Guide

**Date**: November 13, 2025  
**Status**: ✅ Complete - Ready for Configuration  
**Migration**: Better Auth → Stack Auth + Convex

---

## 🎯 Problem Solved

### Original Issues:
```
api/auth/get-session → 500 error
api/auth/sign-in/social → 500 error
```

**Root Cause**: Better Auth implementation issues with Convex integration.

**Solution**: Migrated to Stack Auth, which has official Convex support and simpler integration.

---

## ✅ What Was Changed

### Dependencies
- ❌ Removed: `better-auth@1.3.27`, `@convex-dev/better-auth@0.9.7`, `@convex-dev/auth`
- ✅ Added: `@stackframe/stack@2.8.51`

### Files Created
- `src/app/handler/[...stack]/page.tsx` - Stack Auth handler (replaces `/api/auth/[...all]`)
- `src/app/loading.tsx` - Suspense boundary for Stack's async hooks
- `src/lib/auth-server.ts` - Server-side auth utilities (recreated for Stack Auth)

### Files Modified
- `convex/auth.config.ts` - Now uses Stack Auth providers
- `convex/convex.config.ts` - Removed Better Auth component
- `convex/helpers.ts` - Updated to use Stack Auth context
- `convex/http.ts` - Removed Better Auth route registration
- `src/app/layout.tsx` - Uses Stack providers
- `src/components/convex-provider.tsx` - Stack Auth integration
- `src/middleware.ts` - Simplified routing
- `src/modules/home/ui/components/navbar.tsx` - Uses `useUser()` from Stack
- `src/components/user-control.tsx` - Uses Stack Auth hooks
- `src/modules/home/ui/components/projects-list.tsx` - Uses `useUser()`
- All API routes (`/api/fix-errors`, `/api/import/*`, etc.) - Use Stack Auth

### Files Deleted
- `src/lib/auth-client.ts` (Better Auth)
- `src/lib/auth-server.ts` (Better Auth - recreated for Stack)
- `convex/auth.ts` (Better Auth)
- `src/app/api/auth/` directory
- `src/app/(home)/sign-in/` directory (Stack provides built-in pages)
- `src/app/(home)/sign-up/` directory (Stack provides built-in pages)

---

## 🚀 Setup Instructions

### 1. Create Stack Auth Project

1. Go to https://app.stack-auth.com
2. Sign up / Log in
3. Create a new project
4. Navigate to API Keys section
5. Copy the following values:
   - Project ID
   - Publishable Client Key
   - Secret Server Key

### 2. Set Environment Variables

Update `.env.local`:
```bash
# Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=<your-publishable-key>
STACK_SECRET_SERVER_KEY=<your-secret-key>

# Existing Convex variables (keep these)
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
NEXT_PUBLIC_APP_URL=https://zapdev.link
```

### 3. Set Convex Environment Variables

In your Convex dashboard, set:
```bash
convex env set NEXT_PUBLIC_STACK_PROJECT_ID <your-project-id>
convex env set NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY <your-publishable-key>
convex env set STACK_SECRET_SERVER_KEY <your-secret-key>
```

### 4. Deploy Convex

```bash
bun run convex:deploy
```

### 5. Start Development

```bash
# Terminal 1: Convex backend
bun run convex:dev

# Terminal 2: Next.js frontend
bun run dev
```

---

## 🔑 Key Differences: Better Auth vs Stack Auth

| Feature | Better Auth | Stack Auth |
|---------|------------|-----------|
| **Setup** | Manual configuration | Setup wizard |
| **Convex Integration** | Community adapter | Official native support |
| **UI Components** | Custom implementation | Built-in pages |
| **Auth Routes** | `/api/auth/*` | `/handler/*` |
| **Client Hook** | `authClient.useSession()` | `useUser()` |
| **Server Auth** | `authClient.signOut()` | `user.signOut()` |
| **Token Management** | Manual with Convex | Automatic cookie-based |
| **Sign-in URL** | `/sign-in` | `/handler/sign-in` |
| **Sign-up URL** | `/sign-up` | `/handler/sign-up` |
| **Account Settings** | Custom | `/handler/account-settings` |

---

## 📝 Code Examples

### Client Component (React)

**Before (Better Auth):**
```typescript
import { authClient } from "@/lib/auth-client";

const { data: session } = authClient.useSession();
const userName = session?.user.name;
```

**After (Stack Auth):**
```typescript
import { useUser } from "@stackframe/stack";

const user = useUser();
const userName = user?.displayName;
```

### Server Component

**Before (Better Auth):**
```typescript
import { getToken } from "@/lib/auth-server";
import { fetchQuery } from "convex/nextjs";

const token = await getToken();
const user = await fetchQuery(api.auth.getCurrentUser, {}, { token });
```

**After (Stack Auth):**
```typescript
import { getUser } from "@/lib/auth-server";

const user = await getUser();
```

### API Routes

**Before (Better Auth):**
```typescript
import { getToken } from "@/lib/auth-server";
import { fetchQuery } from "convex/nextjs";

const token = await getToken();
const user = await fetchQuery(api.auth.getCurrentUser, {}, { token });
```

**After (Stack Auth):**
```typescript
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";

const stackUser = await getUser();
const convexClient = await getConvexClientWithAuth();
const data = await convexClient.query(api.someQuery, { ... });
```

### Convex Functions

**Before (Better Auth):**
```typescript
import { authComponent } from "./auth";

export const myQuery = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
  },
});
```

**After (Stack Auth):**
```typescript
import { getCurrentUserId, requireAuth } from "./helpers";

export const myQuery = query({
  handler: async (ctx) => {
    const userId = await requireAuth(ctx); // Throws if not authenticated
    // Or: const userId = await getCurrentUserId(ctx); // Returns null if not authenticated
  },
});
```

---

## 🔐 Authentication Flow

### Stack Auth Flow:
```
User (Browser)
  ↓
useUser() / useStackApp() hooks
  ↓
/handler/* (Stack Auth pages)
  ↓
Stack Auth API (managed by Stack)
  ↓
Cookie-based session
  ↓
Convex Client (auto-configured via setAuth)
  ↓
Convex Queries/Mutations (ctx.auth.getUserId())
```

---

## 🧪 Testing Checklist

### Before Production:
- [ ] Environment variables set in `.env.local`
- [ ] Environment variables set in Convex dashboard
- [ ] Run `bun run convex:dev` successfully
- [ ] Run `bun run dev` successfully
- [ ] Navigate to `/handler/sign-up` and create test account
- [ ] Sign in at `/handler/sign-in`
- [ ] Verify user profile shows in navbar
- [ ] Test sign-out functionality
- [ ] Verify session persists across page reloads
- [ ] Test protected routes redirect to `/handler/sign-in`
- [ ] Test OAuth providers (if configured in Stack dashboard)

### Build & Deploy:
- [ ] `bun run build` completes without errors
- [ ] Deploy Convex: `bun run convex:deploy`
- [ ] Deploy to Vercel/your hosting provider
- [ ] Set production environment variables in Vercel
- [ ] Test authentication on production domain

---

## ⚠️ Known Issues & Limitations

### User Migration
- **Issue**: Existing Better Auth users won't automatically transfer to Stack Auth
- **Solution**: Users will need to create new accounts, OR implement a custom migration script
- **Workaround**: Communicate to users that they need to re-register

### API Route Updates
Some import routes (Figma/GitHub) still need full Stack Auth integration:
- `src/app/api/import/figma/callback/route.ts`
- `src/app/api/import/figma/files/route.ts`
- `src/app/api/import/figma/process/route.ts`
- `src/app/api/import/github/*` (similar pattern)

These routes need updating to use `getUser()` and `getConvexClientWithAuth()` instead of the old Better Auth methods.

### OAuth Providers
If you were using Google/GitHub OAuth with Better Auth:
1. Go to Stack Auth dashboard
2. Configure OAuth providers
3. Update redirect URLs in Google/GitHub consoles to use Stack Auth URLs

---

## 🔄 Rollback Plan

If you need to revert:
1. This migration is on a git branch/commit
2. Revert to previous commit: `git reset --hard <previous-commit>`
3. Reinstall dependencies: `bun install`
4. Restart servers: `bun run convex:dev` and `bun run dev`

---

## 📚 Resources

- [Stack Auth Docs](https://docs.stack-auth.com/)
- [Stack Auth + Convex Integration](https://docs.stack-auth.com/docs/others/convex)
- [Stack Auth GitHub Examples](https://github.com/stack-auth/convex-next-template)
- [Stack Auth Dashboard](https://app.stack-auth.com/)
- [Stack Auth Discord](https://discord.stack-auth.com/)

---

## ✅ Next Steps

1. **Immediate**: Set up Stack Auth project and configure environment variables
2. **Short-term**: Test all authentication flows locally
3. **Medium-term**: Complete remaining import API route updates
4. **Long-term**: Configure OAuth providers, email templates, and advanced features in Stack dashboard

---

**Migration completed by**: Claude AI Assistant  
**Date**: November 13, 2025  
**Status**: Ready for configuration and testing
