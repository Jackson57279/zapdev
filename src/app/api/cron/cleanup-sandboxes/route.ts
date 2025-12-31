import { NextResponse } from "next/server";
import { Sandbox } from "@e2b/code-interpreter";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DEBUG] Running sandbox cleanup job");

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - thirtyDays;
  const killedSandboxIds: string[] = [];

  try {
    const sandboxes = await Sandbox.list();

    for (const sandbox of sandboxes) {
      const startedAt =
        sandbox.startedAt instanceof Date
          ? sandbox.startedAt.getTime()
          : new Date(sandbox.startedAt).getTime();

      if (
        sandbox.state === "paused" &&
        Number.isFinite(startedAt) &&
        startedAt <= cutoff
      ) {
        try {
          await Sandbox.kill(sandbox.sandboxId);
          killedSandboxIds.push(sandbox.sandboxId);
          console.log("[DEBUG] Killed sandbox due to age:", sandbox.sandboxId);
        } catch (error) {
          console.error(
            "[ERROR] Failed to kill sandbox",
            sandbox.sandboxId,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("[ERROR] Failed to list sandboxes:", error);
    return NextResponse.json(
      { error: "Failed to run cleanup" },
      { status: 500 }
    );
  }

  console.log("[DEBUG] Sandbox cleanup complete. Killed:", killedSandboxIds);

  return NextResponse.json({
    success: true,
    killedSandboxIds,
    killedCount: killedSandboxIds.length,
  });
}
