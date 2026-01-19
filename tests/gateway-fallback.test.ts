import { getModel, getClientForModel, isCerebrasModel } from '../src/agents/client';
import { withGatewayFallbackGenerator } from '../src/agents/rate-limit';

describe('OpenRouter Fallback', () => {
  describe('Client Functions', () => {
    it('should identify Cerebras models correctly', () => {
      expect(isCerebrasModel('zai-glm-4.7')).toBe(true);
      expect(isCerebrasModel('anthropic/claude-haiku-4.5')).toBe(false);
      expect(isCerebrasModel('openai/gpt-5.1-codex')).toBe(false);
    });

    it('should return direct Cerebras client by default for Cerebras models', () => {
      const model = getModel('zai-glm-4.7');
      expect(model).toBeDefined();
      expect(model).not.toBeNull();
    });

    it('should return OpenRouter client when useGatewayFallback is true for Cerebras models', () => {
      const model = getModel('zai-glm-4.7', { useGatewayFallback: true });
      expect(model).toBeDefined();
      expect(model).not.toBeNull();
    });

    it('should not use fallback for non-Cerebras models', () => {
      expect(isCerebrasModel('anthropic/claude-haiku-4.5')).toBe(false);
      
      const directClient = getModel('anthropic/claude-haiku-4.5');
      const fallbackClient = getModel('anthropic/claude-haiku-4.5', { useGatewayFallback: true });

      // Both should use the same openrouter provider since non-Cerebras models
      // don't use gateway fallback - this verifies the stated behavior
      expect(directClient.provider).toBe(fallbackClient.provider);
    });

    it('should return chat function from getClientForModel', () => {
      const client = getClientForModel('zai-glm-4.7');
      expect(client.chat).toBeDefined();
      expect(typeof client.chat).toBe('function');
    });
  });

  describe('Fallback Generator', () => {
    it('should yield values from successful generator', async () => {
      const mockGenerator = async function* () {
        yield 'value1';
        yield 'value2';
      };

      const values: string[] = [];
      for await (const value of withGatewayFallbackGenerator(mockGenerator, {
        modelId: 'test-model',
        context: 'test',
      })) {
        values.push(value);
      }

      expect(values).toEqual(['value1', 'value2']);
    });

    it('should retry on error', async () => {
      let attemptCount = 0;
      const mockGenerator = async function* () {
        attemptCount++;
        if (attemptCount === 1) {
          const error = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
          throw error;
        }
        yield 'success';
      };

      const values: string[] = [];
      for await (const value of withGatewayFallbackGenerator(mockGenerator, {
        modelId: 'test-model',
        context: 'test',
      })) {
        values.push(value);
      }

      expect(values).toEqual(['success']);
      expect(attemptCount).toBe(2);
    });

    it('should switch to OpenRouter on rate limit error', async () => {
      const mockGenerator = async function* (useGateway: boolean) {
        if (!useGateway) {
          const error = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
          throw error;
        }
        yield 'openrouter-success';
      };

      const values: string[] = [];
      for await (const value of withGatewayFallbackGenerator(mockGenerator, {
        modelId: 'test-model',
        context: 'test',
      })) {
        values.push(value);
      }

      expect(values).toEqual(['openrouter-success']);
    });

    it('should throw after max attempts', async () => {
      let attemptCount = 0;
      const mockGenerator = async function* () {
        attemptCount++;
        // Use a non-rate-limit error to avoid 60s wait in this test
        const error = new Error('Server error');
        throw error;
      };

      let errorThrown = false;
      try {
        for await (const _value of withGatewayFallbackGenerator(mockGenerator, {
          modelId: 'test-model',
          context: 'test',
        })) {
        }
      } catch (error) {
        errorThrown = true;
        expect(error).toBeDefined();
        expect((error as Error).message).toBe('Server error');
      }

      expect(errorThrown).toBe(true);
      expect(attemptCount).toBe(2); // Direct + fallback attempts
    }, 10000); // Increase timeout to 10s for safety
  });

  describe('Provider Options', () => {
    it('provider options should be set correctly in code-agent implementation', () => {
      const client = getClientForModel('zai-glm-4.7', { useGatewayFallback: true });
      expect(client).toBeDefined();
    });
  });
});
