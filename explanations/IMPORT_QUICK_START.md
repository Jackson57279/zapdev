# Figma & GitHub Import - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. OAuth App Setup (10 minutes)

#### Figma
1. Go to https://www.figma.com/developers
2. Create new app → Get Client ID & Secret
3. Add redirect URI: `http://localhost:3000/api/import/figma/callback`

#### GitHub
1. Go to https://github.com/settings/developers
2. New OAuth App
3. Add redirect URI: `http://localhost:3000/api/import/github/callback`

### 2. Environment Variables (2 minutes)

```bash
# Copy .env.example to .env.local
cp .env.example .env.local

# Edit .env.local and add:
FIGMA_CLIENT_ID=your-client-id
FIGMA_CLIENT_SECRET=your-secret
GITHUB_CLIENT_ID=your-app-id
GITHUB_CLIENT_SECRET=your-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup (1 minute)

The schema is already updated with:
- `oauthConnections` table
- `imports` table
- Updated `attachmentTypeEnum` and `attachments` table

Run `bun run convex:dev` to sync schema.

### 4. Inngest Integration (3 minutes)

In your Inngest event handler file, register the new functions:

```typescript
import { processFigmaImport } from "@/inngest/functions/process-figma-import";
import { processGitHubImport } from "@/inngest/functions/process-github-import";

export default [
  processFigmaImport,
  processGitHubImport,
  // ... other functions
];
```

### 5. Trigger Jobs (2 minutes)

Update `/api/import/figma/process`:
```typescript
await inngest.send({
  name: "code-agent/process-figma-import",
  data: {
    importId: importRecord,
    projectId,
    fileKey,
    accessToken: connection.accessToken
  }
});
```

Update `/api/import/github/process`:
```typescript
await inngest.send({
  name: "code-agent/process-github-import",
  data: {
    importId: importRecord,
    projectId,
    repoFullName,
    accessToken: connection.accessToken,
    importMode: "project" // or "dashboard"
  }
});
```

## 📝 Implementation Checklist

- [ ] OAuth apps created (Figma & GitHub)
- [ ] Environment variables set
- [ ] Database schema synced
- [ ] Inngest functions registered
- [ ] Job triggers added to API routes
- [ ] Test Figma OAuth flow
- [ ] Test GitHub OAuth flow
- [ ] Test file/repo import
- [ ] Test error handling
- [ ] Verify token storage

## 🧪 Testing

### Test Figma Import
1. Go to project → Click Import button → Select Figma
2. Authorize Figma access
3. Select a Figma file
4. Watch import process
5. Check for generated message with design context

### Test GitHub Import
1. Go to project → Click Import button → Select GitHub
2. Authorize GitHub access
3. Select repository
4. Choose import mode (Project or Dashboard)
5. Verify processing

### Debug Issues
```bash
# Check Convex logs
bun run convex dev

# Check API calls in browser DevTools
# Monitor Inngest job execution in dashboard
```

## 🔧 Key Files to Review

| File | Purpose |
|------|---------|
| `convex/oauth.ts` | OAuth token management |
| `convex/imports.ts` | Import record management |
| `/api/import/*/process` | Trigger Inngest jobs |
| `inngest/functions/*` | Background job logic |
| `src/app/import/page.tsx` | Import UI entry point |
| `IMPORT_SETUP_GUIDE.md` | Detailed setup guide |

## 🆘 Common Issues

### "OAuth app not configured"
- Check `FIGMA_CLIENT_ID` and `GITHUB_CLIENT_ID` in `.env`
- Verify OAuth apps created in respective dashboards

### "Redirect URI mismatch"
- Ensure redirect URLs match exactly in OAuth settings
- Check `NEXT_PUBLIC_APP_URL` environment variable

### "Import stuck on PENDING"
- Verify Inngest event handler is registered
- Check Inngest dashboard for failed jobs
- Review job logs for errors

### "Token invalid"
- User needs to reconnect OAuth
- Implement token refresh if needed
- Clear old tokens in database

## 📚 Documentation

- **Setup Guide** → `IMPORT_SETUP_GUIDE.md`
- **Implementation Details** → `IMPORT_IMPLEMENTATION_SUMMARY.md`
- **Code Examples** → See component files
- **API Documentation** → Check route handlers

## 🎯 Next Steps

1. **Immediate**: Set up OAuth and test flows
2. **Short-term**: Implement job triggers
3. **Medium-term**: Enhance 10x SWE dashboard
4. **Long-term**: Add token refresh, advanced features

## 💡 Pro Tips

- Use Figma's REST API docs: https://www.figma.com/developers/api
- Use GitHub's GraphQL: https://docs.github.com/en/graphql
- Test with multiple users to verify token isolation
- Monitor Inngest jobs for performance
- Use database indices for query optimization

## 📞 Need Help?

1. Check `IMPORT_SETUP_GUIDE.md` for detailed setup
2. Review component source code with comments
3. Check Inngest logs for job failures
4. Verify OAuth credentials and URLs
5. Test with minimal examples first

---

**Ready to go!** Start with step 1 and work through the checklist. You should be up and running in 20-30 minutes.
