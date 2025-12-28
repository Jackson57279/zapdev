# Linear Tickets - Security Audit Vulnerabilities

## Ticket 1: CRITICAL - OAuth Tokens Stored Unencrypted

**Title:** [CRITICAL] Fix OAuth tokens stored unencrypted in database - SEC-001

**Description:**
```
## OAuth Tokens Stored Unencrypted

### Security Risk
OAuth access tokens for Figma and GitHub integrations are stored in plain text in the Convex `oauthConnections` table, despite documentation claiming they are encrypted. This exposes sensitive third-party API credentials to anyone with database access.

### Why This Is Critical
- Complete compromise of integrated third-party accounts (Figma, GitHub)
- Potential data breach affecting all users with OAuth connections
- Regulatory compliance violations (GDPR, CCPA)

### Affected Files
- convex/oauth.ts (lines 31, 33, 42, 43, 46, 47)
- convex/schema.ts (lines 130-131)

### Recommended Fix
1. Implement proper encryption/decryption using AES-256-GCM
2. Use server-side encryption before database storage
3. Implement secure key management (AWS KMS or similar)
4. Add automatic token rotation
5. Update documentation to reflect actual implementation
```

**Priority:** Urgent
**Labels:** security, vulnerability, oauth, encryption, critical
**Affected Files:**
- convex/oauth.ts
- convex/schema.ts

---

## Ticket 2: HIGH - Cross-Site Scripting in Message Display

**Title:** [HIGH] Fix XSS vulnerability in message display - sanitize user content - SEC-002

**Description:**
```
## Cross-Site Scripting (XSS) in Message Display

### Security Risk
User-generated message content is rendered directly in React components without HTML sanitization, creating potential XSS vulnerabilities. Messages can contain malicious JavaScript that executes in other users' browsers.

### Why This Is Dangerous
- Session hijacking via injected scripts
- Defacement of user interface
- Potential account compromise through stored XSS

### Affected Files
- src/modules/projects/ui/components/message-card.tsx (line 44)
- src/lib/utils.ts (sanitizeTextForDatabase function only removes NULL bytes)

### Recommended Fix
1. Implement HTML sanitization using DOMPurify library
2. Create a sanitizeHtmlForDisplay() function
3. Apply sanitization in message display components
4. Consider implementing Content Security Policy (CSP) headers
```

**Priority:** High
**Labels:** security, vulnerability, xss, frontend, sanitization
**Affected Files:**
- src/modules/projects/ui/components/message-card.tsx
- src/lib/utils.ts

---

## Ticket 3: HIGH - Missing Dependency Vulnerability Scanning

**Title:** [HIGH] Implement automated dependency vulnerability scanning in CI/CD - SEC-003

**Description:**
```
## Missing Dependency Vulnerability Scanning

### Security Risk
No automated dependency vulnerability scanning is implemented in the CI/CD pipeline. The project uses numerous third-party packages that may contain known security vulnerabilities.

### Why This Is Dangerous
- Unknown vulnerable dependencies in production
- Potential remote code execution through compromised packages
- Compliance violations for security standards

### Affected Files
- .github/workflows/* (CI/CD configuration)
- package.json (100+ dependencies)

### Recommended Fix
1. Implement automated dependency scanning in CI/CD pipeline
2. Add Dependabot or similar automated PR creation for updates
3. Regular manual security audits of dependencies
4. Use `npm audit fix` or `bun audit fix` regularly
5. Consider using Snyk or OWASP Dependency Check
```

**Priority:** High
**Labels:** security, vulnerability, dependencies, ci-cd, scanning
**Affected Files:**
- .github/workflows/
- package.json

---

## Ticket 4: MEDIUM - Information Disclosure in Error Messages

**Title:** [MEDIUM] Review and fix information disclosure in error messages - SEC-004

**Description:**
```
## Information Disclosure in Error Messages

### Security Risk
Error messages may leak sensitive system information including file paths, database connection details, and internal system architecture through stack traces and error responses.

### Why This Is Concerning
- Information disclosure aiding attackers in reconnaissance
- Exposure of internal system structure
- Potential for targeted attacks using revealed information

### Affected Files
- Multiple files with console.error statements
- API endpoints returning detailed error messages
- React components with error boundaries

### Recommended Fix
1. Implement error message sanitization middleware
2. Create user-friendly error messages for client responses
3. Log full error details server-side only
4. Implement proper error boundaries in React components
5. Add error monitoring with Sentry (already configured)
```

**Priority:** High
**Labels:** security, vulnerability, error-handling, information-disclosure
**Affected Files:**
- src/app/api/*/route.ts
- src/lib/auth-server.ts
- src/components/error-boundary.tsx

---

## Ticket 5: MEDIUM - Insufficient Input Validation

**Title:** [MEDIUM] Add comprehensive input validation for all API endpoints - SEC-005

**Description:**
```
## Insufficient Input Validation

### Security Risk
Several API endpoints lack comprehensive input validation, potentially allowing malformed or malicious input to cause system instability or data corruption.

### Why This Matters
- Potential denial of service through malformed inputs
- Data corruption from invalid data structures
- System instability from resource exhaustion

### Affected Files
- src/app/api/messages/update/route.ts
- src/app/api/projects/*/route.ts
- File upload endpoints

### Recommended Fix
1. Implement comprehensive Zod schemas for all API inputs
2. Add file upload validation (size, type, content)
3. Validate all URL parameters and query strings
4. Implement rate limiting on all public endpoints
5. Add input sanitization middleware
```

**Priority:** High
**Labels:** security, vulnerability, input-validation, api, sanitization
**Affected Files:**
- src/app/api/messages/update/route.ts
- src/app/api/projects/
- src/lib/uploadthing.ts