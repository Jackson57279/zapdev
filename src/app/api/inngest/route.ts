import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";

// Force Node.js runtime for AsyncLocalStorage support required by @inngest/agent-kit
export const runtime = "nodejs";
// Increase max duration for long-running agent tasks
export const maxDuration = 300;
import { 
  codeAgentFunction, 
  sandboxTransferFunction, 
  errorFixFunction, 
  sandboxCleanupFunction 
} from "@/inngest/functions";
import { autoPauseSandboxes } from "@/inngest/functions/auto-pause";
import { e2bHealthCheck, cleanupRateLimits } from "@/inngest/functions/health-check";
import { processQueuedJobs, cleanupCompletedJobs } from "@/inngest/functions/job-processor";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction,
    sandboxTransferFunction,
    errorFixFunction,
    sandboxCleanupFunction,
    autoPauseSandboxes,
    e2bHealthCheck,
    cleanupRateLimits,
    processQueuedJobs,
    cleanupCompletedJobs,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
