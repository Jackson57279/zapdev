export const VERCEL_TIMEOUT_LIMIT = 300_000;

export interface TimeBudget {
  initialization: number;
  research: number;
  codeGeneration: number;
  validation: number;
  finalization: number;
}

export const DEFAULT_TIME_BUDGET: TimeBudget = {
  initialization: 5_000,
  research: 60_000,
  codeGeneration: 150_000,
  validation: 30_000,
  finalization: 55_000,
};

export interface TimeTracker {
  startTime: number;
  stages: Record<string, { start: number; end?: number; duration?: number }>;
  warnings: string[];
}

export class TimeoutManager {
  private startTime: number;
  private stages: Map<string, { start: number; end?: number }>;
  private warnings: string[];
  private budget: TimeBudget;

  constructor(budget: TimeBudget = DEFAULT_TIME_BUDGET) {
    this.startTime = Date.now();
    this.stages = new Map();
    this.warnings = [];
    this.budget = budget;
    
    console.log("[TIMEOUT] Initialized with budget:", budget);
  }

  startStage(stageName: string): void {
    const now = Date.now();
    this.stages.set(stageName, { start: now });
    console.log(`[TIMEOUT] Stage "${stageName}" started at ${now - this.startTime}ms`);
  }

  endStage(stageName: string): number {
    const now = Date.now();
    const stage = this.stages.get(stageName);
    
    if (!stage) {
      console.warn(`[TIMEOUT] Cannot end stage "${stageName}" - not started`);
      return 0;
    }

    stage.end = now;
    const duration = now - stage.start;
    
    console.log(`[TIMEOUT] Stage "${stageName}" completed in ${duration}ms`);
    
    return duration;
  }

  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  getRemaining(): number {
    return Math.max(0, VERCEL_TIMEOUT_LIMIT - this.getElapsed());
  }

  getPercentageUsed(): number {
    return (this.getElapsed() / VERCEL_TIMEOUT_LIMIT) * 100;
  }

  checkTimeout(): {
    isWarning: boolean;
    isEmergency: boolean;
    isCritical: boolean;
    remaining: number;
    message?: string;
  } {
    const elapsed = this.getElapsed();
    const remaining = this.getRemaining();
    const percentage = this.getPercentageUsed();

    if (elapsed >= 295_000) {
      const message = `CRITICAL: Force shutdown imminent (${elapsed}ms/${VERCEL_TIMEOUT_LIMIT}ms)`;
      this.addWarning(message);
      return {
        isWarning: true,
        isEmergency: true,
        isCritical: true,
        remaining,
        message,
      };
    }

    if (elapsed >= 285_000) {
      const message = `EMERGENCY: Timeout very close (${elapsed}ms/${VERCEL_TIMEOUT_LIMIT}ms)`;
      this.addWarning(message);
      return {
        isWarning: true,
        isEmergency: true,
        isCritical: false,
        remaining,
        message,
      };
    }

    if (elapsed >= 270_000) {
      const message = `WARNING: Approaching timeout (${elapsed}ms/${VERCEL_TIMEOUT_LIMIT}ms)`;
      this.addWarning(message);
      return {
        isWarning: true,
        isEmergency: false,
        isCritical: false,
        remaining,
        message,
      };
    }

    return {
      isWarning: false,
      isEmergency: false,
      isCritical: false,
      remaining,
    };
  }

  shouldSkipStage(stageName: keyof TimeBudget): boolean {
    const elapsed = this.getElapsed();
    const remaining = this.getRemaining();
    const stagebudget = this.budget[stageName];

    if (remaining < stagebudget) {
      console.warn(`[TIMEOUT] Skipping stage "${stageName}" - insufficient time (${remaining}ms < ${stagebudget}ms)`);
      return true;
    }

    return false;
  }

  adaptBudget(complexity: "simple" | "medium" | "complex"): void {
    if (complexity === "simple") {
      this.budget = {
        initialization: 5_000,
        research: 10_000,
        codeGeneration: 60_000,
        validation: 15_000,
        finalization: 30_000,
      };
    } else if (complexity === "medium") {
      this.budget = {
        initialization: 5_000,
        research: 30_000,
        codeGeneration: 120_000,
        validation: 25_000,
        finalization: 40_000,
      };
    } else if (complexity === "complex") {
      this.budget = {
        initialization: 5_000,
        research: 60_000,
        codeGeneration: 180_000,
        validation: 30_000,
        finalization: 25_000,
      };
    }

    console.log(`[TIMEOUT] Budget adapted for ${complexity} task:`, this.budget);
  }

  addWarning(message: string): void {
    if (!this.warnings.includes(message)) {
      this.warnings.push(message);
      console.warn(`[TIMEOUT] ${message}`);
    }
  }

  getSummary(): {
    elapsed: number;
    remaining: number;
    percentageUsed: number;
    stages: Array<{ name: string; duration: number }>;
    warnings: string[];
  } {
    const stages = Array.from(this.stages.entries()).map(([name, data]) => ({
      name,
      duration: data.end ? data.end - data.start : Date.now() - data.start,
    }));

    return {
      elapsed: this.getElapsed(),
      remaining: this.getRemaining(),
      percentageUsed: this.getPercentageUsed(),
      stages,
      warnings: this.warnings,
    };
  }

  logSummary(): void {
    const summary = this.getSummary();
    console.log("[TIMEOUT] Execution Summary:");
    console.log(`  Total Time: ${summary.elapsed}ms (${summary.percentageUsed.toFixed(1)}%)`);
    console.log(`  Remaining: ${summary.remaining}ms`);
    console.log("  Stages:");
    for (const stage of summary.stages) {
      console.log(`    - ${stage.name}: ${stage.duration}ms`);
    }
    if (summary.warnings.length > 0) {
      console.log("  Warnings:");
      for (const warning of summary.warnings) {
        console.log(`    - ${warning}`);
      }
    }
  }
}

export function shouldForceShutdown(elapsed: number): boolean {
  return elapsed >= 295_000;
}

export function shouldSkipNonCritical(elapsed: number): boolean {
  return elapsed >= 285_000;
}

export function shouldWarn(elapsed: number): boolean {
  return elapsed >= 270_000;
}

export function estimateComplexity(prompt: string): "simple" | "medium" | "complex" {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();

  const complexityIndicators = [
    "enterprise",
    "architecture",
    "distributed",
    "microservices",
    "authentication",
    "authorization",
    "database schema",
    "multiple services",
    "full-stack",
    "complete application",
  ];

  const hasComplexityIndicators = complexityIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator)
  );

  if (hasComplexityIndicators || promptLength > 1000) {
    return "complex";
  }

  if (promptLength > 300) {
    return "medium";
  }

  return "simple";
}
