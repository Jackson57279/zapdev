import { auth } from "@clerk/nextjs/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/**
 * Get the authenticated user from Convex Auth (server-side)
 * This should be called from Server Components or API routes
 * Note: With Convex Auth, authentication is primarily client-side
 * For server-side API routes, users should be verified through Convex queries
 */
export async function getUser() {
  try {
    const { getToken, userId } = await auth();
    if (!userId) return null;

    const token = await getToken({ template: "convex" });
    const options = token ? { token } : undefined;

    const user = options
      ? await fetchQuery(api.users.getCurrentUser, {}, options)
      : await fetchQuery(api.users.getCurrentUser);
    if (!user) return null;

    return {
      id: user.tokenIdentifier ?? userId,
      email: user.email,
      name: user.name,
      image: user.image,
      primaryEmail: user.email,
      displayName: user.name,
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
export async function getToken() {
  try {
    const { getToken } = await auth();
    return await getToken({ template: "convex" });
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
}

/**
 * Get auth headers for API calls
 * Convex Auth handles this automatically, this is for manual use if needed
 */
export async function getAuthHeaders() {
  const user = await getUser();
  if (!user) return {};
  return {};
}

/**
 * Fetch a Convex query with authentication
 * Use this in Server Components or API routes
 */
export async function fetchQueryWithAuth<T>(
  query: any,
  args: any = {}
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const options = token ? { token } : undefined;

  return options ? fetchQuery(query, args, options) : fetchQuery(query, args);
}

/**
 * Fetch a Convex mutation with authentication
 * Use this in Server Components or API routes  
 */
export async function fetchMutationWithAuth<T>(
  mutation: any,
  args: any = {}
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
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
export async function getConvexClientWithAuth(): Promise<ConvexClientWithAuth> {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
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
