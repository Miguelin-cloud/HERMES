import React from 'react';
import {
  Bot,
  Brain,
  Cpu,
  DownloadCloud,
  Flame,
  FlaskConical,
  LineChart,
  Database,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface RoadmapTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

interface PillarItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface AmberRoadmapTemplateProps {
  theme: 'dark' | 'light';
  headerIcon: React.ReactNode;
  statusBadge: string;
  rightBadge: string;
  titleIcon: React.ReactNode;
  title: string;
  introTitle: string;
  introDesc: string;
  pillars: PillarItem[];
}

const AmberRoadmapTemplate: React.FC<AmberRoadmapTemplateProps> = ({
  headerIcon,
  statusBadge,
  rightBadge,
  titleIcon,
  title,
  introTitle,
  introDesc,
  pillars,
}) => {
  return (
    <div className="max-w-4xl mx-auto w-full rounded-xl border border-amber-500/45 bg-card text-foreground overflow-hidden">
      {/* Header Strip */}
      <div className="px-6 py-4 bg-card-header border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            {headerIcon}
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-mono uppercase tracking-widest font-semibold text-amber-700 dark:text-amber-300">
              {statusBadge}
            </span>
            <h2 className="text-lg md:text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-2">
              {titleIcon}
              <span className="truncate">{title}</span>
            </h2>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {rightBadge}
        </div>
      </div>

      {/* Main Proposal Description */}
      <div className="p-6 space-y-5 text-sm leading-relaxed">
        <div className="p-4 rounded-lg border border-amber-500/25 bg-background/60 text-foreground">
          <h3 className="font-semibold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wider mb-1.5 flex items-center gap-2 font-mono">
            <Sparkles size={16} />
            <span>{introTitle}</span>
          </h3>
          <p className="text-foreground/90">{introDesc}</p>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pillars.map((pillar, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg border border-border bg-background/50 flex gap-3"
            >
              <div className="w-9 h-9 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
                {pillar.icon}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-300 mb-1">
                  {pillar.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AgenteJesusPanel: React.FC<RoadmapTabProps> = ({ lang, theme }) => {
  const t = translations[lang] || translations.en;

  return (
    <AmberRoadmapTemplate
      theme={theme}
      headerIcon={<Bot size={28} />}
      statusBadge={t.agente_status}
      rightBadge={t.agente_badge_local}
      titleIcon={<Brain size={22} />}
      title={t.agente_title}
      introTitle={t.agente_intro_title}
      introDesc={t.agente_intro_desc}
      pillars={[
        {
          icon: <DownloadCloud size={20} />,
          title: t.agente_pillar1_title,
          description: t.agente_pillar1_desc,
        },
        {
          icon: <ShieldCheck size={20} />,
          title: t.agente_pillar2_title,
          description: t.agente_pillar2_desc,
        },
        {
          icon: <Brain size={20} />,
          title: t.agente_pillar3_title,
          description: t.agente_pillar3_desc,
        },
        {
          icon: <Cpu size={20} />,
          title: t.agente_pillar4_title,
          description: t.agente_pillar4_desc,
        },
      ]}
    />
  );
};

export const PropellantCharacterizationPanel: React.FC<RoadmapTabProps> = ({ lang, theme }) => {
  const t = translations[lang] || translations.en;

  return (
    <AmberRoadmapTemplate
      theme={theme}
      headerIcon={<FlaskConical size={28} />}
      statusBadge={t.prop_char_status}
      rightBadge={t.prop_char_badge_law}
      titleIcon={<Flame size={22} />}
      title={t.prop_char_title}
      introTitle={t.prop_char_intro_title}
      introDesc={t.prop_char_intro_desc}
      pillars={[
        {
          icon: <Upload size={20} />,
          title: t.prop_char_pillar1_title,
          description: t.prop_char_pillar1_desc,
        },
        {
          icon: <Flame size={20} />,
          title: t.prop_char_pillar2_title,
          description: t.prop_char_pillar2_desc,
        },
        {
          icon: <LineChart size={20} />,
          title: t.prop_char_pillar3_title,
          description: t.prop_char_pillar3_desc,
        },
        {
          icon: <Database size={20} />,
          title: t.prop_char_pillar4_title,
          description: t.prop_char_pillar4_desc,
        },
      ]}
    />
  );
};
