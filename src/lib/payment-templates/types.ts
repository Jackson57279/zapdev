export type PaymentFramework = "nextjs" | "react" | "vue" | "angular" | "svelte";

export interface PaymentTemplateBundle {
  framework: PaymentFramework;
  description: string;
  files: Record<string, string>;
}
