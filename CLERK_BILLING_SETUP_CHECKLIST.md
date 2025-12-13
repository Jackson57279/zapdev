# Clerk Billing Setup Checklist

Use this checklist to complete the Clerk Billing setup after the code migration.

## ✅ Code Migration (Complete)
- [x] Updated database schema
- [x] Replaced pricing page with Clerk components
- [x] Updated access control helpers
- [x] Configured webhook handlers
- [x] Removed Stripe-specific code
- [x] Updated environment variables

## 🔧 Clerk Dashboard Configuration (Required)

### Step 1: Enable Clerk Billing
- [ ] Go to [Clerk Billing Settings](https://dashboard.clerk.com/~/billing/settings)
- [ ] Click "Enable Billing"
- [ ] Read and accept the terms

### Step 2: Configure Payment Gateway

#### For Development:
- [ ] Select "Clerk development gateway"
- [ ] This provides a shared test Stripe account
- [ ] No additional configuration needed

#### For Production:
- [ ] Select "Stripe account"
- [ ] Click "Connect Stripe"
- [ ] Follow OAuth flow to connect your Stripe account
- [ ] **Important:** Use a different Stripe account than development

### Step 3: Create Free Plan
- [ ] Go to [Subscription Plans](https://dashboard.clerk.com/~/billing/plans)
- [ ] Click "Plans for Users" tab
- [ ] Click "Add Plan"
- [ ] Fill in details:
  - **Name:** `Free`
  - **Description:** `Perfect for trying out ZapDev`
  - **Price:** `$0` per `month`
  - **Billing Period:** `Monthly`
  - [ ] Toggle "Publicly available" ON
- [ ] Click "Create Plan"
- [ ] **Copy the Plan ID** (e.g., `plan_xxxxx`) - you'll need this for testing

### Step 4: Create Pro Plan
- [ ] Click "Add Plan" again
- [ ] Fill in details:
  - **Name:** `Pro`
  - **Description:** `For developers building serious projects`
  - **Price:** `$29` per `month`
  - **Billing Period:** `Monthly`
  - [ ] Toggle "Publicly available" ON
- [ ] Click "Create Plan"
- [ ] **Copy the Plan ID** (e.g., `plan_xxxxx`)

### Step 5: Add Features (Optional)
If you want granular feature-based access control:

- [ ] Go to each plan
- [ ] Click "Add Feature"
- [ ] Create features like:
  - `basic_generations` (for Free plan)
  - `advanced_generations` (for Pro plan)
  - `priority_processing` (for Pro plan)
  - `email_support` (for Pro plan)

### Step 6: Configure Webhooks
- [ ] Go to [Webhooks](https://dashboard.clerk.com/~/webhooks)
- [ ] Ensure your webhook endpoint is configured:
  - **Endpoint URL:** `https://your-domain.com/api/webhooks/clerk`
  - **Events to subscribe:**
    - [x] `subscription.created`
    - [x] `subscription.updated`
    - [x] `subscription.deleted`
- [ ] Copy the "Signing Secret"
- [ ] Add to your `.env.local`:
  ```bash
  CLERK_WEBHOOK_SECRET="whsec_xxxxx"
  ```

## 🧪 Testing

### Test in Development
- [ ] Start your development server: `npm run dev`
- [ ] Visit `/pricing` page
- [ ] Verify Clerk's pricing table displays
- [ ] Click "Subscribe" on Pro plan
- [ ] Complete test checkout (use Clerk's test cards)
- [ ] Verify webhook is received in terminal logs
- [ ] Check Convex dashboard for subscription record
- [ ] Test access control:
  ```typescript
  // In your code
  const isPro = await hasProAccess(ctx);
  console.log('Has Pro access:', isPro);
  ```

### Test Cards (Development)
Use these test cards in development:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires Auth:** `4000 0025 0000 3155`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any 5 digits

### Verify Subscription Management
- [ ] Sign in to your app
- [ ] Open `<UserProfile />` component
- [ ] Verify "Billing" tab appears
- [ ] Verify current plan is displayed
- [ ] Test plan upgrade/downgrade
- [ ] Test subscription cancellation

## 🚀 Production Deployment

### Before Deploying:
- [ ] Connect production Stripe account in Clerk Dashboard
- [ ] Verify webhook endpoint is accessible from internet
- [ ] Add `CLERK_WEBHOOK_SECRET` to production environment variables
- [ ] Test with real payment method (small amount)

### After Deploying:
- [ ] Monitor webhook logs for any errors
- [ ] Verify subscriptions are syncing to Convex
- [ ] Test complete user flow from signup to subscription
- [ ] Monitor Stripe dashboard for payments

## 📊 Monitoring

### What to Monitor:
- [ ] Webhook delivery success rate (Clerk Dashboard)
- [ ] Subscription sync errors (application logs)
- [ ] Payment failures (Stripe Dashboard)
- [ ] Access control issues (user reports)

### Clerk Dashboard Metrics:
- [ ] Active subscriptions count
- [ ] Monthly recurring revenue (MRR)
- [ ] Churn rate
- [ ] Conversion rate

## 🔍 Troubleshooting

### Pricing Table Not Showing
- Verify plans are marked as "Publicly available"
- Check browser console for errors
- Ensure Clerk is properly initialized

### Webhook Not Received
- Verify webhook endpoint is accessible
- Check webhook signing secret is correct
- Review Clerk webhook logs in dashboard

### Subscription Not Syncing
- Check Convex logs for mutation errors
- Verify webhook handler is processing events
- Check subscription data structure matches schema

### Access Control Not Working
- Verify subscription status is "active"
- Check plan name matches exactly (case-sensitive)
- Review `hasProAccess()` logic

## 📚 Resources

- [Clerk Billing Documentation](https://clerk.com/docs/billing)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Convex Dashboard](https://dashboard.convex.dev)

## ✅ Final Verification

Once everything is set up:
- [ ] Free users can access basic features
- [ ] Pro users can access all features
- [ ] Subscriptions sync correctly
- [ ] Webhooks are processed without errors
- [ ] Users can manage subscriptions in profile
- [ ] Billing appears in Clerk Dashboard
- [ ] Payments appear in Stripe Dashboard

---

**Status:** Ready for Clerk Dashboard configuration
**Next Step:** Follow Step 1 above to enable Clerk Billing
