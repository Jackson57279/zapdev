import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, Terminal, Check, ExternalLink } from "lucide-react";

type NetlifyCLIDialogProps = {
  projectId: string;
  projectName: string;
};

export const NetlifyCLIDialog = ({ projectId, projectName }: NetlifyCLIDialogProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

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

      toast.success("Deployment package downloaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = async (text: string, commandName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandName);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      // Fallback for non-secure contexts (HTTP, older browsers)
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedCommand(commandName);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedCommand(null), 2000);
      } catch (fallbackErr) {
        console.error("Failed to copy to clipboard:", fallbackErr);
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  const installCommand = "npm install -g netlify-cli";
  const loginCommand = "netlify login";
  const initCommand = "netlify init";
  const deployCommand = "netlify deploy --prod";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Terminal className="mr-2 h-4 w-4" />
          Deploy to Netlify
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deploy to Netlify</DialogTitle>
          <DialogDescription>
            Deploy your project to Netlify using the CLI. No server authentication required!
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="quickstart" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="download">Download</TabsTrigger>
          </TabsList>

          <TabsContent value="quickstart" className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">1. Install Netlify CLI</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-sm">
                    {installCommand}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(installCommand, "install")}
                  >
                    {copiedCommand === "install" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">2. Login to Netlify</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-sm">
                    {loginCommand}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(loginCommand, "login")}
                  >
                    {copiedCommand === "login" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">3. Initialize your site</h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  Navigate to your project folder and run:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-sm">
                    {initCommand}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(initCommand, "init")}
                  >
                    {copiedCommand === "init" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">4. Deploy</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-sm">
                    {deployCommand}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(deployCommand, "deploy")}
                  >
                    {copiedCommand === "deploy" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} disabled={isDownloading} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Preparing..." : "Download Project ZIP"}
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://docs.netlify.com/cli/get-started/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  CLI Docs
                </a>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="commands">
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold">Link to existing site</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify link
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold">Deploy draft (preview)</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify deploy
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold">Deploy to production</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify deploy --prod
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold">Set environment variable</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify env:set KEY value
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold">Open site dashboard</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify open:admin
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold">View deploy logs</h4>
                  <code className="mt-1 block rounded bg-muted px-2 py-1">
                    netlify deploy --prod --debug
                  </code>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="download" className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-medium">Download Deployment Package</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Download a ZIP file containing your project with netlify.toml already configured.
                Extract it and follow the CLI instructions in NETLIFY_DEPLOY.md.
              </p>
              <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Preparing..." : `Download ${projectName}-netlify-ready.zip`}
              </Button>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-200">
                What's included?
              </h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                <li>All your project files</li>
                <li>Pre-configured netlify.toml</li>
                <li>Step-by-step deployment instructions (NETLIFY_DEPLOY.md)</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
