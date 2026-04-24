# Better Auth Quick Start Guide

Quick reference for using Better Auth with Convex in the ZapDev application.

## Common Imports

```typescript
// Client-side hooks
import { authClient } from "@/lib/auth-client";

// Server-side helpers
import { getToken } from "@/lib/auth-server";

// Convex auth helpers
import { authComponent, getCurrentUser } from "@/convex/auth";
```

## Client-Side Usage

### Get Current User Session

```typescript
"use client";
import { authClient } from "@/lib/auth-client";

export function UserProfile() {
  const { data: session, isPending } = authClient.useSession();
  
  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not logged in</div>;
  
  return (
    <div>
      <p>Email: {session.user.email}</p>
      <p>Name: {session.user.name}</p>
    </div>
  );
}
```

### Sign Up

```typescript
import { authClient } from "@/lib/auth-client";

async function handleSignUp(email: string, password: string, name: string) {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
  });
  
  if (error) {
    console.error("Sign up failed:", error);
    return;
  }
  
  // Redirect to dashboard
  router.push("/dashboard");
}
```

### Sign In

```typescript
import { authClient } from "@/lib/auth-client";

async function handleSignIn(email: string, password: string) {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
  });
  
  if (error) {
    console.error("Sign in failed:", error);
    return;
  }
  
  router.push("/dashboard");
}
```

### Social Sign In

```typescript
import { authClient } from "@/lib/auth-client";

// Google
async function signInWithGoogle() {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
}

// GitHub
async function signInWithGitHub() {
  await authClient.signIn.social({
    provider: "github",
    callbackURL: "/dashboard",
  });
}
```

### Sign Out

```typescript
import { authClient } from "@/lib/auth-client";

async function handleSignOut() {
  await authClient.signOut();
  router.push("/");
}
```

### Protected Component Pattern

```typescript
"use client";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

export function ProtectedComponent() {
  const { data: session, isPending } = authClient.useSession();
  
  if (isPending) {
    return <LoadingSpinner />;
  }
  
  if (!session) {
    redirect("/sign-in");
  }
  
  return <div>Protected content for {session.user.name}</div>;
}
```

## Server-Side Usage

### Server Component with Auth

```typescript
import { getToken } from "@/lib/auth-server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function ServerPage() {
  const token = await getToken();
  
  if (!token) {
    redirect("/sign-in");
  }
  
  const user = await fetchQuery(
    api.auth.getCurrentUser,
    {},
    { token }
  );
  
  return <div>Hello {user?.name}</div>;
}
```

### Server Action with Auth

```typescript
"use server";
import { getToken } from "@/lib/auth-server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function createProject(name: string) {
  const token = await getToken();
  
  if (!token) {
    throw new Error("Not authenticated");
  }
  
  return await fetchMutation(
    api.projects.create,
    { name },
    { token }
  );
}
```

## Convex Function Patterns

### Query with Auth

```typescript
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getMyData = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    
    if (!user) {
      throw new Error("Unauthorized");
    }
    
    return ctx.db
      .query("someTable")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .collect();
  },
});
```

### Mutation with Auth

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

export const createItem = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    
    if (!user) {
      throw new Error("Unauthorized");
    }
    
    return ctx.db.insert("items", {
      name: args.name,
      userId: user.id,
      createdAt: Date.now(),
    });
  },
});
```

### Optional Auth (Public + Authenticated)

```typescript
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getPublicData = query({
  handler: async (ctx) => {
    // Try to get user, but don't require it
    const user = await authComponent.getAuthUser(ctx);
    
    if (user) {
      // Return personalized data for authenticated users
      return ctx.db
        .query("items")
        .withIndex("by_userId", (q) => q.eq("userId", user.id))
        .collect();
    }
    
    // Return public data for non-authenticated users
    return ctx.db
      .query("items")
      .withIndex("by_public", (q) => q.eq("public", true))
      .collect();
  },
});
```

## React Hook Form Integration

```typescript
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type SignInForm = z.infer<typeof signInSchema>;

export function SignInForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
  });
  
  const onSubmit = async (data: SignInForm) => {
    const { error } = await authClient.signIn.email(data);
    
    if (error) {
      // Handle error (show toast, etc.)
      return;
    }
    
    // Redirect on success
    window.location.href = "/dashboard";
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input {...register("password")} type="password" placeholder="Password" />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
```

## Common Patterns

### Loading States

```typescript
const { data: session, isPending } = authClient.useSession();

if (isPending) {
  return <LoadingSkeleton />;
}
```

### Error Handling

```typescript
const { data, error } = await authClient.signIn.email({ email, password });

if (error) {
  // error.code: "INVALID_CREDENTIALS", "USER_NOT_FOUND", etc.
  // error.message: Human-readable error message
  toast.error(error.message);
  return;
}
```

### Conditional Rendering

```typescript
const { data: session } = authClient.useSession();

return (
  <div>
    {session ? (
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    ) : (
      <Link href="/sign-in">Sign In</Link>
    )}
  </div>
);
```

### Redirect After Auth

```typescript
import { useRouter, useSearchParams } from "next/navigation";

const router = useRouter();
const searchParams = useSearchParams();
const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

async function handleSignIn() {
  const { data, error } = await authClient.signIn.email({ email, password });
  
  if (!error) {
    router.push(callbackUrl);
  }
}
```

## TypeScript Types

```typescript
// Session type
type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    token: string;
    expiresAt: Date;
  };
};

// Auth response type
type AuthResponse<T> = {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
```

## Environment Variables Reference

```bash
# Required
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
NEXT_PUBLIC_APP_URL=https://zapdev.link
SITE_URL=https://zapdev.link
BETTER_AUTH_SECRET=<generate-with-openssl>

# Optional (for OAuth)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

## Debugging Tips

### Check if user is authenticated

```typescript
const { data: session } = authClient.useSession();
console.log("Is authenticated:", !!session);
console.log("User:", session?.user);
```

### Check token in server

```typescript
const token = await getToken();
console.log("Token exists:", !!token);
```

### Test Convex auth query

```typescript
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

const currentUser = useQuery(api.auth.getCurrentUser);
console.log("Current user from Convex:", currentUser);
```

## Common Errors & Solutions

### "Not authenticated" in Convex function
**Cause**: Session not properly passed to Convex  
**Solution**: Ensure `ConvexBetterAuthProvider` wraps your app in layout.tsx

### CORS error on /api/auth
**Cause**: Missing CORS headers or domain mismatch  
**Solution**: Check `next.config.mjs` CORS headers and ensure www redirects to non-www

### OAuth callback not working
**Cause**: Incorrect callback URL in OAuth provider settings  
**Solution**: Set callback URL to `https://zapdev.link/api/auth/callback/{provider}`

### Session not persisting
**Cause**: Cookie settings or domain mismatch  
**Solution**: Ensure `SITE_URL` matches your actual domain exactly

## Resources

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Convex + Better Auth](https://convex-better-auth.netlify.app/)
- [Full Migration Guide](./BETTER_AUTH_MIGRATION.md)
