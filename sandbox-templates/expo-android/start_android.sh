#!/bin/bash

# Start virtual display
echo "[INFO] Starting virtual display..."
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99

# Wait for Xvfb to start
sleep 2

# Start window manager
echo "[INFO] Starting window manager..."
fluxbox &

# Generate VNC password if not exists
VNC_PASSWD_FILE="/home/user/.vnc_passwd"
if [ ! -f "$VNC_PASSWD_FILE" ]; then
    echo "vncpasswd" | head -1 > "$VNC_PASSWD_FILE" 2>/dev/null || true
fi

# Start VNC server with password authentication
echo "[INFO] Starting VNC server on port 5900..."
if [ -f "$VNC_PASSWD_FILE" ]; then
    x11vnc -display :99 -forever -shared -rfbport 5900 -rfbauth "$VNC_PASSWD_FILE" &
else
    echo "[WARN] VNC password file not found, starting without authentication"
    x11vnc -display :99 -forever -shared -rfbport 5900 &
fi

# Wait for display services
sleep 2

# Start Android emulator
echo "[INFO] Starting Android emulator..."
$ANDROID_HOME/emulator/emulator -avd expo_emulator \
    -no-audio \
    -no-boot-anim \
    -gpu swiftshader_indirect \
    -no-snapshot \
    -memory 2048 \
    -cores 2 &

# Wait for emulator to boot
echo "[INFO] Waiting for emulator to boot..."
adb wait-for-device

# Wait for boot completion
echo "[INFO] Waiting for boot completion..."
while [[ -z $(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') ]]; do
    sleep 2
done

echo "[INFO] Emulator ready!"

# Start Expo Metro bundler with Android
cd /home/user
echo "[INFO] Starting Expo development server..."
npx expo start --android --port 8081 --host 0.0.0.0
