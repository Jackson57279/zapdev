import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

function makeClient(token?: string | null) {
  const client = new ConvexHttpClient(convexUrl);
  if (token) {
    client.setAuth(token);
  }
  return client;
}

type ArgsOf<Func extends FunctionReference<any>> =
  Func["_args"] extends undefined ? Record<string, never> : Func["_args"];

export async function fetchQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: ArgsOf<Query>,
  options?: { token?: string | null },
): Promise<FunctionReturnType<Query>> {
  const client = makeClient(options?.token ?? undefined);
  return client.query(query, (args ?? {}) as ArgsOf<Query>);
}

export async function fetchMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  args?: ArgsOf<Mutation>,
  options?: { token?: string | null },
): Promise<FunctionReturnType<Mutation>> {
  const client = makeClient(options?.token ?? undefined);
  return client.mutation(mutation, (args ?? {}) as ArgsOf<Mutation>);
}

export async function fetchAction<Action extends FunctionReference<"action">>(
  action: Action,
  args?: ArgsOf<Action>,
  options?: { token?: string | null },
): Promise<FunctionReturnType<Action>> {
  const client = makeClient(options?.token ?? undefined);
  return client.action(action, (args ?? {}) as ArgsOf<Action>);
}
