# Expo Web Preview Template
FROM node:21-slim

RUN apt-get update && apt-get install -y curl git && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user

# Create Expo app with TypeScript blank template
RUN npx create-expo-app@latest . --template blank-typescript --yes

# Install web dependencies
RUN npm install react-dom react-native-web @expo/metro-runtime

# Install common Expo SDK modules
RUN npx expo install expo-font expo-linear-gradient expo-blur expo-status-bar

WORKDIR /home/user

# Start Metro bundler for web on port 8081
CMD ["npx", "expo", "start", "--web", "--port", "8081", "--host", "0.0.0.0"]
