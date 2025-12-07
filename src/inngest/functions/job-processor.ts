import { inngest } from "../client";
import { e2bCircuitBreaker } from "../circuit-breaker";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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
  },
});

/**
 * Process queued jobs when E2B service recovers
 * Runs every 2 minutes to check for pending jobs
 */
export const processQueuedJobs = inngest.createFunction(
  { id: "process-queued-jobs", name: "Process Queued E2B Jobs" },
  { cron: "*/2 * * * *" }, // Every 2 minutes
  async ({ step }) => {
    if (!step || typeof step.run !== "function") {
      throw new Error(
        "Inngest step tools are unavailable. Ensure async context is enabled and this route uses the nodejs runtime."
      );
    }
    console.log("[DEBUG] Checking for queued jobs");

    // Check if circuit breaker is closed (service available)
    const circuitBreakerState = e2bCircuitBreaker.getState();
    if (circuitBreakerState !== "CLOSED") {
      console.log(
        `[DEBUG] Circuit breaker is ${circuitBreakerState}, skipping queue processing`
      );
      return {
        processed: 0,
        skipped: true,
        reason: `Circuit breaker ${circuitBreakerState}`,
      };
    }

    // Get next pending job
    const job = await step.run("get-next-job", async () => {
      try {
        return await convex.query(api.jobQueue.getNextJob, {});
      } catch (error) {
        console.error("[ERROR] Failed to fetch next job:", error);
        return null;
      }
    });

    if (!job) {
      console.log("[DEBUG] No pending jobs in queue");
      return { processed: 0, skipped: false };
    }

    console.log(`[DEBUG] Processing queued job: ${job._id} (type: ${job.type})`);

    // Mark job as processing
    await step.run("mark-processing", async () => {
      try {
        await convex.mutation(api.jobQueue.markProcessing, {
          jobId: job._id,
        });
      } catch (error) {
        console.error("[ERROR] Failed to mark job as processing:", error);
      }
    });

    // Process the job based on type
    const result = await step.run("process-job", async () => {
      try {
        if (job.type === "code_generation") {
          // Trigger code agent with original payload
          await inngest.send({
            name: "code-agent/run",
            data: job.payload,
          });

          return { success: true };
        } else {
          return {
            success: false,
            error: `Unknown job type: ${job.type}`,
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Job processing failed: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    });

    // Update job status
    if (result.success) {
      await step.run("mark-completed", async () => {
        try {
          await convex.mutation(api.jobQueue.markCompleted, {
            jobId: job._id,
          });

          // Notify user
          await convex.mutation(api.messages.createForUser, {
            userId: job.userId,
            projectId: job.projectId,
            content:
              "Your queued request is now being processed! You'll see the results shortly.",
            role: "ASSISTANT",
            type: "RESULT",
            status: "COMPLETE",
          });

          console.log(`[DEBUG] Job ${job._id} completed successfully`);
        } catch (error) {
          console.error("[ERROR] Failed to mark job as completed:", error);
        }
      });
    } else {
      await step.run("mark-failed", async () => {
        try {
          await convex.mutation(api.jobQueue.markFailed, {
            jobId: job._id,
            error: (result as { error?: string }).error || "Unknown error",
          });

          // If max attempts reached, notify user
          const maxAttempts = job.maxAttempts || 3;
          if (job.attempts >= maxAttempts - 1) {
            await convex.mutation(api.messages.createForUser, {
              userId: job.userId,
              projectId: job.projectId,
              content:
                "We encountered an error processing your queued request after multiple attempts. Please try your request again.",
              role: "ASSISTANT",
              type: "ERROR",
              status: "COMPLETE",
            });
          }

          console.error(`[ERROR] Job ${job._id} failed: ${(result as { error?: string }).error}`);
        } catch (error) {
          console.error("[ERROR] Failed to mark job as failed:", error);
        }
      });
    }

    console.log("[E2B_METRICS]", {
      event: "queued_job_processed",
      jobId: job._id,
      type: job.type,
      success: result.success,
      attempts: job.attempts + 1,
      timestamp: Date.now(),
    });

    return {
      processed: 1,
      jobId: job._id,
      success: result.success,
    };
  }
);

/**
 * Clean up old completed jobs
 * Runs daily to prevent table bloat
 */
export const cleanupCompletedJobs = inngest.createFunction(
  { id: "cleanup-completed-jobs", name: "Cleanup Completed Jobs" },
  { cron: "0 2 * * *" }, // Daily at 2 AM
  async ({ step }) => {
    if (!step || typeof step.run !== "function") {
      throw new Error(
        "Inngest step tools are unavailable. Ensure async context is enabled and this route uses the nodejs runtime."
      );
    }
    console.log("[DEBUG] Starting completed jobs cleanup");

    const result = await step.run("cleanup", async () => {
      try {
        return await convex.mutation(api.jobQueue.cleanup, {});
      } catch (error) {
        console.error("[ERROR] Failed to cleanup jobs:", error);
        return { deletedCount: 0, error: true };
      }
    });

    console.log("[E2B_METRICS]", {
      event: "job_queue_cleanup",
      deletedCount: result.deletedCount,
      timestamp: Date.now(),
    });

    return result;
  }
);
