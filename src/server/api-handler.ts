type RouteHandler = (request: Request, ctx?: unknown) => Promise<Response> | Response;
type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
type RouteModule = Partial<Record<RouteMethod, RouteHandler>>;

type RouteConfig = {
  pattern: RegExp;
  load: () => Promise<unknown>;
  params?: (url: URL) => Record<string, string>;
};

const ROUTE_METHODS: RouteMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

/**
 * Type guard to check if a value is an object with a 'default' property
 */
function isObjectWithDefault(value: unknown): value is { default: unknown } {
  return typeof value === 'object' && value !== null && 'default' in value;
}

/**
 * Type guard to check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is a function matching RouteHandler signature
 */
function isRouteHandler(value: unknown): value is RouteHandler {
  return typeof value === 'function';
}

/**
 * Normalize a module import to extract route handlers
 * Handles both default exports and direct exports
 * Returns null if the module doesn't contain valid route handlers
 */
export function normalizeRouteModule(moduleImport: unknown): RouteModule | null {
  let normalizedImport: unknown;

  // Extract default export if present, otherwise use the module as-is
  if (isObjectWithDefault(moduleImport)) {
    normalizedImport = moduleImport.default;
  } else {
    normalizedImport = moduleImport;
  }

  // Ensure we have an object to work with
  if (!isObject(normalizedImport)) {
    return null;
  }

  const module: RouteModule = {};

  // Process each HTTP method
  for (const method of ROUTE_METHODS) {
    const handler = normalizedImport[method];

    // Skip undefined handlers
    if (handler === undefined) {
      continue;
    }

    // Reject non-function handlers
    if (!isRouteHandler(handler)) {
      return null;
    }

    // Add the handler to the module with proper typing
    module[method] = handler;
  }

  return module;
}

const routes: RouteConfig[] = [
  {
    pattern: /^\/api\/trpc(\/.*)?$/i,
    load: () => import("@/app/api/trpc/[trpc]/route"),
  },
  {
    pattern: /^\/api\/messages\/update\/?$/i,
    load: () => import("@/app/api/messages/update/route"),
  },
  {
    pattern: /^\/api\/fix-errors\/?$/i,
    load: () => import("@/app/api/fix-errors/route"),
  },
  {
    pattern: /^\/api\/fragment\/([^/]+)\/?$/i,
    load: () => import("@/app/api/fragment/[fragmentId]/route"),
    params: (url) => {
      const match = url.pathname.match(/^\/api\/fragment\/([^/]+)\/?$/i);
      return { fragmentId: match?.[1] ?? "" };
    },
  },
  {
    pattern: /^\/api\/import\/figma\/auth\/?$/i,
    load: () => import("@/app/api/import/figma/auth/route"),
  },
  {
    pattern: /^\/api\/import\/figma\/callback\/?$/i,
    load: () => import("@/app/api/import/figma/callback/route"),
  },
  {
    pattern: /^\/api\/import\/figma\/files\/?$/i,
    load: () => import("@/app/api/import/figma/files/route"),
  },
  {
    pattern: /^\/api\/import\/figma\/process\/?$/i,
    load: () => import("@/app/api/import/figma/process/route"),
  },
  {
    pattern: /^\/api\/import\/github\/auth\/?$/i,
    load: () => import("@/app/api/import/github/auth/route"),
  },
  {
    pattern: /^\/api\/import\/github\/callback\/?$/i,
    load: () => import("@/app/api/import/github/callback/route"),
  },
  {
    pattern: /^\/api\/import\/github\/repos\/?$/i,
    load: () => import("@/app/api/import/github/repos/route"),
  },
  {
    pattern: /^\/api\/import\/github\/process\/?$/i,
    load: () => import("@/app/api/import/github/process/route"),
  },
  {
    pattern: /^\/api\/inngest\/trigger\/?$/i,
    load: () => import("@/app/api/inngest/trigger/route"),
  },
  {
    pattern: /^\/api\/inngest\/?$/i,
    load: () => import("@/app/api/inngest/route"),
  },
  {
    pattern: /^\/api\/rss\/?$/i,
    load: () => import("@/app/api/rss/route"),
  },
  {
    pattern: /^\/api\/sentry-example-api\/?$/i,
    load: () => import("@/app/api/sentry-example-api/route"),
  },
  {
    pattern: /^\/api\/test-inngest\/?$/i,
    load: () => import("@/app/api/test-inngest/route"),
  },
  {
    pattern: /^\/api\/transfer-sandbox\/?$/i,
    load: () => import("@/app/api/transfer-sandbox/route"),
  },
  {
    pattern: /^\/api\/uploadthing\/?$/i,
    load: () => import("@/app/api/uploadthing/route"),
  },
  {
    pattern: /^\/api\/vitals\/?$/i,
    load: () => import("@/app/api/vitals/route"),
  },
  {
    pattern: /^\/api\/agent\/token\/?$/i,
    load: () => import("@/app/api/agent/token/route"),
  },
  {
    pattern: /^\/rss\.xml\/?$/i,
    load: () => import("@/app/rss.xml/route"),
  },
  {
    pattern: /^\/sitemap\.xml\/?$/i,
    load: () => import("@/app/sitemap.xml/route"),
  },
  {
    pattern: /^\/robots\.txt\/?$/i,
    load: async () => {
      return {
        GET: async () => {
          const mod = await import("@/app/robots");
          const moduleExport = "default" in mod ? mod.default : mod;
          const robotsFn = moduleExport;
          const data = typeof robotsFn === "function" ? robotsFn() : robotsFn;

          const lines: string[] = [];
          const rules = Array.isArray(data.rules) ? data.rules : [data.rules];

          for (const rule of rules) {
            const userAgents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
            for (const ua of userAgents) {
              lines.push(`User-agent: ${ua}`);
              const allows: string[] = rule.allow
                ? Array.isArray(rule.allow)
                  ? rule.allow
                  : [rule.allow]
                : [];
              const disallows: string[] = rule.disallow
                ? Array.isArray(rule.disallow)
                  ? rule.disallow
                  : [rule.disallow]
                : [];
              allows.forEach((p: string) => lines.push(`Allow: ${p}`));
              disallows.forEach((p: string) => lines.push(`Disallow: ${p}`));
              lines.push("");
            }
          }

          const sitemap: string[] = data.sitemap
            ? Array.isArray(data.sitemap)
              ? data.sitemap
              : [data.sitemap]
            : [];
          sitemap.forEach((s: string) => lines.push(`Sitemap: ${s}`));

          if (data.host) {
            lines.push(`Host: ${data.host}`);
          }

          const body = lines.join("\n").trimEnd();
          return new Response(body, {
            headers: { "Content-Type": "text/plain" },
          });
        },
      };
    },
  },
];

async function handleWithModule(mod: RouteModule, request: Request, params?: Record<string, string>) {
  const method = request.method.toUpperCase();
  const ctx = params ? { params: Promise.resolve(params) } : undefined;

  const methodKey = method as RouteMethod;
  const handler =
    method === 'HEAD'
      ? mod.HEAD ?? mod.GET
      : method === 'OPTIONS'
      ? mod.OPTIONS
      : mod[methodKey];

  if (handler) {
    return handler(request, ctx);
  }

  return new Response("Method Not Allowed", { status: 405 });
}

export async function handleApiRequest(request: Request, _env?: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (!pathname.startsWith("/api") && pathname !== "/rss.xml" && pathname !== "/sitemap.xml" && pathname !== "/robots.txt") {
    return null;
  }

  for (const route of routes) {
    if (route.pattern.test(pathname)) {
      try {
        const modImport = await route.load();
        const mod = normalizeRouteModule(modImport);
        if (!mod) {
          console.error(`Failed to normalize route module for ${pathname}`);
          return new Response('Internal Server Error', { status: 500 });
        }
        const params = route.params ? route.params(url) : undefined;
        return handleWithModule(mod, request, params);
      } catch (error) {
        console.error(`Error loading route module for ${pathname}:`, error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
  }

  return new Response("Not Found", { status: 404 });
}
