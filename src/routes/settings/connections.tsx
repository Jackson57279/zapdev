import { createFileRoute } from "@tanstack/react-router";
import SettingsConnectionsPage from "@/app/settings/connections/page";

export const Route = createFileRoute("/settings/connections")({
  component: SettingsConnectionsPage,
});
