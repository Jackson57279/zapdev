# Production Authentication 500 Error Fix

## Problem
Auth endpoints (`/api/auth/get-session`, `/api/auth/sign-in/social`) are returning **500 Internal Server Error** on Vercel deployment.

## Root Cause
The `SITE_URL` environment variable is **missing from Convex production environment**. 

In `convex/auth.ts` line 8:
```typescript
const siteUrl = process.env.SITE_URL!;
```

This variable is used as `baseURL` for Better Auth (line 24). Without it, Better Auth fails to initialize, causing 500 errors.

## Fix Steps

### Step 1: Set Convex Environment Variables

You need to set environment variables in **Convex Dashboard** (not just Vercel):

1. Go to https://dashboard.convex.dev
2. Select your project deployment
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```bash
BETTER_AUTH_SECRET=<your-secret-from-vercel>
SITE_URL=https://zapdev.link
```

**How to get BETTER_AUTH_SECRET:**
- Check your Vercel environment variables
- OR generate new one: `openssl rand -base64 32`
- **Important**: Use the same secret in both Vercel AND Convex

### Step 2: Verify Vercel Environment Variables

Ensure these are set in Vercel Dashboard → Settings → Environment Variables:

```bash
NEXT_PUBLIC_APP_URL=https://zapdev.link
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
NEXT_PUBLIC_CONVEX_SITE_URL=<your-convex-site-url>
BETTER_AUTH_SECRET=<same-as-convex>
SITE_URL=https://zapdev.link
```

### Step 3: Deploy Convex

After setting Convex environment variables:

```bash
cd /home/dih/zapdev
bun run convex:deploy
```

This will:
- Deploy updated Convex functions with environment variables
- Initialize Better Auth component if not already done
- Create auth tables (users, sessions, accounts, etc.)

### Step 4: Verify Deployment

1. **Check Convex Dashboard** → Data → Tables
   - Should see: `betterAuth/user`, `betterAuth/session`, `betterAuth/account`
   
2. **Check Convex Logs** for any errors during deployment

3. **Test endpoints**:
   - Visit: `https://zapdev.link/api/auth/get-session`
   - Should return 401 (unauthorized) instead of 500
   - Try signing up/in on the actual site

### Step 5: Redeploy Vercel (if needed)

If issues persist after Convex deployment:

```bash
# Trigger redeployment via git push
git commit --allow-empty -m "Trigger Vercel redeploy"
git push origin master
```

Or use Vercel CLI:
```bash
vercel --prod
```

## Alternative: Use CLI to Set Convex Env Vars

If you prefer using CLI instead of dashboard:

```bash
# Install Convex CLI globally if not installed
npm install -g convex

# Login to Convex
npx convex login

# Set production environment variables
npx convex env set BETTER_AUTH_SECRET <your-secret> --prod
npx convex env set SITE_URL https://zapdev.link --prod

# Deploy
bun run convex:deploy
```

## Verification Checklist

After completing the fix:

- [ ] `SITE_URL` is set in Convex environment (production)
- [ ] `BETTER_AUTH_SECRET` is set in Convex environment (production)
- [ ] Same secrets are in Vercel environment variables
- [ ] Convex deployment succeeded without errors
- [ ] Better Auth tables exist in Convex dashboard
- [ ] `/api/auth/get-session` returns 401 (not 500)
- [ ] Sign-up/sign-in flows work on production site
- [ ] No CORS errors in browser console

## Troubleshooting

### Still Getting 500 Errors?

1. **Check Convex Logs**:
   - Go to Convex Dashboard → Logs
   - Look for errors related to `SITE_URL` or Better Auth

2. **Verify Environment Variable Names**:
   - Must be exact: `SITE_URL` (not `NEXT_PUBLIC_SITE_URL`)
   - Check for typos or extra spaces

3. **Check Domain Matches**:
   - `SITE_URL` should be `https://zapdev.link` (no trailing slash)
   - `NEXT_PUBLIC_APP_URL` should match `SITE_URL`

4. **Clear Caches**:
   - Clear browser cache/cookies
   - Try incognito mode
   - Hard refresh (Ctrl+Shift+R)

5. **Check OAuth Providers** (if using):
   - Google/GitHub callback URLs must match production domain
   - Format: `https://zapdev.link/api/auth/callback/google`

### CORS Errors?

These are already configured in `next.config.mjs`, but verify:
- www → non-www redirect is working (configured in vercel.json)
- Auth CORS headers are present (check Network tab in DevTools)

## Quick Command Reference

```bash
# View Convex environment variables
npx convex env ls --prod

# Set Convex environment variable
npx convex env set KEY value --prod

# Deploy Convex
bun run convex:deploy

# View Convex logs
# (Use dashboard: https://dashboard.convex.dev → Logs)
```

## Why This Happened

The Better Auth migration was completed, but the **Convex-specific** environment variables weren't transferred from the documentation to the actual Convex deployment. The migration docs mention setting these variables, but they weren't actually set in the Convex production environment.

## Prevention

For future deployments:
1. Always set environment variables in **both** Vercel AND Convex
2. Use a deployment checklist (see BETTER_AUTH_IMPLEMENTATION_SUMMARY.md)
3. Test authentication immediately after deployment
4. Monitor Sentry for 500 errors
