# Clerk Billing Quick Reference

## 🎯 Quick Start

### 1. Enable Billing (2 minutes)
```
1. Visit: https://dashboard.clerk.com/~/billing/settings
2. Click "Enable Billing"
3. Choose payment gateway (dev or production)
```

### 2. Create Plans (5 minutes)
```
1. Visit: https://dashboard.clerk.com/~/billing/plans
2. Create "Free" plan: $0/month
3. Create "Pro" plan: $29/month
4. Mark both as "Publicly available"
```

### 3. Add Webhook Secret (1 minute)
```bash
# Add to .env.local
CLERK_WEBHOOK_SECRET="whsec_xxxxx"  # From Clerk Dashboard > Webhooks
```

## 🔑 Key Components

### Pricing Page
```tsx
import { PricingTable } from "@clerk/nextjs";

<PricingTable />
```

### Access Control
```typescript
// Check if user has Pro plan
const isPro = await hasProAccess(ctx);

// Check specific plan
const hasPlan = await hasPlan(ctx, "Pro");

// Check specific feature
const hasFeature = await hasFeature(ctx, "advanced_features");
```

### Protect Component (Client-side)
```tsx
import { Protect } from "@clerk/nextjs";

<Protect
  plan="Pro"
  fallback={<p>Upgrade to Pro to access this feature</p>}
>
  <PremiumFeature />
</Protect>
```

### Server-side Protection
```typescript
import { auth } from "@clerk/nextjs/server";

export default async function ProtectedPage() {
  const { has } = await auth();
  
  if (!has({ plan: "Pro" })) {
    return <div>Upgrade required</div>;
  }
  
  return <div>Premium content</div>;
}
```

## 📊 Database Schema

### Subscriptions Table
```typescript
{
  userId: string;              // Clerk user ID
  clerkSubscriptionId: string; // Clerk subscription ID
  planId: string;              // Plan ID from Clerk
  planName: string;            // "Free" or "Pro"
  status: string;              // "active", "canceled", etc.
  currentPeriodStart: number;  // Timestamp
  currentPeriodEnd: number;    // Timestamp
  cancelAtPeriodEnd: boolean;
  features: string[];          // Optional feature IDs
  metadata: any;               // Optional metadata
}
```

## 🔗 Important URLs

| Resource | URL |
|----------|-----|
| Billing Settings | https://dashboard.clerk.com/~/billing/settings |
| Subscription Plans | https://dashboard.clerk.com/~/billing/plans |
| Webhooks | https://dashboard.clerk.com/~/webhooks |
| Clerk Docs | https://clerk.com/docs/billing |
| Your Pricing Page | /pricing |
| Webhook Endpoint | /api/webhooks/clerk |

## 🧪 Test Cards

| Purpose | Card Number | Result |
|---------|-------------|--------|
| Success | 4242 4242 4242 4242 | Payment succeeds |
| Decline | 4000 0000 0000 0002 | Payment declined |
| Auth Required | 4000 0025 0000 3155 | Requires authentication |

**Expiry:** Any future date  
**CVC:** Any 3 digits  
**ZIP:** Any 5 digits

## 🔍 Debugging

### Check Subscription Status
```typescript
// In Convex query/mutation
const subscription = await ctx.db
  .query("subscriptions")
  .withIndex("by_userId", (q) => q.eq("userId", userId))
  .filter((q) => q.eq(q.field("status"), "active"))
  .first();

console.log("Subscription:", subscription);
```

### Check Webhook Logs
1. Go to Clerk Dashboard > Webhooks
2. Click on your webhook endpoint
3. View "Recent Deliveries"
4. Check for errors

### Common Issues

**Pricing table not showing:**
- Plans must be marked "Publicly available"
- Check browser console for errors

**Webhook not received:**
- Verify endpoint is accessible
- Check signing secret is correct
- Review webhook logs in Clerk Dashboard

**Access control not working:**
- Verify subscription status is "active"
- Check plan name matches exactly (case-sensitive)
- Ensure webhook has synced subscription

## 📝 Code Examples

### Usage in API Route
```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId, has } = await auth();
  
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const isPro = has({ plan: "Pro" });
  
  if (!isPro) {
    return new Response("Upgrade required", { status: 403 });
  }
  
  // Pro-only logic here
  return Response.json({ data: "premium data" });
}
```

### Usage in Server Component
```tsx
import { auth } from "@clerk/nextjs/server";

export default async function PremiumPage() {
  const { has } = await auth();
  
  const isPro = has({ plan: "Pro" });
  
  return (
    <div>
      {isPro ? (
        <PremiumContent />
      ) : (
        <UpgradePrompt />
      )}
    </div>
  );
}
```

### Usage in Client Component
```tsx
"use client";

import { useAuth } from "@clerk/nextjs";

export function PremiumFeature() {
  const { has } = useAuth();
  
  const isPro = has({ plan: "Pro" });
  
  if (!isPro) {
    return <UpgradePrompt />;
  }
  
  return <PremiumContent />;
}
```

## 💰 Pricing

**Clerk Billing Fee:** 0.7% per transaction  
**Stripe Fee:** 2.9% + $0.30 per transaction  
**Total:** 3.6% + $0.30 per transaction

## 🚀 Deployment Checklist

- [ ] Enable Clerk Billing in Dashboard
- [ ] Create Free and Pro plans
- [ ] Add CLERK_WEBHOOK_SECRET to environment
- [ ] Test subscription flow
- [ ] Verify webhook delivery
- [ ] Monitor first few subscriptions
- [ ] Set up Stripe account for production

## 📞 Support

- **Clerk Support:** support@clerk.com
- **Clerk Discord:** https://clerk.com/discord
- **Documentation:** https://clerk.com/docs

---

**Quick Tip:** Start with the Clerk development gateway for testing, then switch to your own Stripe account for production.
