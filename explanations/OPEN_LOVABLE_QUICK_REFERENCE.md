# Open-Lovable Quick Reference for Zapdev Integration

## 30-Second Overview

Open-Lovable is an AI code generator with:
- **Streaming API** (SSE) for real-time code generation
- **Conversation state** tracking across multiple edits
- **Multi-model AI** support (Anthropic, OpenAI, Google, Groq)
- **Sandbox abstraction** (E2B/Vercel) for code execution
- **Intelligent edit mode** with file targeting (surgical vs comprehensive)
- **Package auto-detection** from imports

---

## Critical Architecture Decisions

### 1. Streaming-First Design
- All heavy operations return Server-Sent Events (SSE) streams
- Enables real-time progress feedback
- Pattern: `{ type: 'status'|'stream'|'component'|'error', ... }`

### 2. Global State Management
- **In-Memory**: `global.conversationState`, `global.sandboxState`
- **For Zapdev**: Move to Convex database for persistence
- Conversation history prevents re-creation of files

### 3. Edit Intent Analysis (AI-Powered)
- AI analyzes user request to determine exact files to modify
- Falls back to keyword matching if intent analysis fails
- Prevents "I'll regenerate everything" problem

### 4. File Manifest System
- Tree structure of all project files for AI context
- Enables smart context selection (show only relevant files)
- Prevents context explosion in prompts

### 5. Provider Abstraction
- Abstract `SandboxProvider` class
- Two implementations: E2B (persistent), Vercel (lightweight)
- Sandbox manager handles lifecycle & reconnection

---

## Top 5 Patterns to Copy

### 1. Server-Sent Events Pattern
```typescript
const stream = new TransformStream();
const writer = stream.writable.getWriter();
const sendProgress = async (data) => {
  await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
};
(async () => { await sendProgress(...); await writer.close(); })();
return new Response(stream.readable, { headers: { 'Content-Type': 'text/event-stream' } });
```

### 2. Conversation State Pruning
```typescript
// Keep last 15 messages (prevent unbounded growth)
if (global.conversationState.context.messages.length > 20) {
  global.conversationState.context.messages = 
    global.conversationState.context.messages.slice(-15);
}
```

### 3. Multi-Model Provider Detection
```typescript
const isAnthropic = model.startsWith('anthropic/');
const isOpenAI = model.startsWith('openai/');
const modelProvider = isAnthropic ? anthropic : (isOpenAI ? openai : groq);
let actualModel = model.replace(/^[^/]+\//, '');
```

### 4. Package Detection from Imports
```typescript
const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
let match;
while ((match = importRegex.exec(content)) !== null) {
  const importPath = match[1];
  if (!importPath.startsWith('.') && importPath !== 'react') {
    packages.push(importPath.split('/')[0]);
  }
}
```

### 5. File Context Selection
```typescript
// For edits: Show only primary files + manifest structure
const primaryFileContents = await getFileContents(editContext.primaryFiles, manifest);
const contextFileContents = await getFileContents(editContext.contextFiles, manifest);
// Primary = full content, Context = structure only
```

---

## API Routes to Implement

| Route | Type | Purpose | Response |
|-------|------|---------|----------|
| `/api/generate-ai-code-stream` | POST | Main streaming generation | SSE |
| `/api/apply-ai-code-stream` | POST | Apply parsed code to sandbox | SSE |
| `/api/analyze-edit-intent` | POST | AI determines which files to edit | JSON |
| `/api/get-sandbox-files` | GET | Fetch all files + manifest | JSON |
| `/api/install-packages` | POST | Install npm packages | SSE |
| `/api/run-command` | POST | Execute shell commands | JSON |
| `/api/create-ai-sandbox` | POST | Create sandbox | JSON |
| `/api/conversation-state` | POST | Manage conversation history | JSON |

---

## Critical System Prompts

### For Generation Mode
```
DO EXACTLY WHAT IS ASKED - NOTHING MORE, NOTHING LESS
CHECK App.jsx FIRST
USE STANDARD TAILWIND CLASSES ONLY (bg-white not bg-background)
FILE COUNT LIMITS: 1 file for style change, 2 max for new component
NEVER TRUNCATE FILES - include EVERY line
```

### For Edit Mode
```
CRITICAL: THIS IS AN EDIT TO AN EXISTING APPLICATION
1. DO NOT regenerate the entire application
2. DO NOT create files that already exist
3. ONLY edit the EXACT files needed
4. YOU MUST ONLY GENERATE THE FILES LISTED IN "Files to Edit"
```

### For Conversation Context
```
## Recently Created Files (DO NOT RECREATE):
- Hero.jsx, Button.jsx

## Recent Edits:
- "change hero color" → UPDATE_COMPONENT
- "add hero button" → ADD_FEATURE

If user mentions any of these, UPDATE the existing file!
```

---

## State Structures to Adopt

### ConversationState
```typescript
{
  conversationId: string;
  startedAt: number;
  context: {
    messages: ConversationMessage[];  // With metadata: editedFiles, sandboxId
    edits: ConversationEdit[];        // Tracks edit type, outcome, confidence
    projectEvolution: {
      majorChanges: Array<{ timestamp, description, filesAffected }>;
    };
    userPreferences: {
      editStyle: 'targeted' | 'comprehensive';
      commonRequests: string[];
    };
  };
}
```

### SandboxState
```typescript
{
  fileCache: {
    files: Record<string, { content: string; lastModified: number }>;
    manifest: FileManifest;  // Tree structure for AI context
    lastSync: number;
  };
}
```

---

## Integration Checklist for Zapdev

- [ ] Move `global.conversationState` → Convex `conversationHistory` table
- [ ] Move `global.sandboxState.fileCache` → Convex `projectFiles` table
- [ ] Implement `/api/generate-ai-code-stream` with SSE
- [ ] Implement `/api/apply-ai-code-stream` with SSE
- [ ] Add `/api/analyze-edit-intent` for smart file targeting
- [ ] Create file manifest generator for AI context
- [ ] Build package detection from imports
- [ ] Adopt multi-model provider detection logic
- [ ] Implement conversation state pruning strategy
- [ ] Add edit mode system prompts with file targeting rules

---

## Common Pitfalls to Avoid

1. **Unbounded conversation history** → Prune to last 15 messages
2. **Too much context in prompts** → Use manifest structure for non-primary files
3. **Re-creating existing files** → Track in conversationState.messages[].metadata.editedFiles
4. **All provider handling in app.tsx** → Use provider detection logic in route handlers
5. **Truncated code from AI** → Implement detection + recovery with focused completion request
6. **Lost conversation state on refresh** → Store in database (Convex), not memory
7. **Unbounded file cache** → Implement lastSync + periodic refresh
8. **Generic system prompts** → Inject conversation context & user preferences

---

## Configuration Template

```typescript
export const appConfig = {
  ai: {
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    availableModels: [
      'openai/gpt-5',
      'anthropic/claude-sonnet-4-20250514',
      'google/gemini-3-pro-preview'
    ],
    defaultTemperature: 0.7,
    maxTokens: 8192,
  },
  sandbox: {
    e2b: { timeoutMinutes: 30, vitePort: 5173 },
    vercel: { timeoutMinutes: 15, devPort: 3000 },
  },
  codeApplication: {
    enableTruncationRecovery: false,
    defaultRefreshDelay: 2000,
  }
};
```

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `app/api/generate-ai-code-stream/route.ts` | Main generation logic (1900+ lines) |
| `app/api/apply-ai-code-stream/route.ts` | File parsing & application |
| `app/api/analyze-edit-intent/route.ts` | Smart file targeting |
| `lib/sandbox/types.ts` | Provider abstraction |
| `lib/sandbox/sandbox-manager.ts` | Lifecycle management |
| `types/conversation.ts` | State structures |
| `config/app.config.ts` | Configuration |

---

## Success Metrics

After integrating with Zapdev:
- ✅ Users can generate full React apps from URLs
- ✅ Users can request incremental edits (not full rewrites)
- ✅ Conversation history prevents file re-creation
- ✅ Package auto-detection works
- ✅ Multi-model support functional
- ✅ Streaming provides real-time feedback
- ✅ Edit mode targets specific files (surgical)

