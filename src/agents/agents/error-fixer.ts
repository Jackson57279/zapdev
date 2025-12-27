import { streamText } from 'ai';
import { getModel } from '../client';
import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import { createTools } from '../tools';
import { runValidation } from './validation';
import type { ValidationResult, StreamUpdate } from '../types';

const ERROR_FIX_PROMPT = `You are an expert debugger. The previous code generation resulted in errors.

Your task:
1. Read the files that caused the errors
2. Understand the root cause
3. Fix the issues by updating the files
4. Run lint and build to verify

Be precise and only change what's necessary to fix the errors.
`;

const MAX_FIX_ATTEMPTS = 2;

export async function fixErrors(
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
  await onProgress({ type: 'status', message: `Attempting to fix errors (attempt ${attempt + 1})...` });

  const sandbox = await sandboxManager.connect(sandboxId);
  const tools = createTools(sandbox);

  const result = streamText({
    model: getModel('anthropic/claude-haiku-4.5'),
    system: ERROR_FIX_PROMPT,
    prompt: `Fix these errors:\n\n${errors.join('\n\n')}`,
    tools,
    temperature: 0.3,
  });

  for await (const textPart of result.textStream) {
    await onProgress({ type: 'stream', content: textPart });
  }

  await result.text;

  logger.progress('validate', 'Re-running validation');
  const validationResult = await runValidation(sandboxId);

  if (!validationResult.success) {
    return fixErrors(sandboxId, validationResult.errors || [], attempt + 1, onProgress);
  }

  logger.progress('complete', 'Errors fixed successfully');
  await onProgress({ type: 'status', message: 'Errors fixed!' });

  return validationResult;
}
