import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DeploymentHistoryProps = {
  projectId: Id<"projects">;
};

type DeploymentLogsDialogProps = {
  deployId: string;
};

const DeploymentLogsDialog = ({ deployId }: DeploymentLogsDialogProps) => {
  const [logsByDeployId, setLogsByDeployId] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    setLogsByDeployId((prev) => ({ ...prev, [deployId]: null }));
    try {
      const response = await fetch(`/api/deploy/netlify/logs?deployId=${deployId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch logs");
      }
      setLogsByDeployId((prev) => ({ ...prev, [deployId]: data.logs || "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch logs");
      setLogsByDeployId((prev) => ({ ...prev, [deployId]: null }));
    } finally {
      setIsLoading(false);
    }
  };

  const logs = logsByDeployId[deployId] ?? null;

  return (
    <Dialog onOpenChange={(open) => open && fetchLogs()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Logs
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Build Logs</DialogTitle>
          <DialogDescription>Latest build output from Netlify.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-4 animate-spin" />
              <span className="ml-2">Loading logs...</span>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap">{logs || "No logs available"}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DeploymentHistory = ({ projectId }: DeploymentHistoryProps) => {
  const deployments = useQuery(api.deployments.listDeployments, { projectId });

  const handleRollback = async (deployId?: string) => {
    if (!deployId) return;
    try {
      const response = await fetch("/api/deploy/netlify/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Rollback failed");
      }
      toast.success("Rollback initiated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rollback failed");
    }
  };

  if (!deployments || deployments.length === 0) {
    return <p className="text-sm text-muted-foreground">No deployments yet</p>;
  }

  return (
    <div className="space-y-2">
      {deployments.map((deployment) => (
        <div
          key={deployment._id}
          className="flex items-center justify-between rounded-md border p-2 text-sm"
        >
          <div className="flex flex-col">
            <span>Deploy #{deployment.deployNumber ?? "-"} • {deployment.status}</span>
            <span className="text-xs text-muted-foreground">
              {deployment.siteUrl}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {deployment.deployId && <DeploymentLogsDialog deployId={deployment.deployId} />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRollback(deployment.deployId)}
              disabled={!deployment.deployId}
            >
              Rollback
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
