"use client";

import { useConvexAuth } from "convex/react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useUser } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Debug component to help diagnose auth issues
 * Add this temporarily to debug authentication problems
 *
 * Usage:
 * import { AuthDebug } from "@/components/auth-debug";
 * // Add <AuthDebug /> somewhere in your component tree to see debug info
 */
export function AuthDebug() {
  const convexAuth = useConvexAuth();
  const clerkAuth = useClerkAuth();
  const user = useUser();
  const userData = useQuery(api.users.getCurrentUser);

  return (
    <div className="fixed bottom-0 right-0 bg-black text-white p-4 text-xs font-mono max-w-md overflow-auto max-h-64 z-50 rounded-tl">
      <div className="space-y-2">
        <div className="font-bold text-blue-400">Auth Debug Info</div>

        <div>
          <div className="text-green-400">Convex Auth State:</div>
          <div className="pl-2">
            isAuthenticated: <span className="text-yellow-400">{String(convexAuth.isAuthenticated)}</span>
          </div>
          <div className="pl-2">
            isLoading: <span className="text-yellow-400">{String(convexAuth.isLoading)}</span>
          </div>
        </div>

        <div>
          <div className="text-green-400">Clerk Auth State:</div>
          <div className="pl-2">
            isSignedIn: <span className="text-yellow-400">{String(clerkAuth.isSignedIn)}</span>
          </div>
          <div className="pl-2">
            isLoaded: <span className="text-yellow-400">{String(clerkAuth.isLoaded)}</span>
          </div>
        </div>

        <div>
          <div className="text-green-400">User Data:</div>
          <div className="pl-2">
            useUser() result: <span className="text-yellow-400">{user ? "User object" : "null"}</span>
          </div>
          {user && (
            <>
              <div className="pl-2">
                email: <span className="text-yellow-400">{user.email}</span>
              </div>
              <div className="pl-2">
                name: <span className="text-yellow-400">{user.name}</span>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="text-green-400">Query Result:</div>
          <div className="pl-2">
            api.users.getCurrentUser: <span className="text-yellow-400">{userData === undefined ? "loading" : userData === null ? "null" : "data"}</span>
          </div>
        </div>

        <div className="text-gray-400 border-t border-gray-600 pt-2 mt-2">
          After sign-in:
          <ul className="list-disc pl-5 text-gray-300">
            <li>isAuthenticated should be true</li>
            <li>useUser() should return user object</li>
            <li>API query should return user data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
