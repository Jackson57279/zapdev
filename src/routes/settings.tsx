import { Outlet, createFileRoute } from "@tanstack/react-router";
import SettingsLayout from "@/app/settings/layout";

export const Route = createFileRoute("/settings")({
  component: () => (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  ),
});
