export const SANDBOX_TIMEOUT = 60_000 * 60; // 60 minutes in MS

export type Framework = 'nextjs' | 'angular' | 'react' | 'vue' | 'svelte';

export interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework?: Framework;
  summaryRetryCount: number;
}

export interface ClientState {
  projectId: string;
  userId?: string;
}
