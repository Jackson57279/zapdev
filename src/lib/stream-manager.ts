type StreamCallback = (event: StreamEvent) => void;

interface StreamEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

interface StreamSession {
  id: string;
  callbacks: Set<StreamCallback>;
  createdAt: number;
}

class StreamManager {
  private sessions = new Map<string, StreamSession>();
  private sessionTimeoutMs = 1000 * 60 * 30;

  createSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) return;
    
    this.sessions.set(sessionId, {
      id: sessionId,
      callbacks: new Set(),
      createdAt: Date.now(),
    });
    
    this.scheduleCleanup(sessionId);
  }

  private scheduleCleanup(sessionId: string): void {
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, this.sessionTimeoutMs);
  }

  subscribe(sessionId: string, callback: StreamCallback): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.createSession(sessionId);
      return this.subscribe(sessionId, callback);
    }
    
    session.callbacks.add(callback);
    
    return () => {
      session.callbacks.delete(callback);
    };
  }

  emit(sessionId: string, event: Omit<StreamEvent, "timestamp">): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const fullEvent: StreamEvent = {
      ...event,
      timestamp: Date.now(),
    };
    
    for (const callback of session.callbacks) {
      try {
        callback(fullEvent);
      } catch (error) {
        console.error("[StreamManager] Callback error:", error);
      }
    }
  }

  hasSubscribers(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.callbacks.size > 0 : false;
  }

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const streamManager = new StreamManager();

export async function* createStreamIterator(sessionId: string): AsyncGenerator<StreamEvent> {
  const queue: StreamEvent[] = [];
  let resolve: ((event: StreamEvent | null) => void) | null = null;
  let done = false;

  const unsubscribe = streamManager.subscribe(sessionId, (event) => {
    if (event.type === "complete" || event.type === "error") {
      done = true;
    }
    
    if (resolve) {
      resolve(event);
      resolve = null;
    } else {
      queue.push(event);
    }
  });

  try {
    while (!done) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        const event = await new Promise<StreamEvent | null>((r) => {
          resolve = r;
          setTimeout(() => r(null), 30000);
        });
        
        if (event) {
          yield event;
        }
      }
    }
    
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  } finally {
    unsubscribe();
  }
}
