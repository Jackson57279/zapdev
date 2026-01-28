import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser, getToken } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type NetlifyConnection = {
  accessToken?: string;
};

const getNetlifyAccessToken = async (): Promise<string> => {
  const token = await getToken();
  const connection = await fetchQuery(
    api.oauth.getConnection,
    { provider: "netlify" },
    { token: token ?? undefined },
  ) as NetlifyConnection | null;

  if (!connection?.accessToken) {
    throw new Error("Netlify connection not found.");
  }

  return connection.accessToken;
};

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const sites = await netlifyClient.listSites();

    return NextResponse.json(sites);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sites";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
