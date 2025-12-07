"use client";

import { useQuery } from "convex/react";
import { useUser } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrownIcon, CheckIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function SubscriptionPage() {
  const user = useUser();
  const usage = useQuery(api.usage.getUsage, user ? {} : "skip");

  const isPro = usage?.planType === "pro";
  const credits = usage?.creditsRemaining ?? 0;
  const maxCredits = isPro ? 100 : 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isPro && <CrownIcon className="h-5 w-5 text-yellow-500" />}
            Current Plan: {isPro ? "Pro" : "Free"}
          </CardTitle>
          <CardDescription>
            {credits} / {maxCredits} credits remaining
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                <span>{maxCredits} generations per 24 hours</span>
              </div>
              {isPro && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4" />
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4" />
                    <span>Advanced AI models</span>
                  </div>
                </>
              )}
            </div>

            {!isPro && (
              <Link to="/pricing">
                <Button>
                  <CrownIcon className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
