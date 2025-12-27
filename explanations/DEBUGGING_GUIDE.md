# E2B and Inngest Debugging Guide

## Issues Fixed

### 1. E2B Sandbox Creation Failure
**Problem**: E2B sandboxes weren't being created because the authentication wasn't being passed.

**Solution**: Added authentication parameter to both `Sandbox.create()` and `Sandbox.connect()` calls.

```typescript
// Before (broken):
const sandbox = await Sandbox.create("zapdev");

// After (fixed):
const sandbox = await Sandbox.create("zapdev", {
  // Pass authentication from environment
});
```

### 2. Template Not Found Error
**Problem**: The "zapdev" template might not exist for all E2B accounts.

**Solution**: Added fallback logic to use the default template if "zapdev" fails:

```typescript
let sandbox;
try {
  sandbox = await Sandbox.create("zapdev", {
    // Pass authentication
  });
} catch (templateError) {
  // Fallback to default template
  sandbox = await Sandbox.create({
    // Pass authentication
  });
}
```

### 3. Inngest AI Gateway Configuration (CRITICAL FIX)
**Problem**: The `@inngest/ai` openai() function expects `baseUrl` (lowercase 'u'), but the code was using `baseURL` (uppercase 'U').

**Root Cause**: Property name mismatch caused the AI Gateway URL to be ignored, defaulting to OpenAI's API endpoint instead.

**Solution**: Changed `baseURL` → `baseUrl` in all three agent configurations:
- code-agent (line 103)
- fragment-title-generator (line 241)
- response-generator (line 252)

**Additional Fix**: Removed trailing slash from AI_GATEWAY_BASE_URL in .env for consistency.

## Debug Logging Added

The following debug logs have been added to help identify issues:

1. **Function start**: Logs when the code-agent function begins
2. **Environment variables**: Confirms E2B and AI Gateway credentials are present
3. **Sandbox creation**: Logs sandbox ID when created successfully
4. **Database queries**: Logs message fetching and count
5. **Network execution**: Logs input and output summary
6. **Error handling**: Comprehensive error messages with context

## Test Scripts

### 1. E2B Sandbox Test (`test-e2b-sandbox.js`)
Tests E2B sandbox creation, file operations, and command execution.

```bash
node test-e2b-sandbox.js
```

### 2. Inngest AI Gateway Test (`test-inngest-ai.js`)
Tests the connection to Vercel AI Gateway with Inngest-style configuration.

```bash
node test-inngest-ai.js
```

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
# E2B
# E2B authentication (get from https://e2b.dev/dashboard)

# Vercel AI Gateway
# AI Gateway configuration
# Base URL: https://ai-gateway.vercel.sh/v1/

# Inngest
# Inngest event and signing configuration
```

## Common Issues & Solutions

### Issue: "Sandbox doesn't exist or you don't have access"
**Cause**: Trying to reconnect to a sandbox that has been terminated.
**Solution**: Sandboxes auto-terminate after timeout. Create a new sandbox instead of reconnecting.

### Issue: "401 Unauthorized" from E2B
**Cause**: Invalid or missing E2B authentication.
**Solution**: Check your credentials at https://e2b.dev/dashboard

### Issue: Network/agent execution fails silently
**Cause**: Missing error handling in agent tools.
**Solution**: All tool handlers now include try-catch blocks with detailed error messages.

### Issue: Duplicate console output
**Cause**: Multiple dotenv injections.
**Solution**: Filter out dotenv messages: `node script.js 2>&1 | grep -v "dotenv@"`

## Monitoring Inngest Functions

1. Check the Inngest dashboard at the `/api/inngest` endpoint
2. Look for function execution logs
3. Check for failed runs and error messages
4. Verify event triggers are working

## Local Development Setup

For Inngest functions to execute locally, you need to run the Inngest Dev Server:

### Option 1: Using Inngest Dev Server (Recommended for Local Testing)
```bash
# Install Inngest CLI globally
bun add -g inngest-cli

# In one terminal, run your Next.js app
bun run dev

# In another terminal, run Inngest Dev Server
npx inngest-cli@latest dev
```

The Dev Server will:
- Connect to your local Next.js app at `http://localhost:3000/api/inngest`
- Execute functions when events are triggered
- Provide a UI at `http://localhost:8288` to view function runs

### Option 2: Using Inngest Cloud (Production)
1. Deploy your app to Vercel
2. Sync your app URL with Inngest Cloud dashboard at https://app.inngest.com
3. Functions will execute in the cloud when events are triggered

**Note**: Without either setup, `inngest.send()` will succeed but functions won't execute.

## Next Steps if Issues Persist

1. **Check logs**: Run with debug logging enabled
2. **Verify templates**: List available E2B templates with their API
3. **Test isolation**: Run test scripts individually
4. **Environment check**: Ensure all credentials are valid
5. **Network issues**: Check if services are accessible from your environment
6. **Inngest setup**: Verify Inngest Dev Server is running for local testing
