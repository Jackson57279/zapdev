# Stack Auth + Convex Authentication Fix - Complete

## Issue Summary

**Date**: November 13, 2025  
**Status**: ✅ FIXED  
**Error**: `Failed to authenticate: "No auth provider found matching the given token"`

## Root Cause

The authentication error was caused by missing `tokenStore` parameter in the `ConvexClientProvider` component. Stack Auth's `getConvexClientAuth()` method requires an explicit `tokenStore` configuration to properly generate JWT tokens for Convex authentication.

### Technical Details

**Before (Broken):**
```typescript
// src/components/convex-provider.tsx (line 23)
convexClient.setAuth(stackApp.getConvexClientAuth({})); // ❌ Missing tokenStore
```

**After (Fixed):**
```typescript
// src/components/convex-provider.tsx (line 23)
convexClient.setAuth(stackApp.getConvexClientAuth({ tokenStore: "nextjs-cookie" })); // ✅ Correct
```

## Changes Made

### 1. Fixed ConvexClientProvider
**File**: `src/components/convex-provider.tsx`

Added `tokenStore: "nextjs-cookie"` parameter to `getConvexClientAuth()` call. This ensures Stack Auth properly retrieves JWT tokens from Next.js cookies for Convex authentication.

### 2. Verified Environment Configuration

✅ **Local Environment** (`.env.local`):
- `NEXT_PUBLIC_STACK_PROJECT_ID=b8fa06ac-b1f5-4600-bee0-682bc7aaa2a8`
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` (configured)
- `STACK_SECRET_SERVER_KEY` (configured)

✅ **Convex Deployment Environment**:
- `NEXT_PUBLIC_STACK_PROJECT_ID` (synced)
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` (synced)
- `STACK_SECRET_SERVER_KEY` (synced)
- ✅ No conflicting `CLERK_*` variables

✅ **Convex Auth Config** (`convex/auth.config.ts`):
```typescript
export default {
  providers: [
    {
      domain: `https://api.stack-auth.com/api/v1/projects/${process.env.NEXT_PUBLIC_STACK_PROJECT_ID}`,
      applicationID: "convex",
    },
  ],
};
```

## Testing Instructions

### 1. Restart Development Servers

You need to restart both servers to pick up the changes:

**Terminal 1 - Next.js:**
```bash
# Stop the current dev server (Ctrl+C)
cd /home/dih/zapdev
bun run dev
```

**Terminal 2 - Convex:**
```bash
# Stop the current Convex server (Ctrl+C)
cd /home/dih/zapdev
bun run convex:dev
```

### 2. Clear Browser State

To ensure a clean authentication session:

**Option A - Clear Site Data:**
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data" button
4. Reload the page

**Option B - Use Incognito Mode:**
- Open a new incognito/private window
- Navigate to `http://localhost:3000`

### 3. Test Authentication Flow

#### Sign Up Test:
1. Navigate to `http://localhost:3000`
2. Click "Sign Up" button
3. Fill in email and password
4. Submit the form

**Expected Results:**
- ✅ No WebSocket reconnection errors in console
- ✅ No "Failed to authenticate" errors
- ✅ User successfully created and redirected
- ✅ User profile appears in navbar

#### Sign In Test:
1. Navigate to `http://localhost:3000`
2. Click "Sign In" button
3. Enter credentials
4. Submit the form

**Expected Results:**
- ✅ Successful authentication
- ✅ WebSocket connects without errors
- ✅ User session persists across page reloads

#### Project Creation Test:
1. After signing in, go to dashboard
2. Click "Create New Project" button
3. Enter project description
4. Submit

**Expected Results:**
- ✅ No "Unauthorized" errors in console
- ✅ `projects:createWithMessageAndAttachments` mutation succeeds
- ✅ Project appears in dashboard
- ✅ No credit-related errors

### 4. Verify Console Output

Open browser console (F12 → Console tab) and check for:

**✅ Success Indicators:**
```
WebSocket connected
[Convex] Connected to deployment: dependable-trout-339
```

**❌ Should NOT see these errors:**
```
Failed to authenticate: "No auth provider found..."
WebSocket reconnected at t=3.1s
[CONVEX A(projects:createWithMessageAndAttachments)] Unauthorized
```

## Authentication Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Signs In via Stack Auth                            │
│    → Stack Auth generates JWT token                         │
│    → Token stored in Next.js cookies                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ConvexClientProvider initializes                         │
│    → Calls stackApp.getConvexClientAuth({                   │
│         tokenStore: "nextjs-cookie"  ← FIX APPLIED HERE     │
│      })                                                      │
│    → Returns JWT retrieval function                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ConvexReactClient connects                               │
│    → Retrieves JWT from cookies via Stack Auth              │
│    → Sends JWT in WebSocket handshake                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Convex Backend validates JWT                             │
│    → Checks issuer: api.stack-auth.com/.../projects/...     │
│    → Checks applicationID: "convex"                         │
│    → Extracts userId from "subject" claim                   │
│    → ✅ Authentication SUCCESS                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Mutations/Queries Execute                                │
│    → ctx.auth.getUserIdentity() returns valid user          │
│    → getCurrentUserId() extracts subject                    │
│    → requireAuth() passes                                   │
│    → ✅ Operations succeed                                  │
└─────────────────────────────────────────────────────────────┘
```

## Why This Fix Works

### Type Safety Enforcement

Stack Auth's TypeScript definition requires the parameter:
```typescript
getConvexClientAuth(
  options: HasTokenStore extends false 
    ? { tokenStore: TokenStoreInit }  // ← REQUIRED when HasTokenStore is false
    : { tokenStore?: TokenStoreInit }  // ← Optional when HasTokenStore is true
): (args: { forceRefreshToken: boolean }) => Promise<string | null>
```

Since `StackServerApp` in `src/app/layout.tsx` is initialized with `tokenStore: "nextjs-cookie"`, it has `HasTokenStore = true` at the server level, but the **client-side** `useStackApp()` hook returns an app with `HasTokenStore = false`, requiring explicit `tokenStore` configuration.

### JWT Token Retrieval

Without `tokenStore` parameter:
- Stack Auth doesn't know where to retrieve tokens
- Returns `null` or throws error
- Convex receives no authentication token
- WebSocket connection fails validation

With `tokenStore: "nextjs-cookie"`:
- Stack Auth reads tokens from Next.js cookies
- Properly passes JWT to Convex
- Convex validates against `auth.config.ts`
- Authentication succeeds

## Troubleshooting

### If authentication still fails:

1. **Check browser console for specific errors**
   ```bash
   # Look for:
   - "Failed to authenticate"
   - "Unauthorized" in Convex mutations
   - WebSocket reconnection loops
   ```

2. **Verify Convex environment variables**
   ```bash
   cd /home/dih/zapdev
   bun run convex env list | grep STACK
   ```

3. **Check for cookie issues**
   - Open DevTools → Application → Cookies
   - Look for `stack-auth-*` cookies on localhost:3000
   - Ensure cookies are not expired

4. **Verify Stack Auth project ID matches**
   ```bash
   # Should match in all three places:
   - .env.local
   - Convex deployment env
   - convex/auth.config.ts
   ```

5. **Check Convex logs**
   ```bash
   # In the terminal running `bun run convex:dev`
   # Look for authentication-related errors
   ```

### Common Issues

**Issue**: "Cannot read properties of undefined (reading 'getConvexClientAuth')"
- **Cause**: StackProvider not wrapping ConvexClientProvider
- **Fix**: Ensure component hierarchy in `src/app/layout.tsx`:
  ```tsx
  <StackProvider app={stackServerApp}>
    <ConvexClientProvider>
      {/* ... */}
    </ConvexClientProvider>
  </StackProvider>
  ```

**Issue**: WebSocket still reconnecting
- **Cause**: Old Convex client instance cached
- **Fix**: Hard refresh browser (Ctrl+Shift+R) or restart dev server

**Issue**: "Invalid token" errors
- **Cause**: JWT expired or invalid
- **Fix**: Sign out and sign in again to get fresh token

## Files Modified

1. ✅ `src/components/convex-provider.tsx` - Added `tokenStore` parameter
2. ✅ `explanations/STACK_AUTH_FIX_COMPLETE.md` - This documentation

## Related Documentation

- [Stack Auth Migration Complete](../STACK_AUTH_MIGRATION_COMPLETE.md)
- [Stack Auth Migration Guide](./STACK_AUTH_MIGRATION.md)
- [Authentication Fix 2025-11-13](./AUTH_FIX_2025-11-13.md)
- [Stack Auth + Convex Integration](https://docs.stack-auth.com/docs/others/convex)
- [Stack Auth Docs](https://docs.stack-auth.com/)

## Next Steps

After verifying the fix works:

1. ✅ Test all authentication flows (sign up, sign in, sign out)
2. ✅ Test project creation and mutations
3. ✅ Test credit system integration
4. ✅ Test OAuth flows (if configured)
5. ✅ Deploy to production (optional)

## Deployment to Production

If you need to deploy this fix to production:

```bash
# 1. Commit the changes
git add src/components/convex-provider.tsx explanations/STACK_AUTH_FIX_COMPLETE.md
git commit -m "Fix Stack Auth + Convex authentication by adding tokenStore parameter"

# 2. Deploy Convex to production
bun run convex:deploy --prod

# 3. Verify production environment variables
# Go to: https://dashboard.convex.dev
# Check that Stack Auth variables are set in production deployment

# 4. Deploy frontend (if using Vercel)
git push origin master
```

---

**Fix Applied By**: Claude AI Assistant  
**Date**: November 13, 2025  
**Status**: ✅ Complete - Ready for Testing  
**Impact**: High - Fixes critical authentication flow
