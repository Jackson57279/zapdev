import JSZip from "jszip";
import { NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { filterFilesForDownload } from "@/lib/filter-ai-files";
import { getNetlifyToml } from "@/lib/netlify-config";
import { createNetlifyClient } from "@/lib/netlify-client";

type DeployRequest = {
  projectId: string;
  siteId?: string;
  deployType?: "preview" | "production";
  branch?: string;
  commitRef?: string;
};

type MessageWithFragment = {
  _id: Id<"messages">;
  _creationTime: number;
  Fragment: {
    _id: Id<"fragments">;
    files?: unknown;
    framework: "NEXTJS" | "REACT" | "VUE" | "ANGULAR" | "SVELTE";
  } | null;
};

type NetlifyConnection = {
  accessToken?: string;
};

const normalizeFiles = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content === "string") {
      files[path] = content;
    }
  }
  return files;
};

const getLatestFragmentFiles = async (projectId: Id<"projects">) => {
  const messages = await fetchQuery(api.messages.list, { projectId }) as MessageWithFragment[];
  const latestWithFragment = [...messages].reverse().find((message) => message.Fragment);
  const fragment = latestWithFragment?.Fragment;

  if (!fragment) {
    throw new Error("No AI-generated files are ready to deploy.");
  }

  const normalized = normalizeFiles(fragment.files);
  const filtered = filterFilesForDownload(normalized);

  if (Object.keys(filtered).length === 0) {
    throw new Error("No AI-generated files are ready to deploy.");
  }

  return { files: filtered, framework: fragment.framework };
};

const getNetlifyAccessToken = async (): Promise<string> => {
  const connection = await fetchQuery(api.oauth.getConnection, {
    provider: "netlify",
  }) as NetlifyConnection | null;

  if (!connection?.accessToken) {
    throw new Error("Netlify connection not found. Please connect your Netlify account.");
  }

  return connection.accessToken;
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as DeployRequest;
    if (!body.projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const projectId = body.projectId as Id<"projects">;
    const convex = await getConvexClientWithAuth();
    const project = await convex.query(api.projects.get, { projectId });

    const { files, framework } = await getLatestFragmentFiles(projectId);
    const netlifyToml = getNetlifyToml(framework);
    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());

    const zip = new JSZip();
    for (const [filename, content] of Object.entries(files)) {
      zip.file(filename, content);
    }
    zip.file("netlify.toml", netlifyToml);

    const archive = await zip.generateAsync({ type: "arraybuffer" });
    const archiveBlob = new Blob([archive], { type: "application/zip" });

    const site =
      body.siteId ? await netlifyClient.getSite(body.siteId) : await netlifyClient.createSite(project.name);

    const deploy =
      body.deployType === "preview"
        ? await netlifyClient.createPreviewDeployment(site.id, archiveBlob)
        : await netlifyClient.deploySite(site.id, archiveBlob);

    await fetchMutation(api.deployments.createDeployment, {
      projectId,
      platform: "netlify",
      siteId: site.id,
      siteUrl: site.site_url || site.url,
      deployId: deploy.id,
      status: deploy.state || "pending",
      isPreview: body.deployType === "preview",
      branch: body.branch,
      commitRef: body.commitRef,
    });

    return NextResponse.json({
      siteId: site.id,
      siteUrl: site.site_url || site.url,
      deployId: deploy.id,
      deployState: deploy.state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deployment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
