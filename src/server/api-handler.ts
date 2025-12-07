type RouteModule = {
  GET?: (request: Request, ctx?: unknown) => Promise<Response> | Response;
  POST?: (request: Request, ctx?: unknown) => Promise<Response> | Response;
  OPTIONS?: (request: Request, ctx?: unknown) => Promise<Response> | Response;
};

type RouteConfig = {
  pattern: RegExp;
  load: () => Promise<RouteModule>;
  params?: (url: URL) => Record<string, string>;
};

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
          const robotsFn = (mod as any).default ?? mod;
          const data = typeof robotsFn === "function" ? robotsFn() : robotsFn;

          const lines: string[] = [];
          const rules = Array.isArray(data.rules) ? data.rules : [data.rules];

          for (const rule of rules) {
            const userAgents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
            for (const ua of userAgents) {
              lines.push(`User-agent: ${ua}`);
              const allows = rule.allow
                ? Array.isArray(rule.allow)
                  ? rule.allow
                  : [rule.allow]
                : [];
              const disallows = rule.disallow
                ? Array.isArray(rule.disallow)
                  ? rule.disallow
                  : [rule.disallow]
                : [];
              allows.forEach((p) => lines.push(`Allow: ${p}`));
              disallows.forEach((p) => lines.push(`Disallow: ${p}`));
              lines.push("");
            }
          }

          const sitemap = data.sitemap
            ? Array.isArray(data.sitemap)
              ? data.sitemap
              : [data.sitemap]
            : [];
          sitemap.forEach((s) => lines.push(`Sitemap: ${s}`));

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

  const handler =
    (method === "HEAD" && mod.HEAD) ||
    (method === "HEAD" && mod.GET) ||
    (method === "OPTIONS" && mod.OPTIONS) ||
    (mod as any)[method];

  if (handler) {
    return handler(request as any, ctx as any);
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
      const mod = await route.load();
      const params = route.params ? route.params(url) : undefined;
      return handleWithModule(mod, request, params);
    }
  }

  return new Response("Not Found", { status: 404 });
}
