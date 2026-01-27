---
name: Add Inngest as Agent Orchestration Layer
overview: Integrate Inngest as a middleware orchestration layer for the existing agent system. The agent logic (`runCodeAgent`) remains unchanged, but execution will be routed through Inngest functions for better observability, retry handling, and workflow management.
todos:
  - id: install-inngest
    content: "Install Inngest packages: inngest and @inngest/realtime"
    status: completed
  - id: create-client
    content: Create src/inngest/client.ts with Inngest client and realtime middleware
    status: completed
  - id: create-types
    content: Create src/inngest/types.ts with event type definitions
    status: completed
  - id: create-function
    content: Create src/inngest/functions/code-agent.ts that wraps runCodeAgent
    status: completed
  - id: create-api-route
    content: Create src/app/api/inngest/route.ts to serve Inngest functions
    status: completed
  - id: modify-agent-route
    content: Modify src/app/api/agent/run/route.ts to trigger Inngest and stream events
    status: completed
isProject: false
---

# Add Inngest as Agent Orchestration Layer

## Overview

Add Inngest as a middleware orchestration layer between the API route and the agent system. The existing `runCodeAgent` function remains unchanged - Inngest will wrap it to provide workflow orchestration, retry logic, and observability.

## Architecture

```
Frontend → /api/agent/run (SSE) → Inngest Function → runCodeAgent() → Stream Events
```

The API route will trigger an Inngest event, and the Inngest function will execute the agent while streaming events back through Inngest's realtime system.

## Implementation Steps

### 1. Install Inngest Dependencies

**File**: `package.json`

Add Inngest packages:

- `inngest` - Core Inngest SDK
- `@inngest/realtime` - Real-time streaming support (for SSE events)

### 2. Create Inngest Client

**File**: `src/inngest/client.ts` (NEW)

Create Inngest client with realtime middleware:

- Initialize Inngest client with `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`
- Add `realtimeMiddleware` from `@inngest/realtime` for streaming support
- Export configured client

### 3. Create Inngest Function for Agent Execution

**File**: `src/inngest/functions/code-agent.ts` (NEW)

Create Inngest function that wraps `runCodeAgent`:

- Function name: `code-agent/run`
- Event trigger: `code-agent/run.requested`
- Function will:

  1. Accept `projectId`, `value`, `model` from event data
  2. Call `runCodeAgent()` with these parameters
  3. Stream events using Inngest's `sendEvent` for realtime updates
  4. Handle errors and retries via Inngest's built-in retry
  5. Emit completion event with final results

**Key considerations**:

- Inngest functions are async and don't directly return SSE streams
- Use Inngest's `sendEvent` to emit progress events
- Store final results in Convex (already done by `runCodeAgent`)
- Use Inngest's retry configuration for transient failures

### 4. Create Inngest API Route Handler

**File**: `src/app/api/inngest/route.ts` (NEW)

Create Inngest serve handler:

- Export handler that serves Inngest functions
- Register the `code-agent/run` function
- This endpoint is called by Inngest Cloud/Dev Server to execute functions

### 5. Modify Agent Run API Route

**File**: `src/app/api/agent/run/route.ts`

Update to use Inngest:

- Instead of calling `runCodeAgent()` directly, trigger Inngest event
- Use Inngest's realtime streaming to forward events as SSE
- Maintain same SSE format for frontend compatibility
- Handle Inngest event triggering and stream consumption

**Two approaches for streaming**:

**Option A (Recommended)**: Use Inngest Realtime

- Trigger Inngest event with `runId`
- Subscribe to Inngest realtime events for that `runId`
- Forward events as SSE to frontend
- This requires `@inngest/realtime` middleware

**Option B**: Hybrid approach

- Trigger Inngest event (non-blocking)
- Inngest function calls `runCodeAgent()` and stores events
- API route polls/streams from storage or uses webhooks
- Less real-time but simpler

**Recommendation**: Start with Option A using Inngest Realtime for true streaming.

### 6. Environment Variables

**File**: `.env.example` (update if exists) or document in README

Add required Inngest variables:

- `INNGEST_EVENT_KEY` - Inngest event key
- `INNGEST_SIGNING_KEY` - Inngest signing key
- `INNGEST_APP_URL` - App URL for Inngest to call back (optional, auto-detected)

### 7. Type Definitions

**File**: `src/inngest/types.ts` (NEW)

Define Inngest event types:

- `code-agent/run.requested` event data structure
- `code-agent/run.progress` event structure
- `code-agent/run.complete` event structure
- `code-agent/run.error` event structure

### 8. Update Frontend (if needed)

**File**: `src/modules/projects/ui/components/message-form.tsx`

The frontend should continue working as-is since we're maintaining SSE format. However, we may need to:

- Add handling for Inngest-specific event types if any
- Ensure compatibility with the streaming format

## Key Files to Create/Modify

### New Files

1. `src/inngest/client.ts` - Inngest client configuration
2. `src/inngest/functions/code-agent.ts` - Agent execution function
3. `src/inngest/types.ts` - Event type definitions
4. `src/app/api/inngest/route.ts` - Inngest serve handler

### Modified Files

1. `package.json` - Add Inngest dependencies
2. `src/app/api/agent/run/route.ts` - Trigger Inngest instead of direct call

## Implementation Details

### Inngest Function Structure

```typescript
export const runCodeAgentFunction = inngest.createFunction(
  {
    id: "code-agent-run",
    name: "Code Agent Run",
    retries: 3, // Use Inngest retries
  },
  { event: "code-agent/run.requested" },
  async ({ event, step }) => {
    // Call runCodeAgent and stream events
    // Emit progress events via sendEvent
    // Handle completion/errors
  }
);
```

### API Route Changes

The route will:

1. Generate a unique `runId`
2. Trigger Inngest event with `runId`
3. Subscribe to Inngest realtime events for that `runId`
4. Forward events as SSE to maintain frontend compatibility

## Testing Considerations

- Test Inngest function execution locally with Inngest Dev Server
- Verify SSE streaming still works with frontend
- Test retry logic via Inngest
- Verify error handling and event emission

## Migration Notes

- The agent system (`runCodeAgent`) remains completely unchanged
- Frontend continues to work with SSE format
- Inngest adds orchestration layer without breaking existing functionality
- Can be deployed incrementally (test with Inngest, fallback to direct if needed)