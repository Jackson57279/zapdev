# Changelog

All notable changes to ZapDev are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [December 2025] - 2025-12-20

### Added

- **Enhanced AI Model Support**: Expanded support for multiple AI models with configurable model selection and batch size optimization. Platform now supports Claude, OpenAI, Gemini, Grok, Kimi, and Qwen models for code generation.
- **Comprehensive Security Implementation**: Introduced robust input validation and error sanitization across all user-facing endpoints to protect against injection attacks and data tampering.
- **Advanced Audit Logging**: Added detailed security audit documentation and automated SEO audit reports for improved transparency and compliance tracking.
- **Framework Documentation**: Expanded documentation for Angular 19, React 18, Vue 3, and SvelteKit integrations with best practices and configuration guides.

### Changed

- **Model Names & Configuration**: Updated AI model naming conventions and internal model identifiers to align with latest API specifications from Vercel AI Gateway.
- **Batch Size Optimization**: Increased batch sizes for improved throughput and cost-efficiency in code generation operations, particularly for multi-file projects.
- **Error Handling Workflow**: Refactored error detection and auto-fix mechanism to provide more contextual error messages and improved recovery strategies.
- **Inngest Agent Architecture**: Restructured the code generation orchestration layer for better performance and maintainability (single agent workflow now active).

### Security

- **Input Validation**: Implemented comprehensive input sanitization for all user submissions including file content, prompts, and configuration parameters.
- **Error Sanitization**: Enhanced error handling to prevent sensitive information leakage in error messages and logs.
- **Security Audit**: Completed thorough security review of dependencies and authentication flows with documented findings in `/audit` directory.

### Fixed

- **Auth Migration Stability**: Resolved authentication edge cases following migration from Clerk to Stack Auth with Convex integration.
- **Figma Import Process**: Fixed design-to-code conversion pipeline to properly handle complex Figma components and layer hierarchies.
- **GitHub Integration**: Corrected OAuth token handling and repository import workflow for improved reliability.
- **Sandbox Session Management**: Improved E2B sandbox instance lifecycle management to prevent resource leaks.

### Infrastructure & Dependencies

- **Updated tRPC**: Upgraded `@trpc/server` from 11.6.0 to 11.8.0 with performance improvements and bug fixes.
- **MCP SDK Update**: Bumped `@modelcontextprotocol/sdk` from 1.19.1 to 1.24.0 for enhanced protocol support.
- **Express Framework**: Updated Express from 4.21.2 to 4.22.1 for security patches and performance enhancements.
- **Build System**: Transitioned to Turbopack for Next.js development with improved hot reload and build performance.

### Documentation

- **Comprehensive Setup Guides**: Added detailed guides for Convex migration, authentication setup, and sandbox persistence.
- **Deployment Checklist**: Created step-by-step deployment verification procedures and troubleshooting guides.
- **Performance Optimization Guide**: Documented SEO improvements, performance tuning, and resource optimization strategies.
- **Developer Reference**: Expanded Cursor rules and AI agent documentation for improved developer experience.

---

## [November 2025]

### Added

- **Stack Auth Integration**: Migrated authentication system from Clerk to Stack Auth with improved flexibility and cost efficiency.
- **Convex Database Migration**: Completed transition from PostgreSQL to Convex real-time database with full backward compatibility.
- **Enhanced Import Capabilities**: Added support for Figma design imports and GitHub repository references for code-generation context.
- **Real-time Updates**: Implemented Convex subscriptions for instant UI updates when projects and messages change.

### Changed

- **Authentication Flow**: Updated user authentication to use Stack Auth with existing Clerk user data migration.
- **Database Layer**: All new data operations now use Convex instead of PostgreSQL/Prisma.
- **File Persistence**: Implemented sandbox session persistence to maintain state across user interactions.

### Fixed

- **OAuth Token Security**: Enhanced encryption for stored OAuth tokens in Convex database.
- **Rate Limiting**: Improved credit usage tracking with accurate 24-hour rolling window calculations.
- **Sandbox Timeout Handling**: Fixed sandbox auto-termination after 60 minutes of inactivity.

---

## Key Features

### Multi-Framework Support
- **Next.js 15** - Full-stack React with SSR and component generation
- **Angular 19** - Enterprise-grade framework with Material Design integration
- **React 18** - SPA development with Chakra UI components
- **Vue 3** - Progressive framework with Vuetify support
- **SvelteKit** - High-performance reactive framework

### Core Capabilities
- **AI-Powered Code Generation** - Conversational development using Claude AI
- **Real-time Previews** - Live sandbox execution in isolated E2B environments
- **Design Import** - Convert Figma designs to production-ready code
- **Code References** - Import GitHub repositories as context for variations
- **Credit System** - Free tier (5 generations/24h) and Pro tier (100 generations/24h)

### Developer Tools
- **Type-Safe APIs** - End-to-end TypeScript with tRPC
- **Real-time Database** - Convex for instant data synchronization
- **Job Orchestration** - Inngest 3.44 for reliable background processing
- **Error Monitoring** - Sentry integration for production observability
- **Performance Metrics** - OpenTelemetry distributed tracing

---

## Breaking Changes

None in this release. All updates are backward compatible.

## Migration Guide

### For Developers
- No migration required if using the latest deployment
- Existing projects continue to work without changes
- New projects automatically use updated AI models and batch configurations

### For Self-Hosted Instances
- Update `package.json` dependencies to latest versions
- Redeploy Convex backend: `bun run convex:deploy`
- Update environment variables as needed (see `env.example`)

---

## Getting Started

```bash
# Install dependencies
bun install

# Start development servers (two terminals)
bun run dev              # Frontend on http://localhost:3000
bun run convex:dev       # Backend Convex

# Build for production
bun run build
bun run start
```

For detailed setup instructions, see [CLAUDE.md](./CLAUDE.md) and [README.md](./README.md).

---

## Support & Feedback

- **Documentation**: Check `/explanations` directory for comprehensive guides
- **Issues**: Report bugs at [GitHub Issues](https://github.com/zapdev/zapdev)
- **Community**: Join our Slack for discussions and updates

---

**Release Date**: December 20, 2025
**Contributors**: Team ZapDev, Cursor Agent, Community Contributors
