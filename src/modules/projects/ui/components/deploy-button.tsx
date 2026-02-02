import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NetlifyCLIDialog } from "./netlify-cli-dialog";

type DeployButtonProps = {
  projectId: string;
  projectName?: string;
};

export const DeployButton = ({ projectId, projectName = "project" }: DeployButtonProps) => {
  const [isPreparing, setIsPreparing] = useState(false);

  const handleQuickDownload = async () => {
    if (isPreparing) return;
    setIsPreparing(true);

    try {
      const response = await fetch("/api/deploy/netlify/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to prepare deployment package");
      }

      // Get the blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}-netlify-ready.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Deployment package downloaded! Extract and run 'netlify deploy --prod'");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        size="sm" 
        onClick={handleQuickDownload} 
        disabled={isPreparing}
        variant="default"
      >
        {isPreparing ? "Preparing..." : "Deploy to Netlify"}
      </Button>
      <NetlifyCLIDialog projectId={projectId} projectName={projectName} />
    </div>
  );
};
