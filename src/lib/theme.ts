export type ThemePresetId = 'paper' | 'obsidian' | 'blueprint' | 'alabaster' | 'custom';

export interface ThemeColors {
  background: string;
  card: string;
  cardHeader: string;
  border: string;
  primary: string;
  secondary: string;
  chartPressure: string;
  chartThrust: string;
  accentChamber: string;
  accentStructure: string;
  accentNozzle: string;
  accentGrain: string;
}

export interface ThemeConfig {
  preset: ThemePresetId;
  colors: ThemeColors;
}

export const THEME_PRESETS: Record<Exclude<ThemePresetId, 'custom'>, ThemeColors> = {
  paper: {
    background: '#f4f6f9',
    card: '#ffffff',
    cardHeader: '#eef2f6',
    border: '#d6dee8',
    primary: '#2563eb',
    secondary: '#0284c7',
    chartPressure: '#dc2626',
    chartThrust: '#2563eb',
    accentChamber: '#2563eb',
    accentStructure: '#0f766e',
    accentNozzle: '#d97706',
    accentGrain: '#475569',
  },
  obsidian: {
    background: '#0d1117',
    card: '#151b23',
    cardHeader: '#1c2430',
    border: '#2b3544',
    primary: '#3b82f6',
    secondary: '#06b6d4',
    chartPressure: '#f43f5e',
    chartThrust: '#38bdf8',
    accentChamber: '#3b82f6',
    accentStructure: '#14b8a6',
    accentNozzle: '#f59e0b',
    accentGrain: '#64748b',
  },
  blueprint: {
    background: '#081326',
    card: '#0e1d36',
    cardHeader: '#152949',
    border: '#233c63',
    primary: '#38bdf8',
    secondary: '#f59e0b',
    chartPressure: '#fb7185',
    chartThrust: '#38bdf8',
    accentChamber: '#38bdf8',
    accentStructure: '#2dd4bf',
    accentNozzle: '#fbbf24',
    accentGrain: '#94a3b8',
  },
  alabaster: {
    background: '#f5f3ee',
    card: '#ffffff',
    cardHeader: '#ebe7de',
    border: '#dcd5c7',
    primary: '#0f766e',
    secondary: '#b45309',
    chartPressure: '#b91c1c',
    chartThrust: '#0f766e',
    accentChamber: '#0f766e',
    accentStructure: '#0369a1',
    accentNozzle: '#b45309',
    accentGrain: '#57534e',
  },
};

export const THEME_CONFIG_STORAGE_KEY = 'hermes_theme_config';
export const LEGACY_THEME_STORAGE_KEY = 'hermes_theme';

function sanitizeHex(hex: string | undefined, fallback: string): string {
  if (!hex || typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = sanitizeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightHex(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.35;
}

export function getThemePolarity(colors: ThemeColors): 'light' | 'dark' {
  return isLightHex(colors.background) ? 'light' : 'dark';
}

export function getContrastingInk(surfaceHex: string): string {
  const darkInk = '#0f172a';
  const lightInk = '#f8fafc';
  return getContrastRatio(surfaceHex, darkInk) >= getContrastRatio(surfaceHex, lightInk) ? darkInk : lightInk;
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  const r = Math.round(a.r * (1 - w) + b.r * w);
  const g = Math.round(a.g * (1 - w) + b.g * w);
  const bl = Math.round(a.b * (1 - w) + b.b * w);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

export function normalizeThemeColors(colors?: Partial<ThemeColors>, basePreset: Exclude<ThemePresetId, 'custom'> = 'paper'): ThemeColors {
  const base = THEME_PRESETS[basePreset];
  return {
    background: sanitizeHex(colors?.background, base.background),
    card: sanitizeHex(colors?.card, base.card),
    cardHeader: sanitizeHex(colors?.cardHeader, base.cardHeader),
    border: sanitizeHex(colors?.border, base.border),
    primary: sanitizeHex(colors?.primary, base.primary),
    secondary: sanitizeHex(colors?.secondary, base.secondary),
    chartPressure: sanitizeHex(colors?.chartPressure, base.chartPressure),
    chartThrust: sanitizeHex(colors?.chartThrust, base.chartThrust),
    accentChamber: sanitizeHex(colors?.accentChamber, base.accentChamber),
    accentStructure: sanitizeHex(colors?.accentStructure, base.accentStructure),
    accentNozzle: sanitizeHex(colors?.accentNozzle, base.accentNozzle),
    accentGrain: sanitizeHex(colors?.accentGrain, base.accentGrain),
  };
}

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const preset: ThemePresetId =
        parsed?.preset === 'paper' ||
        parsed?.preset === 'obsidian' ||
        parsed?.preset === 'blueprint' ||
        parsed?.preset === 'alabaster' ||
        parsed?.preset === 'custom'
          ? parsed.preset
          : 'paper';
      const fallbackBase = preset === 'custom' ? 'paper' : preset;
      return {
        preset,
        colors: normalizeThemeColors(parsed?.colors, fallbackBase),
      };
    }
    const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy === 'dark') {
      return { preset: 'obsidian', colors: { ...THEME_PRESETS.obsidian } };
    }
  } catch {
    // Fallback to default paper preset
  }
  return { preset: 'paper', colors: { ...THEME_PRESETS.paper } };
}

export function saveThemeConfig(config: ThemeConfig): void {
  try {
    localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, getThemePolarity(config.colors));
  } catch {
    // Ignore storage quota errors
  }
}

export function applyThemeConfigToDocument(config: ThemeConfig): 'light' | 'dark' {
  const colors = config.colors;
  const polarity = getThemePolarity(colors);
  const root = document.documentElement;

  if (polarity === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }

  const cardIsLight = isLightHex(colors.card);
  const fg = getContrastingInk(colors.background);
  const cardFg = getContrastingInk(colors.card);
  const headerFg = getContrastingInk(colors.cardHeader);
  const muted = cardIsLight ? mixHex(colors.card, '#0f172a', 0.045) : mixHex(colors.card, '#ffffff', 0.065);
  const mutedFg = cardIsLight ? mixHex(cardFg, colors.card, 0.42) : mixHex(cardFg, colors.card, 0.4);
  const inputBg = cardIsLight ? mixHex(colors.card, '#0f172a', 0.025) : mixHex(colors.card, '#000000', 0.16);
  const accentBg = cardIsLight ? mixHex(colors.primary, '#ffffff', 0.88) : mixHex(colors.primary, colors.card, 0.78);
  const accentFg = getContrastingInk(accentBg);
  const primaryFg = getContrastingInk(colors.primary);
  const secondaryFg = getContrastingInk(colors.secondary);

  const vars: Record<string, string> = {
    '--background': colors.background,
    '--foreground': fg,
    '--card': colors.card,
    '--card-foreground': cardFg,
    '--surface-card-header': colors.cardHeader,
    '--surface-card-header-foreground': headerFg,
    '--popover': colors.card,
    '--popover-foreground': cardFg,
    '--primary': colors.primary,
    '--primary-foreground': primaryFg,
    '--secondary': colors.secondary,
    '--secondary-foreground': secondaryFg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': accentBg,
    '--accent-foreground': accentFg,
    '--destructive': polarity === 'light' ? '#dc2626' : '#ef4444',
    '--border': colors.border,
    '--input': inputBg,
    '--ring': colors.primary,
    '--chart-pressure': colors.chartPressure,
    '--chart-thrust': colors.chartThrust,
    '--accent-chamber': colors.accentChamber,
    '--accent-structure': colors.accentStructure,
    '--accent-nozzle': colors.accentNozzle,
    '--accent-grain': colors.accentGrain,
  };

  for (const [prop, val] of Object.entries(vars)) {
    root.style.setProperty(prop, val);
  }

  return polarity;
}
