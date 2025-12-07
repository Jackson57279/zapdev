import { verifyToken } from "@clerk/backend";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/**
 * Get the authenticated user from Convex Auth (server-side)
 * This should be called from Server Components or API routes
 * Note: With Convex Auth, authentication is primarily client-side
 * For server-side API routes, users should be verified through Convex queries
 */
export async function getUser(req?: Request) {
  try {
    const token = await extractClerkToken(req);
    if (!token) {
      return null;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.warn("CLERK_SECRET_KEY is not set; skipping auth verification");
      return null;
    }

    const claims = await verifyToken(token, { secretKey });

    // Try to enrich from Convex if available
    try {
      const user = await fetchQuery(api.users.getCurrentUser, {}, { token });
      if (user) {
        return {
          id: user.tokenIdentifier ?? claims.sub ?? "",
          email: user.email,
          name: user.name,
          image: user.image,
          primaryEmail: user.email,
          displayName: user.name ?? user.email ?? claims.sub ?? "",
        };
      }
    } catch (convexError) {
      console.warn("Convex user fetch failed, falling back to Clerk claims", convexError);
    }

    return {
      id: claims.sub ?? "",
      email: (claims as any).email ?? null,
      name:
        `${(claims as any).firstName ?? ""} ${(claims as any).lastName ?? ""}`.trim() ||
        (claims as any).email ??
        null,
      image: null,
      primaryEmail: (claims as any).email ?? null,
      displayName: (claims as any).email ?? claims.sub ?? "",
    };
  } catch (error) {
    console.error("Failed to get user:", error);
    return null;
  }
}

/**
 * Get the authentication token for Convex
 * Returns the token if user is authenticated
 */
export async function getToken(req?: Request) {
  try {
    return await extractClerkToken(req);
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
}

/**
 * Get auth headers for API calls
 * Convex Auth handles this automatically, this is for manual use if needed
 */
export async function getAuthHeaders(req?: Request) {
  const token = await extractClerkToken(req);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch a Convex query with authentication
 * Use this in Server Components or API routes
 */
export async function fetchQueryWithAuth<T>(
  query: any,
  args: any = {},
  req?: Request,
): Promise<T> {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;
  return options ? fetchQuery(query, args, options) : fetchQuery(query, args);
}

/**
 * Fetch a Convex mutation with authentication
 * Use this in Server Components or API routes  
 */
export async function fetchMutationWithAuth<T>(
  mutation: any,
  args: any = {},
  req?: Request,
): Promise<T> {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;

  return options
    ? fetchMutation(mutation, args, options)
    : fetchMutation(mutation, args);
}

type ArgsOf<Func extends FunctionReference<any>> =
  Func["_args"] extends undefined ? Record<string, never> : Func["_args"];

type ConvexClientWithAuth = {
  query<Query extends FunctionReference<"query">>(
    query: Query,
    args?: ArgsOf<Query>
  ): Promise<FunctionReturnType<Query>>;
  mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    args?: ArgsOf<Mutation>
  ): Promise<FunctionReturnType<Mutation>>;
  action<Action extends FunctionReference<"action">>(
    action: Action,
    args?: ArgsOf<Action>
  ): Promise<FunctionReturnType<Action>>;
};

/**
 * Create a minimal Convex client that forwards the authenticated token
 * from Convex Auth cookies when calling queries, mutations, or actions.
 * Use this in API routes and server components that need to talk to Convex.
 */
export async function getConvexClientWithAuth(req?: Request): Promise<ConvexClientWithAuth> {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;

  const client: ConvexClientWithAuth = {
    query: async <Query extends FunctionReference<"query">>(
      query: Query,
      args?: ArgsOf<Query>
    ) => {
      const normalizedArgs = (args ?? {}) as ArgsOf<Query>;
      return options
        ? await fetchQuery(query, normalizedArgs, options)
        : await fetchQuery(query, normalizedArgs);
    },
    mutation: async <Mutation extends FunctionReference<"mutation">>(
      mutation: Mutation,
      args?: ArgsOf<Mutation>
    ) => {
      const normalizedArgs = (args ?? {}) as ArgsOf<Mutation>;
      return options
        ? await fetchMutation(mutation, normalizedArgs, options)
        : await fetchMutation(mutation, normalizedArgs);
    },
    action: async <Action extends FunctionReference<"action">>(
      action: Action,
      args?: ArgsOf<Action>
    ) => {
      const normalizedArgs = (args ?? {}) as ArgsOf<Action>;
      return options
        ? await fetchAction(action, normalizedArgs, options)
        : await fetchAction(action, normalizedArgs);
    },
  };

  return client;
}

async function extractClerkToken(req?: Request): Promise<string | null> {
  if (!req) return null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const token = getCookieValue(cookieHeader, "__session");
    if (token) return token;
  }

  return null;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}
