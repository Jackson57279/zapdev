"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface PolarCheckoutButtonProps {
  productId?: string;
  successUrl?: string;
  cancelUrl?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PolarCheckoutButton({
  productId,
  successUrl,
  cancelUrl,
  children = "Upgrade to Pro",
  className,
  variant = "default",
  size = "default",
}: PolarCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useUser();
  const router = useRouter();

  const handleCheckout = async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polar/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          successUrl,
          cancelUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      console.error("Checkout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        className={className}
        variant={variant}
        size={size}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          children
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

