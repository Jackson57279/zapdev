import { tool } from 'ai';
import { z } from 'zod';
import type { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';

export function createTools(sandbox: Sandbox, onFileWrite?: (path: string) => void) {
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
      execute: async ({ files }) => {
        Sentry.addBreadcrumb({
          category: 'tool',
          message: `Writing ${files.length} files`,
          data: { paths: files.map((f) => f.path) },
        });

        for (const file of files) {
          await sandbox.files.write(file.path, file.content);
          onFileWrite?.(file.path);
        }

        return { success: true, filesWritten: files.map((f) => f.path) };
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
        // Escape backslashes first, then double quotes for shell safety
        const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const result = await sandbox.commands.run(
          `find -- "${escapedPath}" \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" \\) -type f -print0`
        );
        
        const output = result.stdout || '';
        const files = output
          .split('\0')
          .filter(Boolean)
          .slice(0, 50);
        
        return { files };
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof createTools>;
