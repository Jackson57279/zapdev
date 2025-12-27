# Inngest AgentKit Debugging Guide

## Quick Reference: Common Errors and Solutions

### Error: "Error making AI request"

This generic error typically indicates one of the following issues:

#### 1. Missing or Invalid API Key

**Symptoms:**
```
[ERROR] AI_GATEWAY_API_KEY environment variable is not set. Cannot initialize AI models.
```

**Solution:**
```bash
# Check if API key is set
echo $AI_GATEWAY_API_KEY

# Set the API key if missing
export AI_GATEWAY_API_KEY="your_key_here"

# Restart Inngest dev server
bun run convex:dev
```

#### 2. Incorrect Model Adapter Configuration

**Symptoms:**
```
[ERROR] Failed to initialize Gemini adapter for model "google/gemini-2.5-flash-lite": ...
[ERROR] Failed to initialize OpenAI adapter for model "anthropic/claude-haiku-4.5": ...
```

**Solution:**
Check that:
1. Model ID exists in `MODEL_CONFIGS` in `src/inngest/functions.ts`
2. API base URL is correct (should be `https://ai-gateway.vercel.sh/v1` for Vercel AI Gateway)
3. Model ID format matches: `provider/model-name`

#### 3. Framework Selector Failure

**Symptoms:**
```
[ERROR] Framework selection failed: ...
[WARN] Falling back to default framework (Next.js) due to framework selector error
```

**Solution:**
The system automatically falls back to Next.js. Check:
1. Framework detection prompt in `src/prompts/framework-selector.ts`
2. API connectivity to AI gateway
3. Model availability for gemini-2.5-flash-lite

#### 4. Network/Network Run Failure

**Symptoms:**
```
[ERROR] Network run failed with error: ...
[ERROR] Stack trace: ...
```

**Solution:**
1. Check API key is valid and has sufficient credits
2. Verify AI gateway is accessible: `curl https://ai-gateway.vercel.sh/v1`
3. Check Inngest event processing: `bunx inngest dev` in separate terminal
4. Review full stack trace for specific error

## Debug Logging Reference

The enhanced error handling includes strategic debug logging:

```typescript
[DEBUG] Initializing Gemini adapter for model: google/gemini-2.5-flash-lite
[DEBUG] Initializing OpenAI-compatible adapter for model: anthropic/claude-haiku-4.5
[DEBUG] Running network with input: your prompt...
[DEBUG] Framework selector output: nextjs
[ERROR] Network run failed with error: [specific error message]
[ERROR] Stack trace: [full stack trace]
```

### Reading the Logs

1. **[DEBUG]** - Normal execution flow, safe to ignore
2. **[WARN]** - Warning condition, system continues with fallback
3. **[ERROR]** - Error condition, may require manual intervention

## Step-by-Step Debugging

### Step 1: Verify Environment

```bash
# Check API keys
env | grep AI_GATEWAY
env | grep E2B_API_KEY
env | grep CONVEX

# Expected output:
# AI_GATEWAY_API_KEY=your_key
# AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
# NEXT_PUBLIC_CONVEX_URL=your_url
# E2B_API_KEY=your_key
```

### Step 2: Check Model Configuration

```typescript
// In src/inngest/functions.ts, verify MODEL_CONFIGS has your model:
export const MODEL_CONFIGS = {
  "anthropic/claude-haiku-4.5": {
    name: "Claude Haiku 4.5",
    provider: "anthropic",  // Used for adapter selection
    // ...
  },
  "google/gemini-2.5-flash-lite": {
    name: "Gemini 2.5 Flash Lite",
    provider: "google",  // Uses Gemini adapter
    // ...
  },
};
```

### Step 3: Test Model Adapter

```typescript
// Add temporary test in Inngest function:
try {
  const adapter = getModelAdapter("google/gemini-2.5-flash-lite", 0.3);
  console.log("[TEST] Model adapter initialized successfully", adapter);
} catch (error) {
  console.error("[TEST] Model adapter initialization failed:", error);
}
```

### Step 4: Enable Detailed Logging

```typescript
// Increase logging in getModelAdapter():
console.log("[DEBUG] Model ID:", modelId);
console.log("[DEBUG] Config found:", !!config);
console.log("[DEBUG] Is Google model:", isGoogleModel);
console.log("[DEBUG] Temperature:", temp);
console.log("[DEBUG] API Key present:", !!apiKey);
console.log("[DEBUG] Base URL:", baseUrl);
```

### Step 5: Check API Gateway

```bash
# Test connectivity to AI Gateway
curl -X GET https://ai-gateway.vercel.sh/v1/models \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY"

# Test with actual model
curl -X POST https://ai-gateway.vercel.sh/v1/chat/completions \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "google/gemini-2.5-flash-lite", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Performance Tuning

### Model Adapter Initialization Time

If adapter initialization is slow:

1. Cache the adapter instance:
```typescript
let cachedAdapters: Map<string, any> = new Map();

function getModelAdapter(modelId: string, temperature?: number) {
  const cacheKey = `${modelId}_${temperature}`;
  if (cachedAdapters.has(cacheKey)) {
    return cachedAdapters.get(cacheKey);
  }
  // ... initialize adapter ...
  cachedAdapters.set(cacheKey, adapter);
  return adapter;
}
```

2. Pre-warm adapters during startup:
```typescript
// In Inngest client initialization
const warmupModels = ["anthropic/claude-haiku-4.5", "google/gemini-2.5-flash-lite"];
warmupModels.forEach(model => {
  try {
    getModelAdapter(model);
    console.log(`[STARTUP] Warmed up model: ${model}`);
  } catch (error) {
    console.warn(`[STARTUP] Failed to warm up model ${model}:`, error);
  }
});
```

## Related Error Patterns

### E2B Sandbox Errors

```
[ERROR] Failed to create E2B sandbox: [error message]
```
- Check `E2B_API_KEY` is set and valid
- Verify sandbox template exists (e.g., `zapdev`, `zapdev-nextjs`)
- Check rate limiting in E2B dashboard

### Convex Errors

```
[ERROR] Failed to fetch previous messages: [error message]
```
- Check Convex backend is running: `bun run convex:dev`
- Verify `NEXT_PUBLIC_CONVEX_URL` is correct
- Check network connectivity to Convex

### File Operations Errors

```
[ERROR] Failed to read file [path]: [error message]
```
- Verify file path is valid
- Check file size (max 10MB for individual files)
- Ensure file is within sandbox workspace

## Health Check Script

```bash
#!/bin/bash
# health_check.sh - Quick health check for AgentKit setup

echo "=== AgentKit Health Check ==="

# Check API key
if [ -z "$AI_GATEWAY_API_KEY" ]; then
  echo "❌ AI_GATEWAY_API_KEY not set"
else
  echo "✅ AI_GATEWAY_API_KEY is set"
fi

# Check base URL
if [ -z "$AI_GATEWAY_BASE_URL" ]; then
  echo "⚠️  AI_GATEWAY_BASE_URL not set (using default)"
else
  echo "✅ AI_GATEWAY_BASE_URL is set to $AI_GATEWAY_BASE_URL"
fi

# Check E2B API key
if [ -z "$E2B_API_KEY" ]; then
  echo "❌ E2B_API_KEY not set"
else
  echo "✅ E2B_API_KEY is set"
fi

# Check Convex setup
if [ -z "$NEXT_PUBLIC_CONVEX_URL" ]; then
  echo "❌ NEXT_PUBLIC_CONVEX_URL not set"
else
  echo "✅ NEXT_PUBLIC_CONVEX_URL is set"
fi

echo ""
echo "Run 'bun run convex:dev' in a separate terminal to start backend"
```

## Support

For issues not covered here:

1. Check `explanations/INNGEST_AGENTKIT_FIX.md` for detailed technical information
2. Review `src/inngest/functions.ts` for recent changes
3. Check git log: `git log --oneline | grep -i agentkit`
4. Review full error logs in Inngest dashboard
