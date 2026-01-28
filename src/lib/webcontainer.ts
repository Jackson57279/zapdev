import { WebContainer } from "@webcontainer/api";

/**
 * WebContainer singleton — browser-only.
 *
 * Only one WebContainer instance can exist per browser tab.
 * This module ensures we boot exactly once and reuse the instance.
 *
 * @see https://webcontainers.io/guides/quickstart
 */

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

/**
 * Returns the singleton WebContainer instance, booting it on first call.
 *
 * MUST only be called from client-side code (useEffect, event handlers, etc.).
 * Calling on the server will throw.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (typeof window === "undefined") {
    throw new Error(
      "getWebContainer() must only be called in the browser. " +
        "WebContainer requires a browser environment with SharedArrayBuffer support."
    );
  }

  if (instance) return instance;
  if (booting) return booting;

  booting = WebContainer.boot();
  instance = await booting;
  booting = null;

  return instance;
}

/**
 * Tears down the current WebContainer instance.
 * Useful for cleanup on unmount or when switching contexts.
 */
export function teardownWebContainer(): void {
  if (instance) {
    instance.teardown();
    instance = null;
  }
  booting = null;
}

/**
 * Check whether WebContainers are enabled via feature flag.
 */
export function isWebContainersEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_USE_WEBCONTAINERS === "true";
}
