import { streamText, tool } from 'ai';
import { z } from 'zod';
import { getModel, ModelId } from '../client';
import { sandboxManager } from '../sandbox';
import { withRetry, retryOnTransient } from '../retry';
import { createLogger } from '../logger';
import { getFrameworkPrompt } from '../prompts';
import type { Framework, GenerationRequest, StreamUpdate } from '../types';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';

let _convex: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

interface GenerationResult {
  summary: string;
  files: Record<string, string>;
}

function createAgentTools(
  sandbox: Sandbox,
  files: Record<string, string>,
  onFileWrite?: (path: string) => void
) {
  return {
    createOrUpdateFiles: tool({
      description: 'Create or update files in the sandbox. Use this to write code files.',
      inputSchema: z.object({
        files: z.array(
          z.object({
            path: z.string().describe('File path relative to project root'),
            content: z.string().describe('File content'),
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
      description: 'Read files from the sandbox to understand existing code.',
      inputSchema: z.object({
        paths: z.array(z.string()).describe('File paths to read'),
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
        'Run terminal commands in the sandbox. Use for installing packages, running builds, etc.',
      inputSchema: z.object({
        command: z.string().describe('Command to run'),
        timeoutMs: z.number().optional().describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeoutMs = 60000 }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Running command: ${command}`,
        });

        if (command.includes('npm run dev') || command.includes('npm start')) {
          return {
            error: 'Cannot start dev servers in sandbox. Use npm run build instead.',
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
      description: 'List files in a directory.',
      inputSchema: z.object({
        path: z.string().describe('Directory path'),
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

export async function generateCode(
  request: GenerationRequest,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<GenerationResult> {
  const logger = createLogger(request.projectId, {
    model: request.model,
    sandboxId: request.sandboxId,
  });

  logger.progress('init', 'Starting code generation');
  await onProgress({ type: 'status', message: 'Initializing AI agent...' });

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

  let framework: Framework = 'nextjs';
  
  // Skip Convex query for test project IDs
  if (request.projectId.startsWith('test-')) {
    framework = 'nextjs';
    logger.info('Using default framework for test project');
  } else {
    const project = await getConvex().query(api.projects.getForSystem, {
      projectId: request.projectId as Id<'projects'>,
    });
    framework = (project?.framework?.toLowerCase() || 'nextjs') as Framework;
  }

  logger.progress('framework', `Using framework: ${framework}`);
  await onProgress({ type: 'status', message: `Configuring for ${framework}...` });

  const files: Record<string, string> = {};
  const tools = createAgentTools(sandbox, files, (path) => {
    onProgress({ type: 'file', filePath: path });
  });

  logger.progress('ai', 'Starting AI generation');
  await onProgress({ type: 'status', message: 'Generating code...' });

  let model;
  try {
    model = getModel(request.model as ModelId);
  } catch (error) {
    const errorMessage = `Failed to initialize AI model: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    throw new Error(errorMessage);
  }

  const conversationHistory = request.conversationHistory || [];
  
  // Build messages with tool priming for better tool usage
  const contextualMessages: Array<{role: 'user' | 'assistant', content: string}> = [];
  
  // Add conversation history
  for (const msg of conversationHistory) {
    contextualMessages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }
  
  // If this is a follow-up conversation, add a priming message to reinforce tool usage
  if (conversationHistory.length > 0) {
    contextualMessages.push({
      role: 'assistant' as const,
      content: 'I will use createOrUpdateFiles to implement the requested changes.',
    });
  }
  
  // Add the current user request
  contextualMessages.push({
    role: 'user' as const,
    content: request.prompt
  });

  console.log('[AI] Conversation history length:', conversationHistory.length);
  console.log('[AI] Total messages prepared:', contextualMessages.length);

  const result = await withRetry(
    async () => {
      let stepCount = 0;
      
      const response = streamText({
        model,
        system: getFrameworkPrompt(framework),
        messages: contextualMessages,
        tools,
        toolChoice: 'required', // Force the model to use at least one tool
        maxSteps: 15, // Increased to allow more tool iterations
        temperature: 0.7,
        onStepFinish: async ({ toolCalls, toolResults, text }) => {
          stepCount++;
          console.log(`[AI] Step ${stepCount} completed`);
          
          if (toolCalls && toolCalls.length > 0) {
            console.log(`[AI] Tool calls in step: ${toolCalls.length}`);
            for (const call of toolCalls) {
              console.log(`[AI] Tool call: ${call.toolName}`);
            }
          }
          
          if (toolResults && toolResults.length > 0) {
            console.log('[AI] Tool results received:', toolResults.length);
          }
          
          if (text && text.length > 0) {
            // Log if the model is outputting text without tool calls (potential issue)
            if (!toolCalls || toolCalls.length === 0) {
              console.log('[AI] WARNING: Text output without tool call in this step');
              console.log('[AI] Text preview:', text.slice(0, 100) + (text.length > 100 ? '...' : ''));
            }
          }
        },
      });

      let fullText = '';
      for await (const textPart of response.textStream) {
        process.stdout.write(textPart);
        fullText += textPart;
        await onProgress({
          type: 'stream',
          content: textPart,
        });
      }

      console.log('\n[AI] Stream complete');

      const text = await response.text;
      const steps = await response.steps;

      console.log('[AI] Total steps:', steps.length);
      let totalToolCalls = 0;
      for (const step of steps) {
        if (step.toolCalls) {
          totalToolCalls += step.toolCalls.length;
        }
      }
      console.log('[AI] Total tool calls:', totalToolCalls);
      console.log('[AI] Files generated:', Object.keys(files).length);

      // Validate that tools were actually used
      if (totalToolCalls === 0) {
        throw new Error(
          'Code generation failed: Model did not use any tools. ' +
          'The AI model needs to call createOrUpdateFiles to generate code. ' +
          'Please try again or use a different model.'
        );
      }

      if (Object.keys(files).length === 0) {
        throw new Error(
          'Code generation failed: No files were created. ' +
          'The createOrUpdateFiles tool must be used to implement the requested features.'
        );
      }

      return { text: text || fullText, files };
    },
    {
      maxAttempts: 3,
      retryIf: retryOnTransient,
    }
  );

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
  const summaryMatch = text.match(/<task_summary>([\s\S]*?)<\/task_summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  const firstParagraph = text.split('\n\n')[0];
  return firstParagraph?.slice(0, 200) || 'Code generation completed';
}
