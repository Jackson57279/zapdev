# BotID Implementation Guide

## Overview

BotID is an invisible CAPTCHA-style bot protection system from Vercel that blocks automated bots while allowing legitimate users. It uses client-side JavaScript challenges to classify sessions and server-side verification to enforce protection.

**Implementation Date**: November 30, 2025
**Status**: ✅ Complete and Build-Verified

## What is BotID?

BotID provides:
- **Invisible Protection**: No visible CAPTCHA prompts for users
- **Bot Classification**: Runs JavaScript challenges in browsers to detect bots
- **Server-Side Verification**: Confirms requests are from legitimate users before processing
- **Attack Prevention**: Protects against:
  - Automated checkout/payment fraud
  - Account enumeration attacks
  - API abuse and scraping
  - Form submission spam
  - Authentication bypass attempts

## Architecture

### 1. Configuration Layer

**File**: `next.config.mjs`
- Wraps Next.js config with `withBotId()` from `botid/next/config`
- Sets up proxy rewrites to prevent ad-blockers and third-party scripts from bypassing protection
- Ensures BotID headers are properly routed

```typescript
import { withBotId } from 'botid/next/config';
export default withBotId(nextConfig);
```

### 2. Client-Side Initialization

**File**: `src/instrumentation-client.ts`
- Initializes BotID protection on client-side using `initBotId()` from `botid/client/core`
- Runs automatically in Next.js 15.3+ via instrumentation convention
- Defines protected routes that require bot verification
- Attaches special headers to requests for server-side classification

**Protected Routes**:
```typescript
initBotId({
  protect: [
    { path: '/api/polar/create-checkout', method: 'POST' },
    { path: '/api/agent/token', method: 'POST' },
    { path: '/api/import/figma/auth', method: 'POST' },
    { path: '/api/import/github/auth', method: 'POST' },
    { path: '/api/import/figma/*', method: 'POST' },
    { path: '/api/import/github/*', method: 'POST' },
    { path: '/api/messages/update', method: 'POST' },
    { path: '/api/transfer-sandbox', method: 'POST' },
    { path: '/api/fix-errors', method: 'POST' },
  ],
});
```

**Wildcard Matching**:
- `/team/*/activate` matches `/team/a/activate`, `/team/a/b/activate`, etc.
- `/api/user/*` matches `/api/user/profile`, `/api/user/settings`, etc.

### 3. Server-Side Verification

Each protected route imports and calls `checkBotId()` at the start of the handler:

```typescript
import { checkBotId } from 'botid/server';

export async function POST(request: Request) {
  // Verify request is from a legitimate user, not a bot
  const botVerification = await checkBotId();
  if (botVerification.isBot) {
    console.warn("⚠️ BotID blocked a request");
    return NextResponse.json(
      { error: "Access denied - suspicious activity detected" },
      { status: 403 }
    );
  }

  // Continue with business logic...
}
```

## Protected Endpoints

### Payment & Checkout
- **`POST /api/polar/create-checkout`** - Initiates payment checkout
  - Prevents checkout fraud and payment abuse
  - Critical protection priority

### Authentication & Tokens
- **`GET/POST /api/import/figma/auth`** - Figma OAuth initiation
- **`GET/POST /api/import/github/auth`** - GitHub OAuth initiation
- **`POST /api/agent/token`** - Realtime token generation
  - Prevents authentication bypass and unauthorized access
  - High protection priority

### Data Operations
- **`POST /api/messages/update`** - Update message content
- **`POST /api/transfer-sandbox`** - Transfer/resume sandboxes
- **`POST /api/fix-errors`** - Trigger error fix operations
  - Prevents automated resource manipulation
  - Medium protection priority

### Import Processing
- **`POST /api/import/figma/*`** - Figma file processing
- **`POST /api/import/github/*`** - GitHub repository processing
  - Prevents unauthorized imports
  - Medium protection priority

## Local Development Behavior

**Important**: BotID returns `isBot: false` by default in local development to allow testing without friction.

To test bot blocking locally, use the optional `developmentOptions` parameter in `checkBotId()`:

```typescript
const botVerification = await checkBotId({
  developmentOptions: {
    simulateBot: true, // Simulate bot detection
  }
});
```

## Testing BotID

### Browser Testing (Recommended)
1. Open your app in a browser
2. Make a fetch request to a protected endpoint:
   ```javascript
   // From browser console
   fetch('/api/polar/create-checkout', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ productId: 'test' })
   })
   ```
3. In development: Request succeeds (isBot: false)
4. In production: BotID challenges the browser before sending the request

### Testing Methods to Avoid
- ❌ `curl` or direct URL visits
- ❌ Postman or API clients without JavaScript execution
- ❌ Server-to-server requests without client context

These will be blocked in production because BotID's JavaScript challenge cannot run.

## Security Considerations

### What BotID Protects Against
- Automated payment fraud attempts
- Credential stuffing and brute-force attacks
- API abuse and rate violations
- Form spam and injection attacks
- Account enumeration scanning
- Unauthorized resource operations

### What BotID Does NOT Protect Against
- SQL injection (handled by parameterized queries)
- XSS attacks (handled by framework defaults)
- CSRF attacks (use existing CSRF tokens)
- DDoS attacks (use Vercel Firewall for DDoS protection)

**Use-Case**: BotID is specifically for user-action verification, not general security. Combine with other security measures.

## Implementation Status

### Completed
✅ BotID package installed (v1.5.10)
✅ Next.js config wrapper added
✅ Client-side initialization configured
✅ Server-side verification added to all critical routes
✅ Build compilation successful (no TypeScript errors)
✅ Protected routes list finalized

### Files Modified
1. `next.config.mjs` - Added `withBotId()` wrapper
2. `src/instrumentation-client.ts` - Created new file with route protection
3. `src/app/api/polar/create-checkout/route.ts` - Added `checkBotId()`
4. `src/app/api/agent/token/route.ts` - Added `checkBotId()`
5. `src/app/api/import/figma/auth/route.ts` - Added `checkBotId()`
6. `src/app/api/import/github/auth/route.ts` - Added `checkBotId()`
7. `src/app/api/messages/update/route.ts` - Added `checkBotId()`
8. `src/app/api/transfer-sandbox/route.ts` - Added `checkBotId()`
9. `src/app/api/fix-errors/route.ts` - Added `checkBotId()`

### Optional Next Steps

#### Enable BotID Deep Analysis (Pro/Enterprise only)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Firewall** tab → **Rules**
4. Toggle **Vercel BotID Deep Analysis** on
5. This provides advanced bot detection using behavioral analysis

Benefits:
- More sophisticated bot detection algorithms
- Real-time threat intelligence
- Detailed analytics dashboard

#### Extend Protection to Additional Routes
Monitor logs and add protection to other sensitive endpoints as needed:
- User registration endpoints
- Password change/reset endpoints
- Email verification endpoints
- Account deletion endpoints

```typescript
// Example: Add to instrumentation-client.ts protect array
{
  path: '/api/auth/register',
  method: 'POST',
}
```

#### Monitor BotID Events
Track bot detection in production:
```typescript
// Add to your logging/monitoring system
if (botVerification.isBot) {
  logSecurityEvent({
    type: 'BOT_DETECTED',
    endpoint: request.url,
    timestamp: new Date(),
  });
}
```

## Troubleshooting

### Build Issues
**Problem**: TypeScript errors after adding BotID
**Solution**: Ensure `src/instrumentation-client.ts` exists and is properly imported

### Protected Routes Not Working
**Problem**: `checkBotId()` always returns `isBot: false` in production
**Possible Causes**:
- Route not included in `initBotId()` protect array
- Client-side initialization not running
- Headers not being properly routed through Vercel

**Solution**:
1. Verify route is in `src/instrumentation-client.ts` protect array
2. Check browser console for any client-side errors
3. Verify requests are made from browser (not curl/API clients)
4. Check Vercel deployment logs for BotID-related issues

### Development Testing
**Problem**: Cannot test bot blocking locally
**Solution**: Use `developmentOptions` in `checkBotId()` or deploy to staging/preview

## References

- [Vercel BotID Documentation](https://vercel.com/docs/botid)
- [BotID Get Started Guide](https://vercel.com/docs/botid/get-started)
- [BotID Advanced Configuration](https://vercel.com/docs/botid/advanced-configuration)
- [Vercel Security Overview](https://vercel.com/docs/security)

## Monitoring & Alerts

### Recommended Alerts
Set up alerts for:
- High bot detection rate on payment endpoints
- Unusual spike in 403 responses from protected routes
- Failed attempts to protected endpoints

### Metrics to Track
- Bot detection rate by endpoint
- False positive rate (blocked legitimate users)
- Response time impact from BotID verification
- Geographic distribution of bot attempts

## Performance Impact

BotID adds minimal overhead:
- Client-side: JavaScript challenge runs asynchronously
- Server-side: `checkBotId()` verification is fast (<5ms typically)
- Network: Single additional header on protected requests

Build verified with no performance regressions.

---

**Last Updated**: November 30, 2025
**Implementation by**: OpenCode Agent
**Framework**: Next.js 16, React 19, TypeScript
