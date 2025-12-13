"use client";

import Image from "next/image";
import { PricingTable } from "@clerk/nextjs";

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

        {/* Clerk Billing Pricing Table */}
        <div className="mt-12">
          <PricingTable />
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include access to the latest AI models and frameworks.</p>
          <p className="mt-2">Need enterprise features? Contact us for custom pricing.</p>
        </div>
      </section>
    </div>
  );
}
