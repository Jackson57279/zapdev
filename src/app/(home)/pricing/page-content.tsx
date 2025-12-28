"use client";

import Image from "next/image";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    credits: 5,
    features: [
      "5 AI generations per day",
      "All frameworks supported",
      "Basic code preview",
      "Community support",
    ],
  },
  PRO: {
    name: "Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
    price: 29,
    credits: 100,
    features: [
      "100 AI generations per day",
      "All frameworks supported",
      "Advanced code preview",
      "Priority support",
      "Export to GitHub",
      "Custom templates",
    ],
  },
} as const;

export function PricingPageContent() {
  const { isSignedIn, isLoaded } = useUser();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const searchParams = useSearchParams();

  // Get subscription status
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    isSignedIn ? {} : "skip"
  );

  const isProUser = subscription?.planName === "Pro" && subscription?.status === "active";

  // Handle success/cancel URL params
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription successful! Welcome to Pro.");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout was canceled.");
    }
  }, [searchParams]);

  const handleCheckout = async (priceId: string) => {
    if (!isSignedIn) {
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setIsPortalLoading(false);
    }
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48 pb-16">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="ZapDev - AI Development Platform"
            width={50}
            height={50}
            className="hidden md:block"
          />
        </div>
        <h1 className="text-xl md:text-3xl font-bold text-center">Pricing</h1>
        <p className="text-muted-foreground text-center text-sm md:text-base">
          Choose the plan that fits your needs
        </p>

        {/* Pricing Cards */}
        <div className="mt-12 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
          {/* Free Plan */}
          <div className="border rounded-xl p-6 bg-card">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{PLANS.FREE.name}</h2>
              <p className="text-muted-foreground text-sm">Perfect for trying out</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">${PLANS.FREE.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {PLANS.FREE.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {!isLoaded ? (
              <Button disabled className="w-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </Button>
            ) : !isSignedIn ? (
              <SignInButton mode="modal">
                <Button variant="outline" className="w-full">
                  Sign in to get started
                </Button>
              </SignInButton>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div className="border-2 border-primary rounded-xl p-6 bg-card relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Most Popular
              </span>
            </div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{PLANS.PRO.name}</h2>
              <p className="text-muted-foreground text-sm">For serious builders</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">${PLANS.PRO.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {PLANS.PRO.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {!isLoaded ? (
              <Button disabled className="w-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </Button>
            ) : !isSignedIn ? (
              <SignInButton mode="modal">
                <Button className="w-full">
                  Sign in to upgrade
                </Button>
              </SignInButton>
            ) : isProUser ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManageSubscription}
                disabled={isPortalLoading}
              >
                {isPortalLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Manage Subscription"
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "")}
                disabled={isCheckoutLoading || !process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID}
              >
                {isCheckoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Upgrade to Pro"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include access to the latest AI models and frameworks.</p>
          <p className="mt-2">Need enterprise features? Contact us for custom pricing.</p>
        </div>

        {/* FAQ or Trust Signals */}
        <div className="mt-16 max-w-2xl mx-auto px-4">
          <h3 className="text-lg font-semibold text-center mb-6">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">Can I cancel anytime?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Yes! You can cancel your subscription at any time. You&apos;ll continue to have access until the end of your billing period.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">What happens when I run out of credits?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Your credits reset every 24 hours. Free users get 5 credits/day, Pro users get 100 credits/day.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">What payment methods do you accept?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                We accept all major credit cards through Stripe, our secure payment processor.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
