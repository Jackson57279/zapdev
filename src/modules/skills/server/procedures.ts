import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { z } from 'zod';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

// Get Convex client lazily
let convexClient: ConvexHttpClient | null = null;
function getConvexClient() {
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
  }
});

// Shared Zod enums matching Convex schema
const frameworkValues = ["NEXTJS", "ANGULAR", "REACT", "VUE", "SVELTE"] as const;
const skillSourceValues = ["github", "prebuiltui", "custom"] as const;

export const skillsRouter = createTRPCRouter({
  /**
   * List skills with optional filters.
   */
  list: protectedProcedure
    .input(z.object({
      isGlobal: z.boolean().optional(),
      isCore: z.boolean().optional(),
      category: z.string().optional(),
      framework: z.enum(frameworkValues).optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const skills = await convex.query(api.skills.list, {
          isGlobal: input?.isGlobal,
          isCore: input?.isCore,
          category: input?.category,
          framework: input?.framework,
        });

        return { success: true, skills };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to list skills: ${errorMessage}`);
        return { success: false, error: errorMessage, skills: [] };
      }
    }),

  /**
   * Get a single skill by its slug.
   */
  getBySlug: protectedProcedure
    .input(z.object({
      slug: z.string().min(1),
    }))
    .query(async ({ input }) => {
      try {
        const skill = await convex.query(api.skills.getBySlug, {
          slug: input.slug,
        });

        return { success: true, skill };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to get skill by slug: ${errorMessage}`);
        return { success: false, error: errorMessage, skill: null };
      }
    }),

  /**
   * Search skills by name or description.
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
    }))
    .query(async ({ input }) => {
      try {
        const skills = await convex.query(api.skills.search, {
          query: input.query,
        });

        return { success: true, skills };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to search skills: ${errorMessage}`);
        return { success: false, error: errorMessage, skills: [] };
      }
    }),

  /**
   * Get unique categories derived from the skills list.
   */
  getCategories: protectedProcedure
    .query(async () => {
      try {
        const skills = await convex.query(api.skills.list, {});

        const categories = [
          ...new Set(
            skills
              .map((s: { category?: string }) => s.category)
              .filter((c): c is string => c !== undefined && c !== null)
          ),
        ];

        return { success: true, categories };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to get categories: ${errorMessage}`);
        return { success: false, error: errorMessage, categories: [] };
      }
    }),

  /**
   * Create a new user skill.
   * Users cannot create core skills via the API.
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().min(1),
      content: z.string().min(1),
      source: z.enum(skillSourceValues),
      sourceRepo: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      category: z.string().optional(),
      framework: z.enum(frameworkValues).optional(),
      version: z.string().optional(),
      tokenCount: z.number().int().positive().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const skillId = await convex.mutation(api.skills.create, {
          name: input.name,
          slug: input.slug,
          description: input.description,
          content: input.content,
          source: input.source,
          sourceRepo: input.sourceRepo,
          sourceUrl: input.sourceUrl,
          category: input.category,
          framework: input.framework,
          version: input.version,
          tokenCount: input.tokenCount,
          metadata: input.metadata,
        });

        return { success: true, skillId };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to create skill: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    }),

  /**
   * Update an existing skill.
   */
  update: protectedProcedure
    .input(z.object({
      skillId: z.string().min(1),
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      source: z.enum(skillSourceValues).optional(),
      sourceRepo: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      category: z.string().optional(),
      framework: z.enum(frameworkValues).optional(),
      version: z.string().optional(),
      tokenCount: z.number().int().positive().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { skillId, ...updates } = input;
        const result = await convex.mutation(api.skills.update, {
          skillId: skillId as any,
          ...updates,
        });

        return { success: true, skillId: result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to update skill: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    }),

  /**
   * Delete a skill.
   */
  remove: protectedProcedure
    .input(z.object({
      skillId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        await convex.mutation(api.skills.remove, {
          skillId: input.skillId as any,
        });

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to delete skill: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    }),
});
