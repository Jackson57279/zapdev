import { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';
import { SANDBOX_TIMEOUT_MS, Framework, TerminalResult } from './types';

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

const FRAMEWORK_TEMPLATES: Record<Framework, string> = {
  nextjs: 'zapdev',
  react: 'react-developer',
  vue: 'vue-developer',
  angular: 'angular-developer',
  svelte: 'svelte-developer',
};

function getE2BApiKey(): string {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error('E2B_API_KEY environment variable is not set');
  }
  return apiKey;
}

export class SandboxManager {
  private static instance: SandboxManager;

  static getInstance(): SandboxManager {
    if (!SandboxManager.instance) {
      SandboxManager.instance = new SandboxManager();
    }
    return SandboxManager.instance;
  }

  async connect(sandboxId: string): Promise<Sandbox> {
    const cached = SANDBOX_CACHE.get(sandboxId);
    if (cached) {
      console.log(`[SANDBOX] Using cached sandbox: ${sandboxId}`);
      return cached;
    }

    try {
      const apiKey = getE2BApiKey();
      console.log(`[SANDBOX] Connecting to sandbox: ${sandboxId}`);
      
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey,
      });
      
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);

      SANDBOX_CACHE.set(sandboxId, sandbox);
      this.scheduleCacheCleanup(sandboxId);

      console.log(`[SANDBOX] Successfully connected to sandbox: ${sandboxId}`);
      Sentry.addBreadcrumb({
        category: 'sandbox',
        message: `Connected to sandbox ${sandboxId}`,
        level: 'info',
      });

      return sandbox;
    } catch (error) {
      console.error(`[SANDBOX] Failed to connect to sandbox ${sandboxId}:`, error);
      Sentry.captureException(error, {
        extra: { sandboxId },
        tags: { component: 'sandbox' },
      });
      throw new Error(`Failed to connect to sandbox ${sandboxId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async create(framework: Framework): Promise<Sandbox> {
    const template = FRAMEWORK_TEMPLATES[framework];

    try {
      const apiKey = getE2BApiKey();
      console.log(`[SANDBOX] Creating new sandbox with template: ${template} (framework: ${framework})`);
      
      const sandbox = await Sandbox.create(template, {
        apiKey,
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });

      console.log(`[SANDBOX] Successfully created sandbox: ${sandbox.sandboxId}`);
      SANDBOX_CACHE.set(sandbox.sandboxId, sandbox);
      this.scheduleCacheCleanup(sandbox.sandboxId);

      Sentry.addBreadcrumb({
        category: 'sandbox',
        message: `Created sandbox ${sandbox.sandboxId} with template ${template}`,
        level: 'info',
      });

      return sandbox;
    } catch (error) {
      console.error(`[SANDBOX] Failed to create sandbox with template ${template}:`, error);
      Sentry.captureException(error, {
        extra: { framework, template },
        tags: { component: 'sandbox' },
      });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create E2B sandbox: ${errorMessage}. Make sure E2B_API_KEY is valid and the template '${template}' exists.`);
    }
  }

  private scheduleCacheCleanup(sandboxId: string): void {
    setTimeout(async () => {
      const sandbox = SANDBOX_CACHE.get(sandboxId);
      if (sandbox) {
        try {
          await sandbox.kill();
        } catch (error) {
          Sentry.captureException(error, {
            extra: { sandboxId },
            tags: { component: 'sandbox', action: 'cleanup' },
          });
        }
      }
      SANDBOX_CACHE.delete(sandboxId);
    }, CACHE_EXPIRY_MS);
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
  ): Promise<TerminalResult> {
    const result = await sandbox.commands.run(command, { timeoutMs });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode ?? 0,
    };
  }
}

export const sandboxManager = SandboxManager.getInstance();
