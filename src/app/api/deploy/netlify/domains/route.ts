import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getUser } from "@/lib/auth-server";
import { createNetlifyClient } from "@/lib/netlify-client";

type NetlifyConnection = {
  accessToken?: string;
};

type DomainPayload = {
  siteId: string;
  domain: string;
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
    const siteId = searchParams.get("siteId");
    const domainId = searchParams.get("domainId");
    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    if (domainId) {
      const domain = await netlifyClient.verifyDomain(siteId, domainId);
      return NextResponse.json(domain);
    }

    const domains = await netlifyClient.listDomains(siteId);
    return NextResponse.json(domains);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch domains";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as DomainPayload;
    if (!body.siteId || !body.domain) {
      return NextResponse.json({ error: "Missing siteId or domain" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    const domain = await netlifyClient.addDomain(body.siteId, body.domain);

    return NextResponse.json(domain);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add domain";
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
    const domainId = searchParams.get("domainId");
    if (!siteId || !domainId) {
      return NextResponse.json({ error: "Missing siteId or domainId" }, { status: 400 });
    }

    const netlifyClient = createNetlifyClient(await getNetlifyAccessToken());
    await netlifyClient.deleteDomain(siteId, domainId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete domain";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
