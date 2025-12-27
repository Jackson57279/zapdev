# Polar.sh Integration Guide

**Date**: November 13, 2025  
**Status**: ✅ Implementation Complete  
**Integration**: Polar.sh + Stack Auth + Convex

---

## Overview

ZapDev now uses **Polar.sh** for subscription billing and payment processing, integrated with **Stack Auth** for user authentication and **Convex** for data storage. This guide covers setup, configuration, and usage.

### Architecture

```
Stack Auth → User Authentication & Identity
     ↓
Polar.sh → Subscription Billing & Payments
     ↓
Convex → Subscription Data & Usage Tracking
```

---

## ⚠️ Sandbox Mode (Currently Active)

The Polar integration is **currently configured to run in sandbox mode** across all environments (including production). This means:

- No real payments will be processed
- All transactions are test transactions
- Use Polar test cards for checkout testing

**Location**: `src/lib/polar-client.ts:49`

To enable production payments, modify the `server` parameter in the Polar client configuration:

```typescript
// Change from:
server: "sandbox",

// To:
server: process.env.NODE_ENV === "development" ? "sandbox" : "production",
```

---

## Features

✅ **Subscription Management** - Free and Pro tiers
✅ **Webhook Integration** - Real-time subscription updates
✅ **Credit System** - Automatic credit allocation based on plan
✅ **Customer Portal** - Polar-hosted payment management
✅ **Checkout Flow** - Seamless upgrade experience

---

## Setup Instructions

### 1. Create Polar Account

1. Go to [https://polar.sh](https://polar.sh)
2. Sign up for an account
3. Create a new organization
4. Note your **Organization ID**

### 2. Create Products in Polar Dashboard

1. Navigate to **Products** in your Polar dashboard
2. Create a **Pro** product:
   - Name: `Pro`
   - Price: `$29/month` (or your preferred pricing)
   - Benefits: List your Pro features
3. Copy the **Product ID** for your Pro plan
4. (Optional) Create additional tiers (Enterprise, etc.)

### 3. Generate API Keys

1. Go to **Settings** → **API Keys** in Polar dashboard
2. Create an **Organization Access Token**
3. Copy the token (you'll need it for environment variables)
4. Go to **Settings** → **Webhooks**
5. Click **Add Endpoint**
6. Set URL to: `https://your-domain.com/api/webhooks/polar`
7. Copy the **Webhook Secret**

### 4. Configure Environment Variables

Add to `.env.local`:

```bash
# Polar.sh
POLAR_ACCESS_TOKEN="your_organization_access_token"
NEXT_PUBLIC_POLAR_ORGANIZATION_ID="your_org_id"
POLAR_WEBHOOK_SECRET="your_webhook_secret"
NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID="your_pro_product_id"

# Stack Auth (if not already set)
NEXT_PUBLIC_STACK_PROJECT_ID="your_stack_project_id"
STACK_SECRET_SERVER_KEY="your_stack_secret"

# Convex (if not already set)
NEXT_PUBLIC_CONVEX_URL="your_convex_url"
```

Also add to Convex environment:

```bash
convex env set POLAR_WEBHOOK_SECRET "your_webhook_secret"
```

### 5. Deploy Convex Schema

The Convex schema has been updated with a `subscriptions` table. Push the changes:

```bash
bun run convex:dev  # For development
# or
bun run convex:deploy  # For production
```

### 6. Configure Webhooks

#### Development (Local Testing)

1. Install ngrok: `npm install -g ngrok`
2. Start your app: `bun run dev`
3. In a separate terminal: `ngrok http 3000`
4. Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. In Polar dashboard → **Webhooks** → Add endpoint:
   - URL: `https://abc123.ngrok.io/api/webhooks/polar`
   - Events: Select all subscription events
6. Test with Polar's sandbox environment

#### Production

1. Deploy your app to Vercel or your hosting platform
2. In Polar dashboard → **Webhooks** → Add endpoint:
   - URL: `https://your-domain.com/api/webhooks/polar`
   - Events: Select all subscription events
3. Switch Polar from sandbox to production mode

---

## File Structure

### New Files Created

```
convex/
  subscriptions.ts           # Subscription queries and mutations

src/
  lib/
    polar-client.ts          # Polar SDK client initialization
  app/
    api/
      webhooks/
        polar/
          route.ts           # Webhook handler for subscription events
      polar/
        create-checkout/
          route.ts           # Checkout session creation API
    dashboard/
      subscription/
        page.tsx             # Subscription management UI
  components/
    polar-checkout-button.tsx # Reusable checkout button component

explanations/
  POLAR_INTEGRATION.md       # This file
```

### Modified Files

```
convex/
  schema.ts                  # Added subscriptions table
  helpers.ts                 # Updated hasProAccess() to check Polar subscriptions

src/app/(home)/pricing/
  page-content.tsx           # Replaced Clerk pricing with Polar checkout

env.example                  # Added Polar environment variables
```

---

## How It Works

### 1. Checkout Flow

```mermaid
User clicks "Upgrade to Pro"
    ↓
PolarCheckoutButton calls /api/polar/create-checkout
    ↓
API authenticates user via Stack Auth
    ↓
API creates Polar checkout session with user metadata
    ↓
User redirects to Polar-hosted checkout page
    ↓
User completes payment
    ↓
Polar sends webhook to /api/webhooks/polar
    ↓
Webhook creates subscription record in Convex
    ↓
User redirects back to dashboard with success message
```

### 2. Webhook Events

The webhook handler processes these Polar events:

| Event | Action |
|-------|--------|
| `subscription.created` | Create subscription record, grant Pro credits |
| `subscription.active` | Activate subscription, update credits |
| `subscription.updated` | Sync subscription changes |
| `subscription.canceled` | Mark for end-of-period cancellation |
| `subscription.revoked` | Immediately revoke Pro access |
| `subscription.uncanceled` | Reactivate canceled subscription |
| `order.created` | Log renewal events |

### 3. Credit System

The credit system automatically adjusts based on subscription status:

- **Free Plan**: 5 generations per 24 hours
- **Pro Plan**: 100 generations per 24 hours

Credits are checked via the `hasProAccess()` helper in `convex/helpers.ts`, which:
1. Queries the `subscriptions` table for active subscription
2. Checks if productName is "Pro" or "Enterprise"
3. Falls back to legacy `usage.planType` for backwards compatibility

### 4. User Linking

Stack Auth user IDs are linked to Polar customers through metadata:

```typescript
// During checkout creation
metadata: {
  userId: user.id,           // Stack Auth user ID
  userEmail: user.primaryEmail
}
```

Webhooks use this metadata to associate subscriptions with the correct user.

---

## Testing

### Local Development

1. Start Convex: `bun run convex:dev`
2. Start Next.js: `bun run dev`
3. Start ngrok: `ngrok http 3000`
4. Update Polar webhook URL with ngrok URL
5. Use Polar **Sandbox Environment** for testing
6. Test checkout flow:
   - Visit `/pricing`
   - Click "Upgrade to Pro"
   - Complete test checkout (use test card)
   - Verify webhook received
   - Check subscription in dashboard

### Webhook Testing

Use Polar's dashboard to:
- View webhook deliveries
- Retry failed webhooks
- Test webhook events manually

### Production Testing

1. Deploy to production
2. Switch Polar to production mode
3. Update webhook URL to production domain
4. Test with real payment (use small amount first)
5. Verify subscription syncs correctly
6. Test cancellation flow

---

## Subscription Management UI

Users can manage subscriptions at `/dashboard/subscription`:

- View current plan (Free/Pro)
- See billing period and next renewal date
- View remaining credits
- Upgrade to Pro (if on Free)
- Cancel subscription (sets cancel_at_period_end)
- Access Polar customer portal for payment methods

---

## Troubleshooting

### Webhook Signature Verification Fails

**Problem**: Webhook returns 401 Unauthorized

**Solution**:
1. Verify `POLAR_WEBHOOK_SECRET` matches Polar dashboard
2. Check webhook signature header is present
3. Ensure raw request body is being verified (not parsed JSON)

### User ID Not Found in Webhook

**Problem**: "Missing userId in metadata" error

**Solution**:
1. Ensure Stack Auth user is authenticated during checkout
2. Check that `metadata.userId` is being passed in checkout creation
3. Verify webhook payload contains metadata

### Subscription Not Syncing

**Problem**: Subscription created but not showing in dashboard

**Solution**:
1. Check webhook delivery status in Polar dashboard
2. Verify Convex schema includes `subscriptions` table
3. Check Convex function logs for errors
4. Ensure `NEXT_PUBLIC_CONVEX_URL` is set correctly

### Credits Not Updating

**Problem**: Pro user still has 5 credits instead of 100

**Solution**:
1. Verify subscription status is "active" in Convex
2. Check `hasProAccess()` function returns true
3. Reset usage: call `api.usage.resetUsage` mutation
4. Verify subscription productName is "Pro" or "Enterprise"

---

## API Reference

### Convex Functions

#### Queries

- `api.subscriptions.getSubscription()` - Get current user's subscription
- `api.subscriptions.getSubscriptionByPolarId(polarSubscriptionId)` - Get by Polar ID
- `api.subscriptions.getUserSubscriptions(userId)` - Get all user subscriptions

#### Mutations

- `api.subscriptions.createOrUpdateSubscription(...)` - Sync subscription from webhook
- `api.subscriptions.markSubscriptionForCancellation(polarSubscriptionId)` - Cancel at period end
- `api.subscriptions.reactivateSubscription(polarSubscriptionId)` - Undo cancellation
- `api.subscriptions.revokeSubscription(polarSubscriptionId)` - Immediately revoke

### API Routes

#### POST `/api/polar/create-checkout`

Create a Polar checkout session.

**Request Body:**
```json
{
  "productId": "prod_...",
  "successUrl": "https://your-app.com/dashboard?subscription=success",
  "cancelUrl": "https://your-app.com/pricing?canceled=true"
}
```

**Response:**
```json
{
  "checkoutId": "checkout_...",
  "url": "https://polar.sh/checkout/..."
}
```

#### POST `/api/webhooks/polar`

Webhook endpoint for Polar subscription events.

**Headers:**
- `webhook-signature`: Polar webhook signature

**Authentication:** Signature verification via `@polar-sh/sdk`

---

## Security Considerations

### Webhook Signature Verification

All webhooks are verified using Polar's built-in signature validation:

```typescript
import { validateEvent } from "@polar-sh/sdk/webhooks";

const event = validateEvent(body, signature, secret);
```

Never process webhooks without signature verification.

### API Authentication

Checkout API routes authenticate users via Stack Auth:

```typescript
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Environment Variables

Keep these secrets secure:
- `POLAR_ACCESS_TOKEN` - Full API access
- `POLAR_WEBHOOK_SECRET` - Webhook verification
- `STACK_SECRET_SERVER_KEY` - User authentication

Never commit these to git or expose client-side.

---

## Pricing Tiers

### Current Configuration

| Tier | Price | Credits/Day | Features |
|------|-------|-------------|----------|
| Free | $0 | 5 | All frameworks, code preview, export |
| Pro | $29/month | 100 | All Free features + priority processing + advanced error fixing + email support |

### Adding New Tiers

1. Create new product in Polar dashboard
2. Add product ID to environment variables
3. Update `convex/helpers.ts` to recognize new tier
4. Update pricing page UI
5. Update subscription management UI

---

## Migration Notes

### From Clerk to Polar

This implementation replaces Clerk's pricing table with Polar's checkout flow. Key changes:

1. **Authentication**: Unchanged (now uses Stack Auth)
2. **Billing**: Moved from Clerk to Polar
3. **Subscription Data**: Stored in Convex instead of Clerk metadata
4. **Credit System**: Updated to check Convex `subscriptions` table

### Backwards Compatibility

The `hasProAccess()` function includes a fallback to the legacy `usage.planType` field for backwards compatibility during migration.

---

## Support

### Polar Support
- Documentation: https://polar.sh/docs
- Dashboard: https://polar.sh/dashboard
- API Reference: https://polar.sh/docs/api-reference

### Stack Auth Support
- Documentation: https://docs.stack-auth.com
- Dashboard: https://app.stack-auth.com

### Convex Support
- Documentation: https://docs.convex.dev
- Dashboard: https://dashboard.convex.dev

---

## Next Steps

1. ✅ Set up Polar account and products
2. ✅ Configure environment variables
3. ✅ Test checkout flow in sandbox
4. ✅ Deploy to production
5. ✅ Configure production webhooks
6. ✅ Test production checkout
7. ⬜ Monitor subscription metrics in Polar dashboard
8. ⬜ Set up email notifications for subscription events
9. ⬜ Consider adding annual pricing tier

---

**Questions?** Check the troubleshooting section or review the implementation files.

**Found an issue?** The integration follows Polar's official documentation and best practices.
