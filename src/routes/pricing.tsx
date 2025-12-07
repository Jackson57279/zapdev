import { createFileRoute } from "@tanstack/react-router";
import PricingPage from "@/app/(home)/pricing/page";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});
