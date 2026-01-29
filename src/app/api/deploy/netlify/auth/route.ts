import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";
import crypto from "crypto";

const NETLIFY_CLIENT_ID = process.env.NETLIFY_CLIENT_ID;
const NETLIFY_OAUTH_STATE_SECRET = process.env.NETLIFY_OAUTH_STATE_SECRET;
const NETLIFY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/deploy/netlify/callback`;

function validateNetlifyConfig(): { clientId: string; stateSecret: string } {
  if (!NETLIFY_CLIENT_ID || !NETLIFY_OAUTH_STATE_SECRET) {
    throw new Error("Netlify OAuth configuration is incomplete. NETLIFY_CLIENT_ID and NETLIFY_OAUTH_STATE_SECRET must be set.");
  }
  return {
    clientId: NETLIFY_CLIENT_ID,
    stateSecret: NETLIFY_OAUTH_STATE_SECRET,
  };
}

export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId, stateSecret } = validateNetlifyConfig();

    const payload = JSON.stringify({ userId: user.id, timestamp: Date.now() });
    const signature = crypto
      .createHmac("sha256", stateSecret)
      .update(payload)
      .digest("hex");

    const state = Buffer.from(
      JSON.stringify({ payload, signature })
    ).toString("base64");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: NETLIFY_REDIRECT_URI,
      response_type: "code",
      state,
    });

    const netlifyAuthUrl = `https://app.netlify.com/authorize?${params.toString()}`;
    return NextResponse.redirect(netlifyAuthUrl);
  } catch (error) {
    console.error("[ERROR] Netlify OAuth configuration error:", error);
    return NextResponse.json(
      { error: "Netlify OAuth not configured" },
      { status: 500 }
    );
  }
}
