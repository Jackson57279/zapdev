# Export to Polaris Feature - Work Plan

## TL;DR

> **Quick Summary**: Enable users to export projects from ZapDev (no-code platform) to Polaris (AI IDE) via API integration. Creates a seamless graduation path from beginner to advanced users.
> 
> **Deliverables**: 
> - ZapDev export UI components and API client
> - Polaris import API endpoint with data validation
> - Database schema updates for import tracking
> - Cross-app authentication system
> - Error handling and rollback mechanisms
> 
> **Estimated Effort**: Medium (5-7 tasks)
> **Parallel Execution**: YES - ZapDev and Polaris work can happen in parallel
> **Critical Path**: Polaris API → ZapDev Integration → E2E Testing

---

## Context

### Original Request
User wants to add an "Export to Polaris" feature that allows users to transfer projects from ZapDev (no-code AI platform) to Polaris (AI IDE for experienced developers).

### Interview Summary
**Key Discussions**:
- **Architecture**: ZapDev and Polaris are completely separate apps/deployments
- **User Experience**: Click "Export" → see progress → auto-redirect to Polaris when ready
- **Data Scope**: Transfer everything - files, full conversation history, attachments, project settings
- **Strategy**: One-way fork (independent copy, ZapDev project remains)

### Technical Design Decisions
1. **API-Based Integration**: ZapDev calls Polaris REST API to import projects
2. **Security**: API key + HMAC signature validation between apps
3. **Data Transfer**: JSON payload with all project data
4. **User Mapping**: Email-based user linking or account creation
5. **Error Handling**: Comprehensive validation with rollback on failure

---

## Work Objectives

### Core Objective
Create a secure, reliable API integration that transfers complete projects from ZapDev to Polaris with one-click UX.

### Concrete Deliverables
1. **Polaris Backend**: Import API endpoint (`POST /api/import/zapdev`)
2. **Polaris Schema**: Database fields for import tracking (`source`, `sourceId`, `importedAt`)
3. **ZapDev UI**: Export button, progress modal, success/error states
4. **ZapDev API**: Export service that calls Polaris API
5. **Security Layer**: API authentication and request validation
6. **Testing**: End-to-end test coverage for export flow

### Definition of Done
- [ ] User can click "Export to Polaris" in ZapDev
- [ ] Project with all messages/files appears in Polaris
- [ ] User is automatically redirected to Polaris project
- [ ] Failed exports show clear error messages with retry option
- [ ] Large projects (100+ files) export successfully
- [ ] Security validation prevents unauthorized imports

### Must Have
- Complete data transfer (files, messages, attachments)
- Secure API authentication
- Progress indication during export
- Error handling with user-friendly messages
- Rollback on partial failure

### Must NOT Have (Guardrails)
- ❌ Bidirectional sync (one-way only)
- ❌ Real-time sync between apps
- ❌ Automatic user account creation without consent
- ❌ Export without explicit user action
- ❌ Transfer of sensitive auth tokens

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks must be verifiable WITHOUT any human action. Verification is executed by agents using tools.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright configured)
- **Automated tests**: YES (tests after implementation)
- **Framework**: Vitest for unit tests, Playwright for E2E

### Agent-Executed QA Scenarios

**Scenario 1: Successful Export Flow**
```
Tool: Playwright
Preconditions: ZapDev and Polaris running, test project exists
Steps:
  1. Navigate to ZapDev project dashboard
  2. Click "Export to Polaris" button on test project
  3. Wait for progress modal to appear
  4. Wait for "Export Complete" state (timeout: 30s)
  5. Assert redirect URL contains Polaris domain
  6. Wait for Polaris project page to load
  7. Assert project name matches original
  8. Assert file explorer shows expected files
  9. Assert messages panel shows conversation history
  10. Screenshot: .sisyphus/evidence/export-success.png
Expected Result: Project fully transferred and accessible in Polaris
```

**Scenario 2: Export with Large Project**
```
Tool: Playwright + API
Preconditions: Project with 50+ files and 20+ messages
Steps:
  1. Create large test project via API
  2. Initiate export to Polaris
  3. Wait for completion (timeout: 60s)
  4. Verify all files transferred (count match)
  5. Verify all messages transferred (count match)
  6. Check no timeout errors occurred
Expected Result: Large projects export successfully without timeouts
```

**Scenario 3: Export Failure Handling**
```
Tool: API + Playwright
Preconditions: Polaris API configured to fail (mock error)
Steps:
  1. Attempt export with failing Polaris endpoint
  2. Wait for error state (timeout: 10s)
  3. Assert error message visible to user
  4. Assert "Retry" button available
  5. Assert original ZapDev project unchanged
  6. Screenshot: .sisyphus/evidence/export-error.png
Expected Result: Clear error shown, no data corruption, retry possible
```

**Scenario 4: Security - Invalid API Key**
```
Tool: Bash (curl)
Preconditions: Polaris API running
Steps:
  1. POST to /api/import/zapdev with invalid API key
  2. Assert HTTP 401 response
  3. Assert error message: "Invalid authentication"
  4. Verify no project created in database
Expected Result: Unauthorized requests rejected, no data created
```

**Scenario 5: Data Integrity Validation**
```
Tool: Bash (curl + jq)
Preconditions: Valid export request
Steps:
  1. Export project with known file content
  2. Fetch created project via Polaris API
  3. Compare file checksums (MD5 hashes)
  4. Verify message content matches exactly
  5. Verify attachment URLs accessible
Expected Result: 100% data integrity, no corruption during transfer
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Independent):
├── Task 1: Polaris Database Schema Updates
└── Task 2: Polaris Import API Endpoint

Wave 2 (After Wave 1):
├── Task 3: ZapDev Export Service & API Client
└── Task 4: Security Layer (API Auth + Validation)

Wave 3 (After Wave 2):
├── Task 5: ZapDev UI Components
└── Task 6: Error Handling & Rollback

Wave 4 (Final):
└── Task 7: E2E Testing & Integration

Critical Path: Task 2 → Task 3 → Task 5 → Task 7
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (Schema) | None | 2 | None |
| 2 (API) | 1 | 3, 4 | None |
| 3 (Export Service) | 2 | 5, 6 | 4 |
| 4 (Security) | 2 | 3, 5, 6 | 3 |
| 5 (UI) | 3, 4 | 7 | 6 |
| 6 (Error Handling) | 3, 4 | 7 | 5 |
| 7 (Testing) | 5, 6 | None | None |

---

## TODOs

### Task 1: Polaris Database Schema Updates

**What to do**:
- Add `source` field to projects table (enum: 'zapdev', 'github', 'direct')
- Add `sourceId` field (string) to track original project ID
- Add `importedAt` timestamp field
- Add `importMetadata` optional object field for extra info
- Create Convex migration

**Must NOT do**:
- ❌ Modify existing GitHub import functionality
- ❌ Add breaking changes to projects schema
- ❌ Remove any existing indexes

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: None required (database schema work)

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: Task 2
- **Blocked By**: None

**References**:
- `convex/schema.ts:114-124` - Projects table definition
- `convex/schema.ts:41-44` - importSourceEnum pattern
- `convex/githubExports.ts:238-254` - Export tracking table example

**Acceptance Criteria**:
- [ ] Migration creates new fields without errors
- [ ] Existing projects still work (backward compatible)
- [ ] New fields have proper validators
- [ ] Convex dev server starts without schema errors

**Agent-Executed QA Scenario**:
```
Scenario: Schema migration applies successfully
  Tool: Bash (convex CLI)
  Steps:
    1. Run: bun run convex:dev
    2. Wait: "Waiting for schema..." message
    3. Assert: No schema validation errors
    4. Query: SELECT * FROM projects LIMIT 1
    5. Assert: New fields exist (source, sourceId, importedAt)
  Expected Result: Schema updated, backward compatible
```

**Commit**: YES
- Message: `feat(schema): add import tracking fields to projects table`
- Files: `convex/schema.ts`

---

### Task 2: Polaris Import API Endpoint

**What to do**:
- Create `POST /api/import/zapdev` API route
- Validate incoming payload (Zod schema)
- Create project in database with source='zapdev'
- Recreate messages with proper ordering
- Recreate fragments with files
- Handle attachments (download from URLs if needed)
- Return new project ID and URL

**Must NOT do**:
- ❌ Skip validation of incoming data
- ❌ Create partial/incomplete projects on error
- ❌ Expose internal error details to API response

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: ['better-auth-best-practices'] (for API security patterns)

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 1
- **Blocks**: Tasks 3, 4
- **Blocked By**: Task 1

**References**:
- `src/app/api/projects/[projectId]/export/github/route.ts:83-124` - Export API pattern
- `convex/projects.ts:11-30` - Project creation mutation
- `convex/messages.ts` - Message creation patterns
- `convex/githubExports.ts:214-394` - Complex data processing example

**Acceptance Criteria**:
- [ ] API accepts valid import payload
- [ ] Creates project with all data (files, messages, attachments)
- [ ] Returns 201 with project URL
- [ ] Returns 400 for invalid payload
- [ ] Returns 401 for missing/invalid auth
- [ ] Atomic operation (all or nothing)

**Agent-Executed QA Scenarios**:
```
Scenario: Import API creates complete project
  Tool: Bash (curl)
  Steps:
    1. POST /api/import/zapdev with valid payload
    2. Assert: HTTP 201 status
    3. Parse response for projectId
    4. Query Convex: SELECT * FROM projects WHERE _id = projectId
    5. Assert: project.source === 'zapdev'
    6. Query messages: count matches payload
    7. Query fragments: files match payload
  Expected Result: Complete project created with all data
  
Scenario: Import API rejects invalid payload
  Tool: Bash (curl)
  Steps:
    1. POST /api/import/zapdev with missing required fields
    2. Assert: HTTP 400 status
    3. Assert: Error message in response
    4. Query: No new projects created
  Expected Result: Validation errors, no partial data
```

**Commit**: YES
- Message: `feat(api): add zapdev import endpoint with full project creation`
- Files: `src/app/api/import/zapdev/route.ts`, `convex/importFromZapdev.ts`

---

### Task 3: ZapDev Export Service & API Client

**What to do**:
- Create export service module in ZapDev
- Fetch complete project data from Convex (project, messages, fragments, attachments)
- Format data for Polaris API
- Call Polaris import API
- Handle response and return project URL
- Add environment variables for Polaris API URL and key

**Must NOT do**:
- ❌ Hardcode Polaris API credentials
- ❌ Send unnecessary data (user tokens, internal IDs)
- ❌ Block UI during entire export

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: ['better-auth-best-practices']

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Tasks 5, 6
- **Blocked By**: Task 2

**References**:
- `convex/githubExports.ts:214-394` - Similar data processing logic
- `src/lib/github-api.ts` - External API client pattern
- `convex/projects.ts:177-227` - List projects with related data

**Acceptance Criteria**:
- [ ] Service fetches complete project data
- [ ] Formats data correctly for Polaris API
- [ ] Handles Polaris API responses
- [ ] Returns project URL on success
- [ ] Throws descriptive errors on failure
- [ ] Uses environment variables for config

**Agent-Executed QA Scenario**:
```
Scenario: Export service successfully transfers data
  Tool: Bash (bun test)
  Steps:
    1. Create test project in ZapDev
    2. Call exportToPolaris(projectId)
    3. Assert: Returns polarisProjectUrl
    4. Fetch Polaris project via API
    5. Assert: Data matches original
  Expected Result: Service correctly transfers all data
```

**Commit**: YES
- Message: `feat(zapdev): add export service to call polaris import api`
- Files: `src/services/polaris-export.ts`, `.env.example`

---

### Task 4: Security Layer (API Auth + Validation)

**What to do**:
- Implement API key authentication between apps
- Add HMAC signature validation for requests
- Create API key management (rotation, revocation)
- Add rate limiting per API key
- Validate request timestamps (prevent replay attacks)
- Log all import attempts

**Must NOT do**:
- ❌ Store API keys in code repositories
- ❌ Accept requests without authentication
- ❌ Return sensitive data in error messages

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: ['better-auth-best-practices', 'git-master']

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Tasks 3, 5, 6
- **Blocked By**: Task 2

**References**:
- `src/app/api/projects/[projectId]/export/github/route.ts` - API route pattern
- `convex/helpers.ts` - Auth helper patterns
- `convex/rateLimit.ts` - Rate limiting example

**Acceptance Criteria**:
- [ ] Requests without valid auth rejected (401)
- [ ] HMAC signature validated correctly
- [ ] Rate limiting enforced (max 10 imports/minute per key)
- [ ] Old timestamps rejected (replay protection)
- [ ] All requests logged with metadata

**Agent-Executed QA Scenarios**:
```
Scenario: Reject unauthenticated requests
  Tool: Bash (curl)
  Steps:
    1. POST /api/import/zapdev without auth header
    2. Assert: HTTP 401
    3. Assert: Error: "Authentication required"
  Expected Result: Unauthorized access blocked

Scenario: Reject invalid API key
  Tool: Bash (curl)
  Steps:
    1. POST with wrong API key
    2. Assert: HTTP 401
    3. Assert: Error: "Invalid API key"
  Expected Result: Invalid credentials rejected

Scenario: Rate limiting works
  Tool: Bash (curl in loop)
  Steps:
    1. Send 15 requests in 10 seconds
    2. Assert: First 10 succeed
    3. Assert: Requests 11-15 return 429 (Too Many Requests)
  Expected Result: Rate limit enforced
```

**Commit**: YES
- Message: `feat(security): add api auth with hmac validation and rate limiting`
- Files: `src/lib/api-auth.ts`, `src/middleware/api-auth.ts`

---

### Task 5: ZapDev UI Components

**What to do**:
- Create "Export to Polaris" button component
- Build export progress modal with status updates
- Add success state with auto-redirect countdown
- Add error state with retry button
- Add to project card/menu in ZapDev dashboard
- Style to match ZapDev design system

**Must NOT do**:
- ❌ Block entire UI during export
- ❌ Show technical error details to users
- ❌ Auto-redirect without user confirmation

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: ['frontend-ui-ux', 'frontend-design']

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3
- **Blocks**: Task 7
- **Blocked By**: Tasks 3, 4

**References**:
- `src/modules/projects/ui/components/github-export-modal.tsx` - Modal pattern
- `src/modules/projects/ui/components/github-export-button.tsx` - Button pattern
- `src/components/ui/dialog.tsx` - Dialog component
- `src/components/ui/button.tsx` - Button component

**Acceptance Criteria**:
- [ ] Button visible on project cards
- [ ] Click opens progress modal
- [ ] Shows loading state during export
- [ ] Shows success with countdown before redirect
- [ ] Shows error with retry option
- [ ] Responsive design (mobile + desktop)

**Agent-Executed QA Scenario**:
```
Scenario: Complete UI flow
  Tool: Playwright
  Preconditions: ZapDev running with test project
  Steps:
    1. Navigate to /projects
    2. Click "Export to Polaris" button
    3. Assert: Modal opens with progress indicator
    4. Wait for completion state (timeout: 30s)
    5. Assert: Shows "Export Complete!"
    6. Assert: Shows countdown (5...4...3...)
    7. Assert: Auto-redirects to Polaris
    8. Screenshot: .sisyphus/evidence/ui-success.png
  Expected Result: Smooth UX from click to redirect
```

**Commit**: YES
- Message: `feat(ui): add export to polaris button and progress modal`
- Files: `src/components/export-to-polaris/*.tsx`

---

### Task 6: Error Handling & Rollback

**What to do**:
- Implement atomic transactions in import process
- Add rollback logic on partial failure
- Create error classification (retryable vs fatal)
- Build retry mechanism with exponential backoff
- Add comprehensive error logging
- Create admin dashboard to view failed exports

**Must NOT do**:
- ❌ Leave partial data on failure
- ❌ Retry fatal errors indefinitely
- ❌ Swallow errors without logging

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: ['git-master']

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3
- **Blocks**: Task 7
- **Blocked By**: Tasks 3, 4

**References**:
- `convex/githubExports.ts:369-392` - Error handling pattern
- `src/lib/error-handling.ts` - Error utilities (if exists)

**Acceptance Criteria**:
- [ ] Failed imports rollback all created data
- [ ] Retryable errors auto-retry 3 times
- [ ] Fatal errors show immediately
- [ ] All errors logged with context
- [ ] Admin can view failed import history

**Agent-Executed QA Scenario**:
```
Scenario: Rollback on failure
  Tool: Bash (curl + convex query)
  Steps:
    1. Start import with malformed attachment URL
    2. Wait for failure (timeout: 15s)
    3. Query projects: No new project created
    4. Query messages: No orphaned messages
    5. Query fragments: No partial fragments
  Expected Result: Clean rollback, no partial data
```

**Commit**: YES
- Message: `feat(error-handling): add rollback and retry logic for imports`
- Files: `src/lib/import-transaction.ts`, `convex/importFailures.ts`

---

### Task 7: E2E Testing & Integration

**What to do**:
- Write E2E tests for complete export flow
- Test edge cases (large projects, network failures)
- Test security scenarios (invalid auth, rate limits)
- Add performance benchmarks
- Document API contract
- Create test fixtures

**Must NOT do**:
- ❌ Test only happy path
- ❌ Skip security testing
- ❌ Use production data in tests

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: ['playwright', 'git-master']

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4
- **Blocks**: None
- **Blocked By**: Tasks 5, 6

**References**:
- `tests/` - Existing test patterns
- `playwright.config.ts` - Playwright configuration

**Acceptance Criteria**:
- [ ] E2E tests pass for happy path
- [ ] Security tests pass
- [ ] Large project test passes (50+ files)
- [ ] All tests run in CI
- [ ] API documentation complete

**Agent-Executed QA Scenario**:
```
Scenario: Full test suite
  Tool: Bash (bun test + playwright)
  Steps:
    1. Run: bun test import/
    2. Assert: All unit tests pass
    3. Run: bun run test:e2e
    4. Assert: All E2E tests pass
    5. Run: bun run test:security
    6. Assert: Security tests pass
  Expected Result: Full test coverage, all passing
```

**Commit**: YES
- Message: `test(e2e): add comprehensive export flow tests`
- Files: `tests/e2e/export-to-polaris.spec.ts`, `tests/fixtures/zapdev-project.ts`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(schema): add import tracking fields to projects table` | convex/schema.ts | convex dev starts |
| 2 | `feat(api): add zapdev import endpoint with full project creation` | src/app/api/import/zapdev/* | curl test passes |
| 3 | `feat(zapdev): add export service to call polaris import api` | src/services/polaris-export.ts | unit tests pass |
| 4 | `feat(security): add api auth with hmac validation and rate limiting` | src/lib/api-auth.ts | security tests pass |
| 5 | `feat(ui): add export to polaris button and progress modal` | src/components/export-to-polaris/* | Playwright test passes |
| 6 | `feat(error-handling): add rollback and retry logic for imports` | src/lib/import-transaction.ts | rollback test passes |
| 7 | `test(e2e): add comprehensive export flow tests` | tests/e2e/* | all tests pass |

---

## Success Criteria

### Verification Commands
```bash
# Schema migration
bun run convex:dev  # Should start without errors

# API endpoint
curl -X POST http://localhost:3000/api/import/zapdev \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
# Expected: 201 Created with project URL

# E2E tests
bun run test:e2e export-to-polaris
# Expected: All tests passing

# Security tests
bun run test:security
# Expected: Auth and rate limiting working
```

### Final Checklist
- [ ] User can export from ZapDev to Polaris in one click
- [ ] All project data transfers (files, messages, attachments)
- [ ] User automatically redirected to Polaris project
- [ ] Failed exports show helpful errors with retry
- [ ] Security: Only authorized apps can import
- [ ] Rate limiting prevents abuse
- [ ] Rollback prevents partial data on failure
- [ ] All tests passing
- [ ] API documentation complete
