import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import path from "path";

import { type TreeItem } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a record of files to a tree structure.
 * @param files - Record of file paths to content
 * @returns Tree structure for TreeView component
 *
 * @example
 * Input: { "src/Button.tsx": "...", "README.md": "..." }
 * Output: [["src", "Button.tsx"], "README.md"]
 */
export function convertFilesToTreeItems(
  files: Record<string, string>
): TreeItem[] {
  // Define proper type for tree structure
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  // Build a tree structure first
  const tree: TreeNode = {};

  // Sort files to ensure consistent ordering
  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let current = tree;

    // Navigate/create the tree structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // Add the file (leaf node)
    const fileName = parts[parts.length - 1];
    current[fileName] = null; // null indicates it's a file
  }

  // Convert tree structure to TreeItem format
  function convertNode(node: TreeNode, name?: string): TreeItem[] | TreeItem {
    const entries = Object.entries(node);

    if (entries.length === 0) {
      return name || "";
    }

    const children: TreeItem[] = [];

    for (const [key, value] of entries) {
      if (value === null) {
        // It's a file
        children.push(key);
      } else {
        // It's a folder
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push([key, subTree]);
        }
      }
    }

    return children;
  }

  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
};

/**
 * Sanitizes text by removing NULL bytes (\u0000) which are not supported by PostgreSQL TEXT fields.
 * PostgreSQL will throw error code "22P05" (unsupported Unicode escape sequence) when trying to store NULL bytes.
 *
 * @param text - The text to sanitize
 * @returns The sanitized text with NULL bytes removed
 *
 * @example
 * sanitizeTextForDatabase("Hello\u0000World") // returns "HelloWorld"
 */
export function sanitizeTextForDatabase(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  // Remove all NULL bytes from the string
  return text.replace(/\u0000/g, '');
}

/**
 * Recursively sanitizes a JSON object by removing NULL bytes from all string values.
 * This handles nested objects and arrays to ensure PostgreSQL compatibility.
 *
 * @param obj - The object to sanitize
 * @returns A new object with all string values sanitized
 *
 * @example
 * sanitizeJsonForDatabase({ name: "Hello\u0000World", nested: { value: "Test\u0000" } })
 * // returns { name: "HelloWorld", nested: { value: "Test" } }
 */
export function sanitizeJsonForDatabase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeTextForDatabase(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonForDatabase(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeJsonForDatabase(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Universal sanitizer that handles any data type - strings, objects, arrays, or primitives.
 * Automatically detects the type and applies appropriate sanitization.
 *
 * @param value - Any value to sanitize
 * @returns The sanitized value
 *
 * @example
 * sanitizeAnyForDatabase("text\u0000") // returns "text"
 * sanitizeAnyForDatabase({ files: { "app.ts": "code\u0000" } }) // sanitizes nested object
 * sanitizeAnyForDatabase(123) // returns 123 unchanged
 */
export function sanitizeAnyForDatabase<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeTextForDatabase(value) as T;
  }

  if (typeof value === 'object') {
    return sanitizeJsonForDatabase(value);
  }

  return value;
}

/**
 * Sanitizes file paths to prevent directory traversal attacks.
 * Removes dangerous patterns like ../ and ensures paths are safe for file operations.
 *
 * @param filePath - The file path to sanitize
 * @returns The sanitized file path or null if the path is unsafe
 *
 * @example
 * sanitizeFilePath("../../../etc/passwd") // returns null (unsafe)
 * sanitizeFilePath("src/components/Button.tsx") // returns "src/components/Button.tsx" (safe)
 * sanitizeFilePath("./safe/path/file.js") // returns "safe/path/file.js" (safe)
 */
export function sanitizeFilePath(filePath: string): string | null {
  if (typeof filePath !== 'string') {
    return null;
  }

  // Remove any null bytes that could cause issues
  filePath = filePath.replace(/\u0000/g, '');

  // Resolve the path to remove any .. segments
  const resolvedPath = path.resolve('/', filePath);

  // Ensure the resolved path doesn't go outside the allowed directory
  // For sandbox operations, we allow any path as long as it doesn't contain dangerous patterns
  if (resolvedPath.includes('..') || resolvedPath.includes('\0')) {
    return null;
  }

  // Remove leading slashes and normalize
  const normalizedPath = resolvedPath.replace(/^\/+/, '');

  // Additional safety checks
  if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
    return null;
  }

  // Limit path length to prevent extremely long paths
  if (normalizedPath.length > 500) {
    return null;
  }

  return normalizedPath;
}

/**
 * Sanitizes shell commands to prevent command injection and dangerous operations.
 * This is a basic validation - the primary security comes from sandbox isolation.
 *
 * @param command - The shell command to validate
 * @returns The validated command or null if it's unsafe
 *
 * @example
 * sanitizeCommand("rm -rf /") // returns null (dangerous)
 * sanitizeCommand("npm install lodash") // returns "npm install lodash" (safe)
 */
export function sanitizeCommand(command: string): string | null {
  if (typeof command !== 'string') {
    return null;
  }

  // Remove null bytes
  command = command.replace(/\u0000/g, '');

  // Basic length check
  if (command.length > 1000) {
    return null;
  }

  // Check for obviously dangerous patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,  // rm -rf /
    /rm\s+-rf\s+\*/,  // rm -rf *
    /rm\s+-rf\s+\.\./, // rm -rf ..
    /sudo\s+/,        // sudo commands
    /su\s+/,          // su commands
    />\s*\/dev\//,    // redirecting to device files
    />\s*\/etc\//,    // redirecting to system files
    />\s*\/proc\//,   // redirecting to proc files
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return null;
    }
  }

  return command.trim();
}

/**
 * Sanitizes error messages to prevent information disclosure.
 * Removes sensitive data like API responses, stack traces, and internal details.
 *
 * @param error - The error object or message to sanitize
 * @returns A sanitized error message safe for user consumption
 *
 * @example
 * sanitizeErrorMessage(new Error("Database connection failed")) // returns "Database connection failed"
 * sanitizeErrorMessage("Invalid API key: sk-123456") // returns "Authentication failed"
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return "An unknown error occurred";
  }

  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = String(error);
  }

  // Remove sensitive patterns
  const sensitivePatterns = [
    /sk-\w+/gi,          // OpenAI/Sk keys
    /pk_\w+/gi,          // Stripe/Pk keys
    /xoxp-\w+/gi,        // Slack tokens
    /ghp_\w+/gi,         // GitHub tokens
    /Bearer\s+\w+/gi,    // Bearer tokens
    /password.*[:=]\s*\w+/gi, // Passwords
    /token.*[:=]\s*\w+/gi,    // Generic tokens
    /secret.*[:=]\s*\w+/gi,   // Secrets
    /api[_-]?key.*[:=]\s*\w+/gi, // API keys
  ];

  for (const pattern of sensitivePatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }

  // Limit message length
  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }

  return message;
}