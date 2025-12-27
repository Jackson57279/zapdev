"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@stackframe/stack";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PolarCheckoutButton } from "@/components/polar-checkout-button";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function SubscriptionPage() {
  const user = useUser();
  const isAuthenticated = !!user;
  const subscription = useQuery(api.subscriptions.getSubscription, isAuthenticated ? {} : "skip");
  const usage = useQuery(api.usage.getUsage, isAuthenticated ? {} : "skip");

  if (!user || !isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please sign in to view your subscription.</p>
        </div>
      </div>
    );
  }

  if (subscription === undefined || usage === undefined) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isProUser = subscription?.status === "active" &&
    /\b(pro|enterprise)\b/i.test(subscription.productName);

  // TODO: Replace with actual Polar product ID
  const POLAR_PRO_PRODUCT_ID = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID || "YOUR_PRO_PRODUCT_ID";

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </div>
            <Badge variant={isProUser ? "default" : "secondary"} className="text-lg px-4 py-1">
              {subscription?.productName || "Free"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && subscription.status === "active" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium capitalize">{subscription.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Period</p>
                  <p className="font-medium mt-1">
                    {format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")} -{" "}
                    {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100">
                      Subscription Canceling
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      Your subscription will end on{" "}
                      {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}.
                      You'll still have access until then.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">
                You're currently on the Free plan with 5 generations per day.
              </p>
            </div>
          )}
        </CardContent>
        {!isProUser && (
          <CardFooter>
            <PolarCheckoutButton
              productId={POLAR_PRO_PRODUCT_ID}
              productName="Pro"
              price="$29"
              interval="month"
              className="w-full"
            >
              Upgrade to Pro
            </PolarCheckoutButton>
          </CardFooter>
        )}
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Your AI generation credits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <p className="text-2xl font-bold">
                  {usage.creditsRemaining} / {usage.maxPoints}
                </p>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{
                    width: `${(usage.creditsRemaining / usage.maxPoints) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Resets in</span>
              <span className="font-medium">
                {Math.ceil(usage.msBeforeNext / (1000 * 60 * 60))} hours
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Subscription Card (only for Pro users) */}
      {isProUser && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
            <CardDescription>
              Update payment method or cancel your subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To manage your payment method or view invoices, visit the Polar customer portal.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" asChild>
              <a
                href={`https://polar.sh/customer-portal`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Customer Portal
              </a>
            </Button>
            {!subscription?.cancelAtPeriodEnd && (
              <Button variant="destructive" disabled>
                Cancel Subscription
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Back to Dashboard */}
      <div className="flex justify-center pt-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">← Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
