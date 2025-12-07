"use client";

/**
 * Next.js compatibility shims for TanStack Router
 * 
 * These functions provide Next.js-like router APIs using TanStack Router under the hood.
 * Prefer using TanStack Router directly for new code:
 * - useNavigate() instead of useRouter()
 * - useLocation() instead of usePathname()
 * - useSearch() instead of useSearchParams()
 */

import { useLocation, useNavigate, useRouter as useTanRouter } from "@tanstack/react-router";
import type { FileRouteTypes } from "@/routeTree.gen";

type ResolveRouteParams<Path extends string> = Path extends `${infer Prefix}/$${infer _Param}/${infer Rest}`
  ? `${Prefix}/${string}/${ResolveRouteParams<Rest>}`
  : Path extends `${infer Prefix}/$${infer _Param}`
    ? `${Prefix}/${string}`
    : Path;

type WithQuerySuffix<Path extends string> =
  | Path
  | `${Path}?${string}`
  | `${Path}#${string}`
  | `${Path}?${string}#${string}`;

type AppRouteTemplate = ResolveRouteParams<FileRouteTypes['to']>;
export type AppRoutePath = WithQuerySuffix<AppRouteTemplate>;

/**
 * @deprecated Use useNavigate() from @tanstack/react-router instead
 * 
 * Example migration:
 * ```tsx
 * // Old (Next.js)
 * const router = useRouter();
 * router.push("/path");
 * 
 * // New (TanStack Router)
 * const navigate = useNavigate();
 * navigate({ to: "/path" });
 * ```
 */
export function useRouter() {
  const navigate = useNavigate();
  const router = useTanRouter();

  return {
    push: (href: AppRoutePath, options?: { replace?: boolean; scroll?: boolean }) =>
      navigate({ to: href, replace: options?.replace ?? false }),
    replace: (href: AppRoutePath, options?: { scroll?: boolean }) =>
      navigate({ to: href, replace: true }),
    prefetch: (href: AppRoutePath) => router.preloadRoute({ to: href }).catch(() => undefined),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => router.invalidate(),
  };
}

/**
 * @deprecated Use useLocation() from @tanstack/react-router instead
 * 
 * Example migration:
 * ```tsx
 * // Old (Next.js)
 * const pathname = usePathname();
 * 
 * // New (TanStack Router)
 * const location = useLocation();
 * const pathname = location.pathname;
 * ```
 */
export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

/**
 * @deprecated Use useSearch() from @tanstack/react-router instead
 * 
 * Example migration:
 * ```tsx
 * // Old (Next.js)
 * const searchParams = useSearchParams();
 * const value = searchParams.get("key");
 * 
 * // New (TanStack Router)
 * const search = useSearch({ strict: false });
 * const value = search?.key;
 * ```
 */
export function useSearchParams() {
  const searchString =
    typeof window === "undefined" ? "" : window.location?.search ?? "";
  return new URLSearchParams(searchString);
}

/**
 * Throws a 404 Not Found response
 */
export function notFound(): never {
  throw new Response("Not Found", { status: 404 });
}

/**
 * Re-export TanStack Router hooks for gradual migration
 */
export { useNavigate, useLocation } from "@tanstack/react-router";
