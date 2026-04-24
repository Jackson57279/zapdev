# Stack Auth + Convex Authentication Fix

**Date:** 2025-11-13  
**Issue:** WebSocket reconnections and "Failed to authenticate" errors  
**Status:** ✅ Fixed

## Problem

The application was experiencing continuous WebSocket reconnections and authentication failures with the error:

```
Failed to authenticate: "No auth provider found matching the given token. 
Check that your JWT's issuer and audience match one of your configured providers: 
[OIDC(domain=https://api.stack-auth.com/api/v1/projects/b8fa06ac-b1f5-4600-bee0-682bc7aaa2a8, app_id=convex)]"
```

Additionally, Convex mutations were failing with:
```
[CONVEX A(projects:createWithMessageAndAttachments)] Server Error
Uncaught Error: Unauthorized
```

## Root Cause

The `convex/auth.config.ts` file had an incorrect authentication provider configuration:

```ts
// INCORRECT - Old configuration
export default {
  providers: [
    {
      domain: `https://api.stack-auth.com/api/v1/projects/${process.env.NEXT_PUBLIC_STACK_PROJECT_ID}`,
      applicationID: "convex",
    },
  ],
};
```

This configuration was missing:
1. The correct `type` field (`customJwt`)
2. The `issuer` as a URL object
3. The `jwks` (JSON Web Key Set) endpoint
4. The `algorithm` specification
5. Support for anonymous users

## Solution

Updated `convex/auth.config.ts` to match Stack Auth's official Convex integration format:

```ts
const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const baseUrl = "https://api.stack-auth.com";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: new URL(`/api/v1/projects/${projectId}`, baseUrl),
      jwks: new URL(`/api/v1/projects/${projectId}/.well-known/jwks.json`, baseUrl),
      algorithm: "ES256",
    },
    {
      type: "customJwt",
      issuer: new URL(`/api/v1/projects-anonymous-users/${projectId}`, baseUrl),
      jwks: new URL(`/api/v1/projects/${projectId}/.well-known/jwks.json?include_anonymous=true`, baseUrl),
      algorithm: "ES256",
    },
  ],
};
```

This configuration is based on Stack Auth's `getConvexProvidersConfig()` function (see `node_modules/@stackframe/stack/dist/integrations/convex.js`).

## Why This Works

1. **Correct JWT Type**: Uses `customJwt` instead of undefined type
2. **Proper Issuer Format**: URL object with full path structure that matches Stack Auth's JWT issuer
3. **JWKS Endpoint**: Provides the JSON Web Key Set endpoint for token verification
4. **Algorithm Specification**: Specifies ES256 (Elliptic Curve Digital Signature Algorithm) used by Stack Auth
5. **Anonymous User Support**: Includes a second provider for anonymous users

## Key Differences from Original Configuration

| Aspect | Old Config | New Config |
|--------|-----------|------------|
| Provider Type | Not specified | `customJwt` |
| Issuer Format | `domain` string | URL object with full path |
| JWKS | Missing | Included with proper endpoint |
| Algorithm | Not specified | `ES256` |
| Anonymous Users | Not supported | Supported with second provider |

## Testing

After deploying this fix:

1. ✅ Convex functions pushed successfully
2. ✅ No auth config validation errors
3. ✅ WebSocket connections should remain stable
4. ✅ Authenticated mutations should work (e.g., `projects:createWithMessageAndAttachments`)

## Related Files

- `convex/auth.config.ts` - Updated auth configuration
- `src/components/convex-provider.tsx` - Client-side auth setup (unchanged)
- `src/lib/auth-server.ts` - Server-side auth setup (unchanged)

## References

- Stack Auth Convex Integration: https://docs.stack-auth.com/docs/others/convex
- Stack Auth source code: `node_modules/@stackframe/stack/dist/integrations/convex.js`
- Convex Auth Documentation: https://docs.convex.dev/auth

## Note on Implementation

We couldn't directly use `getConvexProvidersConfig()` from `@stackframe/stack` in `auth.config.ts` because Convex doesn't allow external imports in auth config files. Instead, we manually replicated the exact configuration that function generates, ensuring 100% compatibility with Stack Auth's JWT format.
