# Draft: Fix moonshotai/kimi-k2.5 OpenRouter 400 Error

## Requirements (confirmed)
- Fix 400 "invalid request error" when using moonshotai/kimi-k2.5 through OpenRouter/Novita
- Move `parallelToolCalls: false` from `providerOptions.openai` namespace to top-level parameter (Decision A for Q1)
- Add 400 error detection with single retry without problematic options (Decision B for Q2)
- Skip model pre-validation, handle errors gracefully (Decision A for Q3)
- Unit tests + update existing tests (Decision A for Q4)

## Technical Decisions
- `parallelToolCalls: false` → top-level param: The Vercel AI SDK supports this natively; wrapping in `providerOptions.openai` sends it as OpenAI-specific which Novita rejects
- 400 retry strategy: Detect → warn → retry once without parallelToolCalls → throw if still fails. NO model fallback (masks real config bugs)
- No pre-validation: OpenRouter model list can be stale; adds latency without benefit

## Research Findings
- Google Search: Novita rejects unrecognized provider-specific options; `providerOptions.openai` namespace is OpenAI-only
- Vercel AI SDK docs: `parallelToolCalls` is a top-level param on `streamText`/`generateText`, not provider-specific
- OpenRouter docs: `parallel_tool_calls` parameter is part of the OpenAI-compatible spec, but non-OpenAI providers may not support it

## Scope Boundaries
- INCLUDE: Fix all 4 locations in code-agent.ts, add 400 error detection, update tests
- EXCLUDE: Model fallback logic, pre-validation API, changes to client.ts or types.ts model config

## Affected Code Locations
1. `src/agents/code-agent.ts:607-608` - Main streaming
2. `src/agents/code-agent.ts:741-742` - Summary generation
3. `src/agents/code-agent.ts:866-867` - Auto-fix generation
4. `src/agents/code-agent.ts:1197-1198` - Error-fix generation
5. `src/agents/rate-limit.ts` - Needs `isInvalidRequestError` function
6. `tests/model-selection.test.ts` - Needs update
7. `tests/gateway-fallback.test.ts` - Needs update
