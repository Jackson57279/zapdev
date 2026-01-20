# ZapDev

AI-powered development platform that lets you create web applications by chatting with AI agents in real-time sandboxes.

## Features

- 🤖 AI-powered code generation with AI agents
- 💻 Real-time multi-framework application development in E2B sandboxes (Next.js, React, Vue, Angular, Svelte)
- 🔄 Live preview & code preview with split-pane interface
- 📁 File explorer with syntax highlighting and code theme
- 💬 Conversational project development with message history
- 🎯 Smart usage tracking and rate limiting
- 💳 Subscription management with Polar.sh
- 🔐 Authentication with Clerk
- 🗃️ Real-time project management and persistence with Convex
- 💰 Generated app billing templates with Polar.sh

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **UI Components**: Shadcn/ui (Radix UI primitives), Lucide React
- **Backend**: tRPC for type-safe APIs
- **Database**: Convex (real-time database)
- **Authentication**: Clerk with JWT
- **AI**: Vercel AI SDK with OpenRouter (supports OpenAI, Anthropic, Grok, Cerebras, and more)
- **Code Execution**: E2B Code Interpreter (sandboxed environments)
- **AI Agents**: Custom agent orchestration (replaces Inngest)
- **Payments**: Polar.sh (subscription management)
- **Monitoring**: Sentry (error tracking)
- **Package Manager**: Bun

## Building E2B Template (REQUIRED)

Before running the application, you must build the E2B template that the AI agents use to create sandboxes.

**Prerequisites:**
- Docker must be installed and running (the template build command uses Docker CLI)

```bash
# Install E2B CLI
npm i -g @e2b/cli
# or
brew install e2b

# Login to E2B
e2b auth login

# Navigate to the sandbox template directory
cd sandbox-templates/nextjs

# Build the template (replace 'your-template-name' with your desired name)
e2b template build --name your-template-name --cmd "/compile_page.sh"
```

After building the template, update the template name in `src/agents/code-agent.ts`:

```typescript
// Replace "your-template-name" with your actual template name
const sandbox = await Sandbox.create("your-template-name");
```

## Development

```bash
# Install dependencies
bun install

# Set up environment variables
cp env.example .env
# Fill in your API keys and configuration

# Start Convex development server (Terminal 1)
bun run convex:dev

# Start Next.js development server (Terminal 2)
bun run dev
```

### Setting Up Convex Database

1. **Create a Convex Account**: Go to [Convex](https://convex.dev) and sign up
2. **Create a Project**: Create a new project in the Convex dashboard
3. **Get Your URL**: Copy your Convex deployment URL
4. **Set Environment Variables**: Add `NEXT_PUBLIC_CONVEX_URL` to your `.env` file
5. **Deploy Schema**: Run `bun run convex:dev` to sync your schema

### Setting Up AI Providers

The application supports multiple AI providers via OpenRouter:

1. **OpenRouter** (Primary): Get API key from [OpenRouter](https://openrouter.ai)
2. **Cerebras** (Optional): Ultra-fast inference for GLM 4.7 model
3. **Vercel AI Gateway** (Optional): Fallback for rate limits

The system automatically selects the best model based on task requirements.

## Environment Variables

Create a `.env` file with the following variables (see `env.example` for complete list):

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Convex Database
NEXT_PUBLIC_CONVEX_URL=""
NEXT_PUBLIC_CONVEX_SITE_URL=""

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
CLERK_JWT_ISSUER_DOMAIN=""
CLERK_JWT_TEMPLATE_NAME="convex"

# AI Providers
OPENROUTER_API_KEY=""
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
CEREBRAS_API_KEY=""  # Optional: for GLM 4.7 model
VERCEL_AI_GATEWAY_API_KEY=""  # Optional: fallback gateway

# E2B Sandboxes
E2B_API_KEY=""

# Polar.sh Payments
POLAR_ACCESS_TOKEN=""
POLAR_WEBHOOK_SECRET=""
NEXT_PUBLIC_POLAR_ORGANIZATION_ID=""
NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID=""
NEXT_PUBLIC_POLAR_PRO_PRICE_ID=""

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=""  # Optional: error tracking
```

## Deployment to Vercel

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick overview:
1. Set up Convex project and get your deployment URL
2. Configure Clerk authentication and get JWT issuer domain
3. Deploy to Vercel with all required environment variables
4. Deploy Convex schema: `bun run convex:deploy`
5. Configure Polar.sh webhooks for subscription management

## Additional Commands

```bash
# Convex Database
bun run convex:dev     # Start Convex dev server
bun run convex:deploy  # Deploy Convex schema to production

# Build & Development
bun run build          # Build for production
bun run start          # Start production server
bun run lint           # Run ESLint
bun run dev            # Start Next.js dev server (Turbopack)
```

## Project Structure

- `src/app/` - Next.js app router pages and layouts
- `src/components/` - Reusable UI components and file explorer
- `src/modules/` - Feature-specific modules (projects, messages, usage)
- `src/agents/` - AI agent orchestration and code generation logic
- `src/prompts/` - Framework-specific LLM prompts
- `src/lib/` - Utilities and helpers
- `src/trpc/` - tRPC router and client setup
- `convex/` - Convex database schema, queries, and mutations
- `sandbox-templates/` - E2B sandbox configurations (nextjs, react, vue, angular, svelte)

## How It Works

1. **Project Creation**: Users create projects and describe what they want to build
2. **Framework Detection**: AI automatically detects or selects the appropriate framework (Next.js, React, Vue, Angular, Svelte)
3. **AI Processing**: Messages are processed by custom AI agents using OpenRouter (supports multiple models)
4. **Code Generation**: AI agents use E2B sandboxes to generate and test applications in isolated environments
5. **Real-time Updates**: Generated code and previews are streamed and displayed in split-pane interface
6. **File Management**: Users can browse generated files with syntax highlighting
7. **Iteration**: Conversational development allows for refinements and additions
8. **Persistence**: All code and messages are stored in Convex for real-time synchronization

## Generated App Payments

ZapDev can generate payment-ready apps using Polar.sh. The platform includes subscription management, usage tracking, and billing portal integration. Configure with Polar.sh environment variables from `env.example`.


