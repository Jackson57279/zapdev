import { verifyToken } from "@clerk/backend";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

interface ClerkTokenClaims {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

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
      const errorMsg = "CLERK_SECRET_KEY is not set; authentication disabled";
      if (process.env.NODE_ENV === "production") {
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      console.warn(errorMsg);
      return null;
    }

    const claims = await verifyToken(token, { secretKey });
    
    // Type guard for Clerk claims
    if (!claims || typeof claims !== "object" || !("sub" in claims)) {
      console.error("Invalid token claims structure");
      return null;
    }
    
    const claimsTyped: ClerkTokenClaims = {
      sub: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : undefined,
      firstName: typeof claims.firstName === "string" ? claims.firstName : undefined,
      lastName: typeof claims.lastName === "string" ? claims.lastName : undefined,
    };

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

    const rawFullName = `${claimsTyped.firstName ?? ""} ${claimsTyped.lastName ?? ""}`.trim();
    const nameFromClaims = rawFullName === "" ? null : rawFullName;

    return {
      id: claimsTyped.sub,
      email: claimsTyped.email ?? null,
      name: (nameFromClaims ?? claimsTyped.email) ?? null,
      image: null,
      primaryEmail: claimsTyped.email ?? null,
      displayName: claimsTyped.email ?? claimsTyped.sub,
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
export async function fetchQueryWithAuth<
  Query extends FunctionReference<"query">
>(
  query: Query,
  args?: Query["_args"],
  req?: Request,
): Promise<FunctionReturnType<Query>> {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;
  
  if (options) {
    return fetchQuery(query, args, options);
  }
  return fetchQuery(query, args);
}

/**
 * Fetch a Convex mutation with authentication
 * Use this in Server Components or API routes  
 */
export async function fetchMutationWithAuth<
  Mutation extends FunctionReference<"mutation">
>(
  mutation: Mutation,
  args?: Mutation["_args"],
  req?: Request,
): Promise<FunctionReturnType<Mutation>> {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;

  if (options) {
    return fetchMutation(mutation, args, options);
  }
  return fetchMutation(mutation, args);
}

/**
 * Create a minimal Convex client that forwards the authenticated token
 * from Convex Auth cookies when calling queries, mutations, or actions.
 * Use this in API routes and server components that need to talk to Convex.
 */
export async function getConvexClientWithAuth(req?: Request) {
  const token = await extractClerkToken(req);
  const options = token ? { token } : undefined;

  return {
    query: async <Query extends FunctionReference<"query">>(
      query: Query,
      args?: Query["_args"]
    ): Promise<FunctionReturnType<Query>> => {
      if (options) {
        return await fetchQuery(query, args, options);
      }
      return await fetchQuery(query, args);
    },
    mutation: async <Mutation extends FunctionReference<"mutation">>(
      mutation: Mutation,
      args?: Mutation["_args"]
    ): Promise<FunctionReturnType<Mutation>> => {
      if (options) {
        return await fetchMutation(mutation, args, options);
      }
      return await fetchMutation(mutation, args);
    },
    action: async <Action extends FunctionReference<"action">>(
      action: Action,
      args?: Action["_args"]
    ): Promise<FunctionReturnType<Action>> => {
      if (options) {
        return await fetchAction(action, args, options);
      }
      return await fetchAction(action, args);
    },
  };
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
