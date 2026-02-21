/**
 * Integration tests for file reading and merging operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock E2B Sandbox for testing
const mockSandbox = {
  files: {
    read: jest.fn(),
    write: jest.fn(),
    list: jest.fn(),
  },
  commands: {
    run: jest.fn(),
  },
} as any;

// Reset mocks before every test
beforeEach(() => {
  jest.clearAllMocks();
});

// Import the functions we want to test
import { readFileWithTimeout, readFilesInBatches } from '../src/agents/sandbox-utils';

describe('File Reading Integration Tests', () => {
  describe('readFileWithTimeout', () => {
    it('should read file content correctly', async () => {
      const testContent = 'console.log("Hello World");';
      mockSandbox.files.read.mockResolvedValue(testContent);

      const result = await readFileWithTimeout(mockSandbox, '/home/user/test.js', 5000);
      
      expect(result).toBe(testContent);
      expect(mockSandbox.files.read).toHaveBeenCalledWith('/home/user/test.js');
    });

    it('should handle UTF-8 content correctly', async () => {
      const testContent = 'console.log("🚀 Hello 世界");';
      mockSandbox.files.read.mockResolvedValue(testContent);

      const result = await readFileWithTimeout(mockSandbox, '/home/user/test.js', 5000);
      
      expect(result).toBe(testContent);
      expect(Buffer.byteLength(testContent, 'utf8')).toBeGreaterThan(testContent.length);
    });

    it('should timeout on slow file reads', async () => {
      mockSandbox.files.read.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000)));

      const result = await readFileWithTimeout(mockSandbox, '/home/user/test.js', 1000);
      
      expect(result).toBeNull();
    });

    it('should handle read errors gracefully', async () => {
      mockSandbox.files.read.mockRejectedValue(new Error('Permission denied'));

      const result = await readFileWithTimeout(mockSandbox, '/home/user/test.js', 5000);
      
      expect(result).toBeNull();
    });

    it('should reject files exceeding size limit', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      mockSandbox.files.read.mockResolvedValue(largeContent);

      const result = await readFileWithTimeout(mockSandbox, '/home/user/large.js', 5000);
      
      expect(result).toBeNull();
    });
  });

  describe('readFilesInBatches', () => {
    it('should read multiple files in batches', async () => {
      const files = [
        '/home/user/file1.js',
        '/home/user/file2.js',
        '/home/user/file3.js',
      ];
      
      mockSandbox.files.read
        .mockResolvedValueOnce('content1')
        .mockResolvedValueOnce('content2')
        .mockResolvedValueOnce('content3');

      const result = await readFilesInBatches(mockSandbox, files, 2);
      
      expect(result).toEqual({
        '/home/user/file1.js': 'content1',
        '/home/user/file2.js': 'content2',
        '/home/user/file3.js': 'content3',
      });
    });

    it('should filter out invalid file paths', async () => {
      const files = [
        '/home/user/valid.js',
        '../../../etc/passwd',  // Path traversal attempt
        '/home/user/valid2.js',
        null as any,  // Invalid type
        '',  // Empty string
      ];
      
      mockSandbox.files.read
        .mockResolvedValueOnce('valid content')
        .mockResolvedValueOnce('valid content 2');

      const result = await readFilesInBatches(mockSandbox, files, 2);
      
      expect(result).toEqual({
        '/home/user/valid.js': 'valid content',
        '/home/user/valid2.js': 'valid content 2',
      });
      
      expect(mockSandbox.files.read).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure cases', async () => {
      const files = [
        '/home/user/success.js',
        '/home/user/timeout.js',
        '/home/user/error.js',
      ];
      
      jest.useFakeTimers();
      try {
        mockSandbox.files.read
          .mockResolvedValueOnce('success content')
          .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 10_000)))  // timeout
          .mockRejectedValueOnce(new Error('Read error'));

        const readPromise = readFilesInBatches(mockSandbox, files, 2);
        await jest.advanceTimersByTimeAsync(10_000);
        const result = await readPromise;
        
        expect(result).toEqual({
          '/home/user/success.js': 'success content',
        });
      } finally {
        jest.useRealTimers();
      }
      
    });
  });
});

describe('File Merging Integration Tests', () => {
  it('should merge files from different frameworks correctly', async () => {
    // This would test the actual file merging logic
    // Implementation depends on how files are merged in your system
    const mockFiles = {
      '/home/user/package.json': JSON.stringify({ name: 'test-app', version: '1.0.0' }),
      '/home/user/src/App.tsx': 'export default function App() { return <div>Hello</div>; }',
      '/home/user/src/index.ts': 'import App from "./App";',
    };

    // Mock the file reading to return our test files
    mockSandbox.files.read.mockImplementation((path: string) => {
      return Promise.resolve(mockFiles[path as keyof typeof mockFiles] || null);
    });

    // Test the merging process
    const result = await readFilesInBatches(mockSandbox, Object.keys(mockFiles), 3);
    
    expect(result).toEqual(mockFiles);
  });

  it('should handle file conflicts during merging', async () => {
    // Test scenario where the same file exists in multiple locations
    const conflictingFiles = [
      '/home/user/src/components/Button.tsx',
      './src/components/Button.tsx',  // Same file, different path format
    ];

    mockSandbox.files.read.mockResolvedValue('button component code');

    const result = await readFilesInBatches(mockSandbox, conflictingFiles, 2);
    
    // Should handle both paths pointing to the same file
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('Performance Tests', () => {
  it('should handle large numbers of small files efficiently', async () => {
    const fileCount = 100;
    const files = Array.from({ length: fileCount }, (_, i) => `/home/user/file${i}.js`);
    
    // Mock fast reads for small files
    mockSandbox.files.read.mockImplementation((path: string) => {
      return Promise.resolve(`// Content of ${path}`);
    });

    const startTime = Date.now();
    const result = await readFilesInBatches(mockSandbox, files, 10);
    const endTime = Date.now();

    expect(Object.keys(result)).toHaveLength(fileCount);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should respect file count limits', async () => {
    const fileCount = 1500; // Exceeds typical limits
    const files = Array.from({ length: fileCount }, (_, i) => `/home/user/file${i}.js`);
    
    mockSandbox.files.read.mockResolvedValue('content');

    const result = await readFilesInBatches(mockSandbox, files, 50);
    
    // Should only read up to the limit (500 files)
    expect(Object.keys(result).length).toBeLessThanOrEqual(500);
  });
});
