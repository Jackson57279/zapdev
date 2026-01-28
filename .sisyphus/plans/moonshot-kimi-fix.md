# Fix moonshotai/kimi-k2.5 OpenRouter 400 Invalid Request Error

## TL;DR

> **Quick Summary**: Fix the 400 "invalid request error" when calling `moonshotai/kimi-k2.5` through OpenRouter by removing the incompatible `providerOptions.openai = { parallelToolCalls: false }` for moonshot models, and adding a 400-error retry mechanism that strips problematic options on retry.
> 
> **Deliverables**:
> - Remove `providerOptions.openai` for moonshot models across all 4 call sites in `code-agent.ts`
> - Add `isInvalidRequestError()` detection to `rate-limit.ts`
> - Add 400-error retry-without-options logic to `code-agent.ts` stream loop
> - Update existing tests + add new test for 400 error handling
> 
> **Estimated Effort**: Short (2-3 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request
Fix the `moonshotai/kimi-k2.5` model failing with a 400 "invalid request error" when called through OpenRouter, routed to Novita provider. Error: `"invalid request error trace_id: 5fb768847b9559b1797c9538039d2c24"`.

### Interview Summary
**Key Discussions**:
- **Q1 (parallelToolCalls)**: User chose (A) — fix the provider options. Research revealed `parallelToolCalls` is NOT a top-level AI SDK param; it's always `providerOptions.{provider}`. The correct fix is to **remove** the `openai` namespace for moonshot models entirely, since Novita doesn't support `parallel_tool_calls`.
- **Q2 (400 retry)**: User chose (B) — detect 400, retry once without the problematic options, throw on second failure. No model fallback.
- **Q3 (pre-validation)**: User chose (A) — skip. Handle errors gracefully at call time.
- **Q4 (tests)**: User chose (A) — unit tests + update existing tests.

**Research Findings**:
- **Vercel AI SDK source** (`packages/openai/src/chat/openai-chat-language-model.ts`): `providerOptions.openai.parallelToolCalls` is mapped to `parallel_tool_calls` in the HTTP body. Novita's moonshot backend rejects this unknown field → 400.
- **OpenRouter/Novita docs** (Google Search): Novita is strict about unrecognized parameters. `parallel_tool_calls` is OpenAI-specific and not supported by all providers. Recommending: don't send it for non-OpenAI models.
- **AI SDK examples** (`vercel/ai` repo): Each provider has its own namespace (`providerOptions.mistral`, `providerOptions.groq`, etc.). There is no moonshot/novita-specific namespace, so `providerOptions.openai` is wrong for these models.

### Metis Review
**Identified Gaps** (addressed):
- **Both moonshot models affected**: `moonshotai/kimi-k2-0905` (line 61) also matches `startsWith('moonshotai/')`. Fix covers both automatically.
- **`frequencyPenalty` as secondary risk**: `modelConfig.frequencyPenalty: 0.5` is also sent via `modelOptions`. Standard OpenAI-compatible param, likely supported by Novita, but noted as potential secondary issue. OUT OF SCOPE for this fix.
- **Error shape from Novita**: The 400 body includes `"type":"invalid_request_error"`. Detection function must parse both HTTP status and error body patterns.
- **Edge case**: If removing `parallelToolCalls` option alone doesn't fix it, the retry-without-options path handles this — it strips ALL non-essential provider options on retry.

---

## Work Objectives

### Core Objective
Eliminate the 400 "invalid request error" for moonshot models by removing incompatible `providerOptions.openai` and adding graceful 400-error retry logic.

### Concrete Deliverables
- `src/agents/rate-limit.ts`: New `isInvalidRequestError()` function
- `src/agents/code-agent.ts`: Remove `providerOptions.openai` for moonshot models (4 locations) + add 400 retry in stream loop
- `tests/gateway-fallback.test.ts`: Updated with moonshot provider options tests + 400 error tests
- `tests/model-selection.test.ts`: Verify moonshot models don't receive openai provider options

### Definition of Done
- [ ] `moonshotai/kimi-k2.5` calls go through OpenRouter WITHOUT `parallel_tool_calls` in HTTP body
- [ ] A 400 error triggers exactly one retry without any provider options
- [ ] All existing tests still pass: `bun run test`
- [ ] New tests for 400 detection and moonshot option handling pass

### Must Have
- Remove `providerOptions.openai = { parallelToolCalls: false }` for ALL `moonshotai/` prefixed models
- Add `isInvalidRequestError()` that detects 400 status AND `invalid_request_error` patterns
- One-retry mechanism for 400 errors that strips `providerOptions` entirely on retry
- Clear console logging when 400 is detected and retry is attempted

### Must NOT Have (Guardrails)
- **NO automatic model fallback** — 400 errors indicate config bugs, not transient issues. Masking them with fallback hides the root cause.
- **NO pre-validation** against OpenRouter model list endpoint — adds latency, can be stale
- **NO changes to `src/agents/types.ts`** model configurations — the model config is correct; the call-site options are wrong
- **NO changes to `src/agents/client.ts`** — the OpenRouter client setup is fine
- **DO NOT** add `providerOptions.moonshot` or `providerOptions.novita` — there are no AI SDK provider packages for these; just omit provider-specific options entirely
- **DO NOT** make 400 errors retryable in the general `withRateLimitRetry` utility — 400s are NOT transient. The retry is a specific one-time "strip options and try again" logic, NOT a general retry policy.
- **DO NOT** add `parallelToolCalls` as a top-level param — it doesn't exist in the Vercel AI SDK

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Jest, 12 test files in `tests/`)
- **User wants tests**: YES — unit tests + update existing
- **Framework**: Jest (via `bun run test`)

### Test Approach
- Update `tests/gateway-fallback.test.ts` to verify moonshot models don't get `providerOptions.openai`
- Add new test case for `isInvalidRequestError()` detection
- Add new test case for 400-retry logic behavior
- Run full suite: `bun run test` → all pass

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add isInvalidRequestError() to rate-limit.ts
└── Task 2: Remove providerOptions.openai for moonshot in all 4 call sites

Wave 2 (After Wave 1):
├── Task 3: Add 400-error retry logic to stream loop in code-agent.ts
└── Task 4: Update tests (gateway-fallback.test.ts + model-selection.test.ts)

Wave 3 (After Wave 2):
└── Task 5: Full test suite verification + manual smoke test

Critical Path: Task 1 → Task 3 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 5 | 4 |
| 4 | 1, 2 | 5 | 3 |
| 5 | 3, 4 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `delegate_task(category="quick", ...)` — both are small, focused edits |
| 2 | 3, 4 | `delegate_task(category="quick", ...)` — scoped logic + test updates |
| 3 | 5 | `delegate_task(category="quick", ...)` — run test suite |

---

## TODOs

- [ ] 1. Add `isInvalidRequestError()` function to rate-limit.ts

  **What to do**:
  - Add a new exported function `isInvalidRequestError(error: unknown): boolean` to `src/agents/rate-limit.ts`
  - Detection patterns (check error message and stringified error):
    - HTTP status 400 patterns: `"400"`, `"bad request"`
    - OpenRouter/Novita patterns: `"invalid_request_error"`, `"invalid request error"`
  - Follow the exact same pattern as existing `isRateLimitError()` and `isServerError()` functions in the same file
  - Also export this function from rate-limit.ts

  **Must NOT do**:
  - Do NOT modify `isRetryableError()` to include 400 errors — they are NOT generally retryable
  - Do NOT modify `withRateLimitRetry()` — the 400 retry is handled separately in code-agent.ts

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function addition to a single file, following established patterns
  - **Skills**: []
    - No special skills needed — straightforward TypeScript function
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not UI work
    - `git-master`: Not git work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/agents/rate-limit.ts:13-29` — `isRateLimitError()`: Exact pattern to follow. Takes `unknown`, checks `instanceof Error`, scans `message.toLowerCase()` against pattern array, returns boolean.
  - `src/agents/rate-limit.ts:35-62` — `isServerError()`: Second example of same pattern. Also checks `String(error).toLowerCase()` for broader matching.

  **API/Type References**:
  - `src/agents/rate-limit.ts:67-69` — `isRetryableError()`: Shows how error type checks compose. Do NOT add `isInvalidRequestError` to this composition.

  **Documentation References**:
  - Error shape from Novita: `{"message":"invalid request error trace_id: ...","type":"invalid_request_error"}` — the function must match both `"invalid_request_error"` (type field) and `"invalid request error"` (message field).

  **WHY Each Reference Matters**:
  - `isRateLimitError()` → Copy this exact structure for consistency. The codebase convention is: array of lowercase patterns, `.some()` match against lowercased message.
  - `isServerError()` → Shows the dual-check pattern (both `message` and `String(error)`) for broader matching.
  - Error shape from Novita → The patterns to detect. The `"type":"invalid_request_error"` appears in stringified error body.

  **Acceptance Criteria**:

  - [ ] Function `isInvalidRequestError` exported from `src/agents/rate-limit.ts`
  - [ ] Returns `true` for errors with messages containing `"invalid_request_error"`, `"invalid request error"`, or `"bad request"`
  - [ ] Returns `true` for errors with status code 400 pattern (`"statuscode: 400"`, `"status_code\":400"`, `"\"code\":400"`)
  - [ ] Returns `false` for non-Error inputs, rate limit errors, server errors
  - [ ] Does NOT modify `isRetryableError()` or `withRateLimitRetry()`

  **Manual Verification**:
  - [ ] `bun run test -- --testPathPattern=gateway-fallback` → still passes (no regressions)
  - [ ] Read `src/agents/rate-limit.ts` and verify `isInvalidRequestError` follows same structure as `isRateLimitError`

  **Commit**: YES (groups with Task 2)
  - Message: `fix(agents): add isInvalidRequestError detection for 400 errors from OpenRouter`
  - Files: `src/agents/rate-limit.ts`
  - Pre-commit: `bun run test`

---

- [ ] 2. Remove `providerOptions.openai` for moonshot models in all 4 call sites

  **What to do**:
  - In `src/agents/code-agent.ts`, find ALL 4 locations where `providerOptions.openai = { parallelToolCalls: false }` is set conditionally for `moonshotai/` models
  - **Remove** the conditional block entirely at each location. Do NOT replace with an alternative — moonshot models should get NO provider-specific options.
  - The 4 locations are:
    1. **Lines 607-609**: Main streaming — `if (selectedModel.startsWith('moonshotai/')) { providerOptions.openai = { parallelToolCalls: false }; }`
    2. **Lines 741-743**: Summary generation — same pattern
    3. **Lines 866-868**: Auto-fix generation — inline ternary `providerOptions: selectedModel.startsWith('moonshotai/') ? ({ openai: { parallelToolCalls: false } } as any) : undefined`
    4. **Lines 1197-1199**: Error-fix generation — same inline ternary pattern

  - For locations 1 & 2: Delete the 3-line `if` block
  - For locations 3 & 4: Replace the entire ternary with `undefined` (or remove the `providerOptions` key if it's the only option)

  **Must NOT do**:
  - Do NOT add any replacement provider options (no `providerOptions.moonshot`, no `providerOptions.novita`)
  - Do NOT remove the gateway-related `providerOptions.gateway` blocks — those are for Cerebras models and are correct
  - Do NOT modify `modelOptions` (temperature, frequencyPenalty) — those are standard and likely fine
  - Do NOT touch the `getClientForModel()` calls or model selection logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Four targeted deletions in a single file, no new logic needed
  - **Skills**: []
    - No special skills needed — surgical code removal
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not UI work
    - `git-master`: Not git work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/agents/code-agent.ts:601-613` — Full context of main streaming providerOptions block. Shows the gateway option (KEEP) and the moonshot option (REMOVE). The `providerOptions` variable and its conditional pass-through to `streamText` must remain intact for the gateway case.
  - `src/agents/code-agent.ts:735-747` — Summary generation providerOptions block. Same structure as main streaming.
  - `src/agents/code-agent.ts:863-868` — Auto-fix inline ternary. Different pattern: `providerOptions: selectedModel.startsWith('moonshotai/') ? ({...} as any) : undefined`. This entire line should become `providerOptions: undefined` or the key should be removed.
  - `src/agents/code-agent.ts:1194-1199` — Error-fix inline ternary. Same inline pattern as auto-fix.

  **WHY Each Reference Matters**:
  - Lines 601-613 → Must understand the full providerOptions structure to know what to keep (gateway) vs remove (openai/moonshot). Removing the wrong block would break Cerebras gateway fallback.
  - Lines 863-868 → Different code pattern (inline ternary vs block). Needs different removal approach.

  **Acceptance Criteria**:

  - [ ] `grep -n "parallelToolCalls" src/agents/code-agent.ts` returns 0 matches
  - [ ] `grep -n "providerOptions.openai" src/agents/code-agent.ts` returns 0 matches
  - [ ] `grep -n "providerOptions.gateway" src/agents/code-agent.ts` still returns matches (gateway logic preserved)
  - [ ] No TypeScript compilation errors in `src/agents/code-agent.ts`

  **Manual Verification**:
  - [ ] Read all 4 modified locations in `src/agents/code-agent.ts` to verify:
    - Gateway-related providerOptions are UNTOUCHED
    - All moonshot-related providerOptions are GONE
    - No orphaned `if` blocks or dangling commas
  - [ ] `bun run test` → all existing tests pass

  **Commit**: YES (groups with Task 1)
  - Message: `fix(agents): remove incompatible openai providerOptions for moonshot models`
  - Files: `src/agents/code-agent.ts`
  - Pre-commit: `bun run test`

---

- [ ] 3. Add 400-error retry logic to stream loop in code-agent.ts

  **What to do**:
  - In the main streaming `while` loop (lines 597-698), inside the `catch (streamError)` block, add handling for 400/invalid-request errors
  - Import `isInvalidRequestError` from `./rate-limit` (add to existing import on line 44)
  - After the existing `isModelNotFound` check (line 661), add a new check:
    ```
    const isInvalidRequest = isInvalidRequestError(streamError);
    ```
  - Add a new condition block BEFORE the existing gateway fallback checks (after line 663):
    ```
    if (isInvalidRequest && retryCount === 1) {
      console.log(`[INVALID-REQUEST] 400 error for ${selectedModel}. Retrying without provider-specific options...`);
      // Set a flag to skip provider options on next iteration
      // Continue to retry
      continue;
    }
    ```
  - Add a boolean flag `skipProviderOptions` (initialized to `false` before the while loop) that, when `true`, forces `providerOptions` to be empty `{}` on the next iteration
  - In the providerOptions construction block (lines 601-609), wrap the gateway option in `if (!skipProviderOptions)` guard
  - Update the `canRetry` check (line 662) to include: `const canRetry = isRateLimit || isServer || isInvalidRequest;`
  - But ONLY allow ONE invalid-request retry (check retryCount)

  **Must NOT do**:
  - Do NOT add 400 retry to the summary generation loop (lines 731-797) — keep it simple, only the main stream needs this
  - Do NOT add 400 retry to `withRateLimitRetry()` — that's the general utility; this is stream-specific
  - Do NOT add model fallback on 400
  - Do NOT make 400 errors infinitely retryable — exactly ONE retry allowed

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Scoped logic addition in a well-understood code section
  - **Skills**: []
    - No special skills needed — conditional logic in existing error handling
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not UI work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 4, but depends on Wave 1)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL):

  **Pattern References**:
  - `src/agents/code-agent.ts:656-698` — The existing `catch (streamError)` block. Shows the pattern for error classification (`isRateLimit`, `isServer`, `isModelNotFound`), conditional retry logic, and gateway fallback switching. New 400 handling must fit into this existing pattern.
  - `src/agents/code-agent.ts:591-595` — Loop initialization: `fullText`, `chunkCount`, `useGatewayFallbackForStream`, `retryCount`, `MAX_STREAM_RETRIES`. The new `skipProviderOptions` flag should be initialized here.
  - `src/agents/code-agent.ts:601-609` — ProviderOptions construction. The `skipProviderOptions` guard wraps the gateway condition here.

  **API/Type References**:
  - `src/agents/rate-limit.ts` — `isInvalidRequestError()` (created in Task 1). Import alongside existing `isRateLimitError`, `isServerError`.
  - `src/agents/code-agent.ts:44` — Existing import line: `import { withRateLimitRetry, isRateLimitError, isRetryableError, isServerError } from "./rate-limit";`. Add `isInvalidRequestError` here.

  **WHY Each Reference Matters**:
  - Lines 656-698 → Must understand the full error handling flow to insert the new 400 check at the correct position without breaking gateway fallback or rate limit logic.
  - Lines 591-595 → Must add `skipProviderOptions` alongside existing flags.
  - Line 44 → Must extend the import to include the new function.

  **Acceptance Criteria**:

  - [ ] `isInvalidRequestError` is imported from `./rate-limit` on line 44
  - [ ] `skipProviderOptions` flag exists in stream loop initialization
  - [ ] 400 error detected in catch block with `isInvalidRequestError(streamError)`
  - [ ] On first 400 error: sets `skipProviderOptions = true`, logs `[INVALID-REQUEST]`, continues loop
  - [ ] On second 400 error (or any 400 after retry): throws immediately
  - [ ] When `skipProviderOptions` is true, `providerOptions` is empty/minimal (no gateway, no openai)
  - [ ] Existing rate-limit and server-error retry logic is UNCHANGED
  - [ ] No TypeScript compilation errors

  **Manual Verification**:
  - [ ] Read the modified catch block and trace the flow for a 400 error scenario:
    1. First call fails with 400 → `isInvalidRequest` true → `skipProviderOptions` set → continue
    2. Second call succeeds → break out of loop
    3. OR: Second call fails with 400 → `retryCount >= MAX_STREAM_RETRIES` or invalid-request already retried → throw
  - [ ] `bun run test` → all existing tests pass

  **Commit**: YES
  - Message: `fix(agents): add 400 invalid-request retry logic for stream generation`
  - Files: `src/agents/code-agent.ts`
  - Pre-commit: `bun run test`

---

- [ ] 4. Update tests for 400 error handling and moonshot provider options

  **What to do**:
  - **In `tests/gateway-fallback.test.ts`**:
    - Add import: `import { isInvalidRequestError } from '../src/agents/rate-limit';` (alongside existing imports)
    - Add a new `describe('Invalid Request Error Detection')` block with tests:
      1. `isInvalidRequestError` returns `true` for error with `"invalid_request_error"` message
      2. `isInvalidRequestError` returns `true` for error with `"invalid request error"` message
      3. `isInvalidRequestError` returns `true` for error with `"400"` or `"bad request"` message
      4. `isInvalidRequestError` returns `false` for rate limit errors (429)
      5. `isInvalidRequestError` returns `false` for server errors (500)
      6. `isInvalidRequestError` returns `false` for non-Error inputs
    - Add a new `describe('Moonshot Provider Options')` block:
      1. Test that moonshot model IDs are correctly identified by `startsWith('moonshotai/')`
      2. Test that `moonshotai/kimi-k2.5` and `moonshotai/kimi-k2-0905` both match
  - **In `tests/model-selection.test.ts`**:
    - Verify the existing test "prefers Kimi K2.5 for coding-focused refinements" still passes (no changes needed, just run)
    - Add test: `MODEL_CONFIGS['moonshotai/kimi-k2.5'].provider` equals `"moonshot"` (basic config sanity)

  **Must NOT do**:
  - Do NOT mock the actual OpenRouter API — these are unit tests for detection functions
  - Do NOT add integration tests — out of scope
  - Do NOT modify existing passing tests — only ADD new test cases

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding test cases to existing test files, following established patterns
  - **Skills**: []
    - No special skills needed — Jest test patterns already established in the codebase
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not UI work

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, after Wave 1)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL):

  **Pattern References**:
  - `tests/gateway-fallback.test.ts:1-3` — Existing imports. Add `isInvalidRequestError` to the import from `rate-limit`.
  - `tests/gateway-fallback.test.ts:4-40` — Existing test structure. Shows `describe`/`it` nesting pattern, assertion style (`expect(...).toBe(...)`, `expect(...).toBeDefined()`).
  - `tests/gateway-fallback.test.ts:133-138` — `describe('Provider Options')` block. New moonshot tests can be added here or as a sibling describe block.
  - `tests/model-selection.test.ts:1-50` — Full test file. Shows how MODEL_CONFIGS and selectModelForTask are tested.

  **API/Type References**:
  - `src/agents/rate-limit.ts:isInvalidRequestError` — Function under test (created in Task 1).
  - `src/agents/types.ts:72-82` — `MODEL_CONFIGS['moonshotai/kimi-k2.5']` config object for sanity tests.

  **WHY Each Reference Matters**:
  - `gateway-fallback.test.ts:4-40` → Must follow existing test style exactly. No new assertion libraries, no different patterns.
  - `model-selection.test.ts:1-50` → Shows how to import and test MODEL_CONFIGS. The new config sanity test follows this pattern.

  **Acceptance Criteria**:

  - [ ] `bun run test -- --testPathPattern=gateway-fallback` → all tests pass including new ones
  - [ ] `bun run test -- --testPathPattern=model-selection` → all tests pass including new ones
  - [ ] At least 6 new test cases for `isInvalidRequestError`
  - [ ] At least 2 new test cases for moonshot model identification
  - [ ] At least 1 new test case for moonshot config sanity

  **Manual Verification**:
  - [ ] `bun run test -- --verbose` → see all new test names in output
  - [ ] Verify new test names are descriptive and follow existing naming patterns

  **Commit**: YES
  - Message: `test(agents): add tests for 400 error detection and moonshot provider options`
  - Files: `tests/gateway-fallback.test.ts`, `tests/model-selection.test.ts`
  - Pre-commit: `bun run test`

---

- [ ] 5. Full test suite verification and build check

  **What to do**:
  - Run the complete test suite: `bun run test`
  - Run the linter: `bun run lint`
  - Run the build: `bun run build`
  - Verify no regressions across ALL 12 test files
  - Verify no TypeScript compilation errors

  **Must NOT do**:
  - Do NOT skip any test files
  - Do NOT ignore lint warnings

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running commands and verifying output
  - **Skills**: []
    - No special skills needed — command execution
  - **Skills Evaluated but Omitted**:
    - All skills omitted — this is pure verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 3, 4

  **References** (CRITICAL):

  **Pattern References**:
  - `package.json` scripts section — exact commands for test, lint, build

  **Acceptance Criteria**:

  - [ ] `bun run test` → ALL tests pass (12+ test files, 0 failures)
  - [ ] `bun run lint` → no new errors (warnings acceptable if pre-existing)
  - [ ] `bun run build` → successful build with exit code 0
  - [ ] No TypeScript compilation errors in any modified file

  **Manual Verification**:
  - [ ] Command: `bun run test`
    - Expected: `Tests: X passed, X total` with 0 failures
  - [ ] Command: `bun run lint`
    - Expected: Clean or only pre-existing warnings
  - [ ] Command: `bun run build`
    - Expected: Successful build output

  **Commit**: NO (verification only — no code changes)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 + 2 | `fix(agents): remove incompatible openai providerOptions for moonshot models and add 400 error detection` | `src/agents/rate-limit.ts`, `src/agents/code-agent.ts` | `bun run test` |
| 3 | `fix(agents): add 400 invalid-request retry logic for stream generation` | `src/agents/code-agent.ts` | `bun run test` |
| 4 | `test(agents): add tests for 400 error detection and moonshot provider options` | `tests/gateway-fallback.test.ts`, `tests/model-selection.test.ts` | `bun run test` |
| 5 | (no commit — verification only) | — | `bun run test && bun run lint && bun run build` |

---

## Success Criteria

### Verification Commands
```bash
bun run test                                    # All tests pass (0 failures)
bun run lint                                    # No new lint errors
bun run build                                   # Successful build
grep -n "parallelToolCalls" src/agents/code-agent.ts  # Expected: 0 matches
grep -n "providerOptions.openai" src/agents/code-agent.ts  # Expected: 0 matches
grep -n "isInvalidRequestError" src/agents/rate-limit.ts  # Expected: 1+ matches (function definition)
grep -n "isInvalidRequestError" src/agents/code-agent.ts  # Expected: 2+ matches (import + usage)
```

### Final Checklist
- [ ] All "Must Have" present: providerOptions removed, isInvalidRequestError added, retry logic in stream, tests pass
- [ ] All "Must NOT Have" absent: no model fallback, no pre-validation, no types.ts changes, no client.ts changes
- [ ] All tests pass: `bun run test` → 0 failures
- [ ] Build succeeds: `bun run build` → exit code 0
