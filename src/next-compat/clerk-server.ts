import { createClerkClient, verifyToken } from "@clerk/backend";

export function auth() {
  // Minimal server-side auth shim.
  return {
    getToken: async (_opts?: { template?: string }) => null,
    userId: null,
  };
}

export const createRouteMatcher = (_patterns: string[]) => {
  return (_path: string) => false;
};

type ClerkMiddlewareContext = {
  protect: () => Promise<void>;
};

export const clerkMiddleware =
  <Args extends unknown[]>(
    handler: (context: ClerkMiddlewareContext, ...args: Args) => Promise<unknown> | unknown,
  ) =>
  async (...args: Args) =>
    handler(
      {
        protect: async () => undefined,
      },
      ...args,
    );

export { createClerkClient, verifyToken };
