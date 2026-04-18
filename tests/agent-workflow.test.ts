import { describe, it } from "@jest/globals";

/**
 * Legacy tests targeted `runCodeAgent` / `runErrorFix` from `@/agents/code-agent`.
 * Code generation now runs in Inngest with E2B (`src/inngest/functions.ts`).
 * Kept as a skipped placeholder so the suite documents the migration.
 */
describe.skip("Agent workflow (superseded by Inngest + E2B)", () => {
  it("was removed — use integration tests against /api/inngest + E2B", () => {});
});
