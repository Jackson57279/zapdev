/**
 * Security tests for path traversal prevention
 */

import { describe, it, expect } from '@jest/globals';
import { isValidFilePath } from '../src/agents/sandbox-utils';

describe('Security Tests - Path Traversal Prevention', () => {
  describe('isValidFilePath', () => {
    it('should allow valid file paths', () => {
      const validPaths = [
        '/home/user/app.js',
        '/home/user/src/components/Button.tsx',
        './src/index.ts',
        '/home/user/package.json',
        './README.md',
        '/home/user/.env',
      ];

      validPaths.forEach(path => {
        expect(isValidFilePath(path)).toBe(true);
      });
    });

    it('should block basic path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/home/user/../../../etc/passwd',
        './src/../../../etc/passwd',
        '/home/user/src/../../../root/.ssh/id_rsa',
      ];

      maliciousPaths.forEach(path => {
        expect(isValidFilePath(path)).toBe(false);
      });
    });

    it('should block null byte injection attempts', () => {
      const nullBytePaths = [
        '/home/user/file.txt\0.exe',
        './src/app.js\0malicious',
        '/home/user/config\0.json',
        'file\0path.txt',
      ];

      nullBytePaths.forEach(path => {
        expect(isValidFilePath(path)).toBe(false);
      });
    });

    it('should block paths with newline or carriage returns', () => {
      const controlCharPaths = [
        '/home/user/file\n.txt',
        './src/app\r.js',
        'file\r\npath.txt',
      ];

      controlCharPaths.forEach(path => {
        expect(isValidFilePath(path)).toBe(false);
      });
    });

    it('should block empty and extremely long paths', () => {
      expect(isValidFilePath('')).toBe(false);
      expect(isValidFilePath('   ')).toBe(false);
      
      // Create a path longer than 4096 characters
      const longPath = '/home/user/' + 'a'.repeat(5000);
      expect(isValidFilePath(longPath)).toBe(false);
    });

    it('should block non-string inputs', () => {
      const invalidInputs = [
        null,
        undefined,
        123,
        {},
        [],
        true,
        Symbol('test'),
      ];

      invalidInputs.forEach(input => {
        expect(isValidFilePath(input as any)).toBe(false);
      });
    });

    it('should handle edge cases correctly', () => {
      expect(isValidFilePath('/')).toBe(false);
      expect(isValidFilePath('/home')).toBe(false);
      expect(isValidFilePath('/home/')).toBe(false);
      expect(isValidFilePath('.')).toBe(true);
      expect(isValidFilePath('./')).toBe(true);
      expect(isValidFilePath('/home/user/./file.js')).toBe(true);
      expect(isValidFilePath('/home/user/../file.js')).toBe(false);
    });
  });
});
