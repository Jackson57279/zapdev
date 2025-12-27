import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Enum type definitions using unions of literals
export const frameworkEnum = v.union(
  v.literal("NEXTJS"),
  v.literal("ANGULAR"),
  v.literal("REACT"),
  v.literal("VUE"),
  v.literal("SVELTE")
);

export const messageRoleEnum = v.union(
  v.literal("USER"),
  v.literal("ASSISTANT")
);

export const messageTypeEnum = v.union(
  v.literal("RESULT"),
  v.literal("ERROR"),
  v.literal("STREAMING")
);

export const messageStatusEnum = v.union(
  v.literal("PENDING"),
  v.literal("STREAMING"),
  v.literal("COMPLETE")
);

export const attachmentTypeEnum = v.union(
  v.literal("IMAGE"),
  v.literal("FIGMA_FILE"),
  v.literal("GITHUB_REPO")
);

export const importSourceEnum = v.union(
  v.literal("FIGMA"),
  v.literal("GITHUB")
);

export const oauthProviderEnum = v.union(
  v.literal("figma"),
  v.literal("github")
);

export const importStatusEnum = v.union(
  v.literal("PENDING"),
  v.literal("PROCESSING"),
  v.literal("COMPLETE"),
  v.literal("FAILED")
);

export const sandboxStateEnum = v.union(
  v.literal("RUNNING"),
  v.literal("PAUSED"),
  v.literal("KILLED")
);

export const taskStatusEnum = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed")
);

export const taskStageEnum = v.union(
  v.literal("init"),
  v.literal("framework"),
  v.literal("ai"),
  v.literal("start"),
  v.literal("lint"),
  v.literal("build"),
  v.literal("validate"),
  v.literal("complete")
);

export default defineSchema({
  // Projects table
  projects: defineTable({
    name: v.string(),
    userId: v.string(), // Clerk user ID (not v.id - we'll store the Clerk ID directly)
    framework: frameworkEnum,
    modelPreference: v.optional(v.string()), // User's preferred AI model (e.g., "auto", "anthropic/claude-haiku-4.5", "openai/gpt-4o")
    createdAt: v.optional(v.number()), // timestamp
    updatedAt: v.optional(v.number()), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // Messages table
  messages: defineTable({
    content: v.string(),
    role: messageRoleEnum,
    type: messageTypeEnum,
    status: messageStatusEnum,
    projectId: v.id("projects"),
    createdAt: v.optional(v.number()), // timestamp
    updatedAt: v.optional(v.number()), // timestamp
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_createdAt", ["projectId", "createdAt"]),

  // Fragments table - generated code artifacts
  fragments: defineTable({
    messageId: v.id("messages"),
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.string(),
    title: v.string(),
    files: v.any(), // JSON data for file structure
    metadata: v.optional(v.any()), // Optional JSON metadata
    framework: frameworkEnum,
    createdAt: v.optional(v.number()), // timestamp
    updatedAt: v.optional(v.number()), // timestamp
  })
    .index("by_messageId", ["messageId"]),

  // FragmentDrafts table - work-in-progress fragments
  fragmentDrafts: defineTable({
    projectId: v.id("projects"),
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.optional(v.string()),
    files: v.any(), // JSON data for draft files
    framework: frameworkEnum,
    createdAt: v.optional(v.number()), // timestamp
    updatedAt: v.optional(v.number()), // timestamp
  })
    .index("by_projectId", ["projectId"]),

  // Attachments table
  attachments: defineTable({
    type: attachmentTypeEnum,
    url: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    size: v.number(),
    messageId: v.id("messages"),
    importId: v.optional(v.id("imports")), // Link to import record
    sourceMetadata: v.optional(v.any()), // Figma/GitHub specific data
    createdAt: v.optional(v.number()), // timestamp
    updatedAt: v.optional(v.number()), // timestamp
  })
    .index("by_messageId", ["messageId"]),

  // OAuth Connections table - for storing encrypted OAuth tokens
  oauthConnections: defineTable({
    userId: v.string(), // Clerk user ID
    provider: oauthProviderEnum,
    accessToken: v.string(), // Encrypted token
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.string(),
    metadata: v.optional(v.any()), // Provider-specific data (user info, etc)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_provider", ["userId", "provider"]),

  // Imports table - tracking import history and status
  imports: defineTable({
    userId: v.string(), // Clerk user ID
    projectId: v.id("projects"),
    messageId: v.optional(v.id("messages")),
    source: importSourceEnum,
    sourceId: v.string(), // Figma file key or GitHub repo ID
    sourceName: v.string(), // Display name
    sourceUrl: v.string(), // Original URL to Figma/GitHub
    status: importStatusEnum,
    metadata: v.optional(v.any()), // Import-specific data
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"]),

  // Usage table - rate limiting and credit tracking
  usage: defineTable({
    userId: v.string(), // Clerk user ID
    points: v.number(), // Remaining credits
    expire: v.optional(v.number()), // Expiration timestamp
    planType: v.optional(v.union(v.literal("free"), v.literal("pro"))), // Track plan type
  })
    .index("by_userId", ["userId"])
    .index("by_expire", ["expire"]),

  // Rate Limits table - request-based rate limiting
  rateLimits: defineTable({
    key: v.string(), // Rate limit key (e.g., "user_123", "ip_192.168.1.1", "endpoint_/api/auth")
    count: v.number(), // Current request count in this window
    windowStart: v.number(), // Timestamp when the current window started
    limit: v.number(), // Maximum requests allowed in the window
    windowMs: v.number(), // Window duration in milliseconds
  })
    .index("by_key", ["key"])
    .index("by_windowStart", ["windowStart"]),

  // Subscriptions table - Clerk Billing subscription tracking
  subscriptions: defineTable({
    userId: v.string(), // Clerk user ID
    clerkSubscriptionId: v.string(), // Clerk subscription ID
    planId: v.string(), // Clerk plan ID (e.g., "plan_xxxxx")
    planName: v.string(), // Plan name (e.g., "Free", "Pro")
    status: v.union(
      v.literal("incomplete"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("trialing")
    ),
    currentPeriodStart: v.number(), // Timestamp
    currentPeriodEnd: v.number(), // Timestamp
    cancelAtPeriodEnd: v.boolean(), // Scheduled cancellation flag
    features: v.optional(v.array(v.string())), // Array of feature IDs granted by this plan
    metadata: v.optional(v.any()), // Additional metadata from Clerk
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_clerkSubscriptionId", ["clerkSubscriptionId"])
    .index("by_planId", ["planId"])
    .index("by_status", ["status"]),

  // Sandbox Sessions table - E2B sandbox persistence tracking
  sandboxSessions: defineTable({
    sandboxId: v.string(), // E2B sandbox ID
    projectId: v.id("projects"), // Associated project
    userId: v.string(), // Clerk user ID
    framework: frameworkEnum, // Framework for the sandbox
    state: sandboxStateEnum, // RUNNING, PAUSED, or KILLED
    lastActivity: v.number(), // Timestamp of last user activity
    autoPauseTimeout: v.number(), // Inactivity timeout in milliseconds (default: 10 minutes)
    pausedAt: v.optional(v.number()), // Timestamp when sandbox was paused
    createdAt: v.number(), // Timestamp when sandbox was created
    updatedAt: v.number(), // Timestamp of last update
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_state", ["state"])
    .index("by_sandboxId", ["sandboxId"]),

  taskProgress: defineTable({
    taskId: v.string(), // Unique task identifier (not a foreign key reference)
    status: taskStatusEnum,
    stage: taskStageEnum,
    message: v.string(),
    streamedContent: v.optional(v.string()),
    files: v.optional(v.any()), // Record<string, string> - maps file paths to file contents: { [filePath: string]: string }
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_status", ["status"]),
});
