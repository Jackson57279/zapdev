import { StartClient } from "@tanstack/start";
import * as SentryReact from "@sentry/react";
import { createRouter } from "./router";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
let clientSentryInitialized = false;

if (clientDsn && !clientSentryInitialized) {
  SentryReact.init({
    dsn: clientDsn,
    tracesSampleRate: 0.1,
    debug: process.env.NODE_ENV !== "production",
  });
  clientSentryInitialized = true;
}

const router = createRouter();

StartClient({
  router,
});
