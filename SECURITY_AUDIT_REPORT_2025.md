# Security Vulnerability Audit Report - ZapDev

**Audit Date:** December 27, 2025  
**Auditor:** AI Security Scanner  
**Target:** ZapDev Codebase (Next.js + Convex + E2B)

## Executive Summary

A comprehensive security audit identified 5 vulnerabilities across the ZapDev codebase, including 1 critical and 2 high-severity issues. The most critical finding involves unencrypted storage of OAuth tokens, which poses a significant risk to user data privacy and system security.

## Vulnerability Details

### 🔴 CRITICAL: OAuth Tokens Stored Unencrypted (SEC-001)

**Severity:** Critical  
**CVSS Score:** 9.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)  
**Affected Component:** OAuth token storage system  

**Description:**  
OAuth access tokens for Figma and GitHub integrations are stored in plain text in the Convex `oauthConnections` table, despite documentation claiming they are encrypted. This exposes sensitive third-party API credentials to anyone with database access.

**Evidence:**
- File: `convex/oauth.ts` - Tokens stored as plain text in `accessToken` and `refreshToken` fields
- Schema: `convex/schema.ts:130-131` - Fields defined as `v.string()` without encryption
- Documentation incorrectly states tokens are "encrypted"

**Impact:**  
- Complete compromise of integrated third-party accounts (Figma, GitHub)
- Potential data breach affecting all users with OAuth connections
- Regulatory compliance violations (GDPR, CCPA)

**Recommended Fix:**  
Implement proper encryption/decryption using AES-256-GCM with:
1. Server-side encryption before database storage
2. Secure key management (AWS KMS or similar)
3. Automatic token rotation
4. Update documentation to reflect actual implementation

---

### 🟠 HIGH: Cross-Site Scripting (XSS) in Message Display (SEC-002)

**Severity:** High  
**CVSS Score:** 7.4 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N)  
**Affected Component:** Message rendering system  

**Description:**  
User-generated message content is rendered directly in React components without HTML sanitization, creating potential XSS vulnerabilities. Messages can contain malicious JavaScript that executes in other users' browsers.

**Evidence:**
- File: `src/modules/projects/ui/components/message-card.tsx:44` - `{content}` rendered unsanitized
- No HTML sanitization applied to user input before display
- Content stored via `sanitizeTextForDatabase()` only removes NULL bytes, not HTML/script tags

**Impact:**  
- Session hijacking via injected scripts
- Defacement of user interface
- Potential account compromise through stored XSS

**Recommended Fix:**  
1. Implement HTML sanitization using `DOMPurify` or similar library
2. Create a `sanitizeHtmlForDisplay()` function
3. Apply sanitization in message display components
4. Consider implementing Content Security Policy (CSP) headers

---

### 🟠 HIGH: Missing Dependency Vulnerability Scanning (SEC-003)

**Severity:** High  
**CVSS Score:** 7.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)  
**Affected Component:** Build and deployment pipeline  

**Description:**  
No automated dependency vulnerability scanning is implemented in the CI/CD pipeline. The project uses numerous third-party packages that may contain known security vulnerabilities.

**Evidence:**
- No `npm audit` or `bun audit` in CI workflows (`.github/workflows/`)
- No dependency scanning tools like Snyk, Dependabot, or OWASP Dependency Check
- Package.json contains 100+ dependencies without regular security reviews

**Impact:**  
- Unknown vulnerable dependencies in production
- Potential remote code execution through compromised packages
- Compliance violations for security standards

**Recommended Fix:**  
1. Implement automated dependency scanning in CI/CD
2. Add Dependabot or similar automated PR creation for updates
3. Regular manual security audits of dependencies
4. Use `npm audit fix` or `bun audit fix` regularly

---

### 🟡 MEDIUM: Information Disclosure in Error Messages (SEC-004)

**Severity:** Medium  
**CVSS Score:** 5.3 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)  
**Affected Component:** Error handling system  

**Description:**  
Error messages may leak sensitive system information including file paths, database connection details, and internal system architecture through stack traces and error responses.

**Evidence:**
- Files contain `console.error` statements with full error objects
- API endpoints return detailed error messages to clients
- No error message sanitization or filtering

**Impact:**  
- Information disclosure aiding attackers in reconnaissance
- Exposure of internal system structure
- Potential for targeted attacks using revealed information

**Recommended Fix:**  
1. Implement error message sanitization middleware
2. Create user-friendly error messages for client responses
3. Log full error details server-side only
4. Implement proper error boundaries in React components

---

### 🟡 MEDIUM: Insufficient Input Validation (SEC-005)

**Severity:** Medium  
**CVSS Score:** 5.7 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L)  
**Affected Component:** API endpoints and data processing  

**Description:**  
Several API endpoints lack comprehensive input validation, potentially allowing malformed or malicious input to cause system instability or data corruption.

**Evidence:**
- Some API routes use basic type checking without comprehensive validation
- File upload endpoints may lack proper size/content validation
- URL parameters not validated for path traversal attempts

**Impact:**  
- Potential denial of service through malformed inputs
- Data corruption from invalid data structures
- System instability from resource exhaustion

**Recommended Fix:**  
1. Implement comprehensive Zod schemas for all API inputs
2. Add file upload validation (size, type, content)
3. Validate all URL parameters and query strings
4. Implement rate limiting on all public endpoints

## Security Recommendations

### Immediate Actions (Critical/High Priority)
1. **Encrypt OAuth tokens** - Implement proper encryption before next deployment
2. **Fix XSS vulnerability** - Add HTML sanitization to message display
3. **Implement dependency scanning** - Add to CI/CD pipeline immediately

### Medium-term Improvements
4. **Error message sanitization** - Implement proper error handling
5. **Input validation enhancement** - Add comprehensive validation schemas

### Long-term Security Enhancements
- Implement Content Security Policy (CSP)
- Add security headers (HSTS, X-Frame-Options, etc.)
- Regular security code reviews
- Penetration testing
- Security monitoring and alerting

## Compliance Considerations

This audit addresses requirements for:
- OWASP Top 10 (A01:2021-Broken Access Control, A03:2021-Injection)
- GDPR Article 32 (Security of processing)
- SOC 2 Type II (Security controls)

## Risk Assessment

| Risk Level | Vulnerabilities | Mitigation Priority |
|------------|----------------|-------------------|
| Critical | 1 | Immediate (within 24 hours) |
| High | 2 | Urgent (within 1 week) |
| Medium | 2 | Important (within 1 month) |

## Next Steps

1. Create Linear tickets for each vulnerability
2. Assign ownership and timelines
3. Implement fixes in order of priority
4. Schedule follow-up security audit in 3 months
5. Establish ongoing security monitoring