import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// Update spec content and status
export const updateSpec = mutation({
  args: {
    messageId: v.id("messages"),
    specContent: v.string(),
    status: v.union(
      v.literal("PLANNING"),
      v.literal("AWAITING_APPROVAL"),
      v.literal("APPROVED"),
      v.literal("REJECTED")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Get the message to verify ownership
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Get project to verify user owns it
    const project = await ctx.db.get(message.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Update the message with spec data
    await ctx.db.patch(args.messageId, {
      specContent: args.specContent,
      specMode: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Approve a spec and trigger code generation
export const approveSpec = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify specMode is AWAITING_APPROVAL
    if (message.specMode !== "AWAITING_APPROVAL") {
      throw new Error("Spec is not awaiting approval");
    }

    // Get project to verify user owns it
    const project = await ctx.db.get(message.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Update message status to APPROVED
    await ctx.db.patch(args.messageId, {
      specMode: "APPROVED",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      projectId: message.projectId,
      messageContent: message.content,
      specContent: message.specContent,
      selectedModel: message.selectedModel,
    };
  },
});

// Reject a spec and provide feedback for revision
export const rejectSpec = mutation({
  args: {
    messageId: v.id("messages"),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify specMode is AWAITING_APPROVAL
    if (message.specMode !== "AWAITING_APPROVAL") {
      throw new Error("Spec is not awaiting approval");
    }

    // Get project to verify user owns it
    const project = await ctx.db.get(message.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Update message status to REJECTED
    await ctx.db.patch(args.messageId, {
      specMode: "REJECTED",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      projectId: message.projectId,
      messageContent: message.content,
      specContent: message.specContent,
      feedback: args.feedback,
      selectedModel: message.selectedModel,
    };
  },
});

// Get spec for a message
export const getSpec = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Get project to verify user owns it
    const project = await ctx.db.get(message.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return {
      specMode: message.specMode,
      specContent: message.specContent,
      selectedModel: message.selectedModel,
    };
  },
});
