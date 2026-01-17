# WebContainers Migration Guide

## Overview

ZapDev now supports a **hybrid runtime architecture** using both WebContainers (browser-based) and E2B (cloud-based) for optimal performance and cost efficiency.

## Architecture

```
User Request
     │
     ▼
┌─────────────────────────────────────┐
│       Runtime Selector              │
│  (src/agents/runtime-selector.ts)   │
└─────────────────────────────────────┘
     │                    │
     ▼                    ▼
┌──────────────┐    ┌──────────────┐
│ WebContainers│    │     E2B      │
│  (Browser)   │    │   (Cloud)    │
│              │    │              │
│ - Instant    │    │ - Full Linux │
│ - Zero cost  │    │ - Native     │
│ - Web only   │    │   builds     │
└──────────────┘    └──────────────┘
```

## When Each Runtime is Used

### WebContainers (Browser-based)
- **Frameworks**: Next.js, React, Vue, Svelte, Angular
- **Expo**: Web preview mode only
- **Use case**: Instant preview and iteration
- **Benefits**: Zero server compute costs, ~10ms startup

### E2B (Cloud-based)
- **Expo**: expo-go, android-emulator, eas-build modes
- **Native builds**: iOS/Android compilation via EAS
- **Use case**: Full development environment
- **Benefits**: Full Linux OS, persistent filesystem

## Key Files

| File | Purpose |
|------|---------|
| `src/agents/webcontainer-utils.ts` | WebContainer abstraction layer |
| `src/agents/runtime-selector.ts` | Smart runtime selection logic |
| `src/lib/browser-capabilities.ts` | Browser feature detection |
| `src/proxy.ts` | Cross-Origin Isolation headers |
| `src/components/ExpoPreviewSelector.tsx` | UI for preview mode selection |

## Browser Requirements

WebContainers require these browser features:
- SharedArrayBuffer support
- Cross-Origin Isolation (COOP/COEP headers)

Supported browsers:
- Chrome/Chromium: Full support (Chrome 68+)
- Edge: Full support
- Safari: Beta support (16.4+)
- Firefox: Beta support (79+)
- Mobile: Limited support

## Environment Variables

```bash
# E2B (Cloud-based sandboxes)
E2B_API_KEY=""

# Expo EAS (Native mobile builds)
EXPO_ACCESS_TOKEN=""
```

## API Endpoints

### POST /api/expo/build
Queue an EAS build for iOS/Android.

```json
{
  "platform": "ios" | "android" | "all",
  "projectId": "string",
  "fragmentId": "string (optional)",
  "profile": "preview" | "production"
}
```

### GET /api/expo/build?buildId=xxx
Check build status.

## Schema Changes

The `sandboxSessions` table now includes:
- `runtimeType`: "webcontainer" | "e2b"

## Migration Notes

1. The middleware adds COOP/COEP headers for WebContainer support
2. The runtime selector automatically chooses the best runtime
3. E2B remains available as a fallback when WebContainers are unavailable
4. Expo web preview uses WebContainers for instant feedback
5. Native builds always use E2B + EAS
