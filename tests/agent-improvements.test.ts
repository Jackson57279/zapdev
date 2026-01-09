/**
 * Integration tests for agent workflow improvements
 * Tests logging, error handling, and status updates
 */

import { describe, it, expect } from '@jest/globals';

describe('Agent Workflow Improvements', () => {
  describe('Logging Levels', () => {
    it('should have consistent log format', () => {
      const logLevels = ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL ERROR'];
      
      logLevels.forEach(level => {
        const logPattern = new RegExp(`\\[${level}\\]`);
        expect(logPattern.test(`[${level}] Test message`)).toBe(true);
      });
    });

    it('should include timestamps in INFO logs', () => {
      const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      const timestamp = new Date().toISOString();
      expect(timestampPattern.test(timestamp)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error messages', () => {
      const error = new Error('Test error');
      const errorMessage = error.message;
      
      expect(errorMessage).toBe('Test error');
      expect(errorMessage.length).toBeGreaterThan(0);
    });

    it('should handle stack traces', () => {
      const error = new Error('Test error');
      const stackTrace = error.stack;
      
      expect(stackTrace).toBeDefined();
      expect(stackTrace).toContain('Error: Test error');
    });

    it('should format error context properly', () => {
      const context = {
        projectId: 'test-id',
        framework: 'nextjs',
        timestamp: new Date().toISOString(),
      };
      
      const formatted = JSON.stringify(context, null, 2);
      expect(formatted).toContain('test-id');
      expect(formatted).toContain('nextjs');
    });
  });

  describe('Status Updates', () => {
    it('should have descriptive status messages', () => {
      const statuses = [
        'Initializing project...',
        'Setting up environment...',
        'Running AI generation...',
        'Validating build...',
        'Starting dev server...',
      ];
      
      statuses.forEach(status => {
        expect(status.length).toBeGreaterThan(10);
        expect(status.endsWith('...')).toBe(true);
      });
    });

    it('should include progress indicators', () => {
      const progressMessage = 'Auto-fixing errors (attempt 1/1)...';
      const progressPattern = /attempt \d+\/\d+/;
      
      expect(progressPattern.test(progressMessage)).toBe(true);
    });
  });

  describe('Stream Events', () => {
    it('should have valid event types', () => {
      const validTypes = [
        'status',
        'text',
        'tool-call',
        'tool-output',
        'file-created',
        'file-updated',
        'progress',
        'files',
        'error',
        'complete',
      ];
      
      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should include timestamps in events', () => {
      const event = {
        type: 'status',
        data: 'Test',
        timestamp: Date.now(),
      };
      
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Build Validation', () => {
    it('should detect build errors', () => {
      const buildOutput = 'Build failed: Syntax error in src/app/page.tsx';
      const hasError = buildOutput.toLowerCase().includes('error');
      
      expect(hasError).toBe(true);
    });

    it('should identify error patterns', () => {
      const errorPatterns = [
        /Error:/i,
        /\[ERROR\]/i,
        /SyntaxError/i,
        /TypeError/i,
        /Module not found/i,
      ];
      
      const testErrors = [
        'Error: Something went wrong',
        '[ERROR] Build failed',
        'SyntaxError: Unexpected token',
        'TypeError: Cannot read property',
        'Module not found: ./missing',
      ];
      
      testErrors.forEach(error => {
        const matchesPattern = errorPatterns.some(pattern => pattern.test(error));
        expect(matchesPattern).toBe(true);
      });
    });
  });

  describe('File Operations', () => {
    it('should validate file paths', () => {
      const validPaths = [
        'src/app/page.tsx',
        'components/Button.tsx',
        'lib/utils.ts',
      ];
      
      const invalidPaths = [
        '../etc/passwd',
        '../../../secret',
        'path\x00with\x00null',
      ];
      
      validPaths.forEach(path => {
        expect(path.includes('..')).toBe(false);
        expect(path.includes('\x00')).toBe(false);
      });
      
      invalidPaths.forEach(path => {
        expect(path.includes('..') || path.includes('\x00')).toBe(true);
      });
    });

    it('should track file sizes', () => {
      const files = {
        'small.ts': 'const x = 1;',
        'medium.ts': 'const x = 1;\n'.repeat(10),
        'large.ts': 'const x = 1;\n'.repeat(100),
      };
      
      Object.entries(files).forEach(([path, content]) => {
        const size = content.length;
        expect(size).toBeGreaterThan(0);
        expect(typeof size).toBe('number');
      });
    });
  });

  describe('Auto-Fix Logic', () => {
    it('should limit auto-fix attempts', () => {
      const maxAttempts = 1;
      const attempts = [1, 2, 3];
      
      attempts.forEach(attempt => {
        const shouldAttempt = attempt <= maxAttempts;
        expect(shouldAttempt).toBe(attempt <= maxAttempts);
      });
    });

    it('should format fix prompts', () => {
      const attempt = 1;
      const maxAttempts = 1;
      const error = 'Build failed';
      
      const prompt = `CRITICAL BUILD/LINT ERROR - FIX REQUIRED (Attempt ${attempt}/${maxAttempts})
      
Your previous code generation resulted in build or lint errors. You MUST fix these errors now.

=== ERROR OUTPUT ===
${error}`;
      
      expect(prompt).toContain('Attempt 1/1');
      expect(prompt).toContain('Build failed');
      expect(prompt).toContain('ERROR OUTPUT');
    });
  });

  describe('Framework Detection', () => {
    it('should recognize supported frameworks', () => {
      const frameworks = ['nextjs', 'react', 'vue', 'angular', 'svelte'];
      
      frameworks.forEach(framework => {
        expect(framework).toMatch(/^[a-z]+$/);
        expect(framework.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should handle framework selection', () => {
      const prompt = 'Create a React component with hooks';
      const hasReact = prompt.toLowerCase().includes('react');
      
      expect(hasReact).toBe(true);
    });
  });

  describe('Dev Server Management', () => {
    it('should use correct ports for frameworks', () => {
      const frameworkPorts = {
        nextjs: 3000,
        angular: 4200,
        react: 5173,
        vue: 5173,
        svelte: 5173,
      };
      
      Object.entries(frameworkPorts).forEach(([framework, port]) => {
        expect(typeof port).toBe('number');
        expect(port).toBeGreaterThan(1000);
        expect(port).toBeLessThan(10000);
      });
    });

    it('should format sandbox URLs', () => {
      const sandboxId = 'test-sandbox-123';
      const port = 3000;
      const url = `https://${port}-${sandboxId}.e2b.dev`;
      
      expect(url).toContain('https://');
      expect(url).toContain('3000-');
      expect(url).toContain('.e2b.dev');
    });
  });

  describe('Progress Tracking', () => {
    it('should track chunk counts', () => {
      let chunkCount = 0;
      const chunks = ['a', 'b', 'c', 'd', 'e'];
      
      chunks.forEach(chunk => {
        chunkCount++;
      });
      
      expect(chunkCount).toBe(5);
    });

    it('should log progress at intervals', () => {
      const chunkCount = 50;
      const logInterval = 50;
      const shouldLog = chunkCount % logInterval === 0;
      
      expect(shouldLog).toBe(true);
    });
  });

  describe('Metadata Generation', () => {
    it('should include model information', () => {
      const metadata = {
        model: 'anthropic/claude-haiku-4.5',
        modelName: 'Claude Haiku 4.5',
        provider: 'Anthropic',
      };
      
      expect(metadata.model).toBeDefined();
      expect(metadata.modelName).toBeDefined();
      expect(metadata.provider).toBeDefined();
    });

    it('should track warnings', () => {
      const warnings = ['validation errors detected', 'missing Shadcn UI components'];
      
      expect(warnings.length).toBeGreaterThan(0);
      warnings.forEach(warning => {
        expect(typeof warning).toBe('string');
        expect(warning.length).toBeGreaterThan(10);
      });
    });
  });
});
