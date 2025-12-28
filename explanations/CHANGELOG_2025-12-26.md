# ZapDev Changelog - December 26, 2025

## Overview
This release focuses on infrastructure improvements, refactoring of core systems, and continued optimization of the AI-powered code generation platform.

---

## [December 26, 2025] - Sandbox Infrastructure Updates

### Changed
- **Sandbox URL Handling Refactored** - Simplified the sandbox URL retrieval logic in the code generation agent by bypassing the `getHost()` method and implementing a fallback URL format. This improves reliability during code generation execution.
  - Enhanced error handling for port-based URL retrieval with improved debugging logs
  - Updated console messaging to reflect new sandbox URL handling patterns
  - Impact: More stable and predictable sandbox initialization for generated projects

---

## Recent Updates (November - December 2025)

### Added
- **Comprehensive Security Audit Documentation** - Added detailed security vulnerability audit reports and mitigation strategies
- **SEO Enhancements** - Implemented comprehensive SEO audit logging and improvements across the platform
- **Project Download Functionality** - Enhanced project export and download features with improved error handling
- **Multiple AI Model Support** - Extended platform to support various AI models through the Inngest agent framework

### Changed
- **Authentication Migration** - Completed migration from Clerk to Stack Auth with full Convex integration
- **Code Generation Agent** - Refined error handling with auto-fix retry logic (max 2 attempts) for build and lint errors
- **Framework Support** - Optimized framework detection and selection for Next.js, Angular, React, Vue, and Svelte
- **Database Layer** - Continued transition from PostgreSQL to Convex for real-time database operations

### Fixed
- **Build & Lint Error Handling** - Improved auto-fix detection for SyntaxError, TypeError, and build failures
- **OAuth Token Management** - Fixed Figma/GitHub OAuth token handling with proper encryption in Convex
- **SEO & Performance** - Resolved various SEO crawlability issues and optimized performance metrics

### Security
- **Input Validation** - Implemented comprehensive input validation and sanitization for all user inputs
- **Path Traversal Prevention** - Added file path sanitization to prevent directory traversal attacks
- **API Key Management** - Ensured all API keys are properly isolated with environment variable configuration

---

## Version Information
- **Current Version**: Unreleased (Development)
- **Branch**: `tembo/changelog-generation-slack-docs-1`
- **Last Updated**: December 26, 2025, 00:37:31 UTC
- **Author**: ZapDev Team

---

## Getting Help
For detailed information about specific features, refer to:
- `/explanations/CONVEX_QUICKSTART.md` - Quick start guide for database operations
- `/explanations/DEBUGGING_GUIDE.md` - Troubleshooting and debugging
- `/explanations/SANDBOX_PERSISTENCE.md` - Sandbox persistence documentation
- `CLAUDE.md` - Complete project architecture and development guide

---

## Notes for Contributors
- Always use `bun` for package management (not npm or yarn)
- Follow the project structure documented in `CLAUDE.md`
- Run `bun run lint` and `bun run build` before committing
- Update documentation in `/explanations/` for significant changes
