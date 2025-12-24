import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { processFigmaImport } from "@/inngest/functions/process-figma-import";
import { processFigmaDirect } from "@/inngest/functions/process-figma-direct";
import { processGitHubImport } from "@/inngest/functions/process-github-import";
import { autoPauseSandboxes } from "@/inngest/functions/auto-pause";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processFigmaImport,
    processFigmaDirect,
    processGitHubImport,
    autoPauseSandboxes,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
