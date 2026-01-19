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

type NetlifyDomain = {
  id: string;
  name: string;
  ssl_status?: string;
  verification?: {
    status?: string;
  };
};

type CustomDomainDialogProps = {
  siteId: string;
};

export const CustomDomainDialog = ({ siteId }: CustomDomainDialogProps) => {
  const [domains, setDomains] = useState<NetlifyDomain[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadDomains = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deploy/netlify/domains?siteId=${siteId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load domains");
      }
      setDomains(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load domains");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!domainInput) {
      toast.error("Enter a domain");
      return;
    }

    try {
      const response = await fetch("/api/deploy/netlify/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, domain: domainInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add domain");
      }
      setDomainInput("");
      await loadDomains();
      toast.success("Domain added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add domain");
    }
  };

  const handleDelete = async (domainId: string) => {
    try {
      const response = await fetch(
        `/api/deploy/netlify/domains?siteId=${siteId}&domainId=${domainId}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove domain");
      }
      await loadDomains();
      toast.success("Domain removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove domain");
    }
  };

  useEffect(() => {
    void loadDomains();
  }, [siteId]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Custom Domains</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom Domains</DialogTitle>
          <DialogDescription>Manage domains and DNS verification.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="yourdomain.com"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
            />
            <Button onClick={handleAdd} disabled={isLoading}>
              Add Domain
            </Button>
          </div>
          <div className="space-y-2">
            {domains.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">No domains configured</p>
            )}
            {domains.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span>{domain.name}</span>
                  <span className="text-xs text-muted-foreground">
                    SSL: {domain.ssl_status ?? "unknown"} • Verification: {domain.verification?.status ?? "unknown"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(domain.id)}
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
