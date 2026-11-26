import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  Compass,
  Download,
  FileSpreadsheet,
  Flame,
  Gauge,
  Globe,
  Layers,
  Lock,
  Mail,
  Monitor,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getInstalledModules } from '../lib/modules';
import {
  formatDurationCompact,
  generateMonthlyEmailBody,
  loadTelemetryData,
  resetTelemetryMetrics,
  TelemetryMetrics,
  TelemetryTabId,
} from '../lib/telemetry';

interface UsageAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
}

const MOTOR_CLASS_ORDER = [
  '1/4A', '1/2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', '>O',
];

function getLabels(lang: string) {
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const isIt = lang === 'it';

  if (isEs) {
    return {
      title: 'Estadísticas de Uso e Ingeniería',
      privateBadge: '100% Privado en tu PC',
      subtitle: 'Telemetría local de rendimiento, hábitos de diseño y récords en HERMES Simulator',
      privacyTitle: 'Tus datos pertenecen únicamente a ti',
      privacyDesc:
        'HERMES no envía telemetría en segundo plano. Si quieres compartir tu resumen mensual con el equipo de COHETEROS, puedes enviarlo voluntariamente por correo.',
      sendEmail: 'Enviar Reporte a info@coheteros.com',
      refresh: 'Actualizar',
      resetConfirm: '¿Estás seguro de que deseas reiniciar todas tus estadísticas locales a cero?',
      resetYes: 'Sí, reiniciar',
      cancel: 'Cancelar',
      lifetimeTitle: 'Resumen Acumulado',
      installedOn: 'Primer uso:',
      kpiSessions: 'Sesiones',
      kpiDaysActive: 'días activos',
      kpiTime: 'Tiempo Activo',
      kpiAvgSession: 'media/sesión',
      kpiSims: 'Simulaciones',
      kpiSafeRate: 'integridad OK',
      kpiSmartSearch: 'Smart Search',
      kpiApplied: 'aplicadas',
      kpiFlights: 'Vuelos M. Control',
      kpiTrajectories: 'trayectorias',
      kpiCustomAssets: 'Activos Propios',
      kpiPropAndGrains: 'prop. / granos',
      kpiExports: 'Exportaciones',
      kpiGuides: 'Guías Completadas',
      kpiTours: 'tours guiados',
      recordsTitle: 'Récords Personales de Diseño',
      recImpulse: 'Mayor Impulso Total',
      recThrust: 'Mayor Empuje Máximo',
      recPressure: 'Mayor Presión Cámara',
      recIsp: 'Mejor Isp Calculado',
      recApogee: 'Mayor Apogeo Simulado',
      classBadge: 'Clase',
      safeTag: 'Seguro',
      overpTag: 'Sobrepresión',
      distTitle: 'Perfil de Ingeniería Aeroespacial',
      classChartTitle: 'Simulaciones por Clase de Motor',
      topShapesTitle: 'Geometrías de Grano Favoritas',
      topPropsTitle: 'Propulsantes Más Utilizados',
      noSimDataYet: 'Ejecuta al menos una simulación para ver tus distribuciones de diseño.',
      monthlyTitle: 'Tendencia y Desglose Mensual',
      selectMonth: 'Mes:',
      monthCol: 'Mes',
      sessionsCol: 'Sesiones',
      timeCol: 'Tiempo',
      simsCol: 'Simulaciones',
      searchCol: 'Smart Search',
      flightsCol: 'Vuelos',
      exportsCol: 'Exportaciones',
      tabsTitle: 'Uso por Vista y Módulo (9 Vistas)',
      visitsWord: 'visitas',
      envTitle: 'Entorno y Módulos',
      execMode: 'Modo de Ejecución',
      osLabel: 'Sistema Operativo',
      langLabel: 'Idioma Activo',
      modulesLabel: 'Módulos Instalados',
      modCore: 'Simulación + 3D/CFD',
      modPost: 'Post-Procesado',
      modAi: 'Agente Jesús IA',
      activeTag: 'Activo',
      lockedTag: 'Bloqueado',
      downloadJson: 'Descargar JSON',
      resetBtn: 'Reiniciar',
      closeBtn: 'Cerrar',
      tabLabels: {
        inputs: 'Entradas (Inputs)',
        results: 'Resultados',
        analysis: 'Análisis Detallado',
        mission_control: 'Mission Control',
        smart_search: 'Smart Search',
        cfd: 'Animación 3D / CFD',
        study: 'Post-Process · Estudio',
        propellant_char: 'Post-Process · Propulsante',
        agente_jesus: 'Agente Jesús IA',
      } as Record<TelemetryTabId, string>,
    };
  }

  if (isFr) {
    return {
      title: 'Statistiques d’Usage et d’Ingénierie',
      privateBadge: '100 % Privé sur votre PC',
      subtitle: 'Télémétrie locale, habitudes de conception et records sur HERMES Simulator',
      privacyTitle: 'Vos statistiques n’appartiennent qu’à vous',
      privacyDesc:
        'Aucune donnée n’est envoyée en arrière-plan. Vous pouvez envoyer votre bilan mensuel par e-mail à l’équipe COHETEROS si vous le souhaitez.',
      sendEmail: 'Envoyer le Rapport à info@coheteros.com',
      refresh: 'Actualiser',
      resetConfirm: 'Voulez-vous vraiment réinitialiser toutes vos statistiques locales à zéro ?',
      resetYes: 'Oui, réinitialiser',
      cancel: 'Annuler',
      lifetimeTitle: 'Totaux Cumulés',
      installedOn: 'Premier lancement :',
      kpiSessions: 'Sessions',
      kpiDaysActive: 'jours actifs',
      kpiTime: 'Temps Actif',
      kpiAvgSession: 'moy./session',
      kpiSims: 'Simulations',
      kpiSafeRate: 'intégrité OK',
      kpiSmartSearch: 'Smart Search',
      kpiApplied: 'appliquées',
      kpiFlights: 'Vols M. Control',
      kpiTrajectories: 'trajectoires',
      kpiCustomAssets: 'Créations',
      kpiPropAndGrains: 'prop. / grains',
      kpiExports: 'Exportations',
      kpiGuides: 'Guides Terminés',
      kpiTours: 'visites guidées',
      recordsTitle: 'Records Personnels de Conception',
      recImpulse: 'Impulsion Totale Max',
      recThrust: 'Poussée Maximale',
      recPressure: 'Pression Chambre Max',
      recIsp: 'Meilleur Isp',
      recApogee: 'Apogée Simulée Max',
      classBadge: 'Classe',
      safeTag: 'Sûr',
      overpTag: 'Surpression',
      distTitle: 'Profil d’Ingénierie Aérospatiale',
      classChartTitle: 'Simulations par Classe de Moteur',
      topShapesTitle: 'Géométries de Grain Favorites',
      topPropsTitle: 'Propergols les Plus Utilisés',
      noSimDataYet: 'Lancez au moins une simulation pour afficher vos distributions.',
      monthlyTitle: 'Tendance et Détail Mensuel',
      selectMonth: 'Mois :',
      monthCol: 'Mois',
      sessionsCol: 'Sessions',
      timeCol: 'Temps',
      simsCol: 'Simulations',
      searchCol: 'Smart Search',
      flightsCol: 'Vols',
      exportsCol: 'Exports',
      tabsTitle: 'Utilisation par Vue (9 Vues)',
      visitsWord: 'visites',
      envTitle: 'Environnement & Modules',
      execMode: 'Mode d’Exécution',
      osLabel: 'Système',
      langLabel: 'Langue Active',
      modulesLabel: 'Modules Installés',
      modCore: 'Simulation + 3D/CFD',
      modPost: 'Post-Traitement',
      modAi: 'Agent Jesús IA',
      activeTag: 'Actif',
      lockedTag: 'Verrouillé',
      downloadJson: 'Télécharger JSON',
      resetBtn: 'Réinitialiser',
      closeBtn: 'Fermer',
      tabLabels: {
        inputs: 'Entrées (Inputs)',
        results: 'Résultats',
        analysis: 'Analyse Détaillée',
        mission_control: 'Mission Control',
        smart_search: 'Smart Search',
        cfd: 'Animation 3D / CFD',
        study: 'Post-Process · Étude',
        propellant_char: 'Post-Process · Propergol',
        agente_jesus: 'Agent Jesús IA',
      } as Record<TelemetryTabId, string>,
    };
  }

  if (isIt) {
    return {
      title: 'Statistiche d’Uso e Ingegneria',
      privateBadge: '100% Privato sul tuo PC',
      subtitle: 'Telemetria locale, abitudini di progettazione e record in HERMES Simulator',
      privacyTitle: 'Le tue statistiche appartengono solo a te',
      privacyDesc:
        'Nessun dato viene inviato in background. Se lo desideri, puoi inviare volontariamente il report mensile al team COHETEROS.',
      sendEmail: 'Invia Report a info@coheteros.com',
      refresh: 'Aggiorna',
      resetConfirm: 'Sei sicuro di voler azzerare tutte le statistiche locali?',
      resetYes: 'Sì, azzera',
      cancel: 'Annulla',
      lifetimeTitle: 'Totali Complessivi',
      installedOn: 'Primo avvio:',
      kpiSessions: 'Sessioni',
      kpiDaysActive: 'giorni attivi',
      kpiTime: 'Tempo Attivo',
      kpiAvgSession: 'media/sessione',
      kpiSims: 'Simulazioni',
      kpiSafeRate: 'integrità OK',
      kpiSmartSearch: 'Smart Search',
      kpiApplied: 'applicate',
      kpiFlights: 'Voli M. Control',
      kpiTrajectories: 'traiettorie',
      kpiCustomAssets: 'Asset Creati',
      kpiPropAndGrains: 'prop. / grani',
      kpiExports: 'Esportazioni',
      kpiGuides: 'Guide Completate',
      kpiTours: 'tour guidati',
      recordsTitle: 'Record Personali di Progetto',
      recImpulse: 'Impulso Totale Max',
      recThrust: 'Spinta Massima',
      recPressure: 'Pressione Camera Max',
      recIsp: 'Miglior Isp',
      recApogee: 'Apogeo Simulato Max',
      classBadge: 'Classe',
      safeTag: 'Sicuro',
      overpTag: 'Sovrapressione',
      distTitle: 'Profilo di Ingegneria Aerospaziale',
      classChartTitle: 'Simulazioni per Classe Motore',
      topShapesTitle: 'Geometrie Grano Preferite',
      topPropsTitle: 'Propellenti Più Usati',
      noSimDataYet: 'Esegui almeno una simulazione per vedere le distribuzioni.',
      monthlyTitle: 'Andamento e Dettaglio Mensile',
      selectMonth: 'Mese:',
      monthCol: 'Mese',
      sessionsCol: 'Sessioni',
      timeCol: 'Tempo',
      simsCol: 'Simulazioni',
      searchCol: 'Smart Search',
      flightsCol: 'Voli',
      exportsCol: 'Esportazioni',
      tabsTitle: 'Utilizzo per Vista (9 Viste)',
      visitsWord: 'visite',
      envTitle: 'Ambiente e Moduli',
      execMode: 'Modalità Esecuzione',
      osLabel: 'Sistema Operativo',
      langLabel: 'Lingua Attiva',
      modulesLabel: 'Moduli Installati',
      modCore: 'Simulazione + 3D/CFD',
      modPost: 'Post-Elaborazione',
      modAi: 'Agente Jesús IA',
      activeTag: 'Attivo',
      lockedTag: 'Bloccato',
      downloadJson: 'Scarica JSON',
      resetBtn: 'Azzera',
      closeBtn: 'Chiudi',
      tabLabels: {
        inputs: 'Input Motore',
        results: 'Risultati',
        analysis: 'Analisi Dettagliata',
        mission_control: 'Mission Control',
        smart_search: 'Smart Search',
        cfd: 'Animazione 3D / CFD',
        study: 'Post-Process · Studio',
        propellant_char: 'Post-Process · Propellente',
        agente_jesus: 'Agente Jesús IA',
      } as Record<TelemetryTabId, string>,
    };
  }

  return {
    title: 'Usage & Engineering Analytics',
    privateBadge: '100% Private on Device',
    subtitle: 'Local workflow telemetry, propulsion design habits & personal records in HERMES',
    privacyTitle: 'Your statistics belong solely to you',
    privacyDesc:
      'HERMES never sends background telemetry. You can voluntarily email your monthly engineering summary to the COHETEROS team at any time.',
    sendEmail: 'Send Report to info@coheteros.com',
    refresh: 'Refresh',
    resetConfirm: 'Are you sure you want to reset all local usage and engineering statistics?',
    resetYes: 'Yes, reset',
    cancel: 'Cancel',
    lifetimeTitle: 'Lifetime Summary',
    installedOn: 'First launch:',
    kpiSessions: 'Sessions',
    kpiDaysActive: 'active days',
    kpiTime: 'Active Time',
    kpiAvgSession: 'avg/session',
    kpiSims: 'Simulations',
    kpiSafeRate: 'safe casing',
    kpiSmartSearch: 'Smart Search',
    kpiApplied: 'applied',
    kpiFlights: 'Mission Flights',
    kpiTrajectories: 'trajectories',
    kpiCustomAssets: 'Custom Assets',
    kpiPropAndGrains: 'prop. / grains',
    kpiExports: 'Exports',
    kpiGuides: 'Guides Done',
    kpiTours: 'interactive tours',
    recordsTitle: 'Personal Design Records',
    recImpulse: 'Peak Total Impulse',
    recThrust: 'Peak Thrust',
    recPressure: 'Peak Chamber Pressure',
    recIsp: 'Best Specific Impulse',
    recApogee: 'Peak Simulated Apogee',
    classBadge: 'Class',
    safeTag: 'Safe',
    overpTag: 'Overpressure',
    distTitle: 'Aerospace Design Profile',
    classChartTitle: 'Simulations by Motor Class',
    topShapesTitle: 'Favorite Grain Geometries',
    topPropsTitle: 'Most Used Propellants',
    noSimDataYet: 'Run at least one motor simulation to populate your engineering distributions.',
    monthlyTitle: 'Monthly Trend & Breakdown',
    selectMonth: 'Month:',
    monthCol: 'Month',
    sessionsCol: 'Sessions',
    timeCol: 'Time',
    simsCol: 'Simulations',
    searchCol: 'Smart Search',
    flightsCol: 'Flights',
    exportsCol: 'Exports',
    tabsTitle: 'Navigation by View (9 Views)',
    visitsWord: 'visits',
    envTitle: 'Environment & Modules',
    execMode: 'Runtime Mode',
    osLabel: 'Operating System',
    langLabel: 'Active Language',
    modulesLabel: 'Installed Modules',
    modCore: 'Simulation + 3D/CFD',
    modPost: 'Post-Processing',
    modAi: 'Agent Jesús AI',
    activeTag: 'Active',
    lockedTag: 'Locked',
    downloadJson: 'Download JSON',
    resetBtn: 'Reset',
    closeBtn: 'Close',
    tabLabels: {
      inputs: 'Motor Inputs',
      results: 'Results',
      analysis: 'Detailed Analysis',
      mission_control: 'Mission Control',
      smart_search: 'Smart Search',
      cfd: '3D / CFD Animation',
      study: 'Post-Process · Study',
      propellant_char: 'Post-Process · Propellant Lab',
      agente_jesus: 'Agent Jesús AI',
    } as Record<TelemetryTabId, string>,
  };
}

export const UsageAnalyticsModal: React.FC<UsageAnalyticsModalProps> = ({
  isOpen,
  onClose,
  lang = 'es',
}) => {
  const [metrics, setMetrics] = useState<TelemetryMetrics>(() => loadTelemetryData());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Always reload live localStorage data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fresh = loadTelemetryData();
    setMetrics(fresh);
    setShowResetConfirm(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const labels = useMemo(() => getLabels(lang), [lang]);
  const installedModules = useMemo(() => getInstalledModules(), [isOpen]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    setMetrics(loadTelemetryData());
  };

  const handleSendEmail = () => {
    const subjectPrefix =
      lang === 'es'
        ? 'Informe Mensual de Uso e Ingeniería HERMES'
        : lang === 'fr'
          ? 'Rapport Mensuel HERMES'
          : lang === 'it'
            ? 'Report Mensile HERMES'
            : 'HERMES Monthly Usage & Engineering Report';
    const subject = encodeURIComponent(`${subjectPrefix} - ${selectedMonth}`);
    const body = encodeURIComponent(generateMonthlyEmailBody(metrics, lang));
    window.location.href = `mailto:info@coheteros.com?subject=${subject}&body=${body}`;
  };

  const handleDownloadJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metrics, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `hermes_analytics_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleReset = () => {
    const fresh = resetTelemetryMetrics(lang);
    setMetrics(fresh);
    setShowResetConfirm(false);
  };

  const totalTabVisits =
    Object.values(metrics.tabVisits).reduce((a, b) => a + (Number(b) || 0), 0) || 1;

  const locale =
    lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : lang === 'it' ? 'it-IT' : 'en-US';
  const installDateStr = new Date(metrics.firstLaunchDate).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const monthsAvailable = Object.keys(metrics.monthlyLog).sort().reverse();
  const currentMonthData = metrics.monthlyLog[selectedMonth] || {
    launches: 0,
    simulations: 0,
    smartSearches: 0,
    flights: 0,
    exports: 0,
    activeSeconds: 0,
  };

  const monthlyChartData = Object.keys(metrics.monthlyLog)
    .sort()
    .slice(-6)
    .map((mKey) => {
      const entry = metrics.monthlyLog[mKey];
      return {
        month: mKey,
        Simulations: entry.simulations,
        SmartSearch: entry.smartSearches,
        Flights: entry.flights,
        Exports: entry.exports,
      };
    });

  const classChartData = Object.entries(metrics.motorClassCounts)
    .sort((a, b) => {
      const ia = MOTOR_CLASS_ORDER.indexOf(a[0]);
      const ib = MOTOR_CLASS_ORDER.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([cls, count]) => ({ motorClass: cls, count }));

  const topShapes = Object.entries(metrics.grainShapeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalShapeHits = topShapes.reduce((acc, [, v]) => acc + v, 0) || 1;

  const topPropellants = Object.entries(metrics.propellantUsageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalPropHits = topPropellants.reduce((acc, [, v]) => acc + v, 0) || 1;

  const safeTotal = metrics.totalSafeSimulations + metrics.totalOverpressureSimulations;
  const safeRatePct =
    safeTotal > 0 ? Math.round((metrics.totalSafeSimulations / safeTotal) * 100) : 100;

  const avgSessionSec =
    metrics.totalLaunches > 0 ? Math.round(metrics.totalActiveSeconds / metrics.totalLaunches) : 0;

  const sortedTabs = (Object.entries(metrics.tabVisits) as [TelemetryTabId, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 md:p-5 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card-header text-card-header-foreground shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-primary shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-bold text-foreground truncate">
                  {labels.title}
                </h2>
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  · <ShieldCheck className="w-3.5 h-3.5" /> {labels.privateBadge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{labels.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              title={labels.refresh}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background/70 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{labels.refresh}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              aria-label={labels.closeBtn}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Privacy Notice & Email Report Button */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-foreground max-w-xl">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-xs text-foreground">{labels.privacyTitle}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {labels.privacyDesc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendEmail}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{labels.sendEmail}</span>
            </button>
          </div>

          {/* Reset Confirmation */}
          {showResetConfirm && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs font-medium">{labels.resetConfirm}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md cursor-pointer"
                >
                  {labels.resetYes}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-md border border-border cursor-pointer"
                >
                  {labels.cancel}
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: LIFETIME KPI SUMMARY (8 CARDS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  {labels.lifetimeTitle}
                </h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {labels.installedOn} {installDateStr}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiSessions}</span>
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {metrics.totalLaunches}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {metrics.activeDays.length} {labels.kpiDaysActive}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiTime}</span>
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
                  {formatDurationCompact(metrics.totalActiveSeconds)}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {formatDurationCompact(avgSessionSec)} {labels.kpiAvgSession}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiSims}</span>
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {metrics.totalSimulationsRun}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {safeRatePct}% {labels.kpiSafeRate}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiSmartSearch}</span>
                  <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                  {metrics.totalSmartSearchesRun}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {metrics.totalSmartSearchApplied} {labels.kpiApplied}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiFlights}</span>
                  <Rocket className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
                  {metrics.totalFlightSimsRun}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {labels.kpiTrajectories}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiCustomAssets}</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {metrics.totalCustomPropellantsCreated + metrics.totalCustomGrainsCreated}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {metrics.totalCustomPropellantsCreated} / {metrics.totalCustomGrainsCreated}{' '}
                  {labels.kpiPropAndGrains}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiExports}</span>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                  {metrics.totalExportsCount}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                  PDF {metrics.exportBreakdown.pdf + metrics.exportBreakdown.study_pdf} · XLSX{' '}
                  {metrics.exportBreakdown.xlsx} · CSV {metrics.exportBreakdown.csv} · .hrms{' '}
                  {metrics.exportBreakdown.hrms}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>{labels.kpiGuides}</span>
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-primary">
                  {metrics.totalGuidesCompleted}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  {labels.kpiTours}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: PERSONAL ENGINEERING RECORDS (HALL OF FAME) */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/15 border border-border">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                {labels.recordsTitle}
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {labels.recImpulse}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground block mt-0.5">
                  {metrics.records.maxImpulseNs
                    ? `${metrics.records.maxImpulseNs.value.toFixed(1)} N·s`
                    : '---'}
                </span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                  {metrics.records.maxImpulseNs
                    ? `${labels.classBadge} ${metrics.records.maxImpulseNs.motorClass}`
                    : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {labels.recThrust}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground block mt-0.5">
                  {metrics.records.maxThrustN
                    ? `${metrics.records.maxThrustN.value.toFixed(1)} N`
                    : '---'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {metrics.records.maxBurnTimeS
                    ? `t_b max: ${metrics.records.maxBurnTimeS.value.toFixed(2)} s`
                    : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {labels.recPressure}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground block mt-0.5">
                  {metrics.records.maxPressureMPa
                    ? `${metrics.records.maxPressureMPa.value.toFixed(2)} MPa`
                    : '---'}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    metrics.records.maxPressureMPa
                      ? metrics.records.maxPressureMPa.safe
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500'
                      : 'text-muted-foreground'
                  }`}
                >
                  {metrics.records.maxPressureMPa
                    ? metrics.records.maxPressureMPa.safe
                      ? labels.safeTag
                      : labels.overpTag
                    : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {labels.recIsp}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground block mt-0.5">
                  {metrics.records.maxIspS ? `${metrics.records.maxIspS.value.toFixed(1)} s` : '---'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Delivered Isp</span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {labels.recApogee}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground block mt-0.5">
                  {metrics.records.maxApogeeM
                    ? `${Math.round(metrics.records.maxApogeeM.value).toLocaleString()} m`
                    : '---'}
                </span>
                <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400">
                  {metrics.records.maxMach
                    ? `Peak Mach ${metrics.records.maxMach.value.toFixed(2)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3: AEROSPACE DISTRIBUTIONS */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/15 border border-border">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                {labels.distTitle}
              </h3>
            </div>

            {metrics.totalSimulationsRun === 0 && classChartData.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-muted-foreground border border-dashed border-border rounded-lg bg-card/40">
                {labels.noSimDataYet}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Motor Class Bar Chart */}
                <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col">
                  <span className="text-xs font-semibold text-foreground mb-2">
                    {labels.classChartTitle}
                  </span>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classChartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="motorClass" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            fontSize: '11px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--card)',
                            color: 'var(--foreground)',
                          }}
                        />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Grain Shapes */}
                <div className="p-3.5 rounded-lg bg-card border border-border space-y-2.5">
                  <span className="text-xs font-semibold text-foreground block">
                    {labels.topShapesTitle}
                  </span>
                  {topShapes.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-mono">---</p>
                  ) : (
                    topShapes.map(([shapeName, count]) => {
                      const pct = Math.round((count / totalShapeHits) * 100);
                      return (
                        <div key={shapeName} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono tabular-nums">
                            <span className="text-foreground truncate">{shapeName}</span>
                            <span className="text-muted-foreground">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-xs overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-xs transition-all duration-500"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Top Propellants */}
                <div className="p-3.5 rounded-lg bg-card border border-border space-y-2.5">
                  <span className="text-xs font-semibold text-foreground block">
                    {labels.topPropsTitle}
                  </span>
                  {topPropellants.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-mono">---</p>
                  ) : (
                    topPropellants.map(([propName, count]) => {
                      const pct = Math.round((count / totalPropHits) * 100);
                      return (
                        <div key={propName} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono tabular-nums">
                            <span className="text-foreground truncate">{propName}</span>
                            <span className="text-muted-foreground">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-xs overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-xs transition-all duration-500"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: MONTHLY ACTIVITY TREND & BREAKDOWN */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/15 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  {labels.monthlyTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{labels.selectMonth}</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-background text-foreground font-mono font-semibold border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
                >
                  {monthsAvailable.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Month Highlight Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.sessionsCol} ({selectedMonth})
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-foreground mt-0.5 block">
                  {currentMonthData.launches}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.timeCol} ({selectedMonth})
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-0.5 block">
                  {formatDurationCompact(currentMonthData.activeSeconds)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.simsCol}
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {currentMonthData.simulations}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.searchCol}
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 mt-0.5 block">
                  {currentMonthData.smartSearches}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.flightsCol}
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400 mt-0.5 block">
                  {currentMonthData.flights}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">
                  {labels.exportsCol}
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5 block">
                  {currentMonthData.exports}
                </span>
              </div>
            </div>

            {/* Monthly Visual Trend Chart */}
            {monthlyChartData.length > 0 && (
              <div className="p-3 rounded-lg bg-card border border-border h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        fontSize: '11px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--card)',
                        color: 'var(--foreground)',
                      }}
                    />
                    <Bar dataKey="Simulations" name={labels.simsCol} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="SmartSearch" name={labels.searchCol} fill="#06b6d4" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Flights" name={labels.flightsCol} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Exports" name={labels.exportsCol} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly History Table */}
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-card-header border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">{labels.monthCol}</th>
                    <th className="py-2.5 px-3">{labels.sessionsCol}</th>
                    <th className="py-2.5 px-3">{labels.timeCol}</th>
                    <th className="py-2.5 px-3">{labels.simsCol}</th>
                    <th className="py-2.5 px-3">{labels.searchCol}</th>
                    <th className="py-2.5 px-3">{labels.flightsCol}</th>
                    <th className="py-2.5 px-3">{labels.exportsCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {monthsAvailable.map((mKey) => {
                    const log = metrics.monthlyLog[mKey];
                    const isSelected = mKey === selectedMonth;
                    return (
                      <tr
                        key={mKey}
                        onClick={() => setSelectedMonth(mKey)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/40'
                        }`}
                      >
                        <td
                          className={`py-2.5 px-3 font-mono ${
                            isSelected ? 'text-primary font-bold' : 'text-foreground'
                          }`}
                        >
                          {mKey}
                        </td>
                        <td className="py-2.5 px-3">{log.launches}</td>
                        <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">
                          {formatDurationCompact(log.activeSeconds)}
                        </td>
                        <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">
                          {log.simulations}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400">
                          {log.smartSearches}
                        </td>
                        <td className="py-2.5 px-3 text-violet-600 dark:text-violet-400">
                          {log.flights}
                        </td>
                        <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">
                          {log.exports}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 5: 9-VIEW NAVIGATION & ENVIRONMENT DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 rounded-xl bg-muted/15 border border-border space-y-3">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                {labels.tabsTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                {sortedTabs.map(([tabKey, visits]) => {
                  const percentage = Math.round((visits / totalTabVisits) * 100);
                  return (
                    <div key={tabKey} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono tabular-nums gap-2">
                        <span className="font-medium text-foreground truncate">
                          {labels.tabLabels[tabKey] || tabKey}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {visits} {labels.visitsWord} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-xs overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-primary rounded-xs transition-all duration-500"
                          style={{ width: `${Math.max(percentage, visits > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-2.5">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                {labels.envTitle}
              </h3>

              <div className="p-2.5 rounded-lg bg-card border border-border text-xs">
                <span className="text-muted-foreground block text-[10px]">{labels.execMode}</span>
                <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                  <Monitor className="w-3.5 h-3.5 text-primary" />
                  {metrics.isElectron ? 'Electron Desktop (.exe)' : 'Web Browser'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">{labels.osLabel}</span>
                  <span className="font-medium text-foreground mt-0.5 block font-mono truncate">
                    {metrics.osPlatform}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">{labels.langLabel}</span>
                  <span className="font-medium text-foreground flex items-center gap-1 mt-0.5 font-mono">
                    <Globe className="w-3 h-3 text-emerald-500" />
                    {metrics.activeLanguage.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-card border border-border text-xs space-y-1.5">
                <span className="text-muted-foreground block text-[10px] font-mono">
                  {labels.modulesLabel}
                </span>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground">{labels.modCore}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {labels.activeTag}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground">{labels.modPost}</span>
                  <span
                    className={`font-mono flex items-center gap-1 ${
                      installedModules.postprocess
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-500'
                    }`}
                  >
                    {!installedModules.postprocess && <Lock className="w-3 h-3" />}
                    {installedModules.postprocess ? labels.activeTag : labels.lockedTag}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground">{labels.modAi}</span>
                  <span
                    className={`font-mono flex items-center gap-1 ${
                      installedModules.agente_jesus
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-500'
                    }`}
                  >
                    {!installedModules.agente_jesus && <Lock className="w-3 h-3" />}
                    {installedModules.agente_jesus ? labels.activeTag : labels.lockedTag}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-border bg-card-header text-xs text-muted-foreground shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono">HERMES Usage & Engineering Analytics v2.1.0</span>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="text-muted-foreground hover:text-foreground underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> {labels.downloadJson}
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-red-500 hover:text-red-600 underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> {labels.resetBtn}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border font-medium transition-colors cursor-pointer"
          >
            {labels.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
