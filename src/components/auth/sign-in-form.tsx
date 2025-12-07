"use client";

import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/clerk-react";

interface SignInFormProps {
  redirectUrl?: string;
  afterSignInUrl?: string;
}

export function SignInForm({
  redirectUrl = "/projects",
  afterSignInUrl = "/projects",
}: SignInFormProps) {
  return (
    <div className="space-y-4">
      <ClerkLoading>
        <p className="text-sm text-muted-foreground">Loading sign-in...</p>
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn
          routing="hash"
          redirectUrl={redirectUrl}
          afterSignInUrl={afterSignInUrl}
          appearance={{
            elements: {
              card: "shadow-none border",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
            },
          }}
        />
      </ClerkLoaded>
    </div>
  );
}
