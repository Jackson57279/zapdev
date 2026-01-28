import { ConvexHttpClient } from "convex/browser";
import { internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cache } from "@/lib/cache";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Convex client — lazy singleton via proxy (matches code-agent.ts pattern)
// ---------------------------------------------------------------------------

let convexClient: ConvexHttpClient | null = null;
function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

const convex = new Proxy({} as ConvexHttpClient, {
  get(_target, prop) {
    return getConvexClient()[prop as keyof ConvexHttpClient];
  },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKILL_CACHE_TTL_30_MINUTES = 1000 * 60 * 30;
const MAX_TOKENS_PER_SKILL = 4000;
const MAX_TOKENS_TOTAL = 12000;

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

// ---------------------------------------------------------------------------
// Truncation helpers
// ---------------------------------------------------------------------------

/** Truncate content to fit within a token budget (character-level cut). */
function truncateToTokenBudget(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n...[truncated]";
}

// ---------------------------------------------------------------------------
// Skill content type
// ---------------------------------------------------------------------------

interface SkillContent {
  name: string;
  slug: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Static fallback — baked-in core skill content
// ---------------------------------------------------------------------------

/**
 * Core skill definitions with their static file paths.
 * These are manually refreshed and serve as a fallback when Convex is
 * unreachable or the skills table hasn't been seeded yet.
 */
const CORE_SKILL_STATIC_FILES: Array<{
  name: string;
  slug: string;
  filename: string;
}> = [
  { name: "context7", slug: "context7", filename: "context7.md" },
  {
    name: "frontend-design",
    slug: "frontend-design",
    filename: "frontend-design.md",
  },
];

/**
 * Load core skill content from static markdown files baked into the source.
 * Used as a fallback when Convex is unavailable or returns no core skills.
 */
export function loadStaticCoreSkills(): SkillContent[] {
  const skills: SkillContent[] = [];

  for (const def of CORE_SKILL_STATIC_FILES) {
    try {
      const filePath = join(
        process.cwd(),
        "src",
        "data",
        "core-skills",
        def.filename,
      );
      const content = readFileSync(filePath, "utf-8");
      if (content.trim().length > 0) {
        skills.push({
          name: def.name,
          slug: def.slug,
          content,
        });
      }
    } catch {
      // Static file missing or unreadable — skip silently
    }
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Load skill content for agent prompt injection.
 *
 * 1. Always loads core skills (context7, frontend-design, etc.)
 *    - Primary: Convex (getCoreSkillContents)
 *    - Fallback: Static markdown files in src/data/core-skills/
 * 2. Loads project-installed skills when available
 * 3. Enforces per-skill (4 000 token) and total (12 000 token) budgets
 * 4. Caches results for 30 minutes
 * 5. Returns empty string on any failure (graceful fallback)
 */
export async function loadSkillsForAgent(
  projectId: string,
  userId: string,
): Promise<string> {
  const cacheKey = `skills:${projectId}:${userId}`;

  try {
    return await cache.getOrCompute(
      cacheKey,
      async () => {
        // 1. Fetch core skills — Convex primary, static fallback
        let coreSkills: SkillContent[] = [];
        try {
          coreSkills = await convex.query(
            internal.skills.getCoreSkillContents,
            {},
          );
        } catch {
          // Convex unavailable — will fall through to static fallback
        }

        // Fallback: if Convex returned nothing, load from static files
        if (coreSkills.length === 0) {
          coreSkills = loadStaticCoreSkills();
        }

        // 2. Fetch project-installed skills (if any)
        let installedSkills: SkillContent[] = [];
        try {
          installedSkills = await convex.query(
            internal.skills.getInstalledSkillContents,
            {
              projectId: projectId as Id<"projects">,
              userId,
            },
          );
        } catch {
          // Installed skills are optional — don't fail the whole load
        }

        // 3. Deduplicate: installed skills that are already core get skipped
        const coreSlugs = new Set(coreSkills.map((s) => s.slug));
        const uniqueInstalled = installedSkills.filter(
          (s) => !coreSlugs.has(s.slug),
        );

        // 4. Merge: core first, then installed
        const allSkills = [...coreSkills, ...uniqueInstalled];

        if (allSkills.length === 0) return "";

        // 5. Apply token budgets
        let totalTokens = 0;
        const sections: string[] = [];

        for (const skill of allSkills) {
          // Truncate individual skill
          const truncated = truncateToTokenBudget(
            skill.content,
            MAX_TOKENS_PER_SKILL,
          );
          const tokens = estimateTokens(truncated);

          // Check total budget
          if (totalTokens + tokens > MAX_TOKENS_TOTAL) {
            // Include a partial section if there's room
            const remaining = MAX_TOKENS_TOTAL - totalTokens;
            if (remaining > 200) {
              const partial = truncateToTokenBudget(
                skill.content,
                remaining,
              );
              sections.push(`## Skill: ${skill.name}\n${partial}\n---`);
            }
            break;
          }

          sections.push(`## Skill: ${skill.name}\n${truncated}\n---`);
          totalTokens += tokens;
        }

        return sections.join("\n\n");
      },
      SKILL_CACHE_TTL_30_MINUTES,
    );
  } catch {
    // Graceful fallback — never break agent generation
    return "";
  }
}
