/**
 * Circuit Breaker Pattern for E2B Service
 * 
 * Prevents cascading failures when E2B service is experiencing issues.
 * 
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service is failing, reject requests immediately
 * - HALF_OPEN: Testing if service recovered, allow limited requests
 */

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  threshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000 = 1 minute) */
  timeout?: number;
  /** Name for logging purposes */
  name?: string;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = "CLOSED";
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.timeout = options.timeout ?? 60000; // 1 minute
    this.name = options.name ?? "CircuitBreaker";
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        console.log(`[${this.name}] Transitioning to HALF_OPEN state - testing service recovery`);
        this.state = "HALF_OPEN";
      } else {
        const remainingMs = this.timeout - (Date.now() - this.lastFailureTime);
        const remainingSec = Math.ceil(remainingMs / 1000);
        throw new Error(
          `Circuit breaker is OPEN - E2B service unavailable. Retry in ${remainingSec}s.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess() {
    if (this.state === "HALF_OPEN") {
      console.log(`[${this.name}] Service recovered - transitioning to CLOSED state`);
      this.reset();
    } else if (this.failures > 0) {
      // Gradually reduce failure count on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  /**
   * Record failed execution
   */
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Failed during recovery test - back to OPEN
      console.error(`[${this.name}] Recovery test failed - returning to OPEN state`);
      this.state = "OPEN";
      this.sendAlert("recovery_test_failed");
    } else if (this.failures >= this.threshold) {
      // Threshold exceeded - open circuit
      console.error(
        `[${this.name}] Circuit breaker OPENED after ${this.failures} failures`
      );
      this.state = "OPEN";
      this.sendAlert("circuit_opened");
    } else {
      console.warn(
        `[${this.name}] Failure ${this.failures}/${this.threshold} - state: ${this.state}`
      );
    }
  }

  /**
   * Send alert to monitoring system (Sentry)
   */
  private sendAlert(event: "circuit_opened" | "recovery_test_failed") {
    try {
      // Only send alerts in production or if explicitly enabled
      if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
        // Check if Sentry is available (dynamically imported)
        import("@sentry/node")
          .then((Sentry) => {
            const message =
              event === "circuit_opened"
                ? `E2B Circuit Breaker OPENED - ${this.failures} consecutive failures`
                : `E2B Circuit Breaker recovery test failed`;

            Sentry.captureMessage(message, {
              level: "error",
              tags: {
                circuit_breaker: this.name,
                event,
                state: this.state,
              },
              contexts: {
                circuit_breaker: {
                  failures: this.failures,
                  threshold: this.threshold,
                  lastFailureTime: this.lastFailureTime,
                  state: this.state,
                },
              },
            });
          })
          .catch((err) => {
            console.warn("Sentry not available for circuit breaker alert:", err);
          });
      }
    } catch (error) {
      // Don't let alerting failures break the circuit breaker
      console.warn("Failed to send circuit breaker alert:", error);
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  private reset() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Manually reset (for testing or admin operations)
   */
  manualReset() {
    console.log(`[${this.name}] Manual reset triggered`);
    this.reset();
  }
}

/**
 * Global E2B circuit breaker instance
 * Threshold: 5 failures within timeout period
 * Timeout: 60 seconds (1 minute)
 */
export const e2bCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 60000,
  name: "E2B",
});
