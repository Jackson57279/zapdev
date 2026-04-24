# ZapDev Convex Rules - Quick Reference Guide

This guide helps you navigate and use the rewritten `.cursor/rules/convex_rules.mdc` file for ZapDev development.

## 📋 File Location & Usage

**File**: `.cursor/rules/convex_rules.mdc`  
**Applies to**: All files matching `convex/**/*.ts`  
**Used by**: Cursor IDE for code completion, analysis, and suggestions

## 🎯 Key Sections

### 1. ZapDev Project Context (START HERE)
**Location**: Lines 8-23  
**Content**: Overview of ZapDev architecture and data model

**Key takeaways**:
- ZapDev is an AI-powered code generation platform
- 8 core database tables store everything from projects to rate limits
- Uses Clerk JWT authentication
- All user-scoped operations require `requireAuth(ctx)`

### 2. Authentication & Authorization
**Location**: Lines 42-65  
**Content**: How to implement secure user access patterns

**Critical patterns**:
```typescript
// Always get the user ID first
const userId = await requireAuth(ctx);

// Always verify resource ownership
const project = await ctx.db.get(args.projectId);
if (!project || project.userId !== userId) {
  throw new Error("Unauthorized");
}
```

### 3. Schema & Enum Guidelines
**Location**: Lines 244-281  
**Content**: All database tables, enums, and indexing patterns

**What you need**:
- **8 Enums**: framework, messageRole, messageType, messageStatus, attachmentType, importSource, oauthProvider, importStatus
- **8 Tables**: projects, messages, fragments, attachments, oauthConnections, imports, usage, rateLimits
- **Index patterns**: `by_userId`, `by_projectId`, composite indexes

### 4. Mutation Patterns
**Location**: Lines 333-372  
**Content**: How to create and update database records

**Standard patterns**:
- **Message creation**: Include all role/type/status/timestamp fields
- **Project updates**: Always set `updatedAt: Date.now()`
- **Credit checks**: Call `api.usage.getUsageForUser` before consuming credits

### 5. Action Patterns
**Location**: Lines 374-436  
**Content**: Long-running operations (AI, OAuth, external APIs)

**When to use actions**:
- AI code generation
- OAuth flows (Figma, GitHub)
- External API calls
- Rate limiting checks

### 6. ZapDev Code Examples
**Location**: Lines 512-640  
**Content**: Real, copy-paste-ready code snippets

**Available examples**:
1. Creating a project
2. Querying user projects
3. Saving code fragments
4. Checking user credits
5. Rate limiting implementation

## 🔍 How to Find What You Need

| I need to... | Look in section... | Line range |
|--------------|-------------------|-----------|
| Understand ZapDev architecture | ZapDev Project Context | 8-23 |
| Authenticate a user | ZapDev Authentication Pattern | 42-54 |
| Check authorization | ZapDev Authorization Pattern | 56-65 |
| Find all enum types | Enums in ZapDev | 246-255 |
| Understand table structure | ZapDev Table Structure | 258-267 |
| Create a message | ZapDev Mutation Patterns | 335-347 |
| Write an action | ZapDev Action Patterns | 374-428 |
| See real examples | Common ZapDev Operations | 512-640 |

## 🛠️ Common Tasks

### Creating a New Query
```typescript
// Always check authentication
const userId = await getCurrentUserClerkId(ctx);

// Use indexes for efficient queries
return await ctx.db
  .query("messages")
  .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
  .order("desc")
  .collect();
```

### Creating a New Mutation
```typescript
// Get authenticated user
const userId = await requireAuth(ctx);

// Verify ownership
const project = await ctx.db.get(args.projectId);
if (!project || project.userId !== userId) {
  throw new Error("Unauthorized");
}

// Insert with timestamps
const now = Date.now();
return await ctx.db.insert("tableName", {
  // ... fields ...
  createdAt: now,
  updatedAt: now,
});
```

### Creating a New Action
```typescript
// Use for AI, OAuth, or external APIs
export const myAction = action({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // 1. Load data with queries
    const data = await ctx.runQuery(api.path.to.query, {});
    
    // 2. Do external work (AI, OAuth, etc)
    const result = await externalAPI.call(data);
    
    // 3. Save results with mutations
    await ctx.runMutation(api.path.to.mutation, { result });
    
    return result;
  },
});
```

## 📊 Enum Reference

Quick copy-paste enum values:

**Framework** (case: UPPERCASE)
- NEXTJS, ANGULAR, REACT, VUE, SVELTE

**Message Role**
- USER, ASSISTANT

**Message Type**
- RESULT, ERROR, STREAMING

**Message Status**
- PENDING, STREAMING, COMPLETE

**Attachment Type**
- IMAGE, FIGMA_FILE, GITHUB_REPO

**Import Source**
- FIGMA, GITHUB

**OAuth Provider**
- figma, github

**Import Status**
- PENDING, PROCESSING, COMPLETE, FAILED

## 📁 File Organization

```
convex/
├── schema.ts                 # All enums & table definitions
├── helpers.ts               # requireAuth(), getCurrentUserClerkId()
├── projects.ts              # Project CRUD
├── messages.ts              # Message operations
├── fragments.ts             # (if exists) Code artifacts
├── usage.ts                 # Credit & plan checking
├── oauth.ts                 # OAuth connections
├── imports.ts               # Import job tracking
├── rateLimit.ts             # Rate limiting helpers
├── auth.ts                  # Better Auth setup
├── auth.config.ts           # OAuth providers
├── http.ts                  # HTTP endpoints
└── importData.ts            # Data migrations
```

## ⚠️ Critical Rules

1. **ALWAYS** call `requireAuth(ctx)` for authenticated operations
2. **ALWAYS** verify resource ownership before returning/modifying
3. **ALWAYS** include timestamps (createdAt, updatedAt) on inserts
4. **NEVER** expose Clerk user IDs directly in public APIs
5. **NEVER** allow unverified access to user projects
6. **NEVER** use `.filter()` in queries - use indexes with `.withIndex()`
7. **ALWAYS** use `ctx.runQuery/Mutation/Action` to access database from actions

## 🚀 Best Practices

### Do
✅ Use `requireAuth(ctx)` to get user IDs  
✅ Verify project ownership before access  
✅ Use indexes with proper field ordering  
✅ Include timestamps on all records  
✅ Handle errors explicitly  
✅ Use actions for external calls  
✅ Keep mutations focused on one operation  

### Don't
❌ Store raw Clerk IDs in indexes without userId check  
❌ Skip authorization checks  
❌ Use `.filter()` in production queries  
❌ Create messages without status/type fields  
❌ Call external APIs from mutations  
❌ Ignore timestamp updates  
❌ Mix unrelated operations in one mutation  

## 🔗 Related Documentation

- **CLAUDE.md** — Full project setup and architecture
- **convex/README.md** — Convex-specific setup
- **explanations/** — Detailed guides and troubleshooting
- **convex/schema.ts** — Source of truth for table definitions

## 📝 When to Update This File

Update `.cursor/rules/convex_rules.mdc` when:
- Adding new database tables
- Creating new enum types
- Changing authentication patterns
- Establishing new file organization
- Discovering new best practices

Update this guide when:
- Adding new examples
- Changing section organization
- Clarifying confusing patterns
- Adding new tasks

---

**Last Updated**: 2025-11-13  
**Status**: Ready for team use  
**Feedback**: Refer to CONVEX_RULES_REWRITE_SUMMARY.md for change details
