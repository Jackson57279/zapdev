# Expo Android Emulator Template with VNC
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install base dependencies
RUN apt-get update && apt-get install -y \
    curl wget git unzip openjdk-17-jdk \
    x11vnc xvfb fluxbox \
    qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils \
    supervisor \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js 21
RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash - \
    && apt-get install -y nodejs

# Set up Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && cd $ANDROID_HOME/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip \
    && unzip -q cmdline-tools.zip \
    && mv cmdline-tools latest \
    && rm cmdline-tools.zip

# Accept licenses and install Android SDK components
RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true
RUN sdkmanager "platform-tools" "platforms;android-34" "emulator" "system-images;android-34;google_apis;x86_64"

# Create AVD (Android Virtual Device)
RUN echo no | avdmanager create avd -n expo_emulator -k "system-images;android-34;google_apis;x86_64" --force

WORKDIR /home/user

# Create Expo project
RUN npx create-expo-app@latest . --template blank-typescript --yes

# Install dependencies
RUN npm install react-dom react-native-web @expo/metro-runtime
RUN npx expo install expo-font expo-linear-gradient expo-blur expo-status-bar expo-camera expo-image-picker expo-location expo-haptics

# Install global tools
RUN npm install -g @expo/cli eas-cli

# Copy start script
COPY start_android.sh /start_android.sh
RUN chmod +x /start_android.sh

# Expose ports: VNC(5900), ADB(5555), Metro(8081), Expo(19000-19002)
EXPOSE 5900 5555 8081 19000 19001 19002

CMD ["/start_android.sh"]
