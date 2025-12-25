# ZapDev Changelog

All notable changes to the ZapDev project will be documented in this file.

## [Unreleased]

### Added
- **Enhanced Project Download Functionality** - Improved blob handling with better file normalization, complete type safety with Fragment data structure, and comprehensive error handling for missing or invalid files. Users now receive clear feedback when downloads are unavailable. (commit: c4f111a)
- **Comprehensive Security Audit Infrastructure** - Added security audit documentation and vulnerability assessment capabilities to help identify and address potential security issues in the platform.
- **SEO Audit System** - Implemented audit logging and reporting system to track and document SEO improvements across the platform.
- **Input Validation & Error Sanitization** - Comprehensive validation system for all user inputs with proper error messages and logging to prevent invalid data processing.
- **Initial CHANGELOG Foundation** - Established changelog documentation standards to communicate changes clearly to users and developers.

### Changed
- **Project Download API** - Refactored `GET /api/projects/[projectId]/download/route.ts` with:
  - Improved file normalization logic using `normalizeFiles()` function
  - Better type safety with explicit TypeScript interfaces
  - More robust error detection for authorization and not-found scenarios
  - Added Content-Length header to response for better client-side handling
  - Enhanced blob generation with proper MIME type and cache control headers
- **Authentication & Authorization** - Strengthened user verification and project ownership validation in download endpoint
- **SEO & Performance** - Incremental improvements to audit and monitoring systems for better visibility into platform health

### Fixed
- **File Download Failures** - Fixed issues where downloads would fail due to improper file type handling. Now includes proper validation of fragment data before attempting to generate archives.
- **Missing Error Messages** - Improved error responses to clearly distinguish between "No files ready" (404) and "Permission denied" (403) scenarios.
- **Type Safety Issues** - Resolved TypeScript type inconsistencies in message and fragment data handling.
- **Cache Control** - Added proper cache control headers to prevent stale downloads from being served.

### Security
- **Authorization Validation** - Strengthened user ownership checks to prevent unauthorized access to other users' projects.
- **File Path Sanitization** - Implemented `filterFilesForDownload()` function to ensure only safe, AI-generated files are included in downloads.
- **Error Information Disclosure** - Sanitized error messages to prevent leaking sensitive information about file structure or internal APIs.

### Dependencies
- Updated @trpc/server from 11.6.0 to 11.8.0 (Dec 16, 2025)
- Updated @modelcontextprotocol/sdk from 1.19.1 to 1.24.0 (Dec 13, 2025)
- Updated express from 4.21.2 to 4.22.1 (Dec 13, 2025)

---

## [Previous Releases]

### November & December 2025
**Key Areas of Focus**: Authentication migration, database modernization (Convex), and enhanced code generation capabilities.

- Completed migration from PostgreSQL to Convex real-time database
- Implemented multi-framework code generation (Next.js, Angular, React, Vue, SvelteKit)
- Added Figma and GitHub OAuth integrations for design-to-code workflows
- Enhanced error detection and auto-fix capabilities in code generation
- Implemented credit/usage tracking system for fair access
- Added comprehensive sandbox persistence for development workflows

---

## Version History

| Version | Date | Status | Focus |
|---------|------|--------|-------|
| Unreleased | 2025-12-22 | In Development | Download enhancements, audit infrastructure |
| December 2025 | 2025-12-20 | Stable | Auth migration complete, Convex database live |
| November 2025 | 2025-11-13 | Stable | Better Auth integration, security improvements |

---

## Migration Guide

### For Users
- **Project Downloads**: If you experience issues downloading projects, ensure you are viewing the project that contains generated code. Empty projects cannot be downloaded.
- **File Access**: Only AI-generated files are included in project downloads. Custom uploads and dependencies are not packaged.

### For Developers
- **Type Safety**: When working with fragments and messages, ensure files are normalized before processing using the `normalizeFiles()` function.
- **Error Handling**: Always check for both authorization errors (403) and missing data errors (404) when implementing download functionality.
- **Security**: Use `filterFilesForDownload()` to validate and sanitize file lists before serving them to users.

---

## Known Issues
- None currently reported for the latest release.

## Contributors
- Development team at Tembo/ZapDev (Dec 2025)

---

**Last Updated**: December 22, 2025
