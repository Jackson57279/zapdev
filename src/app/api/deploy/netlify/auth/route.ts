import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";

const NETLIFY_CLIENT_ID = process.env.NETLIFY_CLIENT_ID;
const NETLIFY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/deploy/netlify/callback`;

export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!NETLIFY_CLIENT_ID) {
    return NextResponse.json(
      { error: "Netlify OAuth not configured" },
      { status: 500 }
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, timestamp: Date.now() })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: NETLIFY_CLIENT_ID,
    redirect_uri: NETLIFY_REDIRECT_URI,
    response_type: "code",
    state,
  });

  const netlifyAuthUrl = `https://app.netlify.com/authorize?${params.toString()}`;
  return NextResponse.redirect(netlifyAuthUrl);
}
