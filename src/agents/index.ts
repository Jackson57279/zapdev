export { getModel, MODEL_CONFIGS } from './client';
export type { ModelId } from './client';

export * from './types';

export { sandboxManager, SandboxManager } from './sandbox';
export { withRetry, retryOnRateLimit, retryOnTimeout, retryOnTransient } from './retry';
export { createLogger, AgentLogger } from './logger';
export { createTools } from './tools';
export type { AgentTools } from './tools';

export { getFrameworkPrompt } from './prompts';

// Legacy exports (for backward compatibility)
export { generateCode } from './agents/code-generation';
export { selectFramework } from './agents/framework-selector';
export { runValidation } from './agents/validation';
export { fixErrors } from './agents/error-fixer';

// New ToolLoopAgent-based exports
export { createCodeAgent, generateCodeWithAgent } from './agents/code-agent';
export type { CodeGenerationResult } from './agents/code-agent';
export { createErrorFixerAgent, fixErrorsWithAgent } from './agents/error-fixer-agent';
