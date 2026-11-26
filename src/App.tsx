import React, { Suspense, lazy, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CustomGrainShape, SimulationResults } from './lib/types';
import {
  calculateMotorStructure,
  calculateTotalPropellantMassKg,
  normalizeMotorWithStructure,
  validateMotorInputs,
} from './lib/motorStructure';
import { runSimulation } from './lib/simulator';
import { ApogeeResult, calculateApogee } from './lib/apogee';
import {
  AlertTriangle,
  Package,
  Settings,
  Save,
  Flame,
  Lock,
} from 'lucide-react';

import { MotorInputsPanel } from './components/MotorInputsPanel';
import { SimulationResultsPanel } from './components/SimulationResultsPanel';
import { SimulationModals } from './components/SimulationModals';
import { HermesApplyPayload, HermesShareModals } from './components/HermesShareModals';
import { MissionControl, loadSavedMissionControlParams } from './components/MissionControl';
import { DetailedAnalysisView } from './components/DetailedAnalysisView';
import { SmartSearchEngine } from './components/SmartSearchEngine';
import { SplashScreen, WorkspaceMode } from './components/SplashScreen';
import { VersionHistoryBook } from './components/VersionHistoryBook';
import { GuideBookModal } from './components/GuideBookModal';
import { InteractiveTourOverlay, TourSequence } from './components/InteractiveTourOverlay';
import { getTourSequences } from './lib/toursData';
import { CustomPropellantModal } from './components/CustomPropellantModal';
import { CustomGrainModal } from './components/CustomGrainModal';
import { Language, translations } from './lib/i18n';
import { Logo } from './components/Logo';
import {
  recordAppLaunch,
  trackTabVisit,
  trackEvent,
  syncTelemetryLanguage,
  recordActiveTimeDelta,
  recordSimulationTelemetry,
  recordFlightTelemetry,
} from './lib/telemetry';
import { UsageAnalyticsModal } from './components/UsageAnalyticsModal';
import { SavedSimulationEntry, useSimulationStorage } from './hooks/useSimulationStorage';
import { getInstalledModules } from './lib/modules';
import { ModuleNotInstalledNotice } from './components/ModuleNotInstalledNotice';
import { SettingsMenu } from './components/SettingsMenu';
import { AgenteJesusDrawer } from './components/AgenteJesusDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  HERMES_MC_IMPORTED_EVENT,
  applyImportedMissionControlSnapshot,
  loadMissionControlAero,
  parseAeroDataRaw,
} from './lib/missionControlStorage';
import { resolveImportedCustomGrains, resolveImportedPropellants } from './lib/hermesFile';
import { createStudySeriesFromLibraryEntry } from './lib/studyEngine';
import { loadActiveStudyState, saveActiveStudyState } from './lib/studyStorage';

import { StudyPanel } from './components/StudyPanel';

const PlaybackWrapper = lazy(() =>
  import('./components/PlaybackWrapper').then((m) => ({ default: m.PlaybackWrapper }))
);
const FlightViewer = lazy(() =>
  import('./components/FlightViewer').then((m) => ({ default: m.FlightViewer }))
);
const PropellantCharacterizationPanel = lazy(() =>
  import('./components/RoadmapPreviewTabs').then((m) => ({ default: m.PropellantCharacterizationPanel }))
);

export default function App() {
  const installedModules = useMemo(() => getInstalledModules(), []);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('simulate');
  const [simTab, setSimTab] = useState<string>('inputs');
  const [postTab, setPostTab] = useState<string>('study');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const activeTab = workspaceMode === 'simulate' ? simTab : postTab;
  const setActiveTab = (tab: string) => {
    if (tab === 'study' || tab === 'propellant_char') {
      setWorkspaceMode('postprocess');
      setPostTab(tab);
    } else {
      setWorkspaceMode('simulate');
      setSimTab(tab);
    }
    trackTabVisit(tab);
  };

  const [lang, setLang] = useState<Language>('en');
  const [guideLang, setGuideLang] = useState<Language>('en');

  useEffect(() => {
    setGuideLang(lang);
    syncTelemetryLanguage(lang);
  }, [lang]);

  useEffect(() => {
    recordAppLaunch(lang);
  }, []);

  useEffect(() => {
    const INTERVAL_SEC = 15;
    const timer = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        recordActiveTimeDelta(INTERVAL_SEC);
      }
    }, INTERVAL_SEC * 1000);
    return () => window.clearInterval(timer);
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
    customGrainShapes,
    handleSaveCustomGrains: persistCustomGrains,
  } = useSimulationStorage();

  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showCfdInfo, setShowCfdInfo] = useState(false);
  const [showPadmInfo, setShowPadmInfo] = useState(false);
  const [simApogee, setSimApogee] = useState<ApogeeResult | null>(null);
  const [expApogee, setExpApogee] = useState<ApogeeResult | null>(null);
  const missionControlManagedRef = useRef(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAgenteDrawer, setShowAgenteDrawer] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');

  const [showHermesModal, setShowHermesModal] = useState(false);
  const [hermesModalTab, setHermesModalTab] = useState<'export' | 'import'>('export');
  const [mcSyncVersion, setMcSyncVersion] = useState(0);

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
  const [showCustomGrainModal, setShowCustomGrainModal] = useState<boolean>(false);
  const [targetGrainForCustomModal, setTargetGrainForCustomModal] = useState<string | null>(null);
  const [startCustomGrainNew, setStartCustomGrainNew] = useState<boolean>(false);
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

  const handleSelectCustomGrainForGrain = (shape: CustomGrainShape) => {
    if (targetGrainForCustomModal) {
      setGrains((prev) =>
        prev.map((g) =>
          g.id === targetGrainForCustomModal
            ? {
                ...g,
                shape: 10,
                customGrainId: shape.id,
                customGrainSnapshot: shape,
              }
            : g
        )
      );
      setTargetGrainForCustomModal(null);
    }
  };

  const motorStruct = useMemo(() => calculateMotorStructure(motor), [motor]);

  const totalPropellantMassKg = useMemo(
    () => calculateTotalPropellantMassKg(grains, customPropellants),
    [grains, customPropellants]
  );

  const motorValidation = useMemo(
    () => validateMotorInputs(motor, grains, nozzle, motorStruct, customPropellants),
    [motor, grains, nozzle, motorStruct, customPropellants]
  );

  const isOverpressure = Boolean(
    results && motorStruct.maxAdmissiblePressureMPa > 0 && results.summary.Pmax_MPa > motorStruct.maxAdmissiblePressureMPa
  );

  useEffect(() => {
    const onMcImported = () => {
      missionControlManagedRef.current = false;
      setMcSyncVersion((v) => v + 1);
    };
    window.addEventListener(HERMES_MC_IMPORTED_EVENT, onMcImported);
    return () => window.removeEventListener(HERMES_MC_IMPORTED_EVENT, onMcImported);
  }, []);

  // Keep baseline trajectory synced across tab switches & .hermes imports
  useEffect(() => {
    if (!results) {
      setSimApogee(null);
      return;
    }
    const mcSaved = loadSavedMissionControlParams();
    const mcAero = loadMissionControlAero();
    const aeroParsed = parseAeroDataRaw(mcAero.useAeroData, mcAero.aeroDataRaw);
    const expectedDiamM = Math.max(0.02, (mcSaved.rocketDiameter || motorStruct.outerDiameterMm) / 1000);
    const isStaleVsSaved =
      !simApogee ||
      Math.abs((simApogee.flightPathAngleDeg ?? 90) - mcSaved.flightPathAngle) > 1e-4 ||
      Math.abs((simApogee.launchAltitudeM ?? 169) - mcSaved.launchAltitude) > 1e-4 ||
      Math.abs((simApogee.rocketDiameterM ?? 0.08) - expectedDiamM) > 1e-5 ||
      Math.abs((simApogee.railLengthM ?? 2.0) - mcSaved.railLengthM) > 1e-4 ||
      Math.abs((simApogee.windSpeedMs ?? 0) - mcSaved.windSpeedMs) > 1e-4 ||
      simApogee.recoveryMode !== mcSaved.recoveryMode;

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
      aeroParsed?.mach,
      aeroParsed?.cd,
      mcSaved.flightPathAngle,
      {
        railLengthM: mcSaved.railLengthM,
        windSpeedMs: mcSaved.windSpeedMs,
        recoveryMode: mcSaved.recoveryMode,
        chuteDiameterM: mcSaved.chuteDiameterM,
        chuteCd: mcSaved.chuteCd,
        drogueDiameterM: mcSaved.drogueDiameterM,
        drogueCd: mcSaved.drogueCd,
        mainDeployAltM: mcSaved.mainDeployAltM,
      }
    );
    setSimApogee(baseline);
    if (baseline.maxApogee > 0) {
      recordFlightTelemetry({
        maxApogeeM: baseline.maxApogee,
        maxVelocityMs: baseline.maxVelocity,
        maxMach: baseline.mach.length > 0 ? Math.max(...baseline.mach) : 0,
        countAsFlightRun: false,
      });
    }
  }, [results, motorStruct.motorMassKg, motorStruct.outerDiameterMm, activeTab, mcSyncVersion]);

  const t = translations[lang];

  const simulate = () => {
    const liveValidation = validateMotorInputs(motor, grains, nozzle, motorStruct, customPropellants);
    if (liveValidation.hasBlockingError) {
      setSimulationError(t.sim_error_msg);
      return;
    }
    try {
      setSimulationError(null);
      const res = runSimulation({ motor, nozzle, grains, customPropellants, customGrainShapes });
      setResults(res);
      setActiveTab('results');
      const overpressure = Boolean(
        motorStruct.maxAdmissiblePressureMPa > 0 && res.summary.Pmax_MPa > motorStruct.maxAdmissiblePressureMPa
      );
      recordSimulationTelemetry({
        results: res,
        grains,
        customPropellants,
        isSafe: !overpressure,
      });
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
    trackEvent('smart_search_applied');
    try {
      const res = runSimulation({
        motor: mergedMotor,
        nozzle: newNozzle,
        grains: newGrains,
        customPropellants,
        customGrainShapes,
      });
      setResults(res);
      const appliedStruct = calculateMotorStructure(mergedMotor);
      const overpressure = Boolean(
        appliedStruct.maxAdmissiblePressureMPa > 0 && res.summary.Pmax_MPa > appliedStruct.maxAdmissiblePressureMPa
      );
      recordSimulationTelemetry({
        results: res,
        grains: newGrains,
        customPropellants,
        isSafe: !overpressure,
      });
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
    return getTourSequences(guideLang, {
      setGrains,
      setMotor,
      setNozzle,
      runSim: simulate,
    });
  }, [guideLang, customPropellants, motor, nozzle, grains]);

  const handleStartTour = (tourId: string, selectedLang?: Language) => {
    const targetLang = selectedLang || guideLang;
    if (selectedLang && selectedLang !== guideLang) {
      setGuideLang(selectedLang);
    }
    const seqMap = targetLang === guideLang
      ? tourSequences
      : getTourSequences(targetLang, {
          setGrains,
          setMotor,
          setNozzle,
          runSim: simulate,
        });
    const seq = seqMap[tourId];
    if (seq) {
      setActiveTourSequence(seq);
      setTourStepIndex(0);
      setShowGuideBook(false);
    }
  };

  const prepareExport = (_res: SimulationResults) => {
    setExportFilename(`HERMES_Results_${motor.Dc}mm`);
    setShowExportModal(true);
  };

  const handleApplyHermesWorkspace = (payload: HermesApplyPayload) => {
    if (payload.nextCustomPropellants) {
      persistPropellants(payload.nextCustomPropellants);
    }
    if (payload.nextCustomGrains) {
      persistCustomGrains(payload.nextCustomGrains);
    }
    const effectiveProps = payload.nextCustomPropellants || customPropellants;
    const effectiveCustomGrains = payload.nextCustomGrains || customGrainShapes;
    const effectiveMotor = payload.motor ? normalizeMotorWithStructure(payload.motor) : motor;
    const effectiveNozzle = payload.nozzle ?? nozzle;
    const effectiveGrains = payload.grains ?? grains;

    if (payload.motor) setMotor(effectiveMotor);
    if (payload.nozzle) setNozzle(effectiveNozzle);
    if (payload.grains) setGrains(effectiveGrains);

    if (payload.missionControl) {
      missionControlManagedRef.current = false;
      applyImportedMissionControlSnapshot(payload.missionControl);
    }

    if (payload.motor || payload.nozzle || payload.grains) {
      try {
        setSimulationError(null);
        const res = runSimulation({
          motor: effectiveMotor,
          nozzle: effectiveNozzle,
          grains: effectiveGrains,
          customPropellants: effectiveProps,
          customGrainShapes: effectiveCustomGrains,
        });
        setResults(res);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLoadLibrarySimulation = (entry: SavedSimulationEntry) => {
    const resolved = resolveImportedPropellants(
      entry.bundledPropellants || [],
      entry.grains,
      customPropellants
    );
    if (resolved.addedNames.length > 0) {
      persistPropellants(resolved.nextCustomPropellants);
    }
    const resolvedCustomGrains = resolveImportedCustomGrains(
      entry.bundledCustomGrains || [],
      resolved.remappedGrains,
      customGrainShapes
    );
    if (resolvedCustomGrains.addedNames.length > 0) {
      persistCustomGrains(resolvedCustomGrains.nextCustomGrains);
    }
    const normalizedMotor = normalizeMotorWithStructure(entry.motor);
    setMotor(normalizedMotor);
    setNozzle(entry.nozzle);
    setGrains(resolvedCustomGrains.remappedGrains);
    if (entry.missionControl) {
      missionControlManagedRef.current = false;
      applyImportedMissionControlSnapshot(entry.missionControl);
    }
    try {
      setSimulationError(null);
      const res = runSimulation({
        motor: normalizedMotor,
        nozzle: entry.nozzle,
        grains: resolvedCustomGrains.remappedGrains,
        customPropellants: resolved.addedNames.length > 0 ? resolved.nextCustomPropellants : customPropellants,
        customGrainShapes:
          resolvedCustomGrains.addedNames.length > 0
            ? resolvedCustomGrains.nextCustomGrains
            : customGrainShapes,
      });
      setResults(res);
    } catch {
      // keep loaded inputs even if parameters need editing
    }
    setWorkspaceMode('simulate');
  };

  const handleAddLibrarySimulationToStudy = (entry: SavedSimulationEntry) => {
    if (!installedModules.postprocess) {
      setWorkspaceMode('postprocess');
      setPostTab('study');
      trackTabVisit('study');
      return;
    }
    try {
      const currentStudy = loadActiveStudyState();
      const newSeries = createStudySeriesFromLibraryEntry(entry, customPropellants, currentStudy.series);
      saveActiveStudyState({
        ...currentStudy,
        referenceId: currentStudy.referenceId || newSeries.id,
        series: [...currentStudy.series, newSeries],
      });
      window.dispatchEvent(new CustomEvent('hermes-study-sync'));
      setWorkspaceMode('postprocess');
      setPostTab('study');
      trackTabVisit('study');
    } catch (err) {
      console.error(err);
      setSimulationError(t.sim_error_msg);
    }
  };

  return (
    <div className={`min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden ${cursorClass}`}>
      {showSplash && <SplashScreen lang={lang} onComplete={handleSplashComplete} />}

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
          <Button
            data-tour="save-sim-btn"
            variant="outline"
            onClick={() => setShowSaveModal(true)}
            title={t.save_btn}
            className="h-8 text-xs font-medium px-2.5 gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="hidden sm:inline">{t.save_btn}</span>
          </Button>

          <Button
            data-tour="hermes-share-btn"
            variant="outline"
            size="sm"
            onClick={() => {
              setHermesModalTab('export');
              setShowHermesModal(true);
            }}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 bg-background/70 hover:bg-muted border-border text-foreground whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t.hermes_share_btn}</span>
          </Button>

          <Button
            data-tour="settings-menu-btn"
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
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Dual Workspace Switcher: Simulate | Post-Process */}
              <div data-tour="workspace-mode-switcher" className="flex h-9 items-center bg-muted/75 border border-border rounded-lg p-1 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('simulate')}
                  className={`px-3 h-full rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    workspaceMode === 'simulate'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.mode_simulate || 'Simulate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMode('postprocess');
                    trackTabVisit(postTab);
                  }}
                  className={`px-3 h-full rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    workspaceMode === 'postprocess'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{t.mode_postprocess || 'Post-Process'}</span>
                  {!installedModules.postprocess && (
                    <Lock className={`w-3 h-3 shrink-0 ${workspaceMode === 'postprocess' ? 'text-primary-foreground/90' : 'text-amber-500'}`} />
                  )}
                </button>
              </div>

              <TabsList className="flex h-9 w-max shrink-0 bg-muted/75 border border-border rounded-lg p-1 gap-1">
                {workspaceMode === 'simulate' ? (
                  <>
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
                      value="cfd"
                      data-tour="tab-trigger-cfd"
                      disabled={!results}
                      className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                    >
                      {t.cfd || 'CFD Animation'}
                    </TabsTrigger>
                  </>
                ) : (
                  <>
                    <TabsTrigger
                      value="study"
                      data-tour="tab-trigger-study"
                      className="font-semibold text-xs px-3 rounded-md whitespace-nowrap shrink-0 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs flex items-center gap-1.5"
                    >
                      <span>{t.tab_study || 'Estudio'}</span>
                      {!installedModules.postprocess && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
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
                      <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{t.tab_propellant_char}</span>
                      {!installedModules.postprocess && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            {workspaceMode === 'simulate' && (
              <Button
                data-tour="simulate-btn"
                onClick={simulate}
                disabled={motorValidation.hasBlockingError}
                title={motorValidation.hasBlockingError ? t.sim_error_msg : undefined}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold whitespace-nowrap min-w-[156px] h-9 px-4 shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.run}
              </Button>
            )}
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
              customGrainShapes={customGrainShapes}
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
              onOpenCustomGrainModal={(grainId, startNew = false) => {
                setTargetGrainForCustomModal(grainId);
                setStartCustomGrainNew(Boolean(startNew));
                setShowCustomGrainModal(true);
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
            {results && (
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
                        <PlaybackWrapper results={results} t_parent={t} lang={lang} motor={motor} nozzle={nozzle} />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col min-h-[400px]">
                      <FlightViewer
                        simApogee={simApogee}
                        expApogee={expApogee}
                        t={t}
                        lang={lang}
                        avgChamberPressureMPa={
                          results?.summary.Pmed_MPa
                            ? results.summary.Pmed_MPa + (motor.Pamb || 0.101325)
                            : undefined
                        }
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

          <TabsContent value="propellant_char" data-tour="propellant-char-panel" className="flex-1 flex flex-col min-h-0 gap-4 p-3 md:p-6 overflow-y-auto">
            {!installedModules.postprocess ? (
              <ModuleNotInstalledNotice moduleId="postprocess" lang={lang} theme={theme} />
            ) : (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-6 text-xs font-mono text-muted-foreground">{t.mc_processing}</div>}>
                  <PropellantCharacterizationPanel lang={lang} theme={theme} />
                </Suspense>
              </ErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="study" data-tour="study-panel" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto pt-2">
            {!installedModules.postprocess ? (
              <ModuleNotInstalledNotice moduleId="postprocess" lang={lang} theme={theme} />
            ) : (
              <ErrorBoundary fallbackTitle="Error in Study Module">
                <StudyPanel
                  lang={lang}
                  results={results}
                  motor={motor}
                  nozzle={nozzle}
                  grains={grains}
                  customPropellants={customPropellants}
                  savedSimulations={savedSimulations}
                />
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
      </footer>

      <SimulationModals
          t={t}
          lang={lang}
          showExportModal={showExportModal}
          setShowExportModal={setShowExportModal}
          exportFilename={exportFilename}
          setExportFilename={setExportFilename}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          results={results}
          customPropellants={customPropellants}
          customGrainShapes={customGrainShapes}
          simApogee={simApogee}
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
          onLoadSimulation={handleLoadLibrarySimulation}
          onAddSimulationToStudy={handleAddLibrarySimulationToStudy}
          onOpenHermesImport={() => {
            setHermesModalTab('import');
            setShowHermesModal(true);
          }}
          showPadmInfo={showPadmInfo}
          setShowPadmInfo={setShowPadmInfo}
          motorStruct={motorStruct}
          simToDelete={simToDelete}
          setSimToDelete={setSimToDelete}
        />

        <HermesShareModals
          isOpen={showHermesModal}
          onClose={() => setShowHermesModal(false)}
          initialTab={hermesModalTab}
          t={t}
          motor={motor}
          nozzle={nozzle}
          grains={grains}
          customPropellants={customPropellants}
          customGrainShapes={customGrainShapes}
          motorClassHint={results?.summary.motorClass}
          onApplyImportedWorkspace={handleApplyHermesWorkspace}
          onSaveImportedToLibrary={(entry) => setSavedSimulations((prev) => [...prev, entry])}
          onPersistCustomPropellants={persistPropellants}
          onPersistCustomGrains={persistCustomGrains}
        />

        <GuideBookModal
          isOpen={showGuideBook}
          onClose={() => setShowGuideBook(false)}
          onStartTour={handleStartTour}
          onApplyPresetMotor={handleApplyPresetMotor}
          lang={guideLang}
          onChangeGuideLang={setGuideLang}
          hasResults={Boolean(results)}
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
          hasResults={Boolean(results)}
          lang={guideLang}
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

        <CustomGrainModal
          isOpen={showCustomGrainModal}
          onClose={() => {
            setShowCustomGrainModal(false);
            setTargetGrainForCustomModal(null);
            setStartCustomGrainNew(false);
          }}
          lang={lang}
          customGrainShapes={customGrainShapes}
          onSaveCustomGrains={persistCustomGrains}
          onSelectCustomGrainForGrain={
            targetGrainForCustomModal ? handleSelectCustomGrainForGrain : undefined
          }
          referenceDiameterMm={
            grains.find((g) => g.id === targetGrainForCustomModal)?.D0 ||
            grains[0]?.D0 ||
            56
          }
          initialSelectedId={
            grains.find((g) => g.id === targetGrainForCustomModal)?.customGrainId || null
          }
          startNew={startCustomGrainNew}
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
          onOpenLibrary={() => setShowLibraryModal(true)}
          onOpenAgenteJesus={() => {
            setShowAgenteDrawer(true);
            trackTabVisit('agente_jesus');
          }}
          onOpenGuideBook={() => setShowGuideBook(true)}
          onReturnToStart={() => setShowSplash(true)}
          showInstallBtn={showInstallBtn}
          onInstallApp={handleInstallClick}
          isAgenteInstalled={installedModules.agente_jesus}
          t={t}
        />

        <AgenteJesusDrawer
          isOpen={showAgenteDrawer}
          onClose={() => setShowAgenteDrawer(false)}
          isInstalled={installedModules.agente_jesus}
          lang={lang}
          theme={theme}
        />
    </div>
  );
}
