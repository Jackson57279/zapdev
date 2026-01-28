#!/usr/bin/env bun
/**
 * Skill Seeding Script
 *
 * Seeds core skills (context7, frontend-design) and PrebuiltUI components
 * into Convex. Fetches skill content from GitHub at seed time — does NOT
 * hardcode content in source.
 *
 * Usage:
 *   bun run scripts/seed-skills.ts
 *
 * Required Environment Variables:
 *   - NEXT_PUBLIC_CONVEX_URL  — Convex deployment URL
 *   - CONVEX_DEPLOY_KEY       — Admin deploy key (for calling internal mutations)
 *
 * Idempotent: safe to run multiple times. Uses upsert by slug.
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  parseSkillYaml,
  slugifySkillName,
  estimateTokenCount,
} from "../src/lib/skill-yaml-parser";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CORE_SKILLS = [
  {
    url: "https://raw.githubusercontent.com/intellectronica/agent-skills/main/skills/context7/SKILL.md",
    sourceRepo: "intellectronica/agent-skills",
    category: "documentation",
    fallbackName: "context7",
    fallbackDescription:
      "Retrieve up-to-date documentation for software libraries via the Context7 API",
  },
  {
    url: "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md",
    sourceRepo: "anthropics/skills",
    category: "design",
    fallbackName: "frontend-design",
    fallbackDescription:
      "Create distinctive, production-grade frontend interfaces with high design quality",
  },
] as const;

const PREBUILTUI_DATA_PATH = join(
  import.meta.dir,
  "..",
  "src",
  "data",
  "prebuiltui-components.json"
);

// ---------------------------------------------------------------------------
// Convex Client Setup
// ---------------------------------------------------------------------------

function createConvexClient(): ConvexHttpClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set");
    process.exit(1);
  }

  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (!deployKey) {
    console.error("❌ CONVEX_DEPLOY_KEY is not set (required for internal mutations)");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAdminAuth(deployKey);
  return client;
}

// ---------------------------------------------------------------------------
// Fetch Skill from GitHub
// ---------------------------------------------------------------------------

async function fetchSkillFromGitHub(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch skill from ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

// ---------------------------------------------------------------------------
// Seed Core Skills
// ---------------------------------------------------------------------------

async function seedCoreSkills(client: ConvexHttpClient): Promise<void> {
  console.log("\n📚 Seeding core skills...\n");

  for (const skillConfig of CORE_SKILLS) {
    try {
      console.log(`  ⏳ Fetching ${skillConfig.fallbackName} from GitHub...`);
      const rawContent = await fetchSkillFromGitHub(skillConfig.url);

      let name: string;
      let description: string;
      let content: string;

      try {
        const parsed = parseSkillYaml(rawContent);
        name = parsed.name;
        description = parsed.description;
        content = parsed.content;
      } catch {
        // If parsing fails (e.g., no frontmatter), use the raw content
        // with fallback metadata
        console.log(
          `    ⚠️  Could not parse YAML frontmatter, using fallback metadata`
        );
        name = skillConfig.fallbackName;
        description = skillConfig.fallbackDescription;
        content = rawContent.trim();
      }

      const slug = slugifySkillName(name);
      const tokenCount = estimateTokenCount(content);

      console.log(`  📝 Upserting "${name}" (slug: ${slug}, ~${tokenCount} tokens)...`);

      const skillId = await client.mutation(internal.skills.upsertFromGithub, {
        name,
        slug,
        description,
        content,
        source: "github",
        sourceRepo: skillConfig.sourceRepo,
        sourceUrl: skillConfig.url,
        category: skillConfig.category,
        isGlobal: true,
        isCore: true,
        tokenCount,
      });

      console.log(`  ✅ ${name} seeded (ID: ${skillId})`);
    } catch (error) {
      console.error(
        `  ❌ Failed to seed ${skillConfig.fallbackName}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Seed PrebuiltUI Components
// ---------------------------------------------------------------------------

interface PrebuiltUIComponent {
  name: string;
  description: string;
  content: string;
  source: "prebuiltui";
  category: string;
  framework: null;
  isGlobal: true;
  isCore: false;
  metadata: {
    htmlCode: string | null;
    vueCode: string | null;
    previewUrl: string | null;
    originalSlug: string;
  };
}

async function seedPrebuiltUIComponents(
  client: ConvexHttpClient
): Promise<void> {
  console.log("\n🎨 Seeding PrebuiltUI components...\n");

  let components: PrebuiltUIComponent[];
  try {
    const raw = await readFile(PREBUILTUI_DATA_PATH, "utf-8");
    components = JSON.parse(raw) as PrebuiltUIComponent[];
  } catch (error) {
    console.error(
      "  ❌ Could not load PrebuiltUI data from",
      PREBUILTUI_DATA_PATH
    );
    console.error(
      "     Run `bun run scripts/scrape-prebuiltui.ts` first to generate the data."
    );
    console.error(
      "     Error:",
      error instanceof Error ? error.message : error
    );
    return;
  }

  console.log(`  Found ${components.length} PrebuiltUI components\n`);

  let seeded = 0;
  let failed = 0;

  for (const component of components) {
    try {
      const slug = slugifySkillName(component.name);
      const tokenCount = estimateTokenCount(component.content);

      await client.mutation(internal.skills.upsertFromGithub, {
        name: component.name,
        slug,
        description: component.description,
        content: component.content,
        source: "prebuiltui",
        category: component.category,
        isGlobal: true,
        isCore: false,
        tokenCount,
        metadata: component.metadata,
      });

      seeded++;
    } catch (error) {
      failed++;
      console.error(
        `  ❌ Failed to seed "${component.name}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(
    `  ✅ PrebuiltUI: ${seeded} seeded, ${failed} failed out of ${components.length} total`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("🚀 ZapDev Skill Seeding Script");
  console.log("═".repeat(50));

  const client = createConvexClient();

  await seedCoreSkills(client);
  await seedPrebuiltUIComponents(client);

  console.log("\n" + "═".repeat(50));
  console.log("✨ Skill seeding complete!");
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
