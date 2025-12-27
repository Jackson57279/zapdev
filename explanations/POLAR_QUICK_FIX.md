# Polar.sh 500 Error - Quick Fix Guide

**Issue**: `/api/polar/create-checkout` returns 500 error  
**Cause**: Missing or invalid Polar.sh environment variables  
**Status**: ✅ Fixed with graceful fallback

---

## What Changed

### 1. **Graceful Degradation**
The pricing page now checks if Polar is configured before showing the checkout button:
- ✅ Shows "Contact Support to Upgrade" if not configured
- ✅ Displays warning alert to users
- ✅ Logs helpful debug info in console (dev mode)
- ✅ Prevents 500 errors from reaching users

### 2. **Client-Side Validation**
Added validation checks in `src/app/(home)/pricing/page-content.tsx`:
- Validates `NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID` exists and starts with `prod_`
- Validates `NEXT_PUBLIC_POLAR_ORGANIZATION_ID` exists
- Shows loading state while checking
- Provides clear error messages in development mode

---

## Quick Setup Steps

### Option 1: Set Up Polar.sh (Recommended for Production)

1. **Create Polar Account**
   - Visit https://polar.sh and sign up
   - Create an organization

2. **Create Product**
   ```
   Polar Dashboard → Products → Create Product
   Name: Pro
   Price: $29/month
   Copy the Product ID (starts with "prod_")
   ```

3. **Get API Keys**
   ```
   Polar Dashboard → Settings → API Keys
   Create "Organization Access Token"
   Copy the token (starts with "polar_at_")
   ```

4. **Set Up Webhook**
   ```
   Polar Dashboard → Settings → Webhooks
   Add Endpoint: https://your-domain.com/api/webhooks/polar
   Copy the Webhook Secret (starts with "whsec_")
   ```

5. **Set Environment Variables in Vercel**
   ```bash
   # Go to: Vercel Project → Settings → Environment Variables
   
   POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx
   NEXT_PUBLIC_POLAR_ORGANIZATION_ID=your_org_id
   POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID=prod_xxxxxxxxxxxxx
   ```

6. **Redeploy**
   ```bash
   git commit --allow-empty -m "Trigger redeploy with Polar config"
   git push
   ```

### Option 2: Disable Polar (Quick Fix)

If you want to deploy without setting up Polar immediately:

1. **The app will now handle this gracefully!**
   - No changes needed
   - Users will see "Contact Support to Upgrade" button
   - No 500 errors will occur

2. **Set up Polar later when ready**
   - Follow Option 1 when you're ready to enable payments
   - Deploy to apply the environment variables
   - Checkout will automatically start working

---

## How It Works Now

### Before (❌ Breaking)
```
User clicks "Upgrade to Pro"
  ↓
API call to /api/polar/create-checkout
  ↓
Environment variables missing
  ↓
500 Internal Server Error
  ↓
User sees generic error
```

### After (✅ Graceful)
```
User visits /pricing
  ↓
Client checks if Polar is configured
  ↓
NOT CONFIGURED:
  - Shows disabled button: "Contact Support to Upgrade"
  - Displays alert: "Payment system is currently being configured"
  - Logs warning in console (dev mode only)
  
CONFIGURED:
  - Shows working "Upgrade to Pro" button
  - Checkout works normally
```

---

## Verification Checklist

After setting environment variables:

- [ ] All 4 Polar environment variables are set in deployment platform
- [ ] Variables have no leading/trailing whitespace
- [ ] Product ID starts with `prod_`
- [ ] Access token starts with `polar_at_`
- [ ] Webhook secret starts with `whsec_`
- [ ] Deployment triggered after setting variables
- [ ] Visit `/pricing` - should see working "Upgrade to Pro" button
- [ ] Click button - should redirect to Polar checkout (no 500 error)
- [ ] Browser console shows no Polar warnings

---

## Troubleshooting

### Still seeing 500 error?

1. **Check environment variables are set**
   ```bash
   # In Vercel dashboard
   Project → Settings → Environment Variables
   Verify all 4 Polar variables exist
   ```

2. **Verify token format**
   - POLAR_ACCESS_TOKEN should start with `polar_at_`
   - NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID should start with `prod_`
   - POLAR_WEBHOOK_SECRET should start with `whsec_`

3. **Check token hasn't expired**
   - Login to Polar.sh
   - Go to Settings → API Keys
   - Verify token is active
   - Regenerate if needed

4. **Ensure deployment picked up new env vars**
   ```bash
   # Trigger new deployment
   git commit --allow-empty -m "Redeploy"
   git push
   ```

### Button shows "Contact Support" but variables are set?

1. **Check browser console for warnings**
   - Open DevTools → Console
   - Look for `⚠️ Polar.sh` warnings
   - Follow the instructions in the warning

2. **Verify product ID format**
   - Must start with `prod_`
   - Example: `prod_01HQXXXXXXXXXXXXXX`

3. **Clear browser cache and reload**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Files Modified

1. **`src/app/(home)/pricing/page-content.tsx`**
   - Added `isPolarConfigured` state and validation
   - Added configuration check in `useEffect`
   - Shows alert when not configured
   - Conditionally renders checkout button vs fallback
   - Logs helpful warnings in development mode

---

## Environment Variable Reference

| Variable | Required | Format | Where to Get |
|----------|----------|--------|--------------|
| `POLAR_ACCESS_TOKEN` | Yes | `polar_at_...` | Polar.sh → Settings → API Keys |
| `NEXT_PUBLIC_POLAR_ORGANIZATION_ID` | Yes | alphanumeric | Polar.sh → Dashboard (URL or Settings) |
| `POLAR_WEBHOOK_SECRET` | Yes | `whsec_...` | Polar.sh → Settings → Webhooks |
| `NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID` | Yes | `prod_...` | Polar.sh → Products → [Your Product] |

---

## Related Documentation

- **Full Setup Guide**: `explanations/POLAR_INTEGRATION.md`
- **Deployment Guide**: `explanations/DEPLOYMENT_VERIFICATION.md`
- **Token Fix Details**: `explanations/POLAR_TOKEN_FIX_SUMMARY.md`
- **Environment Template**: `env.example`

---

## Summary

✅ **Problem Solved**: App no longer crashes with 500 error when Polar isn't configured  
✅ **User Experience**: Clear messaging when payment system isn't ready  
✅ **Developer Experience**: Helpful console warnings guide setup  
✅ **Flexibility**: Can deploy without Polar and add it later  

**Next Steps**: 
1. If you want to enable payments, follow **Option 1** above
2. If not ready yet, leave as is - app works fine without it
3. Users will see a clear message about contacting support

---

**Questions?** Check the full integration guide at `explanations/POLAR_INTEGRATION.md`
