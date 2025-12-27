import { NEXTJS_PROMPT } from '@/prompts/nextjs';
import { ANGULAR_PROMPT } from '@/prompts/angular';
import { REACT_PROMPT } from '@/prompts/react';
import { VUE_PROMPT } from '@/prompts/vue';
import { SVELTE_PROMPT } from '@/prompts/svelte';
import { FRAMEWORK_SELECTOR_PROMPT } from '@/prompts/framework-selector';
import { RESPONSE_PROMPT, FRAGMENT_TITLE_PROMPT } from '@/prompts/shared';
import type { Framework } from '../types';

export {
  NEXTJS_PROMPT,
  ANGULAR_PROMPT,
  REACT_PROMPT,
  VUE_PROMPT,
  SVELTE_PROMPT,
  FRAMEWORK_SELECTOR_PROMPT,
  RESPONSE_PROMPT,
  FRAGMENT_TITLE_PROMPT,
};

const FRAMEWORK_PROMPTS: Record<Framework, string> = {
  nextjs: NEXTJS_PROMPT,
  angular: ANGULAR_PROMPT,
  react: REACT_PROMPT,
  vue: VUE_PROMPT,
  svelte: SVELTE_PROMPT,
};

export function getFrameworkPrompt(framework: Framework): string {
  return FRAMEWORK_PROMPTS[framework] || NEXTJS_PROMPT;
}
