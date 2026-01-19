import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type NetlifyConnection = {
  accessToken?: string;
};

const getNetlifyAccessToken = async (): Promise<string> => {
  const connection = await fetchQuery(api.oauth.getConnection, {
    provider: "netlify",
  }) as NetlifyConnection | null;

  if (!connection?.accessToken) {
    throw new Error("Netlify connection not found.");
  }

  return connection.accessToken;
};

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deployId = searchParams.get("deployId");
    if (!deployId) {
      return NextResponse.json({ error: "Missing deployId" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const status = await netlifyClient.getDeploymentStatus(deployId);

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
