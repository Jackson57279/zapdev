# Sandbox Persistence Quick Start Guide

## TL;DR

ZapDev now supports E2B sandbox persistence! Sandboxes automatically pause after 10 minutes of inactivity and resume when users interact with them. This reduces compute costs while preserving the complete development state.

## What You Need to Do

### Step 1: Deploy Convex Schema

```bash
bun run convex:deploy
```

This creates the `sandboxSessions` table that tracks sandbox state.

### Step 2: No Code Changes Required!

The sandbox creation and resumption happen automatically:
- ✅ Sandboxes created with auto-pause enabled
- ✅ Sessions tracked in Convex
- ✅ Auto-pause job runs every 5 minutes
- ✅ Sandboxes resume automatically when accessed

### Step 3 (Optional): Add Activity Tracking

To optimize the auto-pause timeout, call this when users interact with the sandbox:

```typescript
// In any component/page accessing the sandbox
import { trpc } from '@/trpc/client';

// When user executes command, edits files, or views preview
await trpc.sandbox.updateActivity.mutate({ sandboxId });
```

## How It Works

```
User creates project
       ↓
  Sandbox created with autoPause: true
       ↓
  Session tracked in Convex (RUNNING)
       ↓
  [10 minutes of inactivity]
       ↓
  Auto-pause job pauses sandbox
       ↓
  User clicks to edit → updateActivity called
       ↓
  Sandbox resumes automatically
       ↓
  Development continues
```

## Key Files Changed

### New Files
- `convex/sandboxSessions.ts` - Sandbox session CRUD
- `src/inngest/functions/auto-pause.ts` - Auto-pause job
- `src/modules/sandbox/server/procedures.ts` - tRPC endpoints
- `explanations/SANDBOX_PERSISTENCE.md` - Full documentation

### Modified Files
- `convex/schema.ts` - Added sandboxSessions table
- `src/inngest/functions.ts` - Use betaCreate, track sessions
- `src/inngest/utils.ts` - Auto-resume on getSandbox()
- `src/trpc/routers/_app.ts` - Added sandbox router

## Testing Locally

### Test 1: Sandbox Creation
```bash
# Create a project in the UI
# Check Convex dashboard → sandboxSessions table
# Should see new session with state: "RUNNING"
```

### Test 2: Auto-Pause (Wait 10+ minutes)
```bash
# Convex dashboard → Query sandboxSessions
# Filter: state = "RUNNING", lastActivity < 10 minutes ago
# Should be paused (state: "PAUSED") after 5-minute job runs
```

### Test 3: Manual Resume
```typescript
// In browser console
const client = trpc.createClient();
await client.sandbox.updateActivity.mutate({ sandboxId: "your-id" });
// Should update lastActivity and set state back to RUNNING
```

## API Reference

### tRPC Endpoints (All Authenticated)

```typescript
// Update activity (call when user interacts)
await trpc.sandbox.updateActivity.mutate({ sandboxId: string })

// Get session info
const session = await trpc.sandbox.getSession.query({ sandboxId: string })

// Get all sessions for project
const sessions = await trpc.sandbox.getProjectSessions.query({ projectId: string })

// Get all sessions for user
const sessions = await trpc.sandbox.getUserSessions.query()
```

### Convex Queries

```typescript
// Get all running sessions (for background jobs)
const running = await convex.query(api.sandboxSessions.getRunning)

// Get by sandbox ID
const session = await convex.query(api.sandboxSessions.getBySandboxId, { sandboxId })

// Get by project ID
const sessions = await convex.query(api.sandboxSessions.getByProjectId, { projectId })

// Get by user ID
const sessions = await convex.query(api.sandboxSessions.getByUserId, { userId })
```

## Deployment Checklist

- [ ] `bun run convex:deploy` executed
- [ ] Convex schema migration completed
- [ ] No build errors with `bun run build`
- [ ] Inngest function `autoPauseSandboxes` appears in dashboard
- [ ] Optional: Add activity tracking calls to UI components
- [ ] Monitor: Check Convex and Inngest dashboards for data

## Configuration

### Change Auto-Pause Timeout

When creating a sandbox (in `src/inngest/functions.ts`):

```typescript
await convex.mutation(api.sandboxSessions.create, {
  // ... other args
  autoPauseTimeout: 30 * 60 * 1000, // 30 minutes instead of 10
});
```

### Change Auto-Pause Job Frequency

In `src/inngest/functions/auto-pause.ts`:

```typescript
{ cron: "0 */10 * * * *" } // Every 10 minutes instead of 5
```

## Monitoring

### Check Sandbox Sessions
```
Convex Dashboard → Data → sandboxSessions
```

### Check Auto-Pause Job
```
Inngest Dashboard → Functions → auto-pause-sandboxes
```

### View Logs
```bash
# Local development
bun run convex:dev
# Check terminal for session creation/update logs
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Sandbox not pausing | Check auto-pause job in Inngest dashboard, verify lastActivity is old enough |
| Sandbox not resuming | Ensure `trpc.sandbox.updateActivity` is called, check browser network tab |
| "Session not found" | Session may not have been created. Check Convex dashboard. |
| "Sandbox not found" | Sandbox may be >30 days old. Create a new one. |

## Next Steps

1. **Deploy** the schema: `bun run convex:deploy`
2. **Monitor** the auto-pause job in Inngest
3. **Test** by creating a project and waiting for auto-pause
4. **Optimize** by adding activity tracking to your UI

## More Information

See `explanations/SANDBOX_PERSISTENCE.md` for:
- Detailed architecture
- Full API reference
- Advanced configuration
- Testing strategies
- Error handling
