import { getUser } from "@/lib/auth-server";
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "@/inngest/client";

export async function POST() {
  try {
    const user = await getUser();
    
    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = await getSubscriptionToken(inngest, {
      channel: `user:${user.id}`,
      topics: ["agent_stream"],
    });

    return Response.json({ token });
  } catch (error) {
    console.error("[ERROR] Failed to generate realtime token:", error);
    return Response.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
