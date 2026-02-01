import QRCode from 'qrcode';

/**
 * Generate a QR code for Expo Go app to scan
 * @param sandboxUrl The sandbox URL (e.g., https://8081-abc123.e2b.dev)
 * @returns Base64 data URL of the QR code image
 */
export async function generateExpoGoQR(sandboxUrl: string): Promise<string> {
  try {
    // Expo Go expects exp:// protocol URLs
    const url = new URL(sandboxUrl);
    const expoUrl = `exp://${url.host}`;
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(expoUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    console.log(`[INFO] Generated Expo Go QR code for: ${expoUrl}`);
    return qrDataUrl;
  } catch (error) {
    console.error('[ERROR] Failed to generate Expo Go QR code:', error);
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the official Expo QR code service URL
 * This uses Expo's hosted service to generate QR codes
 * @param sandboxUrl The sandbox URL
 * @returns URL to Expo's QR code service
 */
export function getExpoOfficialQRUrl(sandboxUrl: string): string {
  const encodedUrl = encodeURIComponent(sandboxUrl);
  return `https://qr.expo.dev/development-client?url=${encodedUrl}`;
}

/**
 * Generate QR code for EAS Update (for production apps)
 * @param projectId Expo project ID
 * @param channel Update channel (e.g., 'preview', 'production')
 * @param runtimeVersion The runtime version
 * @returns URL to Expo's QR code service for the update
 */
export function getEASUpdateQRUrl(
  projectId: string,
  channel: string = 'preview',
  runtimeVersion?: string
): string {
  let url = `https://qr.expo.dev/eas-update?projectId=${encodeURIComponent(projectId)}&channel=${encodeURIComponent(channel)}`;
  if (runtimeVersion) {
    url += `&runtimeVersion=${encodeURIComponent(runtimeVersion)}`;
  }
  return url;
}

/**
 * Generate a deep link URL for Expo Go
 * @param sandboxUrl The sandbox URL
 * @returns Deep link URL that opens in Expo Go
 */
export function getExpoGoDeepLink(sandboxUrl: string): string {
  const url = new URL(sandboxUrl);
  return `exp://${url.host}`;
}

/**
 * Check if a URL is accessible (for Expo Go tunnel)
 * @param url The URL to check
 * @returns Whether the URL is accessible
 */
export async function checkUrlAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
