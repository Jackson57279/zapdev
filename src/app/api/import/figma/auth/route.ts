import { checkBotId } from "botid/server";
import { getUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://zapdev.link/api/import/figma/callback"
  : "http://localhost:3000/api/import/figma/callback";

export async function GET() {
  // Verify request is from a legitimate user, not a bot
  const botVerification = await checkBotId();
  if (botVerification.isBot) {
    console.warn("⚠️ BotID blocked a Figma import auth attempt");
    return Response.json(
      { error: "Access denied - suspicious activity detected" },
      { status: 403 }
    );
  }

  const stackUser = await getUser();

  if (!stackUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = stackUser.id;

  if (!FIGMA_CLIENT_ID) {
    return Response.json(
      { error: "Figma OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate state token for CSRF protection
  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: FIGMA_CLIENT_ID,
    redirect_uri: FIGMA_REDIRECT_URI,
    scope: "file_read",
    state,
    response_type: "code",
  });

  const figmaAuthUrl = `https://www.figma.com/oauth?${params.toString()}`;

  return Response.redirect(figmaAuthUrl);
}
