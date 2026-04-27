import { describe, expect, it } from "@jest/globals";

import { isProviderReturnedError } from "../src/inngest/provider-errors";

describe("Inngest provider error detection", () => {
  it("treats structured OpenRouter 429 payloads as retriable", () => {
    expect(
      isProviderReturnedError({
        error: {
          code: 429,
          message: "Provider returned error",
          metadata: {
            is_byok: false,
            provider_name: "Io Net",
            raw: "deepseek/deepseek-v4-pro is temporarily rate-limited upstream. Please retry shortly.",
          },
        },
      })
    ).toBe(true);
  });

  it("does not retry non-provider validation errors", () => {
    expect(
      isProviderReturnedError({
        error: {
          code: 400,
          message: "Invalid request body",
        },
      })
    ).toBe(false);
  });
});
