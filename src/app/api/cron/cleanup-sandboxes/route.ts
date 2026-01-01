import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DEBUG] Sandbox cleanup job - no-op (using WebContainers now)");

  return NextResponse.json({
    success: true,
    message: "No E2B sandboxes to clean up - now using WebContainers",
    killedSandboxIds: [],
    killedCount: 0,
  });
}
