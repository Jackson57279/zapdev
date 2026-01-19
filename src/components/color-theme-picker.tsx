"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useColorTheme } from "@/components/color-theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ColorThemePicker() {
  const { colorThemeId, setColorTheme, availableThemes } = useColorTheme();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-2 p-1">
        {availableThemes.map((theme) => {
          const isSelected = theme.id === colorThemeId;
          const previewColor = isDark ? theme.preview.dark : theme.preview.light;

          return (
            <Tooltip key={theme.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setColorTheme(theme.id)}
                  className={cn(
                    "relative size-7 rounded-full transition-all",
                    "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: previewColor }}
                  aria-label={`Select ${theme.name} theme`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <Check
                      className="absolute inset-0 m-auto size-4 text-white drop-shadow-md"
                      strokeWidth={3}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{theme.name}</p>
                <p className="text-muted-foreground">{theme.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
