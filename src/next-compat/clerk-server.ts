import { clerkClient, createClerkClient, verifyToken } from "@clerk/backend";

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

export const clerkMiddleware =
  (handler: any) =>
  async (...args: any[]) =>
    handler(
      {
        protect: async () => undefined,
      },
      ...args,
    );

export { clerkClient, createClerkClient, verifyToken };
