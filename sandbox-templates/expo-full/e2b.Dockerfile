# Expo Full Template (Web + Expo Go support with tunnel)
FROM node:21-slim

RUN apt-get update && apt-get install -y curl git qrencode && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user

# Create Expo app with TypeScript blank template
RUN npx create-expo-app@latest . --template blank-typescript --yes

# Install web dependencies
RUN npm install react-dom react-native-web @expo/metro-runtime

# Install common Expo SDK modules
RUN npx expo install expo-font expo-linear-gradient expo-blur expo-status-bar expo-camera expo-image-picker expo-location expo-haptics

# Install Expo CLI globally for tunnel support
RUN npm install -g @expo/cli eas-cli

WORKDIR /home/user

# Start Metro bundler with tunnel for Expo Go access
CMD ["npx", "expo", "start", "--port", "8081", "--host", "0.0.0.0", "--tunnel"]
