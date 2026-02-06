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

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
