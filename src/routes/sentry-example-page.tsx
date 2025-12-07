import { createFileRoute } from "@tanstack/react-router";
import SentryExamplePage from "@/app/sentry-example-page/page";

export const Route = createFileRoute("/sentry-example-page")({
  component: SentryExamplePage,
});
