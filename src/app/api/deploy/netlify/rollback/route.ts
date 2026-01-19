import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type NetlifyConnection = {
  accessToken?: string;
};

type RollbackPayload = {
  deployId: string;
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

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RollbackPayload;
    if (!body.deployId) {
      return NextResponse.json({ error: "Missing deployId" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const rollback = await netlifyClient.rollbackDeployment(body.deployId);

    return NextResponse.json(rollback);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
