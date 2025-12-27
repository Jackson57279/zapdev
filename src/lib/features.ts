/**
 * Pro Features Configuration
 * Features available exclusively to Pro subscribers
 */

export const PRO_FEATURES = {
  imageGeneration: {
    name: "Flux Kontext Pro",
    description: "Advanced AI image generation with context awareness",
    model: "bfl/flux-kontext-pro",
    isProOnly: true,
    icon: "🎨",
  },
  // Future features can be added here
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;
