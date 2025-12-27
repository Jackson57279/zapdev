import { generateText } from 'ai';
import { getModel } from '../client';
import { createLogger } from '../logger';
import { withRetry, retryOnTransient } from '../retry';
import { Framework } from '../types';
import { FRAMEWORK_SELECTOR_PROMPT } from '../prompts';

const VALID_FRAMEWORKS: Framework[] = ['nextjs', 'angular', 'react', 'vue', 'svelte'];

export async function selectFramework(prompt: string): Promise<Framework> {
  const logger = createLogger('framework-selector');

  logger.progress('start', 'Detecting framework from prompt');

  const result = await withRetry(
    async () => {
      const response = await generateText({
        model: getModel('google/gemini-2.5-flash-lite'),
        system: FRAMEWORK_SELECTOR_PROMPT,
        prompt: `User request: ${prompt}`,
        temperature: 0.3,
      });

      return response.text.toLowerCase().trim();
    },
    {
      maxAttempts: 2,
      retryIf: retryOnTransient,
    }
  );

  const framework = VALID_FRAMEWORKS.find((f) => result.includes(f)) || 'nextjs';

  logger.progress('complete', `Selected framework: ${framework}`);

  return framework;
}
