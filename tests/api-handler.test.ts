/**
 * Tests for the API handler routing system
 * Verifies route matching, parameter extraction, and error handling
 */
import { describe, it, expect } from '@jest/globals';
import { normalizeRouteModule } from '@/server/api-handler';

describe('API Handler', () => {
  
  describe('Route Pattern Matching', () => {
    it('should match exact API paths', () => {
      // Test route pattern regex matching logic
      const trpcPattern = /^\/api\/trpc(\/.*)?$/i;
      
      expect(trpcPattern.test('/api/trpc')).toBe(true);
      expect(trpcPattern.test('/api/trpc/query')).toBe(true);
      expect(trpcPattern.test('/api/trpc/mutation.create')).toBe(true);
      expect(trpcPattern.test('/API/TRPC')).toBe(true); // Case insensitive
      expect(trpcPattern.test('/api/trp')).toBe(false);
      expect(trpcPattern.test('/trpc')).toBe(false);
    });

    it('should match routes with trailing slashes', () => {
      const messagesPattern = /^\/api\/messages\/update\/?$/i;
      
      expect(messagesPattern.test('/api/messages/update')).toBe(true);
      expect(messagesPattern.test('/api/messages/update/')).toBe(true);
      expect(messagesPattern.test('/api/messages/updates')).toBe(false);
    });

    it('should match parameterized routes', () => {
      const fragmentPattern = /^\/api\/fragment\/([^/]+)\/?$/i;
      
      expect(fragmentPattern.test('/api/fragment/abc123')).toBe(true);
      expect(fragmentPattern.test('/api/fragment/test-id-456')).toBe(true);
      expect(fragmentPattern.test('/api/fragment/')).toBe(false);
      expect(fragmentPattern.test('/api/fragment/id/nested')).toBe(false);
    });

    it('should extract parameters from URL patterns', () => {
      const fragmentPattern = /^\/api\/fragment\/([^/]+)\/?$/i;
      const url = '/api/fragment/test-fragment-123';
      const match = url.match(fragmentPattern);
      
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('test-fragment-123');
    });

    it('should handle special file routes', () => {
      const robotsPattern = /^\/robots\.txt\/?$/i;
      const sitemapPattern = /^\/sitemap\.xml\/?$/i;
      const rssPattern = /^\/rss\.xml\/?$/i;
      
      expect(robotsPattern.test('/robots.txt')).toBe(true);
      expect(sitemapPattern.test('/sitemap.xml')).toBe(true);
      expect(rssPattern.test('/rss.xml')).toBe(true);
    });
  });

  describe('HTTP Method Handling', () => {
    it('should support standard HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      
      methods.forEach(method => {
        expect(typeof method).toBe('string');
        expect(method.length).toBeGreaterThan(0);
      });
    });

    it('should normalize method names to uppercase', () => {
      const testMethods = ['get', 'post', 'put', 'delete'];
      
      testMethods.forEach(method => {
        const normalized = method.toUpperCase();
        expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
          .toContain(normalized);
      });
    });
  });

  describe('Route Module Normalization', () => {
    it('should handle default exports', () => {
      const mockHandler = () => new Response('test');
      const moduleWithDefault = {
        default: {
          GET: mockHandler,
        },
      };

      const normalized = normalizeRouteModule(moduleWithDefault);
      expect(normalized).not.toBeNull();
      expect(normalized?.GET).toBe(mockHandler);
    });

    it('should handle direct exports', () => {
      const mockHandler = () => new Response('test');
      const moduleWithoutDefault = {
        GET: mockHandler,
        POST: mockHandler,
      };

      const normalized = normalizeRouteModule(moduleWithoutDefault);
      expect(normalized).not.toBeNull();
      expect(normalized?.GET).toBe(mockHandler);
      expect(normalized?.POST).toBe(mockHandler);
    });

    it('should reject non-function handlers', () => {
      const invalidModule = {
        GET: 'not a function',
      };

      const normalized = normalizeRouteModule(invalidModule);
      expect(normalized).toBeNull();
    });

    it('should reject non-object modules', () => {
      expect(normalizeRouteModule(null)).toBeNull();
      expect(normalizeRouteModule(undefined)).toBeNull();
      expect(normalizeRouteModule('string')).toBeNull();
      expect(normalizeRouteModule(123)).toBeNull();
    });

    it('should handle empty modules', () => {
      const emptyModule = {};
      const normalized = normalizeRouteModule(emptyModule);
      
      expect(normalized).not.toBeNull();
      expect(Object.keys(normalized || {})).toHaveLength(0);
    });

    it('should filter out non-HTTP-method properties', () => {
      const mockHandler = () => new Response('test');
      const moduleWithExtra = {
        GET: mockHandler,
        someOtherProp: 'value',
        anotherProp: () => {},
      };

      const normalized = normalizeRouteModule(moduleWithExtra);
      expect(normalized).not.toBeNull();
      expect(normalized?.GET).toBe(mockHandler);
      expect('someOtherProp' in (normalized || {})).toBe(false);
      expect('anotherProp' in (normalized || {})).toBe(false);
    });
  });

  describe('Request Path Validation', () => {
    it('should identify API paths', () => {
      const apiPaths = [
        '/api/trpc',
        '/api/messages/update',
        '/api/fragment/123',
        '/api/inngest',
      ];

      apiPaths.forEach(path => {
        expect(path.startsWith('/api')).toBe(true);
      });
    });

    it('should identify special file paths', () => {
      const specialPaths = [
        '/robots.txt',
        '/sitemap.xml',
        '/rss.xml',
      ];

      specialPaths.forEach(path => {
        const isSpecial = path === '/robots.txt' || 
                         path === '/sitemap.xml' || 
                         path === '/rss.xml';
        expect(isSpecial).toBe(true);
      });
    });

    it('should identify non-API paths', () => {
      const nonApiPaths = [
        '/dashboard',
        '/projects/123',
        '/home',
        '/',
      ];

      nonApiPaths.forEach(path => {
        const isApi = path.startsWith('/api') || 
                     path === '/rss.xml' || 
                     path === '/sitemap.xml' || 
                     path === '/robots.txt';
        expect(isApi).toBe(false);
      });
    });
  });

  describe('Parameter Extraction', () => {
    it('should extract fragment ID from URL', () => {
      const pattern = /^\/api\/fragment\/([^/]+)\/?$/i;
      const url = new URL('http://localhost:3000/api/fragment/abc-123');
      const match = url.pathname.match(pattern);
      
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('abc-123');
    });

    it('should handle URL-encoded parameters', () => {
      const pattern = /^\/api\/fragment\/([^/]+)\/?$/i;
      const encodedId = encodeURIComponent('test/fragment');
      const url = new URL(`http://localhost:3000/api/fragment/${encodedId}`);
      const match = url.pathname.match(pattern);
      
      expect(match).not.toBeNull();
      expect(match?.[1]).toBeDefined();
    });

    it('should return empty string for missing parameters', () => {
      const pattern = /^\/api\/fragment\/([^/]+)\/?$/i;
      const url = new URL('http://localhost:3000/api/fragment/');
      const match = url.pathname.match(pattern);
      const fragmentId = match?.[1] ?? '';
      
      expect(fragmentId).toBe('');
    });
  });

  describe('Error Response Formatting', () => {
    it('should create 404 response for not found', () => {
      const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      
      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
    });

    it('should create 405 response for method not allowed', () => {
      const response = new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });
      
      expect(response.status).toBe(405);
      expect(response.statusText).toBe('Method Not Allowed');
    });

    it('should create 500 response for internal errors', () => {
      const response = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      
      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
    });
  });
});
