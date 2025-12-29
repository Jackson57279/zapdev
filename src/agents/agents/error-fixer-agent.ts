import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { getModel } from '../client';
import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import { runValidation } from './validation';
import type { ValidationResult, StreamUpdate } from '../types';
import type { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';

const ERROR_FIX_INSTRUCTIONS = `You are an expert debugger and code fixer. Your task is to fix errors in the codebase.

## Your Approach:
1. First, read the files that are causing errors to understand the context
2. Analyze the error messages carefully to identify the root cause
3. Make minimal, targeted changes to fix the issues
4. Verify your fixes by running lint and build commands

## Rules:
- Only change what's necessary to fix the errors
- Preserve existing functionality and code style
- If you're unsure about a fix, explain your reasoning
- Always run validation after making changes

## Common Error Patterns:
- TypeScript type errors: Check type definitions and imports
- Import errors: Verify file paths and export statements
- Syntax errors: Look for missing brackets, semicolons, or typos
- Build errors: Check for missing dependencies or configuration issues
`;

const MAX_FIX_ATTEMPTS = 2;

/**
 * Creates sandbox tools for the error fixer agent
 */
function createErrorFixerTools(sandbox: Sandbox) {
  return {
    createOrUpdateFiles: tool({
      description: 'Update files to fix errors. Use this to apply your fixes.',
      inputSchema: z.object({
        files: z.array(
          z.object({
            path: z.string().describe('File path to update'),
            content: z.string().describe('Fixed file content'),
          })
        ),
      }),
      execute: async ({ files }) => {
        Sentry.addBreadcrumb({
          category: 'error-fixer',
          message: `Fixing ${files.length} files`,
          data: { paths: files.map((f) => f.path) },
        });

        for (const file of files) {
          await sandbox.files.write(file.path, file.content);
        }

        return { success: true, filesFixed: files.map((f) => f.path) };
      },
    }),

    readFiles: tool({
      description: 'Read files to understand the code and find the source of errors.',
      inputSchema: z.object({
        paths: z.array(z.string()).describe('File paths to read'),
      }),
      execute: async ({ paths }) => {
        Sentry.addBreadcrumb({
          category: 'error-fixer',
          message: `Reading ${paths.length} files for analysis`,
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
      description: 'Run terminal commands to verify fixes (npm run lint, npm run build).',
      inputSchema: z.object({
        command: z.string().describe('Command to run'),
        timeoutMs: z.number().optional().describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeoutMs = 60000 }) => {
        Sentry.addBreadcrumb({
          category: 'error-fixer',
          message: `Running verification: ${command}`,
        });

        const result = await sandbox.commands.run(command, { timeoutMs: timeoutMs ?? 60000 });

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? 0,
        };
      },
    }),

    listFiles: tool({
      description: 'List files in a directory to find related files.',
      inputSchema: z.object({
        path: z.string().describe('Directory path'),
      }),
      execute: async ({ path }) => {
        const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const result = await sandbox.commands.run(
          `find -- "${escapedPath}" \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -type f -print0`
        );

        const output = result.stdout || '';
        const files = output.split('\0').filter(Boolean).slice(0, 30);

        return { files };
      },
    }),
  };
}

/**
 * Creates an Error Fixer Agent using AI SDK ToolLoopAgent
 */
export function createErrorFixerAgent(sandbox: Sandbox) {
  const tools = createErrorFixerTools(sandbox);

  return new ToolLoopAgent({
    model: getModel('anthropic/claude-haiku-4.5'),
    instructions: ERROR_FIX_INSTRUCTIONS,
    tools,
    stopWhen: stepCountIs(10),
  });
}

/**
 * Fix errors using the ToolLoopAgent
 */
export async function fixErrorsWithAgent(
  sandboxId: string,
  errors: string[],
  attempt: number,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<ValidationResult> {
  const logger = createLogger(`error-fix-${sandboxId}`, { attempt });

  if (attempt >= MAX_FIX_ATTEMPTS) {
    logger.warn('Max fix attempts reached');
    return {
      success: false,
      errors: ['Max auto-fix attempts reached. Manual intervention required.'],
    };
  }

  logger.progress('start', `Auto-fix attempt ${attempt + 1}`);
  await onProgress({
    type: 'status',
    message: `Attempting to fix errors (attempt ${attempt + 1})...`,
  });

  // Connect to sandbox
  const sandbox = await sandboxManager.connect(sandboxId);

  // Create the error fixer agent
  const agent = createErrorFixerAgent(sandbox);

  // Build the prompt with error details
  const errorPrompt = `Fix these errors in the codebase:

${errors.map((e, i) => `Error ${i + 1}:\n${e}`).join('\n\n')}

Steps:
1. Read the relevant files to understand the context
2. Identify the root cause of each error
3. Apply fixes using createOrUpdateFiles
4. Run "npm run lint" and "npm run build" to verify`;

  try {
    // Use streaming for real-time updates
    // agent.stream() returns a Promise<StreamTextResult>, so we await it first
    const result = await agent.stream({ prompt: errorPrompt });

    for await (const chunk of result.textStream) {
      await onProgress({ type: 'stream', content: chunk });
    }

    // Wait for completion
    await result.text;
    const steps = await result.steps;

    console.log(`[ErrorFixer] Completed in ${steps.length} steps`);

    // Re-run validation
    logger.progress('validate', 'Re-running validation');
    const validationResult = await runValidation(sandboxId);

    if (!validationResult.success) {
      // Recursive retry with incremented attempt
      return fixErrorsWithAgent(sandboxId, validationResult.errors || [], attempt + 1, onProgress);
    }

    logger.progress('complete', 'Errors fixed successfully');
    await onProgress({ type: 'status', message: 'Errors fixed!' });

    return validationResult;
  } catch (error) {
    const errorMessage = `Error fixing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    Sentry.captureException(error);

    return {
      success: false,
      errors: [errorMessage],
    };
  }
}
