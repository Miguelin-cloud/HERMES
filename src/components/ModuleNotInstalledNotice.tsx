import React from 'react';
import { PackageX, RefreshCw, Info } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { OptionalModuleId } from '../lib/modules';

interface ModuleNotInstalledNoticeProps {
  moduleId: OptionalModuleId;
  lang: Language;
  theme: 'dark' | 'light';
}

export const ModuleNotInstalledNotice: React.FC<ModuleNotInstalledNoticeProps> = ({
  moduleId,
  lang,
}) => {
  const t = translations[lang] || translations.en;

  const moduleName =
    moduleId === 'agente_jesus'
      ? t.pkg_name_agente_jesus
      : moduleId === 'propellant_char'
        ? t.pkg_name_propellant_char
        : t.pkg_name_animations;

  const moduleDesc =
    moduleId === 'agente_jesus'
      ? t.pkg_desc_agente_jesus
      : moduleId === 'propellant_char'
        ? t.pkg_desc_propellant_char
        : t.pkg_desc_animations;

  return (
    <div className="max-w-2xl mx-auto my-8 w-full rounded-xl border border-amber-500/45 bg-card text-foreground overflow-hidden">
      <div className="px-6 py-4 bg-card-header border-b border-amber-500/25 flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
          <PackageX size={24} />
        </div>
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-amber-700 dark:text-amber-300">
            {t.pkg_missing_badge}
          </span>
          <h2 className="text-lg md:text-xl font-bold mt-0.5 text-foreground">
            {t.pkg_missing_title}: <span className="text-amber-600 dark:text-amber-400">{moduleName}</span>
          </h2>
        </div>
      </div>

      <div className="p-6 space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">{moduleDesc}</p>

        <div className="p-4 rounded-lg border border-border bg-background/60 text-foreground flex items-start gap-3">
          <RefreshCw size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-mono">
              {t.pkg_reinstall_title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.pkg_reinstall_steps}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground pt-1">
          <Info size={14} className="shrink-0 text-amber-500" />
          <span>{t.pkg_lightweight_note}</span>
        </div>
      </div>
    </div>
  );
};
