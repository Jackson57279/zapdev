"use client";

import { useEffect, useRef } from "react";
import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/clerk-react";
import { useUser } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const user = useUser();
  const previousUserRef = useRef(user);
  const hasShownToastRef = useRef(false);

  // Auto-close modal when user successfully signs in
  useEffect(() => {
    if (!previousUserRef.current && user) {
      // User just signed in
      if (!hasShownToastRef.current) {
        toast.success("Welcome back!");
        hasShownToastRef.current = true;
      }
      // Delay the close to ensure the UI has time to update
      const timer = setTimeout(() => {
        onClose();
        hasShownToastRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
    previousUserRef.current = user;
  }, [user, onClose]);

  // Reset toast flag when modal is opened
  useEffect(() => {
    if (isOpen) {
      hasShownToastRef.current = false;
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <ClerkLoading>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading authentication...
          </div>
        </ClerkLoading>
        <ClerkLoaded>
          {mode === "signin" ? (
            <SignIn
              routing="hash"
              afterSignInUrl="/projects"
              redirectUrl="/projects"
              appearance={{
                elements: {
                  card: "shadow-none border rounded-none",
                  formButtonPrimary: "bg-primary hover:bg-primary/90",
                },
              }}
            />
          ) : (
            <SignUp
              routing="hash"
              afterSignUpUrl="/projects"
              redirectUrl="/projects"
              appearance={{
                elements: {
                  card: "shadow-none border rounded-none",
                  formButtonPrimary: "bg-primary hover:bg-primary/90",
                },
              }}
            />
          )}
        </ClerkLoaded>
      </DialogContent>
    </Dialog>
  );
}
