# Security Vulnerability Audit Report - ZapDev
**Date:** December 22, 2025  
**Auditor:** AI Security Scanner  
**Repository:** ZapDev (AI-powered development platform)

## Executive Summary

A comprehensive security audit identified 6 vulnerabilities across the ZapDev codebase, ranging from Critical to Low severity. The most critical issues involve improper storage of OAuth tokens and missing authorization controls.

## Vulnerabilities Found

### 🔴 CRITICAL-1: OAuth Tokens Stored in Plain Text
**Severity:** Critical  
**CVSS Score:** 9.1 (Critical)  
**Affected Files:**
- `convex/oauth.ts` (lines 85-96)
- `src/app/api/import/figma/callback/route.ts` (lines 85-96)
- `src/app/api/import/github/callback/route.ts` (lines 90-101)

**Description:**  
OAuth access tokens and refresh tokens for Figma and GitHub integrations are stored in plain text in the Convex database. The schema documentation claims tokens are "encrypted" but no encryption is implemented.

**Security Risk:**  
If the database is compromised, attackers gain unauthorized access to users' Figma and GitHub accounts, potentially leading to data theft, code repository compromise, or design asset theft.

**Recommended Fix:**  
Implement proper encryption for OAuth tokens using a strong encryption algorithm (AES-256-GCM) with a securely managed encryption key stored in environment variables.

**Linear Ticket:**
```
Title: CRITICAL: Implement OAuth Token Encryption
Description: OAuth access and refresh tokens are currently stored in plain text in the database, creating a severe security vulnerability. If the database is breached, all user OAuth connections (Figma, GitHub) would be compromised.

Security Risk: Complete account takeover of integrated third-party services.

Affected Files:
- convex/oauth.ts lines 85-96
- src/app/api/import/figma/callback/route.ts lines 85-96
- src/app/api/import/github/callback/route.ts lines 90-101

Priority: Urgent
Labels: security, vulnerability, oauth, encryption, critical
```

---

### 🔴 HIGH-1: Missing Admin Authorization Check
**Severity:** High  
**CVSS Score:** 8.2 (High)  
**Affected Files:**
- `convex/usage.ts` (line 128)

**Description:**  
The `resetUsage` mutation contains a TODO comment "// In production, add admin authorization check here" but no authorization check is implemented, allowing any authenticated user to reset anyone's usage credits.

**Security Risk:**  
Users can abuse this to bypass credit limits, potentially leading to excessive resource consumption or billing bypass.

**Recommended Fix:**  
Implement proper admin authorization check before allowing usage resets.

**Linear Ticket:**
```
Title: HIGH: Add Admin Authorization to resetUsage Function
Description: The resetUsage mutation allows any authenticated user to reset any other user's credits due to missing authorization checks. This could be abused to bypass credit limits.

Security Risk: Credit system bypass, potential billing fraud.

Affected Files:
- convex/usage.ts line 128

Priority: Urgent
Labels: security, vulnerability, authorization, credits, high
```

---

### 🟡 MEDIUM-1: Hardcoded Security Bypass Conditions
**Severity:** Medium  
**CVSS Score:** 6.5 (Medium)  
**Affected Files:**
- `src/app/api/import/figma/callback/route.ts` (line 21)
- `src/app/api/import/github/callback/route.ts` (line 21)

**Description:**  
Both OAuth callback routes contain `if (false)` conditions that redirect users away from the OAuth flow. While currently disabled, these could accidentally be changed to `if (true)`, creating security bypasses.

**Security Risk:**  
Potential OAuth flow bypass if accidentally enabled, allowing unauthorized access.

**Recommended Fix:**  
Remove the hardcoded conditions entirely.

**Linear Ticket:**
```
Title: MEDIUM: Remove Hardcoded if(false) Conditions in OAuth Callbacks
Description: OAuth callback routes contain hardcoded if(false) conditions that could be accidentally changed to bypass authentication flows.

Security Risk: Potential authentication bypass if conditions are modified.

Affected Files:
- src/app/api/import/figma/callback/route.ts line 21
- src/app/api/import/github/callback/route.ts line 21

Priority: High
Labels: security, vulnerability, oauth, authentication, medium
```

---

### 🟡 MEDIUM-2: Insufficient Input Validation in Database Schema
**Severity:** Medium  
**CVSS Score:** 5.3 (Medium)  
**Affected Files:**
- `convex/schema.ts` (lines 91, 104, 120, 134)

**Description:**  
Multiple database tables use `v.any()` for field validation, allowing arbitrary data types without proper validation. This could lead to injection attacks or data corruption.

**Security Risk:**  
Potential data injection or malformed data storage.

**Recommended Fix:**  
Replace `v.any()` with proper type validation using Zod schemas or Convex validators.

**Linear Ticket:**
```
Title: MEDIUM: Replace v.any() with Proper Type Validation
Description: Database schema uses v.any() in multiple places, allowing arbitrary data without validation. This could lead to data injection vulnerabilities.

Security Risk: Potential data injection, schema corruption.

Affected Files:
- convex/schema.ts lines 91, 104, 120, 134

Priority: High
Labels: security, vulnerability, validation, schema, medium
```

---

### 🟢 LOW-1: Unused Potentially Malicious Dependency
**Severity:** Low  
**CVSS Score:** 3.1 (Low)  
**Affected Files:**
- `package.json` (line 64)

**Description:**  
The "claude" package (version 0.1.2) is listed in dependencies but not used anywhere in the codebase. This could be a typo, test dependency, or potentially malicious package.

**Security Risk:**  
Unused dependencies increase attack surface and could contain vulnerabilities.

**Recommended Fix:**  
Remove the unused dependency or verify its legitimacy and necessity.

**Linear Ticket:**
```
Title: LOW: Remove Unused 'claude' Dependency
Description: The 'claude' package is listed in dependencies but not imported or used anywhere in the codebase. This increases the attack surface unnecessarily.

Security Risk: Potential vulnerability in unused dependency.

Affected Files:
- package.json line 64

Priority: Normal
Labels: security, vulnerability, dependencies, cleanup, low
```

---

### 🟢 LOW-2: Error Information Exposure in OAuth Callbacks
**Severity:** Low  
**CVSS Score:** 3.5 (Low)  
**Affected Files:**
- `src/app/api/import/figma/callback/route.ts` (line 109)
- `src/app/api/import/github/callback/route.ts` (line 114)

**Description:**  
OAuth callback error handling exposes error messages in redirect URLs, potentially leaking sensitive information about the OAuth flow or internal errors.

**Security Risk:**  
Information disclosure about system internals.

**Recommended Fix:**  
Sanitize error messages and avoid exposing internal error details in user-facing redirects.

**Linear Ticket:**
```
Title: LOW: Sanitize OAuth Error Messages
Description: OAuth callback routes expose potentially sensitive error information in redirect URLs, which could leak internal system details.

Security Risk: Information disclosure about system internals.

Affected Files:
- src/app/api/import/figma/callback/route.ts line 109
- src/app/api/import/github/callback/route.ts line 114

Priority: Normal
Labels: security, vulnerability, error-handling, information-disclosure, low
```

## Security Assessment Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 1 | OAuth token encryption |
| High | 1 | Admin authorization bypass |
| Medium | 2 | Input validation issues |
| Low | 2 | Dependency and error handling |
| Total | 6 | Vulnerabilities identified |

## Recommendations

1. **Immediate Action Required:**
   - Implement OAuth token encryption (Critical)
   - Add admin authorization to resetUsage (High)

2. **Short-term (1-2 weeks):**
   - Remove hardcoded conditions (Medium)
   - Improve schema validation (Medium)

3. **Long-term:**
   - Clean up unused dependencies (Low)
   - Improve error handling (Low)

4. **General Security Improvements:**
   - Implement security headers (CSP, HSTS, etc.)
   - Regular dependency vulnerability scanning
   - Security-focused code reviews for authentication flows

## Compliance Notes

- **OWASP Top 10:** Addresses A02:2021 (Cryptographic Failures), A01:2021 (Broken Access Control)
- **Data Protection:** OAuth token encryption critical for user data protection
- **Access Control:** Admin functions require proper authorization

This audit should be reviewed and addressed according to your security policies and compliance requirements.