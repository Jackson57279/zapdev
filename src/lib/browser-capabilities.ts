export interface BrowserCapabilities {
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  webContainerAPI: boolean;
  isSupported: boolean;
}

export function checkWebContainerSupport(): BrowserCapabilities {
  if (typeof window === "undefined") {
    return {
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      webContainerAPI: false,
      isSupported: false,
    };
  }

  const capabilities: BrowserCapabilities = {
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated: window.crossOriginIsolated ?? false,
    webContainerAPI: false,
    isSupported: false,
  };

  capabilities.isSupported =
    capabilities.sharedArrayBuffer && capabilities.crossOriginIsolated;

  return capabilities;
}

export function getBrowserName(): string {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;

  if (ua.includes("Chrome") && !ua.includes("Edg")) return "chrome";
  if (ua.includes("Edg")) return "edge";
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";

  return "unknown";
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getWebContainerSupportMessage(
  capabilities: BrowserCapabilities
): string {
  if (capabilities.isSupported) {
    return "WebContainers fully supported - instant preview enabled";
  }

  const issues: string[] = [];

  if (!capabilities.sharedArrayBuffer) {
    issues.push("SharedArrayBuffer not available");
  }

  if (!capabilities.crossOriginIsolated) {
    issues.push("Cross-Origin Isolation not enabled");
  }

  const browser = getBrowserName();
  const isMobile = isMobileBrowser();

  if (isMobile) {
    return `Mobile browsers have limited WebContainer support. Using cloud sandbox for reliable preview. (${issues.join(", ")})`;
  }

  if (browser === "firefox") {
    return `Firefox has beta WebContainer support. Using cloud sandbox for now. (${issues.join(", ")})`;
  }

  if (browser === "safari") {
    return `Safari requires version 16.4+ for WebContainers. Using cloud sandbox. (${issues.join(", ")})`;
  }

  return `WebContainers not supported. Using cloud sandbox. (${issues.join(", ")})`;
}

export interface RuntimeRecommendation {
  useWebContainers: boolean;
  reason: string;
  fallbackAvailable: boolean;
}

export function getOptimalRuntime(
  capabilities: BrowserCapabilities
): RuntimeRecommendation {
  if (capabilities.isSupported) {
    return {
      useWebContainers: true,
      reason: "Full WebContainer support detected",
      fallbackAvailable: true,
    };
  }

  return {
    useWebContainers: false,
    reason: getWebContainerSupportMessage(capabilities),
    fallbackAvailable: true,
  };
}
