# Changelog - December 2025

## Overview

This release brings significant enhancements to ZapDev's AI-powered development platform, focusing on authentication modernization, cost optimization, subscription management, and improved developer experience.

## Added

### 🔐 Authentication & Security
- **Stack Auth Integration**: Complete migration from Better Auth to Stack Auth for improved security and Convex compatibility
- **Polar.sh Subscription Management**: Full subscription billing system with automated credit allocation and webhook processing
- **Enhanced Security Headers**: Improved security configuration in Next.js deployment

### 💰 Billing & Subscriptions
- **Pro Tier Support**: Added subscription-based pricing with 100 generations per day for Pro users
- **Polar Checkout Integration**: Secure, PCI-compliant payment processing with saved card support
- **Webhook Automation**: Real-time subscription status updates and credit management
- **Subscription Dashboard**: User interface for managing billing and subscription details

### ⚡ Performance & Cost Optimization
- **E2B Sandbox Persistence**: Automatic pause/resume functionality for sandboxes to reduce compute costs
- **Activity Tracking**: Smart detection of user activity to prevent premature sandbox pausing
- **Auto-Pause Jobs**: Background jobs that automatically pause idle sandboxes after 10 minutes
- **Cost Reduction**: Significant reduction in E2B compute costs through intelligent resource management

### 🛠️ Developer Experience
- **Enhanced Error Detection**: Improved system for catching ECMAScript parsing errors and build failures
- **Manual Error Fixing**: Free "Fix Errors" button that doesn't consume user credits
- **Build Verification**: Automated build checks alongside existing lint validation
- **Error Pattern Recognition**: Expanded error detection patterns for better auto-fix capabilities

### 🔍 SEO & Analytics
- **AI SEO Reviewer Framework**: Infrastructure for automated SEO analysis and optimization
- **Comprehensive SEO Audit**: Detailed review of existing SEO implementation with improvement recommendations
- **Structured Data Enhancement**: Improved JSON-LD schema implementation across the platform
- **Performance Monitoring**: Web Vitals integration and analytics setup preparation

### 📁 Import & Integration Features
- **Figma Integration**: Enhanced design-to-code import capabilities with OAuth authentication
- **GitHub Integration**: Code reference and import functionality for development workflows
- **OAuth Token Management**: Secure encrypted storage of third-party API tokens

## Changed

### 🔄 Authentication Flow
- **URL Structure Updates**: Authentication routes changed from `/sign-up` to `/handler/sign-up` and similar for sign-in
- **API Integration**: Updated to use Stack Auth hooks (`useUser()`) instead of Better Auth client
- **Server-Side Auth**: Modified to use `getUser()` and `getConvexClientWithAuth()` patterns

### 💳 Credit System
- **Dynamic Allocation**: Credits now automatically adjust based on subscription status (5/day Free, 100/day Pro)
- **Real-time Updates**: Webhook-driven credit updates instead of manual management
- **Usage Tracking**: Enhanced tracking with 24-hour rolling windows and subscription-aware limits

### 🏗️ Architecture Improvements
- **Sandbox Session Management**: New database table for tracking sandbox lifecycle and state
- **Background Job Orchestration**: Enhanced Inngest functions for automated maintenance tasks
- **Error Handling**: Improved error detection and auto-fix capabilities across the platform

### 🎨 UI/UX Enhancements
- **Code Viewer Improvements**: Enhanced syntax highlighting with support for 25+ programming languages
- **Download Functionality**: Improved project download with better error handling and compression
- **Fragment Web Component**: Enhanced error feedback and resource management

## Fixed

### 🐛 Bug Fixes
- **Code Viewer Rendering**: Fixed React rendering cycle issues with Prism.js syntax highlighting
- **Download API**: Resolved early return issues and improved error handling in download routes
- **Fragment Web Downloads**: Enhanced error handling with specific status code validation
- **TypeScript Errors**: Fixed type safety issues across multiple components
- **Build Verification**: Added proper timeout handling for build checks (60-second limit)

### 🔧 Technical Fixes
- **Import Validation**: Improved validation for empty zip files and content types
- **Resource Cleanup**: Added proper cleanup for blob URLs and delayed revocation
- **Permission Checks**: Enhanced 401/403 error handling in download functionality
- **Compression Options**: Added compression support for project downloads

## Security

### 🔒 Security Enhancements
- **Webhook Signature Verification**: Standard Webhooks spec implementation for Polar integration
- **OAuth Token Encryption**: Secure storage of Figma and GitHub API tokens in Convex
- **Environment Variable Protection**: Sensitive configuration moved to secure environment variables
- **HTTPS Enforcement**: Mandatory HTTPS for production deployments

### 🛡️ Authentication Security
- **Stack Auth Migration**: Upgraded to more secure authentication provider with better session management
- **Token Validation**: Enhanced validation for API tokens and user sessions
- **Permission Controls**: Improved access control for subscription-based features

## Deprecated

### 📋 Planned Deprecations
- **Legacy Usage Table**: Gradual migration away from manual usage tracking to subscription-based system
- **PostgreSQL Dependencies**: Continued migration to Convex-only data operations
- **Manual Credit Management**: Automated systems replacing manual credit allocation

## Removed

### 🗑️ Removals
- **Better Auth Dependencies**: Complete removal of Better Auth packages and related code
- **Legacy Sign-in Pages**: Removed custom authentication pages in favor of Stack Auth handlers
- **Manual Sandbox Management**: Removed manual pause/resume controls (now automatic)

## Migration Guide

### For Existing Users
1. **Authentication**: Existing users will need to create new accounts with Stack Auth (automatic migration not implemented)
2. **Credits**: Free users retain 5 generations/day; Pro users get automatic upgrade to 100 generations/day
3. **Sandbox Behavior**: Sandboxes now automatically pause after 10 minutes of inactivity

### For Developers
1. **Environment Variables**: Update to new Stack Auth and Polar configuration variables
2. **API Changes**: Update authentication code to use Stack Auth patterns
3. **Webhook Configuration**: Set up Polar webhooks for subscription management

## Performance Impact

- **Sandbox Costs**: ~70-80% reduction in E2B compute costs through auto-pause functionality
- **Build Times**: Minimal impact with parallel lint/build validation
- **Database Queries**: Slight increase due to sandbox session tracking (negligible)
- **User Experience**: Improved with faster error detection and fixing

## Acknowledgments

Special thanks to the development team for the comprehensive implementation of these features, particularly:
- Stack Auth migration and integration
- Polar.sh billing system implementation
- E2B sandbox persistence optimization
- Enhanced error detection and fixing system

---

**Release Date**: December 16, 2025
**Version**: v2.1.0
**Contributors**: @Caleb Goodnite, @Jackson Wheeler, and the ZapDev team