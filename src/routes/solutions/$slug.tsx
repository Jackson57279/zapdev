import { createFileRoute } from "@tanstack/react-router";
import SolutionsSlugPage from "@/app/solutions/[slug]/page";

export const Route = createFileRoute("/solutions/$slug")({
  component: SolutionsSlugRouteComponent,
});

function SolutionsSlugRouteComponent() {
  const { slug } = Route.useParams();
  return <SolutionsSlugPage params={Promise.resolve({ slug })} />;
}
