import { createFileRoute } from "@tanstack/react-router";
import SettingsOverviewPage from "@/app/settings/page";

export const Route = createFileRoute("/settings/_index")({
  component: SettingsOverviewPage,
});
