import { ConvexHttpClient } from "convex/browser";
import { StackServerApp } from "@stackframe/stack";

const stackProjectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const stackServerApp = stackProjectId
  ? new StackServerApp({
      tokenStore: "nextjs-cookie",
    })
  : null;

/**
 * Get the authenticated user from Stack Auth
 */
export async function getUser() {
  if (!stackServerApp) return null;
  try {
    const user = await stackServerApp.getUser();
    return user;
  } catch (error) {
    console.error("Failed to get user:", error);
    return null;
  }
}

/**
 * Get the authentication token for Convex
 * Stack Auth handles token management automatically for Convex through setAuth
 */
export async function getToken() {
  if (!stackServerApp) return null;
  try {
    const user = await stackServerApp.getUser();
    // When user exists, they are authenticated
    // For Convex, use stackServerApp's built-in auth integration
    return user ? "authenticated" : null;
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
}

/**
 * Get auth headers for API calls
 * Stack Auth handles this automatically, this is for manual use if needed
 */
export async function getAuthHeaders() {
  const user = await getUser();
  if (!user) return {};
  return {};
}

/**
 * Create a Convex HTTP client with Stack Auth authentication
 * Use this in API routes that need to call Convex
 */
export async function getConvexClientWithAuth() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  if (!stackServerApp) {
    throw new Error("NEXT_PUBLIC_STACK_PROJECT_ID is not set");
  }

  const httpClient = new ConvexHttpClient(convexUrl);
  
  // Set up Stack Auth for the Convex client
  const authInfo = await stackServerApp.getConvexHttpClientAuth({
    tokenStore: "nextjs-cookie",
  });
  
  httpClient.setAuth(authInfo);
  
  return httpClient;
}
