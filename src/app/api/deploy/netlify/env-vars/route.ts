import { NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser, getToken } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type EnvVarPayload = {
  siteId: string;
  key: string;
  value?: string;
  context?: string;
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

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const envVars = await netlifyClient.getEnvVars(siteId);

    const sanitizedEnvVars = Array.isArray(envVars) ? envVars.map((envVar) => {
      const { values, ...rest } = envVar as { values?: unknown; [key: string]: unknown };
      return rest;
    }) : [];

    return NextResponse.json(sanitizedEnvVars);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch env vars";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as EnvVarPayload;
    if (
      !body.siteId ||
      !body.key ||
      typeof body.value !== "string" ||
      body.value.length === 0
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const envVar = await netlifyClient.setEnvVar(
      body.siteId,
      body.key,
      body.value,
      body.context
    );

    return NextResponse.json(envVar);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set env var";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as EnvVarPayload;
    if (
      !body.siteId ||
      !body.key ||
      typeof body.value !== "string" ||
      body.value.length === 0
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const envVar = await netlifyClient.updateEnvVar(
      body.siteId,
      body.key,
      body.value,
      body.context
    );

    return NextResponse.json(envVar);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update env var";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const key = searchParams.get("key");
    if (!siteId || !key) {
      return NextResponse.json({ error: "Missing siteId or key" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    await netlifyClient.deleteEnvVar(siteId, key);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete env var";

    if (message.includes("Netlify connection not found")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
