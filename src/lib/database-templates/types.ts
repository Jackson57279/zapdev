import type { frameworks } from "../frameworks";

export type DatabaseProvider = "none" | "drizzle-neon" | "convex";
export type DatabaseFramework = keyof typeof frameworks;

export interface DatabaseTemplateBundle {
  provider: DatabaseProvider;
  framework: DatabaseFramework;
  description: string;
  files: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  envVars: Record<string, string>;
  setupInstructions: string[];
}
