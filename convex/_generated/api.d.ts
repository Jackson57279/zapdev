/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as e2bRateLimits from "../e2bRateLimits.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as importData from "../importData.js";
import type * as imports from "../imports.js";
import type * as jobQueue from "../jobQueue.js";
import type * as messages from "../messages.js";
import type * as oauth from "../oauth.js";
import type * as projects from "../projects.js";
import type * as rateLimit from "../rateLimit.js";
import type * as sandboxSessions from "../sandboxSessions.js";
import type * as specs from "../specs.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  e2bRateLimits: typeof e2bRateLimits;
  helpers: typeof helpers;
  http: typeof http;
  importData: typeof importData;
  imports: typeof imports;
  jobQueue: typeof jobQueue;
  messages: typeof messages;
  oauth: typeof oauth;
  projects: typeof projects;
  rateLimit: typeof rateLimit;
  sandboxSessions: typeof sandboxSessions;
  specs: typeof specs;
  subscriptions: typeof subscriptions;
  usage: typeof usage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
