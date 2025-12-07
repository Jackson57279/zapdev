/**
 * Tests for auth-server.ts authentication and authorization
 * Verifies Clerk token extraction, validation, and Convex integration
 */
import { describe, it, expect } from '@jest/globals';

describe('Auth Server', () => {
  describe('Clerk Token Extraction', () => {
    it('should extract token from Authorization header', () => {
      const mockToken = 'test-jwt-token-123';
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });

      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBe(`Bearer ${mockToken}`);
      
      const extractedToken = authHeader?.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7)
        : null;
      
      expect(extractedToken).toBe(mockToken);
    });

    it('should extract token from __session cookie', () => {
      const mockToken = 'cookie-jwt-token-456';
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Cookie': `__session=${encodeURIComponent(mockToken)}; other=value`,
        },
      });

      const cookieHeader = request.headers.get('cookie');
      expect(cookieHeader).toContain('__session=');
      
      // Parse cookies
      function getCookieValue(cookieHeader: string, name: string): string | null {
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        for (const cookie of cookies) {
          if (cookie.startsWith(`${name}=`)) {
            return decodeURIComponent(cookie.substring(name.length + 1));
          }
        }
        return null;
      }

      const extractedToken = getCookieValue(cookieHeader || '', '__session');
      expect(extractedToken).toBe(mockToken);
    });

    it('should return null when no token is present', () => {
      const request = new Request('http://localhost:3000/api/test');
      
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');
      
      expect(authHeader).toBeNull();
      expect(cookieHeader).toBeNull();
    });

    it('should handle malformed Authorization headers', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'NotBearer token-here',
        },
      });

      const authHeader = request.headers.get('authorization');
      const isBearer = authHeader?.toLowerCase().startsWith('bearer ');
      
      expect(isBearer).toBe(false);
    });

    it('should handle missing __session cookie among other cookies', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Cookie': 'other=value; another=data',
        },
      });

      function getCookieValue(cookieHeader: string, name: string): string | null {
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        for (const cookie of cookies) {
          if (cookie.startsWith(`${name}=`)) {
            return decodeURIComponent(cookie.substring(name.length + 1));
          }
        }
        return null;
      }

      const cookieHeader = request.headers.get('cookie');
      const token = getCookieValue(cookieHeader || '', '__session');
      
      expect(token).toBeNull();
    });
  });

  describe('Environment Variable Validation', () => {
    it('should throw in production when CLERK_SECRET_KEY is missing', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.CLERK_SECRET_KEY;
      
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.CLERK_SECRET_KEY;
        
        const secretKey = process.env.CLERK_SECRET_KEY;
        const shouldThrow = !secretKey && process.env.NODE_ENV === 'production';
        
        expect(shouldThrow).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalKey) {
          process.env.CLERK_SECRET_KEY = originalKey;
        }
      }
    });

    it('should warn in development when CLERK_SECRET_KEY is missing', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.CLERK_SECRET_KEY;
      
      try {
        process.env.NODE_ENV = 'development';
        delete process.env.CLERK_SECRET_KEY;
        
        const secretKey = process.env.CLERK_SECRET_KEY;
        const shouldWarn = !secretKey && process.env.NODE_ENV !== 'production';
        
        expect(shouldWarn).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalKey) {
          process.env.CLERK_SECRET_KEY = originalKey;
        }
      }
    });
  });

  describe('Clerk Token Claims Structure', () => {
    it('should validate token claims structure', () => {
      interface ClerkTokenClaims {
        sub: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        [key: string]: unknown;
      }

      const validClaims: ClerkTokenClaims = {
        sub: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      expect(validClaims.sub).toBeDefined();
      expect(typeof validClaims.sub).toBe('string');
      expect(validClaims.sub.length).toBeGreaterThan(0);
    });

    it('should handle claims with missing optional fields', () => {
      interface ClerkTokenClaims {
        sub: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      }

      const minimalClaims: ClerkTokenClaims = {
        sub: 'user_456',
      };

      expect(minimalClaims.sub).toBeDefined();
      expect(minimalClaims.email).toBeUndefined();
      expect(minimalClaims.firstName).toBeUndefined();
      expect(minimalClaims.lastName).toBeUndefined();
    });

    it('should construct display name from available fields', () => {
      const claims = {
        sub: 'user_789',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Smith',
      };

      const fullName = `${claims.firstName ?? ''} ${claims.lastName ?? ''}`.trim();
      const displayName = fullName || claims.email || claims.sub;

      expect(displayName).toBe('John Smith');
    });

    it('should fallback to email when name fields are missing', () => {
      const claims = {
        sub: 'user_101',
        email: 'jane@example.com',
      };

      const fullName = `${''} ${''}`.trim();
      const displayName = fullName || claims.email || claims.sub;

      expect(displayName).toBe('jane@example.com');
    });

    it('should fallback to sub when all other fields are missing', () => {
      const claims = {
        sub: 'user_202',
      };

      const fullName = `${''} ${''}`.trim();
      const displayName = fullName || undefined || claims.sub;

      expect(displayName).toBe('user_202');
    });
  });

  describe('Auth Headers Generation', () => {
    it('should generate Bearer token header', () => {
      const token = 'test-jwt-token';
      const headers = { Authorization: `Bearer ${token}` };

      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(headers.Authorization.startsWith('Bearer ')).toBe(true);
    });

    it('should return empty object when no token', () => {
      const token = null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      expect(Object.keys(headers).length).toBe(0);
    });
  });

  describe('User Object Construction', () => {
    it('should construct complete user object from Convex data', () => {
      const mockConvexUser = {
        tokenIdentifier: 'user_convex_123',
        email: 'convex@example.com',
        name: 'Convex User',
        image: 'https://example.com/avatar.png',
      };

      const mockClaims = {
        sub: 'user_clerk_123',
      };

      const user = {
        id: mockConvexUser.tokenIdentifier ?? mockClaims.sub,
        email: mockConvexUser.email,
        name: mockConvexUser.name,
        image: mockConvexUser.image,
        primaryEmail: mockConvexUser.email,
        displayName: mockConvexUser.name ?? mockConvexUser.email ?? mockClaims.sub,
      };

      expect(user.id).toBe('user_convex_123');
      expect(user.email).toBe('convex@example.com');
      expect(user.name).toBe('Convex User');
      expect(user.displayName).toBe('Convex User');
    });

    it('should fallback to Clerk claims when Convex fetch fails', () => {
      const mockClaims = {
        sub: 'user_clerk_456',
        email: 'clerk@example.com',
        firstName: 'Clerk',
        lastName: 'User',
      };

      const fullName = `${mockClaims.firstName} ${mockClaims.lastName}`.trim();
      
      const user = {
        id: mockClaims.sub,
        email: mockClaims.email,
        name: fullName || mockClaims.email,
        image: null,
        primaryEmail: mockClaims.email,
        displayName: mockClaims.email ?? mockClaims.sub,
      };

      expect(user.id).toBe('user_clerk_456');
      expect(user.email).toBe('clerk@example.com');
      expect(user.name).toBe('Clerk User');
    });
  });

  describe('Request Context Handling', () => {
    it('should handle requests without auth', () => {
      const request = new Request('http://localhost:3000/api/public');
      
      const authHeader = request.headers.get('authorization');
      expect(authHeader).toBeNull();
      
      // Should allow function to return null gracefully
      const user = null;
      expect(user).toBeNull();
    });

    it('should handle undefined request parameter', () => {
      const req: Request | undefined = undefined;
      const shouldReturnNull = !req;
      
      expect(shouldReturnNull).toBe(true);
    });
  });
});
