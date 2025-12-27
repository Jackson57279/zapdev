/**
 * Environment variable validation utilities
 * Provides runtime validation and helpful error messages for missing/invalid environment variables
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EnvValidationError {
  variable: string;
  issue: string;
  setupInstructions?: string;
}

/**
 * Check if environment variable exists and is non-empty
 */
export function hasEnvVar(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim().length > 0);
}

/**
 * Get sanitized error details for logging (without exposing secrets)
 */
export function getSanitizedErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Unknown error occurred';
}
