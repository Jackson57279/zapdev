import type { Framework, ExpoPreviewMode } from "./types";
import type { RuntimeType } from "./webcontainer-utils";

export type TaskType = "preview" | "native-build" | "full-dev";

export interface RuntimeConfig {
  useWebContainers: boolean;
  runtimeType: RuntimeType;
  reason: string;
}

const WEBCONTAINER_SUPPORTED_FRAMEWORKS: Framework[] = [
  "nextjs",
  "react",
  "vue",
  "svelte",
  "angular",
];

export function selectRuntime(
  framework: Framework,
  taskType: TaskType = "preview",
  expoPreviewMode?: ExpoPreviewMode,
  browserSupportsWebContainers: boolean = true
): RuntimeConfig {
  if (!browserSupportsWebContainers) {
    return {
      useWebContainers: false,
      runtimeType: "e2b",
      reason: "Browser does not support WebContainers (missing SharedArrayBuffer)",
    };
  }

  if (taskType === "native-build") {
    return {
      useWebContainers: false,
      runtimeType: "e2b",
      reason: "Native builds require E2B cloud environment with full OS access",
    };
  }

  if (framework === "expo") {
    if (expoPreviewMode === "web" || !expoPreviewMode) {
      return {
        useWebContainers: true,
        runtimeType: "webcontainer",
        reason: "Expo web preview runs efficiently in WebContainers",
      };
    }

    if (expoPreviewMode === "expo-go" || expoPreviewMode === "android-emulator") {
      return {
        useWebContainers: false,
        runtimeType: "e2b",
        reason: `Expo ${expoPreviewMode} requires E2B for native runtime/emulator`,
      };
    }

    if (expoPreviewMode === "eas-build") {
      return {
        useWebContainers: false,
        runtimeType: "e2b",
        reason: "EAS builds require E2B for cloud-based compilation",
      };
    }
  }

  if (WEBCONTAINER_SUPPORTED_FRAMEWORKS.includes(framework)) {
    return {
      useWebContainers: true,
      runtimeType: "webcontainer",
      reason: `${framework} is fully supported in WebContainers for instant preview`,
    };
  }

  return {
    useWebContainers: false,
    runtimeType: "e2b",
    reason: `Framework ${framework} not fully supported in WebContainers`,
  };
}

export function shouldUseWebContainersForPreview(
  framework: Framework,
  expoPreviewMode?: ExpoPreviewMode,
  browserSupportsWebContainers: boolean = true
): boolean {
  const config = selectRuntime(framework, "preview", expoPreviewMode, browserSupportsWebContainers);
  return config.useWebContainers;
}

export function getOptimalRuntimeForTask(
  framework: Framework,
  userPrompt: string,
  expoPreviewMode?: ExpoPreviewMode,
  browserSupportsWebContainers: boolean = true
): RuntimeConfig {
  const lowerPrompt = userPrompt.toLowerCase();

  const nativeBuildIndicators = [
    "build apk",
    "build ipa",
    "eas build",
    "app store",
    "play store",
    "native build",
    "production build",
    "release build",
  ];

  const isNativeBuild = nativeBuildIndicators.some((indicator) =>
    lowerPrompt.includes(indicator)
  );

  if (isNativeBuild) {
    return selectRuntime(framework, "native-build", expoPreviewMode, browserSupportsWebContainers);
  }

  const previewIndicators = [
    "preview",
    "show me",
    "display",
    "render",
    "view",
    "see the",
  ];

  const isPreview = previewIndicators.some((indicator) =>
    lowerPrompt.includes(indicator)
  );

  if (isPreview || framework !== "expo") {
    return selectRuntime(framework, "preview", expoPreviewMode, browserSupportsWebContainers);
  }

  return selectRuntime(framework, "full-dev", expoPreviewMode, browserSupportsWebContainers);
}

export interface RuntimeMetrics {
  runtimeType: RuntimeType;
  framework: Framework;
  taskType: TaskType;
  startTime: number;
  endTime?: number;
  success: boolean;
  errorMessage?: string;
}

export function createRuntimeMetrics(
  runtimeType: RuntimeType,
  framework: Framework,
  taskType: TaskType
): RuntimeMetrics {
  return {
    runtimeType,
    framework,
    taskType,
    startTime: Date.now(),
    success: false,
  };
}

export function completeRuntimeMetrics(
  metrics: RuntimeMetrics,
  success: boolean,
  errorMessage?: string
): RuntimeMetrics {
  return {
    ...metrics,
    endTime: Date.now(),
    success,
    errorMessage,
  };
}
