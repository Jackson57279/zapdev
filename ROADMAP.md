# ZapDev Roadmap

## Core Features

### Payments Integration

**Status**: Finished
**Priority**: High

Currently, ZapDev uses Polar.sh for subscription billing. This roadmap item focuses on:

- **Complete Payment Flow**: Ensure end-to-end payment processing works reliably
  - Fix any edge cases in checkout flow
  - Improve error handling and user feedback
  - Add payment retry logic for failed transactions
  - Implement proper webhook verification and idempotency

- **Stripe Alternative**: Add Stripe as an alternative payment provider
  - Allow users to choose between Polar.sh and Stripe during setup
  - Unified API abstraction for both providers
  - Migration tools for switching between providers

- **Payment Features**:
  - One-time payments for credits/packages
  - Usage-based billing options
  - Team/organization billing
  - Invoice generation and management
  - Payment method management UI

---

## Platform Enhancements

### Multi-Platform Deployment Support

**Status**: Planned  
**Priority**: Medium

Currently optimized for Vercel deployment. Expand to support multiple hosting platforms:

- **Netlify Integration**:
  - Netlify-specific build configuration
  - Edge functions for API routes
  - Environment variable management
  - Deploy preview support

- **Other Platforms**:
  - Railway deployment configuration
  - Render.com support
  - Self-hosted Docker deployment option
  - Platform-agnostic deployment scripts

- **Deployment Features**:
  - One-click deployment from dashboard
  - Environment variable management UI
  - Deployment history and rollback
  - Custom domain configuration
  - SSL certificate management

### Payment Integration in Generated Apps

**Status**: Planned  
**Priority**: High

Enable users to easily add payment functionality to the applications they generate:

- **Polar.sh Integration**:
  - Pre-configured Polar checkout components
  - Subscription management UI templates
  - Webhook handlers for subscription events
  - Credit/usage tracking integration

- **Stripe Integration**:
  - Stripe Checkout integration templates
  - Stripe Elements components
  - Subscription management flows
  - Payment intent handling

- **Features**:
  - Framework-specific payment templates (Next.js, React, Vue, etc.)
  - AI-powered payment setup wizard
  - Pre-built admin dashboards for payment management
  - Analytics and reporting templates

### Mobile App Implementation

**Status**: Planned  
**Priority**: Low

Create native mobile applications for iOS and Android:

- **Core Features**:
  - Project management on mobile
  - View generated code and previews
  - Chat with AI agents
  - Monitor usage and subscriptions
  - Push notifications for project updates

- **Technical Approach**:
  - React Native or Expo for cross-platform development
  - Reuse existing API endpoints (tRPC)
  - Optimized UI for mobile screens
  - Offline support for viewing projects

- **Platform-Specific**:
  - iOS App Store submission
  - Google Play Store submission
  - Mobile-specific authentication flows
  - Deep linking for project sharing

---

## Enhancement Features

### Claude Code Implementation

**Status**: Under Consideration  
**Priority**: Low

Add Claude Code (Anthropic) as an alternative AI model for code generation:

- **Implementation**:
  - Integrate Anthropic API alongside existing OpenRouter setup
  - Model selection UI in project settings
  - Claude-specific prompt optimizations
  - Cost comparison and usage tracking per model

- **Benefits**:
  - Users can choose their preferred AI model
  - Different models excel at different tasks
  - Redundancy if one provider has issues

### Theme System

**Status**: Planned  
**Priority**: Medium

Implement comprehensive theming using Shadcn/ui's theming capabilities:

- **Theme Features**:
  - Light/dark mode toggle
  - Custom color palette selection
  - Multiple pre-built themes (Ocean, Forest, Sunset, etc.)
  - User-customizable themes
  - Theme persistence per user

- **Implementation**:
  - Leverage Shadcn/ui's CSS variables system
  - Theme picker component in settings
  - Preview themes before applying
  - Export/import theme configurations

### Database Provider Selection

**Status**: Planned  
**Priority**: Medium

Allow users to choose their preferred database provider:

- **Supported Providers**:
  - Convex (current default)
  - Supabase (PostgreSQL)
  - PlanetScale (MySQL)
  - MongoDB Atlas
  - Firebase Firestore

- **Features**:
  - Provider selection during project setup
  - Automatic schema migration between providers
  - Provider-specific optimizations
  - Connection management UI
  - Backup and restore functionality

- **Benefits**:
  - Flexibility for different use cases
  - Cost optimization options
  - Regional data residency compliance


### GitHub Export

**Status**: Planned  
**Priority**: High

Enable users to export their generated projects directly to GitHub repositories for version control, collaboration, and deployment:

- **Repository Creation**:
  - One-click export to new GitHub repository
  - Automatic repository initialization with generated code
  - Support for public, private, and organization repositories
  - Custom repository name and description
  - Optional README generation with project details

- **Export Features**:
  - Full project structure export (all files and directories)
  - Preserve file permissions and structure
  - Include `.gitignore` and other configuration files
  - Export project metadata and documentation
  - Incremental updates to existing repositories

- **GitHub Integration**:
  - OAuth authentication with GitHub
  - Secure token storage and management
  - Support for GitHub App authentication
  - Branch creation for project versions
  - Commit history tracking

- **Advanced Features**:
  - Export to existing repositories (push to specific branch)
  - Multiple repository export (fork to multiple locations)
  - Automated initial commit with descriptive messages
  - Tag creation for project versions
  - GitHub Actions workflow templates inclusion

- **User Experience**:
  - Export progress indicator
  - Error handling and retry logic
  - Export history tracking
  - Quick access to exported repositories
  - One-click repository opening in GitHub

- **Technical Implementation**:
  - GitHub REST API integration
  - File tree generation and upload
  - Large file handling (GitHub LFS support)
  - Rate limit management
  - Background job processing for large exports
