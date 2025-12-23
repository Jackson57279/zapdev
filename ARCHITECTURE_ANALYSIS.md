# ZapDev Architecture Analysis

## Executive Summary

ZapDev is an AI-powered code generation platform that combines:
- **Frontend**: Next.js 15 with React 19, Shadcn/ui, Tailwind CSS v4
- **Backend**: Convex (real-time database) with Inngest (background jobs)
- **AI Engine**: Multi-model support via Vercel AI Gateway (Claude, GPT, Gemini, Qwen, etc.)
- **Code Execution**: E2B Code Interpreter (isolated sandboxes for each framework)
- **Authentication**: Clerk with JWT
- **Credit System**: Daily rate limiting (Free: 5 credits/day, Pro: 100/day)

The system orchestrates an AI-powered code generation workflow that detects frameworks, generates full-stack applications in isolated sandboxes, validates the output, and stores the results in Convex.

---

## 1. Inngest Functions & Event Orchestration

### Main Inngest Functions

#### **codeAgentFunction** (core generation)
**File**: `src/inngest/functions.ts` (lines 798-1766)
**Event**: `code-agent/run`

**14-Step Workflow**:
1. Get project metadata (check if framework already set)
2. Framework selection (if needed) using Gemini 2.5-Flash-Lite classifier
3. Model selection (auto or user-specified from 6 options)
4. E2B sandbox creation with framework template
5. Dev server startup (background, non-blocking)
6. Sandbox session tracking in Convex
7. Message history retrieval (last 1 message for context)
8. Code agent execution with 3 tools (terminal, createOrUpdateFiles, readFiles)
9. Post-network fallback summary generation
10. Validation checks (lint, dev server, Shadcn compliance)
11. Auto-fix loop (up to 2 attempts if errors detected)
12. File collection from sandbox (batched due to 1MB Inngest limit)
13. Fragment title & response generation via lightweight agents
14. Save result to Convex (message + fragment)

**Key Features**:
- Framework-specific prompts loaded from `src/prompts/[framework].ts`
- Network router with early-exit logic for speed optimization
- Auto-fix triggers on validation errors with detailed debugging context
- Comprehensive file size validation (warn 4MB, error 5MB)
- Shadcn UI compliance enforcement for Next.js projects

#### **sandboxTransferFunction** (persistence)
**File**: `src/inngest/functions.ts` (lines 1768-1862)
**Event**: `sandbox-transfer/run`
- Extends sandbox lifetime after 55 minutes by reconnecting
- Triggered by frontend when viewing old fragments

#### **errorFixFunction** (error correction)
**File**: `src/inngest/functions.ts` (lines 1865-2093)
**Event**: `error-fix/run`
- Free error correction without credit charge
- Runs lint/dev server checks, auto-fixes if needed

#### **Import Functions**
- `process-figma-import.ts`: Figma design imports
- `process-github-import.ts`: GitHub repository imports
- `process-figma-direct.ts`: Direct Figma URL handling

#### **Auto-Pause Function**
- `auto-pause.ts`: Auto-pause inactive sandboxes after 10 minutes

### Event Flow

```
User Chat → Convex Action (createMessageWithAttachments) 
  → /api/inngest/trigger 
  → Inngest Event Bus 
  → code-agent/run 
  → E2B Sandbox 
  → Convex Mutations (save message + fragment)
  → Convex Subscription 
  → Frontend Re-render
```

---

## 2. Data Flow & Entities

### Database Schema

**Core Tables**:
- **projects**: User projects with framework selection and model preferences
- **messages**: Conversation messages (USER/ASSISTANT, RESULT/ERROR/STREAMING, PENDING/STREAMING/COMPLETE)
- **fragments**: Generated code artifacts linked to messages (contains all files, sandbox URL, metadata)
- **attachments**: Images/Figma/GitHub attachments to messages
- **usage**: Daily credit tracking (points, expiry, plan type)
- **sandboxSessions**: E2B sandbox persistence metadata
- **subscriptions**: Clerk billing integration
- **oauthConnections**: Encrypted OAuth tokens for Figma/GitHub
- **imports**: Import job history and status tracking

### Data Relationships

```
Users (Clerk)
  └─ Projects (name, framework, modelPreference)
     └─ Messages (content, role, type, status)
        ├─ Fragments (files, sandbox info, title, metadata)
        └─ Attachments (images, Figma, GitHub links)
  └─ Usage (credits, expiry, plan)
  └─ Subscriptions (billing info)
```

### Generation Timeline

```
T+0s:  User submits via chat form
T+0.1s: createMessageWithAttachments() consumes 1 credit, creates USER message
T+0.2s: /api/inngest/trigger sends to Inngest
T+5s:  Inngest worker picks up event
T+45-120s: Generate code (framework detection, sandbox creation, code generation, validation, auto-fix)
T+120s: Save ASSISTANT message + Fragment to Convex
T+120s: Frontend Convex subscription fires, renders new messages
```

---

## 3. UI Component Architecture

### Component Hierarchy

```
ProjectView (container)
├─ ProjectHeader (metadata display)
├─ MessagesContainer (main chat UI)
│  ├─ Scrollable message list (flex-1, auto-scroll)
│  │  └─ MessageCard[]
│  │     ├─ UserMessage (right-aligned with attachments)
│  │     └─ AssistantMessage (left-aligned with logo, fragment button)
│  ├─ MessageLoading (if last message is USER)
│  └─ MessageForm (sticky bottom)
│     ├─ Usage (credit counter + timer)
│     ├─ Textarea (auto-resize 2-8 rows, Ctrl+Enter submit)
│     ├─ Attachment previews (with remove buttons)
│     └─ Toolbar
│        ├─ Enhance prompt (Sparkles icon, calls /api/enhance-prompt)
│        ├─ Image upload (UploadThing integration)
│        ├─ Import menu (Figma/GitHub links)
│        ├─ Model selector (popover with 6 options + descriptions)
│        └─ Send button (loading state)
└─ FragmentWeb (sidebar preview)
   ├─ Iframe (sandboxUrl)
   ├─ Refresh button
   ├─ Copy URL button
   └─ Auto-transfer UI (age > 55 min)
```

### Real-Time Updates

**Convex Subscriptions** (automatic WebSocket):
```typescript
const messages = useQuery(api.messages.list, { projectId })
// Re-fetches on: new message, message update, fragment creation, attachment add
// No manual polling needed
```

---

## 4. Streaming & Message Status

### Message Lifecycle

```
Initial: USER message (type=RESULT, status=COMPLETE) created immediately
Processing: No intermediate streaming messages (infrastructure exists but disabled)
Final: ASSISTANT message (type=RESULT/ERROR, status=COMPLETE) created after generation
       + FRAGMENT with all files, sandbox URL, metadata
```

### Current Status Handling
- All messages have `status: COMPLETE` (no in-flight states)
- Streaming infrastructure disabled for speed optimization
- Frontend shows `MessageLoading` spinner while waiting for ASSISTANT message

---

## 5. Convex Integration

### Key Mutations from Inngest

```typescript
// Create message (after generation)
await convex.mutation(api.messages.createForUser, {
  userId, projectId, content, role: "ASSISTANT", type: "RESULT", status: "COMPLETE"
});

// Create fragment (with generated files)
await convex.mutation(api.messages.createFragmentForUser, {
  userId, messageId, sandboxId, sandboxUrl, title, files, framework, metadata
});

// Update project with selected framework
await convex.mutation(api.projects.updateForUser, {
  userId, projectId, framework
});

// Track sandbox session
await convex.mutation(api.sandboxSessions.create, {
  sandboxId, projectId, userId, framework, autoPauseTimeout
});
```

### Key Queries from Inngest

```typescript
// Get project metadata
await convex.query(api.projects.getForSystem, { projectId });

// Get message context
await convex.query(api.messages.listForUser, { userId, projectId });

// Get fragment for resume/transfer
await convex.query(api.messages.getFragmentById, { fragmentId });
```

### Convex Client Pattern

Inngest uses **lazy-initialized HTTP client**:
```typescript
let convexClient: ConvexHttpClient | null = null;
const convex = new Proxy({}, {
  get(_target, prop) {
    if (!convexClient) {
      convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    }
    return convexClient[prop];
  },
});
```

### Authorization

- **Mutations**: Require `requireAuth(ctx)` to verify JWT
- **Actions from Inngest**: Use explicit `userId` parameter (pre-verified)
- **Project ownership**: Always verified before mutations

---

## 6. Framework Selection

### Framework Selector Agent

**Trigger**: Project without framework or first message to new project

**Workflow**:
1. Create agent with `FRAMEWORK_SELECTOR_PROMPT` + Gemini 2.5-Flash-Lite model
2. Run agent with user's initial message
3. Parse output, validate against [nextjs, angular, react, vue, svelte]
4. Update project with selected framework
5. Proceed with code generation using framework-specific prompt

### Supported Frameworks

| Framework | Best For | Pre-installed | Port |
|-----------|----------|---------------|------|
| nextjs | Full-stack React, SSR | Shadcn UI, Tailwind | 3000 |
| angular | Enterprise, complex forms | Material, Tailwind | 4200 |
| react | Simple SPA | Chakra UI, Tailwind | 5173 |
| vue | Progressive apps | Vuetify, Tailwind | 5173 |
| svelte | High performance | DaisyUI, Tailwind | 5173 |

### Selection Logic

- **Explicit mentions**: Use specified framework (e.g., "Angular dashboard")
- **Default**: nextjs if ambiguous
- **Complexity heuristics**: Enterprise → Angular, simple → React/Vue/Svelte

---

## 7. Model Selection & Configuration

### Available Models

```typescript
MODEL_CONFIGS = {
  "anthropic/claude-haiku-4.5": { temp: 0.7, freq_penalty: 0.5 },
  "google/gemini-3-flash": { temp: 0.3, skipValidation: true },
  "openai/gpt-5.1-codex": { },
  "alibaba/qwen3-max": { },
  "google/gemini-3-pro": { },
  "zai/glm-4.6": { },
}
```

### Auto-Selection Algorithm

1. Analyze prompt for complexity keywords (advanced, enterprise, security, etc.)
2. Check prompt length (>500 chars, >1000 chars)
3. Check for coding focus (refactor, optimize, debug)
4. Check for speed requirements (quick, fast, simple)

**Decision Tree**:
- Coding focus + NOT very long → Qwen 3 Max
- Speed needed + NOT complex → Gemini 3 Flash
- Complex OR very long → Claude Haiku (default)
- Angular + complex → Claude Haiku (consistency)

### User Selection

- Popover menu in MessageForm with 6 options + descriptions
- Defaults to "auto" (backend selection)
- Model passed to Inngest via `/api/inngest/trigger`

---

## 8. Validation & Error Recovery

### Post-Generation Checks

**Lint Check**:
```typescript
npm run lint
// Passes: exit 0, or exit != 0 but no errors in output
// Fails: output contains "error" or "✖", or matches AUTO_FIX_ERROR_PATTERNS
```

**Dev Server Health**:
```typescript
curl -f http://localhost:${port}
// Passes: server responds successfully
// Fails: timeout or connection refused
```

**Shadcn Compliance** (Next.js only):
```typescript
if (!usesShadcnComponents(files)) {
  // Trigger auto-fix requiring Shadcn UI imports
}
```

### Auto-Fix Loop

**Conditions**:
- shouldRunAutoFix: true (unless model has skipValidation=true)
- autoFixAttempts < 2 (max 2 attempts)
- Has validation errors OR agent reported error

**Process**:
1. Run agent again with detailed error context
2. Pass full error output, debugging hints, success criteria
3. Re-run validation checks
4. Update message with "Validation Errors Still Present" if persist

**Skip for Fast Models**:
- Gemini 3 Flash has `skipValidation: true`
- Prioritizes speed over validation coverage

---

## 9. Complete Request-Response Flow

### Timeline

```
T+0s:      User types & sends message
T+0.1s:    createMessageWithAttachments() consumes credit
T+0.2s:    POST /api/inngest/trigger
T+0.3s:    Event sent to Inngest, UI shows loading
T+5s:      Inngest worker picks up event
T+10s:     Get project, detect/select framework
T+15s:     Create E2B sandbox, start dev server
T+20s:     Run code agent (iteration 1)
T+40s:     Agent finishes, post-process summary
T+50s:     Run validation checks (lint, dev server)
T+60-80s:  Auto-fix if needed (iterations 1-2)
T+90s:     Collect files from sandbox (batched reading)
T+100s:    Generate fragment title & response
T+110s:    Save to Convex (message + fragment mutations)
T+120s:    Convex subscription fires on frontend
T+120s:    User sees generated code in chat + preview
```

**Total Time**: 45-120 seconds (depends on model & task complexity)

---

## 10. Key Performance Characteristics

### Timeouts
- E2B Sandbox lifetime: 60 minutes
- File read timeout: 5 seconds
- Terminal command timeout: 30 seconds
- Sandbox auto-pause: 10 minutes inactivity
- Sandbox transfer trigger: 55 minutes
- Dev server health check: 10 seconds

### Size Limits
- Max file: 10MB per file
- Max file count: 500 files
- Max screenshots: 20 (disabled for speed)
- Inngest step output: 1MB (enforced via batching)
- Merged files total: 4MB warn, 5MB error
- Prompt: 10,000 chars max
- Files per step: 100

### Optimizations
- Disabled screenshots (no progressive feedback)
- Disabled URL crawling (no context loading)
- Limited message history (last 1 only)
- Early-exit network router (exit when summary exists)
- Sandbox caching (5-minute expiry)
- Memory monitoring (warn if >85% usage)

---

## 11. Extension Points

### Possible Future Features

1. **Streaming responses**: Infrastructure ready, disabled for speed
   - Progressively stream file creation
   - Need WebSocket support in Convex

2. **Real-time collaboration**: Convex subscriptions support it
   - Project sharing, conflict-free editing

3. **Custom frameworks**: Extend framework selector
   - User-defined framework configs

4. **AI model fine-tuning**: Already has model selection
   - Train custom models per framework

5. **Code review**: Fragment metadata extensible
   - Review comments, review workflow

6. **Version control**: Natural Git integration
   - Auto-commit generated code, history tracking

7. **Testing**: Extend validation loop
   - Test suite generation, results in auto-fix loop

8. **Performance profiling**: E2B can run profilers
   - Lighthouse, bundle size, runtime profiling

---

## Summary

ZapDev demonstrates:
- **Clean architecture**: Clear separation (UI, backend, AI, execution)
- **Scalability**: Inngest for jobs, Convex for real-time data
- **Multi-model support**: 6 LLMs with auto-selection logic
- **Robustness**: Comprehensive validation, auto-fix, error recovery
- **Performance focus**: Trade-offs (disabled streaming/screenshots) for speed
- **Extensibility**: Clear patterns for frameworks, models, and features

The system is production-ready with sophisticated error handling, credit-based rate limiting, and real-time collaborative infrastructure.
