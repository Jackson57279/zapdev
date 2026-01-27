import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type DeploymentStatusProps = {
  projectId: Id<"projects">;
};

type NetlifyStatusResponse = {
  state?: string;
};

const statusLabelMap: Record<string, string> = {
  pending: "Pending",
  building: "Building",
  ready: "Ready",
  error: "Error",
};

export const DeploymentStatus = ({ projectId }: DeploymentStatusProps) => {
  const deployment = useQuery(api.deployments.getDeployment, { projectId });
  const updateDeployment = useMutation(api.deployments.updateDeployment);

  const shouldPoll = useMemo(() => {
    if (!deployment?.deployId) return false;
    return deployment.status === "pending" || deployment.status === "building";
  }, [deployment]);

  useEffect(() => {
    if (!shouldPoll || !deployment?.deployId) {
      return;
    }

    let cancelled = false;
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/deploy/netlify/status?deployId=${deployment.deployId}`);
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as NetlifyStatusResponse;
        if (!data.state || cancelled) {
          return;
        }

        await updateDeployment({
          deploymentId: deployment._id,
          status: data.state === "ready" ? "ready" : data.state === "error" ? "error" : "building",
        });
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(pollStatus, 10000);
    void pollStatus();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deployment?._id, deployment?.deployId, shouldPoll, updateDeployment]);

  if (!deployment) {
    return null;
  }

  const label = statusLabelMap[deployment.status] ?? deployment.status;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Netlify: {label}</span>
      {deployment.siteUrl && deployment.status === "ready" && (
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={deployment.siteUrl} target="_blank" rel="noreferrer">
            View site
          </Link>
        </Button>
      )}
    </div>
  );
};
