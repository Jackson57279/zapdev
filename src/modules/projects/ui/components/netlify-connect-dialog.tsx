import Link from "next/link";
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

export const NetlifyConnectDialog = () => {
  const connection = useQuery(api.oauth.getConnection, { provider: "netlify" });

  if (connection) {
    return (
      <Button variant="secondary" size="sm" disabled>
        Netlify Connected
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Connect Netlify</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Netlify</DialogTitle>
          <DialogDescription>
            Connect your Netlify account to deploy projects directly from ZapDev.
          </DialogDescription>
        </DialogHeader>
        <Button asChild>
          <Link href="/api/deploy/netlify/auth">Continue to Netlify</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
};
