"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WebContainer } from "@webcontainer/api";
import {
  getWebContainer,
  isWebContainersEnabled,
  teardownWebContainer,
} from "@/lib/webcontainer";

export type WebContainerStatus = "idle" | "booting" | "ready" | "error";

export interface WebContainerContextValue {
  /** The WebContainer instance, or null if not yet booted / disabled. */
  webcontainer: WebContainer | null;
  /** Current lifecycle status. */
  status: WebContainerStatus;
  /** Error message if boot failed. */
  error: string | null;
  /** Whether the feature flag is enabled. */
  enabled: boolean;
}

export const WebContainerContext = createContext<WebContainerContextValue>({
  webcontainer: null,
  status: "idle",
  error: null,
  enabled: false,
});

interface WebContainerProviderProps {
  children: ReactNode;
}

/**
 * Provides a singleton WebContainer instance to the React tree.
 *
 * Boots the container on mount when the feature flag
 * `NEXT_PUBLIC_USE_WEBCONTAINERS=true` is set. Tears it down on unmount.
 *
 * Wrap your preview / sandbox routes with this provider:
 * ```tsx
 * <WebContainerProvider>
 *   <PreviewPane />
 * </WebContainerProvider>
 * ```
 */
export function WebContainerProvider({ children }: WebContainerProviderProps) {
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const bootedRef = useRef(false);

  const enabled = isWebContainersEnabled();

  const boot = useCallback(async () => {
    // Prevent double-boot in React StrictMode
    if (bootedRef.current) return;
    bootedRef.current = true;

    setStatus("booting");
    setError(null);

    try {
      const container = await getWebContainer();
      setWebcontainer(container);
      setStatus("ready");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "WebContainer boot failed";
      console.error("[WebContainerProvider] Boot failed:", message);
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    boot();

    return () => {
      teardownWebContainer();
      bootedRef.current = false;
      setWebcontainer(null);
      setStatus("idle");
    };
  }, [enabled, boot]);

  return (
    <WebContainerContext.Provider value={{ webcontainer, status, error, enabled }}>
      {children}
    </WebContainerContext.Provider>
  );
}
