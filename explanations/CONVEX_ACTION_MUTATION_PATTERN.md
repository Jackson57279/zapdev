# Convex Action to Mutation Communication Pattern

## Problem

When Convex **actions** call **mutations**, there can be authentication context issues if the mutation relies on `requireAuth()` to extract the user identity from the request context.

### Example Error
```
[CONVEX A(projects:createWithMessageAndAttachments)] [Request ID: ...] Server Error Called by client
```

This error occurs when:
1. An action calls a mutation via `ctx.runMutation()`
2. The mutation handler calls `requireAuth(ctx)` to get the user ID
3. The action's authentication context is not properly propagated to the nested mutation

## Solution

Create **internal functions** and **wrapper mutations** that accept an explicit `userId` parameter:

### Pattern

```typescript
// ❌ PROBLEMATIC - mutation relies on requireAuth()
export const addAttachment = mutation({
  args: {
    messageId: v.id("messages"),
    // ... other args
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx); // ← Can fail when called from action
    // ... rest of handler
  },
});

// ✅ SOLUTION - create internal function with explicit userId
export const addAttachmentInternal = async (
  ctx: any,
  userId: string,
  messageId: string,
  attachmentData: { /* ... */ }
): Promise<string> => {
  // Verify ownership manually
  const message = await ctx.db.get(messageId as any);
  if (!message) throw new Error("Message not found");
  
  const project = await ctx.db.get(message.projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Unauthorized");
  }
  
  // Proceed with operation
  const attachmentId = await ctx.db.insert("attachments", {
    messageId: messageId as any,
    // ... other fields
  });
  
  return attachmentId;
};

// ✅ SOLUTION - wrapper mutation that actions can call
export const addAttachmentForUser = mutation({
  args: {
    userId: v.string(),
    messageId: v.id("messages"),
    // ... other args
  },
  handler: async (ctx, args) => {
    return addAttachmentInternal(ctx, args.userId, args.messageId, {
      // ... pass data
    });
  },
});
```

### From Action Code

```typescript
export const createWithMessageAndAttachments = action({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // Extract user ID from action auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.subject) {
      throw new Error("Unauthorized");
    }
    const userId = identity.subject;
    
    // Call wrapper mutation with explicit userId
    await ctx.runMutation(api.messages.addAttachmentForUser, {
      userId,  // ← Pass userId explicitly
      messageId,
      // ... other args
    });
  },
});
```

## Why This Works

1. **Explicit userId**: The action extracts `userId` from `ctx.auth.getUserIdentity()` and passes it explicitly
2. **Wrapper mutation**: The wrapper mutation accepts the `userId` as an argument
3. **Internal function**: The internal function validates ownership using the passed `userId` instead of relying on `requireAuth()`
4. **No context propagation issues**: Since the userId is passed as data (not relying on auth context), it works reliably

## Existing Examples in Codebase

This pattern is already used elsewhere in ZapDev:

```typescript
// convex/messages.ts
export const createInternal = async (ctx, userId, projectId, content, role, type) => {
  // Validate ownership with userId
  const project = await ctx.db.get(projectId);
  if (project.userId !== userId) throw new Error("Unauthorized");
  // ... create message
};

export const createForUser = mutation({
  args: { userId: v.string(), projectId: v.id("projects"), /* ... */ },
  handler: async (ctx, args) => {
    return createInternal(ctx, args.userId, args.projectId, /* ... */);
  },
});

// convex/projects.ts
export const createWithMessage = action({
  handler: async (ctx, args) => {
    const userId = identity.subject; // Extract from auth
    await ctx.runMutation(api.messages.createForUser, {
      userId,  // Pass explicitly
      projectId,
      // ...
    });
  },
});
```

## Implementation Checklist

When creating an action that needs to call a mutation:

- [ ] Extract userId in action: `const identity = await ctx.auth.getUserIdentity()`
- [ ] Check authentication: `if (!identity?.subject) throw new Error("Unauthorized")`
- [ ] Store userId: `const userId = identity.subject`
- [ ] Call wrapper mutation, not the base mutation
- [ ] Pass userId as explicit parameter: `await ctx.runMutation(api.module.functionForUser, { userId, /* ... */ })`
- [ ] Ensure wrapper mutation exists with `ForUser` naming convention
- [ ] Wrapper mutation should call internal function with userId
- [ ] Internal function validates ownership using passed userId

## Related Files

- `convex/messages.ts` - Implements `addAttachmentInternal` and `addAttachmentForUser`
- `convex/projects.ts` - Uses `addAttachmentForUser` in `createWithMessageAndAttachments`
