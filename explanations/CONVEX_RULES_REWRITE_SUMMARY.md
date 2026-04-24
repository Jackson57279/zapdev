# ZapDev Convex Rules Rewrite Summary

## Overview
The `.cursor/rules/convex_rules.mdc` file has been completely rewritten to be specific to the **ZapDev** codebase, replacing generic Convex guidelines with ZapDev-specific patterns and best practices.

## Key Changes

### 1. **Project Context Section** (NEW)
Added comprehensive ZapDev project overview including:
- **Project Overview**: AI-powered code generation platform
- **Core Data Model**: All 8 database tables (projects, messages, fragments, attachments, oauthConnections, imports, usage, rateLimits)
- **Authentication Pattern**: Clerk JWT authentication with `requireAuth()` helper
- **File Structure**: Purpose of each convex/*.ts file

### 2. **Authentication & Authorization Patterns** (NEW)
Added ZapDev-specific security patterns:
- **ZapDev Authentication Pattern**: How to use `requireAuth(ctx)` to get Clerk user IDs
- **ZapDev Authorization Pattern**: Resource ownership verification pattern
- Clear examples showing how to prevent unauthorized access

### 3. **Enhanced Schema Guidelines** (NEW)
Added sections for:
- **Enums in ZapDev**: All 8 enum types defined (frameworkEnum, messageRoleEnum, messageTypeEnum, etc.)
- **ZapDev Table Structure**: Quick reference for all tables and their fields
- **Key Indexing Patterns**: Best practices for by_userId, by_projectId, and composite indexes
- **Timestamp Handling**: Clarification that timestamps use `v.optional(v.number())`

### 4. **File Organization** (NEW)
Detailed breakdown of the `convex/` directory structure:
- `schema.ts` — Database schema with enums
- `helpers.ts` — Auth and utility functions
- `projects.ts` — Project CRUD
- `messages.ts` — Message and AI integration
- `usage.ts` — Credit tracking
- `oauth.ts` — OAuth management
- `imports.ts` — Import tracking
- `rateLimit.ts` — Rate limiting
- `auth.ts` & `auth.config.ts` — Better Auth setup
- `http.ts` — HTTP endpoints
- `importData.ts` — Data migration

### 5. **ZapDev Mutation Patterns** (NEW)
Added practical examples:
- **Message Mutations**: Standard message creation pattern with all required fields
- **Project Mutations**: How to handle immutable (createdAt) vs mutable (updatedAt) timestamps
- **Credit Consumption**: Pattern for checking and consuming user credits

### 6. **ZapDev Action Patterns** (NEW)
Added real-world action patterns:
- **AI Agent Actions**: Complete example of AI generation workflow
- **OAuth Actions**: GitHub OAuth token exchange pattern
- Best practices for side effects and external API calls

### 7. **Common ZapDev Operations** (NEW)
Added practical code examples for:
- Creating a project with authentication
- Querying user projects with proper indexing
- Saving code fragments with metadata
- Checking user credits and plan type
- Rate limiting helper implementation

## Structure & Layout

| Section | Purpose |
|---------|---------|
| **Frontmatter** | Metadata (updated glob pattern to `convex/**/*.ts`) |
| **ZapDev Project Context** | Overview of the platform and data model |
| **Function Guidelines** | New syntax, authentication, authorization, validators |
| **Schema Guidelines** | Enums, tables, indexing, timestamps |
| **Mutation Guidelines** | Message, project, and credit patterns |
| **Action Guidelines** | AI agents, OAuth flows, external calls |
| **ZapDev Patterns & Examples** | Real-world code snippets |
| **Original Examples** | Chat-app example (preserved for reference) |

## File Statistics
- **Total Lines**: 1,000
- **New Content**: ~430 lines of ZapDev-specific guidelines and examples
- **Preserved Content**: ~570 lines of foundational Convex guidelines

## How to Use

### For Cursor IDE
This file will automatically apply to any file in `convex/**/*.ts`. Cursor will reference these guidelines when:
- Writing new Convex functions
- Reviewing code patterns
- Suggesting completions
- Analyzing code quality

### For Development
Developers should reference this file when:
- Creating new mutations (check Mutation Patterns)
- Writing actions for AI/OAuth (check Action Patterns)
- Adding database operations (check Schema Guidelines)
- Implementing authentication (check Authentication Patterns)

## Key Patterns to Remember

### Always Use
```typescript
const userId = await requireAuth(ctx); // Get authenticated user ID
const project = await ctx.db.get(projectId);
if (!project || project.userId !== userId) throw new Error("Unauthorized");
```

### Message Creation Template
```typescript
const messageId = await ctx.db.insert("messages", {
  projectId, content, role: "USER", type: "RESULT", 
  status: "COMPLETE", createdAt: now, updatedAt: now,
});
```

### Use Indexes Properly
```typescript
await ctx.db.query("projects")
  .withIndex("by_userId", (q) => q.eq("userId", userId))
  .order("desc").collect();
```

## Next Steps

1. **Share with team**: Reference this file in code review guidelines
2. **Update IDE settings**: Configure Cursor to use this rules file
3. **Keep synchronized**: Update this file when schema or patterns change
4. **Document exceptions**: Note any deviations from these patterns

---

**Created**: 2025-11-13  
**Status**: Ready for use in Cursor IDE  
**Maintenance**: Update when convex/*.ts files change structure or patterns
