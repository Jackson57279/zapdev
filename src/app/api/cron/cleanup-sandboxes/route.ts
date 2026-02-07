import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sandbox cleanup is no longer needed — WebContainers run client-side
  // and are torn down when the browser tab closes.
  return NextResponse.json({
    success: true,
    killedSandboxIds: [],
    killedCount: 0,
    message: "No-op: WebContainer sandboxes are managed client-side",
  });
}
