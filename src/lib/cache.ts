interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 1000 * 60 * 5;

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const maxAge = ttl ?? this.defaultTTL;

    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  async getOrCompute<T>(
    key: string,
    compute: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key, ttl);
    if (cached !== null) return cached;

    const data = await compute();
    this.set(key, data);
    return data;
  }

  size(): number {
    return this.cache.size;
  }
}

export const cache = new SimpleCache();

export function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  keyFn?: (...args: Args) => string
): (...args: Args) => Return {
  const fnCache = new Map<string, Return>();

  return (...args: Args): Return => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (fnCache.has(key)) {
      return fnCache.get(key)!;
    }

    const result = fn(...args);
    fnCache.set(key, result);
    return result;
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .slice(0, 500);
}

interface ResponseCacheEntry {
  files: Record<string, string>;
  summary: string;
  framework: string;
  timestamp: number;
}

class ResponseCache {
  private cache = new Map<string, ResponseCacheEntry>();
  private maxEntries = 100;
  private ttlMs = 1000 * 60 * 60 * 24;

  private generateKey(prompt: string, framework: string): string {
    const normalized = normalizePrompt(prompt);
    return `response:${framework}:${simpleHash(normalized)}`;
  }

  get(prompt: string, framework: string): ResponseCacheEntry | null {
    const key = this.generateKey(prompt, framework);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  set(prompt: string, framework: string, data: Omit<ResponseCacheEntry, "timestamp">): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    const key = this.generateKey(prompt, framework);
    this.cache.set(key, {
      ...data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache();
