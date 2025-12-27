import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  try {
    const botVerification = await checkBotId();
    if (botVerification.isBot) {
      console.warn("⚠️ BotID blocked a sandbox transfer attempt");
      return NextResponse.json(
        { error: "Access denied - suspicious activity detected" },
        { status: 403 }
      );
    }

    // TODO: Re-implement sandbox transfer with new AI SDK agent
    console.warn("[transfer-sandbox] Feature temporarily unavailable during migration");
    
    return NextResponse.json(
      { 
        error: "Sandbox transfer feature is temporarily unavailable. Please try again later.",
        code: "FEATURE_UNAVAILABLE"
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("[ERROR] Failed in transfer-sandbox route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
