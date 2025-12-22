import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { 
  codeAgentFunction, 
  sandboxTransferFunction, 
  errorFixFunction, 
  sandboxCleanupFunction,
  processFigmaImport,
  processFigmaDirect,
} from "@/inngest/functions";
import { shadcnCreateFunction } from "@/inngest/shadcn";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction,
    sandboxTransferFunction,
    errorFixFunction,
    sandboxCleanupFunction,
    processFigmaImport,
    processFigmaDirect,
    shadcnCreateFunction,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
