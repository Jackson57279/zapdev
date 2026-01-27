/**
 * Skill YAML Parser
 *
 * Parses skill.yaml / SKILL.md files that use the skills.sh format:
 *
 * ```
 * ---
 * name: my-skill
 * description: What this skill does
 * ---
 * # Skill Instructions
 * Markdown body with agent instructions...
 * ```
 *
 * Uses `gray-matter` to extract YAML frontmatter and markdown body.
 */

import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedSkill {
  /** Skill name from frontmatter (e.g., "frontend-design") */
  name: string;
  /** Skill description from frontmatter */
  description: string;
  /** Markdown body containing the actual skill instructions */
  content: string;
  /** Any additional frontmatter fields (license, version, etc.) */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a skill.yaml / SKILL.md file content into structured data.
 *
 * Expects YAML frontmatter delimited by `---` with at least `name` and
 * `description` fields, followed by a markdown body.
 *
 * @param rawContent - The raw file content (YAML frontmatter + markdown body)
 * @returns Parsed skill with name, description, content, and metadata
 * @throws Error if required frontmatter fields are missing
 *
 * @example
 * ```ts
 * const skill = parseSkillYaml(`---
 * name: my-skill
 * description: Does cool things
 * ---
 * # Instructions
 * Do the cool thing.
 * `);
 *
 * console.log(skill.name);        // "my-skill"
 * console.log(skill.description); // "Does cool things"
 * console.log(skill.content);     // "# Instructions\nDo the cool thing.\n"
 * ```
 */
export function parseSkillYaml(rawContent: string): ParsedSkill {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("Skill content must be a non-empty string");
  }

  const { data: frontmatter, content } = matter(rawContent);

  // Validate required fields
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    throw new Error(
      'Skill YAML must include a "name" field in frontmatter'
    );
  }

  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    throw new Error(
      'Skill YAML must include a "description" field in frontmatter'
    );
  }

  // Extract known fields, put the rest into metadata
  const { name, description, ...rest } = frontmatter;

  return {
    name: name as string,
    description: description as string,
    content: content.trim(),
    metadata: rest,
  };
}

/**
 * Slugify a skill name for use as a URL-safe identifier.
 *
 * @param name - The skill name (e.g., "Frontend Design")
 * @returns URL-safe slug (e.g., "frontend-design")
 */
export function slugifySkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Estimate the token count for a piece of text.
 * Uses the rough heuristic of ~4 characters per token.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
