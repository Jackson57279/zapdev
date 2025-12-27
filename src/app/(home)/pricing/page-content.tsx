"use client";

import Image from "next/image";
import { Check, AlertCircle } from "lucide-react";
import { PolarCheckoutButton } from "@/components/polar-checkout-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect, useState } from "react";

export function PricingPageContent() {
  // Check if Polar is properly configured
  const POLAR_PRO_PRODUCT_ID = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID || "YOUR_PRO_PRODUCT_ID";
  const POLAR_ORG_ID = process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID;
  
  const [isPolarConfigured, setIsPolarConfigured] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Validate Polar configuration on client side
    const checkConfig = () => {
      if (!POLAR_PRO_PRODUCT_ID || POLAR_PRO_PRODUCT_ID === "YOUR_PRO_PRODUCT_ID") {
        setConfigError("Product ID not configured");
        setIsPolarConfigured(false);
        console.warn(
          "⚠️ Polar.sh is not configured:\n" +
          "NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID is missing or not set.\n" +
          "Please create a product in Polar.sh and add the product ID to environment variables.\n" +
          "See: explanations/POLAR_INTEGRATION.md"
        );
        return;
      }

      // Check if it looks like a UUID (8-4-4-4-12 hex chars)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(POLAR_PRO_PRODUCT_ID);
      
      /* 
       * NOTE: Polar sandbox IDs are UUIDs, while production IDs start with "prod_".
       * We allow both formats now.
       */

      if (!POLAR_PRO_PRODUCT_ID.startsWith("prod_") && !isUuid) {
        setConfigError("Invalid product ID format");
        setIsPolarConfigured(false);
        console.warn(
          "⚠️ Polar.sh product ID appears invalid:\n" +
          "Product IDs should start with 'prod_' or be a valid UUID (for sandbox)\n" +
          "Current value: " + POLAR_PRO_PRODUCT_ID
        );
        return;
      }

      if (!POLAR_ORG_ID) {
        setConfigError("Organization ID not configured");
        setIsPolarConfigured(false);
        console.warn(
          "⚠️ Polar.sh organization ID is missing:\n" +
          "NEXT_PUBLIC_POLAR_ORGANIZATION_ID is not set.\n" +
          "Please add your organization ID to environment variables."
        );
        return;
      }

      // All checks passed
      setIsPolarConfigured(true);
      setConfigError(null);
    };

    checkConfig();
  }, [POLAR_PRO_PRODUCT_ID, POLAR_ORG_ID]);

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

        {/* Configuration Warning Alert */}
        {isPolarConfigured === false && (
          <Alert variant="destructive" className="mt-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payment system is currently being configured. Please check back soon or contact support.
              {process.env.NODE_ENV === "development" && configError && (
                <span className="block mt-2 text-xs font-mono">
                  Dev Info: {configError}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Free Tier */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>Perfect for trying out ZapDev</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>5 AI generations per day</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>All frameworks (Next.js, React, Angular, Vue, Svelte)</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Real-time code preview</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Export code</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className="relative border-primary shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
              Popular
            </div>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>For developers building serious projects</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">100 AI generations per day</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>All Free features</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Priority AI processing</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Advanced error fixing</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Email support</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Flux Kontext Pro image generation</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {isPolarConfigured ? (
                <PolarCheckoutButton
                  productId={POLAR_PRO_PRODUCT_ID}
                  productName="Pro"
                  price="$29"
                  interval="month"
                  className="w-full"
                >
                  Upgrade to Pro
                </PolarCheckoutButton>
              ) : (
                <Button disabled className="w-full" variant="default">
                  {isPolarConfigured === null ? (
                    "Loading..."
                  ) : (
                    "Contact Support to Upgrade"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include access to the latest AI models and frameworks.</p>
          <p className="mt-2">Need enterprise features? Contact us for custom pricing.</p>
        </div>
      </section>
    </div>
  );
}