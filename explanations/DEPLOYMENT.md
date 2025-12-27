# Deployment Guide for Vercel

This guide will help you deploy the ZapDev application to Vercel with Inngest Cloud integration.

## Prerequisites

- Vercel account
- Inngest Cloud account
- PostgreSQL database (Neon, Supabase, or any PostgreSQL provider)
- Clerk account for authentication
- E2B account for sandboxes
- Vercel AI Gateway configured

## Step 1: Set Up Inngest Cloud

1. **Create an Inngest Account**
   - Go to [Inngest Cloud](https://app.inngest.com)
   - Sign up or log in

2. **Create a New App**
   - Click "Create App" in the dashboard
   - Name your app (e.g., "zapdev-production")
   
3. **Get Your Keys**
   - Navigate to your app settings
   - Copy the **Event Key** (starts with `ac9_`)
   - Copy the **Signing Key** (starts with `signkey-`)

## Step 2: Deploy to Vercel

1. **Fork or Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd nextjs-zapdev
   ```

2. **Push to GitHub**
   - Create a new repository on GitHub
   - Push your code to GitHub

3. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

## Step 3: Configure Environment Variables in Vercel

In your Vercel project settings, add the following environment variables:

### Database
- `DATABASE_URL`: Your PostgreSQL connection string

### Application
- `NEXT_PUBLIC_APP_URL`: Your production URL (e.g., `https://your-app.vercel.app`)

### Vercel AI Gateway
- `AI_GATEWAY_API_KEY`: Your Vercel AI Gateway API key
- `AI_GATEWAY_BASE_URL`: `https://ai-gateway.vercel.sh/v1/`

### E2B
- `E2B_API_KEY`: Your E2B API key

### Clerk Authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: From Clerk dashboard
- `CLERK_SECRET_KEY`: From Clerk dashboard
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`: `/`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`: `/`

### Inngest
- `INNGEST_EVENT_KEY`: Your Inngest Event Key (from Step 1)
- `INNGEST_SIGNING_KEY`: Your Inngest Signing Key (from Step 1)

## Step 4: Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete

## Step 5: Sync with Inngest Cloud

After deployment, you need to sync your app with Inngest:

1. **Get Your Vercel App URL**
   - Copy your deployed app URL (e.g., `https://your-app.vercel.app`)

2. **Add Your App to Inngest**
   - Go to [Inngest Dashboard](https://app.inngest.com)
   - Navigate to your app
   - Click "Sync App"
   - Add your app URL: `https://your-app.vercel.app/api/inngest`
   - Click "Sync"

3. **Verify the Connection**
   - Inngest will attempt to connect to your endpoint
   - You should see your `codeAgentFunction` listed
   - The status should show as "Connected"

## Step 6: Configure Webhooks (Production)

For production, update Clerk to send webhooks to your Vercel deployment:

1. Go to Clerk Dashboard → Webhooks
2. Update webhook URL to: `https://your-app.vercel.app/api/webhooks/clerk`

## Step 7: Database Migration

Run database migrations for your production database:

```bash
# Set your production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy
```

## Monitoring

### Inngest Dashboard
- Monitor function runs at [app.inngest.com](https://app.inngest.com)
- View logs, errors, and replay failed functions

### Vercel Dashboard
- Monitor deployments and function logs
- Check API usage and performance

### Vercel AI Gateway
- Monitor AI API usage at [Vercel AI Gateway Dashboard](https://vercel.com/dashboard/ai-gateway)

## Troubleshooting

### Inngest Not Processing Events

1. **Check Sync Status**
   - Go to Inngest dashboard
   - Verify your app is synced and shows "Connected"
   - Re-sync if necessary

2. **Verify Environment Variables**
   - Ensure `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are set in Vercel
   - Redeploy after adding/changing environment variables

3. **Check Function Logs**
   - View logs in Inngest dashboard
   - Check Vercel function logs for API route errors

### AI Generation Not Working

1. **Verify AI Gateway**
   - Test with: `curl -X POST https://your-app.vercel.app/api/test-ai`
   - Check Vercel AI Gateway dashboard for usage

2. **Check E2B Sandboxes**
   - Verify E2B_API_KEY is correct
   - Check E2B dashboard for sandbox creation

### Database Issues

1. **Connection String**
   - Ensure DATABASE_URL includes `?sslmode=require` for production
   - Check connection pooling settings

2. **Migrations**
   - Run `npx prisma migrate deploy` if schema is out of sync

## Local Development with Inngest Cloud

If you want to test Inngest Cloud locally:

1. **Use ngrok or localtunnel** to expose your local server:
   ```bash
   npx localtunnel --port 3000
   ```

2. **Sync with Inngest**
   - Use the tunnel URL: `https://your-tunnel.loca.lt/api/inngest`
   - This allows testing cloud events locally

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Database migrated
- [ ] Inngest app synced
- [ ] Clerk webhooks configured
- [ ] E2B template built and named correctly
- [ ] Vercel AI Gateway working
- [ ] Test user registration flow
- [ ] Test AI code generation
- [ ] Monitor first few function runs

## Support

- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [E2B Documentation](https://e2b.dev/docs)
