import { createFileRoute } from "@tanstack/react-router";
import ShowcasePage from "@/app/showcase/page";

export const Route = createFileRoute("/showcase")({
  component: ShowcasePage,
});
