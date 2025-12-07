import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as helpers from "@/convex/helpers";
import type * as importData from "@/convex/importData";
import type * as importsModule from "@/convex/imports";
import type * as messages from "@/convex/messages";
import type * as oauth from "@/convex/oauth";
import type * as projects from "@/convex/projects";
import type * as usage from "@/convex/usage";

declare module "@/convex/_generated/api" {
  export const api: FilterApi<
    ApiFromModules<{
      helpers: typeof helpers;
      importData: typeof importData;
      imports: typeof importsModule;
      messages: typeof messages;
      oauth: typeof oauth;
      projects: typeof projects;
      usage: typeof usage;
    }>,
    FunctionReference<unknown, "public">
  >;

  export const internal: FilterApi<
    ApiFromModules<{
      helpers: typeof helpers;
      importData: typeof importData;
      imports: typeof importsModule;
      messages: typeof messages;
      oauth: typeof oauth;
      projects: typeof projects;
      usage: typeof usage;
    }>,
    FunctionReference<unknown, "internal">
  >;
}

