# Polar.sh Build Error Fix

## Problem

The Vercel build was failing with the following error:

```
Error: 
🚨 Polar.sh Configuration Error

The following environment variables have issues:

1. POLAR_ACCESS_TOKEN
   Issue: Token format appears invalid (should start with "polar_at_")
```

This happened because:
1. The `polarClient` was being initialized at module load time
2. During Next.js build phase, API routes are pre-rendered/analyzed
3. Environment validation would throw errors when Polar credentials weren't configured
4. This caused the entire build to fail

## Solution

Made Polar.sh integration **optional** to allow builds to succeed without credentials:

### 1. Lazy Client Initialization

**Before:**
```typescript
export const polarClient = createPolarClient(); // Runs at module load
```

**After:**
```typescript
let polarClientInstance: Polar | null = null;

export function getPolarClient(): Polar {
  if (!polarClientInstance) {
    polarClientInstance = createPolarClient();
  }
  return polarClientInstance;
}
```

### 2. Build-Time Detection

Added detection for Next.js build phase:

```typescript
function createPolarClient(): Polar {
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  // Only throw errors at runtime, warn during build
  validatePolarEnv(!isBuildTime);
  
  if (!accessToken) {
    if (isBuildTime) {
      console.warn('⚠️  POLAR_ACCESS_TOKEN not configured');
      return new Polar({ accessToken: 'build-time-placeholder' });
    }
    throw new Error('POLAR_ACCESS_TOKEN is not configured');
  }
}
```

### 3. Flexible Validation

Updated `validatePolarEnv()` to support warning-only mode:

```typescript
export function validatePolarEnv(throwOnError = true): void {
  // ... validation logic ...
  
  if (errors.length > 0) {
    const errorMessage = formatEnvErrors(errors);
    
    if (throwOnError) {
      throw new Error(errorMessage);
    } else {
      console.warn(errorMessage); // Just warn during build
    }
  }
}
```

### 4. Backward Compatibility

Kept `polarClient` export using a lazy Proxy:

```typescript
export const polarClient = new Proxy({} as Polar, {
  get(_target, prop) {
    return getPolarClient()[prop as keyof Polar];
  }
});
```

### 5. Updated API Routes

Changed direct imports to use lazy getter:

```typescript
// Before
import { polarClient } from "@/lib/polar-client";
const checkout = await polarClient.checkouts.create(...);

// After
import { getPolarClient } from "@/lib/polar-client";
const polar = getPolarClient();
const checkout = await polar.checkouts.create(...);
```

## Benefits

✅ **Build succeeds** even without Polar credentials configured  
✅ **Runtime validation** still works when Polar features are used  
✅ **Helpful errors** guide developers to configure Polar properly  
✅ **Backward compatible** with existing code  
✅ **No production impact** - validation still enforces correct config

## Behavior

### During Build (CI/CD)
- Polar validation logs **warnings** instead of throwing errors
- Placeholder client created to satisfy type checking
- Build completes successfully

### At Runtime (Production)
- First Polar API call triggers lazy initialization
- Full validation runs and throws errors if misconfigured
- API routes return helpful error messages:
  ```json
  {
    "error": "Payment system is not configured",
    "details": "Please contact support. Configuration issue detected.",
    "isConfigError": true
  }
  ```

## Testing

Verified the fix works:

```bash
# Build without Polar credentials
bun run build
# ✓ Compiled successfully

# Build with invalid token
POLAR_ACCESS_TOKEN="invalid" bun run build
# ⚠️  Warning logged, build succeeds

# Runtime with invalid token
curl /api/polar/create-checkout
# Returns 503 with helpful error message
```

## Files Changed

1. **`src/lib/polar-client.ts`**
   - Added lazy initialization with `getPolarClient()`
   - Added build-time detection
   - Created Proxy for backward compatibility

2. **`src/lib/env-validation.ts`**
   - Added `throwOnError` parameter
   - Support warning-only mode

3. **`src/app/api/polar/create-checkout/route.ts`**
   - Updated to use `getPolarClient()` instead of direct import

## Migration Guide

For any code using `polarClient`, update to use `getPolarClient()`:

```typescript
// Old pattern (still works but deprecated)
import { polarClient } from "@/lib/polar-client";
await polarClient.checkouts.create(...);

// New pattern (recommended)
import { getPolarClient } from "@/lib/polar-client";
const polar = getPolarClient();
await polar.checkouts.create(...);
```

## Related Documentation

- See `explanations/POLAR_INTEGRATION.md` for Polar setup
- See `explanations/DEPLOYMENT_VERIFICATION.md` for deployment checklist
- See `POLAR_TOKEN_FIX_SUMMARY.md` for token validation enhancements
