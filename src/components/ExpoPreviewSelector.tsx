'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ExpoPreviewMode = 'web' | 'expo-go' | 'android-emulator' | 'eas-build';
export type UserTier = 'free' | 'pro' | 'enterprise';

interface PreviewOption {
  mode: ExpoPreviewMode;
  title: string;
  description: string;
  badge?: string;
  buildTime: string;
  tier: UserTier;
  icon: string;
}

const PREVIEW_OPTIONS: PreviewOption[] = [
  {
    mode: 'web',
    title: 'Web Preview',
    description: 'Fastest preview using react-native-web',
    buildTime: '~30 seconds',
    tier: 'free',
    icon: '🌐'
  },
  {
    mode: 'expo-go',
    title: 'Expo Go (QR Code)',
    description: 'Test on real device via Expo Go app',
    buildTime: '~1-2 minutes',
    tier: 'free',
    icon: '📱'
  },
  {
    mode: 'android-emulator',
    title: 'Android Emulator',
    description: 'Full Android emulator with VNC access',
    badge: 'Pro',
    buildTime: '~3-5 minutes',
    tier: 'pro',
    icon: '🤖'
  },
  {
    mode: 'eas-build',
    title: 'EAS Build (Production)',
    description: 'Cloud builds for App Store/Play Store',
    badge: 'Pro',
    buildTime: '~5-15 minutes',
    tier: 'pro',
    icon: '🚀'
  }
];

interface ExpoPreviewSelectorProps {
  onSelect: (mode: ExpoPreviewMode) => void;
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
  const [selected, setSelected] = useState<ExpoPreviewMode>(selectedMode ?? 'web');

  const handleSelect = (mode: ExpoPreviewMode) => {
    const option = PREVIEW_OPTIONS.find(o => o.mode === mode);
    if (!option) return;
    
    const tierOrder: Record<UserTier, number> = { free: 0, pro: 1, enterprise: 2 };
    const isLocked = tierOrder[userTier] < tierOrder[option.tier];
    
    if (!isLocked) {
      setSelected(mode);
      onSelect(mode);
    }
  };

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      {PREVIEW_OPTIONS.map((option) => {
        const tierOrder: Record<UserTier, number> = { free: 0, pro: 1, enterprise: 2 };
        const isLocked = tierOrder[userTier] < tierOrder[option.tier];
        const isSelected = selected === option.mode;

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
                {option.description}
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
