import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const ANTHROPIC_CLIENT_ID = process.env.ANTHROPIC_CLIENT_ID;
const ANTHROPIC_CLIENT_SECRET = process.env.ANTHROPIC_CLIENT_SECRET;
const ANTHROPIC_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/anthropic/callback`;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const errorDescription = searchParams.get("error_description") || error;
    return NextResponse.redirect(
      new URL(`/settings?tab=connections&error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=connections&error=Missing+authorization+code", request.url)
    );
  }

  try {
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
    if (decodedState.userId !== userId) {
      throw new Error("State token mismatch");
    }

    const tokenResponse = await fetch(
      "https://console.anthropic.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: ANTHROPIC_CLIENT_ID || "",
          client_secret: ANTHROPIC_CLIENT_SECRET || "",
          redirect_uri: ANTHROPIC_REDIRECT_URI,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Anthropic token exchange error:", errorText);
      throw new Error("Failed to exchange authorization code");
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    await fetchMutation(api.oauth.storeConnection, {
      provider: "anthropic",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined,
      scope: tokenData.scope || "user:inference",
      metadata: {
        tokenType: tokenData.token_type,
        connectedAt: new Date().toISOString(),
      },
    });

    return NextResponse.redirect(
      new URL("/settings?tab=connections&status=anthropic_connected", request.url)
    );
  } catch (error) {
    console.error("Anthropic OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/settings?tab=connections&error=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`,
        request.url
      )
    );
  }
}
