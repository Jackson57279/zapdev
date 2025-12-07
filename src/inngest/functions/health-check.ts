import { inngest } from "../client";
import { e2bCircuitBreaker } from "../circuit-breaker";
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
  },
});

/**
 * Automated E2B health check
 * Runs every 5 minutes to monitor service health and circuit breaker state
 */
export const e2bHealthCheck = inngest.createFunction(
  { id: "e2b-health-check", name: "E2B Health Check" },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    if (!step || typeof step.run !== "function") {
      throw new Error(
        "Inngest step tools are unavailable. Ensure async context is enabled and this route uses the nodejs runtime."
      );
    }
    console.log("[DEBUG] Starting E2B health check");

    const healthStatus = await step.run("check-health", async () => {
      const circuitBreakerState = e2bCircuitBreaker.getState();
      const circuitBreakerFailures = e2bCircuitBreaker.getFailureCount();

      // Get rate limit stats
      let rateLimitStats;
      try {
        rateLimitStats = await convex.query(api.e2bRateLimits.getStats, {});
      } catch (error) {
        console.error("[ERROR] Failed to fetch rate limit stats:", error);
        rateLimitStats = { totalRequests: 0, byOperation: {}, error: true };
      }

      return {
        timestamp: Date.now(),
        circuitBreaker: {
          state: circuitBreakerState,
          failures: circuitBreakerFailures,
          isHealthy: circuitBreakerState === "CLOSED",
        },
        rateLimits: rateLimitStats,
        overallHealthy: circuitBreakerState === "CLOSED",
      };
    });

    // Log health status
    console.log("[E2B_METRICS]", {
      event: "health_check",
      ...healthStatus,
    });

    // Alert if circuit breaker is open
    if (healthStatus.circuitBreaker.state === "OPEN") {
      await step.run("alert-circuit-open", async () => {
        console.error("[E2B_METRICS]", {
          event: "health_check_alert",
          severity: "critical",
          message: "E2B Circuit Breaker is OPEN - service unavailable",
          circuitBreakerState: healthStatus.circuitBreaker.state,
          failures: healthStatus.circuitBreaker.failures,
          timestamp: Date.now(),
        });

        // Send to Sentry if available
        try {
        if (process.env.NODE_ENV === "production") {
            const Sentry = await import("@sentry/node");
            Sentry.captureMessage(
              "E2B Circuit Breaker has been OPEN for extended period",
              {
                level: "error",
                tags: {
                  health_check: "automated",
                  circuit_breaker_state: healthStatus.circuitBreaker.state,
                },
                contexts: {
                  health_check: healthStatus,
                },
              }
            );
          }
        } catch (error) {
          console.warn("[WARN] Failed to send Sentry alert:", error);
        }
      });
    }

    // Alert if rate limits approaching (>90%)
    const stats = healthStatus.rateLimits;
    const statsTyped = stats as { error?: unknown; byOperation?: { sandbox_create?: number } };
    if (stats && !statsTyped.error) {
      const sandboxCreateCount = statsTyped.byOperation?.sandbox_create || 0;
      const rateLimitThreshold = 100; // Adjust based on your plan

      if (sandboxCreateCount > rateLimitThreshold * 0.9) {
        await step.run("alert-rate-limit-high", async () => {
          console.warn("[E2B_METRICS]", {
            event: "health_check_alert",
            severity: "warning",
            message: "E2B rate limit usage very high (>90%)",
            count: sandboxCreateCount,
            threshold: rateLimitThreshold,
            percentUsed: Math.round(
              (sandboxCreateCount / rateLimitThreshold) * 100
            ),
            timestamp: Date.now(),
          });
        });
      }
    }

    return healthStatus;
  }
);

/**
 * Cleanup old rate limit records
 * Runs every hour to prevent table bloat
 */
export const cleanupRateLimits = inngest.createFunction(
  { id: "cleanup-rate-limits", name: "Cleanup E2B Rate Limits" },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    if (!step || typeof step.run !== "function") {
      throw new Error(
        "Inngest step tools are unavailable. Ensure async context is enabled and this route uses the nodejs runtime."
      );
    }
    console.log("[DEBUG] Starting rate limit cleanup");

    const result = await step.run("cleanup", async () => {
      try {
        return await convex.mutation(api.e2bRateLimits.cleanup, {});
      } catch (error) {
        console.error("[ERROR] Failed to cleanup rate limits:", error);
        return { deletedCount: 0, error: true };
      }
    });

    console.log("[E2B_METRICS]", {
      event: "rate_limit_cleanup",
      deletedCount: result.deletedCount,
      timestamp: Date.now(),
    });

    return result;
  }
);
