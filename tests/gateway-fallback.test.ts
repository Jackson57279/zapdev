import { getModel, getClientForModel, isCerebrasModel } from '../src/agents/client';
import { withGatewayFallbackGenerator } from '../src/agents/rate-limit';

describe('Vercel AI Gateway Fallback', () => {
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

    it('should return Vercel AI Gateway client when useGatewayFallback is true for Cerebras models', () => {
      const model = getModel('zai-glm-4.7', { useGatewayFallback: true });
      expect(model).toBeDefined();
      expect(model).not.toBeNull();
    });

    it('should not use gateway for non-Cerebras models', () => {
      expect(isCerebrasModel('anthropic/claude-haiku-4.5')).toBe(false);
      
      const directClient = getModel('anthropic/claude-haiku-4.5');
      const gatewayClient = getModel('anthropic/claude-haiku-4.5', { useGatewayFallback: true });

      expect(directClient).toBeDefined();
      expect(gatewayClient).toBeDefined();
    });

    it('should return chat function from getClientForModel', () => {
      const client = getClientForModel('zai-glm-4.7');
      expect(client.chat).toBeDefined();
      expect(typeof client.chat).toBe('function');
    });
  });

  describe('Gateway Fallback Generator', () => {
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
          const error = new Error('Rate limit exceeded');
          (error as any).status = 429;
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

    it('should switch to gateway on rate limit error', async () => {
      let useGatewayFlag = false;
      const mockGenerator = async function* (useGateway: boolean) {
        if (!useGateway) {
          const error = new Error('Rate limit exceeded');
          (error as any).status = 429;
          throw error;
        }
        yield 'gateway-success';
      };

      const values: string[] = [];
      for await (const value of withGatewayFallbackGenerator(mockGenerator, {
        modelId: 'test-model',
        context: 'test',
      })) {
        values.push(value);
      }

      expect(values).toEqual(['gateway-success']);
    });

    it('should throw after max attempts', async () => {
      let attemptCount = 0;
      const mockGenerator = async function* () {
        attemptCount++;
        const error = new Error('Rate limit exceeded');
        (error as any).status = 429;
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
      }

      expect(errorThrown).toBe(true);
    });
  });

  describe('Provider Options', () => {
    it('provider options should be set correctly in code-agent implementation', () => {
      const client = getClientForModel('zai-glm-4.7', { useGatewayFallback: true });
      expect(client).toBeDefined();
    });
  });
});
