# Multi-Framework Support Implementation

## Overview
Successfully implemented support for multiple web frameworks (Angular, React, Vue, Svelte) in addition to the existing Next.js support. The system now automatically detects or selects the appropriate framework based on user input.

## Changes Made

### 1. Database Schema Updates
**File:** `prisma/schema.prisma`

- Added `Framework` enum with values: `NEXTJS`, `ANGULAR`, `REACT`, `VUE`, `SVELTE`
- Added `framework` field to `Project` model with default value `NEXTJS`
- Added `framework` field to `Fragment` model with default value `NEXTJS`
- Schema pushed to database successfully using `prisma db push`

### 2. Type Definitions
**File:** `src/inngest/types.ts`

- Added `Framework` type: `'nextjs' | 'angular' | 'react' | 'vue' | 'svelte'`
- Added `AgentState` interface with:
  - `summary: string`
  - `files: { [path: string]: string }`
  - `selectedFramework?: Framework`

### 3. Prompt System Refactoring
**Directory:** `src/prompts/`

Created modular prompt system:
- `shared.ts` - Common rules and prompts shared across all frameworks
- `framework-selector.ts` - Framework detection prompt
- `nextjs.ts` - Next.js specific configuration
- `angular.ts` - Angular 19 + Angular Material + Tailwind
- `react.ts` - React 18 + Vite + Chakra UI + Tailwind
- `vue.ts` - Vue 3 + Vite + Vuetify + Tailwind
- `svelte.ts` - SvelteKit + DaisyUI + Tailwind

**File:** `src/prompt.ts` - Updated to re-export from the new prompt structure

### 4. Framework Selection Agent
**File:** `src/inngest/functions.ts`

Implemented intelligent framework detection:
- `frameworkSelectorAgent` - Uses `google/gemini-2.5-flash-lite` model
- Analyzes user input to determine the best framework
- Defaults to Next.js if framework not explicitly mentioned
- Updates project with selected framework for consistency

### 5. Framework-Specific Code Agents
**File:** `src/inngest/functions.ts`

Created dynamic agent system:
- Helper functions:
  - `getE2BTemplate()` - Maps framework to E2B template name
  - `getFrameworkPort()` - Returns correct dev server port per framework
  - `getFrameworkPrompt()` - Returns framework-specific prompt
  - `createCodeAgentTools()` - Creates framework-agnostic tools (terminal, createOrUpdateFiles, readFiles)
  - `toPrismaFramework()` - Converts string framework to Prisma enum

- Enhanced `codeAgentFunction`:
  1. Fetches project to check existing framework
  2. Runs framework selector if framework not set
  3. Creates sandbox with framework-specific template
  4. Creates code agent with framework-specific prompt
  5. Stores framework in both project and fragment

### 6. Sandbox Templates
**Directory:** `sandbox-templates/`

Created E2B Dockerfiles for each framework:

- **Angular** (`sandbox-templates/angular/e2b.Dockerfile`):
  - Angular CLI 19
  - Angular Material
  - Tailwind CSS
  - Dev server on port 4200

- **React** (`sandbox-templates/react/e2b.Dockerfile`):
  - React 18 + Vite
  - Chakra UI
  - Tailwind CSS
  - Dev server on port 5173

- **Vue** (`sandbox-templates/vue/e2b.Dockerfile`):
  - Vue 3 + Vite
  - Vuetify 3
  - Tailwind CSS
  - Dev server on port 5173

- **Svelte** (`sandbox-templates/svelte/e2b.Dockerfile`):
  - SvelteKit
  - DaisyUI
  - Tailwind CSS
  - Dev server on port 5173

- **Next.js** (existing `sandbox-templates/nextjs/e2b.Dockerfile`):
  - Next.js 15.3.3
  - Shadcn UI
  - Tailwind CSS
  - Dev server on port 3000

### 7. Sandbox Transfer Function Update
**File:** `src/inngest/functions.ts`

Updated `sandboxTransferFunction`:
- Reads framework from fragment
- Creates new sandbox with framework-specific template
- Uses correct port for sandbox URL generation
- Maintains framework consistency across transfers

## E2B Template Names
The implementation expects the following E2B template names:
- Next.js: `zapdev`
- Angular: `zapdev-angular`
- React: `zapdev-react`
- Vue: `zapdev-vue`
- Svelte: `zapdev-svelte`

## Framework Detection Logic

The framework selector agent analyzes user input using these guidelines:
1. **Explicit mentions**: If user mentions a specific framework, use it
2. **Ambiguous requests**: Default to Next.js (most versatile)
3. **Complexity indicators**: Enterprise/complex projects → Angular
4. **UI library hints**: Material Design → Angular or Vue
5. **Performance emphasis**: High performance needs → Svelte

## Port Mapping
- Next.js: 3000
- Angular: 4200
- React/Vue/Svelte: 5173

## Backward Compatibility
- Existing projects without a framework field default to `NEXTJS`
- All existing code continues to work without modification
- Framework field is optional in the database with default values

## Testing Requirements

Before deploying to production, the following E2B templates must be built and published:
1. Build each Dockerfile: `cd sandbox-templates/<framework> && e2b template build`
2. Publish templates with correct names: `zapdev-angular`, `zapdev-react`, `zapdev-vue`, `zapdev-svelte`
3. Test each framework by creating a project with framework-specific requests

## Verification Status
✅ Database schema updated and synced
✅ TypeScript compilation successful (no type errors)
✅ All prompts created with framework-specific configurations
✅ Framework selector agent implemented
✅ Code agent dynamically uses framework-specific prompts
✅ Sandbox templates created for all frameworks
✅ Sandbox creation uses framework-specific templates
✅ Fragment creation stores framework information

## Next Steps
1. **Build and publish E2B templates** for Angular, React, Vue, and Svelte
2. **Test each framework** with sample projects:
   - "Build a todo app" (should default to Next.js)
   - "Build an Angular dashboard" (should select Angular)
   - "Create a React shopping cart" (should select React)
   - "Make a Vue calendar" (should select Vue)
   - "Build a Svelte portfolio" (should select Svelte)
3. **Monitor framework selection** accuracy in production
4. **Optional**: Add UI framework selector dropdown in project creation form

## Architecture Benefits
- **Modular**: Each framework has isolated configuration
- **Extensible**: Easy to add new frameworks
- **Intelligent**: Automatic framework detection
- **Backward Compatible**: Existing projects unaffected
- **Type-Safe**: Full TypeScript coverage
- **Maintainable**: Shared rules reduce duplication
