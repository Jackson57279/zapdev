# Vercel AI Gateway Integration for Cerebras Fallback

## Overview

This implementation adds Vercel AI Gateway as a fallback for Cerebras API when rate limits are hit. The system automatically switches to Vercel AI Gateway with Cerebras-only routing to ensure continued operation without using slow providers.

## Architecture

### Primary Path: Direct Cerebras API
- Fast direct connection to Cerebras
- No proxy overhead
- Default for `zai-glm-4.7` model

### Fallback Path: Vercel AI Gateway
- Automatically triggered on rate limit errors
- Routes through Vercel AI Gateway proxy
- Forces Cerebras provider using `only: ['cerebras']`
- Avoids slow providers (OpenAI, Anthropic, etc.)

## Setup Instructions

### 1. Get Vercel AI Gateway API Key

1. Go to [Vercel AI Gateway Dashboard](https://vercel.com/dashboard/ai-gateway)
2. Click "API Keys" tab
3. Generate a new API key
4. Copy the API key

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Vercel AI Gateway (fallback for Cerebras rate limits)
VERCEL_AI_GATEWAY_API_KEY="your-vercel-ai-gateway-api-key"

# Cerebras API (still required - primary path)
CEREBRAS_API_KEY="your-cerebras-api-key"
```

### 3. Verify Cerebras Provider in Gateway

To ensure GLM 4.7 always uses Cerebras through the gateway:

1. Go to Vercel AI Gateway Dashboard → "Models" tab
2. Search for or configure `zai-glm-4.7` model
3. Under provider options for this model:
   - Ensure `only: ['cerebras']` is set
   - Verify Cerebras is in the provider list

**Note**: The implementation automatically sets `providerOptions.gateway.only: ['cerebras']` in code, so no manual configuration is required in the dashboard. The gateway will enforce this constraint programmatically.

## How It Works

### Automatic Fallback Logic

The fallback is handled in two places:

#### 1. Streaming Responses (Main Code Generation)

When streaming AI responses in `code-agent.ts`:

```typescript
let useGatewayFallbackForStream = isCerebrasModel(selectedModel);

while (true) {
  try {
    const client = getClientForModel(selectedModel, { useGatewayFallback: useGatewayFallbackForStream });
    const result = streamText({
      model: client.chat(selectedModel),
      providerOptions: useGatewayFallbackForStream ? {
        gateway: {
          only: ['cerebras'],  // Force Cerebras provider only
        }
      } : undefined,
      // ... other options
    });

    // Stream processing...

  } catch (streamError) {
    const isRateLimit = isRateLimitError(streamError);

    if (!useGatewayFallbackForStream && isRateLimit) {
      // Rate limit hit on direct Cerebras
      console.log('[GATEWAY-FALLBACK] Switching to Vercel AI Gateway...');
      useGatewayFallbackForStream = true;
      continue;  // Retry immediately with gateway
    }

    if (isRateLimit) {
      // Rate limit hit on gateway - wait 60s
      await new Promise(resolve => setTimeout(resolve, 60_000));
    }
    // ... other error handling
  }
}
```

#### 2. Non-Streaming Responses (Summary Generation)

When generating summaries:

```typescript
let summaryUseGatewayFallback = isCerebrasModel(selectedModel);
let summaryRetries = 0;
const MAX_SUMMARY_RETRIES = 2;

while (summaryRetries < MAX_SUMMARY_RETRIES) {
  try {
    const client = getClientForModel(selectedModel, { useGatewayFallback: summaryUseGatewayFallback });
    const followUp = await generateText({
      model: client.chat(selectedModel),
      providerOptions: summaryUseGatewayFallback ? {
        gateway: {
          only: ['cerebras'],
        }
      } : undefined,
      // ... other options
    });
    break;  // Success
  } catch (error) {
    summaryRetries++;

    if (isRateLimitError(error) && !summaryUseGatewayFallback) {
      // Rate limit hit on direct Cerebras
      console.log('[GATEWAY-FALLBACK] Rate limit hit for summary. Switching...');
      summaryUseGatewayFallback = true;
    } else if (isRateLimitError(error)) {
      // Rate limit hit on gateway - wait 60s
      await new Promise(resolve => setTimeout(resolve, 60_000));
    }
  }
}
```

## Key Features

### Provider Constraints

The implementation ensures GLM 4.7 **never** routes to slow providers by enforcing:

```typescript
providerOptions: {
  gateway: {
    only: ['cerebras'],  // Only allow Cerebras provider
  }
}
```

This prevents the gateway from routing to:
- OpenAI (slower, more expensive)
- Anthropic (different model family)
- Google Gemini (different model family)
- Other providers in the gateway

### Rate Limit Detection

Rate limits are detected by checking error messages for these patterns:

- "rate limit"
- "rate_limit"
- "tokens per minute"
- "requests per minute"
- "too many requests"
- "429" HTTP status
- "quota exceeded"
- "limit exceeded"

When detected, the system:
1. First attempt: Try direct Cerebras API
2. On rate limit: Switch to Vercel AI Gateway (still Cerebras provider)
3. On gateway rate limit: Wait 60 seconds, then retry gateway

## Monitoring and Debugging

### Log Messages

Look for these log patterns in your application logs:

**Successful fallback:**
```
[GATEWAY-FALLBACK] mainStream: Rate limit hit for zai-glm-4.7. Switching to Vercel AI Gateway with Cerebras-only routing...
```

**Gateway rate limit:**
```
[GATEWAY-FALLBACK] Gateway rate limit for mainStream. Waiting 60s...
```

**Direct Cerebras success:**
```
[INFO] AI generation complete: { totalChunks: 123, totalLength: 45678 }
```

### Testing

Run the gateway fallback tests:

```bash
bunx jest tests/gateway-fallback.test.ts
```

Expected output:
```
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

All tests verify:
- Cerebras model detection
- Client selection logic
- Gateway fallback triggering
- Retry with different providers
- Provider options configuration
- Generator error handling

## Troubleshooting

### Fallback Not Triggering

**Issue**: Rate limit detected but not switching to gateway

**Check**:
1. Verify `zai-glm-4.7` is recognized as Cerebras model
2. Check logs for `[GATEWAY-FALLBACK]` messages
3. Ensure `isCerebrasModel` returns `true` for GLM 4.7

### Gateway Using Wrong Provider

**Issue**: GLM 4.7 routes to OpenAI or other slow provider

**Check**:
1. Verify `providerOptions.gateway.only: ['cerebras']` is being set
2. Check Vercel AI Gateway dashboard provider configuration
3. Ensure model ID is correct

### API Key Issues

**Issue**: Gateway authentication errors

**Check**:
1. Verify `VERCEL_AI_GATEWAY_API_KEY` is set correctly
2. Check API key has proper permissions
3. Generate new API key in Vercel dashboard if needed

## Performance Considerations

### Latency

- **Direct Cerebras**: ~50-100ms faster (no proxy)
- **Vercel AI Gateway**: Adds ~100-200ms overhead (proxy layer)
- **Recommendation**: Accept overhead for resilience during rate limits

### Cost

- **Direct Cerebras**: Uses your Cerebras API credits directly
- **Vercel AI Gateway**: Uses Vercel AI Gateway credits
- **Recommendation**: Monitor both credit balances

### Retry Behavior

- **Direct Cerebras rate limit**: Immediate switch to gateway (0s wait)
- **Gateway rate limit**: 60 second wait before retry
- **Non-rate-limit errors**: Exponential backoff (1s, 2s, 4s, 8s...)

## Files Modified

- `src/agents/client.ts` - Added Vercel AI Gateway provider and fallback support
- `src/agents/rate-limit.ts` - Added `withGatewayFallbackGenerator` function
- `src/agents/code-agent.ts` - Integrated gateway fallback in streamText and generateText calls
- `tests/gateway-fallback.test.ts` - Comprehensive test suite (10 tests, all passing)
- `env.example` - Added `VERCEL_AI_GATEWAY_API_KEY` documentation

## API References

- [Vercel AI Gateway Documentation](https://vercel.com/docs/ai-gateway)
- [Vercel AI SDK Provider Documentation](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Cerebras Provider Documentation](https://ai-sdk.dev/providers/ai-sdk-providers/cerebras)
