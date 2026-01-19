# ZapDev Roadmap

## Completed Features

### Core Platform
**Status**: ✅ Complete

- **AI Code Generation**: Multi-model support (OpenAI, Anthropic, Cerebras) with streaming responses
- **Real-time Development**: Live code generation in E2B sandboxes with dev server integration
- **Project Management**: Full CRUD operations with framework detection and persistence
- **Message History**: Complete conversation tracking with AI assistant responses
- **File Management**: Batch file operations, sandbox file reading, and code validation
- **Auto-Fix Retry**: AI agents retry build/lint failures up to 2 times with error context

### Multi-Framework Support
**Status**: ✅ Complete

All major frameworks supported with dedicated E2B templates and prompts:
- **Next.js 15**: Shadcn/ui, Tailwind CSS, Turbopack dev server
- **Angular 19**: Material Design, standalone components
- **React 18**: Vite-based with Chakra UI
- **Vue 3**: Vuetify Material Design
- **SvelteKit**: DaisyUI Tailwind components

### Authentication & Security
**Status**: ✅ Complete

- **Clerk Integration**: Complete authentication with user management
- **Authorization**: Protected routes and API endpoints with `requireAuth`
- **OAuth Connections**: Figma, GitHub, and Netlify integrations
- **Input Validation**: Zod validation, OAuth token encryption, file path sanitization

### Payments & Subscriptions
**Status**: ✅ Complete

- **Polar.sh Integration**: Subscription management with webhook handling
- **Credit System**: Free (5/day), Pro (100/day), and Unlimited tiers
- **Usage Tracking**: Real-time credit consumption with 24-hour rolling window
- **Webhook Processing**: Idempotent event handling with retry logic

### Database & Backend
**Status**: ✅ Complete

- **Convex Database**: Full schema with projects, messages, fragments, deployments, usage tracking
- **Real-time Queries**: Reactive data fetching for live updates
- **Background Jobs**: Sandbox session management and webhook processing
- **Rate Limiting**: Per-user and global rate limit enforcement

### Deployment Integration
**Status**: ✅ Complete

- **Netlify Deployment**: Full deployment workflow with status tracking
- **Deployment History**: Version tracking with rollback capability
- **Custom Domains**: Domain configuration UI (Netlify-based)
- **Environment Variables**: Secure env var management per deployment

### GitHub Export
**Status**: ✅ Complete

- **Repository Creation**: One-click export to new GitHub repositories
- **OAuth Authentication**: Secure GitHub token storage and management
- **Full Project Export**: All files and directories with proper structure
- **Export Tracking**: History and status monitoring in database (`githubExports` table)

### UI/UX
**Status**: ✅ Complete

- **Modern UI**: Shadcn/ui components with Tailwind CSS
- **Dark Mode**: System-aware theme support
- **Responsive Design**: Mobile-first approach
- **SEO Optimization**: Structured data, meta tags, OpenGraph
- **Error Handling**: Error boundaries and fallback UI states

---

## Planned Features

### Multi-Platform Deployment Support
**Status**: 🔜 Planned  
**Priority**: Medium

Expand beyond Netlify to support additional hosting platforms:

- **Additional Platforms**:
  - Vercel deployment integration
  - Railway deployment configuration
  - Render.com support
  - Self-hosted Docker deployment option

- **Enhanced Features**:
  - Platform comparison and recommendations
  - Unified deployment dashboard across platforms
  - SSL certificate management

### Payment Integration in Generated Apps
**Status**: 🔜 Planned  
**Priority**: High

Enable users to add payment functionality to their generated applications:

- **Stripe Integration Templates**:
  - Stripe Checkout integration
  - Stripe Elements components
  - Subscription management flows
  - Payment intent handling

- **Polar.sh Templates**:
  - Pre-configured checkout components
  - Subscription management UI
  - Webhook handlers

- **Features**:
  - Framework-specific payment templates
  - AI-powered payment setup wizard
  - Pre-built admin dashboards

### Mobile App
**Status**: 🔜 Planned  
**Priority**: Low

Native mobile applications for iOS and Android:

- **Core Features**:
  - Project management on mobile
  - View generated code and previews
  - Chat with AI agents
  - Monitor usage and subscriptions
  - Push notifications

- **Technical Approach**:
  - React Native or Expo
  - Reuse existing tRPC endpoints
  - Offline support for viewing projects

---

## Under Consideration

### Additional AI Models
**Status**: 🤔 Under Consideration  
**Priority**: Low

Expand AI model options beyond current providers:

- **Claude Integration**: Direct Anthropic API (currently via OpenRouter)
- **Model Selection UI**: User preference per project
- **Cost Tracking**: Per-model usage analytics
- **Model Comparison**: Help users choose the right model

### Advanced Theme System
**Status**: 🤔 Under Consideration  
**Priority**: Medium

Enhanced theming beyond dark/light mode:

- **Features**:
  - Custom color palette selection
  - Multiple pre-built themes
  - User-customizable themes
  - Theme persistence per user
  - Export/import configurations

### Database Provider Selection
**Status**: 🤔 Under Consideration  
**Priority**: Medium

Allow choosing database providers for generated apps:

- **Potential Providers**:
  - Convex (current default)
  - Supabase (PostgreSQL)
  - PlanetScale (MySQL)
  - MongoDB Atlas
  - Firebase Firestore

- **Features**:
  - Provider selection during project setup
  - Automatic schema generation per provider
  - Provider-specific optimizations
