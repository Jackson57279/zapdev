import { selectModelForTask, MODEL_CONFIGS } from '../src/agents/types';
import type { Framework } from '../src/agents/types';

describe('Model Selection Logic', () => {
  const defaultModel = 'anthropic/claude-haiku-4.5' as const;

  it('defaults to Claude Haiku when no special indicators exist', () => {
    const prompt = 'Build a marketing page with testimonials.';
    const result = selectModelForTask(prompt);

    expect(result).toBe(defaultModel);
    expect(MODEL_CONFIGS[result]).toBeDefined();
  });

  it('prefers Kimi K2.5 for coding-focused refinements', () => {
    const prompt = 'Please refactor this component to improve readability.';
    const result = selectModelForTask(prompt);

    expect(result).toBe('moonshotai/kimi-k2.5');
  });

  it('prefers GLM 4.7 for clearly speed-focused prompts without complexity', () => {
    const prompt = 'Need a quick prototype landing page mockup.';
    const result = selectModelForTask(prompt);

    expect(result).toBe('zai-glm-4.7');
  });

  it('keeps Claude Haiku when complexity indicators are present even if speed is requested', () => {
    const prompt = 'Need a quick enterprise architecture overview with detailed security notes.';
    const result = selectModelForTask(prompt);

    expect(result).toBe(defaultModel);
  });

  it('keeps Claude Haiku for very long prompts even with coding hints', () => {
    const prompt = 'refactor '.repeat(100) + 'a'.repeat(1100);
    const result = selectModelForTask(prompt);

    expect(result).toBe(defaultModel);
  });

  it('defaults to Claude Haiku for Angular enterprise work', () => {
    const prompt = 'Design an enterprise dashboard with advanced reporting.';
    const angularFramework: Framework = 'angular';
    const result = selectModelForTask(prompt, angularFramework);

    expect(result).toBe(defaultModel);
  });

  it('moonshot config has correct provider field', () => {
    const moonshotConfig = MODEL_CONFIGS['moonshotai/kimi-k2.5'];
    expect(moonshotConfig).toBeDefined();
    expect(moonshotConfig.provider).toBe('moonshot');
  });
});
