import { createFileRoute } from "@tanstack/react-router";
import SettingsSubscriptionPage from "@/app/settings/subscription/page";

export const Route = createFileRoute("/settings/subscription")({
  component: SettingsSubscriptionPage,
});
