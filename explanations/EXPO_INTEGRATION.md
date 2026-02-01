# Expo/React Native Integration

ZapDev supports Expo/React Native for cross-platform mobile app development with multiple preview modes.

## Overview

Expo enables building iOS, Android, and web apps from a single codebase using React Native. ZapDev integrates Expo with 4 distinct preview modes to support different development and testing scenarios.

## Preview Modes

### 1. Web Preview (Free Tier)
- **Speed:** ~30 seconds
- **Description:** Uses `react-native-web` for fast browser-based preview
- **Limitations:** No native APIs (camera, location, haptics, etc.)
- **Best for:** Quick prototyping, UI development, web-compatible features

### 2. Expo Go QR Code (Free Tier)
- **Speed:** ~1-2 minutes
- **Description:** Generate a QR code that users scan with the Expo Go app
- **Limitations:** Limited to Expo SDK modules, no custom native code
- **Best for:** Real device testing, sharing demos with stakeholders

### 3. Android Emulator (Pro Tier)
- **Speed:** ~3-5 minutes
- **Description:** Full Android emulator running in E2B with VNC access
- **Limitations:** Requires Pro subscription, higher resource usage
- **Best for:** Full Android testing, GPU-dependent features, native APIs

### 4. EAS Build (Pro Tier)
- **Speed:** ~5-15 minutes
- **Description:** Cloud builds via Expo Application Services
- **Output:** Installable APK (Android) or IPA (iOS) files
- **Best for:** Production releases, App Store/Play Store submissions

## Framework Detection

ZapDev automatically detects Expo projects from user prompts containing:
- "mobile app", "iOS", "Android"
- "React Native", "Expo"
- "cross-platform", "native app"
- "phone app"

## AI Prompt Guidelines

When generating Expo code, the AI follows these rules:

1. **Components:** Use React Native components (View, Text, TouchableOpacity, etc.)
2. **Styling:** Use `StyleSheet.create()` - NO CSS files, NO className, NO Tailwind
3. **Imports:** `import { View, Text } from 'react-native'`
4. **Entry Point:** `App.tsx` as the root component
5. **Navigation:** Use `expo-router` for multi-screen apps

### Example Component

```tsx
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello Expo</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Press Me</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Expo SDK Modules

### Pre-installed (All Templates)
- `expo-status-bar` - Status bar control
- `expo-font` - Custom fonts
- `expo-linear-gradient` - Gradient backgrounds
- `expo-blur` - Blur effects

### Available via `npx expo install`
- `expo-camera` - Camera access
- `expo-image-picker` - Photo library/camera capture
- `expo-location` - GPS/location
- `expo-haptics` - Haptic feedback
- `expo-notifications` - Push notifications
- `expo-file-system` - File operations
- `expo-av` - Audio/video playback
- `expo-sensors` - Accelerometer, gyroscope
- `expo-secure-store` - Secure storage
- `expo-sqlite` - Local database

## Web Compatibility

When using Web Preview mode, these components are **NOT available**:
- `expo-camera`
- `expo-location`
- `expo-haptics`
- `expo-sensors`
- `expo-notifications` (limited)
- `expo-secure-store`

### Web Alternatives
- **Camera:** Use `<input type="file" accept="image/*" capture>`
- **Location:** Use `navigator.geolocation`
- **Storage:** Use AsyncStorage or localStorage

## E2B Sandbox Templates

### zapdev-expo-web
- Base: `node:21-slim`
- Pre-installed: react-native-web, @expo/metro-runtime
- Port: 8081 (Metro bundler)
- Command: `npx expo start --web`

### zapdev-expo-full
- Base: `node:21-slim`
- Pre-installed: All Expo SDK modules
- Port: 8081 (with tunnel for Expo Go)
- Command: `npx expo start --tunnel`

### zapdev-expo-android
- Base: `ubuntu:22.04`
- Includes: Android SDK, emulator, VNC server
- Ports: 5900 (VNC), 8081 (Metro), 5555 (ADB)
- Resources: 4 vCPU, 8GB RAM

## Subscription Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Web Preview | ✅ | ✅ | ✅ |
| Expo Go (QR) | ✅ | ✅ | ✅ |
| Android Emulator | ❌ | ✅ | ✅ |
| EAS Build | ❌ | ✅ | ✅ |
| Max Builds/Day | 5 | 50 | 500 |
| Emulator Minutes/Day | 0 | 120 | 600 |

## Environment Variables

For EAS Build support, add to `.env`:
```bash
EXPO_ACCESS_TOKEN=your_expo_token_here
```

Get your token from: https://expo.dev/settings/access-tokens

## Troubleshooting

### Web Preview Shows Blank Screen
- Ensure you're using web-compatible components
- Check console for `react-native-web` errors
- Avoid native-only modules

### Expo Go QR Not Working
- Verify tunnel is running (`--tunnel` flag)
- Check network connectivity
- Ensure Expo Go app is up to date

### Android Emulator Not Starting
- Requires Pro tier subscription
- VNC may take 30-60s to initialize
- Check if KVM is available on E2B

### EAS Build Failing
- Verify `EXPO_ACCESS_TOKEN` is set
- Check `eas.json` configuration
- Ensure `app.json` has required fields (slug, version)

## Example Prompts

1. "Build a mobile todo app for iOS and Android"
2. "Create a React Native camera app"
3. "Make a cross-platform fitness tracker"
4. "Build an Expo app with location tracking"
5. "Create a mobile social media feed"

## Related Documentation

- [Expo Official Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [E2B Expo Template](https://e2b.dev/docs/template/examples/expo)
