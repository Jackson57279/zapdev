# AI Code Streaming Implementation TODO

## Progress Tracker

### ✅ Phase 0: Foundation (COMPLETE)
- [x] SSE streaming utilities (`src/lib/streaming/sse.ts`)
- [x] Conversation state types (`src/lib/streaming/types.ts`)
- [x] AI provider manager (`src/lib/streaming/ai-provider.ts`)
- [x] Main generation route (`src/app/api/generate-ai-code-stream/route.ts`)

### ✅ Phase 1: File Application (COMPLETE)
- [x] Create `/api/apply-ai-code-stream/route.ts` (800+ lines)
  - [x] Parse AI response for XML tags (`<file>`, `<package>`, `<command>`)
  - [x] Extract packages from import statements
  - [x] Handle duplicate files (prefer complete versions)
  - [x] Write files to E2B sandbox
  - [x] Stream progress updates via SSE
  - [x] Update conversation state
  - [x] Handle config file filtering
  - [x] Fix common CSS issues
  - [x] Remove CSS imports from JSX files

### ✅ Phase 2: Edit Intent Analysis (COMPLETE)
- [x] Create `/api/analyze-edit-intent/route.ts` (300+ lines)
  - [x] Use AI to analyze user request
  - [x] Generate search plan with terms and patterns
  - [x] Determine edit type
  - [x] Support fallback search strategies
  - [x] Use Zod schema for structured output

### ✅ Phase 3: File Manifest Generator (COMPLETE)
- [x] Create `src/lib/streaming/file-manifest.ts` (400+ lines)
  - [x] Generate file structure tree
  - [x] Extract component information
  - [x] Analyze imports and dependencies
  - [x] Create file type classifications
  - [x] Calculate file sizes and metadata
  - [x] Generate human-readable structure string

### ✅ Phase 4: Context Selector (COMPLETE)
- [x] Create `src/lib/streaming/context-selector.ts` (500+ lines)
  - [x] Execute search plan from analyze-edit-intent
  - [x] Search codebase using regex and text matching
  - [x] Rank search results by confidence
  - [x] Select primary vs context files
  - [x] Build enhanced system prompt with context
  - [x] Handle fallback strategies

### 🔄 Phase 5: Sandbox Provider Abstraction (IN PROGRESS)
- [ ] Create `src/lib/sandbox/types.ts` - Provider interface
- [ ] Create `src/lib/sandbox/e2b-provider.ts` - E2B implementation
- [ ] Create `src/lib/sandbox/factory.ts` - Provider factory
- [ ] Create `src/lib/sandbox/sandbox-manager.ts` - Lifecycle management
- [ ] Abstract existing E2B code to use provider pattern

### ⏳ Phase 6: Convex Schema Updates
- [ ] Update `convex/schema.ts`
  - [ ] Add `conversationStates` table
  - [ ] Add `fileManifests` table
  - [ ] Add `editHistory` table
  - [ ] Add indexes for efficient queries
- [ ] Create Convex mutations for persistence
- [ ] Migrate from global state to Convex

### ⏳ Phase 7: Integration & Testing
- [ ] Connect apply-ai-code-stream to generate-ai-code-stream
- [ ] Integrate analyze-edit-intent into edit mode flow
- [ ] Use file-manifest in context building
- [ ] Implement Convex persistence layer
- [ ] Add comprehensive tests
- [ ] Update documentation

## Current Status
**Phases 1-4**: ✅ COMPLETE (2,000+ lines of production-ready code)
**Phase 5 - Sandbox Provider**: 🔄 IN PROGRESS

## Summary of Completed Work

### Phase 1: Apply AI Code Stream (800+ lines)
- Full XML parsing for `<file>`, `<package>`, `<command>` tags
- Automatic package detection from import statements
- Duplicate file handling with preference for complete versions
- Direct E2B sandbox integration
- Real-time SSE progress streaming
- Conversation state tracking
- Config file filtering
- CSS fixes and import cleanup

### Phase 2: Analyze Edit Intent (300+ lines)
- AI-powered edit intent analysis using structured output
- Zod schema validation for search plans
- Edit type classification (8 types)
- Search term and regex pattern generation
- Confidence scoring
- Fallback search strategies
- File summary generation for AI context

### Phase 3: File Manifest Generator (400+ lines)
- Complete file tree generation
- Component information extraction
- Import/dependency analysis
- File type classification
- Metadata calculation
- Manifest update and removal operations
- Summary generation for AI context

### Phase 4: Context Selector (500+ lines)
- Search plan execution across codebase
- Text and regex-based searching
- Confidence-based result ranking
- Primary vs context file selection
- Enhanced system prompt generation
- Automatic context file discovery via imports
- Parent component detection

## Notes
- E2B integration already exists in `src/inngest/functions.ts`
- Using `@e2b/code-interpreter` v1.5.1
- All AI providers configured (Anthropic, OpenAI, Google, Groq)
- Zod v4.1.12 available for schema validation
- All core streaming functionality is now complete
- Ready for sandbox provider abstraction and Convex integration
