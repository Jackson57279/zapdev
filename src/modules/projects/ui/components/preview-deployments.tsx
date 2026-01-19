import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

type PreviewDeploymentsProps = {
  projectId: string;
};

export const PreviewDeployments = ({ projectId }: PreviewDeploymentsProps) => {
  const deployments = useQuery(api.deployments.listDeployments, { projectId });
  const [isCreating, setIsCreating] = useState(false);

  const previews = useMemo(
    () => (deployments ?? []).filter((deployment) => deployment.isPreview),
    [deployments]
  );

  const handleCreatePreview = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/deploy/netlify/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, deployType: "preview" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Preview deployment failed");
      }
      toast.success("Preview deployment started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview deployment failed");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePreview = async (deployId?: string) => {
    if (!deployId) return;
    try {
      const response = await fetch(`/api/deploy/netlify/preview?deployId=${deployId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete preview");
      }
      toast.success("Preview deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete preview");
    }
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={handleCreatePreview} disabled={isCreating}>
        {isCreating ? "Creating preview..." : "Create Preview Deployment"}
      </Button>
      {previews.length === 0 && (
        <p className="text-sm text-muted-foreground">No preview deployments yet</p>
      )}
      {previews.map((deployment) => (
        <div key={deployment._id} className="flex items-center justify-between text-sm">
          <div className="flex flex-col">
            <span>Preview #{deployment.deployNumber ?? "-"}</span>
            <span className="text-xs text-muted-foreground">{deployment.status}</span>
          </div>
          <div className="flex items-center gap-2">
            {deployment.siteUrl && (
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <a href={deployment.siteUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeletePreview(deployment.deployId)}
              disabled={!deployment.deployId}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
