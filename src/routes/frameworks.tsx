import { createFileRoute } from "@tanstack/react-router";
import FrameworksPage from "@/app/frameworks/page";

export const Route = createFileRoute("/frameworks")({
  component: FrameworksPage,
});
