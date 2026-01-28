import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";

const ANTHROPIC_CLIENT_ID = process.env.ANTHROPIC_CLIENT_ID;
const ANTHROPIC_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/anthropic/callback`;

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  if (!ANTHROPIC_CLIENT_ID) {
    return NextResponse.json(
      { error: "Anthropic OAuth not configured" },
      { status: 500 }
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: ANTHROPIC_CLIENT_ID,
    redirect_uri: ANTHROPIC_REDIRECT_URI,
    response_type: "code",
    scope: "user:inference",
    state,
  });

  const anthropicAuthUrl = `https://console.anthropic.com/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(anthropicAuthUrl);
}
