/**
 * Streaming Utilities Index
 * 
 * Re-exports all streaming-related utilities for easy imports.
 */

// SSE Streaming utilities
export {
  createSSEStream,
  getSSEHeaders,
  createSSEResponse,
  withSSEStream,
  parseSSEChunk,
  consumeSSEStream,
  type StreamEvent,
  type StreamEventType,
  type StatusEvent,
  type StreamTextEvent,
  type ComponentEvent,
  type FileProgressEvent,
  type FileCompleteEvent,
  type PackageEvent,
  type ErrorEvent,
  type CompleteEvent,
} from './sse';

// Types
export {
  type ConversationMessage,
  type ConversationEdit,
  type EditType,
  type ConversationContext,
  type ConversationState,
  type FileInfo,
  type FileManifest,
  type CachedFile,
  type FileCache,
  type SearchPlan,
  type SearchResult,
  type EditContext,
  type SandboxInfo,
  type CommandResult,
  type SandboxState,
  type GenerateCodeRequest,
  type ApplyCodeRequest,
  type ParsedAIResponse,
  type ModelConfig,
  type ModelId,
  type AppConfig,
  type UserPreferencesAnalysis,
  analyzeUserPreferences,
} from './types';

// AI Provider utilities
export {
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  MODEL_DISPLAY_NAMES,
  getProviderAndModel,
  selectModelForTask,
  createStreamingRequest,
  createStreamingRequestWithRetry,
  isValidModelId,
  getModelConfig,
  getAvailableModels,
  isAIGatewayEnabled,
  type StreamOptions,
  type Message,
} from './ai-provider';

// File Manifest utilities
export {
  getFileType,
  isComponentFile,
  extractComponentName,
  extractChildComponents,
  extractComponentInfo,
  analyzeImports,
  categorizeImports,
  buildFileTree,
  generateFileManifest,
  updateFileManifest,
  removeFromManifest,
  getManifestSummary,
} from './file-manifest';

// Context Selector utilities
export {
  searchInFile,
  searchWithRegex,
  executeSearchPlan,
  rankResults,
  selectTargetFiles,
  buildEditContext,
  selectContextFiles,
  selectEditContext,
} from './context-selector';
