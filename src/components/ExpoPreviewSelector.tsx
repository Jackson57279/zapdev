'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { checkWebContainerSupport, type BrowserCapabilities } from '@/lib/browser-capabilities';

export type ExpoPreviewMode = 'web' | 'expo-go' | 'android-emulator' | 'eas-build';
export type UserTier = 'free' | 'pro' | 'enterprise';
export type RuntimeType = 'webcontainer' | 'e2b';

interface PreviewOption {
  mode: ExpoPreviewMode;
  title: string;
  description: string;
  badge?: string;
  buildTime: string;
  tier: UserTier;
  icon: string;
  runtime: RuntimeType;
}

const PREVIEW_OPTIONS: PreviewOption[] = [
  {
    mode: 'web',
    title: 'Web Preview',
    description: 'Instant preview in browser via WebContainers',
    buildTime: '~10 seconds',
    tier: 'free',
    icon: '🌐',
    runtime: 'webcontainer'
  },
  {
    mode: 'expo-go',
    title: 'Expo Go (QR Code)',
    description: 'Test on real device via Expo Go app',
    buildTime: '~1-2 minutes',
    tier: 'free',
    icon: '📱',
    runtime: 'e2b'
  },
  {
    mode: 'android-emulator',
    title: 'Android Emulator',
    description: 'Full Android emulator with VNC access',
    badge: 'Pro',
    buildTime: '~3-5 minutes',
    tier: 'pro',
    icon: '🤖',
    runtime: 'e2b'
  },
  {
    mode: 'eas-build',
    title: 'EAS Build (Production)',
    description: 'Cloud builds for App Store/Play Store',
    badge: 'Pro',
    buildTime: '~5-15 minutes',
    tier: 'pro',
    icon: '🚀',
    runtime: 'e2b'
  }
];

interface ExpoPreviewSelectorProps {
  onSelect: (mode: ExpoPreviewMode, runtime: RuntimeType) => void;
  userTier?: UserTier;
  selectedMode?: ExpoPreviewMode;
  className?: string;
}

export function ExpoPreviewSelector({
  onSelect,
  userTier = 'free',
  selectedMode,
  className
}: ExpoPreviewSelectorProps) {
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities | null>(null);

  useEffect(() => {
    setBrowserCapabilities(checkWebContainerSupport());
  }, []);

  // Use selectedMode directly as controlled component
  const selected = selectedMode ?? 'web';

  const handleSelect = (mode: ExpoPreviewMode) => {
    const option = PREVIEW_OPTIONS.find(o => o.mode === mode);
    if (!option) return;
    
    const tierOrder: Record<UserTier, number> = { free: 0, pro: 1, enterprise: 2 };
    const isLocked = tierOrder[userTier] < tierOrder[option.tier];
    
    const webContainerUnavailable = 
      option.runtime === 'webcontainer' && 
      browserCapabilities && 
      !browserCapabilities.isSupported;
    
    if (!isLocked) {
      const actualRuntime = webContainerUnavailable ? 'e2b' : option.runtime;
      onSelect(mode, actualRuntime);
    }
  };

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      {PREVIEW_OPTIONS.map((option) => {
        const tierOrder: Record<UserTier, number> = { free: 0, pro: 1, enterprise: 2 };
        const isLocked = tierOrder[userTier] < tierOrder[option.tier];
        const isSelected = selected === option.mode;
        const isWebContainer = option.runtime === 'webcontainer';
        const webContainerSupported = browserCapabilities?.isSupported ?? false;

        return (
          <Card
            key={option.mode}
            className={cn(
              'cursor-pointer transition-all duration-200',
              isSelected && 'ring-2 ring-primary bg-primary/5',
              isLocked && 'opacity-60 cursor-not-allowed',
              !isLocked && !isSelected && 'hover:bg-muted/50'
            )}
            onClick={() => handleSelect(option.mode)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{option.icon}</span>
                  <h4 className="font-semibold text-sm">{option.title}</h4>
                </div>
                <div className="flex gap-1">
                  {isWebContainer && webContainerSupported && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      Instant
                    </Badge>
                  )}
                  {isWebContainer && !webContainerSupported && browserCapabilities && (
                    <Badge variant="outline" className="text-xs">
                      Cloud
                    </Badge>
                  )}
                  {option.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {option.badge}
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge variant="outline" className="text-xs">
                      🔒
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {isWebContainer && !webContainerSupported && browserCapabilities
                  ? 'Preview via cloud sandbox (WebContainers unavailable)'
                  : option.description}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Build time: {option.buildTime}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ExpoPreviewInfo({ mode }: { mode: ExpoPreviewMode }) {
  const option = PREVIEW_OPTIONS.find(o => o.mode === mode);
  if (!option) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{option.icon}</span>
      <span>{option.title}</span>
      <span className="text-xs">({option.buildTime})</span>
    </div>
  );
}

export { PREVIEW_OPTIONS };
