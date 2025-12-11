import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/import/github/callback`;

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
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          redirect_uri: GITHUB_REDIRECT_URI,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("GitHub token exchange error:", error);
      throw new Error("Failed to exchange authorization code");
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    // Get user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "ZapDev",
      },
    });

    const userData = userResponse.ok ? await userResponse.json() : {};

    // Store OAuth connection in Convex
    await fetchMutation((api as any).oauth.storeConnection, {
      provider: "github",
      accessToken: tokenData.access_token,
      scope: tokenData.scope || "repo,read:user,user:email",
      metadata: {
        githubId: userData.id,
        githubLogin: userData.login,
        githubName: userData.name,
        githubEmail: userData.email,
        githubAvatarUrl: userData.avatar_url,
      },
    });

    // Redirect to import page
    return NextResponse.redirect(
      new URL(
        "/import?source=github&status=connected",
        request.url
      )
    );
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/import?error=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`,
        request.url
      )
    );
  }
}
