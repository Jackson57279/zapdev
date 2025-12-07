import { checkBotId } from "botid/server";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Verify request is from a legitimate user, not a bot
    const botVerification = await checkBotId();
    if (botVerification.isBot) {
      console.warn("⚠️ BotID blocked a sandbox transfer attempt");
      return Response.json(
        { error: "Access denied - suspicious activity detected" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fragmentId } = body;

    if (!fragmentId) {
      return Response.json(
        { error: "Fragment ID is required" },
        { status: 400 }
      );
    }

    await inngest.send({
      name: "sandbox-transfer/run",
      data: {
        fragmentId,
      },
    });

    return Response.json({
      success: true,
      message: "Sandbox resume initiated",
    });
  } catch (error) {
    console.error("[ERROR] Failed to resume sandbox:", error);
    return Response.json(
      { error: "Failed to resume sandbox" },
      { status: 500 }
    );
  }
}
