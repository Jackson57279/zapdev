import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { z } from 'zod';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

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

export const sandboxRouter = createTRPCRouter({
  /**
   * Update sandbox activity timestamp
   * Called when user interacts with the sandbox
   * Auto-resumes paused sandbox when activity is detected
   */
  updateActivity: protectedProcedure
    .input(z.object({
      sandboxId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const session = await convex.mutation(api.sandboxSessions.updateLastActivityBySandboxId, {
          sandboxId: input.sandboxId,
        });

        console.log(`[DEBUG] Updated activity for sandbox ${input.sandboxId}`);

        return {
          success: true,
          session,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to update sandbox activity: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }),

  /**
   * Get sandbox session info
   */
  getSession: protectedProcedure
    .input(z.object({
      sandboxId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const session = await convex.query(api.sandboxSessions.getBySandboxId, {
          sandboxId: input.sandboxId,
        });

        return {
          success: true,
          session,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to fetch sandbox session: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }),

  /**
   * Get all sandbox sessions for a project
   */
  getProjectSessions: protectedProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const sessions = await convex.query(api.sandboxSessions.getByProjectId, {
          projectId: input.projectId as Id<"projects">,
        });

        return {
          success: true,
          sessions,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to fetch project sandbox sessions: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }),

  /**
   * Get all sandbox sessions for the current user
   */
  getUserSessions: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const sessions = await convex.query(api.sandboxSessions.getByUserId, {
          userId: ctx.user.id,
        });

        return {
          success: true,
          sessions,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to fetch user sandbox sessions: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }),
});
