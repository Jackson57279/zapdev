# Deployment Verification Guide

**Last Updated**: November 15, 2025  
**Purpose**: Ensure all environment variables and configurations are properly set for production deployment

---

## Pre-Deployment Checklist

### 1. Vercel Environment Variables

Before deploying to Vercel, verify all required environment variables are set:

#### Authentication (Stack Auth)
- [ ] `NEXT_PUBLIC_STACK_PROJECT_ID` - Your Stack project ID
- [ ] `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` - Stack publishable key
- [ ] `STACK_SECRET_SERVER_KEY` - Stack secret server key

#### Payment Processing (Polar.sh)
- [ ] `POLAR_ACCESS_TOKEN` - Organization Access Token
- [ ] `NEXT_PUBLIC_POLAR_ORGANIZATION_ID` - Your Polar organization ID
- [ ] `POLAR_WEBHOOK_SECRET` - Webhook signing secret
- [ ] `NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID` - Pro product ID

#### AI & Code Execution
- [ ] `AI_GATEWAY_API_KEY` - Vercel AI Gateway API key
- [ ] `AI_GATEWAY_BASE_URL` - Set to `https://ai-gateway.vercel.sh/v1/`
- [ ] `E2B_API_KEY` - E2B Code Interpreter API key

#### Database & Backend
- [ ] `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- [ ] `CONVEX_DEPLOYMENT` - Convex deployment name

#### Background Jobs
- [ ] `INNGEST_EVENT_KEY` - Inngest event key
- [ ] `INNGEST_SIGNING_KEY` - Inngest signing key

#### Optional Services
- [ ] `FIRECRAWL_API_KEY` - For web scraping (optional)
- [ ] `UPLOADTHING_TOKEN` - For file uploads (optional)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Error tracking (optional)
- [ ] OAuth credentials (Google, GitHub, Figma) if enabled

---

## Vercel Deployment Steps

### Step 1: Set Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all required variables listed above
4. Important: Set variables for **Production**, **Preview**, and **Development** environments

**Common Mistakes to Avoid:**
- ❌ Leading/trailing whitespace in values
- ❌ Missing quotes for multi-word values
- ❌ Copy-pasting formatted text (use plain text)
- ❌ Using development tokens in production
- ❌ Forgetting to set for all environments

### Step 2: Verify Polar Token is Valid

**Polar Access Token Issues** are the most common deployment problem. Verify:

1. **Check Token Expiration**:
   - Login to [Polar.sh](https://polar.sh)
   - Go to **Settings** → **API Keys**
   - Check if your Organization Access Token is still active
   
2. **Regenerate if Expired/Invalid**:
   ```bash
   # If you see "401 invalid_token" errors:
   # 1. Delete old token in Polar dashboard
   # 2. Create new Organization Access Token
   # 3. Copy the new token immediately (it won't be shown again)
   # 4. Update in Vercel environment variables
   ```

3. **Validate Token Format**:
   - Production tokens should start with `polar_at_`
   - Must not contain whitespace
   - Should be copied exactly as shown (no truncation)

### Step 3: Configure Webhooks

1. **Polar Webhooks**:
   ```
   URL: https://your-domain.com/api/webhooks/polar
   Events: All subscription and payment events
   ```
   - Copy the webhook secret
   - Add to `POLAR_WEBHOOK_SECRET` in Vercel

2. **Inngest Webhooks** (if using):
   ```
   URL: https://your-domain.com/api/inngest
   ```

### Step 4: Deploy & Test

1. **Deploy to Vercel**:
   ```bash
   git push origin main  # Triggers automatic deployment
   ```

2. **Monitor Build Logs**:
   - Watch for environment variable validation errors
   - Check for any missing dependencies
   - Verify build completes successfully

3. **Test Critical Paths**:
   - [ ] User authentication (sign up, sign in)
   - [ ] Checkout flow (click upgrade button)
   - [ ] Project creation
   - [ ] AI code generation
   - [ ] Webhook processing

---

## Common Deployment Issues

### Issue 1: "401 invalid_token" Error

**Symptoms:**
```
Status 401 - "The access token provided is expired, revoked, malformed, or invalid"
```

**Solution:**
1. Regenerate Polar access token in dashboard
2. Update `POLAR_ACCESS_TOKEN` in Vercel
3. Redeploy application
4. Clear browser cache and test again

**Prevention:**
- Set calendar reminder to regenerate tokens quarterly
- Use token rotation best practices
- Monitor error logs for authentication failures

### Issue 2: Checkout Button Fails with "Payment system unavailable"

**Symptoms:**
- Button shows loading spinner then error toast
- Console shows configuration error
- Browser console has admin message

**Solution:**
1. Check all Polar environment variables are set:
   ```bash
   POLAR_ACCESS_TOKEN
   NEXT_PUBLIC_POLAR_ORGANIZATION_ID
   POLAR_WEBHOOK_SECRET
   NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID
   ```
2. Verify no whitespace in values
3. Confirm product ID exists in Polar dashboard
4. Redeploy after fixing

### Issue 3: Webhooks Not Processing

**Symptoms:**
- Subscription created but not reflected in app
- User can pay but doesn't get pro features

**Solution:**
1. Verify webhook URL is correct in Polar dashboard
2. Check webhook secret matches `POLAR_WEBHOOK_SECRET`
3. Test webhook delivery in Polar dashboard
4. Check Vercel function logs for errors
5. Verify Convex is receiving updates

### Issue 4: Build Failures

**Symptoms:**
```
Error: Environment validation failed
```

**Solution:**
1. Check which variables are missing in build logs
2. Add missing variables to Vercel
3. Ensure all required variables are set
4. Redeploy

---

## Testing Checklist

After deployment, test these flows:

### Authentication Flow
```
1. Visit homepage
2. Click "Sign Up"
3. Complete registration
4. Verify email
5. Access dashboard
```

### Payment Flow
```
1. Login as authenticated user
2. Click "Upgrade to Pro"
3. Should redirect to Polar checkout (no errors)
4. Complete test payment (use Polar test mode)
5. Verify subscription shows in dashboard
6. Verify credits updated
```

### AI Generation Flow
```
1. Create new project
2. Send message to AI
3. Verify code generation starts
4. Check E2B sandbox executes
5. Verify code saves to Convex
6. Check usage credits decrement
```

### Webhook Flow
```
1. Make test payment in Polar
2. Check Vercel function logs for webhook receipt
3. Verify subscription saved in Convex
4. Confirm user sees updated subscription status
```

---

## Monitoring & Debugging

### Check Vercel Logs

1. Go to Vercel dashboard → **Deployments**
2. Click latest deployment
3. View **Functions** tab for API route logs
4. Search for errors with keywords:
   - `Polar`
   - `401`
   - `invalid_token`
   - `checkout error`

### Check Convex Logs

1. Go to Convex dashboard
2. Navigate to **Logs** tab
3. Filter by:
   - Function: `subscriptions`
   - Errors only
4. Look for webhook processing failures

### Check Polar Dashboard

1. Login to [Polar.sh](https://polar.sh)
2. Go to **Webhooks** → **Events**
3. Check recent webhook deliveries
4. Look for failed deliveries or errors
5. Test webhook delivery manually

### Browser Console Debugging

For admins/developers:
- Open browser DevTools (F12)
- Check Console tab for admin messages
- Look for `🔧 Admin action required:` messages
- These provide specific configuration fixes needed

---

## Environment Variable Reference

### Required for Production

```bash
# Application
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"

# Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID="your_project_id"
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY="your_publishable_key"
STACK_SECRET_SERVER_KEY="your_secret_key"

# Polar.sh (Payment Processing)
POLAR_ACCESS_TOKEN="polar_at_..."           # ⚠️ CRITICAL - Must be valid
NEXT_PUBLIC_POLAR_ORGANIZATION_ID="org_..." 
POLAR_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID="prod_..."

# Vercel AI Gateway
AI_GATEWAY_API_KEY="your_gateway_key"
AI_GATEWAY_BASE_URL="https://ai-gateway.vercel.sh/v1/"

# E2B Code Execution
E2B_API_KEY="your_e2b_key"

# Convex Database
NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"
CONVEX_DEPLOYMENT="your_deployment_name"

# Inngest Background Jobs
INNGEST_EVENT_KEY="your_event_key"
INNGEST_SIGNING_KEY="your_signing_key"
```

### Optional (Enable as Needed)

```bash
# Web Scraping
FIRECRAWL_API_KEY="your_firecrawl_key"

# File Uploads
UPLOADTHING_TOKEN="your_uploadthing_token"

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN="your_sentry_dsn"
SENTRY_DSN="your_sentry_dsn"

# OAuth Providers
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
FIGMA_CLIENT_ID="your_figma_client_id"
FIGMA_CLIENT_SECRET="your_figma_client_secret"
```

---

## Security Best Practices

### Secret Management

1. **Never commit secrets to git**:
   - Use `.env.local` for local development
   - Add `.env.local` to `.gitignore`
   - Use Vercel dashboard for production secrets

2. **Rotate tokens regularly**:
   - Polar access tokens: Every 90 days
   - API keys: According to service provider recommendations
   - Webhook secrets: After any security incident

3. **Use environment-specific tokens**:
   - Development: Sandbox/test mode tokens
   - Production: Live mode tokens
   - Never mix environments

4. **Restrict token permissions**:
   - Use least-privilege principle
   - Polar: Organization token (not personal)
   - E2B: Project-specific keys
   - Inngest: App-specific keys

### Monitoring

1. **Set up alerts**:
   - Sentry for error tracking
   - Vercel for deployment failures
   - Polar for payment failures

2. **Regular audits**:
   - Weekly: Check error logs
   - Monthly: Review token usage
   - Quarterly: Rotate all secrets

---

## Support Resources

### Documentation
- [Polar Integration Guide](./POLAR_INTEGRATION.md)
- [Convex Setup](./CONVEX_SETUP.md)
- [Stack Auth Configuration](./AUTH_SETUP.md)

### External Links
- [Polar.sh Dashboard](https://polar.sh)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Convex Dashboard](https://dashboard.convex.dev)
- [Stack Auth Dashboard](https://stack-auth.com/dashboard)

### Getting Help
- Check error logs first
- Review this guide
- Search existing documentation
- Contact support with:
  - Error message
  - Deployment logs
  - Steps to reproduce
  - Environment (production/preview/dev)

---

## Post-Deployment Validation

After successful deployment, verify:

✅ All environment variables are set  
✅ Polar token is valid and not expired  
✅ Webhooks are configured and working  
✅ Authentication flow works  
✅ Checkout flow completes successfully  
✅ AI code generation functions  
✅ Database connections are stable  
✅ Error monitoring is active  

**Need help?** Check the troubleshooting section above or review deployment logs for specific error messages.
