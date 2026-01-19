import type { DatabaseTemplateBundle } from "../types";
import {
  convexSchema,
  convexConfig,
  convexAuthConfig,
  convexAuth,
  convexAuthClient,
  convexProvider,
} from "./shared";

export const convexNextjsTemplate: DatabaseTemplateBundle = {
  provider: "convex",
  framework: "nextjs",
  description: "Convex real-time database + Better Auth for Next.js",
  dependencies: [
    "convex",
    "@convex-dev/better-auth",
    "better-auth",
  ],
  devDependencies: [],
  envVars: {
    NEXT_PUBLIC_CONVEX_URL: "https://your-project.convex.cloud",
    BETTER_AUTH_SECRET: "your-secret-key-min-32-characters-long",
    SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  },
  setupInstructions: [
    "1. Run: npx convex dev (this will prompt you to create a project)",
    "2. Copy NEXT_PUBLIC_CONVEX_URL from terminal output to .env.local",
    "3. Generate BETTER_AUTH_SECRET: openssl rand -base64 32",
    "4. Set Convex env vars: npx convex env set BETTER_AUTH_SECRET <your-secret>",
    "5. Set Convex env vars: npx convex env set SITE_URL http://localhost:3000",
    "6. Run: npm run dev (to start the app)",
  ],
  files: {
    "convex/schema.ts": convexSchema,
    "convex/convex.config.ts": convexConfig,
    "convex/auth.config.ts": convexAuthConfig,
    "convex/auth.ts": convexAuth,
    "src/lib/auth-client.ts": convexAuthClient,
    "src/components/convex-provider.tsx": convexProvider,

    "src/app/api/auth/[...all]/route.ts": `import { createAuth } from "@/convex/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const { GET, POST } = toNextJsHandler(async (request) => {
  const auth = createAuth({
    runQuery: convex.query.bind(convex),
    runMutation: convex.mutation.bind(convex),
    runAction: convex.action.bind(convex),
  } as Parameters<typeof createAuth>[0]);
  return auth;
});
`,

    "src/components/auth/sign-in-form.tsx": `"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message || "Sign in failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="********"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
`,

    "src/components/auth/sign-up-form.tsx": `"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message || "Sign up failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="John Doe"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="********"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Sign Up"}
      </button>
    </form>
  );
}
`,

    "src/components/auth/user-button.tsx": `"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function UserButton() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => router.push("/sign-in")}
        className="rounded-md bg-black px-4 py-2 text-sm text-white"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{session.user.name}</span>
      <button
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      >
        Sign Out
      </button>
    </div>
  );
}
`,

    "src/app/sign-in/page.tsx": `import { SignInForm } from "@/components/auth/sign-in-form";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-gray-600">Sign in to your account</p>
        </div>
        <SignInForm />
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
`,

    "src/app/sign-up/page.tsx": `import { SignUpForm } from "@/components/auth/sign-up-form";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-gray-600">Get started with your account</p>
        </div>
        <SignUpForm />
        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
`,

    "src/app/dashboard/page.tsx": `"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="mt-6 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Welcome, {session.user.name}!</h2>
        <p className="mt-2 text-gray-600">Email: {session.user.email}</p>
      </div>
    </div>
  );
}
`,
  },
};
