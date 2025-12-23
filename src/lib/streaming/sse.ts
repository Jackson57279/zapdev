/**
 * Server-Sent Events (SSE) Streaming Utilities
 * 
 * Provides utilities for creating SSE streams in Next.js API routes.
 * Based on open-lovable's streaming-first architecture.
 */

export type StreamEventType = 
  | 'start'
  | 'step'
  | 'status'
  | 'stream'
  | 'component'
  | 'file-progress'
  | 'file-complete'
  | 'file-error'
  | 'package'
  | 'package-progress'
  | 'conversation'
  | 'command-progress'
  | 'command-output'
  | 'command-complete'
  | 'command-error'
  | 'warning'
  | 'info'
  | 'error'
  | 'complete';

export interface StreamEvent {
  type: StreamEventType;
  message?: string;
  text?: string;
  raw?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface StatusEvent extends StreamEvent {
  type: 'status';
  message: string;
}

export interface StreamTextEvent extends StreamEvent {
  type: 'stream';
  text: string;
  raw?: boolean;
}

export interface ComponentEvent extends StreamEvent {
  type: 'component';
  name: string;
  path: string;
  index: number;
}

export interface FileProgressEvent extends StreamEvent {
  type: 'file-progress';
  current: number;
  total: number;
  fileName: string;
  action: 'creating' | 'updating' | 'morph-applying';
}

export interface FileCompleteEvent extends StreamEvent {
  type: 'file-complete';
  fileName: string;
  action: 'created' | 'updated' | 'morph-updated';
}

export interface PackageEvent extends StreamEvent {
  type: 'package';
  name: string;
  message: string;
}

export interface ErrorEvent extends StreamEvent {
  type: 'error';
  error: string;
}

export interface CompleteEvent extends StreamEvent {
  type: 'complete';
  generatedCode?: string;
  explanation?: string;
  files?: number;
  components?: number;
  model?: string;
  packagesToInstall?: string[];
  warnings?: string[];
  results?: {
    filesCreated: string[];
    filesUpdated: string[];
    packagesInstalled: string[];
    commandsExecuted: string[];
    errors: string[];
  };
}

/**
 * Creates an SSE stream writer for real-time progress updates.
 * 
 * @example
 * ```typescript
 * const { stream, sendProgress, close } = createSSEStream();
 * 
 * // In background task
 * await sendProgress({ type: 'status', message: 'Processing...' });
 * await sendProgress({ type: 'stream', text: 'Generated code', raw: true });
 * await sendProgress({ type: 'complete', files: 3 });
 * await close();
 * 
 * // Return response
 * return new Response(stream, { headers: getSSEHeaders() });
 * ```
 */
export function createSSEStream() {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  /**
   * Send a progress event to the stream.
   * Automatically formats as SSE data event.
   */
  const sendProgress = async (data: StreamEvent): Promise<void> => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    try {
      await writer.write(encoder.encode(message));
      // Force flush by writing a keep-alive comment for certain event types
      if (data.type === 'stream' || data.type === 'conversation') {
        await writer.write(encoder.encode(': keepalive\n\n'));
      }
    } catch (error) {
      console.error('[SSE] Error writing to stream:', error);
    }
  };

  /**
   * Send a keep-alive comment to prevent connection timeout.
   */
  const sendKeepAlive = async (): Promise<void> => {
    try {
      await writer.write(encoder.encode(': keepalive\n\n'));
    } catch (error) {
      console.error('[SSE] Error sending keep-alive:', error);
    }
  };

  /**
   * Close the stream. Must be called when processing is complete.
   */
  const close = async (): Promise<void> => {
    try {
      await writer.close();
    } catch (error) {
      console.error('[SSE] Error closing stream:', error);
    }
  };

  return {
    stream: stream.readable,
    sendProgress,
    sendKeepAlive,
    close,
    writer,
  };
}

/**
 * Returns the standard headers required for SSE responses.
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Transfer-Encoding': 'chunked',
    'Content-Encoding': 'none', // Prevent compression that can break streaming
    'X-Accel-Buffering': 'no', // Disable nginx buffering
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Creates an SSE Response with proper headers and the provided stream.
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: getSSEHeaders(),
  });
}

/**
 * Helper to wrap async processing in SSE stream handling.
 * Automatically handles errors and stream closure.
 * 
 * @example
 * ```typescript
 * return withSSEStream(async (sendProgress, close) => {
 *   await sendProgress({ type: 'status', message: 'Starting...' });
 *   // ... processing ...
 *   await sendProgress({ type: 'complete', files: 3 });
 * });
 * ```
 */
export function withSSEStream(
  handler: (
    sendProgress: (data: StreamEvent) => Promise<void>,
    close: () => Promise<void>,
    sendKeepAlive: () => Promise<void>
  ) => Promise<void>
): Response {
  const { stream, sendProgress, close, sendKeepAlive } = createSSEStream();

  // Start processing in background
  (async () => {
    try {
      await handler(sendProgress, close, sendKeepAlive);
    } catch (error) {
      console.error('[SSE] Stream processing error:', error);
      await sendProgress({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await close();
    }
  })();

  return createSSEResponse(stream);
}

/**
 * Parse SSE data from a chunk of text.
 * Useful for consuming SSE streams on the client side.
 */
export function parseSSEChunk(chunk: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        events.push(data as StreamEvent);
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return events;
}

/**
 * Create an async iterator for consuming SSE streams.
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/generate');
 * for await (const event of consumeSSEStream(response)) {
 *   console.log(event.type, event);
 * }
 * ```
 */
export async function* consumeSSEStream(
  response: Response
): AsyncGenerator<StreamEvent, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data as StreamEvent;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        yield data as StreamEvent;
      } catch {
        // Skip invalid JSON
      }
    }
  } finally {
    reader.releaseLock();
  }
}
