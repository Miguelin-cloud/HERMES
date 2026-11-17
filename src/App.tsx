import React, { Suspense, lazy, useState, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SimulationResults } from './lib/types';
import {
  calculateMotorStructure,
  calculateTotalPropellantMassKg,
  normalizeMotorWithStructure,
  validateMotorInputs,
} from './lib/motorStructure';
import { runSimulation } from './lib/simulator';
import { ApogeeResult, calculateApogee } from './lib/apogee';
import {
  Download,
  BookOpen,
  FolderOpen,
  AlertTriangle,
  Settings,
  Save,
} from 'lucide-react';

import { MotorInputsPanel } from './components/MotorInputsPanel';
import { SimulationResultsPanel } from './components/SimulationResultsPanel';
import { SimulationModals } from './components/SimulationModals';
import { MissionControl, loadSavedMissionControlParams } from './components/MissionControl';
import { DetailedAnalysisView } from './components/DetailedAnalysisView';
import { SmartSearchEngine } from './components/SmartSearchEngine';
import { SplashScreen } from './components/SplashScreen';
import { VersionHistoryBook } from './components/VersionHistoryBook';
import { GuideBookModal } from './components/GuideBookModal';
import { InteractiveTourOverlay, TourSequence } from './components/InteractiveTourOverlay';
import { getTourSequences } from './lib/toursData';
import { CustomPropellantModal } from './components/CustomPropellantModal';
import { Language, translations } from './lib/i18n';
import { Logo } from './components/Logo';
import { recordAppLaunch, trackTabVisit, trackEvent } from './lib/telemetry';
import { UsageAnalyticsModal } from './components/UsageAnalyticsModal';
import { useSimulationStorage } from './hooks/useSimulationStorage';
import { getInstalledModules } from './lib/modules';
import { ModuleNotInstalledNotice } from './components/ModuleNotInstalledNotice';
import { SettingsMenu } from './components/SettingsMenu';
import { ErrorBoundary } from './components/ErrorBoundary';

const PlaybackWrapper = lazy(() =>
  import('./components/PlaybackWrapper').then((m) => ({ default: m.PlaybackWrapper }))
);
const FlightViewer = lazy(() =>
  import('./components/FlightViewer').then((m) => ({ default: m.FlightViewer }))
);
const AgenteJesusPanel = lazy(() =>
  import('./components/RoadmapPreviewTabs').then((m) => ({ default: m.AgenteJesusPanel }))
);
const PropellantCharacterizationPanel = lazy(() =>
  import('./components/RoadmapPreviewTabs').then((m) => ({ default: m.PropellantCharacterizationPanel }))
);

export default function App() {
  const installedModules = useMemo(() => getInstalledModules(), []);
  const [activeTabState, setActiveTabState] = useState('inputs');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const activeTab = activeTabState;
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    trackTabVisit(tab);
  };

  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    recordAppLaunch(lang);
  }, []);

  const {
    theme,
    themeConfig,
    selectThemePreset,
    updateThemeColor,
    resetThemeToPreset,
    cursor,
    setCursor,
    cursorClass,
    savedSimulations,
    setSavedSimulations,
    motor,
    setMotor,
    nozzle,
    setNozzle,
    grains,
    setGrains,
    addGrain,
    removeGrain,
    slagMode,
    setSlagMode,
    slagMagnitudeStr,
    setSlagMagnitudeStr,
    isEditingSlagRef,
    customPropellants,
    handleSavePropellants: persistPropellants,
  } = useSimulationStorage();

  const [showSplash, setShowSplash] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showCfdInfo, setShowCfdInfo] = useState(false);
  const [showPadmInfo, setShowPadmInfo] = useState(false);
  const [simApogee, setSimApogee] = useState<ApogeeResult | null>(null);
  const [expApogee, setExpApogee] = useState<ApogeeResult | null>(null);
  const missionControlManagedRef = useRef(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exportData, setExportData] = useState<any[] | null>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveFolder, setSaveFolder] = useState('General');
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [simToDelete, setSimToDelete] = useState<string | null>(null);

  const [showGuideBook, setShowGuideBook] = useState(false);
  const [activeTourSequence, setActiveTourSequence] = useState<TourSequence | null>(null);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const [showPropellantModal, setShowPropellantModal] = useState<boolean>(false);
  const [targetGrainForModal, setTargetGrainForModal] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResults | null>(null);

  useEffect(() => {
    const handleOpenPropellant = (e?: Event) => {
      setShowPropellantModal(true);
      if ((e as CustomEvent)?.detail?.startEditor) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('hermes-start-new-propellant-editor'));
        }, 100);
      }
    };
    const handleClosePropellant = () => setShowPropellantModal(false);
    window.addEventListener('hermes-open-propellant-modal', handleOpenPropellant);
    window.addEventListener('hermes-close-propellant-modal', handleClosePropellant);
    return () => {
      window.removeEventListener('hermes-open-propellant-modal', handleOpenPropellant);
      window.removeEventListener('hermes-close-propellant-modal', handleClosePropellant);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  const handleSelectPropellantForGrain = (propellantId: number) => {
    if (targetGrainForModal) {
      setGrains(grains.map((g) => (g.id === targetGrainForModal ? { ...g, propellantType: propellantId } : g)));
      setTargetGrainForModal(null);
    }
  };

  const motorStruct = useMemo(() => calculateMotorStructure(motor), [motor]);

  const totalPropellantMassKg = useMemo(
    () => calculateTotalPropellantMassKg(grains, customPropellants),
    [grains, customPropellants]
  );

  const motorValidation = useMemo(
    () => validateMotorInputs(motor, grains, nozzle, motorStruct),
    [motor, grains, nozzle, motorStruct]
  );

  const isOverpressure = Boolean(
    results && motorStruct.maxAdmissiblePressureMPa > 0 && results.summary.Pmax_MPa > motorStruct.maxAdmissiblePressureMPa
  );

  // Keep baseline trajectory synced across tab switches when Mission Control hasn't overridden it
  useEffect(() => {
    if (!results) {
      setSimApogee(null);
      return;
    }
    const mcSaved = loadSavedMissionControlParams();
    const expectedDiamM = Math.max(0.02, (mcSaved.rocketDiameter || motorStruct.outerDiameterMm) / 1000);
    const isStaleVsSaved =
      !simApogee ||
      Math.abs((simApogee.flightPathAngleDeg ?? 90) - mcSaved.flightPathAngle) > 1e-4 ||
      Math.abs((simApogee.launchAltitudeM ?? 169) - mcSaved.launchAltitude) > 1e-4 ||
      Math.abs((simApogee.rocketDiameterM ?? 0.08) - expectedDiamM) > 1e-5;

    if (missionControlManagedRef.current && (!isStaleVsSaved || activeTab === 'mission_control')) return;

    const totalDryMass = mcSaved.emptyRocketMass + motorStruct.motorMassKg;
    const baseline = calculateApogee(
      results.t,
      results.E_N,
      results.mgra_total.map((mg) => mg + totalDryMass),
      totalDryMass,
      expectedDiamM,
      mcSaved.launchAltitude,
      mcSaved.launchTemp,
      undefined,
      undefined,
      mcSaved.flightPathAngle
    );
    setSimApogee(baseline);
  }, [results, motorStruct.motorMassKg, motorStruct.outerDiameterMm, activeTab]);

  const t = translations[lang];

  const simulate = () => {
    try {
      setSimulationError(null);
      const res = runSimulation({ motor, nozzle, grains, customPropellants });
      setResults(res);
      setActiveTab('results');
      trackEvent('simulation');
    } catch (err) {
      console.error(err);
      setSimulationError(t.sim_error_msg);
    }
  };

  const handleApplySmartSearchConfiguration = (newMotor: any, newNozzle: any, newGrains: any[]) => {
    const mergedMotor = normalizeMotorWithStructure({
      ...motor,
      ...newMotor,
    });
    setMotor(mergedMotor);
    setNozzle(newNozzle);
    setGrains(newGrains);
    trackEvent('smart_search');
    try {
      const res = runSimulation({ motor: mergedMotor, nozzle: newNozzle, grains: newGrains, customPropellants });
      setResults(res);
      trackEvent('simulation');
    } catch (err) {
      console.error(err);
    }
    setActiveTab('inputs');
  };

  const handleApplyPresetMotor = (type: 'bates_j' | 'star_k' | 'apcp_l' | 'nozzle_opt') => {
    if (type === 'bates_j') {
      const newMotor = normalizeMotorWithStructure({ ...motor, Dc: 60.5, Lc: 483, Gstar: 2.0, kv: 0, etac: 0.9, paso_de_tiempo: 0.0005, Pamb: 0.101325 });
      const newNozzle = { Dt0: 17.5, Ds: 38.0, e: 0, alpha: 14, etanoz: 0.88 };
      const newGrains = [
        { id: 'bates-1', shape: 1 as const, propellantType: 1, D0: 56, d0: 22, d0mayor: 0, L0: 75, N: 4, Np: 0, osi: 0, ci: 1, ei: 1, rhorat: 0.95 },
      ];
      setMotor(newMotor);
      setNozzle(newNozzle);
      setGrains(newGrains);
      try {
        setResults(runSimulation({ motor: newMotor, nozzle: newNozzle, grains: newGrains, customPropellants }));
      } catch {}
    } else if (type === 'star_k') {
      const newMotor = normalizeMotorWithStructure({ ...motor, Dc: 75.0, Lc: 360, Gstar: 2.2, kv: 0, etac: 0.92, paso_de_tiempo: 0.0005, Pamb: 0.101325 });
      const newNozzle = { Dt0: 22.0, Ds: 48.0, e: 0, alpha: 14, etanoz: 0.85 };
      const newGrains = [
        { id: 'star-1', shape: 2 as const, propellantType: 2, D0: 70, d0: 20, d0mayor: 50, L0: 300, N: 1, Np: 5, osi: 0, ci: 1, ei: 0, rhorat: 0.94 },
      ];
      setMotor(newMotor);
      setNozzle(newNozzle);
      setGrains(newGrains);
      try {
        setResults(runSimulation({ motor: newMotor, nozzle: newNozzle, grains: newGrains, customPropellants }));
      } catch {}
    } else if (type === 'apcp_l') {
      const newMotor = normalizeMotorWithStructure({ ...motor, Dc: 98.0, Lc: 650, Gstar: 2.5, kv: 0, etac: 0.95, paso_de_tiempo: 0.0005, Pamb: 0.101325 });
      const newNozzle = { Dt0: 28.0, Ds: 68.0, e: 0, alpha: 15, etanoz: 0.9 };
      const newGrains = [
        { id: 'apcp-1', shape: 1 as const, propellantType: 4, D0: 92, d0: 32, d0mayor: 0, L0: 140, N: 4, Np: 0, osi: 0, ci: 1, ei: 1, rhorat: 0.97 },
      ];
      setMotor(newMotor);
      setNozzle(newNozzle);
      setGrains(newGrains);
      try {
        setResults(runSimulation({ motor: newMotor, nozzle: newNozzle, grains: newGrains, customPropellants }));
      } catch {}
    } else if (type === 'nozzle_opt') {
      setNozzle((prev) => ({ ...prev, Dt0: 17.5, Ds: 38.0, alpha: 14, e: 0 }));
    }
    setActiveTab('inputs');
  };

  const tourSequences = useMemo(() => {
    return getTourSequences(lang, {
      setGrains,
      setMotor,
      setNozzle,
      runSim: simulate,
    });
  }, [lang, customPropellants, motor, nozzle, grains]);

  const handleStartTour = (tourId: string) => {
    const seq = tourSequences[tourId];
    if (seq) {
      setActiveTourSequence(seq);
      setTourStepIndex(0);
      setShowGuideBook(false);
    }
  };

  const prepareExport = (res: SimulationResults) => {
    const data: any[] = [];
    const summaryRows = [
      ['Motor Class', res.summary.motorClass, ''],
      ['Total Impulse (IT)', (res.summary.It_total_N_s || 0).toFixed(2), 'N·s'],
      ['Specific Impulse (ISP)', (res.summary.Isp_total_s || 0).toFixed(2), 's'],
      ['Burn Time', (res.summary.t_quemado || 0).toFixed(3), 's'],
      ['Action Time', (res.summary.t_fin || 0).toFixed(3), 's'],
      ['Max Pressure', (res.summary.Pmax_MPa || 0).toFixed(4), 'MPa'],
      ['Avg Pressure', (res.summary.Pmed_MPa || 0).toFixed(4), 'MPa'],
      ['Max Thrust', (res.summary.Fmax_N || 0).toFixed(2), 'N'],
      ['Avg Thrust', (res.summary.Fmed_N || 0).toFixed(2), 'N'],
    ];

    const maxRows = Math.max(res.t.length, summaryRows.length);

    for (let i = 0; i < maxRows; i++) {
      const row: any = {};
      if (i < res.t.length) {
        row['Time (s)'] = Number((res.t[i] || 0).toFixed(4));
        const p_mpa = Math.max(0, res.P0_gage[i] || 0);
        row['Pressure (MPa)'] = Number(p_mpa.toFixed(4));
        row['Pressure (bar)'] = Number((p_mpa * 10).toFixed(4));
        row['Pressure (atm)'] = Number((p_mpa * 9.86923).toFixed(4));
        const f_rn = Math.max(0, res.F_N[i] || 0);
        row['Thrust RN (N)'] = Number(f_rn.toFixed(2));
        row['Thrust RN (kg)'] = Number((f_rn / 9.81).toFixed(2));
        const f_tti = Math.max(0, res.E_N[i] || 0);
        row['Thrust TTI (N)'] = Number(f_tti.toFixed(2));
        row['Thrust TTI (kg)'] = Number((f_tti / 9.81).toFixed(2));
        row['Mass Flow (kg/s)'] = Number((res.mgra_total[i] || 0).toFixed(4));
      } else {
        row['Time (s)'] = '';
        row['Pressure (MPa)'] = '';
        row['Pressure (bar)'] = '';
        row['Pressure (atm)'] = '';
        row['Thrust RN (N)'] = '';
        row['Thrust RN (kg)'] = '';
        row['Thrust TTI (N)'] = '';
        row['Thrust TTI (kg)'] = '';
        row['Mass Flow (kg/s)'] = '';
      }

      row[''] = '';

      if (i < summaryRows.length) {
        row['Summary Metric'] = summaryRows[i][0];
        row['Value'] = summaryRows[i][1];
        row['Unit'] = summaryRows[i][2];
      } else {
        row['Summary Metric'] = '';
        row['Value'] = '';
        row['Unit'] = '';
      }

      data.push(row);
    }

    setExportData(data);
    setExportFilename(`HERMES_Results_${motor.Dc}mm`);
    setShowExportModal(true);
  };

  return (
    <div className={`min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden ${cursorClass}`}>
      {showSplash && <SplashScreen lang={lang} onComplete={() => setShowSplash(false)} />}

      <header className="bg-card border-b border-border text-card-foreground py-2.5 px-4 md:px-6 flex justify-between items-center gap-4 shrink-0 relative z-20 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-slate-950 p-1 rounded-lg border border-border/80 shrink-0 flex items-center justify-center">
            <Logo size={38} className="text-slate-100" theme="dark" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-foreground">{t.title.split(' ')[0]}</span>
              <span className="text-primary font-semibold hidden sm:inline">
                {t.title.substring(t.title.indexOf(' ') + 1)}
              </span>
            </h1>
            <p className="text-[10px] md:text-[11px] text-muted-foreground font-mono tracking-wider uppercase truncate">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5">
            <Button
              data-tour="save-sim-btn"
              variant="outline"
              onClick={() => setShowSaveModal(true)}
              className="h-8 text-xs font-medium px-2.5 gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t.save_btn}</span>
            </Button>

            <Button
              data-tour="library-btn"
              variant="outline"
              onClick={() => setShowLibraryModal(true)}
              className="h-8 text-xs font-medium px-2.5 gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t.library_btn}</span>
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuideBook(true)}
            title={t.guide_book_tooltip}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">{t.guide_book_btn}</span>
          </Button>

          {showInstallBtn && (
            <Button
              onClick={handleInstallClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/40 h-8 text-xs font-semibold px-2.5 gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.install_app_btn}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsMenu(true)}
            title={t.settings_title}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">{t.settings_btn}</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-2 md:p-4 max-w-[1600px] mx-auto w-full flex flex-col relative z-0">
        {simulationError && (
          <div className="mb-2 flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{simulationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSimulationError(null)}
              className="px-2 py-0.5 rounded hover:bg-red-500/20 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full min-h-0">
          <div className="flex justify-between items-center mb-1.5 shrink-0 overflow-x-auto gap-3">
            <TabsList className="flex h-9 w-max shrink-0 bg-muted/75 border border-border rounded-lg p-1 gap-1">
              <TabsTrigger
                value="inputs"
                data-tour="tab-trigger-inputs"
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t.inputs}
              </TabsTrigger>
              <TabsTrigger
                value="results"
                data-tour="tab-trigger-results"
                disabled={!results}
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t.results}
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                data-tour="tab-trigger-analysis"
                disabled={!results}
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t.analysis || 'Análisis'}
              </TabsTrigger>
              <TabsTrigger
                value="mission_control"
                data-tour="tab-trigger-mission-control"
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t.mission_control || 'Mission Control'}
              </TabsTrigger>
              <TabsTrigger
                value="smart_search"
                data-tour="smart-search-tab-trigger"
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                Smart Search
              </TabsTrigger>
              <TabsTrigger
                value="agente_jesus"
                data-tour="tab-trigger-agente-jesus"
                className={`font-semibold text-xs transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 border ${
                  activeTab === 'agente_jesus'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/60 shadow-xs'
                    : 'text-amber-700/80 dark:text-amber-300/80 hover:bg-amber-500/10 border-amber-500/25'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {t.tab_agente_jesus}
              </TabsTrigger>
              <TabsTrigger
                value="propellant_char"
                data-tour="tab-trigger-propellant-char"
                className={`font-semibold text-xs transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 border ${
                  activeTab === 'propellant_char'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/60 shadow-xs'
                    : 'text-amber-700/80 dark:text-amber-300/80 hover:bg-amber-500/10 border-amber-500/25'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {t.tab_propellant_char}
              </TabsTrigger>
              <TabsTrigger
                value="cfd"
                data-tour="tab-trigger-cfd"
                disabled={!results && installedModules.animations}
                className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t.cfd || 'CFD Animation'}
              </TabsTrigger>
            </TabsList>
            <Button
              data-tour="simulate-btn"
              onClick={simulate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold whitespace-nowrap min-w-[156px] h-9 px-4 shrink-0 transition-colors cursor-pointer"
            >
              {t.run}
            </Button>
          </div>

          <TabsContent value="inputs" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto no-scrollbar pt-2">
            <MotorInputsPanel
              motor={motor}
              setMotor={setMotor}
              nozzle={nozzle}
              setNozzle={setNozzle}
              grains={grains}
              setGrains={setGrains}
              addGrain={addGrain}
              removeGrain={removeGrain}
              slagMode={slagMode}
              setSlagMode={setSlagMode}
              slagMagnitudeStr={slagMagnitudeStr}
              setSlagMagnitudeStr={setSlagMagnitudeStr}
              isEditingSlagRef={isEditingSlagRef}
              customPropellants={customPropellants}
              motorStruct={motorStruct}
              motorValidation={motorValidation}
              totalPropellantMassKg={totalPropellantMassKg}
              isOverpressure={isOverpressure}
              results={results}
              theme={theme}
              t={t}
              onOpenPadmInfo={() => setShowPadmInfo(true)}
              onOpenPropellantModal={(grainId) => {
                setTargetGrainForModal(grainId);
                setShowPropellantModal(true);
              }}
            />
          </TabsContent>

          <TabsContent value="results" className="flex-1 overflow-y-auto w-full p-2">
            {results && (
              <SimulationResultsPanel
                results={results}
                motorStruct={motorStruct}
                isOverpressure={isOverpressure}
                theme={theme}
                themeColors={themeConfig.colors}
                t={t}
                onExport={prepareExport}
              />
            )}
          </TabsContent>

          <TabsContent value="analysis" data-tour="analysis-panel" className="flex-1 overflow-y-auto w-full no-scrollbar p-1">
            {results && (
              <DetailedAnalysisView
                results={results}
                lang={lang}
                motor={motor}
                nozzle={nozzle}
                customPropellants={customPropellants}
                themeColors={themeConfig.colors}
              />
            )}
          </TabsContent>

          <TabsContent value="cfd" data-tour="cfd-panel" className="flex-1 overflow-hidden w-full relative min-h-0 flex flex-col gap-2">
            {!installedModules.animations ? (
              <ModuleNotInstalledNotice moduleId="animations" lang={lang} theme={theme} />
            ) : results && (
              <ErrorBoundary fallbackTitle="Error en visualización 3D / CFD">
                <Suspense fallback={<div className="p-6 text-xs font-mono text-muted-foreground">{t.mc_processing}</div>}>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col xl:flex-row gap-4 pb-10">
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex flex-wrap justify-between items-center gap-2 bg-muted/60 p-2 rounded-lg border border-border">
                        <span className="text-xs uppercase font-bold text-foreground font-mono tracking-widest">{t.exhaust_sim}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setShowCfdInfo(!showCfdInfo)}>
                          {t.more_info}
                        </Button>
                      </div>
                      {showCfdInfo && (
                        <div className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] leading-relaxed border border-border shadow-inner">
                          <p className="font-bold text-blue-400 mb-1">{t.cfd_solver_title}</p>
                          {t.cfd_solver_desc}
                        </div>
                      )}
                      <div className="flex flex-col flex-1 min-h-[460px] bg-card rounded-lg shadow-sm border overflow-hidden shrink-0 w-full">
                        <PlaybackWrapper results={results} t_parent={t} motor={motor} nozzle={nozzle} />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col min-h-[400px]">
                      <FlightViewer
                        simApogee={simApogee}
                        expApogee={expApogee}
                        t={t}
                        propellantType={results?.propellantType || 1}
                        motor={motor}
                        nozzle={nozzle}
                        customPropellants={customPropellants}
                      />
                    </div>
                  </div>
                </Suspense>
              </ErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="mission_control" data-tour="mission-control-panel" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto pt-2">
            <MissionControl
              results={results}
              lang={lang}
              onApogeeUpdate={(sim, exp) => {
                missionControlManagedRef.current = true;
                setSimApogee(sim);
                setExpApogee(exp);
              }}
              nozzleParams={nozzle}
              motorMassKg={motorStruct.motorMassKg}
              propellantMassKg={totalPropellantMassKg}
              themeColors={themeConfig.colors}
            />
          </TabsContent>

          <TabsContent value="smart_search" className="flex-1 flex flex-col min-h-0 gap-4 p-2 md:p-4 overflow-y-auto">
            <div data-tour="smart-search-wizard" className="w-full">
              <SmartSearchEngine
                initialMotor={motor}
                initialNozzle={nozzle}
                initialGrains={grains}
                customPropellants={customPropellants}
                lang={lang}
                theme={theme}
                themeColors={themeConfig.colors}
                onApplyConfiguration={handleApplySmartSearchConfiguration}
              />
            </div>
          </TabsContent>

          <TabsContent value="agente_jesus" data-tour="agente-jesus-panel" className="flex-1 flex flex-col min-h-0 gap-4 p-3 md:p-6 overflow-y-auto">
            {!installedModules.agente_jesus ? (
              <ModuleNotInstalledNotice moduleId="agente_jesus" lang={lang} theme={theme} />
            ) : (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-6 text-xs font-mono text-muted-foreground">{t.mc_processing}</div>}>
                  <AgenteJesusPanel lang={lang} theme={theme} />
                </Suspense>
              </ErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="propellant_char" data-tour="propellant-char-panel" className="flex-1 flex flex-col min-h-0 gap-4 p-3 md:p-6 overflow-y-auto">
            {!installedModules.propellant_char ? (
              <ModuleNotInstalledNotice moduleId="propellant_char" lang={lang} theme={theme} />
            ) : (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-6 text-xs font-mono text-muted-foreground">{t.mc_processing}</div>}>
                  <PropellantCharacterizationPanel lang={lang} theme={theme} />
                </Suspense>
              </ErrorBoundary>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="py-2 border-t border-border bg-card/70 text-muted-foreground mt-auto shrink-0 relative z-10 transition-colors">
        <div className="max-w-[1600px] mx-auto w-full px-6 flex flex-wrap justify-between items-center gap-2 text-[11px] font-mono">
          <span className="font-semibold tracking-wider text-foreground/85">{t.dept_prop}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              {t.feedback_btn}
            </button>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => setShowAnalyticsModal(true)}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              {t.usage_stats_btn}
            </button>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => setShowSettingsMenu(true)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {t.settings_btn}
            </button>
          </div>
        </div>

        <SimulationModals
          t={t}
          showExportModal={showExportModal}
          setShowExportModal={setShowExportModal}
          exportFilename={exportFilename}
          setExportFilename={setExportFilename}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportData={exportData}
          showFeedbackModal={showFeedbackModal}
          setShowFeedbackModal={setShowFeedbackModal}
          feedbackMessage={feedbackMessage}
          setFeedbackMessage={setFeedbackMessage}
          showSaveModal={showSaveModal}
          setShowSaveModal={setShowSaveModal}
          saveName={saveName}
          setSaveName={setSaveName}
          saveFolder={saveFolder}
          setSaveFolder={setSaveFolder}
          motor={motor}
          nozzle={nozzle}
          grains={grains}
          savedSimulations={savedSimulations}
          setSavedSimulations={setSavedSimulations}
          showLibraryModal={showLibraryModal}
          setShowLibraryModal={setShowLibraryModal}
          onLoadSimulation={(loadedMotor, loadedNozzle, loadedGrains) => {
            setMotor(loadedMotor);
            setNozzle(loadedNozzle);
            setGrains(loadedGrains);
          }}
          showPadmInfo={showPadmInfo}
          setShowPadmInfo={setShowPadmInfo}
          motorStruct={motorStruct}
          simToDelete={simToDelete}
          setSimToDelete={setSimToDelete}
        />

        <GuideBookModal
          isOpen={showGuideBook}
          onClose={() => setShowGuideBook(false)}
          onStartTour={handleStartTour}
          onApplyPresetMotor={handleApplyPresetMotor}
          lang={lang}
          theme={theme}
        />

        <InteractiveTourOverlay
          activeTour={activeTourSequence}
          currentStepIndex={tourStepIndex}
          onNextStep={() => {
            if (activeTourSequence && tourStepIndex < activeTourSequence.steps.length - 1) {
              setTourStepIndex(tourStepIndex + 1);
            } else {
              trackEvent('guide_completed');
              setActiveTourSequence(null);
            }
          }}
          onPrevStep={() => {
            setTourStepIndex(Math.max(0, tourStepIndex - 1));
          }}
          onCloseTour={() => {
            setActiveTourSequence(null);
          }}
          onOpenGuideBook={() => {
            setActiveTourSequence(null);
            setShowGuideBook(true);
          }}
          onSwitchTab={setActiveTab}
          lang={lang}
          theme={theme}
        />

        <VersionHistoryBook
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          lang={lang}
          theme={theme}
        />

        <CustomPropellantModal
          isOpen={showPropellantModal}
          onClose={() => {
            setShowPropellantModal(false);
            setTargetGrainForModal(null);
          }}
          customPropellants={customPropellants}
          onSavePropellants={persistPropellants}
          onSelectPropellantForGrain={handleSelectPropellantForGrain}
          lang={lang}
          theme={theme}
        />

        <UsageAnalyticsModal
          isOpen={showAnalyticsModal}
          onClose={() => setShowAnalyticsModal(false)}
          lang={lang}
        />

        <SettingsMenu
          isOpen={showSettingsMenu}
          onClose={() => setShowSettingsMenu(false)}
          lang={lang}
          setLang={setLang}
          cursor={cursor}
          setCursor={setCursor}
          themeConfig={themeConfig}
          onSelectPreset={selectThemePreset}
          onUpdateColor={updateThemeColor}
          onResetTheme={resetThemeToPreset}
          onOpenVersions={() => setShowVersionHistory(true)}
          onOpenAnalytics={() => setShowAnalyticsModal(true)}
          onOpenFeedback={() => setShowFeedbackModal(true)}
          t={t}
        />
      </footer>
    </div>
  );
}
