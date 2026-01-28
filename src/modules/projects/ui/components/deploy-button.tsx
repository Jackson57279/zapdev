import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { NetlifyConnectDialog } from "./netlify-connect-dialog";

type DeployButtonProps = {
  projectId: string;
};

export const DeployButton = ({ projectId }: DeployButtonProps) => {
  const connection = useQuery(api.oauth.getConnection, { provider: "netlify" });
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async () => {
    if (isDeploying) return;
    setIsDeploying(true);

    try {
      const response = await fetch("/api/deploy/netlify/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Deployment failed");
      }

      toast.success(`Deployment started: ${payload.siteUrl}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!connection) {
    return <NetlifyConnectDialog />;
  }

  return (
    <Button size="sm" onClick={handleDeploy} disabled={isDeploying}>
      {isDeploying ? "Deploying..." : "Deploy to Netlify"}
    </Button>
  );
};
