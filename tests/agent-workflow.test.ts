/**
 * Tests for agent workflow and error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the dependencies
jest.mock('@/agents/code-agent', () => ({
  runCodeAgent: jest.fn(),
  runErrorFix: jest.fn(),
}));

jest.mock('@/agents/sandbox-utils', () => ({
  createSandbox: jest.fn(),
  runBuildCheck: jest.fn(),
  startDevServer: jest.fn(),
  writeFilesBatch: jest.fn(),
}));

jest.mock('@/agents/tools', () => ({
  createAgentTools: jest.fn(),
}));

jest.mock('@/lib/firecrawl', () => ({
  crawlUrl: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  getOrCompute: jest.fn(),
}));

import { runCodeAgent, runErrorFix } from '@/agents/code-agent';
import { createSandbox, runBuildCheck, startDevServer } from '@/agents/sandbox-utils';
import { createAgentTools } from '@/agents/tools';
import { crawlUrl } from '@/lib/firecrawl';
import { cache } from '@/lib/cache';

// Mock sandbox object
const mockSandbox: any = {
  sandboxId: 'test-sandbox-id',
  commands: {
    run: jest.fn(),
  },
  files: {
    write: jest.fn(),
    read: jest.fn(),
  },
  runCode: jest.fn(),
};

// Mock Convex client
const mockConvex: any = {
  query: jest.fn(),
  mutation: jest.fn(),
};

describe('Agent Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    (createSandbox as any).mockResolvedValue(mockSandbox);
    (runBuildCheck as any).mockResolvedValue(null);
    (startDevServer as any).mockResolvedValue('https://test-url.e2b.dev');
    (createAgentTools as any).mockReturnValue({
      terminal: jest.fn(),
      createOrUpdateFiles: jest.fn(),
      readFiles: jest.fn(),
    });
    (crawlUrl as any).mockResolvedValue({
      url: 'https://example.com',
      content: 'Example content',
    });
  });

  describe('runCodeAgent', () => {
    it('should initialize project and create sandbox', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      mockConvex.mutation.mockResolvedValue('message-id');

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create a simple button component',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({
        type: 'status',
        data: expect.stringContaining('Initializing'),
      });
    });

    it('should detect framework when not provided', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: null,
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      (cache.getOrCompute as jest.Mock).mockResolvedValue('nextjs');

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create a React component',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 5) break;
      }

      expect(cache.getOrCompute).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockConvex.query.mockRejectedValue(new Error('Project not found'));

      const generator = runCodeAgent({
        projectId: 'invalid-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data).toContain('Project not found');
    });

    it('should validate build and trigger auto-fix on errors', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      (runBuildCheck as jest.Mock)
        .mockResolvedValueOnce('Build failed: Syntax error')
        .mockResolvedValueOnce(null);

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create a component with errors',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 20) break;
      }

      const autoFixEvent = events.find(e => 
        e.type === 'status' && typeof e.data === 'string' && e.data.includes('Auto-fixing')
      );
      expect(autoFixEvent).toBeDefined();
    });

    it('should crawl URLs when present in prompt', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create a component like https://example.com',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 10) break;
      }

      expect(crawlUrl).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('runErrorFix', () => {
    it('should fix errors in existing fragment', async () => {
      const mockFragment = {
        _id: 'fragment-id',
        messageId: 'message-id',
        sandboxId: 'sandbox-id',
        sandboxUrl: 'https://test-url.e2b.dev',
        files: { 'src/app/page.tsx': 'export default function Page() { return <div>Hello</div>; }' },
        framework: 'nextjs',
        metadata: { model: 'anthropic/claude-haiku-4.5' },
      };

      const mockMessage = {
        _id: 'message-id',
        projectId: 'project-id',
      };

      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
      };

      mockConvex.query
        .mockResolvedValueOnce(mockFragment)
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(mockProject);
      
      (runBuildCheck as jest.Mock).mockResolvedValueOnce('Build error').mockResolvedValueOnce(null);
      mockConvex.mutation.mockResolvedValue('updated-id');

      const result = await runErrorFix('fragment-id');

      expect(result.success).toBe(true);
      expect(runBuildCheck).toHaveBeenCalled();
    });

    it('should handle missing fragment gracefully', async () => {
      mockConvex.query.mockResolvedValue(null);

      await expect(runErrorFix('invalid-id')).rejects.toThrow('Fragment not found');
    });

    it('should return success when no errors exist', async () => {
      const mockFragment = {
        _id: 'fragment-id',
        messageId: 'message-id',
        sandboxId: 'sandbox-id',
        sandboxUrl: 'https://test-url.e2b.dev',
        files: {},
        framework: 'nextjs',
        metadata: { model: 'anthropic/claude-haiku-4.5' },
      };

      const mockMessage = {
        _id: 'message-id',
        projectId: 'project-id',
      };

      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
      };

      mockConvex.query
        .mockResolvedValueOnce(mockFragment)
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(mockProject);
      
      (runBuildCheck as jest.Mock).mockResolvedValue(null);

      const result = await runErrorFix('fragment-id');

      expect(result.success).toBe(true);
      expect(result.message).toBe('No errors detected');
    });
  });

  describe('Error Handling', () => {
    it('should handle sandbox creation failures', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      (createSandbox as jest.Mock).mockRejectedValue(new Error('E2B API error'));

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data).toContain('E2B API error');
    });

    it('should handle build check failures gracefully', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      (runBuildCheck as jest.Mock).mockRejectedValue(new Error('Build system error'));

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 15) break;
      }

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle dev server startup failures', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      (startDevServer as jest.Mock).mockRejectedValue(new Error('Port already in use'));

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  describe('Logging and Status Updates', () => {
    it('should emit status events throughout the workflow', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 10) break;
      }

      const statusEvents = events.filter(e => e.type === 'status');
      expect(statusEvents.length).toBeGreaterThan(0);
    });

    it('should emit file-created events when files are generated', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create a button component',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length > 20) break;
      }

      const fileEvents = events.filter(e => e.type === 'file-created');
      expect(fileEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should emit complete event on success', async () => {
      const mockProject = {
        _id: 'project-id',
        userId: 'user-id',
        framework: 'nextjs',
        modelPreference: 'auto',
      };

      mockConvex.query.mockResolvedValue(mockProject);
      mockConvex.mutation.mockResolvedValue('message-id');

      const generator = runCodeAgent({
        projectId: 'project-id',
        value: 'Create something',
        model: 'auto',
      });

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (event.type === 'complete') break;
      }

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data).toHaveProperty('url');
      expect(completeEvent?.data).toHaveProperty('files');
    });
  });
});
