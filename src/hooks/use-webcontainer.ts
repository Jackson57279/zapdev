"use client";

import { useContext } from "react";
import {
  WebContainerContext,
  type WebContainerContextValue,
} from "@/providers/webcontainer-provider";

/**
 * Access the singleton WebContainer instance and its lifecycle status.
 *
 * Must be used within a `<WebContainerProvider>`.
 *
 * @example
 * ```tsx
 * const { webcontainer, status, error } = useWebContainer();
 *
 * if (status === "booting") return <Spinner />;
 * if (status === "error") return <p>Error: {error}</p>;
 * if (!webcontainer) return null;
 *
 * // Use webcontainer to mount files, spawn processes, etc.
 * await webcontainer.mount(files);
 * ```
 */
export function useWebContainer(): WebContainerContextValue {
  const context = useContext(WebContainerContext);

  if (context === undefined) {
    throw new Error(
      "useWebContainer must be used within a <WebContainerProvider>. " +
        "Wrap your component tree with <WebContainerProvider> to use this hook."
    );
  }

  return context;
}
