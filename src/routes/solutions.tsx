import { createFileRoute } from "@tanstack/react-router";
import SolutionsPage from "@/app/solutions/page";

export const Route = createFileRoute("/solutions")({
  component: SolutionsPage,
});
