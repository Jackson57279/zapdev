"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GitHubExportModal } from "./github-export-modal";

type GitHubExportButtonProps = {
  projectId: string;
};

export const GitHubExportButton = ({ projectId }: GitHubExportButtonProps) => {
  const connection = useQuery(api.oauth.getConnection, { provider: "github" });
  const [open, setOpen] = useState(false);

  if (connection === undefined) {
    return (
      <Button size="sm" variant="outline" disabled>
        Loading...
      </Button>
    );
  }

  if (connection === null) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Connect GitHub
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GitHub</DialogTitle>
            <DialogDescription>
              Connect your GitHub account to export projects.
            </DialogDescription>
          </DialogHeader>
          <Button asChild>
            <Link href="/api/import/github/auth">Continue to GitHub</Link>
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export to GitHub
      </Button>
      <GitHubExportModal
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
};
