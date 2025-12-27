# Convex + Clerk Billing - Quick Start

## 🚀 Get Started in 5 Minutes

### Step 1: Deploy Convex (2 min)

```bash
# Login to Convex
bunx convex login

# Start development mode (this will create a deployment)
bunx convex dev
```

This will:
- Create a Convex deployment
- Generate `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`
- Start watching for schema changes
- Deploy your schema and functions

**Copy the generated environment variables to your `.env` file.**

### Step 2: Configure Clerk JWT (1 min)

1. Open [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **JWT Templates**
3. Click **+ New template**
4. Select **Convex** from the template list
5. Click **Create**
6. Copy the **Issuer** domain (looks like: `your-app.clerk.accounts.dev`)
7. Add to `.env`:
   ```bash
   CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev
   ```

### Step 3: Set Up Clerk Webhook (2 min)

1. In [Clerk Dashboard](https://dashboard.clerk.com), go to **Webhooks**
2. Click **+ Add Endpoint**
3. For local development, use ngrok:
   ```bash
   # In a new terminal
   ngrok http 3000
   # Copy the https URL
   ```
4. Enter webhook URL: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
5. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
6. Click **Create**
7. Copy the **Signing Secret** (starts with `whsec_`)
8. Add to `.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_your_secret_here
   ```

### Step 4: Install Missing Dependency

```bash
bun add svix  # For webhook signature verification
```

### Step 5: Start Your App

```bash
bun run dev
```

## ✅ Verify Setup

### Test Authentication
1. Sign up for a new account
2. Check Convex Dashboard → Data → `users` table
3. Your user should appear within a few seconds

### Test Credit System
Open your browser console and run:
```javascript
// This assumes you've set up Convex hooks in your components
const usage = await convex.query(api.usage.getUsage);
console.log(usage); // Should show 5 points for free users
```

## 📝 Environment Variables Checklist

Make sure your `.env` has all these:

```bash
# Convex (NEW - from `bunx convex dev`)
CONVEX_DEPLOYMENT=your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk JWT (NEW - from Clerk Dashboard → JWT Templates)
CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev

# Clerk Webhook (NEW - from Clerk Dashboard → Webhooks)
CLERK_WEBHOOK_SECRET=whsec_your_secret_here

# Clerk Auth (EXISTING)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Other existing variables
AI_GATEWAY_API_KEY=...
E2B_API_KEY=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## 🎯 Quick Commands Reference

```bash
# Development
bunx convex dev              # Start Convex in dev mode
bun run dev                  # Start Next.js dev server

# View data
bunx convex dashboard        # Open Convex dashboard in browser

# Deploy
bunx convex deploy           # Deploy to production

# Logs
bunx convex logs             # View function logs

# Reset (if needed)
bunx convex data clear       # Clear all data (dev only!)
```

## 🔍 Debugging

### Webhook Not Working?
1. Check Clerk Dashboard → Webhooks → Event Logs
2. Verify webhook URL is accessible (ngrok must be running)
3. Check console for errors in `/api/webhooks/clerk/route.ts`
4. Verify `CLERK_WEBHOOK_SECRET` is correct

### Auth Not Working?
1. Verify `CLERK_JWT_ISSUER_DOMAIN` matches Clerk JWT template issuer
2. Check Convex Dashboard → Settings → Environment Variables
3. Ensure JWT template is named "convex" or update `auth.config.ts`

### Database Queries Failing?
1. Check Convex Dashboard → Logs for errors
2. Verify schema is deployed: `bunx convex dev` should show "Synced"
3. Check that user is authenticated (run `ctx.auth.getUserIdentity()`)

## 📚 Next Steps

Once basic setup works:

1. **Configure Clerk Billing Plans**
   - Go to Clerk Dashboard → Billing
   - Set up Free ($0) and Pro ($29) plans
   - Add custom claim `plan: "pro"` for Pro users

2. **Update Your Application**
   - See [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) for detailed steps
   - Replace tRPC hooks with Convex hooks
   - Update components to use `useQuery()` and `useMutation()`

3. **Migrate Existing Data** (if you have PostgreSQL data)
   - Export data from PostgreSQL
   - Import to Convex via HTTP actions or scripts

4. **Deploy to Production**
   - Run `bunx convex deploy`
   - Update webhook URL in Clerk to production domain
   - Deploy your Next.js app with production env vars

## 💡 Pro Tips

1. **Keep Convex Dev Running**: The `bunx convex dev` command watches for schema changes and auto-deploys
2. **Use Convex Dashboard**: Great for viewing data, running queries, and debugging
3. **Real-time Updates**: Your UI will automatically update when data changes - no polling needed!
4. **Type Safety**: Convex generates TypeScript types automatically in `convex/_generated/`
5. **Test Webhooks Locally**: Always use ngrok for local webhook testing

## 🆘 Need Help?

- [Convex Docs](https://docs.convex.dev) - Official documentation
- [Convex Discord](https://convex.dev/community) - Community support
- [Clerk Docs](https://clerk.com/docs) - Clerk documentation
- [CONVEX_SETUP.md](./CONVEX_SETUP.md) - Detailed setup guide
- [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) - Migration progress tracker

## ✨ You're Ready!

The Convex backend is configured and ready to use. The foundation for Clerk billing is in place. Now you can start using it in your app! 🎉

**Key Files to Reference:**
- Schema: `/convex/schema.ts`
- Project functions: `/convex/projects.ts`
- Message functions: `/convex/messages.ts`
- Usage/billing: `/convex/usage.ts`
- User sync: `/convex/users.ts`
- Webhook handler: `/src/app/api/webhooks/clerk/route.ts`
