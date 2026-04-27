function collectErrorStrings(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0
): string[] {
  if (typeof value === "string") return [value];
  if (depth > 4 || typeof value !== "object" || value === null || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorStrings(item, seen, depth + 1));
  }

  return Object.values(value).flatMap((item) =>
    collectErrorStrings(item, seen, depth + 1)
  );
}

function collectErrorNumbers(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0
): number[] {
  if (typeof value === "number") return [value];
  if (depth > 4 || typeof value !== "object" || value === null || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorNumbers(item, seen, depth + 1));
  }

  return Object.values(value).flatMap((item) =>
    collectErrorNumbers(item, seen, depth + 1)
  );
}

export function isProviderReturnedError(error: unknown): boolean {
  const messages = collectErrorStrings(error);
  const numericSignals = collectErrorNumbers(error);

  if (numericSignals.includes(429)) {
    return true;
  }

  return messages.some((message) =>
    /provider returned error|temporarily rate-limited upstream|too many requests|rate limit/i.test(
      message
    )
  );
}
