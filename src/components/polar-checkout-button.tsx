"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PolarCheckoutButtonProps {
  productId: string;
  productName: string;
  price: string;
  interval?: "month" | "year";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Button component to initiate Polar checkout flow
 * Creates a checkout session and redirects to Polar-hosted checkout page
 */
export function PolarCheckoutButton({
  productId,
  productName,
  price,
  interval = "month",
  variant = "default",
  className,
  children,
}: PolarCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      // Call API to create checkout session
      const response = await fetch("/api/polar/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle configuration errors with admin-friendly messages
        if (error.isConfigError) {
          console.error("Payment configuration error:", error.adminMessage || error.details);
          
          // Show user-friendly message
          toast.error(error.error || "Payment system unavailable", {
            description: error.details || "Please try again later or contact support.",
            duration: 6000,
          });
          
          // Log admin message for debugging (visible in browser console)
          if (error.adminMessage) {
            console.warn("🔧 Admin action required:", error.adminMessage);
          }
        } else {
          // Handle other errors
          toast.error(error.error || "Failed to create checkout session", {
            description: error.details,
            duration: 5000,
          });
        }
        
        setIsLoading(false);
        return;
      }

      const { url } = await response.json();

      // Redirect to Polar checkout page
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      
      // Handle network errors or unexpected failures
      toast.error("Unable to start checkout", {
        description: error instanceof Error 
          ? error.message 
          : "Please check your internet connection and try again.",
        duration: 5000,
      });
      
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={isLoading}
      variant={variant}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children || `Get ${productName} - ${price}/${interval}`
      )}
    </Button>
  );
}
