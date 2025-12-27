"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, RedirectToSignIn } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PolarCheckoutButton } from "@/components/polar-checkout-button";
import { Loader2, CreditCard, Calendar, Zap, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function SubscriptionPage() {
  const { isSignedIn, isLoaded } = useUser();
  const subscription = useQuery(api.subscriptions.getSubscription);
  const usage = useQuery(api.usage.getUsage);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  const isProUser = subscription?.planName === "Pro" && subscription?.status === "active";
  const planName = isProUser ? "Pro" : "Free";
  const creditsPerDay = isProUser ? 100 : 5;
  const remainingCredits = usage?.points ?? creditsPerDay;

  const periodEnd = subscription?.currentPeriodEnd 
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto w-full py-12 px-4">
      <h1 className="text-2xl font-bold mb-8">Subscription</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <Badge variant={isProUser ? "default" : "secondary"}>
                {planName}
              </Badge>
            </div>
            <CardDescription>
              {isProUser 
                ? "You have access to all Pro features"
                : "Upgrade to Pro for more generations and features"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Daily Credits</span>
              </div>
              <span className="font-medium">{remainingCredits} / {creditsPerDay}</span>
            </div>
            {periodEnd && (
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {subscription?.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
                  </span>
                </div>
                <span className="font-medium">{periodEnd}</span>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <div className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-sm p-3 rounded-md">
                Your subscription is set to cancel at the end of the billing period.
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-4">
            {!isProUser ? (
              <PolarCheckoutButton className="flex-1">
                Upgrade to Pro
              </PolarCheckoutButton>
            ) : (
              <Button variant="outline" className="flex-1" asChild>
                <Link href="https://polar.sh/purchases/subscriptions" target="_blank">
                  Manage Subscription
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${!isProUser ? "border-primary bg-primary/5" : ""}`}>
                <h3 className="font-semibold mb-2">Free</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 5 generations per day</li>
                  <li>• All frameworks</li>
                  <li>• Code preview & export</li>
                  <li>• Community support</li>
                </ul>
              </div>
              <div className={`p-4 rounded-lg border ${isProUser ? "border-primary bg-primary/5" : ""}`}>
                <h3 className="font-semibold mb-2">Pro - $29/month</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 100 generations per day</li>
                  <li>• All frameworks</li>
                  <li>• Priority processing</li>
                  <li>• Advanced error fixing</li>
                  <li>• Email support</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

