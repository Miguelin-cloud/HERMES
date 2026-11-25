import React, { Suspense, lazy, useEffect } from 'react';
import { Bot, X } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { ModuleNotInstalledNotice } from './ModuleNotInstalledNotice';

const AgenteJesusPanel = lazy(() =>
  import('./RoadmapPreviewTabs').then((m) => ({ default: m.AgenteJesusPanel }))
);

interface AgenteJesusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isInstalled: boolean;
  lang: Language;
  theme: 'dark' | 'light';
}

export const AgenteJesusDrawer: React.FC<AgenteJesusDrawerProps> = ({
  isOpen,
  onClose,
  isInstalled,
  lang,
  theme,
}) => {
  const t = translations[lang] || translations.en;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
        aria-label={t.tab_agente_jesus}
        className="relative z-10 w-full max-w-[600px] h-full bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col"
      >
        <div className="px-5 py-3.5 border-b border-border bg-card-header flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
                {t.tab_agente_jesus}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {t.agente_drawer_subtitle}
              </p>
            </div>
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-background">
          {!isInstalled ? (
            <ModuleNotInstalledNotice moduleId="agente_jesus" lang={lang} theme={theme} />
          ) : (
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="p-6 text-xs font-mono text-muted-foreground">
                    {t.mc_processing}
                  </div>
                }
              >
                <AgenteJesusPanel lang={lang} theme={theme} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </aside>
    </div>
  );
};
