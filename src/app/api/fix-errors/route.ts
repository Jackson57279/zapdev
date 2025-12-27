import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { getUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * Error fix endpoint - temporarily unavailable during Inngest migration.
 * This feature will be re-implemented with the new AI SDK agent.
 */
export async function POST(_request: Request) {
  try {
    // Verify request is from a legitimate user, not a bot
    const botVerification = await checkBotId();
    if (botVerification.isBot) {
      console.warn("⚠️ BotID blocked an error fix attempt");
      return NextResponse.json(
        { error: "Access denied - suspicious activity detected" },
        { status: 403 }
      );
    }

    const stackUser = await getUser();
    if (!stackUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Re-implement error fix with new AI SDK agent
    // The error-fix Inngest function has been removed during migration
    console.warn("[fix-errors] Feature temporarily unavailable during migration");
    
    return NextResponse.json(
      { 
        error: "Error fix feature is temporarily unavailable. Please try again later.",
        code: "FEATURE_UNAVAILABLE"
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("[ERROR] Failed in fix-errors route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
