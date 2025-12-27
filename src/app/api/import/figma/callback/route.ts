import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const FIGMA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/import/figma/callback`;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (false) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/import?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/import?error=Missing+authorization+code", request.url)
    );
  }

  try {
    // Verify state token
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
    if (decodedState.userId !== userId) {
      throw new Error("State token mismatch");
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://api.figma.com/v1/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: FIGMA_CLIENT_ID,
          client_secret: FIGMA_CLIENT_SECRET,
          redirect_uri: FIGMA_REDIRECT_URI,
          code,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Figma token exchange error:", error);
      throw new Error("Failed to exchange authorization code");
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Figma
    const meResponse = await fetch("https://api.figma.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const meData = meResponse.ok ? await meResponse.json() : {};

    // Store OAuth connection in Convex
    await fetchMutation((api as any).oauth.storeConnection, {
      provider: "figma",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      scope: tokenData.scope || "file_read",
      metadata: {
        figmaId: meData.id,
        figmaEmail: meData.email,
        figmaName: meData.handle,
      },
    });

    // Redirect to import page
    return NextResponse.redirect(
      new URL(
        "/import?source=figma&status=connected",
        request.url
      )
    );
  } catch (error) {
    console.error("Figma OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/import?error=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`,
        request.url
      )
    );
  }
}
