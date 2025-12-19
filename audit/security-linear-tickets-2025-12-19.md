# Security Vulnerability Linear Tickets - December 19, 2025

## Critical Priority Tickets (Urgent)

### Ticket 1: Next.js RCE Vulnerability
**Title:** CRITICAL: Next.js Remote Code Execution Vulnerability in React Flight Protocol

**Description:**
Next.js versions <15.3.6 are vulnerable to remote code execution through the React flight protocol. This is a critical security issue that allows attackers to execute arbitrary code on the server.

**Why it's a security risk:** Remote code execution allows complete server compromise, data theft, and lateral movement within the infrastructure.

**Potential impact:** Complete system compromise, data breach, service disruption.

**Priority:** Urgent

**Labels:** security, vulnerability, critical, nextjs, rce

**Affected files:**
- package.json (Next.js dependency)
- All Next.js application files

**Recommended fix:**
```bash
bun update next@^15.4.7
```
Test thoroughly in staging environment before production deployment.

---

### Ticket 2: OAuth Token Plain Text Storage
**Title:** HIGH: OAuth Access Tokens Stored in Plain Text Without Encryption

**Description:**
OAuth access tokens and refresh tokens are stored unencrypted in the Convex database. This violates security best practices and exposes sensitive authentication credentials if the database is compromised.

**Why it's a security risk:** If the database is breached, all stored OAuth tokens become immediately usable by attackers, allowing unauthorized access to connected third-party services (Figma, GitHub).

**Potential impact:** Unauthorized access to user-connected services, data breaches in integrated platforms, potential for lateral attacks.

**Priority:** Urgent

**Labels:** security, vulnerability, oauth, encryption, data-protection

**Affected files:**
- convex/oauth.ts (lines 32-34)
- convex/schema.ts (oauthConnections table)

**Recommended fix:**
Implement proper encryption for OAuth tokens:
1. Add encryption utility functions
2. Encrypt tokens before storage in database
3. Decrypt tokens when retrieving for API calls
4. Use environment-based encryption keys
5. Implement key rotation strategy

---

### Ticket 3: Next.js Denial of Service Vulnerability
**Title:** CRITICAL: Next.js Denial of Service in Server Components

**Description:**
Next.js versions <15.3.7 are vulnerable to denial of service attacks through Server Components. Attackers can cause resource exhaustion leading to service unavailability.

**Why it's a security risk:** DoS attacks can render the application completely unavailable to legitimate users.

**Potential impact:** Service disruption, loss of availability, impact on business operations.

**Priority:** Urgent

**Labels:** security, vulnerability, critical, nextjs, dos

**Affected files:**
- package.json (Next.js dependency)

**Recommended fix:**
```bash
bun update next@^15.4.7
```

---

## High Priority Tickets

### Ticket 4: glob Package Command Injection
**Title:** HIGH: Command Injection Vulnerability in glob Package

**Description:**
The glob package versions <11.1.0 are vulnerable to command injection when using the CLI with shell:true option. This could allow arbitrary command execution.

**Why it's a security risk:** Command injection allows attackers to execute arbitrary system commands, potentially leading to full system compromise.

**Potential impact:** Arbitrary code execution, system compromise, data manipulation.

**Priority:** High

**Labels:** security, vulnerability, command-injection, dependencies

**Affected files:**
- package.json (glob dependency)

**Recommended fix:**
```bash
bun update glob@^11.1.0
```

---

### Ticket 5: tRPC Prototype Pollution
**Title:** HIGH: Prototype Pollution in tRPC Server

**Description:**
@tRPC/server versions <11.8.0 are vulnerable to prototype pollution in the experimental_nextAppDirCaller. This allows attackers to modify object prototypes.

**Why it's a security risk:** Prototype pollution can lead to unexpected behavior, data corruption, and potential code execution vulnerabilities.

**Potential impact:** Application instability, potential for further exploits, data integrity issues.

**Priority:** High

**Labels:** security, vulnerability, prototype-pollution, trpc

**Affected files:**
- package.json (@trpc/server dependency)

**Recommended fix:**
```bash
bun update @trpc/server@^11.8.0
```

---

### Ticket 6: MCP SDK DNS Rebinding Protection
**Title:** HIGH: Missing DNS Rebinding Protection in MCP SDK

**Description:**
@modelcontextprotocol/sdk versions <1.24.0 do not enable DNS rebinding protection by default, leaving the application vulnerable to DNS rebinding attacks.

**Why it's a security risk:** DNS rebinding allows attackers to bypass same-origin policy and access internal services.

**Potential impact:** Unauthorized access to internal network resources, potential data exfiltration.

**Priority:** High

**Labels:** security, vulnerability, dns-rebinding, mcp

**Affected files:**
- package.json (@modelcontextprotocol/sdk dependency)

**Recommended fix:**
```bash
bun update @modelcontextprotocol/sdk@^1.24.0
```
Ensure DNS rebinding protection is explicitly enabled in MCP server configuration.

---

## Moderate Priority Tickets

### Ticket 7: Next.js Image Optimization Cache Key Confusion
**Title:** MODERATE: Cache Key Confusion in Next.js Image Optimization

**Description:**
Next.js versions <=15.4.4 are vulnerable to cache key confusion in image optimization API routes, potentially allowing cache poisoning attacks.

**Why it's a security risk:** Cache poisoning can serve malicious content to users or cause performance issues.

**Potential impact:** Content manipulation, cache inefficiency, potential for XSS if combined with other vulnerabilities.

**Priority:** High

**Labels:** security, vulnerability, nextjs, cache-poisoning

**Affected files:**
- package.json (Next.js dependency)

**Recommended fix:**
```bash
bun update next@^15.4.7
```

---

### Ticket 8: Next.js Image Optimization Content Injection
**Title:** MODERATE: Content Injection Vulnerability in Next.js Image Optimization

**Description:**
Next.js versions <=15.4.4 are vulnerable to content injection in image optimization, allowing attackers to inject malicious content.

**Why it's a security risk:** Content injection can lead to XSS attacks or other content-based exploits.

**Potential impact:** Cross-site scripting, content manipulation, user data exposure.

**Priority:** High

**Labels:** security, vulnerability, nextjs, content-injection

**Affected files:**
- package.json (Next.js dependency)

**Recommended fix:**
```bash
bun update next@^15.4.7
```

---

### Ticket 9: Next.js SSRF in Middleware Redirects
**Title:** MODERATE: Server-Side Request Forgery in Next.js Middleware

**Description:**
Next.js versions <15.4.7 have improper middleware redirect handling that can lead to SSRF vulnerabilities.

**Why it's a security risk:** SSRF allows attackers to make requests to internal services or external resources from the server.

**Potential impact:** Unauthorized access to internal services, data exfiltration, reconnaissance.

**Priority:** High

**Labels:** security, vulnerability, nextjs, ssrf

**Affected files:**
- package.json (Next.js dependency)

**Recommended fix:**
```bash
bun update next@^15.4.7
```

---

### Ticket 10: Sentry PII Data Leakage
**Title:** MODERATE: Sensitive Header Leakage in Sentry

**Description:**
Sentry packages <10.27.0 leak sensitive headers when sendDefaultPii is set to true, potentially exposing personal identifiable information.

**Why it's a security risk:** PII leakage violates privacy regulations and can lead to identity theft or privacy breaches.

**Potential impact:** Personal data exposure, regulatory non-compliance, privacy violations.

**Priority:** Normal

**Labels:** security, vulnerability, pii, sentry, privacy

**Affected files:**
- package.json (@sentry/* dependencies)

**Recommended fix:**
```bash
bun update @sentry/nextjs@^10.27.0
bun update @sentry/node@^10.27.0
```
Ensure sendDefaultPii is not enabled in production Sentry configuration.

---

### Ticket 11: node-tar Memory Exposure
**Title:** MODERATE: Uninitialized Memory Exposure in node-tar

**Description:**
node-tar version 7.5.1 has a race condition leading to uninitialized memory exposure during archive extraction.

**Why it's a security risk:** Memory exposure can leak sensitive data from previous memory allocations.

**Potential impact:** Information disclosure, potential for data leakage.

**Priority:** Normal

**Labels:** security, vulnerability, memory-exposure, tar

**Affected files:**
- package.json (tar dependency - transitive)

**Recommended fix:**
```bash
bun update tar@^7.5.2
```

---

### Ticket 12: js-yaml Prototype Pollution
**Title:** MODERATE: Prototype Pollution in js-yaml

**Description:**
js-yaml versions >=4.0.0 <4.1.1 are vulnerable to prototype pollution in merge operations.

**Why it's a security risk:** Prototype pollution can lead to unexpected object behavior and potential security exploits.

**Potential impact:** Application instability, potential for further exploits.

**Priority:** Normal

**Labels:** security, vulnerability, prototype-pollution, yaml

**Affected files:**
- package.json (js-yaml dependency - transitive)

**Recommended fix:**
```bash
bun update js-yaml@^4.1.1
```

---

### Ticket 13: body-parser DoS Vulnerability
**Title:** MODERATE: Denial of Service in body-parser

**Description:**
body-parser versions >=2.2.0 <2.2.1 are vulnerable to DoS when URL encoding is used in request bodies.

**Why it's a security risk:** DoS attacks can exhaust server resources, making the application unavailable.

**Potential impact:** Service disruption, resource exhaustion.

**Priority:** Normal

**Labels:** security, vulnerability, dos, body-parser

**Affected files:**
- package.json (body-parser dependency - transitive)

**Recommended fix:**
```bash
bun update body-parser@^2.2.1
```

---

### Ticket 14: Next.js Server Actions Source Code Exposure
**Title:** MODERATE: Server Actions Source Code Exposure in Next.js

**Description:**
Next.js versions <15.3.7 expose server action source code, potentially revealing sensitive implementation details.

**Why it's a security risk:** Source code exposure can reveal security implementation details and potential vulnerabilities.

**Potential impact:** Information disclosure, easier exploitation of other vulnerabilities.

**Priority:** Normal

**Labels:** security, vulnerability, nextjs, information-disclosure

**Affected files:**
- package.json (Next.js dependency)

**Recommended fix:**
```bash
bun update next@^15.4.7
```

---

## Ticket Creation Summary

**Total Tickets Created:** 14
- **Critical (Urgent):** 3 tickets
- **High:** 3 tickets
- **Moderate/Normal:** 8 tickets

**Immediate Actions Required:**
1. Upgrade Next.js to >=15.4.7 (addresses 5 vulnerabilities)
2. Implement OAuth token encryption
3. Update all listed vulnerable dependencies

**Next Steps:**
- Assign tickets to appropriate team members
- Set up automated dependency vulnerability scanning
- Establish regular security audit schedule
- Implement security review process for code changes