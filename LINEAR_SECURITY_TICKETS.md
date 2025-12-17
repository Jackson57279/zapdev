# Linear Security Vulnerability Tickets

## 🚨 Critical Vulnerabilities

### Ticket 1: CRITICAL - OAuth Access Tokens Stored in Plain Text

**Title:** [SECURITY] Critical: OAuth access tokens stored unencrypted in database

**Description:**
OAuth access tokens for GitHub and Figma integrations are currently stored in plain text in the Convex database. This is a critical security vulnerability that could allow attackers with database access to compromise all connected third-party accounts.

**Why it's a security risk:**
- Database breaches would expose all user OAuth tokens
- Tokens can be used to access connected GitHub/Figma accounts
- Violates OAuth 2.0 security best practices
- Could lead to complete account takeover scenarios

**Potential impact:**
- Unauthorized access to users' GitHub repositories
- Unauthorized access to Figma design files
- Potential for lateral movement to other connected services
- Regulatory compliance violations (GDPR, SOC 2)

**Labels:** security, vulnerability, oauth, encryption, critical

**Priority:** Urgent

**Affected files:**
- `convex/oauth.ts` (lines 31-52)
- `src/app/api/import/github/callback/route.ts` (line 92)
- `src/app/api/import/figma/callback/route.ts` (lines 87-90)

**Recommended fix:**
1. Implement AES-256-GCM encryption for OAuth tokens
2. Store encryption keys securely using AWS KMS or environment variables
3. Create encryption/decryption utilities
4. Update all OAuth token usage to decrypt tokens before API calls
5. Implement token rotation mechanism

---

## 🟠 High Vulnerabilities

### Ticket 2: HIGH - Sensitive Information Disclosure via Console Logging

**Title:** [SECURITY] High: Sensitive data logged to console output

**Description:**
Multiple locations in the codebase log sensitive information including API keys, tokens, and configuration data to console output. This information may be visible in production logs, error monitoring systems, or could be exposed through log aggregation services.

**Why it's a security risk:**
- API keys and tokens may be inadvertently logged
- Configuration data could reveal system architecture
- Potential violation of data protection regulations
- Could aid reconnaissance attacks

**Potential impact:**
- Exposure of E2B_API_KEY and AI_GATEWAY_API_KEY
- Leakage of user event data containing sensitive information
- Compliance violations under GDPR and other regulations

**Labels:** security, vulnerability, logging, information-disclosure, high

**Priority:** High

**Affected files:**
- `src/inngest/functions.ts` (lines 831-834, and multiple other locations)
- `src/lib/uploadthing.ts` (lines 19-20)
- Various API routes with console.error statements

**Recommended fix:**
1. Remove all console.log/console.error statements containing sensitive data
2. Implement structured logging with configurable log levels
3. Create environment-aware logging (verbose in development, minimal in production)
4. Add log sanitization utilities to redact sensitive information
5. Use proper logging libraries like Winston or Pino

---

## 🟡 Medium Vulnerabilities

### Ticket 3: MEDIUM - Missing Input Validation and Sanitization

**Title:** [SECURITY] Medium: Insufficient input validation for user-provided data

**Description:**
The application lacks comprehensive input validation, particularly for file operations and sandbox commands. User-provided file paths and commands are used directly without proper validation or sanitization.

**Why it's a security risk:**
- Potential for path traversal attacks in file operations
- Command injection vulnerabilities in sandbox environment
- Malformed input could cause system instability
- Could lead to unauthorized file access

**Potential impact:**
- Directory traversal allowing access to sensitive files
- Command injection in isolated sandbox environment
- System crashes or resource exhaustion
- Potential sandbox escape if validation is insufficient

**Labels:** security, vulnerability, input-validation, injection, medium

**Priority:** High

**Affected files:**
- `src/inngest/functions.ts` (file write operations, terminal commands)
- API routes handling file uploads and user input

**Recommended fix:**
1. Implement comprehensive input validation using Zod schemas
2. Sanitize file paths to prevent directory traversal (../ attacks)
3. Validate and escape shell commands before execution
4. Add length limits and content type validation
5. Implement allowlists for file extensions and command patterns

---

### Ticket 4: MEDIUM - Dependency Security Vulnerabilities

**Title:** [SECURITY] Medium: Potential vulnerabilities in third-party dependencies

**Description:**
The project dependencies may contain known security vulnerabilities. Automated dependency scanning could not be completed due to environment issues, but manual review indicates several packages that should be audited for vulnerabilities.

**Why it's a security risk:**
- Exploitation through vulnerable third-party code
- Supply chain attack vectors
- Compliance violations
- Potential for remote code execution

**Potential impact:**
- Compromise through vulnerable dependencies
- Data breaches via exploited libraries
- Regulatory non-compliance
- System-wide security compromise

**Labels:** security, vulnerability, dependencies, supply-chain, medium

**Priority:** High

**Affected files:**
- `package.json`
- `bun.lock`
- `pnpm-lock.yaml`

**Recommended fix:**
1. Run comprehensive dependency vulnerability scan (`npm audit`, `bun audit`)
2. Update all vulnerable packages to latest secure versions
3. Implement automated dependency scanning in CI/CD pipeline
4. Use tools like `npm-check-updates` for regular dependency updates
5. Consider using `npm audit fix` for automatic patching where safe
6. Implement dependency review in pull requests

---

## 🟢 Low Vulnerabilities

### Ticket 5: LOW - Error Message Information Disclosure

**Title:** [SECURITY] Low: Error messages may disclose sensitive system information

**Description:**
Error messages throughout the application may disclose internal system information, file paths, or configuration details that could aid attackers in reconnaissance or exploitation attempts.

**Why it's a security risk:**
- Information disclosure about system internals
- Potential for reconnaissance attacks
- Could reveal application architecture
- May violate security through obscurity (though not primary defense)

**Potential impact:**
- Attackers gain knowledge of system structure
- Easier reconnaissance for targeted attacks
- Potential violation of security best practices

**Labels:** security, vulnerability, error-handling, information-disclosure, low

**Priority:** Normal

**Affected files:**
- `src/app/api/import/github/callback/route.ts` (error handling)
- Various locations with console.error and throw statements

**Recommended fix:**
1. Implement generic error messages for production environments
2. Log detailed errors internally while showing user-friendly messages to clients
3. Sanitize error responses to remove sensitive data like file paths, stack traces
4. Create centralized error handling middleware
5. Implement different error verbosity levels for development vs production

---

## Implementation Notes

**Ticket Creation Priority:**
1. Address CRITICAL vulnerabilities immediately (within 24-48 hours)
2. Complete HIGH vulnerabilities within 1 week
3. Address MEDIUM vulnerabilities within 2-3 weeks
4. LOW vulnerabilities can be addressed in regular development cycles

**Assignment Recommendations:**
- CRITICAL: Assign to senior security-focused developer
- HIGH: Assign to backend/security team
- MEDIUM: Can be handled by regular development team
- LOW: Can be included in general code quality improvements

**Testing Requirements:**
- All security fixes must include unit tests
- Integration tests for authentication/authorization changes
- Penetration testing for OAuth and API changes
- Regression testing to ensure functionality is not broken

**Monitoring:**
- Implement security event logging for all fixes
- Add monitoring alerts for security-related errors
- Regular security audits moving forward