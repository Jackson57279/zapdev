"use client";

import { useLocation, useNavigate, useRouter as useTanRouter, useRouterState } from "@tanstack/react-router";

export function useRouter() {
  const navigate = useNavigate();
  const router = useTanRouter();

  return {
    push: (href: string, options?: { replace?: boolean; scroll?: boolean }) =>
      navigate({ to: href as any, replace: options?.replace ?? false }),
    replace: (href: string, options?: { scroll?: boolean }) =>
      navigate({ to: href as any, replace: true }),
    prefetch: (href: string) => router.preloadRoute({ to: href as any }).catch(() => undefined),
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const { location } = useRouterState();
  const searchString = "searchStr" in location ? (location as any).searchStr : location.search ?? "";
  return new URLSearchParams(searchString ?? "");
}

export function notFound(): never {
  throw new Response("Not Found", { status: 404 });
}
