import { createFileRoute } from "@tanstack/react-router";
import AiInfoPage from "@/app/ai-info/page";

export const Route = createFileRoute("/ai-info")({
  component: AiInfoPage,
});
