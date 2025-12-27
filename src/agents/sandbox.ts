import { Sandbox } from '@e2b/code-interpreter';
import * as Sentry from '@sentry/nextjs';
import { SANDBOX_TIMEOUT_MS, Framework, TerminalResult } from './types';

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

const FRAMEWORK_TEMPLATES: Record<Framework, string> = {
  nextjs: 'nextjs-developer',
  react: 'react-developer',
  vue: 'vue-developer',
  angular: 'angular-developer',
  svelte: 'svelte-developer',
};

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
      return cached;
    }

    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);

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
        timeoutMs: SANDBOX_TIMEOUT_MS,
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

  private scheduleCacheCleanup(sandboxId: string): void {
    setTimeout(() => {
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
