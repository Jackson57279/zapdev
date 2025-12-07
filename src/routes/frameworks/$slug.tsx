import { createFileRoute } from "@tanstack/react-router";
import FrameworkSlugPage from "@/app/frameworks/[slug]/page";

export const Route = createFileRoute("/frameworks/$slug")({
  component: FrameworkSlugRouteComponent,
});

function FrameworkSlugRouteComponent() {
  const { slug } = Route.useParams();
  return <FrameworkSlugPage params={Promise.resolve({ slug })} />;
}
