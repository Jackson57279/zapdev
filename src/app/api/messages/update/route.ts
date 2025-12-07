import { checkBotId } from "botid/server";
import { getUser, getConvexClientWithAuth } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { sanitizeTextForDatabase } from "@/lib/utils";

export const dynamic = "force-dynamic";

type UpdateMessageRequestBody = {
  messageId: string;
  content: string;
  status?: "PENDING" | "STREAMING" | "COMPLETE";
};

function isUpdateMessageRequestBody(value: unknown): value is UpdateMessageRequestBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.messageId === "string" &&
    obj.messageId.length > 0 &&
    typeof obj.content === "string"
  );
}

export async function PATCH(request: Request) {
  try {
    // Verify request is from a legitimate user, not a bot
    const botVerification = await checkBotId();
    if (botVerification.isBot) {
      console.warn("⚠️ BotID blocked a message update attempt");
      return Response.json(
        { error: "Access denied - suspicious activity detected" },
        { status: 403 }
      );
    }

    const stackUser = await getUser();
    if (!stackUser) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const convexClient = await getConvexClientWithAuth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!isUpdateMessageRequestBody(body)) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { messageId, content, status } = body;

    const sanitizedContent = sanitizeTextForDatabase(content);

    if (sanitizedContent.length === 0) {
      return Response.json(
        { error: "Message cannot be empty." },
        { status: 400 },
      );
    }

    try {
      const updatedMessage = await convexClient.mutation(api.messages.updateMessage, {
        messageId: messageId as Id<"messages">,
        content: sanitizedContent,
        status: status || "STREAMING",
      });

      return Response.json({
        success: true,
        message: updatedMessage,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return Response.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[ERROR] Failed to update message:", error);
    return Response.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}
