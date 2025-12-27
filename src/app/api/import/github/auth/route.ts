import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { getUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://zapdev.link/api/import/github/callback"
  : "http://localhost:3000/api/import/github/callback";

export async function GET() {
  // Verify request is from a legitimate user, not a bot
  const botVerification = await checkBotId();
  if (botVerification.isBot) {
    console.warn("⚠️ BotID blocked a GitHub import auth attempt");
    return NextResponse.json(
      { error: "Access denied - suspicious activity detected" },
      { status: 403 }
    );
  }

  const stackUser = await getUser();
  if (!stackUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = stackUser.id;

  if (false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate state token for CSRF protection
  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "repo,read:user,user:email",
    state,
    allow_signup: "true",
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(githubAuthUrl);
}
