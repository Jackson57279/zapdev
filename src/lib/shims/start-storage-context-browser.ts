// Browser-safe stub for @tanstack/start-storage-context.
// The real package relies on AsyncLocalStorage (node:async_hooks),
// which Vite cannot bundle for client builds. This lightweight
// implementation satisfies the API shape without pulling in Node deps.

export async function runWithStartContext<TResult>(
  _context: unknown,
  fn: () => TResult | Promise<TResult>,
): Promise<TResult> {
  return await fn();
}

export function getStartContext<TContext>(_opts?: {
  throwIfNotFound?: boolean;
}): TContext | undefined {
  return undefined;
}
