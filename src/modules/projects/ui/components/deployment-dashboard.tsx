import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DeployButton } from "./deploy-button";
import { DeploymentStatus } from "./deployment-status";
import { EnvVarsDialog } from "./env-vars-dialog";
import { CustomDomainDialog } from "./custom-domain-dialog";
import { DeploymentHistory } from "./deployment-history";
import { PreviewDeployments } from "./preview-deployments";

type DeploymentDashboardProps = {
  projectId: string;
};

export const DeploymentDashboard = ({ projectId }: DeploymentDashboardProps) => {
  const deployment = useQuery(api.deployments.getDeployment, { projectId });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Netlify Deployment</h3>
          <DeploymentStatus projectId={projectId} />
        </div>
        <DeployButton projectId={projectId} />
      </div>

      {deployment?.siteId && (
        <div className="flex flex-wrap items-center gap-2">
          <EnvVarsDialog siteId={deployment.siteId} />
          <CustomDomainDialog siteId={deployment.siteId} />
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2">Preview Deployments</h4>
        <PreviewDeployments projectId={projectId} />
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Deployment History</h4>
        <DeploymentHistory projectId={projectId} />
      </div>
    </div>
  );
};
