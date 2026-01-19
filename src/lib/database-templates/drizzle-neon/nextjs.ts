import type { DatabaseTemplateBundle } from "../types";
import {
  drizzleSchema,
  drizzleDbClient,
  drizzleConfig,
  betterAuthConfig,
  betterAuthClient,
} from "./shared";

export const drizzleNeonNextjsTemplate: DatabaseTemplateBundle = {
  provider: "drizzle-neon",
  framework: "nextjs",
  description: "Drizzle ORM + Neon PostgreSQL + Better Auth for Next.js",
  dependencies: [
    "drizzle-orm",
    "@neondatabase/serverless",
    "better-auth",
  ],
  devDependencies: [
    "drizzle-kit",
  ],
  envVars: {
    DATABASE_URL: "postgres://user:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require",
    BETTER_AUTH_SECRET: "your-secret-key-min-32-characters-long",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
  setupInstructions: [
    "1. Create a Neon account at https://console.neon.tech",
    "2. Create a new database and copy the connection string",
    "3. Update DATABASE_URL in .env with your connection string",
    "4. Generate BETTER_AUTH_SECRET: openssl rand -base64 32",
    "5. Run: npx drizzle-kit push (to create tables)",
    "6. Run: npm run dev (to start the app)",
  ],
  files: {
    "src/db/schema.ts": drizzleSchema,
    "src/db/index.ts": drizzleDbClient,
    "drizzle.config.ts": drizzleConfig,
    "src/lib/auth.ts": betterAuthConfig,
    "src/lib/auth-client.ts": betterAuthClient,

    "src/app/api/auth/[...all]/route.ts": `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
`,

    "src/middleware.ts": `import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedRoutes = ["/dashboard", "/settings", "/account"];
const authRoutes = ["/sign-in", "/sign-up"];

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (sessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(
      new URL(\`/sign-in?redirectTo=\${pathname}\`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
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

    "src/app/dashboard/page.tsx": `import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="mt-6 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Welcome, {session.user.name}!</h2>
        <p className="mt-2 text-gray-600">Email: {session.user.email}</p>
        <p className="mt-1 text-gray-600">
          Member since: {new Date(session.user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
`,
  },
};
