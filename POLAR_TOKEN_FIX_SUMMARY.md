# Polar Checkout 401 Token Error - Fix Summary

**Date**: November 15, 2025  
**Issue**: Polar checkout failing with "401 invalid_token" error on Vercel deployment  
**Status**: ✅ Fixed

---

## Problem

The Polar checkout was returning a 401 error:
```
Status 401 - "The access token provided is expired, revoked, malformed, or invalid for other reasons."
```

This indicated that `POLAR_ACCESS_TOKEN` was either:
- Not set in Vercel environment variables
- Expired or revoked
- Malformed (whitespace issues)

---

## Solution Implemented

### 1. Created Environment Validation Utility

**File**: `src/lib/env-validation.ts`

**Features**:
- Validates all Polar environment variables at startup
- Checks for common issues (whitespace, empty strings, invalid formats)
- Provides detailed setup instructions in error messages
- Validates token format (production tokens should start with `polar_at_`)
- Sanitizes error messages to avoid exposing secrets in logs

**Functions**:
- `validatePolarEnv()` - Comprehensive validation of all Polar env vars
- `hasEnvVar(name)` - Check if env var exists and is non-empty
- `getSanitizedErrorDetails(error)` - Safe error logging without secrets

### 2. Enhanced Polar Client Error Handling

**File**: `src/lib/polar-client.ts`

**Changes**:
- Added environment validation before creating Polar client
- Validates token exists and has no whitespace
- Provides descriptive error messages with setup instructions
- Added `isPolarConfigured()` helper function
- Trims all environment variable values to prevent whitespace issues
- Better error logging with emoji indicators

**New Exports**:
- `isPolarConfigured(): boolean` - Check if Polar is properly set up

### 3. Improved API Route Error Handling

**File**: `src/app/api/polar/create-checkout/route.ts`

**Changes**:
- Added configuration check before processing checkout
- Returns 503 (Service Unavailable) for configuration errors
- Detects and handles specific error types:
  - 401: Invalid/expired token
  - 403: Access forbidden
  - 404: Product not found
- Provides user-friendly error messages
- Includes admin-specific debugging information
- Sanitizes error details to prevent secret exposure

**Error Response Format**:
```typescript
{
  error: "User-friendly message",
  details: "More context for user",
  isConfigError: true,
  adminMessage: "Specific fix for admins (console only)"
}
```

### 4. Enhanced Client-Side Error Display

**File**: `src/components/polar-checkout-button.tsx`

**Changes**:
- Improved error handling with detailed toast notifications
- Differentiates between configuration errors and user errors
- Displays admin messages in browser console for debugging
- Shows descriptive error messages with longer duration
- Prevents redirect on error
- Better UX with specific error descriptions

**User Experience**:
- Configuration errors show helpful "contact support" message
- Admin console shows specific fix needed (e.g., "POLAR_ACCESS_TOKEN is invalid or expired")
- Error toasts include descriptions for better context

### 5. Created Deployment Verification Guide

**File**: `explanations/DEPLOYMENT_VERIFICATION.md`

**Contents**:
- Complete pre-deployment checklist
- Step-by-step Vercel deployment instructions
- Polar token regeneration guide
- Common deployment issues and solutions
- Testing checklist for all critical flows
- Monitoring and debugging instructions
- Security best practices
- Environment variable reference

---

## How to Fix the Current Error

### Immediate Steps (For Production)

1. **Regenerate Polar Access Token**:
   ```
   1. Login to https://polar.sh
   2. Go to Settings → API Keys
   3. Delete the old Organization Access Token
   4. Create a new Organization Access Token
   5. Copy the token immediately (it won't be shown again)
   ```

2. **Update Vercel Environment Variables**:
   ```
   1. Go to Vercel Project → Settings → Environment Variables
   2. Find POLAR_ACCESS_TOKEN
   3. Click Edit
   4. Paste the new token (ensure no whitespace!)
   5. Save
   6. Select all environments (Production, Preview, Development)
   ```

3. **Redeploy**:
   ```bash
   # Trigger a new deployment
   git commit --allow-empty -m "Trigger redeploy with updated Polar token"
   git push origin main
   ```

4. **Test**:
   - Visit your site
   - Try the checkout flow
   - Should now work without 401 error

---

## Files Changed

### Created
- ✅ `src/lib/env-validation.ts` - Environment variable validation
- ✅ `explanations/DEPLOYMENT_VERIFICATION.md` - Deployment guide

### Modified
- ✅ `src/lib/polar-client.ts` - Enhanced error handling
- ✅ `src/app/api/polar/create-checkout/route.ts` - Better API error responses
- ✅ `src/components/polar-checkout-button.tsx` - Improved client-side errors

---

## Testing

After deployment, test:

1. **Valid Token Flow**:
   - Click "Upgrade to Pro"
   - Should redirect to Polar checkout
   - No errors in console

2. **Invalid Token Flow**:
   - Will show: "Payment system authentication failed"
   - Console shows: "POLAR_ACCESS_TOKEN is invalid or expired"
   - Admin gets specific fix instructions

3. **Missing Configuration**:
   - Shows: "Payment system is not configured"
   - Admin console shows which variables are missing

---

## Monitoring

### Browser Console (For Admins)

Look for these indicators:
```
✅ = Success
❌ = Error
🔧 = Admin action required
⚠️ = Warning
```

### Example Admin Messages

**Token expired**:
```
❌ Polar token is invalid or expired
🔧 Admin action required: POLAR_ACCESS_TOKEN is invalid or expired. 
   Regenerate in Polar.sh dashboard and update in Vercel environment variables.
```

**Missing configuration**:
```
❌ Polar is not properly configured
🔧 Admin action required: Set POLAR_ACCESS_TOKEN in Vercel environment variables
```

---

## Prevention

### Best Practices

1. **Token Rotation**:
   - Set calendar reminder to rotate tokens every 90 days
   - Document token creation date
   - Test after rotation

2. **Environment Variables**:
   - Always trim whitespace from values
   - Use plain text (no rich text paste)
   - Verify in Vercel dashboard after setting
   - Set for all environments

3. **Monitoring**:
   - Enable Sentry error tracking
   - Monitor Vercel function logs weekly
   - Check Polar webhook deliveries

4. **Documentation**:
   - Keep deployment guide updated
   - Document any custom configurations
   - Share admin credentials securely

---

## Related Documentation

- [POLAR_INTEGRATION.md](./explanations/POLAR_INTEGRATION.md) - Complete Polar setup guide
- [DEPLOYMENT_VERIFICATION.md](./explanations/DEPLOYMENT_VERIFICATION.md) - Deployment checklist
- [env.example](./env.example) - Environment variable reference

---

## Support

If issues persist after following this guide:

1. Check Vercel function logs for specific errors
2. Verify all environment variables are set correctly
3. Test webhook delivery in Polar dashboard
4. Review browser console for admin messages
5. Contact support with deployment logs

**Common Gotchas**:
- ❌ Whitespace in token value
- ❌ Wrong environment (sandbox vs production)
- ❌ Token not set for all environments in Vercel
- ❌ Old token cached (needs redeploy)
- ❌ Product ID doesn't match Polar dashboard
