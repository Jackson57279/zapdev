// Minimal type shims for former Next.js imports
export type Metadata = Record<string, unknown>;

export interface NextPageContext {
  err?: Error & { statusCode?: number };
  req?: unknown;
  res?: { statusCode?: number };
  pathname?: string;
  query?: Record<string, unknown>;
  asPath?: string;
}

export namespace MetadataRoute {
  export type Robots = {
    rules:
      | {
          userAgent: string | string[];
          allow?: string | string[];
          disallow?: string | string[];
        }
      | Array<{
          userAgent: string | string[];
          allow?: string | string[];
          disallow?: string | string[];
        }>;
    sitemap?: string | string[];
    host?: string;
  };

  export type Sitemap = Array<{
    url: string;
    lastModified?: string | Date;
    changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
  }>;
}
