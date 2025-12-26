/**
 * Security utilities for sanitizing sensitive information
 */

/**
 * Sanitizes error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error: unknown, context: string = 'operation'): string {
  if (error instanceof Error) {
    // Remove sensitive information from error messages
    let message = error.message;

    // Remove file paths that might contain sensitive information
    message = message.replace(/\/[^\s]+\/(\w+\.\w+)/g, '/.../$1');

    // Remove potential API keys, tokens, or credentials from error messages
    message = message.replace(/\b[A-Za-z0-9+/=]{20,}\b/g, '[REDACTED]');

    // Remove database connection strings
    message = message.replace(/postgresql:\/\/[^\s]+/g, 'postgresql://[REDACTED]');
    message = message.replace(/mongodb:\/\/[^\s]+/g, 'mongodb://[REDACTED]');

    // Remove environment variable values
    message = message.replace(/([A-Z_]+)=[^\s]+/g, '$1=[REDACTED]');

    return `${context} failed: ${message}`;
  }

  return `${context} failed with unknown error`;
}

/**
 * Safe logging function that redacts sensitive information
 */
export function safeConsoleError(message: string, error?: unknown, additionalContext?: Record<string, unknown>) {
  const sanitizedMessage = sanitizeErrorMessage(error, message);

  if (additionalContext) {
    // Remove sensitive keys from additional context
    const safeContext = { ...additionalContext };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'accessToken', 'refreshToken'];

    for (const key of sensitiveKeys) {
      if (key in safeContext) {
        safeContext[key] = '[REDACTED]';
      }
    }

    console.error(sanitizedMessage, safeContext);
  } else {
    console.error(sanitizedMessage);
  }
}

/**
 * Sanitizes database errors specifically
 */
export function sanitizeDatabaseError(error: unknown): string {
  const message = sanitizeErrorMessage(error, 'database operation');

  // Additional database-specific sanitization
  return message
    .replace(/relation "[^"]+"/g, 'relation "[REDACTED]"')
    .replace(/column "[^"]+"/g, 'column "[REDACTED]"')
    .replace(/\b\d{10,}\b/g, '[ID]'); // Replace long numeric IDs
}