import { createFileRoute } from "@tanstack/react-router";
import SettingsProfilePage from "@/app/settings/profile/page";

export const Route = createFileRoute("/settings/profile")({
  component: SettingsProfilePage,
});
