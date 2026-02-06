import { NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser, getToken } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

const getNetlifyAccessToken = async (): Promise<string> => {
  const token = await getToken();
  const accessToken = await fetchAction(
    api.oauth.getAccessTokenForCurrentUser,
    { provider: "netlify" as const },
    { token: token ?? undefined },
  ) as string | null;

  if (!accessToken) {
    throw new Error("Netlify connection not found.");
  }

  return accessToken;
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
