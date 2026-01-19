import { drizzleNeonNextjsTemplate } from "./drizzle-neon/nextjs";
import { convexNextjsTemplate } from "./convex/nextjs";
import { databaseEnvExamples } from "./env-example";
import type {
  DatabaseProvider,
  DatabaseFramework,
  DatabaseTemplateBundle,
} from "./types";

export type { DatabaseProvider, DatabaseFramework, DatabaseTemplateBundle };
export { databaseEnvExamples };

type TemplateKey = `${DatabaseProvider}-${DatabaseFramework}`;

const templates: Partial<Record<TemplateKey, DatabaseTemplateBundle>> = {
  "drizzle-neon-nextjs": drizzleNeonNextjsTemplate,
  "convex-nextjs": convexNextjsTemplate,
};

export function getDatabaseTemplate(
  provider: Exclude<DatabaseProvider, "none">,
  framework: DatabaseFramework
): DatabaseTemplateBundle | null {
  const key: TemplateKey = `${provider}-${framework}`;
  return templates[key] ?? null;
}

export function getSupportedDatabaseFrameworks(
  provider: Exclude<DatabaseProvider, "none">
): DatabaseFramework[] {
  const supported: DatabaseFramework[] = [];
  const frameworks: DatabaseFramework[] = [
    "nextjs",
    "react",
    "vue",
    "angular",
    "svelte",
  ];

  for (const framework of frameworks) {
    const key: TemplateKey = `${provider}-${framework}`;
    if (templates[key]) {
      supported.push(framework);
    }
  }

  return supported;
}

export function isDatabaseSupported(
  provider: Exclude<DatabaseProvider, "none">,
  framework: DatabaseFramework
): boolean {
  const key: TemplateKey = `${provider}-${framework}`;
  return key in templates;
}
