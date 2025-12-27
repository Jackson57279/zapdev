import { getUser } from "@/lib/auth-server";
import { checkBotId } from "botid/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Verify request is from a legitimate user, not a bot
    const botVerification = await checkBotId();
    if (botVerification.isBot) {
      console.warn("⚠️ BotID blocked a token generation attempt");
      return Response.json(
        { error: "Access denied - suspicious activity detected" },
        { status: 403 }
      );
    }

    const user = await getUser();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Realtime token generation is not available without @inngest/realtime middleware
    // TODO: Install @inngest/realtime if needed
    return Response.json(
      { error: "Realtime feature not configured" },
      { status: 503 }
    );
  } catch (error) {
    console.error("[ERROR] Failed to generate realtime token:", error);
    return Response.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
