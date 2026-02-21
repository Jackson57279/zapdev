import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  enqueueWebContainerRunFunction,
  runCodeAgentKitFunction,
  runFigmaImportFunction,
  runFixErrorsFunction,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runCodeAgentKitFunction,
    runFixErrorsFunction,
    runFigmaImportFunction,
    enqueueWebContainerRunFunction,
  ],
});
