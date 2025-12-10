import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

type AuthenticatedUser = {
  id: string;
  primaryEmail: string | null;
  displayName: string | null;
  imageUrl: string | null;
};

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkJwtTemplate = process.env.CLERK_JWT_TEMPLATE_NAME || "convex";

export async function getUser(): Promise<AuthenticatedUser | null> {
  try {
    const user = await currentUser();
    if (!user) return null;

    return {
      id: user.id,
      primaryEmail: user.primaryEmailAddress?.emailAddress ?? null,
      displayName: user.fullName ?? user.username ?? user.firstName ?? null,
      imageUrl: user.imageUrl ?? null,
    };
  } catch (error) {
    console.error("Failed to get user:", error);
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const { getToken } = auth();
    if (!getToken) return null;
    return (await getToken({ template: clerkJwtTemplate })) ?? null;
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
}

export async function getAuthHeaders() {
  const token = await getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function getConvexClientWithAuth() {
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }

  const httpClient = new ConvexHttpClient(convexUrl);
  const { getToken } = auth();

  httpClient.setAuth(async () => {
    const token = await getToken({ template: clerkJwtTemplate });
    return token ?? null;
  });

  return httpClient;
}
