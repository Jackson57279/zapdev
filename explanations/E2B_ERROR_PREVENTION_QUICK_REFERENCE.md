# E2B Error Prevention - Quick Reference Card

## 🚨 When Things Go Wrong

### Circuit Breaker Is OPEN
**Error**: "Circuit breaker is OPEN - E2B service unavailable"

**What it means**: E2B had 5+ consecutive failures. System is protecting against cascading failures.

**Fix**:
```typescript
import { e2bCircuitBreaker } from "@/inngest/circuit-breaker";
e2bCircuitBreaker.manualReset(); // Only if you're sure E2B is back up
```

**Wait time**: Circuit auto-tests recovery every 60 seconds

---

### Rate Limit Warnings
**Error**: "E2B rate limit detected, backing off 30000ms"

**What it means**: Approaching or exceeded E2B API limits

**Check usage**:
```typescript
const stats = await convex.query(api.e2bRateLimits.getStats, {});
console.log(stats.byOperation.sandbox_create); // How many requests in last hour
```

**Fix**: Throttle requests or wait for rate limit window to reset (1 hour)

---

### Sandbox Creation Keeps Failing
**Error**: "E2B sandbox creation failed after retries"

**Check**:
1. Verify `E2B_API_KEY` is valid
2. Check E2B dashboard: https://e2b.dev/dashboard
3. View logs: Search for `[E2B_METRICS]`
4. Check circuit breaker state

**Debug**:
```bash
# View all E2B metrics
grep "[E2B_METRICS]" logs.txt

# Find specific failures
grep "sandbox_create_failure" logs.txt

# Check circuit breaker
grep "circuitBreakerState:OPEN" logs.txt
```

---

### Health Check Failures
**Warning**: "Sandbox health check failed, but continuing..."

**What it means**: Sandbox was created but didn't respond to echo command

**Usually safe to ignore**: Health check is non-blocking
**If persistent**: Check E2B service status

---

## 📊 Monitoring Queries

### Check Circuit Breaker
```typescript
import { e2bCircuitBreaker } from "@/inngest/circuit-breaker";

const state = e2bCircuitBreaker.getState();
// Returns: "CLOSED" (good) | "OPEN" (bad) | "HALF_OPEN" (testing)

const failures = e2bCircuitBreaker.getFailureCount();
// Returns: 0-5 (number of recent failures)
```

### Check Rate Limits
```typescript
// Overall stats (last hour)
const stats = await convex.query(api.e2bRateLimits.getStats, {});
// { totalRequests: 250, byOperation: { sandbox_create: 80, sandbox_connect: 170 } }

// Specific operation
const limit = await convex.query(api.e2bRateLimits.checkRateLimit, {
  operation: "sandbox_create",
  maxPerHour: 100 // Your rate limit
});
// { count: 45, limit: 100, exceeded: false, remaining: 55 }
```

### View Recent Failures
```bash
# Development (Inngest dashboard)
Filter: [E2B_METRICS] event:sandbox_create_failure

# Production (Sentry/Datadog)
event:sandbox_create_critical_failure
circuitBreakerState:OPEN
```

---

## ⚙️ Configuration Quick Reference

### Timeouts
| Constant | Value | Purpose |
|----------|-------|---------|
| `SANDBOX_TIMEOUT` | 30 min | Max sandbox lifetime |
| `FILE_READ_TIMEOUT_MS` | 3s | File read timeout |
| `BUILD_TIMEOUT_MS` | 120s | Build command timeout |

**Location**: `src/inngest/types.ts` and `src/inngest/functions.ts`

### Retry Settings
| Setting | Value | Purpose |
|---------|-------|---------|
| Max Retries | 3 | Total retry attempts |
| Transient Backoff | 1s, 2s, 4s | Exponential backoff |
| Rate Limit Backoff | 30s | Fixed delay for rate limits |

**Location**: `src/inngest/utils.ts` (createSandboxWithRetry)

### Circuit Breaker
| Setting | Value | Purpose |
|---------|-------|---------|
| Failure Threshold | 5 | Failures before opening |
| Recovery Timeout | 60s | Time before testing recovery |

**Location**: `src/inngest/circuit-breaker.ts`

---

## 🔧 Common Adjustments

### Too Many Retries (Users Waiting Too Long)
```typescript
// src/inngest/functions.ts
return await createSandboxWithRetry(template, 2); // Reduce from 3 to 2
```

### Circuit Breaker Too Sensitive
```typescript
// src/inngest/circuit-breaker.ts
export const e2bCircuitBreaker = new CircuitBreaker({
  threshold: 10, // Increase from 5 to 10
  timeout: 60000,
  name: "E2B",
});
```

### Health Checks Too Noisy
```typescript
// src/inngest/functions.ts
// Comment out health check
// const isHealthy = await validateSandboxHealth(sandbox);
```

### Rate Limit Cleanup Too Aggressive
```typescript
// convex/e2bRateLimits.ts
const hourAgo = now - 2 * 60 * 60 * 1000; // Track 2 hours instead of 1
```

---

## 📝 Log Patterns

### Success Pattern
```
[DEBUG] Sandbox creation attempt 1/3 for template: zapdev
[E2B_METRICS] { event: "sandbox_create_success", duration: 2500, attempt: 1 }
[DEBUG] Sandbox created successfully: abc123
```

### Retry Pattern
```
[DEBUG] Sandbox creation attempt 1/3 for template: zapdev
[E2B_METRICS] { event: "sandbox_create_failure", error: "timeout", attempt: 1 }
[DEBUG] Transient error detected, retrying in 1000ms...
[DEBUG] Sandbox creation attempt 2/3 for template: zapdev
[E2B_METRICS] { event: "sandbox_create_success", duration: 3200, attempt: 2 }
```

### Circuit Breaker Pattern
```
[ERROR] Circuit breaker OPENED after 5 failures
[ERROR] Circuit breaker is OPEN - E2B service unavailable. Retry in 60s.
... (60 seconds later) ...
[E2B] Transitioning to HALF_OPEN state - testing service recovery
[E2B] Service recovered - transitioning to CLOSED state
```

---

## 🚀 Quick Commands

```bash
# Check TypeScript errors
npx tsc --noEmit --skipLibCheck

# View logs (development)
# Inngest dashboard: http://localhost:8288

# Deploy Convex changes
bun run convex:deploy

# Clean up old rate limit records
# (Add to Convex cron or run manually)
```

---

## 📞 Support

**Full Documentation**: `explanations/E2B_ERROR_PREVENTION_IMPLEMENTATION.md`  
**Original Spec**: `.factory/specs/2025-11-16-e2b-internal-server-error-prevention-strategy.md`

**Key Files**:
- Error detection: `src/inngest/utils.ts`
- Circuit breaker: `src/inngest/circuit-breaker.ts`  
- Rate limits: `convex/e2bRateLimits.ts`
- Main integration: `src/inngest/functions.ts`
