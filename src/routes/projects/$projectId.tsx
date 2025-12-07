import { createFileRoute } from "@tanstack/react-router";
import ProjectPage from "@/app/projects/[projectId]/page";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectRouteComponent,
});

function ProjectRouteComponent() {
  const { projectId } = Route.useParams();
  return <ProjectPage params={Promise.resolve({ projectId })} />;
}
