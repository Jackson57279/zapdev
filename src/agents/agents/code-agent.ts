import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { getModel, ModelId } from '../client';
import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import { getFrameworkPrompt } from '../prompts';
import type { Framework, GenerationRequest, StreamUpdate } from '../types';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';

// Lazy Convex client initialization
let _convex: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

export interface CodeGenerationResult {
  summary: string;
  files: Record<string, string>;
  steps: number;
}

/**
 * Creates sandbox tools for the code generation agent
 */
function createSandboxTools(
  sandbox: Sandbox,
  files: Record<string, string>,
  onFileWrite?: (path: string) => void
) {
  return {
    createOrUpdateFiles: tool({
      description:
        'Create or update files in the sandbox. Use this to write code files. Always use this tool to create new files or modify existing ones.',
      inputSchema: z.object({
        files: z.array(
          z.object({
            path: z.string().describe('File path relative to project root (e.g., src/app/page.tsx)'),
            content: z.string().describe('Complete file content'),
          })
        ),
      }),
      execute: async ({ files: filesToWrite }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Writing ${filesToWrite.length} files`,
          data: { paths: filesToWrite.map((f) => f.path) },
        });

        for (const file of filesToWrite) {
          await sandbox.files.write(file.path, file.content);
          files[file.path] = file.content;
          onFileWrite?.(file.path);
        }

        return { success: true, filesWritten: filesToWrite.map((f) => f.path) };
      },
    }),

    readFiles: tool({
      description:
        'Read files from the sandbox to understand existing code structure and content before making changes.',
      inputSchema: z.object({
        paths: z.array(z.string()).describe('File paths to read (e.g., ["src/app/page.tsx", "package.json"])'),
      }),
      execute: async ({ paths }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Reading ${paths.length} files`,
          data: { paths },
        });

        const result: Record<string, string> = {};
        for (const path of paths) {
          try {
            result[path] = await sandbox.files.read(path);
          } catch (error) {
            result[path] = `[Error reading file: ${error}]`;
          }
        }

        return result;
      },
    }),

    terminal: tool({
      description:
        'Run terminal commands in the sandbox. Use for installing packages (npm install), running builds (npm run build), etc. Do NOT use for starting dev servers.',
      inputSchema: z.object({
        command: z.string().describe('Command to run (e.g., "npm install lodash", "npm run build")'),
        timeoutMs: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
      }),
      execute: async ({ command, timeoutMs = 60000 }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Running command: ${command}`,
        });

        // Prevent starting dev servers
        if (command.includes('npm run dev') || command.includes('npm start')) {
          return {
            error: 'Cannot start dev servers in sandbox. The preview is automatically available.',
          };
        }

        const result = await sandbox.commands.run(command, { timeoutMs: timeoutMs ?? 60000 });

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? 0,
        };
      },
    }),

    listFiles: tool({
      description: 'List source files in a directory to understand project structure.',
      inputSchema: z.object({
        path: z.string().describe('Directory path to list (e.g., "src", "src/components")'),
      }),
      execute: async ({ path }) => {
        const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const result = await sandbox.commands.run(
          `find -- "${escapedPath}" \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" \\) -type f -print0`
        );

        const output = result.stdout || '';
        const fileList = output.split('\0').filter(Boolean).slice(0, 50);

        return { files: fileList };
      },
    }),
  };
}

/**
 * Creates a ZapDev Code Generation Agent using AI SDK ToolLoopAgent
 */
export function createCodeAgent(
  sandbox: Sandbox,
  framework: Framework,
  modelId: ModelId,
  files: Record<string, string>,
  onFileWrite?: (path: string) => void
) {
  const tools = createSandboxTools(sandbox, files, onFileWrite);

  return new ToolLoopAgent({
    model: getModel(modelId),
    instructions: getFrameworkPrompt(framework),
    tools,
    stopWhen: stepCountIs(15),
  });
}

/**
 * Main code generation function using the ToolLoopAgent
 */
export async function generateCodeWithAgent(
  request: GenerationRequest,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<CodeGenerationResult> {
  const logger = createLogger(request.projectId, {
    model: request.model,
    sandboxId: request.sandboxId,
  });

  logger.progress('init', 'Starting code generation with ToolLoopAgent');
  await onProgress({ type: 'status', message: 'Initializing AI agent...' });

  // Connect to sandbox
  let sandbox: Sandbox;
  try {
    sandbox = await logger.startSpan('sandbox-connect', () =>
      sandboxManager.connect(request.sandboxId)
    );
  } catch (error) {
    const errorMessage = `Failed to connect to sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    throw new Error(errorMessage);
  }

  // Get project framework
  const project = await getConvex().query(api.projects.getForSystem, {
    projectId: request.projectId as Id<'projects'>,
  });
  const framework = (project?.framework?.toLowerCase() || 'nextjs') as Framework;

  logger.progress('framework', `Using framework: ${framework}`);
  await onProgress({ type: 'status', message: `Configuring for ${framework}...` });

  // Initialize files tracking
  const files: Record<string, string> = {};

  // Create the agent
  const agent = createCodeAgent(
    sandbox,
    framework,
    request.model as ModelId,
    files,
    (path) => {
      onProgress({ type: 'file', filePath: path });
    }
  );

  logger.progress('ai', 'Starting AI generation');
  await onProgress({ type: 'status', message: 'Generating code...' });

  // Build messages from conversation history
  const conversationHistory = request.conversationHistory || [];
  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: request.prompt },
  ];

  try {
    // Use streaming for real-time updates
    // agent.stream() returns a Promise<StreamTextResult>, so we await it first
    const result = await agent.stream({ messages });

    let fullText = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
      await onProgress({
        type: 'stream',
        content: chunk,
      });
    }

    console.log('\n[Agent] Stream complete');

    // Get final results
    const text = await result.text;
    const steps = await result.steps;

    console.log('[Agent] Total steps:', steps.length);
    let totalToolCalls = 0;
    for (const step of steps) {
      if (step.toolCalls) {
        totalToolCalls += step.toolCalls.length;
      }
    }
    console.log('[Agent] Total tool calls:', totalToolCalls);
    console.log('[Agent] Files generated:', Object.keys(files).length);

    const summary = extractSummary(text || fullText);

    logger.progress('complete', 'Code generation finished');
    await onProgress({
      type: 'complete',
      message: summary,
      files,
    });

    logger.complete({ filesCount: Object.keys(files).length });

    return {
      summary,
      files,
      steps: steps.length,
    };
  } catch (error) {
    const errorMessage = `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    Sentry.captureException(error);
    throw new Error(errorMessage);
  }
}

/**
 * Extract summary from AI response
 */
function extractSummary(text: string): string {
  // Try to find task_summary tags
  const summaryMatch = text.match(/<task_summary>([\s\S]*?)<\/task_summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  // Fall back to first paragraph
  const firstParagraph = text.split('\n\n')[0];
  return firstParagraph?.slice(0, 200) || 'Code generation completed';
}
