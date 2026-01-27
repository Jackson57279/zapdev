export type ColorTheme = {
  id: string;
  name: string;
  description: string;
  preview: {
    light: string;
    dark: string;
  };
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
};

export type ThemeColors = {
  primary: string;
  primaryForeground: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart5: string;
  sidebarPrimary: string;
};

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "default",
    name: "Default",
    description: "Warm orange tones",
    preview: {
      light: "oklch(0.6171 0.1375 39.0427)",
      dark: "oklch(0.6724 0.1308 38.7559)",
    },
    colors: {
      light: {
        primary: "oklch(0.6171 0.1375 39.0427)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5937 0.1673 253.0630)",
        chart1: "oklch(0.5583 0.1276 42.9956)",
        chart2: "oklch(0.6898 0.1581 290.4107)",
        chart5: "oklch(0.5608 0.1348 42.0584)",
        sidebarPrimary: "oklch(0.6171 0.1375 39.0427)",
      },
      dark: {
        primary: "oklch(0.6724 0.1308 38.7559)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5937 0.1673 253.0630)",
        chart1: "oklch(0.5583 0.1276 42.9956)",
        chart2: "oklch(0.6898 0.1581 290.4107)",
        chart5: "oklch(0.5608 0.1348 42.0584)",
        sidebarPrimary: "oklch(0.3250 0 0)",
      },
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Calm blue tones",
    preview: {
      light: "oklch(0.5500 0.1500 240)",
      dark: "oklch(0.6200 0.1400 240)",
    },
    colors: {
      light: {
        primary: "oklch(0.5500 0.1500 240)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5500 0.1500 240)",
        chart1: "oklch(0.5000 0.1400 230)",
        chart2: "oklch(0.6500 0.1200 250)",
        chart5: "oklch(0.4500 0.1600 220)",
        sidebarPrimary: "oklch(0.5500 0.1500 240)",
      },
      dark: {
        primary: "oklch(0.6200 0.1400 240)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.6200 0.1400 240)",
        chart1: "oklch(0.5500 0.1300 230)",
        chart2: "oklch(0.7000 0.1100 250)",
        chart5: "oklch(0.5000 0.1500 220)",
        sidebarPrimary: "oklch(0.3500 0.0500 240)",
      },
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Natural green tones",
    preview: {
      light: "oklch(0.5200 0.1400 145)",
      dark: "oklch(0.5800 0.1300 145)",
    },
    colors: {
      light: {
        primary: "oklch(0.5200 0.1400 145)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5200 0.1400 145)",
        chart1: "oklch(0.4800 0.1300 140)",
        chart2: "oklch(0.6200 0.1100 150)",
        chart5: "oklch(0.4200 0.1500 135)",
        sidebarPrimary: "oklch(0.5200 0.1400 145)",
      },
      dark: {
        primary: "oklch(0.5800 0.1300 145)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5800 0.1300 145)",
        chart1: "oklch(0.5400 0.1200 140)",
        chart2: "oklch(0.6800 0.1000 150)",
        chart5: "oklch(0.4800 0.1400 135)",
        sidebarPrimary: "oklch(0.3500 0.0800 145)",
      },
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm red-orange tones",
    preview: {
      light: "oklch(0.5800 0.1800 25)",
      dark: "oklch(0.6400 0.1700 25)",
    },
    colors: {
      light: {
        primary: "oklch(0.5800 0.1800 25)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5800 0.1800 25)",
        chart1: "oklch(0.5400 0.1700 20)",
        chart2: "oklch(0.6500 0.1500 35)",
        chart5: "oklch(0.5000 0.1900 15)",
        sidebarPrimary: "oklch(0.5800 0.1800 25)",
      },
      dark: {
        primary: "oklch(0.6400 0.1700 25)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.6400 0.1700 25)",
        chart1: "oklch(0.6000 0.1600 20)",
        chart2: "oklch(0.7100 0.1400 35)",
        chart5: "oklch(0.5600 0.1800 15)",
        sidebarPrimary: "oklch(0.3800 0.0800 25)",
      },
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Soft pink tones",
    preview: {
      light: "oklch(0.6000 0.1400 350)",
      dark: "oklch(0.6600 0.1300 350)",
    },
    colors: {
      light: {
        primary: "oklch(0.6000 0.1400 350)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.6000 0.1400 350)",
        chart1: "oklch(0.5600 0.1300 345)",
        chart2: "oklch(0.6800 0.1100 355)",
        chart5: "oklch(0.5200 0.1500 340)",
        sidebarPrimary: "oklch(0.6000 0.1400 350)",
      },
      dark: {
        primary: "oklch(0.6600 0.1300 350)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.6600 0.1300 350)",
        chart1: "oklch(0.6200 0.1200 345)",
        chart2: "oklch(0.7400 0.1000 355)",
        chart5: "oklch(0.5800 0.1400 340)",
        sidebarPrimary: "oklch(0.3800 0.0700 350)",
      },
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Rich purple tones",
    preview: {
      light: "oklch(0.5500 0.1600 290)",
      dark: "oklch(0.6100 0.1500 290)",
    },
    colors: {
      light: {
        primary: "oklch(0.5500 0.1600 290)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5500 0.1600 290)",
        chart1: "oklch(0.5100 0.1500 285)",
        chart2: "oklch(0.6300 0.1300 295)",
        chart5: "oklch(0.4700 0.1700 280)",
        sidebarPrimary: "oklch(0.5500 0.1600 290)",
      },
      dark: {
        primary: "oklch(0.6100 0.1500 290)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.6100 0.1500 290)",
        chart1: "oklch(0.5700 0.1400 285)",
        chart2: "oklch(0.6900 0.1200 295)",
        chart5: "oklch(0.5300 0.1600 280)",
        sidebarPrimary: "oklch(0.3600 0.0800 290)",
      },
    },
  },
  {
    id: "amber",
    name: "Amber",
    description: "Golden yellow tones",
    preview: {
      light: "oklch(0.6800 0.1600 75)",
      dark: "oklch(0.7400 0.1500 75)",
    },
    colors: {
      light: {
        primary: "oklch(0.6800 0.1600 75)",
        primaryForeground: "oklch(0.2000 0 0)",
        ring: "oklch(0.6800 0.1600 75)",
        chart1: "oklch(0.6400 0.1500 70)",
        chart2: "oklch(0.7500 0.1300 80)",
        chart5: "oklch(0.6000 0.1700 65)",
        sidebarPrimary: "oklch(0.6800 0.1600 75)",
      },
      dark: {
        primary: "oklch(0.7400 0.1500 75)",
        primaryForeground: "oklch(0.2000 0 0)",
        ring: "oklch(0.7400 0.1500 75)",
        chart1: "oklch(0.7000 0.1400 70)",
        chart2: "oklch(0.8100 0.1200 80)",
        chart5: "oklch(0.6600 0.1600 65)",
        sidebarPrimary: "oklch(0.4200 0.0800 75)",
      },
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Neutral gray tones",
    preview: {
      light: "oklch(0.4500 0.0200 260)",
      dark: "oklch(0.5500 0.0200 260)",
    },
    colors: {
      light: {
        primary: "oklch(0.4500 0.0200 260)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.4500 0.0200 260)",
        chart1: "oklch(0.4100 0.0180 255)",
        chart2: "oklch(0.5300 0.0150 265)",
        chart5: "oklch(0.3700 0.0220 250)",
        sidebarPrimary: "oklch(0.4500 0.0200 260)",
      },
      dark: {
        primary: "oklch(0.5500 0.0200 260)",
        primaryForeground: "oklch(1.0000 0 0)",
        ring: "oklch(0.5500 0.0200 260)",
        chart1: "oklch(0.5100 0.0180 255)",
        chart2: "oklch(0.6300 0.0150 265)",
        chart5: "oklch(0.4700 0.0220 250)",
        sidebarPrimary: "oklch(0.3500 0.0100 260)",
      },
    },
  },
];

export const DEFAULT_COLOR_THEME = "default";

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((theme) => theme.id === id) || COLOR_THEMES[0];
}
