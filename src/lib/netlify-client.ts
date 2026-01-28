type NetlifyRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

type NetlifySite = {
  id: string;
  name: string;
  url: string;
  site_url: string;
  admin_url?: string;
};

type NetlifyDeploy = {
  id: string;
  state: string;
  url?: string;
  deploy_url?: string;
  created_at?: string;
  updated_at?: string;
};

type NetlifyEnvVar = {
  key: string;
  values?: Array<{
    value: string;
    context?: string;
  }>;
};

type NetlifyDomain = {
  id: string;
  name: string;
  ssl_status?: string;
  verification?: {
    status?: string;
  };
};

const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
};

const handleApiError = async (response: Response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`Netlify rate limit hit. Retry after ${retryAfter ?? "unknown"} seconds.`);
  }

  const errorBody = await response.text();
  throw new Error(errorBody || `Netlify API error: ${response.status}`);
};

export const createNetlifyClient = (accessToken: string) => {
  const request = async <T>(path: string, options: NetlifyRequestOptions = {}) => {
    const response = await fetch(`${NETLIFY_API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers ?? {}),
      },
      body: options.body ?? null,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return parseJson<T>(response);
  };

  return {
    async createSite(name?: string): Promise<NetlifySite> {
      return request<NetlifySite>("/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(name ? { name } : {}),
      });
    },

    async getSite(siteId: string): Promise<NetlifySite> {
      return request<NetlifySite>(`/sites/${siteId}`);
    },

    async listSites(): Promise<NetlifySite[]> {
      return request<NetlifySite[]>("/sites");
    },

    async updateSite(siteId: string, payload: Record<string, unknown>): Promise<NetlifySite> {
      return request<NetlifySite>(`/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async deleteSite(siteId: string): Promise<void> {
      await request<void>(`/sites/${siteId}`, { method: "DELETE" });
    },

    async deploySite(siteId: string, zipBody: BodyInit, options?: { draft?: boolean }): Promise<NetlifyDeploy> {
      const params = new URLSearchParams();
      if (options?.draft) {
        params.set("draft", "true");
      }

      const query = params.toString();
      const path = query ? `/sites/${siteId}/deploys?${query}` : `/sites/${siteId}/deploys`;

      return request<NetlifyDeploy>(path, {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: zipBody,
      });
    },

    async getDeploymentStatus(deployId: string): Promise<NetlifyDeploy> {
      return request<NetlifyDeploy>(`/deploys/${deployId}`);
    },

    async listDeployments(siteId: string): Promise<NetlifyDeploy[]> {
      return request<NetlifyDeploy[]>(`/sites/${siteId}/deploys`);
    },

    async getDeployment(deployId: string): Promise<NetlifyDeploy> {
      return request<NetlifyDeploy>(`/deploys/${deployId}`);
    },

    async cancelDeployment(deployId: string): Promise<NetlifyDeploy> {
      return request<NetlifyDeploy>(`/deploys/${deployId}/cancel`, { method: "POST" });
    },

    async rollbackDeployment(deployId: string): Promise<NetlifyDeploy> {
      return request<NetlifyDeploy>(`/deploys/${deployId}/rollback`, { method: "POST" });
    },

    async getBuildLog(deployId: string): Promise<string> {
      const response = await fetch(`${NETLIFY_API_BASE}/deploys/${deployId}/logs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      return response.text();
    },

    async getEnvVars(siteId: string): Promise<NetlifyEnvVar[]> {
      return request<NetlifyEnvVar[]>(`/sites/${siteId}/env`);
    },

    async setEnvVar(siteId: string, key: string, value: string, context = "all"): Promise<NetlifyEnvVar> {
      return request<NetlifyEnvVar>(`/sites/${siteId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          values: [{ value, context }],
        }),
      });
    },

    async updateEnvVar(siteId: string, key: string, value: string, context = "all"): Promise<NetlifyEnvVar> {
      return request<NetlifyEnvVar>(`/sites/${siteId}/env/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [{ value, context }],
        }),
      });
    },

    async deleteEnvVar(siteId: string, key: string): Promise<void> {
      await request<void>(`/sites/${siteId}/env/${encodeURIComponent(key)}`, { method: "DELETE" });
    },

    async setBulkEnvVars(siteId: string, vars: Array<{ key: string; value: string; context?: string }>): Promise<NetlifyEnvVar[]> {
      const payload = vars.map((entry) => ({
        key: entry.key,
        values: [{ value: entry.value, context: entry.context ?? "all" }],
      }));

      return request<NetlifyEnvVar[]>(`/sites/${siteId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },

    async listDomains(siteId: string): Promise<NetlifyDomain[]> {
      return request<NetlifyDomain[]>(`/sites/${siteId}/domains`);
    },

    async addDomain(siteId: string, domain: string): Promise<NetlifyDomain> {
      return request<NetlifyDomain>(`/sites/${siteId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: domain }),
      });
    },

    async deleteDomain(siteId: string, domainId: string): Promise<void> {
      await request<void>(`/sites/${siteId}/domains/${domainId}`, { method: "DELETE" });
    },

    async verifyDomain(siteId: string, domainId: string): Promise<NetlifyDomain> {
      return request<NetlifyDomain>(`/sites/${siteId}/domains/${domainId}`);
    },

    async getDnsRecords(siteId: string, domainId: string): Promise<NetlifyDomain> {
      return request<NetlifyDomain>(`/sites/${siteId}/domains/${domainId}`);
    },

    async createPreviewDeployment(siteId: string, zipBody: BodyInit): Promise<NetlifyDeploy> {
      return request<NetlifyDeploy>(`/sites/${siteId}/deploys?draft=true`, {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: zipBody,
      });
    },

    async listPreviewDeployments(siteId: string): Promise<NetlifyDeploy[]> {
      return request<NetlifyDeploy[]>(`/sites/${siteId}/deploys?draft=true`);
    },

    async deletePreviewDeployment(deployId: string): Promise<void> {
      await request<void>(`/deploys/${deployId}`, { method: "DELETE" });
    },
  };
};
