# Convex Migration Status

## ✅ Completed Setup

### 1. Dependencies Installed
- [x] `convex` - Convex client and server SDK
- [x] `@convex-dev/auth` - Authentication utilities for Convex

### 2. Convex Configuration Files Created

#### Core Configuration
- [x] `/convex/tsconfig.json` - TypeScript configuration for Convex functions
- [x] `/convex/schema.ts` - Complete database schema mirroring PostgreSQL
- [x] `/convex/auth.config.ts` - Clerk JWT authentication configuration

#### Database Functions
- [x] `/convex/helpers.ts` - Authentication helpers and utilities
- [x] `/convex/users.ts` - User sync mutations for Clerk webhooks
- [x] `/convex/usage.ts` - Credit tracking and billing logic
- [x] `/convex/projects.ts` - Project CRUD operations
- [x] `/convex/messages.ts` - Message, fragment, and attachment operations

#### API Integration
- [x] `/src/app/api/webhooks/clerk/route.ts` - Clerk webhook handler for user sync

#### Documentation
- [x] `/CONVEX_SETUP.md` - Complete setup guide with instructions
- [x] `/MIGRATION_STATUS.md` - This file, tracking migration progress
- [x] `.env.example` - Updated with Convex environment variables

## 🔄 Schema Migration Details

### Tables Migrated to Convex

| PostgreSQL Table | Convex Table | Status | Notes |
|-----------------|--------------|--------|-------|
| (none) | `users` | ✅ New | Synced from Clerk via webhooks |
| `Project` | `projects` | ✅ Ready | Includes userId index for performance |
| `Message` | `messages` | ✅ Ready | Includes projectId index |
| `Fragment` | `fragments` | ✅ Ready | One-to-one with message |
| `FragmentDraft` | `fragmentDrafts` | ✅ Ready | One-to-one with project |
| `Attachment` | `attachments` | ✅ Ready | One-to-many with message |
| `Usage` | `usage` | ✅ Ready | Enhanced with planType field |

### Enums Converted
- [x] `Framework` → `frameworkEnum` (union of literals)
- [x] `MessageRole` → `messageRoleEnum`
- [x] `MessageType` → `messageTypeEnum`
- [x] `MessageStatus` → `messageStatusEnum`
- [x] `AttachmentType` → `attachmentTypeEnum`

### Indexes Created
- [x] `users.by_clerkId` - Lookup users by Clerk ID
- [x] `projects.by_userId` - Get projects by user
- [x] `projects.by_userId_createdAt` - Ordered project list
- [x] `messages.by_projectId` - Get messages for project
- [x] `messages.by_projectId_createdAt` - Ordered messages
- [x] `fragments.by_messageId` - Get fragment for message
- [x] `fragmentDrafts.by_projectId` - Get draft for project
- [x] `attachments.by_messageId` - Get attachments for message
- [x] `usage.by_userId` - Get usage by user
- [x] `usage.by_expire` - Query expired usage records

## 🎯 Billing System

### Credit System (Ready)
- **Free Tier**: 5 generations per 24 hours
- **Pro Tier**: 100 generations per 24 hours
- **Cost**: 1 credit per generation

### Functions Implemented
- [x] `checkAndConsumeCredit()` - Atomic credit check and consumption
- [x] `getUsage()` - Get current usage stats
- [x] `resetUsage()` - Admin function to reset user credits

### Clerk Integration
- [x] Plan detection via Clerk custom claims (`plan: "pro"`)
- [x] Automatic credit allocation based on plan
- [x] 24-hour rolling window with expiration tracking

## 🚀 Next Steps (TODO)

### 1. Deploy Convex
```bash
bunx convex login
bunx convex dev  # For development
bunx convex deploy  # For production
```

### 2. Configure Clerk

#### JWT Template
1. Go to Clerk Dashboard → JWT Templates
2. Create new template: Select "Convex"
3. Copy issuer domain to `.env` as `CLERK_JWT_ISSUER_DOMAIN`

#### Webhooks
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. Copy signing secret to `.env` as `CLERK_WEBHOOK_SECRET`

#### Billing Plans
1. Go to Clerk Dashboard → Billing
2. Configure plans with custom claim `plan: "pro"` for Pro users
3. Verify PricingTable component (already in `/pricing`)

### 3. Update Application Code

#### Install Additional Dependencies
```bash
bun add svix  # For webhook verification
```

#### Update Root Layout
Modify `src/app/layout.tsx` to use `ConvexProviderWithClerk`:

```tsx
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Wrap your app with:
<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
  {children}
</ConvexProviderWithClerk>
```

#### Migrate Components
- [ ] Replace tRPC hooks with Convex hooks
- [ ] Update `useQuery()` calls to use `api.projects.list`, etc.
- [ ] Update `useMutation()` calls to use Convex mutations
- [ ] Update usage display component to use `api.usage.getUsage`

#### Remove tRPC Procedures (After Migration)
- [ ] Delete PostgreSQL tRPC procedures
- [ ] Remove Prisma client initialization
- [ ] Update any server actions using Prisma

### 4. Data Migration

If you have existing data in PostgreSQL:

1. **Export existing data**
   ```bash
   # Create export scripts for each table
   bun run scripts/export-postgresql-data.ts
   ```

2. **Import to Convex**
   ```bash
   # Import data via Convex HTTP actions
   bun run scripts/import-to-convex.ts
   ```

3. **Verify data integrity**
   - Check record counts match
   - Verify relationships are preserved
   - Test application functionality

### 5. Testing

- [ ] Test authentication flow (sign in/up)
- [ ] Verify user sync from Clerk to Convex
- [ ] Test project creation and listing
- [ ] Test message creation and fragments
- [ ] Verify credit system (Free and Pro tiers)
- [ ] Test cascade deletes (delete project → deletes messages)
- [ ] Test attachment uploads
- [ ] Verify real-time updates work

### 6. Production Deployment

1. **Deploy Convex**
   ```bash
   bunx convex deploy
   ```

2. **Update Environment Variables**
   Set all required env vars in production:
   - `CONVEX_DEPLOYMENT`
   - `NEXT_PUBLIC_CONVEX_URL`
   - `CLERK_JWT_ISSUER_DOMAIN`
   - `CLERK_WEBHOOK_SECRET`

3. **Update Clerk Webhook**
   Change webhook URL to production domain

4. **Deploy Application**
   Deploy your Next.js app with updated environment variables

### 7. Cleanup (After Successful Migration)

- [ ] Remove PostgreSQL dependencies
  ```bash
  bun remove prisma @prisma/client rate-limiter-flexible
  ```
- [ ] Delete `/prisma` directory
- [ ] Remove `DATABASE_URL` from environment variables
- [ ] Delete PostgreSQL-related utility files
- [ ] Update documentation

## 📊 Migration Statistics

- **Tables Created**: 7 (6 migrated + 1 new users table)
- **Indexes Created**: 10
- **Functions Created**: 20+
- **Lines of Code**: ~1,200

## 🔗 Quick Links

- [Convex Setup Guide](./CONVEX_SETUP.md) - Complete setup instructions
- [Convex Dashboard](https://dashboard.convex.dev) - Manage deployments
- [Clerk Dashboard](https://dashboard.clerk.com) - Configure auth & billing
- [Convex Docs](https://docs.convex.dev) - Official documentation
- [Clerk + Convex Integration](https://docs.convex.dev/auth/clerk) - Integration guide

## 💡 Key Differences from PostgreSQL

### 1. No UUIDs
Convex uses `Id<"tableName">` instead of string UUIDs. IDs are automatically generated.

### 2. Timestamps as Numbers
Convex stores timestamps as milliseconds (numbers) instead of `DateTime` objects.

### 3. No Cascade on Delete
Implement cascade logic manually in delete mutations (see `projects.deleteProject`).

### 4. Real-time by Default
All queries are reactive - components re-render automatically when data changes.

### 5. No Migrations
Schema changes are applied instantly on push. No migration files needed.

### 6. Built-in Auth
Authentication is built into the context (`ctx.auth`), no separate middleware.

## ⚠️ Important Notes

1. **Don't remove PostgreSQL yet**: Keep it running until migration is complete and tested
2. **Test thoroughly**: Especially test the credit system and cascade deletes
3. **Backup data**: Export PostgreSQL data before final cutover
4. **Monitor webhooks**: Check Clerk webhook logs for sync issues
5. **JWT template required**: App won't work without Clerk JWT template configured

## 🎯 Success Criteria

Migration is complete when:
- [x] ✅ All Convex functions created
- [x] ✅ Schema matches PostgreSQL structure
- [x] ✅ Billing logic implemented
- [x] ✅ Clerk webhook handler created
- [ ] ⏳ Convex deployed to production
- [ ] ⏳ Clerk configured (JWT + webhooks)
- [ ] ⏳ Application code updated to use Convex
- [ ] ⏳ All tests passing
- [ ] ⏳ Production deployment successful
- [ ] ⏳ PostgreSQL removed

**Current Status**: 🟡 **Setup Complete - Ready for Configuration & Testing**

The foundation is ready! Now you need to:
1. Deploy Convex (`bunx convex dev`)
2. Configure Clerk JWT template and webhooks
3. Update your application code to use Convex
4. Test everything thoroughly
5. Deploy to production

All the hard work of creating the schema, functions, and billing logic is done. The next steps are configuration and integration! 🚀
