# E2B Sandbox Persistence Implementation

## Overview

This document describes the implementation of E2B's beta sandbox persistence feature in ZapDev, enabling users to pause development work and resume later while preserving the complete sandbox state (files, memory, processes).

## What is Sandbox Persistence?

E2B sandbox persistence allows you to:
- **Pause** a running sandbox, saving its complete state (filesystem + memory)
- **Resume** the sandbox later, restoring it to the exact same state
- **Auto-pause** sandboxes after a period of inactivity to reduce compute costs
- **Delete** sandboxes older than 30 days (E2B limitation)

## Implementation Architecture

### Data Model

#### `sandboxSessions` Table (Convex)
Tracks the lifecycle and state of each sandbox:

```typescript
interface SandboxSession {
  _id: Id<"sandboxSessions">;
  sandboxId: string;           // E2B sandbox ID
  projectId: Id<"projects">;   // Associated project
  userId: string;              // Clerk user ID
  framework: Framework;        // NEXTJS | ANGULAR | REACT | VUE | SVELTE
  state: "RUNNING" | "PAUSED" | "KILLED"; // Current sandbox state
  lastActivity: number;        // Timestamp of last user interaction
  autoPauseTimeout: number;    // Inactivity timeout in ms (default: 10 min)
  pausedAt?: number;           // When sandbox was paused
  createdAt: number;           // Creation timestamp
  updatedAt: number;           // Last update timestamp
}
```

### State Machine

```
       create()
         ↓
     RUNNING ←── updateActivity()
       ↓  ↑
   (pause) │ (auto-pause timer)
       ↓  │
     PAUSED → connect() (auto-resume)
       ↓
     KILLED (cleanup or user delete)
```

## Core Components

### 1. Sandbox Creation (`src/inngest/functions.ts`)

When creating a sandbox for code generation:

```typescript
sandbox = await Sandbox.betaCreate(template, {
  apiKey: process.env.E2B_API_KEY,
  timeoutMs: SANDBOX_TIMEOUT,
  autoPause: true,  // Enable auto-pause on inactivity
});

// Track in Convex
await convex.mutation(api.sandboxSessions.create, {
  sandboxId,
  projectId,
  userId: project.userId,
  framework: selectedFramework,
  autoPauseTimeout: 10 * 60 * 1000, // 10 minutes
});
```

**Key Features:**
- Uses `Sandbox.betaCreate()` to enable auto-pause
- Default 10-minute inactivity timeout
- Session tracked in Convex for persistence across server restarts

### 2. Sandbox Retrieval (`src/inngest/utils.ts`)

When accessing an existing sandbox:

```typescript
export async function getSandbox(sandboxId: string) {
  // Check local cache first
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) return cached;
  
  // Connect (auto-resumes if paused)
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: process.env.E2B_API_KEY,
  });
  
  // Cache for 5 minutes
  SANDBOX_CACHE.set(sandboxId, sandbox);
  clearCacheEntry(sandboxId);
  
  return sandbox;
}
```

**Key Features:**
- `Sandbox.connect()` auto-resumes paused sandboxes
- Timeout is reset when sandbox is resumed
- Local cache avoids repeated API calls
- Handles expired/deleted sandboxes gracefully

### 3. Activity Tracking (tRPC + Convex)

Track user interactions to reset the auto-pause timer:

```typescript
// tRPC endpoint: sandbox.updateActivity
await trpc.sandbox.updateActivity.mutate({ sandboxId });

// Convex mutation
await convex.mutation(api.sandboxSessions.updateLastActivityBySandboxId, {
  sandboxId,
});
```

**When to Call:**
- User executes terminal commands
- User creates/updates files
- User views sandbox preview

### 4. Auto-Pause Job (Inngest)

Periodic background job that pauses idle sandboxes:

```typescript
export const autoPauseSandboxes = inngest.createFunction(
  { id: "auto-pause-sandboxes" },
  { cron: "0 */5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const sessions = await convex.query(api.sandboxSessions.getRunning);
    
    for (const session of sessions) {
      const elapsed = Date.now() - session.lastActivity;
      
      if (elapsed > session.autoPauseTimeout) {
        const sandbox = await Sandbox.connect(session.sandboxId);
        await sandbox.betaPause();
        
        // Update state
        await convex.mutation(api.sandboxSessions.updateState, {
          sessionId: session._id,
          state: "PAUSED",
        });
      }
    }
  }
);
```

**Behavior:**
- Runs every 5 minutes
- Only pauses RUNNING sandboxes
- Checks elapsed time since last activity
- Updates Convex state after pausing
- Handles errors gracefully (marks as KILLED if not found)

## File Structure

```
convex/
├── schema.ts                    # Updated with sandboxSessions table
└── sandboxSessions.ts          # NEW: Sandbox session CRUD operations

src/
├── inngest/
│   ├── functions.ts            # Modified: betaCreate + session tracking
│   ├── functions/
│   │   └── auto-pause.ts       # NEW: Auto-pause background job
│   └── utils.ts                # Modified: getSandbox() resume logic
├── modules/sandbox/
│   └── server/
│       └── procedures.ts        # NEW: tRPC endpoints
└── trpc/
    └── routers/
        └── _app.ts             # Modified: Added sandbox router
```

## API Reference

### Convex Functions

#### `sandboxSessions.create(args)`
Create a new sandbox session.

```typescript
const sessionId = await convex.mutation(api.sandboxSessions.create, {
  sandboxId: string,
  projectId: Id<"projects">,
  userId: string,
  framework: "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE",
  autoPauseTimeout?: number, // Default: 10 * 60 * 1000
});
```

#### `sandboxSessions.getBySandboxId(sandboxId)`
Get a single session by sandbox ID.

```typescript
const session = await convex.query(api.sandboxSessions.getBySandboxId, {
  sandboxId: string,
});
```

#### `sandboxSessions.getByProjectId(projectId)`
Get all sessions for a project.

```typescript
const sessions = await convex.query(api.sandboxSessions.getByProjectId, {
  projectId: Id<"projects">,
});
```

#### `sandboxSessions.getByUserId(userId)`
Get all sessions for a user.

```typescript
const sessions = await convex.query(api.sandboxSessions.getByUserId, {
  userId: string,
});
```

#### `sandboxSessions.getRunning()`
Get all running (non-paused) sessions. Used by auto-pause job.

```typescript
const sessions = await convex.query(api.sandboxSessions.getRunning);
```

#### `sandboxSessions.updateState(sessionId, state)`
Update sandbox state (RUNNING, PAUSED, KILLED).

```typescript
const session = await convex.mutation(api.sandboxSessions.updateState, {
  sessionId: Id<"sandboxSessions">,
  state: "RUNNING" | "PAUSED" | "KILLED",
});
```

#### `sandboxSessions.updateLastActivity(sessionId)`
Update last activity timestamp and resume if paused.

```typescript
const session = await convex.mutation(api.sandboxSessions.updateLastActivity, {
  sessionId: Id<"sandboxSessions">,
});
```

#### `sandboxSessions.updateLastActivityBySandboxId(sandboxId)`
Update last activity by sandbox ID (called from tRPC).

```typescript
const session = await convex.mutation(api.sandboxSessions.updateLastActivityBySandboxId, {
  sandboxId: string,
});
```

#### `sandboxSessions.cleanupExpired()`
Internal mutation to delete sessions older than 30 days.

```typescript
const result = await convex.mutation(api.sandboxSessions.cleanupExpired);
// { deletedCount: number, totalExpired: number }
```

### tRPC Endpoints

#### `sandbox.updateActivity(sandboxId)`
Update activity timestamp. Authenticated.

```typescript
const result = await trpc.sandbox.updateActivity.mutate({ sandboxId });
// { success: boolean, session?: SandboxSession, error?: string }
```

#### `sandbox.getSession(sandboxId)`
Get session info. Authenticated.

```typescript
const result = await trpc.sandbox.getSession.query({ sandboxId });
// { success: boolean, session?: SandboxSession, error?: string }
```

#### `sandbox.getProjectSessions(projectId)`
Get all sessions for a project. Authenticated.

```typescript
const result = await trpc.sandbox.getProjectSessions.query({ projectId });
// { success: boolean, sessions?: SandboxSession[], error?: string }
```

#### `sandbox.getUserSessions()`
Get all sessions for current user. Authenticated.

```typescript
const result = await trpc.sandbox.getUserSessions.query();
// { success: boolean, sessions?: SandboxSession[], error?: string }
```

## Usage Examples

### Example 1: Automatic Pause and Resume

```typescript
// User creates a project and starts code generation
// (Sandbox is created with autoPause: true)

// After 10 minutes of inactivity:
// Auto-pause job detects inactivity
// → Calls sandbox.betaPause()
// → Updates state to PAUSED in Convex

// User returns and clicks to edit code:
// → tRPC sandbox.updateActivity() called
// → getSandbox() calls Sandbox.connect()
// → E2B auto-resumes the sandbox
// → User can continue development
```

### Example 2: Manual Activity Tracking

```typescript
// When user executes a terminal command:
const executeCommand = async (command: string) => {
  // Update activity
  await trpc.sandbox.updateActivity.mutate({ sandboxId });
  
  // Execute command
  const sandbox = await getSandbox(sandboxId);
  await sandbox.commands.run(command);
};
```

### Example 3: Checking Sandbox Status

```typescript
// Get sandbox session info
const session = await trpc.sandbox.getSession.query({ sandboxId });

if (session.success) {
  console.log(`Sandbox state: ${session.session.state}`);
  console.log(`Last activity: ${new Date(session.session.lastActivity)}`);
  console.log(`Paused at: ${session.session.pausedAt ? new Date(session.session.pausedAt) : 'N/A'}`);
}
```

## Deployment Steps

### 1. Deploy Convex Schema

```bash
cd /home/dih/zapdev
bun run convex:deploy
```

This will:
- Create the `sandboxSessions` table
- Create indexes for querying by projectId, userId, sandboxId, state
- Auto-migrate schema in production

### 2. Enable Auto-Pause Job

The `autoPauseSandboxes` function is exported from `src/inngest/functions.ts`. Inngest will automatically pick it up based on the cron configuration.

### 3. Update Client Code

Add activity tracking calls to sandbox interactions:

```typescript
// In terminal execution
await trpc.sandbox.updateActivity.mutate({ sandboxId });

// In file operations
await trpc.sandbox.updateActivity.mutate({ sandboxId });

// In preview interactions
await trpc.sandbox.updateActivity.mutate({ sandboxId });
```

## Configuration

### Auto-Pause Timeout

Default: 10 minutes (600,000 ms)

To customize per user:
```typescript
await convex.mutation(api.sandboxSessions.create, {
  // ... other args
  autoPauseTimeout: 30 * 60 * 1000, // 30 minutes
});
```

### Auto-Pause Job Frequency

Default: Every 5 minutes

Edit in `src/inngest/functions/auto-pause.ts`:
```typescript
{ cron: "0 */5 * * * *" } // Every 5 minutes
```

## Monitoring & Debugging

### View Active Sandboxes

```typescript
// Get all running sandboxes
const running = await convex.query(api.sandboxSessions.getRunning);
console.log(`Running sandboxes: ${running.length}`);
```

### View Paused Sandboxes

```typescript
// Query Convex directly
const paused = await ctx.db
  .query("sandboxSessions")
  .filter(q => q.eq(q.field("state"), "PAUSED"))
  .collect();
console.log(`Paused sandboxes: ${paused.length}`);
```

### Monitor Auto-Pause Job

Check Inngest dashboard:
1. Go to https://app.inngest.com/
2. Find "auto-pause-sandboxes" function
3. View execution history and logs

### Logs

```
[DEBUG] Creating E2B sandbox for framework: nextjs
[DEBUG] Sandbox created successfully: sbox_xyz123
[DEBUG] Creating sandbox session for sandboxId: sbox_xyz123
[DEBUG] Sandbox session created successfully
[DEBUG] Connected to sandbox sbox_xyz123 (auto-resumed if paused)
[DEBUG] Pausing inactive sandbox sbox_xyz123 (idle for 15 minutes)
```

## Error Handling

### Sandbox Not Found

If a sandbox is deleted or expired (>30 days):

```typescript
try {
  const sandbox = await getSandbox(sandboxId);
} catch (error) {
  if (error.message.includes("not found")) {
    // Sandbox expired or deleted
    // Update session state to KILLED
    await convex.mutation(api.sandboxSessions.updateState, {
      sessionId,
      state: "KILLED",
    });
  }
}
```

### Auto-Pause Failures

If auto-pause fails for a sandbox:
- Error is logged but not thrown
- Session state remains RUNNING
- Next 5-minute check will retry
- If consistently fails, marks as KILLED after error

## Limitations & Considerations

### E2B Sandbox Persistence Limits (Beta)

1. **30-day expiration**: Sandboxes cannot be resumed after 30 days
2. **Pause time**: ~4 seconds per 1 GiB of RAM
3. **Resume time**: ~1 second
4. **Storage**: Persisted state counts against E2B account limits

### Network Impact

- Paused sandboxes cannot be accessed from external clients
- Servers running in paused sandboxes become inaccessible
- Resuming restarts the network layer

### Concurrent Access

- Multiple users cannot share the same sandbox (each gets their own)
- Activity updates from different users will reset auto-pause timeout appropriately

## Future Enhancements

1. **UI Dashboard**: Show sandbox state, last activity, pause/resume buttons
2. **User Preferences**: Configurable auto-pause timeout per user
3. **Cost Tracking**: Track cost savings from auto-pause
4. **Export on Pause**: Option to export code before pausing
5. **Cleanup Alerts**: Notify users before 30-day expiration
6. **Concurrent Sessions**: Allow multiple paused versions of same project

## Testing

### Unit Tests
```bash
bun run test -- sandboxSessions
```

### Integration Tests
1. Create sandbox → verify session created
2. Wait for idle timeout → verify auto-paused
3. Trigger activity → verify resumed and activity updated
4. Verify file/memory state preserved after pause/resume

### E2B Sandbox Tests
```bash
# Test betaCreate and betaPause
npm test -- e2b-persistence
```

## References

- [E2B Sandbox Persistence Docs](https://e2b.dev/docs/sandbox/persistence)
- [Inngest Cron Triggers](https://www.inngest.com/docs/guides/cron)
- [Convex Mutations](https://docs.convex.dev/server-functions/mutations)

---

## Troubleshooting

**Q: Sandbox not resuming when I click?**
A: Ensure `sandbox.updateActivity` tRPC call is made. Check browser console for errors.

**Q: Auto-pause job not running?**
A: Check Inngest dashboard for function status. Verify cron expression in `auto-pause.ts`.

**Q: "Sandbox not found" error?**
A: Sandbox may be >30 days old or manually killed on E2B. Create a new sandbox.

**Q: Session not created?**
A: Check Convex is deployed and `sandboxSessions` table exists. View Convex dashboard.
