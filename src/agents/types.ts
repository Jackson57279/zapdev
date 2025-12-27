export const SANDBOX_TIMEOUT_MS = 60 * 60 * 1000;

export type Framework = 'nextjs' | 'angular' | 'react' | 'vue' | 'svelte';

export interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework?: Framework;
  summaryRetryCount: number;
}

export type TaskStatus = 'pending' | 'running' | 'complete' | 'failed';
export type TaskStage = 'init' | 'framework' | 'ai' | 'start' | 'lint' | 'build' | 'validate' | 'complete';

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  stage: TaskStage;
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
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
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

export interface FileWriteResult {
  success: boolean;
  filesWritten: string[];
}

export interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
