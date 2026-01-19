import { frameworks } from "../frameworks";

export type PaymentFramework = keyof typeof frameworks;

export interface PaymentTemplateBundle {
  framework: PaymentFramework;
  description: string;
  files: Record<string, string>;
}
