"use client";

import {
  useAuth as useClerkAuth,
  useClerk,
  useUser as useClerkUser,
} from "@clerk/clerk-react";

// Client-side auth hooks backed by Clerk. These mirror the previous
// Convex Auth shape to minimize downstream changes while swapping providers.
export function useUser() {
  const { isLoaded, isSignedIn, user } = useClerkUser();
  const { signOut } = useClerk();

  if (!isLoaded) return null;
  if (!isSignedIn || !user) return null;

  const primaryEmail = user.primaryEmailAddress?.emailAddress ?? null;
  const displayName = user.fullName || user.username || primaryEmail || null;
  const profileImageUrl = user.imageUrl || null;

  return {
    id: user.id,
    email: primaryEmail,
    name: displayName,
    image: profileImageUrl,
    displayName,
    primaryEmail,
    profileImageUrl,
    signOut: () => signOut(),
  };
}

export function useAuth() {
  return useClerkAuth();
}

export function useAuthStatus() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  return {
    isAuthenticated: Boolean(isSignedIn),
    isLoading: !isLoaded,
  };
}
