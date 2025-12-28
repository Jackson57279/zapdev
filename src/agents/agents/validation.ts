import { sandboxManager } from '../sandbox';
import { createLogger } from '../logger';
import type { ValidationResult } from '../types';

export async function runValidation(sandboxId: string): Promise<ValidationResult> {
  const logger = createLogger(`validation-${sandboxId}`);
  const sandbox = await sandboxManager.connect(sandboxId);

  logger.progress('lint', 'Running linter');
  const lintResult = await sandboxManager.runCommand(sandbox, 'npm run lint -- --cache', 30000);

  if (lintResult.exitCode !== 0) {
    logger.warn('Lint failed', { stderr: lintResult.stderr });
    return {
      success: false,
      type: 'lint',
      errors: [lintResult.stderr || lintResult.stdout],
    };
  }

  logger.progress('build', 'Running build');
  const buildResult = await sandboxManager.runCommand(sandbox, 'npm run build', 120000);

  if (buildResult.exitCode !== 0) {
    logger.warn('Build failed', { stderr: buildResult.stderr });
    return {
      success: false,
      type: 'build',
      errors: [buildResult.stderr || buildResult.stdout],
    };
  }

  logger.progress('complete', 'Validation passed');
  return { success: true };
}
