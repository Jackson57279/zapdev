import type { Sandbox } from '@e2b/code-interpreter';

export interface FileCache {
  files: Record<string, string>;
  manifest?: {
    [path: string]: {
      type: 'file' | 'directory';
      size?: number;
    };
  };
}

export interface SandboxState {
  sandbox?: Sandbox;
  sandboxId?: string;
  fileCache?: FileCache;
}

declare global {
  var sandboxState: SandboxState;
}

