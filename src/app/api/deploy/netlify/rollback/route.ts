import { NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser, getToken } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type RollbackPayload = {
  deployId: string;
};

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

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
