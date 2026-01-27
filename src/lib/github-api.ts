import { z } from "zod";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const MAX_TREE_CONTENT_BYTES = 100000;

const githubErrorSchema = z.object({
  message: z.string().optional(),
});

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar_url: z.string().optional(),
});

const githubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  private: z.boolean(),
  default_branch: z.string().optional(),
});

const githubRefSchema = z.object({
  object: z.object({
    sha: z.string(),
  }),
});

const githubTreeSchema = z.object({
  sha: z.string(),
});

const githubCommitSchema = z.object({
  sha: z.string(),
  tree: z.object({
    sha: z.string(),
  }),
});

type GitHubRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
};

export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubRepository = z.infer<typeof githubRepositorySchema>;

export type GitHubTreeEntry = {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
};

export type ProjectFramework = "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE";

export type CreateRepositoryInput = {
  name: string;
  description?: string;
  isPrivate: boolean;
};

export type ExportReadmeInput = {
  projectName: string;
  framework: ProjectFramework;
  description?: string;
};

const parseGitHubError = (payload: unknown, status: number): string => {
  const parsed = githubErrorSchema.safeParse(payload);
  if (parsed.success && parsed.data.message) {
    return parsed.data.message;
  }

  return `GitHub API error (${status})`;
};

const githubRequest = async (
  path: string,
  accessToken: string,
  options: GitHubRequestOptions = {},
): Promise<unknown> => {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ZapDev",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(parseGitHubError(payload, response.status));
  }

  return payload;
};

export const getAuthenticatedUser = async (
  accessToken: string,
): Promise<GitHubUser> => {
  const payload = await githubRequest("/user", accessToken);
  return githubUserSchema.parse(payload);
};

export const listRepositories = async (
  accessToken: string,
): Promise<Array<GitHubRepository>> => {
  const payload = await githubRequest("/user/repos?per_page=100&sort=updated", accessToken);
  return z.array(githubRepositorySchema).parse(payload);
};

export const getRepository = async (
  accessToken: string,
  fullName: string,
): Promise<GitHubRepository> => {
  const payload = await githubRequest(`/repos/${fullName}`, accessToken);
  return githubRepositorySchema.parse(payload);
};

export const createRepository = async (
  accessToken: string,
  input: CreateRepositoryInput,
): Promise<GitHubRepository> => {
  const payload = await githubRequest("/user/repos", accessToken, {
    method: "POST",
    body: {
      name: input.name,
      description: input.description ?? "",
      private: input.isPrivate,
      auto_init: true,
    },
  });
  return githubRepositorySchema.parse(payload);
};

export const getBranchRef = async (
  accessToken: string,
  fullName: string,
  branch: string,
): Promise<string> => {
  const payload = await githubRequest(
    `/repos/${fullName}/git/ref/heads/${branch}`,
    accessToken,
  );
  return githubRefSchema.parse(payload).object.sha;
};

export const getCommitTreeSha = async (
  accessToken: string,
  fullName: string,
  commitSha: string,
): Promise<string> => {
  const payload = await githubRequest(
    `/repos/${fullName}/git/commits/${commitSha}`,
    accessToken,
  );
  return githubCommitSchema.parse(payload).tree.sha;
};

export const createTree = async (
  accessToken: string,
  fullName: string,
  tree: Array<GitHubTreeEntry>,
  baseTreeSha?: string,
): Promise<string> => {
  const payload = await githubRequest(`/repos/${fullName}/git/trees`, accessToken, {
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree,
    },
  });
  return githubTreeSchema.parse(payload).sha;
};

export const createCommit = async (
  accessToken: string,
  fullName: string,
  message: string,
  treeSha: string,
  parents: Array<string>,
): Promise<string> => {
  const payload = await githubRequest(`/repos/${fullName}/git/commits`, accessToken, {
    method: "POST",
    body: {
      message,
      tree: treeSha,
      parents,
    },
  });
  return githubCommitSchema.parse(payload).sha;
};

export const createBranchRef = async (
  accessToken: string,
  fullName: string,
  branch: string,
  commitSha: string,
): Promise<void> => {
  await githubRequest(`/repos/${fullName}/git/refs`, accessToken, {
    method: "POST",
    body: {
      ref: `refs/heads/${branch}`,
      sha: commitSha,
    },
  });
};

export const updateBranchRef = async (
  accessToken: string,
  fullName: string,
  branch: string,
  commitSha: string,
): Promise<void> => {
  await githubRequest(`/repos/${fullName}/git/refs/heads/${branch}`, accessToken, {
    method: "PATCH",
    body: {
      sha: commitSha,
      force: false,
    },
  });
};

const sanitizePath = (value: string): string => {
  return value.replace(/^\/+/, "").replace(/\\/g, "/");
};

export const buildTreeEntries = (
  files: Record<string, string>,
): Array<GitHubTreeEntry> => {
  const entries: Array<GitHubTreeEntry> = [];
  const encoder = new TextEncoder();

  for (const [rawPath, content] of Object.entries(files)) {
    const path = sanitizePath(rawPath);
    if (!path) {
      continue;
    }

    const byteLength = encoder.encode(content).length;
    if (byteLength > MAX_TREE_CONTENT_BYTES) {
      throw new Error(`File too large for GitHub export: ${path}`);
    }

    entries.push({
      path,
      mode: "100644",
      type: "blob",
      content,
    });
  }

  return entries;
};

const getFrameworkLabel = (framework: ProjectFramework): string => {
  switch (framework) {
    case "NEXTJS":
      return "Next.js";
    case "ANGULAR":
      return "Angular";
    case "REACT":
      return "React";
    case "VUE":
      return "Vue";
    case "SVELTE":
      return "Svelte";
    default:
      return framework;
  }
};

export const generateReadme = (input: ExportReadmeInput): string => {
  const frameworkLabel = getFrameworkLabel(input.framework);

  const lines: Array<string> = [`# ${input.projectName}`, ""];

  if (input.description) {
    lines.push(input.description, "");
  }

  lines.push(
    "Exported from ZapDev.",
    "",
    `Framework: ${frameworkLabel}`,
    "",
    "## Getting Started",
    "",
    "1. Install dependencies with `bun install`.",
    "2. Start the dev server with `bun run dev`.",
    "3. Build for production with `bun run build`.",
  );

  return lines.join("\n");
};

export const generateGitignore = (framework: ProjectFramework): string => {
  const base = [
    "node_modules",
    ".env",
    ".env.local",
    ".env.*.local",
    "dist",
    "build",
    ".cache",
    ".DS_Store",
  ];

  const frameworkSpecific: Record<ProjectFramework, Array<string>> = {
    NEXTJS: [".next", "out", "next-env.d.ts"],
    REACT: ["coverage"],
    VUE: ["dist", ".vite"],
    ANGULAR: [".angular", "dist"],
    SVELTE: [".svelte-kit"],
  };

  const entries = [...base, ...frameworkSpecific[framework]];
  return entries.join("\n");
};

export const withDefaultFiles = (
  files: Record<string, string>,
  input: ExportReadmeInput,
  includeReadme: boolean,
  includeGitignore: boolean,
): Record<string, string> => {
  const updated: Record<string, string> = { ...files };

  if (includeReadme && !updated["README.md"]) {
    updated["README.md"] = generateReadme(input);
  }

  if (includeGitignore && !updated[".gitignore"]) {
    updated[".gitignore"] = generateGitignore(input.framework);
  }

  return updated;
};
