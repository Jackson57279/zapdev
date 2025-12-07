import * as SentryNode from "@sentry/node";
import * as SentryReact from "@sentry/react";

const captureRequestError = (error: unknown) => {
  return SentryNode.captureException(error);
};

export const {
  init,
  captureException,
  captureMessage,
  withScope,
  startSpan,
  startTransaction,
  getCurrentHub,
  withMonitor,
  flush,
} = SentryNode;

export { SentryReact };
export { captureRequestError };

export default {
  ...SentryNode,
  SentryReact,
  captureRequestError,
};
