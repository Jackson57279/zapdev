"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import confetti from "canvas-confetti";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import { StructuredData } from "@/components/seo/structured-data";

// Client-side wrapper for handling search params
function PageContent() {
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const navigate = useNavigate();

  useEffect(() => {
    const subscription = searchParams?.subscription;
    
    if (subscription === "success") {
      // Clean up URL
      navigate({ to: "/", replace: true });
      
      // Show success toast
      toast.success("Upgrade Successful!", {
        description: "You have successfully upgraded to Pro. Enjoy your new limits!",
        duration: 6000,
      });

      // Trigger confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <section className="space-y-6 py-[16vh] 2xl:py-48">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="ZapDev"
            width={50}
            height={50}
            priority
            className="hidden md:block"
          />
        </div>
        <h1 className="text-2xl md:text-5xl font-bold text-center">
          Build something with ZapDev
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground text-center">
          Create apps and websites by chatting with AI
        </p>
        <div className="max-w-3xl mx-auto w-full">
          <ProjectForm />
        </div>
      </section>
      <ProjectsList />
    </div>
  );
}

export default PageContent;


