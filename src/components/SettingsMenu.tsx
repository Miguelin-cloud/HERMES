import React, { useEffect, useState } from 'react';
import {
  X,
  Palette,
  Languages,
  MousePointer2,
  BookOpen,
  BarChart3,
  MessageSquare,
  Users,
  RotateCcw,
  Check,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Bot,
  Compass,
  Home,
  Download,
  Lock,
} from 'lucide-react';
import { Language } from '../lib/i18n';
import {
  getContrastRatio,
  THEME_PRESETS,
  ThemeColors,
  ThemeConfig,
  ThemePresetId,
} from '../lib/theme';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
  cursor: string;
  setCursor: (cursor: string) => void;
  themeConfig: ThemeConfig;
  onSelectPreset: (preset: Exclude<ThemePresetId, 'custom'>) => void;
  onUpdateColor: (key: keyof ThemeColors, hex: string) => void;
  onResetTheme: (preset?: Exclude<ThemePresetId, 'custom'>) => void;
  onOpenVersions: () => void;
  onOpenAnalytics: () => void;
  onOpenFeedback: () => void;
  onOpenLibrary: () => void;
  onOpenAgenteJesus: () => void;
  onOpenGuideBook: () => void;
  onReturnToStart: () => void;
  showInstallBtn?: boolean;
  onInstallApp?: () => void;
  isAgenteInstalled?: boolean;
  t: Record<string, string>;
}

type EditableColorKey = keyof Pick<
  ThemeColors,
  'background' | 'card' | 'cardHeader' | 'border' | 'primary' | 'secondary'
>;

const COLOR_SWATCHES: Record<EditableColorKey, string[]> = {
  background: ['#f4f6f9', '#f5f3ee', '#ffffff', '#0d1117', '#081326', '#111827'],
  card: ['#ffffff', '#f8fafc', '#fdfcf9', '#151b23', '#0e1d36', '#18181b'],
  cardHeader: ['#eef2f6', '#ebe7de', '#e2e8f0', '#1c2430', '#152949', '#27272a'],
  border: ['#d6dee8', '#dcd5c7', '#cbd5e1', '#2b3544', '#233c63', '#3f3f46'],
  primary: ['#2563eb', '#0f766e', '#0284c7', '#d97706', '#dc2626', '#38bdf8'],
  secondary: ['#0284c7', '#06b6d4', '#0f766e', '#f59e0b', '#6366f1', '#10b981'],
};

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  lang,
  setLang,
  cursor,
  setCursor,
  themeConfig,
  onSelectPreset,
  onUpdateColor,
  onResetTheme,
  onOpenVersions,
  onOpenAnalytics,
  onOpenFeedback,
  onOpenLibrary,
  onOpenAgenteJesus,
  onOpenGuideBook,
  onReturnToStart,
  showInstallBtn,
  onInstallApp,
  isAgenteInstalled = true,
  t,
}) => {
  const [openTheme, setOpenTheme] = useState(false);
  const [showCustomColors, setShowCustomColors] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const [openCursor, setOpenCursor] = useState(false);
  const [openTools, setOpenTools] = useState(false);
  const [showCreditsDetail, setShowCreditsDetail] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const presets: Array<{ id: Exclude<ThemePresetId, 'custom'>; label: string }> = [
    { id: 'paper', label: t.theme_preset_paper },
    { id: 'obsidian', label: t.theme_preset_obsidian },
    { id: 'blueprint', label: t.theme_preset_blueprint },
    { id: 'alabaster', label: t.theme_preset_alabaster },
  ];

  const activePresetLabel =
    themeConfig.preset === 'custom'
      ? t.theme_preset_custom
      : presets.find((p) => p.id === themeConfig.preset)?.label || t.theme_preset_paper;

  const colorFields: Array<{
    key: EditableColorKey;
    label: string;
  }> = [
    { key: 'background', label: t.color_bg },
    { key: 'card', label: t.color_card },
    { key: 'cardHeader', label: t.color_card_header },
    { key: 'border', label: t.color_border },
    { key: 'primary', label: t.color_primary },
    { key: 'secondary', label: t.color_secondary },
  ];

  const bgVsCardContrast = getContrastRatio(themeConfig.colors.background, themeConfig.colors.card);
  const bgSamePolarity =
    (getContrastRatio(themeConfig.colors.background, '#000000') > 7) ===
    (getContrastRatio(themeConfig.colors.card, '#000000') > 7);
  const hasLowSurfaceContrast = !bgSamePolarity && bgVsCardContrast < 1.8;

  const languages: Array<{ id: Language; label: string }> = [
    { id: 'en', label: 'ENG' },
    { id: 'es', label: 'ESP' },
    { id: 'fr', label: 'FRA' },
    { id: 'it', label: 'ITA' },
  ];
  const activeLangLabel = languages.find((l) => l.id === lang)?.label || 'ENG';

  const standardCursors = [
    { id: 'default', label: t.cursor_normal },
    { id: 'crosshair', label: t.cursor_crosshair },
    { id: 'pointer', label: t.cursor_pointer },
  ];

  const funCursors = [
    { id: 'rocket', label: t.cursor_rocket },
    { id: 'satellite', label: t.cursor_satellite },
    { id: 'star', label: t.cursor_star },
    { id: 'avocado', label: t.cursor_avocado },
    { id: 'drumstick', label: t.cursor_drumstick },
    { id: 'frying_pan', label: t.cursor_frying_pan },
  ];

  const activeCursorLabel =
    [...standardCursors, ...funCursors].find((c) => c.id === cursor)?.label || t.cursor_normal;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.settings_title}
        className="relative z-10 w-full max-w-[380px] h-full bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-card-header flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground truncate">{t.settings_title}</h2>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.settings_subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label={t.close_btn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Compact Accordion Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {/* Quick Workspace & Navigation Actions (moved from header) */}
          <section className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              {t.settings_workspace_label}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-tour="library-btn"
                onClick={() => {
                  onClose();
                  onOpenLibrary();
                }}
                className="h-9 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{t.library_btn}</span>
              </button>

              <button
                type="button"
                data-tour="global-agente-jesus-btn"
                onClick={() => {
                  onClose();
                  onOpenAgenteJesus();
                }}
                className={`h-9 px-2.5 rounded-md border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
                  isAgenteInstalled
                    ? 'border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1 text-left">{t.agente_open_btn}</span>
                {!isAgenteInstalled && <Lock className="w-3 h-3 shrink-0 text-amber-500" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGuideBook();
                }}
                className="h-9 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0"
              >
                <Compass className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{t.guide_book_btn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReturnToStart();
                }}
                className="h-9 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0"
              >
                <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{t.splash_return_btn}</span>
              </button>
            </div>

            {showInstallBtn && onInstallApp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onInstallApp();
                }}
                className="w-full h-9 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{t.install_app_btn}</span>
              </button>
            )}
          </section>

          {/* 1. Theme & Colors (Collapsed by default) */}
          <section className="rounded-lg border border-border bg-background/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenTheme((v) => !v)}
              aria-expanded={openTheme}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-muted/60 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Palette className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{t.theme_studio_title}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
                  {activePresetLabel}
                </span>
                {openTheme ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </span>
            </button>

            {openTheme && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/80 space-y-3 bg-card/40">
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => {
                    const p = THEME_PRESETS[preset.id];
                    const active = themeConfig.preset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectPreset(preset.id)}
                        className={`group text-left p-2.5 rounded-md border transition-colors cursor-pointer ${
                          active
                            ? 'border-primary bg-accent/60'
                            : 'border-border bg-background/60 hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <span className="text-xs font-semibold text-foreground truncate">{preset.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-3 flex-1 rounded-sm border border-black/15"
                            style={{ backgroundColor: p.background }}
                            title="Background"
                          />
                          <span
                            className="h-3 flex-1 rounded-sm border border-black/15"
                            style={{ backgroundColor: p.card }}
                            title="Card"
                          />
                          <span
                            className="h-3 w-3.5 rounded-sm"
                            style={{ backgroundColor: p.primary }}
                            title="Primary"
                          />
                          <span
                            className="h-3 w-2.5 rounded-sm"
                            style={{ backgroundColor: p.secondary }}
                            title="Secondary"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Theme Studio Toggle */}
                <div className="border border-border rounded-md overflow-hidden bg-background/50">
                  <button
                    type="button"
                    onClick={() => setShowCustomColors((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-card-header hover:bg-muted/70 text-xs font-semibold text-foreground cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{t.theme_customize_btn}</span>
                    </span>
                    {showCustomColors ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>

                  {showCustomColors && (
                    <div className="p-3 border-t border-border/70 space-y-3">
                      {hasLowSurfaceContrast && (
                        <div className="flex items-start gap-2 p-2 rounded border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{t.contrast_warning}</span>
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {colorFields.map(({ key, label }) => {
                          const currentHex = themeConfig.colors[key];
                          const swatches = COLOR_SWATCHES[key];
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-medium text-foreground">{label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground uppercase">
                                    {currentHex}
                                  </span>
                                  <input
                                    type="color"
                                    value={currentHex}
                                    onChange={(e) => onUpdateColor(key, e.target.value)}
                                    aria-label={label}
                                    className="w-6 h-5 p-0 border border-border rounded cursor-pointer bg-transparent"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {swatches.map((hex) => (
                                  <button
                                    key={`${key}-${hex}`}
                                    type="button"
                                    onClick={() => onUpdateColor(key, hex)}
                                    title={hex}
                                    className={`h-4 flex-1 rounded-sm border transition-transform cursor-pointer ${
                                      currentHex.toLowerCase() === hex.toLowerCase()
                                        ? 'border-foreground scale-y-110 ring-1 ring-primary'
                                        : 'border-border/80 hover:scale-y-105'
                                    }`}
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-border flex justify-end">
                        <button
                          type="button"
                          onClick={() => onResetTheme(themeConfig.preset === 'custom' ? 'paper' : themeConfig.preset)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{t.theme_reset_btn}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 2. Language (Collapsed by default) */}
          <section className="rounded-lg border border-border bg-background/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenLang((v) => !v)}
              aria-expanded={openLang}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-muted/60 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Languages className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{t.settings_lang_label}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground">{activeLangLabel}</span>
                {openLang ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </span>
            </button>

            {openLang && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/80 bg-card/40">
                <div className="grid grid-cols-4 gap-1.5">
                  {languages.map((item) => {
                    const active = lang === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLang(item.id)}
                        className={`h-8 rounded-md border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background/60 text-foreground hover:bg-muted'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 3. Pointer / Cursor (Collapsed by default) */}
          <section className="rounded-lg border border-border bg-background/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenCursor((v) => !v)}
              aria-expanded={openCursor}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-muted/60 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <MousePointer2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{t.settings_cursor_label}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
                  {activeCursorLabel}
                </span>
                {openCursor ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </span>
            </button>

            {openCursor && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/80 space-y-2.5 bg-card/40">
                <div className="grid grid-cols-3 gap-1.5">
                  {standardCursors.map((item) => {
                    const active = cursor === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCursor(item.id)}
                        className={`px-2 py-1.5 rounded-md border text-[11px] font-medium truncate transition-colors cursor-pointer ${
                          active
                            ? 'border-primary bg-accent text-foreground'
                            : 'border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t.settings_cursor_fun}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {funCursors.map((item) => {
                      const active = cursor === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCursor(item.id)}
                          className={`px-2 py-1.5 rounded-md border text-[11px] font-medium truncate transition-colors cursor-pointer ${
                            active
                              ? 'border-primary bg-accent text-foreground'
                              : 'border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 4. Project & Documentation Tools (Collapsed by default) */}
          <section className="rounded-lg border border-border bg-background/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenTools((v) => !v)}
              aria-expanded={openTools}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-muted/60 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{t.settings_tools_label}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-muted-foreground">v2.1.0</span>
                {openTools ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </span>
            </button>

            {openTools && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/80 space-y-2 bg-card/40">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVersions();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background/60 hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>{t.versions_btn}</span>
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">v2.1.0</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAnalytics();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background/60 hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-secondary" />
                    <span>{t.usage_stats_btn}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFeedback();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background/60 hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t.feedback_btn}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {/* Expandable Engineering Credits */}
                <div className="border border-border rounded-md overflow-hidden bg-background/60">
                  <button
                    type="button"
                    onClick={() => setShowCreditsDetail((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t.settings_credits_label}</span>
                    </span>
                    {showCreditsDetail ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {showCreditsDetail && (
                    <div className="px-3 py-2.5 border-t border-border bg-card space-y-2 text-xs">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                          {t.role_developer}
                        </p>
                        <p className="font-semibold text-foreground mt-0.5">Miguel Tejera Lesmes</p>
                      </div>
                      <div className="border-t border-border/70 pt-2">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                          {t.role_collaborators}
                        </p>
                        <p className="font-medium text-foreground mt-0.5">Jesús Sáez Barragán</p>
                        <p className="font-medium text-foreground">Pablo Sánchez Mora</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
};
