"use client";

import { useState } from "react";
import Image from "next/image";

function PricingCard({
  title,
  description,
  price,
  interval,
  priceId,
  features,
  isPopular = false,
  isFree = false,
}: {
  title: string;
  description: string;
  price: number;
  interval: "monthly" | "yearly";
  priceId?: string;
  features: string[];
  isPopular?: boolean;
  isFree?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (isFree || !priceId) {
      // Free tier - just redirect to sign up
      window.location.href = "/sign-up";
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polar/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed");
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`relative rounded-xl border bg-card p-6 ${
        isPopular
          ? "border-primary shadow-lg scale-105"
          : "border-border hover:border-primary/50 transition-colors"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground">
            Most Popular
          </span>
        </div>
      )}

      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>

      <div className="mb-6">
        <span className="text-4xl font-bold">${price}</span>
        <span className="text-muted-foreground">/{interval === "monthly" ? "month" : "year"}</span>
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          isLoading
            ? "opacity-50 cursor-not-allowed"
            : isPopular
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
        }`}
      >
        {isLoading ? "Processing..." : isFree ? "Sign Up Free" : "Get Started"}
      </button>

      {error && (
        <div className="mt-3 text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}

export function PricingPageContent() {
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

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <PricingCard
            title="Free"
            description="Perfect for trying out ZapDev"
            price={0}
            interval="monthly"
            isFree={true}
            features={[
              "5 AI messages per day",
              "Access to basic AI models",
              "Community support",
            ]}
          />
          <PricingCard
            title="Pro"
            description="For power users and teams"
            price={29}
            interval="monthly"
            priceId={process.env.NEXT_PUBLIC_POLAR_PRO_PRICE_ID}
            isPopular={true}
            features={[
              "100 AI messages per day",
              "Access to all AI models",
              "Priority support",
              "Faster response times",
              "Advanced features",
            ]}
          />
          <PricingCard
            title="Unlimited"
            description="For serious developers and agencies"
            price={150}
            interval="monthly"
            priceId={process.env.NEXT_PUBLIC_POLAR_UNLIMITED_PRICE_ID}
            features={[
              "Unlimited AI messages",
              "Access to all AI models",
              "Dedicated support",
              "Fastest response times",
              "Advanced features",
              "Priority processing",
            ]}
          />
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include access to the latest AI models and frameworks.</p>
          <p className="mt-2">Need enterprise features? Contact us for custom pricing.</p>
        </div>
      </section>
    </div>
  );
}
