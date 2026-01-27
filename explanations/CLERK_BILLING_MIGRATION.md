# Clerk Billing Migration Progress

## Phase 1: Setup Clerk Billing (Dashboard Configuration) ⏳
- [ ] Enable Clerk Billing in Clerk Dashboard (Manual step - REQUIRED)
- [ ] Create Free Plan (5 generations/day) in Dashboard (Manual step - REQUIRED)
- [ ] Create Pro Plan ($29/month, 100 generations/day) in Dashboard (Manual step - REQUIRED)
- [ ] Configure Stripe payment gateway in Clerk (Manual step - REQUIRED)

## Phase 2: Update Schema & Data Model ✅
- [x] Update convex/schema.ts for Clerk Billing structure
  - Changed from Stripe-specific fields (customerId, subscriptionId, priceId)
  - Added Clerk-specific fields (clerkSubscriptionId, planId, planName, features)

## Phase 3: Replace Custom Billing with Clerk Components ✅
- [x] Update src/app/(home)/pricing/page-content.tsx with <PricingTable />
  - Removed custom pricing cards and checkout logic
  - Replaced with Clerk's `<PricingTable />` component

## Phase 4: Update Access Control ✅
- [x] Update convex/helpers.ts to use Clerk's plan checking
  - Updated `hasProAccess()` to check for Clerk plan names
  - Added `hasPlan()` helper for checking specific plans
  - Added `hasFeature()` helper for checking specific features

## Phase 5: Update Webhook Handlers ✅
- [x] Update src/app/api/webhooks/clerk/route.ts with billing events
  - Added handlers for subscription.created, subscription.updated, subscription.deleted
  - Integrated with Convex mutations for subscription management

## Phase 6: Remove Stripe-Specific Code ✅
- [x] Delete src/app/api/billing/checkout/route.ts
- [x] Delete src/app/api/webhooks/stripe/route.ts
- [x] Delete src/lib/stripe.ts

## Phase 7: Update Environment Variables ✅
- [x] Update env.example
  - Added CLERK_WEBHOOK_SECRET
  - Added Clerk Billing configuration notes
  - Removed Polar.sh variables (legacy)

## Phase 8: Update Usage System ✅
- [x] Verify convex/usage.ts works with Clerk plans
  - Already compatible - uses `hasProAccess()` which now checks Clerk subscriptions
  - No changes needed

---

## Manual Steps Required:

1. **Enable Clerk Billing:**
   - Go to https://dashboard.clerk.com/~/billing/settings
   - Enable Billing for your application
   - Choose payment gateway (Clerk development gateway for dev, Stripe account for production)

2. **Create Plans:**
   - Go to https://dashboard.clerk.com/~/billing/plans
   - Select "Plans for Users" tab
   - Create "Free" plan:
     - Name: Free
     - Price: $0/month
     - Features: 5 generations per day
     - Mark as "Publicly available"
   - Create "Pro" plan:
     - Name: Pro
     - Price: $29/month
     - Features: 100 generations per day
     - Mark as "Publicly available"

3. **Note Plan IDs:**
   - After creating plans, note down the plan IDs (e.g., "plan_xxxxx")
   - You'll use these for access control with `has({ plan: 'plan_id' })`

4. **Configure Webhooks:**
   - Clerk will automatically handle billing webhooks
   - Ensure your webhook endpoint is configured in Clerk Dashboard
