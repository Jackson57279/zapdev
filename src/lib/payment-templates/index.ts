import { angularPaymentTemplate } from "./angular";
import { nextjsPaymentTemplate } from "./nextjs";
import { reactPaymentTemplate } from "./react";
import { sveltePaymentTemplate } from "./svelte";
import { vuePaymentTemplate } from "./vue";
import type { PaymentFramework, PaymentTemplateBundle } from "./types";
import { autumnConfigTemplate } from "./autumn-config";
import { paymentEnvExample } from "./env-example";

const templates: Record<PaymentFramework, PaymentTemplateBundle> = {
  nextjs: nextjsPaymentTemplate,
  react: reactPaymentTemplate,
  vue: vuePaymentTemplate,
  angular: angularPaymentTemplate,
  svelte: sveltePaymentTemplate,
};

export const paymentTemplates = templates;
export { autumnConfigTemplate, paymentEnvExample };
export type { PaymentFramework, PaymentTemplateBundle };

export const getPaymentTemplate = (
  framework: PaymentFramework
): PaymentTemplateBundle => templates[framework];
