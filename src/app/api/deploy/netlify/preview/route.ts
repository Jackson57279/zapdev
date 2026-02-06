import { NextResponse } from "next/server";
import { fetchAction, fetchQuery } from "convex/nextjs";
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

export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = (await getToken()) ?? undefined;
    const { searchParams } = new URL(request.url);
    const deployId = searchParams.get("deployId");
    if (!deployId) {
      return NextResponse.json({ error: "Missing deployId" }, { status: 400 });
    }

    const deployment = await fetchQuery(
      api.deployments.getDeploymentByDeployId,
      { deployId },
      { token },
    );

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    await netlifyClient.deletePreviewDeployment(deployId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete preview";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
