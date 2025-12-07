import { inngest } from "../client";
import { Sandbox } from "@e2b/code-interpreter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Get Convex client lazily
let convexClient: ConvexHttpClient | null = null;
function getConvexClient() {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

const convex = new Proxy({} as ConvexHttpClient, {
  get(_target, prop) {
    return getConvexClient()[prop as keyof ConvexHttpClient];
  }
});

/**
 * Auto-pause inactive sandboxes
 * Runs every 5 minutes to check for sandboxes that have been idle
 * and pause them to reduce compute costs
 */
export const autoPauseSandboxes = inngest.createFunction(
  { id: "auto-pause-sandboxes" },
  { cron: "0 */5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    console.log("[DEBUG] Starting auto-pause job");

    // Get all running sandbox sessions
    const sessions = await step.run("get-running-sessions", async () => {
      try {
        return await convex.query(api.sandboxSessions.getRunning);
      } catch (error) {
        console.error("[ERROR] Failed to fetch running sessions:", error);
        return [];
      }
    });

    console.log(
      `[DEBUG] Found ${sessions.length} running sandbox sessions`
    );

    let pausedCount = 0;
    let errorCount = 0;

    for (const session of sessions) {
      const elapsed = Date.now() - session.lastActivity;
      const shouldPause = elapsed > session.autoPauseTimeout;

      if (shouldPause) {
        await step.run(`pause-sandbox-${session.sandboxId}`, async () => {
          try {
            console.log(
              `[DEBUG] Pausing inactive sandbox ${session.sandboxId} (idle for ${Math.round(elapsed / 1000 / 60)} minutes)`
            );

            // Connect and pause the sandbox
            const sandbox = await Sandbox.connect(session.sandboxId, {
              apiKey: process.env.E2B_API_KEY,
            });

            // Use betaPause if available, otherwise just log
            const sandboxWithPause = sandbox as { betaPause?: () => Promise<void> };
            if (typeof sandboxWithPause.betaPause === "function") {
              await sandboxWithPause.betaPause();
              console.log(`[DEBUG] Successfully paused sandbox ${session.sandboxId}`);
            } else {
              console.warn(
                `[WARN] betaPause not available for sandbox ${session.sandboxId}`
              );
            }

            // Update session state in Convex
            await convex.mutation(api.sandboxSessions.updateState, {
              sessionId: session._id,
              state: "PAUSED",
            });

            pausedCount++;
          } catch (error) {
            errorCount++;
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[ERROR] Failed to pause sandbox ${session.sandboxId}: ${errorMessage}`
            );

            // If sandbox not found, mark as killed
            if (errorMessage.includes("not found")) {
              try {
                await convex.mutation(api.sandboxSessions.updateState, {
                  sessionId: session._id,
                  state: "KILLED",
                });
              } catch (updateError) {
                console.error(
                  `[ERROR] Failed to update session state to KILLED: ${updateError}`
                );
              }
            }
          }
        });
      }
    }

    console.log(
      `[DEBUG] Auto-pause job complete: ${pausedCount} paused, ${errorCount} errors`
    );

    return {
      totalSessions: sessions.length,
      pausedCount,
      errorCount,
      timestamp: new Date().toISOString(),
    };
  }
);
