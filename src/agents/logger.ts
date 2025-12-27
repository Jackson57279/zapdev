import * as Sentry from '@sentry/nextjs';

export class AgentLogger {
  private taskId: string;
  private startTime: number;

  constructor(taskId: string, extra?: Record<string, unknown>) {
    this.taskId = taskId;
    this.startTime = Date.now();

    Sentry.setTag('task_id', taskId);
    if (extra) {
      Sentry.setContext('task', extra);
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log({
      taskId: this.taskId,
      message,
      ...(data && { data }),
    });

    Sentry.addBreadcrumb({
      category: 'agent',
      message,
      level: 'info',
      data: { ...data, taskId: this.taskId },
    });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    const logMessage = `[${this.taskId}] WARN: ${message}`;
    const fullMessage = data
      ? `${logMessage} ${JSON.stringify(data)}`
      : logMessage;
    console.warn(fullMessage);

    Sentry.addBreadcrumb({
      category: 'agent',
      message,
      level: 'warning',
      data: { ...data, taskId: this.taskId },
    });
  }

  error(error: Error | string, context?: Record<string, unknown>): void {
    const err = typeof error === 'string' ? new Error(error) : error;
    console.error({
      taskId: this.taskId,
      error: err.message || err.toString(),
      errorStack: err instanceof Error ? err.stack : undefined,
      ...(context && { context }),
    });

    Sentry.captureException(err, {
      extra: { ...context, taskId: this.taskId },
      tags: { task_id: this.taskId },
    });
  }

  progress(stage: string, message: string): void {
    this.info(`[${stage}] ${message}`);
  }

  complete(result?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;
    this.info('Task completed', { duration, ...result });

    Sentry.setMeasurement('task_duration', duration, 'millisecond');
  }

  async startSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return Sentry.startSpan({ name, op: 'agent' }, fn);
  }
}

export function createLogger(taskId: string, extra?: Record<string, unknown>): AgentLogger {
  return new AgentLogger(taskId, extra);
}
