# Polar.sh Integration - Quick Start Guide

**⏱️ Setup Time: ~15 minutes**

---

## Step 1: Polar Dashboard Setup (5 min)

1. **Create Account**: Visit https://polar.sh
2. **Create Organization**: Add your company name
3. **Create Product**:
   - Name: `Pro`
   - Price: `$29` USD per month
   - Click "Create Product"
   - **Copy the Product ID** (you'll need this)

4. **Get API Keys**:
   - Go to **Settings** → **API Keys**
   - Click "Create Token"
   - Name: `ZapDev Production`
   - **Copy the token** (won't be shown again)

5. **Get Webhook Secret**:
   - Go to **Settings** → **Webhooks**
   - Click "Add Endpoint"
   - URL: `https://your-domain.com/api/webhooks/polar` (or ngrok for local)
   - Select all events
   - **Copy the Webhook Secret**

---

## Step 2: Environment Variables (2 min)

Add to `.env.local`:

```bash
# Polar.sh
POLAR_ACCESS_TOKEN="polar_at_..."
NEXT_PUBLIC_POLAR_ORGANIZATION_ID="your_org_id"
POLAR_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID="prod_..."

# Make sure these are already set:
NEXT_PUBLIC_STACK_PROJECT_ID="..."
STACK_SECRET_SERVER_KEY="..."
NEXT_PUBLIC_CONVEX_URL="..."
```

Add to Convex:
```bash
convex env set POLAR_WEBHOOK_SECRET "whsec_..."
```

---

## Step 3: Deploy Schema (2 min)

```bash
# Push the new subscriptions table to Convex
bun run convex:deploy
```

Wait for deployment to complete. You should see the new `subscriptions` table in your Convex dashboard.

---

## Step 4: Local Testing (5 min)

### Terminal 1: Start Convex
```bash
bun run convex:dev
```

### Terminal 2: Start Next.js
```bash
bun run dev
```

### Terminal 3: Start ngrok (for webhooks)
```bash
ngrok http 3000
```

**Update Polar Webhook URL**:
1. Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
2. Go to Polar dashboard → Webhooks
3. Update endpoint URL to: `https://abc123.ngrok.io/api/webhooks/polar`

---

## Step 5: Test the Flow (1 min)

1. **Visit pricing page**: http://localhost:3000/pricing
2. **Click "Upgrade to Pro"**
3. **Use Polar test card**: 
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. **Complete checkout**
5. **Check terminal logs** for webhook event
6. **Visit subscription page**: http://localhost:3000/dashboard/subscription
7. **Verify Pro status** with 100 credits

---

## ✅ Verification Checklist

- [ ] Pricing page shows Free and Pro tiers
- [ ] "Upgrade to Pro" button redirects to Polar checkout
- [ ] Test checkout completes successfully
- [ ] Webhook received (check terminal logs)
- [ ] Subscription visible in Convex dashboard
- [ ] `/dashboard/subscription` shows Pro status
- [ ] Credits updated to 100/day
- [ ] Can create 100 AI generations

---

## 🚨 Troubleshooting

### Webhook not received?
- Check ngrok is running
- Verify webhook URL in Polar dashboard
- Check for ngrok timeout (restart if needed)

### Checkout fails?
- Verify `POLAR_ACCESS_TOKEN` is set
- Check Polar is in sandbox mode for testing
- Verify product ID matches environment variable

### Subscription not showing?
- Check Convex deployment completed
- Verify webhook received in terminal logs
- Check Convex dashboard for subscription record

---

## 🎉 You're Done!

Your Polar.sh integration is working! Now you can:

- Accept real subscriptions in production
- Add more pricing tiers
- Track revenue in Polar dashboard
- Manage subscriptions via customer portal

---

## 📖 Next Steps

- **Production Deploy**: See `POLAR_STACK_AUTH_INTEGRATION_SUMMARY.md`
- **Full Documentation**: See `explanations/POLAR_INTEGRATION.md`
- **Switch to Production**: Change Polar from sandbox to production mode

---

**Need help?** All code is documented with inline comments. Check the implementation files for details.
