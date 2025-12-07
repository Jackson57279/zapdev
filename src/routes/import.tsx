import { createFileRoute } from "@tanstack/react-router";
import ImportPage from "@/app/import/page";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});
