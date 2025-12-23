# Open-Lovable Codebase Analysis: Complete Architecture Guide

## Executive Summary

Open-Lovable is a sophisticated AI-powered web app generator with a streaming-first architecture. It combines real-time code generation with sandbox execution, conversation state management, and multi-model AI support. The system is designed for incremental edits and full-stack development without configuration overhead.

---

## 1. AGENT ARCHITECTURE & GENERATION FLOW

### 1.1 Generation Pipeline Overview

```
User Input → Sandbox Setup → AI Code Generation → Application → Preview
     ↓              ↓                ↓                  ↓            ↓
[Home Page] → [Create/Restore] → [Streaming Response] → [Parse & Apply] → [Refresh]
```

### 1.2 Core Generation Flow

**Phase 1: Initial Setup**
- User enters URL/search query on homepage
- Optional: Select design style, choose AI model
- Optional: Provide additional instructions

**Phase 2: Sandbox Initialization**
- Create/restore E2B or Vercel sandbox
- Set up Vite React development environment
- Initialize file cache for context management

**Phase 3: AI Generation**
- Send prompt with full file context to AI model
- Stream text response in real-time
- Extract `<file>` tags from streamed response
- Maintain conversation state (messages, edits, project evolution)

**Phase 4: Code Application**
- Parse extracted files and dependencies
- Auto-detect packages from import statements
- Install missing packages incrementally
- Write files to sandbox file system
- Optionally apply "Morph Fast Apply" edits for surgery-level changes

**Phase 5: Validation & Display**
- Execute automatic linting/build validation
- Refresh iframe preview
- Track conversation history and edits

### 1.3 Edit Mode vs Generation Mode

**Full Generation Mode** (Initial code creation)
- No existing files in sandbox
- Create complete application structure
- Generate all necessary components

**Edit Mode** (Incremental changes)
- Leverage existing file context via manifest
- Use "AI intent analyzer" to determine surgical targets
- Only regenerate modified files
- Apply edits with minimal disruption

### 1.4 Context Selection Strategy

**Dynamic File Context:**
1. **File Manifest** - Structure of all project files
2. **Search-Based Edit Intent** - AI analyzes user request to find exact files
3. **Conversation History** - Track edits, major changes, user preferences
4. **Primary vs Context Files** - Primary files get modified, context files are reference-only

---

## 2. API ROUTES STRUCTURE

### Complete Route Inventory

#### Sandbox Management Routes

| Route | Method | Purpose | Response |
|-------|--------|---------|----------|
| `/api/create-ai-sandbox` | POST | Create new E2B/Vercel sandbox with Vite setup | `{ sandboxId, url }` |
| `/api/create-ai-sandbox-v2` | POST | V2 sandbox creation with provider abstraction | `{ sandboxId, url, provider }` |
| `/api/kill-sandbox` | POST | Terminate active sandbox | `{ success, message }` |
| `/api/conversation-state` | GET/POST | Manage conversation history and context | State data |

#### Code Generation Routes

| Route | Method | Purpose | Response Type |
|-------|--------|---------|------------------|
| `/api/generate-ai-code-stream` | POST | Main streaming AI code generation | SSE Stream (text/event-stream) |
| `/api/apply-ai-code-stream` | POST | Parse and apply generated code to sandbox | SSE Stream (progress updates) |
| `/api/analyze-edit-intent` | POST | AI determines which files to edit for a request | `{ searchPlan, editType }` |

#### File Operations Routes

| Route | Method | Purpose | Response |
|-------|--------|---------|----------|
| `/api/get-sandbox-files` | GET | Fetch all files + manifest from sandbox | `{ files, manifest }` |
| `/api/run-command` | POST | Execute shell commands in sandbox | `{ stdout, stderr, exitCode }` |
| `/api/run-command-v2` | POST | V2 command execution | `{ result, output }` |
| `/api/install-packages` | POST | NPM package installation (streaming) | SSE Stream |
| `/api/install-packages-v2` | POST | V2 package installation | `{ success, output }` |
| `/api/detect-and-install-packages` | POST | Auto-detect + install missing packages | `{ detected, installed }` |
| `/api/create-zip` | POST | Create downloadable project ZIP | Binary blob |

#### Web Scraping Routes

| Route | Method | Purpose | Response |
|-------|--------|---------|----------|
| `/api/scrape-website` | POST | Scrape website content (markdown) | `{ content, url, title }` |
| `/api/scrape-url-enhanced` | POST | Enhanced scraping with metadata | `{ markdown, screenshot, metadata }` |
| `/api/scrape-screenshot` | POST | Capture website screenshot | `{ screenshot, url }` |
| `/api/extract-brand-styles` | POST | Extract CSS/design tokens from website | `{ styles, colors, fonts }` |
| `/api/search` | POST | Google/Firecrawl search | `{ results: [{ url, title, description, screenshot }] }` |

#### Developer/Debug Routes

| Route | Method | Purpose | Response |
|-------|--------|---------|----------|
| `/api/sandbox-logs` | GET | Get Vite/sandbox terminal logs | `{ logs: string[] }` |
| `/api/sandbox-status` | GET | Current sandbox health status | `{ status, uptime, port }` |
| `/api/monitor-vite-logs` | POST | Subscribe to real-time Vite logs | SSE Stream |
| `/api/report-vite-error` | POST | Report/store Vite build errors | `{ success, error }` |
| `/api/check-vite-errors` | GET | Fetch cached Vite errors | `{ errors: [] }` |
| `/api/restart-vite` | POST | Restart Vite dev server | `{ success, message }` |

### 2.1 Streaming Route Deep Dive: generate-ai-code-stream

**Endpoint:** `POST /api/generate-ai-code-stream`

**Request Payload:**
```typescript
{
  prompt: string;                    // User request
  model?: string;                    // AI model (e.g., 'anthropic/claude-sonnet-4')
  isEdit?: boolean;                  // Edit vs generation mode
  context?: {
    sandboxId: string;
    currentFiles: Record<string, string>;
    structure: string;
    conversationContext?: {
      scrapedWebsites: any[];
      currentProject: string;
    };
  };
}
```

**Response Format:** Server-Sent Events (SSE)
```typescript
type StreamData = 
  | { type: 'status'; message: string }
  | { type: 'stream'; text: string; raw: boolean }
  | { type: 'component'; name: string; path: string; index: number }
  | { type: 'package'; name: string; message: string }
  | { type: 'conversation'; text: string }
  | { type: 'complete'; generatedCode: string; files: number; ... }
  | { type: 'error'; error: string };
```

**Key Features:**
1. **Real-time streaming** - Text chunks stream as they're generated
2. **Multi-provider support** - Anthropic, OpenAI, Google Gemini, Groq/Kimi
3. **Conversation awareness** - Tracks edits, major changes, user preferences
4. **Automatic package detection** - Extracts imports and suggests installations
5. **Truncation recovery** - Attempts to complete incomplete files automatically
6. **Morph Fast Apply mode** - For surgical edits (requires MORPH_API_KEY)

**Critical System Prompts Sent:**
- **For Initial Generation:** Instructions to create complete, beautiful first experience
- **For Edit Mode:** Surgical precision rules, file targeting, preservation requirements
- **For Conversation Context:** Recent edits, created files, user preferences

---

## 3. STREAMING IMPLEMENTATION PATTERNS

### 3.1 Server-Sent Events (SSE) Architecture

**Pattern Used Throughout:**
```typescript
const encoder = new TextEncoder();
const stream = new TransformStream();
const writer = stream.writable.getWriter();

const sendProgress = async (data: any) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  await writer.write(encoder.encode(message));
};

// Background processing
(async () => {
  await sendProgress({ type: 'status', message: '...' });
  // Process work
  await writer.close();
})();

return new Response(stream.readable, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable nginx buffering
  },
});
```

### 3.2 Frontend Streaming Consumption

**Pattern from generation page:**
```typescript
const response = await fetch('/api/generate-ai-code-stream', { method: 'POST' });
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Handle different event types
      switch (data.type) {
        case 'status':
          setStatus(data.message);
          break;
        case 'stream':
          setStreamedCode(prev => prev + data.text);
          break;
        case 'complete':
          applyGeneratedCode(data);
          break;
      }
    }
  }
}
```

### 3.3 Key Streaming Patterns

**Pattern 1: Keep-Alive Messages**
- For long-running operations, send periodic keep-alive comments
- Prevents connection timeout: `await writer.write(encoder.encode(': keepalive\n\n'))`

**Pattern 2: Progress Tracking**
- Send granular progress updates for UX feedback
- `{ type: 'file-progress', current: 1, total: 5, fileName: '...' }`

**Pattern 3: Error Handling**
- Stream errors don't break connection
- Send error as data event: `{ type: 'error', error: '...' }`

**Pattern 4: Buffering Large Responses**
- Stream response in chunks for memory efficiency
- Parse XML tags (`<file>`, `<package>`) during streaming

---

## 4. FILE HANDLING & SANDBOX PERSISTENCE

### 4.1 Sandbox Provider Abstraction

**Two Provider Implementations:**

1. **E2B Provider**
   - Full Linux sandbox with persistent state
   - 30-minute timeout (configurable)
   - Supports file API, terminal execution, package management
   - Vite dev server on port 5173

2. **Vercel Sandbox Provider**
   - Lighter-weight sandbox environment
   - 15-minute timeout
   - Better for quick generations, limited persistence
   - Dev server on port 3000

**Provider Interface (Abstract Class):**
```typescript
abstract class SandboxProvider {
  abstract createSandbox(): Promise<SandboxInfo>;
  abstract runCommand(command: string): Promise<CommandResult>;
  abstract writeFile(path: string, content: string): Promise<void>;
  abstract readFile(path: string): Promise<string>;
  abstract listFiles(directory?: string): Promise<string[]>;
  abstract installPackages(packages: string[]): Promise<CommandResult>;
  abstract getSandboxUrl(): string | null;
  abstract setupViteApp(): Promise<void>;
  abstract restartViteServer(): Promise<void>;
}
```

### 4.2 File Cache & Manifest System

**Global File Cache:**
```typescript
global.sandboxState = {
  fileCache: {
    files: {
      'src/App.jsx': { content: '...', lastModified: 1234567890 },
      'src/index.css': { content: '...', lastModified: 1234567890 }
    },
    manifest: {  // File structure for AI context
      files: {
        'src/App.jsx': { type: 'jsx', size: 1024, ... },
        'src/components/': { type: 'directory', ... }
      },
      structure: 'src/\n  App.jsx\n  components/\n    Hero.jsx'
    },
    lastSync: 1234567890,
    sandboxId: 'sandbox-123'
  }
};
```

**Manifest Structure Used by AI:**
- Maps all files in the project
- Enables "Edit Intent Analysis" - AI determines exact files to modify
- Generated by `/api/get-sandbox-files` route

### 4.3 File Operations Workflow

**Write File Flow:**
```
API Request
    ↓
Check if file exists (in global.existingFiles)
    ↓
Create directory if needed: mkdir -p <dir>
    ↓
Write file via provider: provider.writeFile()
    ↓
Update file cache: global.sandboxState.fileCache.files[path] = { content, lastModified }
    ↓
Add to tracking set: global.existingFiles.add(path)
```

**Read File Flow:**
```
Check file cache first (fast)
    ↓
If not in cache, fetch from sandbox: /api/get-sandbox-files
    ↓
Parse and update cache
    ↓
Return to AI for context
```

### 4.4 Special File Handling

**Config Files That Cannot Be Created:**
```typescript
['tailwind.config.js', 'vite.config.js', 'package.json', 'tsconfig.json', ...]
```
Reason: Template includes pre-configured environments

**CSS File Fixes Applied Automatically:**
```typescript
// Replace invalid Tailwind classes
'shadow-3xl' → 'shadow-2xl'
'shadow-4xl' → 'shadow-2xl'
```

**Import Cleanup:**
```typescript
// Remove CSS imports from JSX files (using Tailwind only)
/import\s+['"]\.\/[^'"]+\.css['"];?\s*\n?/g → ''
```

### 4.5 Sandbox Persistence

**Sandbox Lifecycle:**
1. **Creation** - New sandbox provisioned (E2B: 30 min, Vercel: 15 min)
2. **Setup** - Vite React app initialized with package.json
3. **File Operations** - Files written to `/home/user/app` (E2B) or `/app` (Vercel)
4. **State Caching** - Files cached in-memory for quick reference
5. **Restoration** - Can reconnect to E2B sandbox by ID within timeout

**Sandbox Manager** handles lifecycle:
```typescript
sandboxManager.registerSandbox(sandboxId, provider);
sandboxManager.getProvider(sandboxId);
sandboxManager.terminateSandbox(sandboxId);
```

---

## 5. AI MODEL INTEGRATION & SELECTION

### 5.1 Model Provider Support

**Supported Models:**
```typescript
availableModels: [
  'openai/gpt-5',
  'anthropic/claude-sonnet-4-20250514',
  'google/gemini-3-pro-preview',
  'moonshotai/kimi-k2-instruct-0905'  // Via Groq
]
```

**Default Model:** `'google/gemini-3-pro-preview'`

**Model Display Names:**
```typescript
{
  'openai/gpt-5': 'GPT-5',
  'anthropic/claude-sonnet-4-20250514': 'Sonnet 4',
  'google/gemini-3-pro-preview': 'Gemini 3 Pro (Preview)',
  'moonshotai/kimi-k2-instruct-0905': 'Kimi K2 (Groq)'
}
```

### 5.2 Provider Detection & Initialization

**Provider Detection Logic:**
```typescript
const isAnthropic = model.startsWith('anthropic/');
const isGoogle = model.startsWith('google/');
const isOpenAI = model.startsWith('openai/');
const isKimiGroq = model === 'moonshotai/kimi-k2-instruct-0905';

const modelProvider = isAnthropic ? anthropic : 
                     (isOpenAI ? openai : 
                     (isGoogle ? googleGenerativeAI : groq));
```

**Model Name Transformation:**
```typescript
// Each provider uses different naming conventions
let actualModel: string;
if (isAnthropic) {
  actualModel = model.replace('anthropic/', '');  // 'claude-sonnet-4-20250514'
} else if (isOpenAI) {
  actualModel = model.replace('openai/', '');      // 'gpt-5'
} else if (isGoogle) {
  actualModel = model.replace('google/', '');      // 'gemini-3-pro-preview'
} else if (isKimiGroq) {
  actualModel = 'moonshotai/kimi-k2-instruct-0905'; // Full model string
}
```

### 5.3 AI Gateway Support

**Optional: Vercel AI Gateway**
```typescript
const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

// All providers can use AI Gateway for unified API
const anthropic = createAnthropic({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
});
```

### 5.4 Stream Configuration per Model

**Temperature:**
- GPT-5 (reasoning): No temperature (uses reasoning effort)
- Others: temperature = 0.7

**Max Tokens:**
- Default: 8,192
- Truncation recovery: 4,000

**Special Handling:**
```typescript
// OpenAI reasoning models
if (isOpenAI && model.includes('gpt-5')) {
  streamOptions.experimental_providerMetadata = {
    openai: { reasoningEffort: 'high' }
  };
}

// Retry logic for service unavailability
if (retryCount < maxRetries && isRetryableError) {
  // Exponential backoff: 2s, 4s
  // Fallback to GPT-4 if Groq fails
}
```

### 5.5 Conversation-Aware Prompting

**User Preference Analysis:**
```typescript
function analyzeUserPreferences(messages: ConversationMessage[]) {
  // Count edit patterns to determine style
  const targetedEditCount = messages.filter(m => 
    m.content.match(/\b(update|change|fix|modify|edit)\b/)
  ).length;
  
  const comprehensiveEditCount = messages.filter(m =>
    m.content.match(/\b(rebuild|recreate|redesign|overhaul)\b/)
  ).length;
  
  return {
    commonPatterns: [...new Set(patterns)],
    preferredEditStyle: targetedEditCount > comprehensiveEditCount 
      ? 'targeted' 
      : 'comprehensive'
  };
}
```

**Injected into System Prompt:**
```
## User Preferences:
- Edit style: targeted
- Common patterns: hero section edits, styling changes, button updates
```

---

## 6. STATE MANAGEMENT

### 6.1 Conversation State Structure

**Global Conversation State:**
```typescript
global.conversationState: ConversationState = {
  conversationId: string;
  startedAt: number;
  lastUpdated: number;
  context: {
    messages: ConversationMessage[];      // Full history
    edits: ConversationEdit[];            // Edit operations
    projectEvolution: {
      initialState?: string;
      majorChanges: Array<{
        timestamp: number;
        description: string;
        filesAffected: string[];
      }>;
    };
    userPreferences: {
      editStyle?: 'targeted' | 'comprehensive';
      commonRequests?: string[];
      packagePreferences?: string[];
    };
  };
}
```

**Message History:**
```typescript
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    editedFiles?: string[];
    addedPackages?: string[];
    editType?: string;
    sandboxId?: string;
  };
}
```

**Edit Record:**
```typescript
interface ConversationEdit {
  timestamp: number;
  userRequest: string;
  editType: string;  // 'UPDATE_COMPONENT', 'ADD_FEATURE', etc.
  targetFiles: string[];
  confidence: number;  // 0-1
  outcome: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}
```

### 6.2 Conversation Pruning Strategy

**Memory Optimization:**
```typescript
// Keep only last 15 messages (prevent unbounded growth)
if (global.conversationState.context.messages.length > 20) {
  global.conversationState.context.messages = 
    global.conversationState.context.messages.slice(-15);
}

// Keep only last 8 edits
if (global.conversationState.context.edits.length > 10) {
  global.conversationState.context.edits = 
    global.conversationState.context.edits.slice(-8);
}

// Send to AI context (condensed):
// - Last 3 edits
// - Recently created files (prevent re-creation)
// - Last 5 messages
// - Last 2 major changes
```

### 6.3 Sandbox State Management

**Global Sandbox State:**
```typescript
global.sandboxState: SandboxState = {
  fileCache: {
    files: Record<string, SandboxFile>;
    manifest: FileManifest;
    lastSync: number;
    sandboxId: string;
  };
}

global.activeSandboxProvider: SandboxProvider;
global.existingFiles: Set<string>;  // Tracks which files have been written
```

**State Persistence Pattern:**
```typescript
// On file write
global.sandboxState.fileCache.files[normalizedPath] = {
  content: fileContent,
  lastModified: Date.now()
};

// On file read (with caching)
const cached = global.sandboxState.fileCache.files[path];
if (cached) return cached.content;  // Fast path
else return provider.readFile(path);  // Slow path + cache
```

### 6.4 Edit Intent Analysis

**Step 1: Manifest-Based Search**
```
User says: "update the hero button"
    ↓
Manifest lists all files
    ↓
AI analyzes: "hero" likely in Hero.jsx, "button" might be in Button.jsx
    ↓
Return editContext with primary/context files
```

**Step 2: Agentic Search Workflow (for edit mode)**
```
Analyze Edit Intent → Search Codebase → Select Target File → Create Edit Context
     ↓                   ↓                    ↓                    ↓
(/analyze-edit-intent) (executeSearchPlan) (selectTargetFile)  (Enhanced Prompt)
```

**Step 3: Fallback Strategies**
```
Try: AI intent analysis with manifest
  → If fails: Use keyword-based file selection
    → If that fails: Show all files as context
      → If no context: Provide warning to user
```

### 6.5 Conversation-Aware Features

**Recently Created Files Prevention:**
```
User previously requested: "Create Hero.jsx"
System created: Hero.jsx, saved in conversationState.messages[].metadata.editedFiles
    ↓
User says: "update the hero"
    ↓
System detects Hero.jsx in recently created files
    ↓
Sends to AI: "🚨 RECENTLY CREATED FILES (DO NOT RECREATE): Hero.jsx"
```

**User Preference Tracking:**
```
User edits: "add a chart", "update colors", "change spacing"
    ↓
Pattern analysis: User prefers targeted edits
    ↓
System includes in next prompt: "Edit style: targeted"
    ↓
AI generates minimal changes instead of full rewrites
```

---

## 7. KEY IMPLEMENTATION DETAILS

### 7.1 Morph Fast Apply (Surgical Edits)

**When Enabled:** `isEdit && process.env.MORPH_API_KEY`

**Purpose:** Ultra-fast incremental edits without full file rewrites

**XML Format Expected:**
```xml
<edit target_file="src/components/Header.jsx">
  <instructions>Change button color from blue to red</instructions>
  <update>className="bg-red-500"</update>
</edit>
```

**Application Flow:**
```
Parse <edit> blocks
    ↓
Get original file from cache
    ↓
Apply minimal update snippet
    ↓
Write updated file
    ↓
Skip full-file regeneration for these files
```

### 7.2 Package Detection & Installation

**Detection Sources (in priority order):**
1. `<package>` XML tags in response
2. `<packages>` XML tag with newline/comma-separated list
3. Import statement analysis (automatic extraction)

**Auto-Detected Packages:**
```typescript
// Scan all generated code for imports
const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

// Skip: relative imports, built-ins, Tailwind
// Extract: 'lucide-react', '@heroicons/react', 'framer-motion'
```

**Installation Streaming:**
```
Detect packages → Deduplicate → Install via npm
                                    ↓
                            Stream progress events
                                    ↓
                            Auto-restart Vite if enabled
```

### 7.3 Truncation Detection & Recovery

**Detection Triggers:**
1. File count mismatch: `<file>` opens ≠ `</file>` closes
2. Obvious HTML truncation: ends with `<` or `</`
3. Severely unmatched braces (>3 difference)
4. File too short and incomplete

**Recovery Strategy:**
```
Detected truncation
    ↓
Identify truncated files
    ↓
Send focused completion request to AI
    ↓
"Complete the following truncated file..."
    ↓
Extract cleaned content
    ↓
Replace in generated code
```

### 7.4 Dynamic Context Selection

**For Generation (First Time):**
- Show all available files
- Include full file contents
- Initialize fresh conversation

**For Edit Mode:**
1. Get file manifest (structure only)
2. Analyze user request intent
3. Determine primary files (to edit)
4. Determine context files (reference)
5. Include full contents of primary files only
6. Use manifest structure for others

### 7.5 Vite Error Handling

**Error Detection:**
- Route: `/api/check-vite-errors` - Get cached errors
- Route: `/api/report-vite-error` - Store new errors
- Route: `/api/restart-vite` - Recover from broken state

**Automatic Recovery:**
```
Vite build fails
    ↓
System detects: "Module not found", "Syntax error", etc.
    ↓
Attempt auto-fix (retry up to 2 times)
    ↓
If still fails: Show error to user with recovery options
```

---

## 8. FRONTEND DATA FLOW

### 8.1 Home Page (`/page.tsx`)

**Key States:**
```typescript
[url, setUrl]                          // User input
[selectedStyle, setSelectedStyle]      // Design style
[selectedModel, setSelectedModel]      // AI model
[searchResults, setSearchResults]      // Search results
[extendBrandStyles, setExtendBrandStyles]  // Brand extension mode
```

**Actions:**
1. User enters URL → Validate → Scrape website (optional)
2. User selects design → Apply style to generation
3. User chooses model → Pass to generation page
4. User provides instructions → Pass to AI

**Navigation:**
```
Home Page → Generation Page
           (pass: targetUrl, selectedStyle, selectedModel via sessionStorage)
```

### 8.2 Generation Page (`/generation/page.tsx`)

**Major State Groups:**
```typescript
// Sandbox
sandboxData: { sandboxId, url }
loading: boolean

// Chat Interface
chatMessages: ChatMessage[]
promptInput: string

// Generation Progress
generationProgress: {
  isGenerating: boolean
  status: string
  streamedCode: string
  files: Array<{ path, content, type, completed }>
  isEdit?: boolean
}

// Conversation Context
conversationContext: {
  scrapedWebsites: Array<{ url, content, timestamp }>
  generatedComponents: Array<{ name, path, content }>
  appliedCode: Array<{ files, timestamp }>
}
```

**Key Flow:**
1. Mount → Create sandbox
2. (Auto) Start generation with URL
3. Stream response & display real-time
4. Parse files & apply
5. Refresh preview

---

## 9. PORTING CONSIDERATIONS FOR ZAPDEV

### Critical Pieces to Port

**Must Have:**
1. ✅ Streaming response handler (SSE implementation)
2. ✅ Multi-model AI integration (Anthropic, OpenAI, etc.)
3. ✅ Conversation state management
4. ✅ File manifest & context selection
5. ✅ Sandbox provider abstraction
6. ✅ Edit intent analysis
7. ✅ Package detection from imports

**Nice to Have:**
1. Morph Fast Apply (requires API key)
2. Agentic search workflow
3. Multiple sandbox providers (E2B, Vercel)
4. Advanced truncation recovery

### Adapting for Zapdev's Convex Backend

**Current Architecture (Open-Lovable):**
- Global in-memory state (conversation, sandbox, files)
- Session-based (request context)
- Stateless API routes

**Zapdev Changes Needed:**
- Move global state → Convex database
- Persist conversation history
- Track sandbox lifecycle
- Store file manifests
- Cache file contents in Convex

### Configuration Points

**AppConfig Structure:**
```typescript
appConfig = {
  ai: {
    defaultModel: 'google/gemini-3-pro-preview',
    availableModels: [...],
    modelDisplayNames: {...},
    defaultTemperature: 0.7,
    maxTokens: 8000
  },
  e2b: {
    timeoutMinutes: 30,
    vitePort: 5173
  },
  vercelSandbox: {
    timeoutMinutes: 15,
    devPort: 3000
  },
  codeApplication: {
    enableTruncationRecovery: false,
    defaultRefreshDelay: 2000
  }
}
```

---

## 10. SYSTEM PROMPTS & CONTEXT INJECTION

### Generation System Prompt Highlights

**For Initial Generation:**
```
You are an expert React developer with perfect memory of the conversation.
Generate clean, modern React code for Vite applications.

CRITICAL RULES:
1. DO EXACTLY WHAT IS ASKED - NOTHING MORE, NOTHING LESS
2. CHECK App.jsx FIRST - ALWAYS see what components exist before creating new ones
3. USE STANDARD TAILWIND CLASSES ONLY (bg-white, text-black, NOT bg-background)
4. FILE COUNT LIMITS:
   - Simple style/text change = 1 file ONLY
   - New component = 2 files MAX
   - If >3 files, YOU'RE DOING TOO MUCH
5. DO NOT CREATE SVGs FROM SCRATCH unless explicitly asked
6. NEVER TRUNCATE FILES - include EVERY line
```

**For Edit Mode (Surgical):**
```
CRITICAL: THIS IS AN EDIT TO AN EXISTING APPLICATION

1. DO NOT regenerate the entire application
2. DO NOT create files that already exist
3. ONLY edit the EXACT files needed
4. If user says "update the header", ONLY edit Header - DO NOT touch Footer
5. When adding components:
   - Create new component file
   - UPDATE ONLY parent that imports it
   - NOT both parent and sibling files

CRITICAL FILE MODIFICATION RULES:
- **NEVER TRUNCATE** - Always return COMPLETE files
- **NO ELLIPSIS** - Include every single line
- Files must be complete and runnable
```

**For Conversation Context:**
```
## Conversation History (Recent)
- Recent Edits: "change hero color" → UPDATE_COMPONENT
- Recently Created Files: Hero.jsx, Button.jsx
  (DO NOT RECREATE THESE)
- User Preferences: Edit style = targeted

If user mentions any recently created components, UPDATE the existing file!
```

---

## 11. ERROR RECOVERY STRATEGIES

### Package Installation Errors
```
npm install fails
    ↓
Log error to results
    ↓
Send warning to user
    ↓
Continue with file creation (packages can be installed later)
```

### Sandbox Creation Errors
```
Sandbox creation fails
    ↓
Return deduplication promise (prevent multiple attempts)
    ↓
After timeout, allow retry
    ↓
Provide detailed error to user
```

### AI Generation Errors
```
Groq service unavailable
    ↓
Retry with exponential backoff (2s, 4s)
    ↓
If Kimi fails twice, fallback to GPT-4
    ↓
Send error message to user with retry option
```

### Truncated Code Recovery
```
Detected incomplete file (e.g., Hero.jsx ends mid-function)
    ↓
Create focused completion prompt
    ↓
Call AI to complete just that file
    ↓
Replace in generated code
    ↓
Report success/failure to user
```

---

## Summary Table: Key Concepts

| Concept | Location | Purpose |
|---------|----------|---------|
| **Streaming** | `generate-ai-code-stream` | Real-time code generation with text chunks |
| **State** | `global.conversationState` | Multi-turn conversation tracking |
| **Context** | `generate-ai-code-stream` + manifest | File-aware AI prompting |
| **Providers** | `lib/sandbox/*` | E2B/Vercel abstraction |
| **Parsing** | `apply-ai-code-stream` | Extract files from streamed response |
| **Persistence** | `global.sandboxState.fileCache` | Fast file lookups |
| **Intent Analysis** | `analyze-edit-intent` | AI determines edit targets |
| **Packages** | Import extraction + detection | Auto-install dependencies |
| **Morphing** | `morph-fast-apply` | Ultra-fast surgical edits |
| **Conversation** | `ConversationState` | Project evolution tracking |

