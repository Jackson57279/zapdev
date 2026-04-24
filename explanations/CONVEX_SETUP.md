# Convex + Clerk Billing Setup Guide

This guide documents the complete setup for using Convex as the database with Clerk authentication and billing integration.

## 🎯 Overview

The application has been configured to use:
- **Convex**: Real-time database with TypeScript queries
- **Clerk**: Authentication and billing management
- **Clerk Billing**: Subscription management (Free & Pro tiers)

## 📋 Prerequisites

1. Convex account - https://convex.dev
2. Clerk account - https://clerk.com
3. Environment variables configured

## 🚀 Setup Steps

### 1. Convex Deployment Setup

```bash
# Login to Convex (first time only)
bunx convex login

# Create a new Convex project or link existing
bunx convex dev

# This will:
# - Create a deployment
# - Generate environment variables
# - Start watching for schema changes
```

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Convex
CONVEX_DEPLOYMENT=<your-deployment-name>  # e.g., prod:zapdev-123
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>  # e.g., https://abc123.convex.cloud

# Clerk (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-key>
CLERK_SECRET_KEY=<your-clerk-secret>

# Clerk JWT Issuer (for Convex auth)
CLERK_JWT_ISSUER_DOMAIN=<your-clerk-domain>  # e.g., your-app.clerk.accounts.dev
```

### 3. Clerk JWT Template Configuration

1. Go to Clerk Dashboard → **JWT Templates**
2. Click **+ New template**
3. Select **Convex** from the list
4. Name it: `convex`
5. Click **Create**
6. Copy the **Issuer** URL and add to `.env` as `CLERK_JWT_ISSUER_DOMAIN`

The JWT template should include these claims:
```json
{
  "sub": "{{user.id}}"
}
```

### 4. Clerk Webhooks Setup (User Sync)

1. Go to Clerk Dashboard → **Webhooks**
2. Click **+ Add Endpoint**
3. Endpoint URL: `https://your-domain.com/api/webhooks/clerk`
4. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the **Signing Secret**
6. Add to `.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=<your-webhook-secret>
   ```

### 5. Clerk Billing Configuration

#### Free Tier
- 5 generations per 24 hours
- Automatic for all users

#### Pro Tier
- 100 generations per 24 hours
- $29/month (configurable in Clerk)

**Setup in Clerk Dashboard:**
1. Go to **Billing** → **Plans**
2. Create or configure plans:
   - **Free**: $0/month (default)
   - **Pro**: $29/month
3. Set custom claim `plan: "pro"` for Pro users
4. Embed the PricingTable component (already done in `/pricing`)

### 6. Convex Provider Setup

The app needs to be wrapped with `ConvexProviderWithClerk`. This has been prepared in the Convex configuration.

In your root layout (`src/app/layout.tsx`), you'll need to update:

```tsx
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## 📊 Database Schema

### Tables

#### `users`
- Synced from Clerk via webhooks
- Fields: `clerkId`, `name`, `email`, `imageUrl`

#### `projects`
- User-created projects
- Fields: `name`, `userId`, `framework`
- Indexes: `by_userId`, `by_userId_createdAt`

#### `messages`
- Conversation history
- Fields: `content`, `role`, `type`, `status`, `projectId`
- Indexes: `by_projectId`, `by_projectId_createdAt`

#### `fragments`
- Generated code artifacts
- Fields: `messageId`, `sandboxId`, `sandboxUrl`, `title`, `files`, `metadata`, `framework`
- Indexes: `by_messageId`

#### `fragmentDrafts`
- Work-in-progress code
- Fields: `projectId`, `sandboxId`, `sandboxUrl`, `files`, `framework`
- Indexes: `by_projectId`

#### `attachments`
- Image attachments for messages
- Fields: `messageId`, `type`, `url`, `width`, `height`, `size`
- Indexes: `by_messageId`

#### `usage`
- Credit tracking for billing
- Fields: `userId`, `points`, `expire`, `planType`
- Indexes: `by_userId`, `by_expire`

## 🔐 Authentication Flow

1. User signs in via Clerk
2. Clerk issues JWT with user ID
3. Convex validates JWT using auth.config.ts
4. Functions access user via `ctx.auth.getUserIdentity()`
5. User data synced to Convex via webhooks

## 💳 Billing Flow

### Credit System
```typescript
// Free: 5 credits per 24 hours
// Pro: 100 credits per 24 hours
// Cost: 1 credit per generation
```

### Usage Tracking
1. User initiates generation
2. System calls `checkAndConsumeCredit()` mutation
3. Checks user's plan (Free vs Pro)
4. Verifies available credits
5. Consumes credit if available
6. Returns remaining credits

### Plan Detection
```typescript
// In Convex functions
const identity = await ctx.auth.getUserIdentity();
const plan = identity?.plan || identity?.publicMetadata?.plan;
const isPro = plan === "pro";
```

## 🔄 Webhook Handler Implementation

Create `/app/api/webhooks/clerk/route.ts`:

```typescript
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    await convex.mutation(api.users.syncUser, {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim() || undefined,
      imageUrl: image_url,
    });
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    await convex.mutation(api.users.deleteUser, {
      clerkId: id!,
    });
  }

  return new Response("", { status: 200 });
}
```

## 📝 Usage in Components

### Query Data
```tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function ProjectList() {
  const projects = useQuery(api.projects.list);

  return (
    <div>
      {projects?.map(project => (
        <div key={project._id}>{project.name}</div>
      ))}
    </div>
  );
}
```

### Mutate Data
```tsx
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function CreateProject() {
  const createProject = useMutation(api.projects.create);

  const handleCreate = async () => {
    await createProject({
      name: "My Project",
      framework: "NEXTJS"
    });
  };

  return <button onClick={handleCreate}>Create</button>;
}
```

### Check Usage
```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function UsageDisplay() {
  const usage = useQuery(api.usage.getUsage);
  const checkCredit = useMutation(api.usage.checkAndConsumeCredit);

  return (
    <div>
      <p>Credits: {usage?.points} / {usage?.maxPoints}</p>
      <button onClick={() => checkCredit()}>
        Use Credit
      </button>
    </div>
  );
}
```

## 🧪 Testing

### Local Development
```bash
# Start Convex dev server
bunx convex dev

# In another terminal, start Next.js
bun run dev
```

### Test Webhook Locally
Use Clerk's webhook testing UI or ngrok:
```bash
ngrok http 3000
# Update Clerk webhook endpoint to ngrok URL
```

## 🚀 Deployment

### Deploy Convex
```bash
bunx convex deploy
```

### Environment Variables for Production
Make sure to set all environment variables in your hosting platform:
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `CLERK_JWT_ISSUER_DOMAIN`
- `CLERK_WEBHOOK_SECRET`
- (All existing Clerk variables)

### Update Clerk Webhooks
Update webhook URL to production domain:
```
https://your-production-domain.com/api/webhooks/clerk
```

## 📚 Resources

- [Convex Docs](https://docs.convex.dev)
- [Convex + Clerk Integration](https://docs.convex.dev/auth/clerk)
- [Clerk Webhooks](https://clerk.com/docs/integrations/webhooks)
- [Clerk Billing](https://clerk.com/docs/billing/overview)

## 🔧 Troubleshooting

### Auth Issues
- Verify JWT template is created in Clerk
- Check `CLERK_JWT_ISSUER_DOMAIN` matches Clerk issuer
- Ensure Convex deployment has correct auth config

### Webhook Issues
- Verify webhook secret is correct
- Check webhook endpoint is publicly accessible
- Review Clerk Dashboard → Webhooks → Event Logs

### Credit System Issues
- Check usage table in Convex dashboard
- Verify user's Clerk plan metadata
- Test `checkAndConsumeCredit` mutation directly

## ✅ Next Steps

1. Deploy Convex to production
2. Configure Clerk JWT template
3. Set up Clerk webhooks
4. Test authentication flow
5. Test billing/credit system
6. Migrate existing data (if needed)
7. Update all components to use Convex hooks
8. Remove PostgreSQL dependencies

## 🎉 Benefits

✅ **Real-time Updates**: Reactive queries update automatically
✅ **Type Safety**: End-to-end TypeScript types
✅ **Simpler Code**: No ORM, direct database access
✅ **Better Performance**: Edge functions worldwide
✅ **Easier Billing**: Clerk handles all payment logic
✅ **No Migrations**: Schema changes deploy instantly
