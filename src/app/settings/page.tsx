"use client";

import { useQuery } from "convex/react";
import { useUser } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const user = useUser();
  const usage = useQuery(api.usage.getUsage, user ? {} : "skip");

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Manage your profile information and security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/settings/profile">
              <Button variant="outline">Manage Profile</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              {usage?.planType === "pro" ? "Pro Plan" : "Free Plan"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                {usage?.creditsRemaining ?? 0} credits remaining
              </p>
              <Link to="/settings/subscription">
                <Button variant="outline">Manage Subscription</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>
              Manage your OAuth connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/settings/connections">
              <Button variant="outline">Manage Connections</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
