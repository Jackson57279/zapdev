
## 400 Invalid Request Retry Logic Implementation

### Task Completed
Added 400-error retry logic to the main streaming loop in `src/agents/code-agent.ts`.

### Changes Made
1. **Import Addition (line 44)**
   - Added `isInvalidRequestError` to the import from `./rate-limit`
   - This function detects 400/invalid-request errors from API providers

2. **Flag Initialization (line 594)**
   - Added `let skipProviderOptions = false;` before the while loop
   - This flag controls whether to strip provider options on retry

3. **Provider Options Guard (line 604)**
   - Wrapped gateway option in `if (!skipProviderOptions && useGatewayFallbackForStream)`
   - When flag is true, providerOptions becomes empty `{}`

4. **Error Detection (line 659)**
   - Added `const isInvalidRequest = isInvalidRequestError(streamError);`
   - Detects 400 errors in the catch block

5. **Retry Logic (lines 662-666)**
   - Added condition: `if (isInvalidRequest && retryCount === 1)`
   - On first 400 error: sets `skipProviderOptions = true`, logs `[INVALID-REQUEST]`, continues
   - On second 400 error: throws immediately (no infinite retries)

6. **canRetry Update (line 660)**
   - Updated to: `const canRetry = isRateLimit || isServer || isInvalidRequest;`
   - Allows 400 errors to be retried once

### Verification
- ✅ All 10 gateway-fallback tests pass
- ✅ No TypeScript compilation errors in our changes
- ✅ Existing rate-limit and server-error retry logic unchanged
- ✅ Only ONE 400 retry allowed (enforced by `retryCount === 1` check)

### Key Design Decisions
- 400 errors are retried BEFORE gateway fallback checks (line 662 before line 668)
- Only first 400 error triggers retry; subsequent 400s throw immediately
- Retry strategy: remove provider options (gateway routing) on second attempt
- Logging uses `[INVALID-REQUEST]` prefix for easy debugging
## Task 4: Update Tests for 400 Error Handling and Moonshot Provider Options

### Completion Summary
✅ **COMPLETED** - All test requirements met and passing

### Tests Added

#### gateway-fallback.test.ts
- **Import**: Added `isInvalidRequestError` to existing import from `rate-limit`
- **Invalid Request Error Detection** (6 tests):
  1. Returns `true` for error with `"invalid_request_error"` message
  2. Returns `true` for error with `"invalid request error"` message
  3. Returns `true` for error with `"400"` or `"bad request"` message
  4. Returns `false` for rate limit errors (429)
  5. Returns `false` for server errors (500)
  6. Returns `false` for non-Error inputs (null, undefined, string, plain object)

- **Moonshot Provider Options** (2 tests):
  1. Correctly identifies moonshot model IDs by `startsWith("moonshotai/")`
  2. Matches both `moonshotai/kimi-k2.5` and `moonshotai/kimi-k2-0905`

#### model-selection.test.ts
- **Moonshot Config Sanity** (1 test):
  1. `MODEL_CONFIGS['moonshotai/kimi-k2.5'].provider` equals `"moonshot"`

### Test Results
- **gateway-fallback.test.ts**: 18 tests passed (10 existing + 8 new)
- **model-selection.test.ts**: 7 tests total (6 existing + 1 new), 1 new test passed
  - Note: 4 pre-existing tests were already failing (unrelated to this task)

### Key Observations
1. `isInvalidRequestError()` function already existed in `src/agents/rate-limit.ts` (lines 68-88)
2. Function follows the same pattern as `isRateLimitError()` and `isServerError()`
3. Tests follow existing Jest patterns in the codebase (expect().toBe(), expect().toBeDefined())
4. All new tests are descriptive and follow naming conventions
5. No modifications to existing passing tests were needed

### Verification
- ✅ `bunx jest --testPathPatterns=gateway-fallback` → 18 tests passed
- ✅ `bunx jest --testPathPatterns=model-selection` → 1 new test passed (7 total, 4 pre-existing failures)
- ✅ All new test names are descriptive
- ✅ Test coverage includes edge cases (non-Error inputs, different error patterns)
