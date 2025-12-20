# Linear Tickets for Security Vulnerabilities

## Ticket 1: CRITICAL - OAuth Tokens Stored in Plain Text

**Title:** CRITICAL - OAuth Token Encryption Vulnerability - Access tokens stored unencrypted

**Description:**
```
## Vulnerability Details
- **Severity:** Critical
- **Priority:** Urgent
- **Files:** convex/oauth.ts (lines 11, 33, 42), convex/schema.ts (lines 127-139)
- **Description:** OAuth access tokens and refresh tokens for Figma and GitHub integrations are stored in plain text in the Convex database without encryption. This violates OAuth security best practices and poses a severe security risk.
- **Impact:** Complete compromise of user OAuth integrations, potential unauthorized access to sensitive design files and source code repositories.

## Code Evidence
```typescript
// convex/oauth.ts - Line 11
accessToken: v.string(), // No encryption applied

// convex/schema.ts - Line 130
accessToken: v.string(), // Encrypted token (COMMENT ONLY - not implemented)
```

## Remediation Steps
1. Implement AES-256-GCM encryption for OAuth tokens
2. Create encryption/decryption utilities in convex/helpers.ts
3. Update oauth.ts to encrypt tokens before storage
4. Migrate existing tokens to encrypted format
5. Test token retrieval and usage functionality

## Test Plan
- Verify tokens are properly encrypted in database
- Confirm OAuth integrations still work after encryption
- Test token refresh functionality
```

**Labels:** security, vulnerability, oauth, encryption, critical

---

## Ticket 2: HIGH - Information Disclosure in Error Messages

**Title:** HIGH - Error Message Sanitization - Potential information disclosure through client-side errors

**Description:**
```
## Vulnerability Details
- **Severity:** High
- **Priority:** Urgent
- **Files:** src/modules/home/ui/components/project-form.tsx (lines 93-97), src/modules/sandbox/server/procedures.ts (lines 47-49)
- **Description:** Error messages displayed to users may expose sensitive internal information about the application's state, database structure, or authentication details.
- **Impact:** Information disclosure that could aid attackers in targeting the application.

## Code Evidence
```typescript
// Current error handling exposes raw error messages
} catch (error) {
  toast.error(error.message); // Direct error message exposure
}
```

## Remediation Steps
1. Create error sanitization utility function
2. Map technical errors to user-friendly messages
3. Implement server-side error logging with detailed information
4. Update all error handling to use sanitized messages

## Test Plan
- Verify no sensitive information in error messages
- Confirm proper error logging server-side
- Test various error scenarios
```

**Labels:** security, vulnerability, error-handling, information-disclosure, high

---

## Ticket 3: MEDIUM - Missing HTTPS Enforcement

**Title:** MEDIUM - HTTPS Security Configuration - Missing HTTPS enforcement in production

**Description:**
```
## Vulnerability Details
- **Severity:** Medium
- **Priority:** High
- **Files:** next.config.mjs
- **Description:** Next.js configuration does not explicitly enforce HTTPS, potentially allowing HTTP connections in production environments.
- **Impact:** Potential for man-in-the-middle attacks and insecure data transmission.

## Remediation Steps
1. Add HTTPS enforcement configuration to next.config.mjs
2. Implement HSTS (HTTP Strict Transport Security) headers
3. Configure secure cookie settings
4. Test HTTPS redirection in staging environment

## Test Plan
- Verify HTTP requests redirect to HTTPS
- Confirm HSTS headers are set
- Test cookie security settings
```

**Labels:** security, vulnerability, https, configuration, medium

---

## Ticket 4: MEDIUM - Dependency Security Review

**Title:** MEDIUM - Dependency Vulnerability Assessment - Automated security scanning required

**Description:**
```
## Vulnerability Details
- **Severity:** Medium
- **Priority:** High
- **Files:** package.json, all dependencies
- **Description:** No automated dependency vulnerability scanning implemented. Manual review required for all dependencies, especially external integrations like E2B code interpreter.
- **Impact:** Potential supply chain attacks and unknown vulnerabilities in dependencies.

## Remediation Steps
1. Implement automated dependency scanning (npm audit, Snyk, or Dependabot)
2. Set up security alerts for vulnerable dependencies
3. Create process for regular dependency updates
4. Review and update high-risk dependencies

## Test Plan
- Run security scan on all dependencies
- Verify no critical vulnerabilities present
- Test application after dependency updates
```

**Labels:** security, vulnerability, dependencies, supply-chain, medium

---

## Ticket 5: LOW - Content Security Policy Missing

**Title:** LOW - Content Security Policy Implementation - Missing CSP headers for XSS protection

**Description:**
```
## Vulnerability Details
- **Severity:** Low
- **Priority:** Normal
- **Files:** next.config.mjs
- **Description:** No Content Security Policy headers configured to help prevent XSS attacks.
- **Impact:** Reduced protection against cross-site scripting attacks.

## Remediation Steps
1. Research and define appropriate CSP directives for the application
2. Implement CSP headers in next.config.mjs
3. Test CSP in development environment
4. Monitor for CSP violation reports

## Test Plan
- Verify CSP headers are set correctly
- Test application functionality with CSP enabled
- Monitor for false positives in CSP reports
```

**Labels:** security, vulnerability, csp, xss-protection, low

---

## Ticket 6: LOW - Error Handling Standardization

**Title:** LOW - Error Handling Consistency - Inconsistent error handling patterns across codebase

**Description:**
```
## Vulnerability Details
- **Severity:** Low
- **Priority:** Normal
- **Files:** Various files throughout codebase
- **Description:** Inconsistent error handling patterns that may lead to information disclosure or poor user experience.
- **Impact:** Minor information disclosure and inconsistent error responses.

## Remediation Steps
1. Audit current error handling patterns
2. Create standardized error handling utilities
3. Implement global error boundary for React components
4. Update error handling across the application

## Test Plan
- Verify consistent error messages
- Test error scenarios across different components
- Confirm proper error logging
```

**Labels:** security, vulnerability, error-handling, consistency, low