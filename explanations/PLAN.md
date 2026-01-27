# Inngest Removal & Open-Lovable Agent Architecture Plan

> **Goal:** Replace Inngest with open-lovable's SSE streaming pattern, using Convex for persistence, AI SDK with OpenRouter, Clerk for auth, and Sentry for logging.

## Overview

### What We're Building

```
Frontend (React) 
    ↓ POST request
API Route (SSE Stream)
    ↓ Trigger
Convex Action (AI Generation)
    ↓ Uses
E2B Sandbox (Code Execution)
    ↓ Store results
Convex Database (Persistence)
    ↓ Real-time updates
Frontend (Live streaming UI)
```

### Key Technologies

| Component | Technology |
|-----------|------------|
| **LLM** | AI SDK + OpenRouter |
| **Database** | Convex |
| **Auth** | Clerk |
| **Sandboxes** | E2B Code Interpreter |
| **Streaming** | Server-Sent Events (SSE) |
| **Logging** | Sentry |
| **Retry Logic** | Custom (Convex Actions) |

---

## Folder Structure

```
src/agents/                        # NEW - Replaces src/inngest/
├── index.ts                       # Main exports
├── client.ts                      # OpenRouter AI SDK client
├── types.ts                       # Shared types & interfaces
├── utils.ts                       # Helper functions
├── sandbox.ts                     # E2B sandbox management
├── retry.ts                       # Automatic retry with exponential backoff
├── logger.ts                      # Sentry integration
├── tools.ts                       # AI agent tools (file, terminal, read)
├── prompts/                       # Framework prompts
│   ├── index.ts
│   ├── nextjs.ts
│   ├── react.ts
│   ├── vue.ts
│   ├── angular.ts
│   └── svelte.ts
├── agents/
│   ├── framework-selector.ts      # AI framework detection
│   ├── code-generation.ts         # Main code generation agent
│   ├── validation.ts              # Lint/build validation
│   └── error-fixer.ts             # Auto-fix errors
└── imports/
    ├── figma.ts                   # Figma import processing
    └── github.ts                  # GitHub import processing

src/app/api/                       # SSE API Routes
├── generate/
│   └── route.ts                   # Main code generation endpoint
├── stream-progress/
│   └── route.ts                   # SSE progress streaming
├── fix-errors/
│   └── route.ts                   # Error fixing endpoint
└── import/
    ├── figma/
    │   └── process/route.ts
    └── github/
        └── process/route.ts

convex/                            # Convex Functions
├── streaming.ts                   # NEW - Streaming state management
├── tasks.ts                       # NEW - Task queue for retry logic
└── ... (existing files)
```

---

## File Specifications

### 1. `src/agents/client.ts` - OpenRouter AI SDK

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// OpenRouter client using AI SDK
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://zapdev.app',
    'X-Title': 'Zapdev',
  },
});

// Model configurations
export const MODEL_CONFIGS = {
  'auto': {
    id: 'openrouter/auto',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'anthropic/claude-haiku-4.5': {
    id: 'anthropic/claude-3-5-haiku',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'google/gemini-2.5-flash-lite': {
    id: 'google/gemini-2.0-flash-exp:free',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    temperature: 0.7,
    maxTokens: 8000,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS;

export function getModel(modelId: ModelId) {
  const config = MODEL_CONFIGS[modelId] || MODEL_CONFIGS['auto'];
  return openrouter(config.id);
}
```

### 2. `src/agents/types.ts` - Shared Types

```typescript
export const SANDBOX_TIMEOUT = 60 * 60 * 1000; // 60 minutes

export type Framework = 'nextjs' | 'angular' | 'react' | 'vue' | 'svelte';

export interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework?: Framework;
  summaryRetryCount: number;
}

export interface TaskProgress {
  taskId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  stage: string;
  message: string;
  streamedContent?: string;
  files?: Record<string, string>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationRequest {
  projectId: string;
  sandboxId: string;
  prompt: string;
  model: string;
  conversationHistory?: any[];
}

export interface ValidationResult {
  success: boolean;
  errors?: string[];
  type?: 'lint' | 'build';
}

export interface StreamUpdate {
  type: 'status' | 'stream' | 'file' | 'complete' | 'error';
  message?: string;
  content?: string;
  filePath?: string;
  files?: Record<string, string>;
  error?: string;
}
```

### 3. `src/agents/sandbox.ts` - E2B Sandbox Management

```typescript
import { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';
import { SANDBOX_TIMEOUT, Framework } from './types';

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const FRAMEWORK_TEMPLATES: Record<Framework, string> = {
  nextjs: 'nextjs-developer',
  react: 'react-developer',
  vue: 'vue-developer',
  angular: 'angular-developer',
  svelte: 'svelte-developer',
};

export class SandboxManager {
  private static instance: SandboxManager;
  
  static getInstance() {
    if (!SandboxManager.instance) {
      SandboxManager.instance = new SandboxManager();
    }
    return SandboxManager.instance;
  }

  async connect(sandboxId: string): Promise<Sandbox> {
    const cached = SANDBOX_CACHE.get(sandboxId);
    if (cached) {
      return cached;
    }

    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });
      await sandbox.setTimeout(SANDBOX_TIMEOUT);

      SANDBOX_CACHE.set(sandboxId, sandbox);
      this.scheduleCacheCleanup(sandboxId);

      Sentry.addBreadcrumb({
        category: 'sandbox',
        message: `Connected to sandbox ${sandboxId}`,
        level: 'info',
      });

      return sandbox;
    } catch (error) {
      Sentry.captureException(error, {
        extra: { sandboxId },
        tags: { component: 'sandbox' },
      });
      throw new Error(`Failed to connect to sandbox: ${error}`);
    }
  }

  async create(framework: Framework): Promise<Sandbox> {
    const template = FRAMEWORK_TEMPLATES[framework];
    
    try {
      const sandbox = await Sandbox.create(template, {
        apiKey: process.env.E2B_API_KEY!,
        timeoutMs: SANDBOX_TIMEOUT,
      });

      SANDBOX_CACHE.set(sandbox.sandboxId, sandbox);
      this.scheduleCacheCleanup(sandbox.sandboxId);

      Sentry.addBreadcrumb({
        category: 'sandbox',
        message: `Created sandbox ${sandbox.sandboxId} with template ${template}`,
        level: 'info',
      });

      return sandbox;
    } catch (error) {
      Sentry.captureException(error, {
        extra: { framework, template },
        tags: { component: 'sandbox' },
      });
      throw error;
    }
  }

  private scheduleCacheCleanup(sandboxId: string) {
    setTimeout(() => {
      SANDBOX_CACHE.delete(sandboxId);
    }, CACHE_EXPIRY);
  }

  async readFiles(sandbox: Sandbox, paths: string[]): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    
    await Promise.all(
      paths.map(async (path) => {
        try {
          files[path] = await sandbox.files.read(path);
        } catch (error) {
          console.warn(`Failed to read file ${path}:`, error);
        }
      })
    );

    return files;
  }

  async writeFiles(sandbox: Sandbox, files: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        await sandbox.files.write(path, content);
      })
    );
  }

  async runCommand(
    sandbox: Sandbox,
    command: string,
    timeoutMs = 60000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await sandbox.commands.run(command, { timeoutMs });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode ?? 0,
    };
  }
}

export const sandboxManager = SandboxManager.getInstance();
```

### 4. `src/agents/retry.ts` - Automatic Retry Logic

```typescript
import * as Sentry from '@sentry/nextjs';

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryIf?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryIf: () => true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      Sentry.addBreadcrumb({
        category: 'retry',
        message: `Attempt ${attempt}/${opts.maxAttempts} failed`,
        level: 'warning',
        data: {
          error: lastError.message,
          nextDelay: delay,
        },
      });

      if (attempt === opts.maxAttempts || !opts.retryIf(lastError)) {
        Sentry.captureException(lastError, {
          extra: {
            attempts: attempt,
            maxAttempts: opts.maxAttempts,
          },
          tags: { component: 'retry' },
        });
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Specific retry conditions
export const retryOnRateLimit = (error: Error) => {
  return error.message.includes('rate limit') || 
         error.message.includes('429') ||
         error.message.includes('too many requests');
};

export const retryOnTimeout = (error: Error) => {
  return error.message.includes('timeout') ||
         error.message.includes('ETIMEDOUT');
};

export const retryOnTransient = (error: Error) => {
  return retryOnRateLimit(error) || 
         retryOnTimeout(error) ||
         error.message.includes('503') ||
         error.message.includes('502');
};
```

### 5. `src/agents/logger.ts` - Sentry Integration

```typescript
import * as Sentry from '@sentry/nextjs';

export class AgentLogger {
  private taskId: string;
  private startTime: number;

  constructor(taskId: string, extra?: Record<string, any>) {
    this.taskId = taskId;
    this.startTime = Date.now();

    Sentry.setTag('task_id', taskId);
    if (extra) {
      Sentry.setContext('task', extra);
    }
  }

  info(message: string, data?: Record<string, any>) {
    const logMessage = `[${this.taskId}] ${message}`;
    console.log(logMessage, data || '');
    
    Sentry.addBreadcrumb({
      category: 'agent',
      message,
      level: 'info',
      data: { ...data, taskId: this.taskId },
    });
  }

  warn(message: string, data?: Record<string, any>) {
    const logMessage = `[${this.taskId}] WARN: ${message}`;
    console.warn(logMessage, data || '');

    Sentry.addBreadcrumb({
      category: 'agent',
      message,
      level: 'warning',
      data: { ...data, taskId: this.taskId },
    });
  }

  error(error: Error | string, context?: Record<string, any>) {
    const err = typeof error === 'string' ? new Error(error) : error;
    console.error(`[${this.taskId}] ERROR:`, err, context || '');

    Sentry.captureException(err, {
      extra: { ...context, taskId: this.taskId },
      tags: { task_id: this.taskId },
    });
  }

  progress(stage: string, message: string) {
    this.info(`[${stage}] ${message}`);
  }

  complete(result?: Record<string, any>) {
    const duration = Date.now() - this.startTime;
    this.info('Task completed', { duration, ...result });

    Sentry.setMeasurement('task_duration', duration, 'millisecond');
  }

  startSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return Sentry.startSpan({ name, op: 'agent' }, fn);
  }
}

export function createLogger(taskId: string, extra?: Record<string, any>) {
  return new AgentLogger(taskId, extra);
}
```

### 6. `src/agents/tools.ts` - AI Agent Tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';

export function createTools(sandbox: Sandbox, onFileWrite?: (path: string) => void) {
  return {
    createOrUpdateFiles: tool({
      description: 'Create or update files in the sandbox. Use this to write code files.',
      parameters: z.object({
        files: z.array(z.object({
          path: z.string().describe('File path relative to project root'),
          content: z.string().describe('File content'),
        })),
      }),
      execute: async ({ files }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Writing ${files.length} files`,
          data: { paths: files.map(f => f.path) },
        });

        for (const file of files) {
          await sandbox.files.write(file.path, file.content);
          onFileWrite?.(file.path);
        }

        return { success: true, filesWritten: files.map(f => f.path) };
      },
    }),

    readFiles: tool({
      description: 'Read files from the sandbox to understand existing code.',
      parameters: z.object({
        paths: z.array(z.string()).describe('File paths to read'),
      }),
      execute: async ({ paths }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Reading ${paths.length} files`,
          data: { paths },
        });

        const files: Record<string, string> = {};
        for (const path of paths) {
          try {
            files[path] = await sandbox.files.read(path);
          } catch (error) {
            files[path] = `[Error reading file: ${error}]`;
          }
        }

        return files;
      },
    }),

    terminal: tool({
      description: 'Run terminal commands in the sandbox. Use for installing packages, running builds, etc.',
      parameters: z.object({
        command: z.string().describe('Command to run'),
        timeoutMs: z.number().optional().describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeoutMs = 60000 }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Running command: ${command}`,
        });

        // Prevent starting dev servers
        if (command.includes('npm run dev') || command.includes('npm start')) {
          return { 
            error: 'Cannot start dev servers in sandbox. Use npm run build instead.' 
          };
        }

        const result = await sandbox.commands.run(command, { timeoutMs });

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? 0,
        };
      },
    }),

    listFiles: tool({
      description: 'List files in a directory.',
      parameters: z.object({
        path: z.string().describe('Directory path'),
      }),
      execute: async ({ path }) => {
        const result = await sandbox.commands.run(`find ${path} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" | head -50`);
        return { files: result.stdout?.split('\n').filter(Boolean) || [] };
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof createTools>;
```

### 7. `src/agents/agents/code-generation.ts` - Main Code Generation

```typescript
import { streamText } from 'ai';
import { getModel, ModelId } from '../client';
import { sandboxManager } from '../sandbox';
import { withRetry, retryOnTransient } from '../retry';
import { createLogger } from '../logger';
import { createTools } from '../tools';
import { getFrameworkPrompt } from '../prompts';
import { Framework, GenerationRequest, StreamUpdate } from '../types';
import { api, internal } from '@/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateCode(
  request: GenerationRequest,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<{ summary: string; files: Record<string, string> }> {
  const logger = createLogger(request.projectId, {
    model: request.model,
    sandboxId: request.sandboxId,
  });

  logger.progress('init', 'Starting code generation');
  await onProgress({ type: 'status', message: 'Initializing AI agent...' });

  // Connect to sandbox
  const sandbox = await logger.startSpan('sandbox-connect', () =>
    sandboxManager.connect(request.sandboxId)
  );

  // Get framework from project
  const project = await convex.query(api.projects.getById, { 
    id: request.projectId as any 
  });
  const framework = (project?.framework?.toLowerCase() || 'nextjs') as Framework;

  logger.progress('framework', `Using framework: ${framework}`);
  await onProgress({ type: 'status', message: `Configuring for ${framework}...` });

  // Create tools
  const files: Record<string, string> = {};
  const tools = createTools(sandbox, (path) => {
    onProgress({ type: 'file', filePath: path });
  });

  // Build conversation history
  const messages = request.conversationHistory || [];
  messages.push({
    role: 'user' as const,
    content: request.prompt,
  });

  // Stream AI response with retry
  logger.progress('ai', 'Starting AI generation');
  await onProgress({ type: 'status', message: 'Generating code...' });

  const result = await withRetry(
    async () => {
      const response = await streamText({
        model: getModel(request.model as ModelId),
        system: getFrameworkPrompt(framework),
        messages,
        tools,
        maxTokens: 8000,
        temperature: 0.7,
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'text-delta') {
            await onProgress({
              type: 'stream',
              content: chunk.textDelta,
            });
          }
        },
      });

      // Wait for completion
      const text = await response.text;
      const toolCalls = await response.toolCalls;

      // Extract files from tool calls
      for (const call of toolCalls) {
        if (call.toolName === 'createOrUpdateFiles') {
          for (const file of call.args.files) {
            files[file.path] = file.content;
          }
        }
      }

      return { text, files };
    },
    {
      maxAttempts: 3,
      retryIf: retryOnTransient,
    }
  );

  // Extract summary
  const summary = extractSummary(result.text);

  logger.progress('complete', 'Code generation finished');
  await onProgress({
    type: 'complete',
    message: summary,
    files,
  });

  logger.complete({ filesCount: Object.keys(files).length });

  return { summary, files };
}

function extractSummary(text: string): string {
  // Look for <task_summary> tags
  const summaryMatch = text.match(/<task_summary>([\s\S]*?)<\/task_summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  // Fallback: use first paragraph
  const firstParagraph = text.split('\n\n')[0];
  return firstParagraph?.slice(0, 200) || 'Code generation completed';
}
```

### 8. `src/agents/agents/framework-selector.ts` - Framework Detection

```typescript
import { generateText } from 'ai';
import { getModel } from '../client';
import { createLogger } from '../logger';
import { withRetry, retryOnTransient } from '../retry';
import { Framework } from '../types';

const FRAMEWORK_SELECTOR_PROMPT = `You are a framework selection expert. Based on the user's request, determine the most appropriate framework.

Available frameworks:
- nextjs: For full-stack React apps, SSR, API routes, best for most web apps
- react: For client-side only React SPAs
- vue: For Vue.js applications
- angular: For Angular enterprise applications
- svelte: For Svelte applications

Respond with ONLY the framework name in lowercase. No explanation.

Examples:
- "Build a blog with SEO" -> nextjs
- "Create a dashboard" -> nextjs
- "Simple counter app" -> react
- "Vue todo app" -> vue
- "Enterprise CRM" -> angular
- "Svelte portfolio" -> svelte
`;

export async function selectFramework(
  prompt: string,
  previousMessages?: any[]
): Promise<Framework> {
  const logger = createLogger('framework-selector');

  logger.progress('start', 'Detecting framework from prompt');

  const result = await withRetry(
    async () => {
      const response = await generateText({
        model: getModel('google/gemini-2.5-flash-lite'),
        system: FRAMEWORK_SELECTOR_PROMPT,
        prompt: `User request: ${prompt}`,
        maxTokens: 50,
        temperature: 0.3,
      });

      return response.text.toLowerCase().trim();
    },
    {
      maxAttempts: 2,
      retryIf: retryOnTransient,
    }
  );

  // Validate framework
  const validFrameworks: Framework[] = ['nextjs', 'angular', 'react', 'vue', 'svelte'];
  const framework = validFrameworks.find((f) => result.includes(f)) || 'nextjs';

  logger.progress('complete', `Selected framework: ${framework}`);

  return framework;
}
```

### 9. `src/agents/agents/validation.ts` - Lint & Build Validation

```typescript
import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import { ValidationResult } from '../types';

export async function runValidation(sandboxId: string): Promise<ValidationResult> {
  const logger = createLogger(`validation-${sandboxId}`);
  const sandbox = await sandboxManager.connect(sandboxId);

  // Run lint
  logger.progress('lint', 'Running linter');
  const lintResult = await sandboxManager.runCommand(sandbox, 'npm run lint', 30000);

  if (lintResult.exitCode !== 0) {
    logger.warn('Lint failed', { stderr: lintResult.stderr });
    return {
      success: false,
      type: 'lint',
      errors: [lintResult.stderr || lintResult.stdout],
    };
  }

  // Run build
  logger.progress('build', 'Running build');
  const buildResult = await sandboxManager.runCommand(sandbox, 'npm run build', 120000);

  if (buildResult.exitCode !== 0) {
    logger.warn('Build failed', { stderr: buildResult.stderr });
    return {
      success: false,
      type: 'build',
      errors: [buildResult.stderr || buildResult.stdout],
    };
  }

  logger.progress('complete', 'Validation passed');
  return { success: true };
}
```

### 10. `src/agents/agents/error-fixer.ts` - Auto-Fix Errors

```typescript
import { streamText } from 'ai';
import { getModel } from '../client';
import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import { createTools } from '../tools';
import { runValidation } from './validation';
import { ValidationResult, StreamUpdate } from '../types';

const ERROR_FIX_PROMPT = `You are an expert debugger. The previous code generation resulted in errors.

Your task:
1. Read the files that caused the errors
2. Understand the root cause
3. Fix the issues by updating the files
4. Run lint and build to verify

Be precise and only change what's necessary to fix the errors.
`;

export async function fixErrors(
  sandboxId: string,
  errors: string[],
  attempt: number,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<ValidationResult> {
  const logger = createLogger(`error-fix-${sandboxId}`, { attempt });

  if (attempt >= 2) {
    logger.warn('Max fix attempts reached');
    return {
      success: false,
      errors: ['Max auto-fix attempts reached. Manual intervention required.'],
    };
  }

  logger.progress('start', `Auto-fix attempt ${attempt + 1}`);
  await onProgress({ type: 'status', message: `Attempting to fix errors (attempt ${attempt + 1})...` });

  const sandbox = await sandboxManager.connect(sandboxId);
  const tools = createTools(sandbox);

  const result = await streamText({
    model: getModel('anthropic/claude-haiku-4.5'),
    system: ERROR_FIX_PROMPT,
    prompt: `Fix these errors:\n\n${errors.join('\n\n')}`,
    tools,
    maxTokens: 4000,
    temperature: 0.3,
    onChunk: async ({ chunk }) => {
      if (chunk.type === 'text-delta') {
        await onProgress({ type: 'stream', content: chunk.textDelta });
      }
    },
  });

  await result.text; // Wait for completion

  // Re-run validation
  logger.progress('validate', 'Re-running validation');
  const validationResult = await runValidation(sandboxId);

  if (!validationResult.success) {
    // Recursive retry
    return fixErrors(sandboxId, validationResult.errors || [], attempt + 1, onProgress);
  }

  logger.progress('complete', 'Errors fixed successfully');
  await onProgress({ type: 'status', message: 'Errors fixed!' });

  return validationResult;
}
```

### 11. `src/app/api/generate/route.ts` - SSE API Endpoint

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { generateCode } from '@/agents/agents/code-generation';
import { runValidation } from '@/agents/agents/validation';
import { fixErrors } from '@/agents/agents/error-fixer';
import { StreamUpdate } from '@/agents/types';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { projectId, prompt, model, sandboxId } = body;

  if (!projectId || !prompt) {
    return new Response('Missing required fields', { status: 400 });
  }

  Sentry.setUser({ id: userId });
  Sentry.setTag('project_id', projectId);

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendUpdate = async (update: StreamUpdate) => {
    const message = `data: ${JSON.stringify(update)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Start generation in background (IIFE pattern from open-lovable)
  (async () => {
    try {
      // Create assistant message in Convex
      const messageId = await convex.mutation(api.messages.create, {
        projectId,
        content: '',
        role: 'ASSISTANT',
        type: 'STREAMING',
        status: 'STREAMING',
      });

      // Generate code
      const result = await generateCode(
        {
          projectId,
          sandboxId,
          prompt,
          model: model || 'auto',
        },
        sendUpdate
      );

      // Run validation
      await sendUpdate({ type: 'status', message: 'Validating code...' });
      let validation = await runValidation(sandboxId);

      // Auto-fix if needed
      if (!validation.success) {
        await sendUpdate({ type: 'status', message: 'Fixing errors...' });
        validation = await fixErrors(sandboxId, validation.errors || [], 0, sendUpdate);
      }

      // Save fragment to Convex
      await convex.mutation(api.fragments.create, {
        messageId,
        sandboxId,
        sandboxUrl: `https://${sandboxId}.e2b.dev`,
        title: result.summary,
        files: result.files,
        framework: 'NEXTJS', // Get from project
      });

      // Update message status
      await convex.mutation(api.messages.update, {
        id: messageId,
        content: result.summary,
        status: 'COMPLETE',
        type: 'RESULT',
      });

      await sendUpdate({
        type: 'complete',
        message: result.summary,
        files: result.files,
      });
    } catch (error) {
      Sentry.captureException(error);
      await sendUpdate({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### 12. `src/agents/index.ts` - Main Exports

```typescript
// Client
export { openrouter, getModel, MODEL_CONFIGS } from './client';
export type { ModelId } from './client';

// Types
export * from './types';

// Utilities
export { sandboxManager, SandboxManager } from './sandbox';
export { withRetry, retryOnRateLimit, retryOnTimeout, retryOnTransient } from './retry';
export { createLogger, AgentLogger } from './logger';
export { createTools } from './tools';

// Prompts
export { getFrameworkPrompt } from './prompts';

// Agents
export { generateCode } from './agents/code-generation';
export { selectFramework } from './agents/framework-selector';
export { runValidation } from './agents/validation';
export { fixErrors } from './agents/error-fixer';
```

---

## Convex Schema Updates

### `convex/streaming.ts` - NEW

```typescript
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Store streaming progress for SSE
export const updateProgress = mutation({
  args: {
    taskId: v.string(),
    status: v.string(),
    stage: v.string(),
    message: v.string(),
    streamedContent: v.optional(v.string()),
    files: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('taskProgress')
      .withIndex('by_taskId', (q) => q.eq('taskId', args.taskId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('taskProgress', {
        ...args,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const getProgress = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('taskProgress')
      .withIndex('by_taskId', (q) => q.eq('taskId', args.taskId))
      .first();
  },
});
```

### Schema Addition in `convex/schema.ts`

```typescript
// Add to existing schema
taskProgress: defineTable({
  taskId: v.string(),
  status: v.string(),
  stage: v.string(),
  message: v.string(),
  streamedContent: v.optional(v.string()),
  files: v.optional(v.any()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_taskId', ['taskId'])
  .index('by_status', ['status']),
```

---

## Migration Steps

### Week 1: Setup & Core (Days 1-5)
- [ ] Create `src/agents/` folder structure
- [ ] Implement `client.ts` (OpenRouter)
- [ ] Implement `types.ts`
- [ ] Implement `sandbox.ts`
- [ ] Implement `retry.ts`
- [ ] Implement `logger.ts`
- [ ] Implement `tools.ts`
- [ ] Add Convex schema for task progress
- [ ] Test each module individually

### Week 2: Agents & API (Days 6-10)
- [ ] Implement `framework-selector.ts`
- [ ] Implement `code-generation.ts`
- [ ] Implement `validation.ts`
- [ ] Implement `error-fixer.ts`
- [ ] Copy prompts from inngest to `prompts/`
- [ ] Create SSE API route `/api/generate`
- [ ] Integration test with E2B

### Week 3: Frontend & Cleanup (Days 11-15)
- [ ] Update `message-form.tsx` to use SSE
- [ ] Add streaming progress component
- [ ] Test full flow end-to-end
- [ ] Remove Inngest dependencies
- [ ] Delete `src/inngest/` folder
- [ ] Update environment variables
- [ ] Final testing
- [ ] Deploy to staging

---

## Environment Variables

### Remove
```bash
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

### Keep (already have)
```bash
OPENROUTER_API_KEY=
E2B_API_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
SENTRY_DSN=
```

---

## Package.json Changes

### Remove
```json
{
  "dependencies": {
    "inngest": "remove",
    "@inngest/agent-kit": "remove",
    "@inngest/realtime": "remove"
  }
}
```

### Add
```json
{
  "dependencies": {
    "@ai-sdk/openai": "^0.0.70",
    "ai": "^3.4.0"
  }
}
```

---

## Success Criteria

- [ ] SSE streaming works (test with curl)
- [ ] Code generation produces valid output
- [ ] Automatic retry on failures
- [ ] Sentry receives logs and errors
- [ ] All state persists in Convex
- [ ] Multi-tenant support works
- [ ] No Inngest dependencies remain
- [ ] Build passes
- [ ] Tests pass

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SSE connection drops | Client auto-reconnect + Convex polling fallback |
| 10-min Convex timeout | Use streaming, avoid long-running actions |
| Retry spam | Exponential backoff, max 3 attempts |
| Sentry quota | Sample at 10%, filter breadcrumbs |
| E2B sandbox failures | Cache connections, auto-reconnect |

---

## Quick Commands

```bash
# Install new deps
bun add @ai-sdk/openai ai

# Remove Inngest
bun remove inngest @inngest/agent-kit @inngest/realtime

# Test SSE endpoint
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test", "prompt": "Hello"}'

# Deploy Convex changes
bun run convex:deploy
```

---

**This plan is ready for implementation. Say "go" to start the migration!**
