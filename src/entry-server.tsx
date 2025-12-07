import { StartServer } from "@tanstack/start/server";
import * as SentryNode from "@sentry/node";
import { createRouter } from "./router";
import { handleApiRequest } from "./server/api-handler";

const router = createRouter();
const serverDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
let serverSentryInitialized = false;

if (serverDsn && !serverSentryInitialized) {
  SentryNode.init({
    dsn: serverDsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: false,
    debug: process.env.NODE_ENV !== "production",
  });
  serverSentryInitialized = true;
}

export default StartServer({
  router,
  createFetchHandler:
    (startHandler) =>
    async (request, env, ctx) => {
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) {
        return apiResponse;
      }
      return startHandler(request, env, ctx);
    },
});
