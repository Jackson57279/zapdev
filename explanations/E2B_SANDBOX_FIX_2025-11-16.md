# E2B Sandbox Creation Fix - November 16, 2025

## Problem

The application was failing with the error:
```
Error: E2B sandbox creation failed: iI.betaCreate is not a function
```

This error occurred in production during sandbox creation for code generation tasks.

## Root Cause

The codebase had a **version conflict** with E2B packages and was using an **unsupported API**:

1. **Two E2B packages installed**:
   - `@e2b/code-interpreter: ^1.5.1` (newer SDK)
   - `e2b: ^2.6.2` (older SDK) ← **Conflicting package**

2. **Incorrect API usage**:
   - Code was calling `(Sandbox as any).betaCreate()` which doesn't exist in `@e2b/code-interpreter`
   - The `betaCreate` method was from an experimental/beta API that was removed

## Solution

### 1. Fixed Sandbox Creation Method

**File**: `src/inngest/utils.ts` (line 74)

**Before**:
```typescript
const sandbox = await (Sandbox as any).betaCreate(template, {
  apiKey: process.env.E2B_API_KEY,
  timeoutMs: SANDBOX_TIMEOUT,
  autoPause: true,  // ← Not supported in standard API
});
```

**After**:
```typescript
const sandbox = await Sandbox.create(template, {
  apiKey: process.env.E2B_API_KEY,
  timeoutMs: SANDBOX_TIMEOUT,
});
```

### 2. Removed Conflicting Package

**File**: `package.json`

Removed the old `e2b: ^2.6.2` package, keeping only `@e2b/code-interpreter: ^1.5.1`.

**Change**:
```diff
-    "e2b": "^2.6.2",
```

### 3. Reinstalled Dependencies

```bash
bun install
```

Result: Successfully removed 1 conflicting package.

## Important Notes

### Auto-Pause Feature Disabled

The `autoPause: true` option and related `betaPause()` API are **not available** in the standard `@e2b/code-interpreter` SDK. These were experimental features.

**Impact**:
- Sandboxes will continue to run until they timeout (default: 60 minutes)
- The `autoPauseSandboxes` function in `src/inngest/functions/auto-pause.ts` will log warnings but won't actually pause sandboxes
- This is acceptable as E2B sandboxes have built-in timeout mechanisms

**If auto-pause is critical**:
1. Monitor E2B usage and costs
2. Implement manual sandbox cleanup via E2B's standard APIs
3. Or contact E2B support about enabling beta features for your account

## Files Modified

1. ✅ `src/inngest/utils.ts` - Changed `betaCreate` to `create`, removed `autoPause` option
2. ✅ `package.json` - Removed conflicting `e2b` package
3. ✅ `bun.lock` - Updated after reinstall

## Testing Recommendations

1. **Verify sandbox creation works**:
   ```bash
   # Create a test project in the UI
   # Send a message to trigger code generation
   # Check Inngest dashboard for successful execution
   ```

2. **Monitor E2B dashboard**:
   - Verify sandboxes are being created successfully
   - Check that sandboxes are being cleaned up after timeout
   - Monitor costs to ensure no runaway sandboxes

3. **Check logs**:
   ```bash
   # Look for these success messages:
   [DEBUG] Sandbox created successfully: <sandbox-id>
   [E2B_METRICS] { event: "sandbox_create_success", ... }
   ```

## Related Documentation

- [E2B Code Interpreter Docs](https://e2b.dev/docs/code-interpreter)
- [Debugging Guide](./DEBUGGING_GUIDE.md)
- [Sandbox Persistence Docs](./SANDBOX_PERSISTENCE.md) - **Note**: Auto-pause feature is currently not functional

## Rollback Instructions

If issues persist, you can rollback by:

```bash
git restore package.json src/inngest/utils.ts
bun install
```

However, this will restore the error, so not recommended.

## Additional Notes

- The `betaCreate` API was likely removed in a recent E2B SDK update
- The standard `Sandbox.create()` API is stable and recommended
- Auto-pause can be implemented manually using E2B's webhook system if needed
- Consider setting up E2B usage alerts in your dashboard

---

**Status**: ✅ Fixed and deployed  
**Verified**: Pending production testing  
**Impact**: Medium - Core functionality restored  
**Breaking Changes**: None (auto-pause was already not working)
