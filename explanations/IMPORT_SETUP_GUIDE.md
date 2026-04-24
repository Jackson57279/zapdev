# Import Features Setup Guide

This guide walks you through setting up Figma and GitHub integrations for ZapDev's import features.

## Overview

The import feature allows users to:
- **Figma**: Convert design files directly into code
- **GitHub**: Import repositories for analysis, code review, and development

## Figma OAuth Setup

### 1. Create a Figma OAuth App

1. Go to [Figma Developer Settings](https://www.figma.com/developers)
2. Click "Create an app"
3. Fill in the app name (e.g., "ZapDev")
4. Accept the terms and create the app
5. In the app settings, you'll get:
   - **Client ID**
   - **Client Secret** (keep this private!)

### 2. Configure OAuth Redirect URL

1. In your Figma app settings, go to "OAuth"
2. Add a redirect URI: `https://your-domain.com/api/import/figma/callback`
   - For local development: `http://localhost:3000/api/import/figma/callback`
3. Save the settings

### 3. Add to Environment Variables

```env
FIGMA_CLIENT_ID=your-figma-client-id
FIGMA_CLIENT_SECRET=your-figma-client-secret
NEXT_PUBLIC_APP_URL=https://your-domain.com  # or http://localhost:3000
```

### 4. Request Scopes

The following Figma API scopes are requested:
- `file_read` - Read access to Figma files

## GitHub OAuth Setup

### 1. Create a GitHub OAuth App

1. Go to GitHub Settings → Developer settings → [OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: "ZapDev"
   - **Homepage URL**: `https://your-domain.com` or `http://localhost:3000`
   - **Authorization callback URL**: `https://your-domain.com/api/import/github/callback`

### 2. Get Credentials

After creation, you'll receive:
- **Client ID**
- **Client Secret** (keep this private!)

### 3. Add to Environment Variables

```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
NEXT_PUBLIC_APP_URL=https://your-domain.com  # or http://localhost:3000
```

### 4. Request Scopes

The following GitHub API scopes are requested:
- `repo` - Full control of private and public repositories
- `read:user` - Read user profile data
- `user:email` - Access to user email addresses

## Database Setup

The import feature uses two new Convex tables:

### `oauthConnections`
Stores encrypted OAuth tokens for both providers
- Fields: userId, provider, accessToken, refreshToken, expiresAt, scope, metadata
- Indexes: by_userId, by_userId_provider

### `imports`
Tracks import history and status
- Fields: userId, projectId, messageId, source, sourceId, sourceName, sourceUrl, status, metadata
- Indexes: by_userId, by_projectId, by_status

These are automatically created when you update your Convex schema.

## API Routes

The following API routes handle the OAuth flows:

### Figma
- `GET /api/import/figma/auth` - Initiates Figma OAuth flow
- `GET /api/import/figma/callback` - Handles OAuth callback
- `GET /api/import/figma/files` - Lists user's Figma files
- `POST /api/import/figma/process` - Processes selected Figma file

### GitHub
- `GET /api/import/github/auth` - Initiates GitHub OAuth flow
- `GET /api/import/github/callback` - Handles OAuth callback
- `GET /api/import/github/repos` - Lists user's repositories
- `POST /api/import/github/process` - Processes selected repository

## Component Structure

### UI Components
- `/src/app/import/page.tsx` - Main import page with options
- `/src/components/import/figma-import-flow.tsx` - Figma file selection
- `/src/components/import/github-import-flow.tsx` - GitHub repo selection
- `/src/app/dashboard/10x-swe/page.tsx` - 10x SWE dashboard

### Convex Functions
- `/convex/oauth.ts` - OAuth connection management
- `/convex/imports.ts` - Import record management

## Workflow

### Figma Import
1. User clicks "Import from Figma" in message form
2. Directed to `/api/import/figma/auth` for OAuth
3. User grants Figma access
4. Callback stores credentials in Convex
5. User selects Figma file
6. File data is fetched and processed
7. Import record created with PENDING status
8. AI processes design and generates code

### GitHub Import
1. User clicks "Import from GitHub" in message form
2. Directed to `/api/import/github/auth` for OAuth
3. User grants GitHub access
4. Callback stores credentials in Convex
5. User selects import mode:
   - **Import to Project**: Load repo into existing project
   - **10x SWE Dashboard**: Advanced analysis and review tools
6. Repository data is fetched
7. Import record created with PENDING status
8. Processing begins based on selected mode

## Next Steps

### To Complete Implementation:
1. **Inngest Jobs**: Create background jobs to:
   - Process Figma designs: parse structure, generate code prompts
   - Analyze GitHub repos: extract structure, dependencies, issues

2. **Message Integration**: Update message creation to:
   - Attach import records to messages
   - Include import context in AI prompts
   - Display import status in UI

3. **10x SWE Dashboard**: Implement:
   - Real-time repository analysis
   - PR review integration
   - Code suggestion engine

4. **Testing**: Test OAuth flows with:
   - Multiple users
   - Token refresh scenarios
   - Error handling and reconnection

## Troubleshooting

### "Figma connection expired"
- User needs to reconnect their Figma account
- Old tokens are automatically invalidated

### "GitHub token invalid"
- User needs to reconnect their GitHub account
- Check if OAuth app was revoked in GitHub settings

### OAuth Redirect Issues
- Ensure redirect URLs match exactly in OAuth app settings
- Check NEXT_PUBLIC_APP_URL environment variable is correct
- Verify domain/port for local development

### Token Storage Security
- Tokens are stored encrypted in Convex
- Never log or expose tokens in responses
- Implement token refresh logic for long-lived tokens

## Security Best Practices

1. **Token Encryption**: Tokens are stored securely in Convex
2. **CSRF Protection**: State tokens prevent CSRF attacks
3. **Scope Limitation**: Only request necessary API scopes
4. **Token Expiration**: Implement token refresh for long-lived sessions
5. **Error Handling**: Never expose sensitive error messages to users

## API Rate Limits

### Figma API
- 300 requests per minute (authenticated)
- Files endpoint: 10 requests per second

### GitHub API
- 60 requests per hour (unauthenticated)
- 5000 requests per hour (authenticated)

Consider implementing request caching to stay within limits.

## Resources

- [Figma Developer Documentation](https://www.figma.com/developers/api)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Convex Database Documentation](https://docs.convex.dev/)
