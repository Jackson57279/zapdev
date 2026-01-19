import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EnvVar = {
  key: string;
};

type EnvVarsDialogProps = {
  siteId: string;
};

export const EnvVarsDialog = ({ siteId }: EnvVarsDialogProps) => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const loadEnvVars = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deploy/netlify/env-vars?siteId=${siteId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load env vars");
      }
      setEnvVars(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load env vars");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey || !newValue) {
      toast.error("Provide a key and value");
      return;
    }

    try {
      const response = await fetch("/api/deploy/netlify/env-vars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, key: newKey, value: newValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to set env var");
      }
      setNewKey("");
      setNewValue("");
      await loadEnvVars();
      toast.success("Env var saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set env var");
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(
        `/api/deploy/netlify/env-vars?siteId=${siteId}&key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete env var");
      }
      await loadEnvVars();
      toast.success("Env var deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete env var");
    }
  };

  useEffect(() => {
    void loadEnvVars();
  }, [siteId]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Env Vars</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Environment Variables</DialogTitle>
          <DialogDescription>Manage Netlify environment variables for this site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="KEY"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
            />
            <Input
              placeholder="VALUE"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
            />
            <Button onClick={handleAdd} disabled={isLoading}>
              Save
            </Button>
          </div>
          <div className="space-y-2">
            {envVars.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">No variables set</p>
            )}
            {envVars.map((envVar) => (
              <div key={envVar.key} className="flex items-center justify-between text-sm">
                <span>{envVar.key}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(envVar.key)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
