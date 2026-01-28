import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { requireAuth } from "./helpers";
import { skillSourceEnum, frameworkEnum } from "./schema";

// ============================================================================
// Shared return validators
// ============================================================================

const skillReturnValidator = v.object({
  _id: v.id("skills"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  description: v.string(),
  content: v.string(),
  source: skillSourceEnum,
  sourceRepo: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  category: v.optional(v.string()),
  framework: v.optional(frameworkEnum),
  isGlobal: v.boolean(),
  isCore: v.boolean(),
  userId: v.optional(v.string()),
  version: v.optional(v.string()),
  tokenCount: v.optional(v.number()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// PUBLIC QUERIES (require auth)
// ============================================================================

/**
 * List all skills with optional filters.
 * Supports filtering by isGlobal, isCore, category, and framework.
 */
export const list = query({
  args: {
    isGlobal: v.optional(v.boolean()),
    isCore: v.optional(v.boolean()),
    category: v.optional(v.string()),
    framework: v.optional(frameworkEnum),
  },
  returns: v.array(skillReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Determine which index to use based on provided filters
    if (args.isCore !== undefined) {
      const skills = await ctx.db
        .query("skills")
        .withIndex("by_isCore", (q) => q.eq("isCore", args.isCore!))
        .collect();
      return filterSkills(skills, args);
    }

    if (args.isGlobal !== undefined) {
      const skills = await ctx.db
        .query("skills")
        .withIndex("by_isGlobal", (q) => q.eq("isGlobal", args.isGlobal!))
        .collect();
      return filterSkills(skills, args);
    }

    if (args.category !== undefined) {
      const skills = await ctx.db
        .query("skills")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
      return filterSkills(skills, args);
    }

    // No specific filter — return all skills
    const skills = await ctx.db.query("skills").collect();
    return filterSkills(skills, args);
  },
});

/**
 * Helper to apply secondary filters after index-based primary filter.
 * This is a pure function, not a Convex query, so it's fine to use in-memory filtering
 * on already-fetched results.
 */
function filterSkills(
  skills: Array<any>,
  args: {
    isGlobal?: boolean;
    isCore?: boolean;
    category?: string;
    framework?: string;
  }
): Array<any> {
  let result = skills;

  if (args.isGlobal !== undefined) {
    result = result.filter((s) => s.isGlobal === args.isGlobal);
  }
  if (args.isCore !== undefined) {
    result = result.filter((s) => s.isCore === args.isCore);
  }
  if (args.category !== undefined) {
    result = result.filter((s) => s.category === args.category);
  }
  if (args.framework !== undefined) {
    result = result.filter((s) => s.framework === args.framework);
  }

  return result;
}

/**
 * Get a single skill by its slug.
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(skillReturnValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const skill = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return skill;
  },
});

/**
 * Get all skills in a given category.
 */
export const getByCategory = query({
  args: {
    category: v.string(),
  },
  returns: v.array(skillReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const skills = await ctx.db
      .query("skills")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();

    return skills;
  },
});

/**
 * Get all core skills (isCore: true).
 */
export const getCoreSkills = query({
  args: {},
  returns: v.array(skillReturnValidator),
  handler: async (ctx) => {
    await requireAuth(ctx);

    const skills = await ctx.db
      .query("skills")
      .withIndex("by_isCore", (q) => q.eq("isCore", true))
      .collect();

    return skills;
  },
});

/**
 * Search skills by name or description.
 * Uses the by_name index for prefix matching on name,
 * then does in-memory description matching on the result set.
 */
export const search = query({
  args: {
    query: v.string(),
  },
  returns: v.array(skillReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const searchTerm = args.query.toLowerCase();

    // Fetch all skills and search in-memory since Convex doesn't have
    // full-text search on this table (no search index defined).
    // For a small skill catalog this is acceptable.
    const allSkills = await ctx.db.query("skills").collect();

    const matched = allSkills.filter((skill) => {
      const nameMatch = skill.name.toLowerCase().includes(searchTerm);
      const descMatch = skill.description.toLowerCase().includes(searchTerm);
      return nameMatch || descMatch;
    });

    return matched;
  },
});

// ============================================================================
// PUBLIC MUTATIONS (require auth)
// ============================================================================

/**
 * Create a new user skill.
 * Users can only create non-global, non-core skills.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    source: skillSourceEnum,
    sourceRepo: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    framework: v.optional(frameworkEnum),
    version: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Check for duplicate slug
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error(`A skill with slug "${args.slug}" already exists`);
    }

    const now = Date.now();

    const skillId = await ctx.db.insert("skills", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      content: args.content,
      source: args.source,
      sourceRepo: args.sourceRepo,
      sourceUrl: args.sourceUrl,
      category: args.category,
      framework: args.framework,
      // User-created skills are never global or core
      isGlobal: false,
      isCore: false,
      userId,
      version: args.version,
      tokenCount: args.tokenCount,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return skillId;
  },
});

/**
 * Update an existing skill.
 * Users can only update skills they own. Global skills they don't own cannot be modified.
 */
export const update = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    source: v.optional(skillSourceEnum),
    sourceRepo: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    framework: v.optional(frameworkEnum),
    version: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    // Prevent users from modifying global skills they don't own
    if (skill.isGlobal && skill.userId !== userId) {
      throw new Error("Cannot modify a global skill you do not own");
    }

    // Prevent users from modifying other users' skills
    if (skill.userId && skill.userId !== userId) {
      throw new Error("Cannot modify a skill you do not own");
    }

    // If slug is being changed, check for duplicates
    if (args.slug && args.slug !== skill.slug) {
      const existing = await ctx.db
        .query("skills")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
        .first();

      if (existing) {
        throw new Error(`A skill with slug "${args.slug}" already exists`);
      }
    }

    const now = Date.now();

    await ctx.db.patch(args.skillId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.slug !== undefined && { slug: args.slug }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.content !== undefined && { content: args.content }),
      ...(args.source !== undefined && { source: args.source }),
      ...(args.sourceRepo !== undefined && { sourceRepo: args.sourceRepo }),
      ...(args.sourceUrl !== undefined && { sourceUrl: args.sourceUrl }),
      ...(args.category !== undefined && { category: args.category }),
      ...(args.framework !== undefined && { framework: args.framework }),
      ...(args.version !== undefined && { version: args.version }),
      ...(args.tokenCount !== undefined && { tokenCount: args.tokenCount }),
      ...(args.metadata !== undefined && { metadata: args.metadata }),
      updatedAt: now,
    });

    return args.skillId;
  },
});

/**
 * Delete a skill.
 * Core skills cannot be deleted. Only the owner can delete their skills.
 */
export const remove = mutation({
  args: {
    skillId: v.id("skills"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    // Prevent deletion of core skills
    if (skill.isCore) {
      throw new Error("Cannot delete a core skill");
    }

    // Prevent users from deleting global skills they don't own
    if (skill.isGlobal && skill.userId !== userId) {
      throw new Error("Cannot delete a global skill you do not own");
    }

    // Prevent users from deleting other users' skills
    if (skill.userId && skill.userId !== userId) {
      throw new Error("Cannot delete a skill you do not own");
    }

    // Delete any skill installations referencing this skill
    const installations = await ctx.db
      .query("skillInstallations")
      .withIndex("by_skillId_userId", (q) => q.eq("skillId", args.skillId))
      .collect();

    for (const installation of installations) {
      await ctx.db.delete(installation._id);
    }

    await ctx.db.delete(args.skillId);

    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES (no auth — for agent/system use)
// ============================================================================

/**
 * Get a skill by ID for agent/system use. No auth required.
 */
export const getForSystem = internalQuery({
  args: {
    skillId: v.id("skills"),
  },
  returns: v.union(skillReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    return skill;
  },
});

/**
 * Get all core skill content strings for prompt injection.
 * Returns an array of objects with name and content for each core skill.
 */
export const getCoreSkillContents = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      slug: v.string(),
      content: v.string(),
    })
  ),
  handler: async (ctx) => {
    const coreSkills = await ctx.db
      .query("skills")
      .withIndex("by_isCore", (q) => q.eq("isCore", true))
      .collect();

    return coreSkills.map((skill) => ({
      name: skill.name,
      slug: skill.slug,
      content: skill.content,
    }));
  },
});

// ============================================================================
// INTERNAL MUTATIONS (no auth — for system/seeding use)
// ============================================================================

/**
 * Upsert a skill from GitHub scraping.
 * If a skill with the same slug exists, update it. Otherwise, create it.
 * Only updates global skills (won't overwrite user-created skills).
 */
export const upsertFromGithub = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    source: skillSourceEnum,
    sourceRepo: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    framework: v.optional(frameworkEnum),
    isGlobal: v.boolean(),
    isCore: v.boolean(),
    version: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    const now = Date.now();

    if (existing) {
      // Only update if it's a global skill (don't overwrite user-created skills)
      if (!existing.isGlobal && existing.userId) {
        throw new Error(
          `Cannot overwrite user-created skill with slug "${args.slug}"`
        );
      }

      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        content: args.content,
        source: args.source,
        sourceRepo: args.sourceRepo,
        sourceUrl: args.sourceUrl,
        category: args.category,
        framework: args.framework,
        isGlobal: args.isGlobal,
        isCore: args.isCore,
        version: args.version,
        tokenCount: args.tokenCount,
        metadata: args.metadata,
        updatedAt: now,
      });

      return existing._id;
    }

    // Create new skill
    const skillId = await ctx.db.insert("skills", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      content: args.content,
      source: args.source,
      sourceRepo: args.sourceRepo,
      sourceUrl: args.sourceUrl,
      category: args.category,
      framework: args.framework,
      isGlobal: args.isGlobal,
      isCore: args.isCore,
      userId: undefined,
      version: args.version,
      tokenCount: args.tokenCount,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return skillId;
  },
});

/**
 * Seed core skills (context7, frontend-design).
 * Idempotent — safe to call multiple times.
 */
export const seedCoreSkills = internalMutation({
  args: {
    skills: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        description: v.string(),
        content: v.string(),
        source: skillSourceEnum,
        sourceRepo: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
  },
  returns: v.array(v.id("skills")),
  handler: async (ctx, args) => {
    const ids: Array<string> = [];
    const now = Date.now();

    for (const skillData of args.skills) {
      const existing = await ctx.db
        .query("skills")
        .withIndex("by_slug", (q) => q.eq("slug", skillData.slug))
        .first();

      if (existing) {
        // Update existing core skill
        await ctx.db.patch(existing._id, {
          name: skillData.name,
          description: skillData.description,
          content: skillData.content,
          source: skillData.source,
          sourceRepo: skillData.sourceRepo,
          sourceUrl: skillData.sourceUrl,
          category: skillData.category,
          isGlobal: true,
          isCore: true,
          updatedAt: now,
        });
        ids.push(existing._id);
      } else {
        // Create new core skill
        const skillId = await ctx.db.insert("skills", {
          name: skillData.name,
          slug: skillData.slug,
          description: skillData.description,
          content: skillData.content,
          source: skillData.source,
          sourceRepo: skillData.sourceRepo,
          sourceUrl: skillData.sourceUrl,
          category: skillData.category,
          framework: undefined,
          isGlobal: true,
          isCore: true,
          userId: undefined,
          version: undefined,
          tokenCount: undefined,
          metadata: undefined,
          createdAt: now,
          updatedAt: now,
        });
        ids.push(skillId);
      }
    }

    return ids as any;
  },
});

/**
 * Get installed skill contents for a project/user.
 * Returns name, slug, and content for each active installed skill.
 */
export const getInstalledSkillContents = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      slug: v.string(),
      content: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Find active installations for this user (optionally scoped to project)
    let installations;
    if (args.projectId) {
      installations = await ctx.db
        .query("skillInstallations")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect();
      // Filter to active installations for this user
      installations = installations.filter(
        (i) => i.isActive && i.userId === args.userId
      );
    } else {
      installations = await ctx.db
        .query("skillInstallations")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      installations = installations.filter((i) => i.isActive);
    }

    const results: Array<{ name: string; slug: string; content: string }> = [];
    for (const installation of installations) {
      const skill = await ctx.db.get(installation.skillId);
      if (skill) {
        results.push({
          name: skill.name,
          slug: skill.slug,
          content: skill.content,
        });
      }
    }

    return results;
  },
});
