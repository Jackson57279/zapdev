import { NextRequest } from 'next/server';
import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { Sandbox } from '@e2b/code-interpreter';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { crawlUrl, type CrawledContent } from '@/lib/firecrawl';
import {
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
  FRAMEWORK_SELECTOR_PROMPT,
  NEXTJS_PROMPT,
  ANGULAR_PROMPT,
  REACT_PROMPT,
  VUE_PROMPT,
  SVELTE_PROMPT,
} from '@/prompt';
import { sanitizeTextForDatabase } from '@/lib/utils';

export type Framework = 'nextjs' | 'angular' | 'react' | 'vue' | 'svelte';

interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework: Framework;
}

interface ProgressEvent {
  type: 'status' | 'sandbox' | 'framework' | 'tool' | 'stream' | 'files' | 'error' | 'complete' | 'autofix';
  message?: string;
  data?: unknown;
}

type FragmentMetadata = Record<string, unknown>;

const SANDBOX_TIMEOUT = 30 * 60 * 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_SCREENSHOTS = 20;
const FILE_READ_TIMEOUT_MS = 3000;
const BUILD_TIMEOUT_MS = 120000;
const AUTO_FIX_MAX_ATTEMPTS = 2;
const MAX_AGENT_ITERATIONS = 20;

const ALLOWED_WORKSPACE_PATHS = ['/home/user', '.'];

export const MODEL_CONFIGS = {
  'anthropic/claude-haiku-4.5': {
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast and efficient for most coding tasks',
    temperature: 0.7,
  },
  'openai/gpt-5.1-codex': {
    name: 'GPT-5.1 Codex',
    provider: 'openai',
    description: 'OpenAI\'s flagship model for complex tasks',
    temperature: 0.7,
  },
  'moonshotai/kimi-k2-thinking': {
    name: 'Kimi K2 Thinking',
    provider: 'moonshot',
    description: 'Fast and efficient for speed-critical tasks',
    temperature: 0.7,
  },
  'google/gemini-3-pro-preview': {
    name: 'Gemini 3 Pro',
    provider: 'google',
    description: 'Specialized for coding tasks',
    temperature: 0.7,
  },
  'xai/grok-4-fast-reasoning': {
    name: 'Grok 4 Fast',
    provider: 'xai',
    description: 'Fast reasoning model',
    temperature: 0.7,
  },
  'prime-intellect/intellect-3': {
    name: 'Intellect 3',
    provider: 'prime-intellect',
    description: 'Advanced reasoning model from Prime Intellect',
    temperature: 0.7,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS | 'auto';

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is not set');
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

function getAIProvider(modelId: string) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY environment variable is not set');
  }
  
  const baseURL = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1';
  
  const openai = createOpenAI({
    apiKey,
    baseURL,
  });
  
  return openai(modelId);
}

export function selectModelForTask(
  prompt: string,
  framework?: Framework,
): keyof typeof MODEL_CONFIGS {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();
  let chosenModel: keyof typeof MODEL_CONFIGS = 'anthropic/claude-haiku-4.5';

  const complexityIndicators = [
    'advanced', 'complex', 'sophisticated', 'enterprise', 'architecture',
    'performance', 'optimization', 'scalability', 'authentication',
    'authorization', 'database', 'api', 'integration', 'deployment',
    'security', 'testing',
  ];

  const hasComplexityIndicators = complexityIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  const isLongPrompt = promptLength > 500;
  const isVeryLongPrompt = promptLength > 1000;

  if (framework === 'angular' && (hasComplexityIndicators || isLongPrompt)) {
    return chosenModel;
  }

  const codingIndicators = ['refactor', 'optimize', 'debug', 'fix bug', 'improve code'];
  const hasCodingFocus = codingIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  if (hasCodingFocus && !isVeryLongPrompt) {
    chosenModel = 'google/gemini-3-pro-preview';
  }

  const speedIndicators = ['quick', 'fast', 'simple', 'basic', 'prototype'];
  const needsSpeed = speedIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator),
  );

  if (needsSpeed && !hasComplexityIndicators) {
    chosenModel = 'moonshotai/kimi-k2-thinking';
  }

  if (hasComplexityIndicators || isVeryLongPrompt) {
    chosenModel = 'anthropic/claude-haiku-4.5';
  }

  return chosenModel;
}

function frameworkToConvexEnum(
  framework: Framework,
): 'NEXTJS' | 'ANGULAR' | 'REACT' | 'VUE' | 'SVELTE' {
  const mapping: Record<Framework, 'NEXTJS' | 'ANGULAR' | 'REACT' | 'VUE' | 'SVELTE'> = {
    nextjs: 'NEXTJS',
    angular: 'ANGULAR',
    react: 'REACT',
    vue: 'VUE',
    svelte: 'SVELTE',
  };
  return mapping[framework];
}

function getE2BTemplate(framework: Framework): string {
  switch (framework) {
    case 'nextjs': return 'zapdev';
    case 'angular': return 'zapdev-angular';
    case 'react': return 'zapdev-react';
    case 'vue': return 'zapdev-vue';
    case 'svelte': return 'zapdev-svelte';
    default: return 'zapdev';
  }
}

function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case 'nextjs': return 3000;
    case 'angular': return 4200;
    case 'react':
    case 'vue':
    case 'svelte': return 5173;
    default: return 3000;
  }
}

function getFrameworkPrompt(framework: Framework): string {
  switch (framework) {
    case 'nextjs': return NEXTJS_PROMPT;
    case 'angular': return ANGULAR_PROMPT;
    case 'react': return REACT_PROMPT;
    case 'vue': return VUE_PROMPT;
    case 'svelte': return SVELTE_PROMPT;
    default: return NEXTJS_PROMPT;
  }
}

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY = 5 * 60 * 1000;

function clearCacheEntry(sandboxId: string) {
  setTimeout(() => {
    SANDBOX_CACHE.delete(sandboxId);
  }, CACHE_EXPIRY);
}

async function createSandboxWithRetry(
  template: string,
  maxRetries: number = 3,
): Promise<Sandbox> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEBUG] Sandbox creation attempt ${attempt}/${maxRetries} for template: ${template}`);
      
      const sandbox = await Sandbox.create(template, {
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: SANDBOX_TIMEOUT,
      });

      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      console.log(`[DEBUG] Sandbox created successfully: ${sandbox.sandboxId}`);
      
      return sandbox;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[ERROR] Sandbox creation attempt ${attempt} failed:`, lastError.message);

      if (attempt >= maxRetries) break;

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Sandbox creation failed after retries');
}

async function getSandbox(sandboxId: string): Promise<Sandbox> {
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) return cached;

  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: process.env.E2B_API_KEY,
  });
  await sandbox.setTimeout(SANDBOX_TIMEOUT);

  SANDBOX_CACHE.set(sandboxId, sandbox);
  clearCacheEntry(sandboxId);

  return sandbox;
}

async function waitForDevServer(
  sandbox: Sandbox,
  port: number = 3000,
  maxWaitTimeMs: number = 120000,
  checkIntervalMs: number = 2000,
): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWaitTimeMs) {
    attempts++;

    try {
      const result = await sandbox.commands.run(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`,
        { timeoutMs: 5000 },
      );

      const statusCode = result.stdout.trim();
      if (statusCode.match(/^[23]\d{2}$/)) {
        console.log(`[DEBUG] Dev server ready after ${attempts} attempts`);
        return true;
      }
    } catch {
      // Expected during startup - server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }

  return false;
}

async function ensureDevServerRunning(
  sandbox: Sandbox,
  framework: Framework,
): Promise<void> {
  const port = getFrameworkPort(framework);
  
  const isRunning = await waitForDevServer(sandbox, port, 60000, 2000);
  if (isRunning) return;

  const startCommands: Record<Framework, string> = {
    nextjs: 'cd /home/user && npx next dev --turbopack > /tmp/dev-server.log 2>&1 &',
    angular: 'cd /home/user && npm start > /tmp/dev-server.log 2>&1 &',
    react: 'cd /home/user && npm run dev > /tmp/dev-server.log 2>&1 &',
    vue: 'cd /home/user && npm run dev > /tmp/dev-server.log 2>&1 &',
    svelte: 'cd /home/user && npm run dev > /tmp/dev-server.log 2>&1 &',
  };

  await sandbox.commands.run(startCommands[framework], { timeoutMs: 5000 });
  await waitForDevServer(sandbox, port, 60000, 2000);
}

function isValidFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  const normalizedPath = filePath.trim();
  if (normalizedPath.length === 0 || normalizedPath.length > 4096) return false;
  if (normalizedPath.includes('..')) return false;
  if (normalizedPath.includes('\0') || normalizedPath.includes('\n') || normalizedPath.includes('\r')) return false;

  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(
    (basePath) =>
      normalizedPath === basePath ||
      normalizedPath.startsWith(`${basePath}/`) ||
      normalizedPath.startsWith('./'),
  );

  return isInWorkspace || normalizedPath.startsWith('/home/user/');
}

async function readFileWithTimeout(
  sandbox: Sandbox,
  filePath: string,
  timeoutMs: number,
): Promise<string | null> {
  if (!isValidFilePath(filePath)) return null;

  try {
    const readPromise = sandbox.files.read(filePath);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );

    const content = await Promise.race([readPromise, timeoutPromise]);
    if (content === null) return null;
    if (typeof content === 'string' && content.length > MAX_FILE_SIZE) return null;

    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  }
}

const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i, /\[ERROR\]/i, /ERROR/, /Failed\b/i, /failure\b/i, /Exception\b/i,
  /SyntaxError/i, /TypeError/i, /ReferenceError/i, /Module not found/i,
  /Cannot find module/i, /Failed to resolve/i, /Build failed/i, /Compilation error/i,
  /undefined is not/i, /null is not/i, /Cannot read propert/i, /is not a function/i,
  /is not defined/i, /ESLint/i, /Type error/i, /TS\d+/i,
  /Ecmascript file had an error/i, /Parsing ecmascript source code failed/i,
  /Turbopack build failed/i, /the name .* is defined multiple times/i,
  /Expected a semicolon/i, /CommandExitError/i, /ENOENT/i, /Module build failed/i,
];

function usesShadcnComponents(files: Record<string, string>): boolean {
  return Object.entries(files).some(([path, content]) => {
    if (!path.endsWith('.tsx')) return false;
    return content.includes('@/components/ui/');
  });
}

async function runLintCheck(sandbox: Sandbox): Promise<string | null> {
  const buffers = { stdout: '', stderr: '' };

  try {
    const result = await sandbox.commands.run('npm run lint', {
      onStdout: (data: string) => { buffers.stdout += data; },
      onStderr: (data: string) => { buffers.stderr += data; },
    });

    const output = buffers.stdout + buffers.stderr;
    if (result.exitCode === 127) return null;
    if (result.exitCode !== 0 && output.length > 0) {
      if (/error|✖/i.test(output) || AUTO_FIX_ERROR_PATTERNS.some((p) => p.test(output))) {
        return output;
      }
    }
    return null;
  } catch {
    const output = buffers.stdout + buffers.stderr;
    if (output.trim() && (/error|✖/i.test(output) || AUTO_FIX_ERROR_PATTERNS.some((p) => p.test(output)))) {
      return output;
    }
    return null;
  }
}

async function runBuildCheck(sandbox: Sandbox): Promise<string | null> {
  const buffers = { stdout: '', stderr: '' };

  try {
    const result = await sandbox.commands.run('npm run build', {
      onStdout: (data: string) => { buffers.stdout += data; },
      onStderr: (data: string) => { buffers.stderr += data; },
      timeoutMs: BUILD_TIMEOUT_MS,
    });

    const output = buffers.stdout + buffers.stderr;
    if (result.exitCode === 127) return null;
    if (result.exitCode !== 0) {
      return `Build failed with exit code ${result.exitCode}:\n${output}`;
    }
    return null;
  } catch {
    const output = buffers.stdout + buffers.stderr;
    if (output.trim()) {
      return `Build failed:\n${output}`;
    }
    return null;
  }
}

const URL_REGEX = /(https?:\/\/[^\s\]\)"'<>]+)/gi;

function extractUrls(value: string): string[] {
  const matches = value.matchAll(URL_REGEX);
  const urls = new Set<string>();

  for (const match of matches) {
    try {
      const parsed = new URL(match[0]);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        urls.add(parsed.toString());
      }
    } catch {
      continue;
    }
  }

  return Array.from(urls);
}

const SUMMARY_TAG_REGEX = /<task_summary>([\s\S]*?)<\/task_summary>/i;

function extractSummaryText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';

  const match = SUMMARY_TAG_REGEX.exec(trimmed);
  if (match && typeof match[1] === 'string') {
    return match[1].trim();
  }

  return '';
}

function createAgentTools(
  sandboxId: string,
  state: AgentState,
  sendProgress: (event: ProgressEvent) => Promise<void>,
) {
  return {
    terminal: tool({
      description: 'Run terminal commands in the sandbox',
      inputSchema: z.object({
        command: z.string().describe('The command to run'),
      }),
      execute: async (input) => {
        await sendProgress({ type: 'tool', message: `Running: ${input.command}` });
        try {
          const sandbox = await getSandbox(sandboxId);
          const result = await sandbox.commands.run(input.command, { timeoutMs: 60000 });
          return result.stdout + (result.stderr ? `\nSTDERR: ${result.stderr}` : '');
        } catch (error) {
          return `Command failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),
    createOrUpdateFiles: tool({
      description: 'Create or update files in the sandbox',
      inputSchema: z.object({
        files: z.array(z.object({
          path: z.string().describe('Relative file path'),
          content: z.string().describe('File content'),
        })),
      }),
      execute: async (input) => {
        await sendProgress({ type: 'tool', message: `Writing ${input.files.length} files...` });
        try {
          const sandbox = await getSandbox(sandboxId);
          const createdFiles: string[] = [];
          for (const file of input.files) {
            await sandbox.files.write(file.path, file.content);
            state.files[file.path] = file.content;
            createdFiles.push(file.path);
          }
          await sendProgress({ type: 'files', data: createdFiles });
          return `Created/updated files: ${createdFiles.join(', ')}`;
        } catch (error) {
          return `Failed to write files: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),
    readFiles: tool({
      description: 'Read files from the sandbox',
      inputSchema: z.object({
        files: z.array(z.string()).describe('Array of file paths to read'),
      }),
      execute: async (input) => {
        await sendProgress({ type: 'tool', message: `Reading ${input.files.length} files...` });
        try {
          const sandbox = await getSandbox(sandboxId);
          const contents: Array<{ path: string; content: string }> = [];
          for (const filePath of input.files) {
            const content = await readFileWithTimeout(sandbox, filePath, FILE_READ_TIMEOUT_MS);
            if (content !== null) {
              contents.push({ path: filePath, content });
            }
          }
          return JSON.stringify(contents);
        } catch (error) {
          return `Failed to read files: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),
  };
}

type MessageRole = 'user' | 'assistant' | 'system';
interface Message {
  role: MessageRole;
  content: string;
}

async function runAgentLoop(
  model: ReturnType<typeof getAIProvider>,
  systemPrompt: string,
  initialMessages: Message[],
  sandboxId: string,
  state: AgentState,
  sendProgress: (event: ProgressEvent) => Promise<void>,
  temperature: number,
): Promise<string> {
  const messages = [...initialMessages];
  let fullResponse = '';
  const tools = createAgentTools(sandboxId, state, sendProgress);
  
  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      temperature,
    });

    fullResponse = result.text;
    
    if (result.text) {
      await sendProgress({ type: 'stream', data: result.text });
      
      const summary = extractSummaryText(result.text);
      if (summary) {
        state.summary = summary;
      }
    }

    const hasToolCalls = result.toolCalls && result.toolCalls.length > 0;
    if (!hasToolCalls) {
      break;
    }

    messages.push({
      role: 'assistant',
      content: result.text || `Used tools: ${result.toolCalls?.map(tc => tc.toolName).join(', ')}`,
    });

    const toolResultsText = result.toolResults?.map(tr => 
      `${tr.toolName}: ${typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output)}`
    ).join('\n\n') || '';

    if (toolResultsText) {
      messages.push({
        role: 'user',
        content: `Tool results:\n${toolResultsText}`,
      });
    }
  }

  return fullResponse;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendProgress = async (event: ProgressEvent) => {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  (async () => {
    const convex = getConvexClient();
    let sandboxId: string | null = null;
    let selectedFramework: Framework = 'nextjs';
    let selectedModel: keyof typeof MODEL_CONFIGS = 'anthropic/claude-haiku-4.5';
    
    try {
      const body = await req.json();
      const { 
        projectId, 
        value: prompt, 
        model: requestedModel = 'auto',
        mode = 'fast',
      } = body;

      await sendProgress({ type: 'status', message: 'Initializing...' });

      const project = await convex.query(api.projects.getForSystem, {
        projectId: projectId as Id<'projects'>,
      });

      if (!project) {
        throw new Error('Project not found');
      }

      selectedFramework = (project?.framework?.toLowerCase() as Framework) || 'nextjs';

      if (!project?.framework) {
        await sendProgress({ type: 'status', message: 'Detecting framework...' });

        const frameworkResult = await generateText({
          model: getAIProvider('google/gemini-2.5-flash-lite'),
          system: FRAMEWORK_SELECTOR_PROMPT,
          prompt,
          temperature: 0.3,
        });

        const detectedFramework = frameworkResult.text.trim().toLowerCase();
        if (['nextjs', 'angular', 'react', 'vue', 'svelte'].includes(detectedFramework)) {
          selectedFramework = detectedFramework as Framework;
        }

        await convex.mutation(api.projects.updateForUser, {
          userId: project.userId,
          projectId: projectId as Id<'projects'>,
          framework: frameworkToConvexEnum(selectedFramework),
        });
      }

      await sendProgress({ type: 'framework', data: selectedFramework });

      if (requestedModel === 'auto' || !(requestedModel in MODEL_CONFIGS)) {
        selectedModel = selectModelForTask(prompt, selectedFramework);
      } else {
        selectedModel = requestedModel as keyof typeof MODEL_CONFIGS;
      }

      console.log(`[DEBUG] Selected model: ${selectedModel}, framework: ${selectedFramework}`);

      await sendProgress({ type: 'status', message: 'Creating sandbox...' });

      const template = getE2BTemplate(selectedFramework);
      let sandbox: Sandbox;
      
      try {
        sandbox = await createSandboxWithRetry(template, 3);
      } catch {
        sandbox = await createSandboxWithRetry('zapdev', 3);
        selectedFramework = 'nextjs';
      }

      sandboxId = sandbox.sandboxId;
      await sendProgress({ type: 'sandbox', data: sandboxId });

      try {
        await convex.mutation(api.sandboxSessions.create, {
          sandboxId,
          projectId: projectId as Id<'projects'>,
          userId: project.userId,
          framework: frameworkToConvexEnum(selectedFramework),
          autoPauseTimeout: 10 * 60 * 1000,
        });
      } catch (error) {
        console.error('[ERROR] Failed to create sandbox session:', error);
      }

      const previousMessages: Message[] = [];
      try {
        const allMessages = await convex.query(api.messages.listForUser, {
          userId: project.userId,
          projectId: projectId as Id<'projects'>,
        });

        const messages = allMessages.slice(-3);
        for (const message of messages) {
          previousMessages.push({
            role: message.role === 'ASSISTANT' ? 'assistant' : 'user',
            content: message.content,
          });
        }
      } catch (error) {
        console.error('[ERROR] Failed to fetch previous messages:', error);
      }

      const crawledContexts: CrawledContent[] = [];
      const urls = extractUrls(prompt).slice(0, 2);

      if (urls.length > 0) {
        await sendProgress({ type: 'status', message: 'Crawling URLs...' });

        for (const url of urls) {
          try {
            const result = await Promise.race([
              crawlUrl(url),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
            ]);
            if (result) crawledContexts.push(result);
          } catch {
            continue;
          }
        }
      }

      let specEnhancement = '';
      try {
        const allMessages = await convex.query(api.messages.listForUser, {
          userId: project.userId,
          projectId: projectId as Id<'projects'>,
        });
        const currentMessage = allMessages.filter((m) => m.role === 'USER').pop();
        
        if (currentMessage?.specMode === 'APPROVED' && currentMessage?.specContent) {
          specEnhancement = `

## IMPORTANT: Implementation Specification

The user has approved the following detailed implementation specification. Follow it closely:

${currentMessage.specContent}

Your task is to implement this specification accurately.`;
        }
      } catch {
        // Spec lookup failed, continue without enhancement
      }

      let frameworkPrompt = getFrameworkPrompt(selectedFramework);
      if (specEnhancement) {
        frameworkPrompt += specEnhancement;
      }

      const contextMessages: Message[] = crawledContexts.map((ctx) => ({
        role: 'user' as const,
        content: `Crawled context from ${ctx.url}:\n${ctx.content}`,
      }));

      const allContextMessages: Message[] = [
        ...contextMessages,
        ...previousMessages,
        { role: 'user' as const, content: prompt },
      ];

      const state: AgentState = {
        summary: '',
        files: {},
        selectedFramework,
      };

      await sendProgress({ type: 'status', message: 'Generating code...' });

      const modelConfig = MODEL_CONFIGS[selectedModel];

      const fullText = await runAgentLoop(
        getAIProvider(selectedModel),
        frameworkPrompt,
        allContextMessages,
        sandboxId,
        state,
        sendProgress,
        modelConfig.temperature,
      );

      let summaryText = extractSummaryText(fullText);
      if (!summaryText && state.summary) {
        summaryText = state.summary;
      }

      const hasGeneratedFiles = Object.keys(state.files).length > 0;

      if (!summaryText && hasGeneratedFiles) {
        await sendProgress({ type: 'status', message: 'Generating summary...' });

        const summaryResult = await generateText({
          model: getAIProvider(selectedModel),
          system: frameworkPrompt,
          prompt: 'IMPORTANT: You have successfully generated files, but you forgot to provide the <task_summary> tag. Please provide it now with a brief description of what you built.',
          temperature: 0.5,
        });

        summaryText = extractSummaryText(summaryResult.text);
        if (!summaryText) {
          const filePaths = Object.keys(state.files);
          const previewFiles = filePaths.slice(0, 5);
          const remainingCount = filePaths.length - previewFiles.length;
          summaryText = `Generated ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}: ${previewFiles.join(', ')}${remainingCount > 0 ? ` (and ${remainingCount} more)` : ''}.`;
        }
      }

      state.summary = summaryText;

      if (mode === 'safe' && hasGeneratedFiles) {
        await sendProgress({ type: 'status', message: 'Running validation...' });

        const sbx = await getSandbox(sandboxId);
        let lintErrors = await runLintCheck(sbx);
        const buildErrors = await runBuildCheck(sbx);

        if (selectedFramework === 'nextjs' && !usesShadcnComponents(state.files)) {
          const shadcnError = '[ERROR] Missing Shadcn UI usage. Rebuild the UI using components imported from \'@/components/ui/*\'.';
          if (lintErrors) {
            lintErrors += '\n' + shadcnError;
          } else {
            lintErrors = shadcnError;
          }
        }

        let validationErrors = [lintErrors, buildErrors].filter(Boolean).join('\n\n');
        let autoFixAttempts = 0;

        while (autoFixAttempts < AUTO_FIX_MAX_ATTEMPTS && validationErrors) {
          autoFixAttempts++;
          await sendProgress({ 
            type: 'autofix', 
            message: `Auto-fix attempt ${autoFixAttempts}/${AUTO_FIX_MAX_ATTEMPTS}...`,
            data: validationErrors,
          });

          const fixMessages: Message[] = [
            { role: 'user', content: prompt },
            { role: 'assistant', content: fullText },
            { 
              role: 'user', 
              content: `CRITICAL ERROR DETECTED - IMMEDIATE FIX REQUIRED

The previous attempt encountered errors that must be corrected:

${validationErrors}

REQUIRED ACTIONS:
1. Analyze the error messages to identify the root cause
2. Apply the necessary fixes
3. Verify the fix by checking the code logic and types
4. Provide an updated <task_summary>`,
            },
          ];

          const fixText = await runAgentLoop(
            getAIProvider(selectedModel),
            frameworkPrompt,
            fixMessages,
            sandboxId,
            state,
            sendProgress,
            modelConfig.temperature,
          );

          const newSummary = extractSummaryText(fixText);
          if (newSummary) {
            state.summary = newSummary;
          }

          const newLintErrors = await runLintCheck(sbx);
          const newBuildErrors = await runBuildCheck(sbx);
          validationErrors = [newLintErrors, newBuildErrors].filter(Boolean).join('\n\n');

          if (!validationErrors) {
            await sendProgress({ type: 'status', message: 'All errors resolved!' });
          }
        }
      }

      const sbx = await getSandbox(sandboxId);
      await ensureDevServerRunning(sbx, selectedFramework);

      let sandboxUrl = `https://${sandboxId}.sandbox.e2b.dev`;
      try {
        const port = getFrameworkPort(selectedFramework);
        const host = (sbx as unknown as { getHost?: (port: number) => string }).getHost?.(port);
        if (host) {
          sandboxUrl = host.startsWith('http') ? host : `https://${host}`;
        }
      } catch {
        // getHost failed, use fallback URL
      }

      await sendProgress({ type: 'status', message: 'Finalizing...' });

      const [titleResult, responseResult] = await Promise.all([
        generateText({
          model: getAIProvider(selectedModel),
          system: FRAGMENT_TITLE_PROMPT,
          prompt: state.summary || 'Generated code',
          temperature: 0.5,
        }),
        generateText({
          model: getAIProvider(selectedModel),
          system: RESPONSE_PROMPT,
          prompt: state.summary || 'Generated code',
          temperature: 0.5,
        }),
      ]);

      const fragmentTitle = sanitizeTextForDatabase(titleResult.text.trim()) || 'Generated Fragment';
      const responseContent = sanitizeTextForDatabase(responseResult.text.trim()) || 'Generated code is ready.';

      const messageId = await convex.mutation(api.messages.createForUser, {
        userId: project.userId,
        projectId: projectId as Id<'projects'>,
        content: responseContent,
        role: 'ASSISTANT',
        type: 'RESULT',
        status: 'COMPLETE',
      });

      const screenshots: string[] = [];
      for (const ctx of crawledContexts) {
        if (ctx.screenshots && Array.isArray(ctx.screenshots)) {
          screenshots.push(...ctx.screenshots);
        }
      }
      const validScreenshots = screenshots.slice(0, MAX_SCREENSHOTS);

      const metadata: FragmentMetadata = {
        model: selectedModel,
        modelName: modelConfig.name,
        provider: modelConfig.provider,
        ...(validScreenshots.length > 0 && { screenshots: validScreenshots }),
      };

      const fragmentId = await convex.mutation(api.messages.createFragmentForUser, {
        userId: project.userId,
        messageId: messageId as Id<'messages'>,
        sandboxId: sandboxId || undefined,
        sandboxUrl,
        title: fragmentTitle,
        files: state.files,
        framework: frameworkToConvexEnum(selectedFramework),
        metadata,
      });

      console.log(`[DEBUG] Fragment ${fragmentId} created with ${Object.keys(state.files).length} files`);

      await sendProgress({
        type: 'complete',
        data: {
          url: sandboxUrl,
          title: fragmentTitle,
          files: state.files,
          summary: state.summary,
          messageId,
          fragmentId,
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ERROR] Agent failed:', errorMessage);
      
      await sendProgress({
        type: 'error',
        message: errorMessage,
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
    },
  });
}
