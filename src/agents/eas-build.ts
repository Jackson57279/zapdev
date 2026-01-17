import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, runCodeCommand, writeFilesBatch } from "./sandbox-utils";

export interface EASBuildConfig {
  platform: 'android' | 'ios' | 'all';
  profile: 'development' | 'preview' | 'production';
  expoToken?: string;
}

export interface EASBuildResult {
  buildId: string;
  buildUrl: string;
  platform: string;
  status: 'pending' | 'in-queue' | 'in-progress' | 'finished' | 'errored' | 'canceled';
}

export interface EASBuildStatus {
  status: 'pending' | 'in-queue' | 'in-progress' | 'finished' | 'errored' | 'canceled';
  downloadUrl?: string;
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
  };
  error?: string;
}

/**
 * Initialize EAS in a sandbox (creates eas.json if it doesn't exist)
 */
export async function initializeEAS(sandbox: Sandbox): Promise<void> {
  console.log('[INFO] Initializing EAS configuration...');
  
  const checkResult = await runCodeCommand(sandbox, 'test -f eas.json && echo "exists"');
  const filesToWrite: Record<string, string> = {};
  
  if (!checkResult.stdout.includes('exists')) {
    const easConfig = {
      cli: {
        version: ">= 13.0.0"
      },
      build: {
        development: {
          developmentClient: true,
          distribution: "internal"
        },
        preview: {
          distribution: "internal",
          android: {
            buildType: "apk"
          }
        },
        production: {
          autoIncrement: true
        }
      },
      submit: {
        production: {}
      }
    };
    
    filesToWrite['/home/user/eas.json'] = JSON.stringify(easConfig, null, 2);
    console.log('[INFO] Prepared eas.json configuration');
  }
  
  try {
    const appJsonContent = await sandbox.files.read('/home/user/app.json');
    if (typeof appJsonContent === 'string') {
      const appJson = JSON.parse(appJsonContent);
      
      if (!appJson.expo) appJson.expo = {};
      if (!appJson.expo.slug) appJson.expo.slug = 'zapdev-app';
      if (!appJson.expo.name) appJson.expo.name = 'ZapDev App';
      if (!appJson.expo.version) appJson.expo.version = '1.0.0';
      
      if (!appJson.expo.extra) appJson.expo.extra = {};
      if (!appJson.expo.extra.eas) appJson.expo.extra.eas = {};
      
      filesToWrite['/home/user/app.json'] = JSON.stringify(appJson, null, 2);
      console.log('[INFO] Prepared app.json for EAS compatibility');
    }
  } catch (error) {
    console.warn('[WARN] Could not update app.json:', error);
  }
  
  if (Object.keys(filesToWrite).length > 0) {
    await writeFilesBatch(sandbox, filesToWrite);
    console.log('[INFO] Batch wrote EAS configuration files');
  }
}

/**
 * Trigger an EAS Build
 */
export async function triggerEASBuild(
  sandboxId: string,
  config: EASBuildConfig
): Promise<EASBuildResult> {
  const sandbox = await getSandbox(sandboxId);
  const expoToken = config.expoToken || process.env.EXPO_ACCESS_TOKEN;
  
  if (!expoToken) {
    throw new Error('EXPO_ACCESS_TOKEN is required for EAS builds. Set it in environment variables.');
  }
  
  // Initialize EAS if needed
  await initializeEAS(sandbox);
  
  console.log(`[INFO] Triggering EAS build for platform: ${config.platform}, profile: ${config.profile}`);
  
  const buildCommand = `npx eas-cli build --platform ${config.platform} --profile ${config.profile} --non-interactive --json --no-wait`;
  
  const result = await runCodeCommand(sandbox, buildCommand, {
    EXPO_TOKEN: expoToken
  });
  
  if (result.exitCode !== 0) {
    console.error('[ERROR] EAS build command failed:', result.stderr);
    throw new Error(`EAS build failed: ${result.stderr || result.stdout}`);
  }
  
  try {
    // Parse the JSON output from EAS CLI
    const output = result.stdout.trim();
    const jsonMatch = output.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse EAS build output');
    }
    
    const buildData = JSON.parse(jsonMatch[0]);
    const build = Array.isArray(buildData) ? buildData[0] : buildData;
    
    return {
      buildId: build.id,
      buildUrl: `https://expo.dev/accounts/${build.accountName || 'user'}/projects/${build.projectId || 'project'}/builds/${build.id}`,
      platform: build.platform || config.platform,
      status: build.status || 'pending'
    };
  } catch (parseError) {
    console.error('[ERROR] Failed to parse EAS build output:', result.stdout);
    throw new Error(`Failed to parse EAS build response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

/**
 * Check the status of an EAS build
 */
export async function checkEASBuildStatus(
  buildId: string,
  expoToken?: string
): Promise<EASBuildStatus> {
  const token = expoToken || process.env.EXPO_ACCESS_TOKEN;
  
  if (!token) {
    throw new Error('EXPO_ACCESS_TOKEN is required to check build status');
  }
  
  try {
    const response = await fetch(`https://api.expo.dev/v2/builds/${buildId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch build status: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      status: data.status,
      downloadUrl: data.artifacts?.buildUrl || data.artifacts?.applicationArchiveUrl,
      artifacts: data.artifacts,
      error: data.error
    };
  } catch (error) {
    console.error('[ERROR] Failed to check EAS build status:', error);
    throw new Error(`Failed to check build status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Poll for EAS build completion
 */
export async function waitForEASBuild(
  buildId: string,
  expoToken?: string,
  maxWaitMs: number = 15 * 60 * 1000, // 15 minutes default
  pollIntervalMs: number = 10000 // 10 seconds
): Promise<EASBuildStatus> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkEASBuildStatus(buildId, expoToken);
    
    if (status.status === 'finished') {
      console.log(`[INFO] EAS build ${buildId} completed successfully`);
      return status;
    }
    
    if (status.status === 'errored' || status.status === 'canceled') {
      console.error(`[ERROR] EAS build ${buildId} failed with status: ${status.status}`);
      throw new Error(`EAS build failed: ${status.error || status.status}`);
    }
    
    console.log(`[DEBUG] EAS build ${buildId} status: ${status.status}`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  throw new Error(`EAS build timed out after ${maxWaitMs / 1000} seconds`);
}

/**
 * Get the download URL for a completed build
 */
export async function getEASBuildDownloadUrl(
  buildId: string,
  expoToken?: string
): Promise<string | null> {
  const status = await checkEASBuildStatus(buildId, expoToken);
  
  if (status.status !== 'finished') {
    return null;
  }
  
  return status.downloadUrl || null;
}

/**
 * Cancel an in-progress EAS build
 */
export async function cancelEASBuild(
  buildId: string,
  expoToken?: string
): Promise<boolean> {
  const token = expoToken || process.env.EXPO_ACCESS_TOKEN;
  
  if (!token) {
    throw new Error('EXPO_ACCESS_TOKEN is required to cancel a build');
  }
  
  try {
    const response = await fetch(`https://api.expo.dev/v2/builds/${buildId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('[ERROR] Failed to cancel EAS build:', error);
    return false;
  }
}
