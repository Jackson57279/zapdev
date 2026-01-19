import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

const NETLIFY_CLIENT_ID = process.env.NETLIFY_CLIENT_ID;
const NETLIFY_CLIENT_SECRET = process.env.NETLIFY_CLIENT_SECRET;
const NETLIFY_OAUTH_STATE_SECRET = process.env.NETLIFY_OAUTH_STATE_SECRET || "fallback-secret-change-me";
const NETLIFY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/deploy/netlify/callback`;
const STATE_TTL_MS = 10 * 60 * 1000;

type NetlifyTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
};

type NetlifyUserResponse = {
  id?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
};

const parseTokenResponse = (value: unknown): NetlifyTokenResponse => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    access_token: typeof record.access_token === "string" ? record.access_token : undefined,
    token_type: typeof record.token_type === "string" ? record.token_type : undefined,
    scope: typeof record.scope === "string" ? record.scope : undefined,
  };
};

const parseUserResponse = (value: unknown): NetlifyUserResponse => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : undefined,
    email: typeof record.email === "string" ? record.email : undefined,
    full_name: typeof record.full_name === "string" ? record.full_name : undefined,
    avatar_url: typeof record.avatar_url === "string" ? record.avatar_url : undefined,
  };
};

export async function GET(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/projects?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/projects?error=Missing+authorization+code", request.url)
    );
  }

  if (!NETLIFY_CLIENT_ID || !NETLIFY_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Netlify OAuth not configured" },
      { status: 500 }
    );
  }

  try {
    const decodedStateStr = Buffer.from(state, "base64").toString();
    let decodedState: { payload?: string; signature?: string };
    try {
      decodedState = JSON.parse(decodedStateStr);
    } catch {
      throw new Error("Invalid state token format");
    }

    if (!decodedState.payload || !decodedState.signature) {
      throw new Error("Invalid state token structure");
    }

    const expectedSignature = crypto
      .createHmac("sha256", NETLIFY_OAUTH_STATE_SECRET)
      .update(decodedState.payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(decodedState.signature),
      Buffer.from(expectedSignature)
    )) {
      throw new Error("State token signature mismatch");
    }

    const payload = JSON.parse(decodedState.payload) as { userId?: string; timestamp?: number };
    if (!payload.userId || !payload.timestamp) {
      throw new Error("Invalid state token payload");
    }

    if (payload.userId !== user.id) {
      throw new Error("State token user mismatch");
    }

    const age = Date.now() - payload.timestamp;
    if (age > STATE_TTL_MS || age < 0) {
      throw new Error("State token expired");
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: NETLIFY_CLIENT_ID,
      client_secret: NETLIFY_CLIENT_SECRET,
      redirect_uri: NETLIFY_REDIRECT_URI,
      code,
    });

    const tokenResponse = await fetch("https://api.netlify.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(errorText || "Failed to exchange authorization code");
    }

    const tokenData = parseTokenResponse(await tokenResponse.json());
    if (!tokenData.access_token) {
      throw new Error("Missing Netlify access token");
    }

    const userResponse = await fetch("https://api.netlify.com/api/v1/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = userResponse.ok
      ? parseUserResponse(await userResponse.json())
      : {};

    await fetchMutation(api.oauth.storeConnection, {
      provider: "netlify",
      accessToken: tokenData.access_token,
      scope: tokenData.scope || tokenData.token_type || "netlify",
      metadata: {
        netlifyId: userData.id,
        netlifyEmail: userData.email,
        netlifyName: userData.full_name,
        netlifyAvatarUrl: userData.avatar_url,
      },
    });

    return NextResponse.redirect(
      new URL("/projects?netlify=connected", request.url)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    return NextResponse.redirect(
      new URL(`/projects?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
