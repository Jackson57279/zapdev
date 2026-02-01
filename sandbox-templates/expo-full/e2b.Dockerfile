# Expo Full Template (Web + Expo Go support with tunnel)
FROM node:21-slim

RUN apt-get update && apt-get install -y curl git qrencode && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user

# Create Expo app with TypeScript blank template
RUN bunx create-expo-app@latest . --template blank-typescript --yes

# Install web dependencies
RUN bun add react-dom react-native-web @expo/metro-runtime

# Install common Expo SDK modules
RUN bunx expo install expo-font expo-linear-gradient expo-blur expo-status-bar expo-camera expo-image-picker expo-location expo-haptics

# Install Expo CLI globally for tunnel support
RUN bun add -g @expo/cli eas-cli

WORKDIR /home/user

# Keep container idle - dev servers are started by agents when needed
CMD ["bash"]
