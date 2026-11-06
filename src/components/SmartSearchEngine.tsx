import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { 
  Sparkles, 
  Lock, 
  Unlock, 
  Flame, 
  Sliders, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Zap, 
  Target, 
  Layers, 
  Check, 
  BarChart3,
  ShieldCheck,
  Send,
  Info,
  TrendingUp,
  Activity,
  SlidersHorizontal,
  Eye,
  Navigation,
  Clock,
  Rocket,
  Cpu,
  XCircle
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  ScatterChart,
  Scatter,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine,
  Cell,
  ZAxis
} from 'recharts';
import { 
  SmartSearchGoal, 
  CandidateResult, 
  SmartSearchOutcome, 
  VariableConstraintMode,
  OptimizationBudgetPreset,
  EvaluatedPoint,
  OptimizationProgress,
  runSmartSearchAsync 
} from '../lib/optimizer';
import { 
  MotorInput, 
  NozzleInput, 
  GrainInput, 
  CustomPropellant, 
  DEFAULT_PROPELLANTS 
} from '../lib/types';

interface SmartSearchEngineProps {
  initialMotor: MotorInput;
  initialNozzle: NozzleInput;
  initialGrains: GrainInput[];
  customPropellants?: CustomPropellant[];
  lang: string;
  theme: string;
  onApplyConfiguration: (motor: MotorInput, nozzle: NozzleInput, grains: GrainInput[]) => void;
}

export function SmartSearchEngine({
  initialMotor,
  initialNozzle,
  initialGrains,
  customPropellants = [],
  lang,
  theme,
  onApplyConfiguration
}: SmartSearchEngineProps) {
  const isSpanish = lang === 'es';
  const isLight = theme === 'light';

  // Wizard Phase: 0 (Goal Inbox), 1 (Hardware), 2 (Grain Constraints), 3 (Algorithms & Execute)
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [showAlgorithmInfo, setShowAlgorithmInfo] = useState<boolean>(false);

  // Cancellation controller reference
  const abortControllerRef = useRef<boolean>(false);

  const handleCancelSearch = () => {
    abortControllerRef.current = true;
    if (searchProgress) {
      setSearchProgress(prev => prev ? {
        ...prev,
        stepDescription: isSpanish 
          ? 'Cancelando simulación y recuperando candidatos evaluados...' 
          : 'Cancelling simulation and gathering evaluated candidates...'
      } : null);
    }
  };

  useEffect(() => {
    const handleSetStep = (e: any) => {
      if (e.detail !== undefined && [0, 1, 2, 3].includes(e.detail)) {
        setActiveStep(e.detail as 0 | 1 | 2 | 3);
      }
    };
    window.addEventListener('hermes-smart-search-set-step', handleSetStep);
    return () => window.removeEventListener('hermes-smart-search-set-step', handleSetStep);
  }, []);

  // Diagram tab in results: 'curves' | 'scatter' | 'convergence'
  const [diagramTab, setDiagramTab] = useState<'curves' | 'scatter' | 'convergence'>('curves');

  // String-based inputs state to allow natural empty string on backspace without forcing '1'
  const [inputValues, setInputValues] = useState({
    Dc: (initialMotor.Dc || 50).toString(),
    Lc: (initialMotor.Lc || 250).toString(),
    Pmax_lim: '6.0',
    Dt0: (initialNozzle.Dt0 || 8.0).toString(),
    Ds: (initialNozzle.Ds || 18.0).toString(),
    alpha: (initialNozzle.alpha || 15).toString(),
    // Hardware efficiencies & ambient
    etac: (initialMotor.etac !== undefined ? initialMotor.etac : 0.85).toString(),
    etanoz: (initialNozzle.etanoz !== undefined ? initialNozzle.etanoz : 0.75).toString(),
    Pamb: (initialMotor.Pamb !== undefined ? initialMotor.Pamb : 0.101325).toString(),
    Gstar: (initialMotor.Gstar !== undefined ? initialMotor.Gstar : 1.0).toString(),
    kv: (initialMotor.kv !== undefined ? initialMotor.kv : 0.1).toString(),
    e: (initialNozzle.e !== undefined ? initialNozzle.e : 0).toString(),
    maxGrainCount: '5',
    fixedGrainCount: '3',
    // D0 modes
    valD0: ((initialMotor.Dc || 50) - 1.0).toString(),
    minD0: ((initialMotor.Dc || 50) - 2.5).toString(),
    maxD0: ((initialMotor.Dc || 50) - 0.8).toString(),
    // d0 modes
    vald0: '10.0',
    mind0: '6.0',
    maxd0: '16.0',
    // L0 modes
    valL0: '50.0',
    minL0: '30.0',
    maxL0: '70.0',
    // Propellant mass constraint modes
    valMprop: '250.0',
    minMprop: '150.0',
    maxMprop: '350.0',
    targetImpulseVal: '250',
    targetAltitudeVal: '1500',
    rocketDryMassKg: '1.5'
  });

  // Track touched fields for instant onBlur validation styling
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Non-numeric config state
  const [propellantId, setPropellantId] = useState<number>(() => {
    return initialGrains[0]?.propellantType || 1;
  });
  const [shape, setShape] = useState<1 | 2 | 3>(1); // 1: BATES/Tubular, 2: Star, 3: Solid
  const [grainCountMode, setGrainCountMode] = useState<'range' | 'fixed'>('range');
  
  // Advanced Variable Constraint Modes: 'free' | 'fixed' | 'range'
  const [modeD0, setModeD0] = useState<VariableConstraintMode>('free');
  const [moded0, setModed0] = useState<VariableConstraintMode>('free');
  const [modeL0, setModeL0] = useState<VariableConstraintMode>('free');
  const [modeMprop, setModeMprop] = useState<VariableConstraintMode>('free');

  // Burn surfaces: 1 = Burns (active), 0 = Inhibited (protected)
  // Default BATES: Outer surface inhibited (osi=0), Core burns (ci=1), Ends burn (ei=1)
  const [outerBurns, setOuterBurns] = useState<boolean>(false);
  const [coreBurns, setCoreBurns] = useState<boolean>(true);
  const [endsBurn, setEndsBurn] = useState<boolean>(true);

  const [goal, setGoal] = useState<SmartSearchGoal>('max_impulse');
  const [budgetPreset, setBudgetPreset] = useState<OptimizationBudgetPreset>('standard');
  const [evaluationsPerN, setEvaluationsPerN] = useState<number>(1000);

  // Search execution & Results State
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<OptimizationProgress | null>(null);
  const [searchOutcome, setSearchOutcome] = useState<SmartSearchOutcome | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Helper to update text input
  const handleInputChange = (field: keyof typeof inputValues, val: string) => {
    setInputValues(prev => ({ ...prev, [field]: val }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Derived values for live hardware preview
  const DcVal = parseFloat(inputValues.Dc) || 50;
  const LcVal = parseFloat(inputValues.Lc) || 250;
  const Dt0Val = parseFloat(inputValues.Dt0) || 8;
  const DsVal = parseFloat(inputValues.Ds) || 18;
  const AtVal = Math.PI * Math.pow(Dt0Val / 2, 2);
  const AeVal = Math.PI * Math.pow(DsVal / 2, 2);
  const expRatio = AtVal > 0 ? (AeVal / AtVal) : 1;
  const chamberVolumeCm3 = (Math.PI * Math.pow(DcVal / 2, 2) * LcVal) / 1000;
  const slendernessRatio = DcVal > 0 ? (LcVal / DcVal) : 5;

  // Field validation helpers
  const isPmaxEmptyOrInvalid = touched['Pmax_lim'] && (!inputValues.Pmax_lim.trim() || parseFloat(inputValues.Pmax_lim) <= 0);
  const isDcEmptyOrInvalid = touched['Dc'] && (!inputValues.Dc.trim() || parseFloat(inputValues.Dc) <= 0);
  const isLcEmptyOrInvalid = touched['Lc'] && (!inputValues.Lc.trim() || parseFloat(inputValues.Lc) <= 0);
  const isDt0EmptyOrInvalid = touched['Dt0'] && (!inputValues.Dt0.trim() || parseFloat(inputValues.Dt0) <= 0);
  const isDsEmptyOrInvalid = touched['Ds'] && (!inputValues.Ds.trim() || parseFloat(inputValues.Ds) <= 0);
  const isGrainCountEmptyOrInvalid = (grainCountMode === 'range' ? touched['maxGrainCount'] : touched['fixedGrainCount']) && (
    grainCountMode === 'range' 
      ? (!inputValues.maxGrainCount.trim() || parseInt(inputValues.maxGrainCount) < 1)
      : (!inputValues.fixedGrainCount.trim() || parseInt(inputValues.fixedGrainCount) < 1)
  );
  const isD0EmptyOrInvalid = modeD0 === 'fixed' && touched['valD0'] && (!inputValues.valD0.trim() || parseFloat(inputValues.valD0) <= 0);
  const isd0EmptyOrInvalid = moded0 === 'fixed' && touched['vald0'] && (!inputValues.vald0.trim() || parseFloat(inputValues.vald0) < 0);
  const isL0EmptyOrInvalid = modeL0 === 'fixed' && touched['valL0'] && (!inputValues.valL0.trim() || parseFloat(inputValues.valL0) <= 0);

  // Geometric & Physical validation helpers for Phase 1 & 2
  // Phase 1 (Chamber & Nozzle):
  const isDt0GeDs = Dt0Val >= DsVal;
  const isDt0GeDc = Dt0Val >= DcVal;

  // Phase 2 (Grains):
  const valD0Num = parseFloat(inputValues.valD0) || 0;
  const minD0Num = parseFloat(inputValues.minD0) || 0;
  const maxD0Num = parseFloat(inputValues.maxD0) || 0;

  const vald0Num = parseFloat(inputValues.vald0) || 0;
  const mind0Num = parseFloat(inputValues.mind0) || 0;
  const maxd0Num = parseFloat(inputValues.maxd0) || 0;

  const valL0Num = parseFloat(inputValues.valL0) || 0;
  const minL0Num = parseFloat(inputValues.minL0) || 0;
  const maxL0Num = parseFloat(inputValues.maxL0) || 0;

  const fixedNNum = parseInt(inputValues.fixedGrainCount) || 1;

  // D0 checks:
  const isD0GeDc = modeD0 === 'fixed' && valD0Num >= DcVal && valD0Num > 0;
  const isMaxD0GeDc = modeD0 === 'range' && maxD0Num >= DcVal && maxD0Num > 0;
  const isD0RangeInverted = modeD0 === 'range' && minD0Num > 0 && maxD0Num > 0 && minD0Num >= maxD0Num;

  // d0 checks:
  const effectiveOuterD = modeD0 === 'fixed' && valD0Num > 0 ? valD0Num : DcVal;
  const isd0GeD0 = shape !== 3 && moded0 === 'fixed' && vald0Num > 0 && vald0Num >= effectiveOuterD;
  const isd0RangeInverted = shape !== 3 && moded0 === 'range' && mind0Num > 0 && maxd0Num > 0 && mind0Num >= maxd0Num;
  const isMind0GeD0 = shape !== 3 && moded0 === 'range' && mind0Num > 0 && mind0Num >= effectiveOuterD;

  // L0 checks:
  const isL0ExceedsLc = modeL0 === 'fixed' && grainCountMode === 'fixed' && valL0Num > 0 && (valL0Num * fixedNNum) > LcVal;
  const isL0RangeInverted = modeL0 === 'range' && minL0Num > 0 && maxL0Num > 0 && minL0Num >= maxL0Num;

  // Critical geometric conflict preventing launch
  const hasGeometricConflict = isDt0GeDs || isDt0GeDc || isD0GeDc || isMaxD0GeDc || isD0RangeInverted || isd0GeD0 || isd0RangeInverted || isMind0GeD0 || isL0ExceedsLc || isL0RangeInverted;


  // Available Propellants List
  const allPropellants = useMemo(() => {
    return [...DEFAULT_PROPELLANTS, ...customPropellants];
  }, [customPropellants]);

  const selectedPropellant = useMemo(() => {
    return allPropellants.find(p => p.id === propellantId) || allPropellants[0];
  }, [allPropellants, propellantId]);

  // Current selected candidate
  const currentCandidate: CandidateResult | null = useMemo(() => {
    if (!searchOutcome || !searchOutcome.bestCandidates.length) return null;
    return searchOutcome.bestCandidates[selectedCandidateIndex] || searchOutcome.bestCandidates[0];
  }, [searchOutcome, selectedCandidateIndex]);

  // Chart data for current candidate
  const chartData = useMemo(() => {
    if (!currentCandidate) return [];
    const sim = currentCandidate.simulation;
    return sim.t.map((time, idx) => ({
      time: parseFloat(time.toFixed(3)),
      F_N: parseFloat((sim.F_N[idx] || 0).toFixed(1)),
      P0_MPa: parseFloat((sim.P0_MPa[idx] || 0).toFixed(2))
    }));
  }, [currentCandidate]);

  // Scatter plot data (Pmax vs Total Impulse)
  const scatterPoints = useMemo(() => {
    if (!searchOutcome || !searchOutcome.allEvaluatedPoints) return [];
    return searchOutcome.allEvaluatedPoints.map((pt) => ({
      ...pt,
      x: pt.maxPressure,
      y: pt.totalImpulse,
      isCurrentSelected: currentCandidate?.id === pt.id,
      isTopCandidate: searchOutcome.bestCandidates.some(c => c.id === pt.id)
    }));
  }, [searchOutcome, currentCandidate]);

  // Convergence line data
  const convergenceLineData = useMemo(() => {
    if (!searchOutcome || !searchOutcome.convergenceHistory) return [];
    // Downsample if too many points for smooth rendering
    const history = searchOutcome.convergenceHistory;
    if (history.length <= 150) return history;
    const step = Math.ceil(history.length / 150);
    return history.filter((_, idx) => idx % step === 0 || idx === history.length - 1);
  }, [searchOutcome]);

  // Smooth live timer ticker while searching so UI feels responsive and alive
  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchProgress((prev) => {
          if (!prev) return prev;
          const currentElapsed = (prev.elapsedMs || 0) + 100;
          return {
            ...prev,
            elapsedMs: currentElapsed
          };
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching]);

  // Execute Optimization
  const handleExecuteSearch = async () => {
    setTouched({
      Dc: true,
      Lc: true,
      Pmax_lim: true,
      Dt0: true,
      Ds: true,
      alpha: true,
      maxGrainCount: true,
      fixedGrainCount: true,
      valD0: true,
      minD0: true,
      maxD0: true,
      vald0: true,
      mind0: true,
      maxd0: true,
      valL0: true,
      minL0: true,
      maxL0: true,
      targetImpulseVal: true,
      targetAltitudeVal: true,
      rocketDryMassKg: true
    });

    abortControllerRef.current = false;
    setIsSearching(true);
    setAppliedSuccess(false);
    setSearchProgress({
      phase: 'init',
      stepDescription: isSpanish ? 'Inicializando espacio de búsqueda balístico...' : 'Initializing ballistic search space...',
      currentEvaluations: 0,
      totalEstimated: 350,
      percent: 5,
      bestScoreSoFar: 0,
      elapsedMs: 0
    });

    try {
      const DcNum = parseFloat(inputValues.Dc) || 50;
      const LcNum = parseFloat(inputValues.Lc) || 250;
      const PmaxNum = parseFloat(inputValues.Pmax_lim) || 6.0;
      const Dt0Num = parseFloat(inputValues.Dt0) || 8.0;
      const DsNum = parseFloat(inputValues.Ds) || 18.0;
      const alphaNum = parseFloat(inputValues.alpha) || 15;
      const maxNNum = parseInt(inputValues.maxGrainCount) || 5;
      const fixedNNum = parseInt(inputValues.fixedGrainCount) || 3;
      
      // D0
      const valD0Num = parseFloat(inputValues.valD0) || (DcNum - 1);
      const minD0Num = parseFloat(inputValues.minD0) || (DcNum - 2.5);
      const maxD0Num = parseFloat(inputValues.maxD0) || (DcNum - 0.8);
      
      // d0
      const vald0Num = parseFloat(inputValues.vald0) || 10.0;
      const mind0Num = parseFloat(inputValues.mind0) || 6.0;
      const maxd0Num = parseFloat(inputValues.maxd0) || 16.0;
      
      // L0
      const valL0Num = parseFloat(inputValues.valL0) || 50.0;
      const minL0Num = parseFloat(inputValues.minL0) || 30.0;
      const maxL0Num = parseFloat(inputValues.maxL0) || 70.0;
      
      const targetItNum = parseFloat(inputValues.targetImpulseVal) || 250;
      const targetAltNum = parseFloat(inputValues.targetAltitudeVal) || 1500;
      const dryMassNum = parseFloat(inputValues.rocketDryMassKg) || 1.5;

      const etacNum = parseFloat(inputValues.etac) || 0.85;
      const etanozNum = parseFloat(inputValues.etanoz) || 0.75;
      const PambNum = parseFloat(inputValues.Pamb) || 0.101325;
      const GstarNum = parseFloat(inputValues.Gstar) || 1.0;
      const kvNum = parseFloat(inputValues.kv) || 0.1;
      const eNum = parseFloat(inputValues.e) || 0;

      const valMpropNum = parseFloat(inputValues.valMprop) || 250.0;
      const minMpropNum = parseFloat(inputValues.minMprop) || 150.0;
      const maxMpropNum = parseFloat(inputValues.maxMprop) || 350.0;

      const outcome = await runSmartSearchAsync({
        Dc: DcNum,
        Lc: LcNum,
        Pmax_lim: PmaxNum,
        Dt0: Dt0Num,
        Ds: DsNum,
        alpha: alphaNum,
        etac: etacNum,
        etanoz: etanozNum,
        Pamb: PambNum,
        Gstar: GstarNum,
        kv: kvNum,
        e: eNum,
        propellantId: propellantId,
        shape: shape,
        grainCountMode: grainCountMode,
        maxGrainCount: maxNNum,
        fixedGrainCount: fixedNNum,
        // Advanced constraint modes
        modeD0,
        valD0: valD0Num,
        minD0: minD0Num,
        maxD0: maxD0Num,
        moded0,
        vald0: vald0Num,
        mind0: mind0Num,
        maxd0: maxd0Num,
        modeL0,
        valL0: valL0Num,
        minL0: minL0Num,
        maxL0: maxL0Num,
        // Propellant mass constraints
        modeMprop,
        valMprop: valMpropNum,
        minMprop: minMpropNum,
        maxMprop: maxMpropNum,
        osi: outerBurns ? 1 : 0,
        ci: coreBurns ? 1 : 0,
        ei: endsBurn ? 1 : 0,
        goal: goal,
        evaluationsPerN: evaluationsPerN,
        budgetPreset: budgetPreset,
        targetImpulseVal: targetItNum,
        targetAltitudeVal: targetAltNum,
        rocketDryMassKg: dryMassNum,
        customPropellants: customPropellants,
        shouldStop: () => abortControllerRef.current
      }, (progress) => {
        setSearchProgress(progress);
      });

      setSearchOutcome(outcome);
      setSelectedCandidateIndex(0);
    } catch (err) {
      console.error('Optimization search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Apply configuration to main engine inputs
  const handleApplyToEngine = (cand: CandidateResult) => {
    onApplyConfiguration(cand.inputs.motor, cand.inputs.nozzle, cand.inputs.grains);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3500);
  };

  return (
    <div className="space-y-4">
      
      {/* ================= TOP HEADER & STEP TRACKER ================= */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
        isLight ? 'bg-white border-stone-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2 font-mono">
                HERMES SMART SEARCH v2.0.0
                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {isSpanish ? 'Optimizador Balístico Inteligente' : 'Intelligent Ballistic Optimizer'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {isSpanish 
                  ? 'Búsqueda evolutiva de geometrías de grano óptimas para cámara y tobera existentes'
                  : 'Evolutionary inverse optimization of propellant grain geometries for fixed chamber and nozzle'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Step Selector & Algorithmic Info Toggle */}
        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            data-tour="smart-search-algorithm-btn"
            onClick={() => setShowAlgorithmInfo(!showAlgorithmInfo)}
            className="h-8 text-xs font-mono flex items-center gap-1.5 border-border"
          >
            <Info size={14} className="text-emerald-600 dark:text-emerald-400" />
            {isSpanish ? 'Algoritmo & Formulación' : 'Algorithm & Formulation'}
          </Button>

          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border">
            <button
              onClick={() => setActiveStep(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 0 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Target size={13} />
              {isSpanish ? 'Objetivo: Máx Altitud' : 'Goal: Max Altitude'}
            </button>

            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(1)}
              data-tour="smart-search-phase-1-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 1 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">1</span>
              {isSpanish ? 'Fase 1: Hardware' : 'Phase 1: Hardware'}
            </button>
            
            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(2)}
              data-tour="smart-search-phase-2-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 2 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">2</span>
              {isSpanish ? 'Fase 2: Granos' : 'Phase 2: Grains'}
            </button>

            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(3)}
              data-tour="smart-search-phase-3-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 3 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">3</span>
              {isSpanish ? 'Fase 3: Algoritmos' : 'Phase 3: Algorithms'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= INFORMATIVE MODAL / BANNER: ALGORITHM & SIMULATION FORMULATION ================= */}
      {showAlgorithmInfo && (
        <div className={`p-5 rounded-xl border space-y-4 text-xs leading-relaxed transition-all shadow-md ${
          isLight ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' : 'bg-slate-900/95 border-emerald-600/50 text-emerald-100'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30">
            <h4 className="font-bold font-mono text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Zap size={18} className="text-emerald-500 animate-pulse" />
              {isSpanish 
                ? 'Guía Completa de Smart Search: Flujo de Misión, Algoritmos, Modus Operandi y Formulación' 
                : 'Smart Search Complete Guide: Mission Workflow, Algorithms, Modus Operandi & Formulation'}
            </h4>
            <button 
              onClick={() => setShowAlgorithmInfo(false)}
              className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 transition-colors cursor-pointer"
            >
              ✕ {isSpanish ? 'Cerrar Guía' : 'Close Guide'}
            </button>
          </div>

          {/* Workflow Sequence: Goal -> Phase 1 -> Phase 2 -> Phase 3 */}
          <div className="space-y-2 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <span className="font-bold font-mono uppercase text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Target size={15} />
              {isSpanish ? '1. Flujo Secuencial de Optimización (De Objetivo a Ejecución)' : '1. Sequential Optimization Workflow (Goal to Execution)'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-card/80 border border-emerald-500/40 space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">0. Objetivo Primario</span>
                <p className="text-[10px] text-muted-foreground">
                  {isSpanish 
                    ? 'Bandeja inicial donde se selecciona Máxima Altitud (Mayor Impulso Total It = ∫ F dt) antes de configurar cotas.' 
                    : 'Initial tray to select Maximum Altitude (Peak Total Impulse It = ∫ F dt) prior to configuring dimensions.'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">1. Fase 1: Hardware</span>
                <p className="text-[10px] text-muted-foreground">
                  {isSpanish 
                    ? 'Cotado de cámara (Dc, Lc), límite de sobrepresión Pmax_lim, tobera fija (Dt, Ds, α) y avisos de expansión en vivo.' 
                    : 'Fixed casing (Dc, Lc), MEOP pressure threshold, nozzle geometry (Dt, Ds, α), and real-time expansion alerts.'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">2. Fase 2: Granos</span>
                <p className="text-[10px] text-muted-foreground">
                  {isSpanish 
                    ? 'Geometría (BATES, Estrella, Macizo), N granos, modos Libre/Fijo/Rango (D0, d0, L0), caras activas y restricción de masa.' 
                    : 'Shape, segment count, Free/Fixed/Range modes for D0, d0, L0, active faces, and total propellant mass limits.'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">3. Fase 3: Algoritmos</span>
                <p className="text-[10px] text-muted-foreground">
                  {isSpanish 
                    ? 'Elección del presupuesto DE, botón de Cancelar Simulación en vivo y monitoreo del HUD de evolución.' 
                    : 'DE budget preset selection, live Cancel Simulation button, and real-time convergence HUD monitoring.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section A: The 3 Search Algorithms & Modus Operandi */}
          <div className="space-y-2">
            <span className="font-bold font-mono uppercase text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Cpu size={15} />
              {isSpanish ? '2. Los 3 Modos de Algoritmo de Búsqueda Evolutiva y su Modus Operandi' : '2. The 3 Evolutionary Search Algorithm Modes & Modus Operandi'}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Algorithm 1: Fast */}
              <div className="p-3 rounded-xl border border-border bg-card/70 space-y-1.5">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    {isSpanish ? 'Búsqueda Rápida' : 'Fast Search'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                    500 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isSpanish
                    ? 'Modus Operandi: Población compacta NP = 15 con G = 33 generaciones de DE/rand/1/bin inicializadas mediante muestreo hipercubo latino (LHS). Emplea mutación adaptativa rápida con cruce binomial CR = 0.85.'
                    : 'Modus Operandi: Compact population NP = 15 with G = 33 generations of DE/rand/1/bin seeded by Latin Hypercube Sampling (LHS). Uses fast adaptive mutation and binomial crossover CR = 0.85.'}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {isSpanish ? '🎯 ~1 - 2s por N | Barrido veloz de viabilidad inicial.' : '🎯 ~1 - 2s per N | Fast initial feasibility sweep.'}
                </div>
              </div>

              {/* Algorithm 2: Standard */}
              <div className="p-3 rounded-xl border border-emerald-500/50 bg-card/90 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Sparkles size={14} />
                    {isSpanish ? 'Búsqueda Estándar (Recomendado)' : 'Standard Search (Recommended)'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    1.000 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isSpanish
                    ? 'Modus Operandi: Población balanceada NP = 25 con G = 40 generaciones. Incorpora dither estocástico del factor de escala F ∈ [0.5, 0.9] por generación y vector, garantizando diversidad y evitando estancamientos en óptimos locales.'
                    : 'Modus Operandi: Balanced population NP = 25 with G = 40 generations. Incorporates stochastic dithering of scale factor F ∈ [0.5, 0.9] per generation, preventing premature local minima convergence.'}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {isSpanish ? '🎯 ~2 - 4s por N | Diseño balístico definitivo de alta fidelidad.' : '🎯 ~2 - 4s per N | Production high-fidelity motor design.'}
                </div>
              </div>

              {/* Algorithm 3: Deep */}
              <div className="p-3 rounded-xl border border-purple-500/40 bg-card/70 space-y-1.5">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Rocket size={14} className="text-purple-500" />
                    {isSpanish ? 'Búsqueda Profunda' : 'Deep Search'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold">
                    2.000 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isSpanish
                    ? 'Modus Operandi: Población expandida NP = 40 con G = 50 generaciones. Explora exhaustivamente hipervolúmenes restringidos donde el límite de sobrepresión Pmax está muy próximo a la frontera crítica de rotura.'
                    : 'Modus Operandi: Expanded population NP = 40 with G = 50 generations. Exhaustively explores constrained hyperspaces where Pmax limit operates near critical burst boundaries.'}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {isSpanish ? '🔬 ~5 - 8s por N | Geometrías estrella e hiperespacios complejos.' : '🔬 ~5 - 8s per N | Star geometries & complex hyperspaces.'}
                </div>
              </div>

            </div>
          </div>

          {/* Section B: Cancel Simulation & Preserving Partial Results */}
          <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 space-y-1 text-[11px]">
            <span className="font-bold text-red-600 dark:text-red-400 font-mono uppercase flex items-center gap-1.5">
              <XCircle size={15} />
              {isSpanish ? '3. Cancelación de Simulación en Vivo y Retorno de Resultados Parciales' : '3. Live Simulation Cancellation & Partial Results Preservation'}
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {isSpanish
                ? 'Durante la ejecución del optimizador (en búsquedas profundas o presupuestos elevados), aparece un botón rojo de CANCELAR SIMULACIÓN visible en el HUD de progreso y en la barra de lanzamiento. Al pulsarlo, el algoritmo detiene inmediatamente el bucle evolutivo de forma segura y devuelve todos los mejores candidatos factibles evaluados hasta ese momento, permitiendo corregir parámetros sin perder el trabajo cómputo previo.'
                : 'During search execution, a prominent red CANCEL SIMULATION button is available inside the HUD and action bar. Clicking it safely aborts the evolution loop and returns the best feasible candidates found up to that timestamp, allowing instant configuration adjustments without losing evaluated data.'}
            </p>
          </div>

          {/* Section C: Exact 0D Simulation & Deb Feasibility Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-500/20">
            <div className="space-y-1.5">
              <span className="font-bold text-foreground font-mono uppercase text-[11px] block">
                {isSpanish ? '4. Motor de Simulación Numérico 0D Intacto' : '4. Untouched Exact Numerical 0D Solver'}
              </span>
              <p>
                {isSpanish
                  ? 'El optimizador NO modifica ni aproxima las leyes físicas. Resuelve para cada vector [D0, d0, L0] la integración balística 0D completa con la ley de Vieille (r = a·Pⁿ), continuidad másica en cámara con tobera de Laval y regresión geométrica 3D de todas las caras de grano activas. El impulso total It = ∫ F dt devuelto es el valor físico exacto sin puntuaciones artificiales ni penalizaciones ficticias.'
                  : 'The optimizer does NOT alter or approximate physical laws. It solves complete 0D transient ballistics with Vieille burn law (r = a·Pⁿ), chamber mass continuity with Laval nozzle, and 3D regression of active faces for each vector [D0, d0, L0]. The returned total impulse It = ∫ F dt is exact.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-foreground font-mono uppercase text-[11px] block">
                {isSpanish ? '5. Reglas de Factibilidad de Deb (1998) y Selección Rígida' : '5. Deb Feasibility Rules (1998) & Strict Selection'}
              </span>
              <p>
                {isSpanish
                  ? 'Los métodos continuos basados en gradiente fracasan en balística debido a las discontinuidades del quemado y censurado por sobrepresión. La Selección de Deb garantiza que: 1) Cualquier solución factible (Pmax ≤ Plim) vence a una inviable; 2) Entre factibles gana estrictamente el mayor impulso total puro (Max It); 3) Entre inviables gana la de menor sobrepresión sin penalizaciones arbitrarias.'
                  : 'Gradient methods fail in ballistics due to burning sliver discontinuities and pressure censoring. Deb Selection guarantees: 1) Any feasible candidate dominates infeasible ones; 2) Among feasible candidates, strictly highest total impulse (Max It) wins; 3) Among infeasible candidates, lowest pressure violation wins without arbitrary weights.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMFORTABLE FULL-WIDTH CONFIGURATION WORKSPACE ================= */}
      
      {/* STEP 0: BANDEJA DE OBJETIVOS DE MISIÓN */}
      {activeStep === 0 && (
        <Card data-tour="smart-search-goal-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden border-t-4 border-t-emerald-500 animate-in fade-in duration-200">
          <CardHeader className="py-4 px-5 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2 font-mono">
                <Target size={16} />
                {isSpanish ? 'Bandeja de Objetivos de Misión' : 'Mission Objectives Inbox'}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isSpanish 
                  ? 'Selecciona el objetivo propulsivo para iniciar la configuración de motor, restricciones de grano y algoritmos de optimización'
                  : 'Select your propulsion mission goal to enter the hardware, grain constraints, and algorithm configuration flow'}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-lg border border-border">
              <span>{isSpanish ? 'Flujo:' : 'Workflow:'} <strong className="text-foreground">{isSpanish ? 'Objetivo → Fase 1 → Fase 2 → Fase 3' : 'Goal → Phase 1 → Phase 2 → Phase 3'}</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase font-mono tracking-wider text-muted-foreground">
                {isSpanish ? 'Objetivo Primario de Optimización' : 'Primary Optimization Objective'}
              </span>
              
              {/* Objective Drawer / Tray: Max Altitude / Max Total Impulse */}
              <div 
                onClick={() => {
                  setGoal('max_impulse');
                  setActiveStep(1);
                }}
                className="group relative p-5 rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                      <Rocket size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          {isSpanish ? 'Bandeja Principal de Misión' : 'Main Mission Tray'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                          {isSpanish ? 'Activo' : 'Active'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mt-0.5 font-mono flex items-center gap-2">
                        {isSpanish ? 'Máxima Altitud / Mayor Impulso Total (It)' : 'Maximum Altitude / Peak Total Impulse (It)'}
                      </h3>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGoal('max_impulse');
                      setActiveStep(1);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-5 text-xs font-mono flex items-center gap-2 shadow-xs group-hover:shadow-md cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <span>{isSpanish ? 'Configurar Motor y Tobera (Fase 1)' : 'Configure Motor & Nozzle (Phase 1)'}</span>
                    <ArrowRight size={16} />
                  </Button>
                </div>

                {/* Mathematical Formulation & Objective Rules */}
                <div className="p-3.5 rounded-xl bg-card/80 border border-border/80 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-foreground">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      {isSpanish ? 'Criterio de Selección Estricto:' : 'Strict Selection Criterion:'}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-muted text-foreground font-bold border border-border text-[11px]">
                      Mejor Solución = max I_total &nbsp;[sujeto a P_max ≤ P_límite]
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                    {isSpanish
                      ? 'Maximiza estrictamente la energía propulsiva total acumulada obtenida de la integración temporal completa del empuje (I_total = ∫ F dt) devuelta por el simulador físico. No premia artificialmente geometrías por planitud ni ocupación de cámara si entregan menor impulso total. La selección global de granos (N) y cotas geométricas se rige por factibilidad de Deb.'
                      : 'Strictly maximizes total propulsive energy from complete physical thrust time integration (I_total = ∫ F dt) returned by the simulator. Does not artificially favor flat thrust or packing volume if total impulse is lower. Global grain count (N) and dimensions are governed by Deb feasibility selection.'}
                  </p>
                </div>

                {/* Feature Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{isSpanish ? 'Cálculo Físico' : 'Physics Calculation'}</span>
                    <span className="font-bold text-foreground">{isSpanish ? 'Impulso Total Puro (N·s)' : 'Pure Total Impulse (N·s)'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{isSpanish ? 'Manejo de Restricciones' : 'Constraint Handling'}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{isSpanish ? 'Reglas de Deb (Sin penalizaciones ficticias)' : 'Deb Rules (No arbitrary penalty weights)'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{isSpanish ? 'Comparativa de Granos' : 'Grain Exploration'}</span>
                    <span className="font-bold text-foreground">{isSpanish ? 'Automática N = 1 .. N_max' : 'Automatic N = 1 .. N_max'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FASE 1: HARDWARE DEFINIDO (CÁMARA Y TOBERA) */}
      {activeStep === 1 && (
        <Card data-tour="smart-search-phase1-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden border-t-4 border-t-emerald-500">
          <CardHeader className="py-3 px-4 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
                <Sliders size={16} />
                {isSpanish ? 'Fase 1: Hardware Definido (Cámara y Tobera)' : 'Phase 1: Defined Hardware (Chamber & Nozzle)'}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isSpanish ? 'Introduce las cotas de la cámara y tobera existente que vamos a equipar' : 'Enter existing motor casing and nozzle dimensions'}
              </p>
            </div>
            
            {/* Live Quick Hardware Indicators */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground bg-muted/40 px-3 py-1 rounded-lg border border-border">
              <span>Vol: <strong className="text-foreground">{chamberVolumeCm3.toFixed(1)} cm³</strong></span>
              <span>•</span>
              <span>{isSpanish ? 'Esbeltez (Lc/Dc):' : 'Slenderness (Lc/Dc):'} <strong className="text-foreground">{slendernessRatio.toFixed(1)}</strong></span>
              <span>•</span>
              <span>{isSpanish ? 'Expansión (ε = Ae/At):' : 'Expansion (ε = Ae/At):'} <strong className="text-foreground">{expRatio.toFixed(2)}</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            
            {/* Grid 1: Chamber Geometry & Pressure Limit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Dc */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Layers size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Diámetro Interior Cámara (Dc)' : 'Chamber Inner Diameter (Dc)'}
                </UiLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inputValues.Dc}
                    onChange={(e) => handleInputChange('Dc', e.target.value)}
                    onBlur={() => handleBlur('Dc')}
                    placeholder="50.0"
                    className={`h-9 text-xs font-mono font-bold ${isDcEmptyOrInvalid ? 'border-red-500 bg-red-500/10' : ''}`}
                  />
                  <span className="text-xs font-mono text-muted-foreground font-bold">mm</span>
                </div>
                {isDcEmptyOrInvalid ? (
                  <p className="text-[10px] text-red-500 font-medium">
                    {isSpanish ? '⚠️ Recomendación: define un diámetro válido (> 0 mm)' : '⚠️ Recommendation: define a valid diameter (> 0 mm)'}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {isSpanish ? 'Diámetro interno disponible para el grano + liner' : 'Usable inner diameter for propellant & liner'}
                  </p>
                )}
              </div>

              {/* Lc */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Layers size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Longitud Útil Cámara (Lc)' : 'Chamber Usable Length (Lc)'}
                </UiLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inputValues.Lc}
                    onChange={(e) => handleInputChange('Lc', e.target.value)}
                    onBlur={() => handleBlur('Lc')}
                    placeholder="250.0"
                    className={`h-9 text-xs font-mono font-bold ${isLcEmptyOrInvalid ? 'border-red-500 bg-red-500/10' : ''}`}
                  />
                  <span className="text-xs font-mono text-muted-foreground font-bold">mm</span>
                </div>
                {isLcEmptyOrInvalid ? (
                  <p className="text-[10px] text-red-500 font-medium">
                    {isSpanish ? '⚠️ Recomendación: define una longitud válida (> 0 mm)' : '⚠️ Recommendation: define a valid length (> 0 mm)'}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {isSpanish ? 'Longitud entre cierres/tobera disponible para granos' : 'Usable length inside casing'}
                  </p>
                )}
              </div>

              {/* Pmax Limit (Manual input with warning if left empty) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Presión Máxima Segura (Pmax)' : 'Max Safe Pressure Limit (Pmax)'}
                </UiLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    value={inputValues.Pmax_lim}
                    onChange={(e) => handleInputChange('Pmax_lim', e.target.value)}
                    onBlur={() => handleBlur('Pmax_lim')}
                    placeholder="6.0"
                    className={`h-9 text-xs font-mono font-bold ${isPmaxEmptyOrInvalid ? 'border-red-500 bg-red-500/10' : ''}`}
                  />
                  <span className="text-xs font-mono text-muted-foreground font-bold">MPa</span>
                </div>
                {isPmaxEmptyOrInvalid ? (
                  <p className="text-[10px] text-red-500 font-medium">
                    {isSpanish ? '⚠️ Recomendación: define un límite de presión (ej: 6.0 MPa) para una simulación realista' : '⚠️ Recommendation: define a pressure limit (e.g. 6.0 MPa) for realistic simulation'}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {isSpanish ? 'Límite estructural admisible para descartar sobrepresiones' : 'Maximum allowable MEOP / proof pressure threshold'}
                  </p>
                )}
              </div>
            </div>

            {/* Grid 2: Nozzle & Propellant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              
              {/* Nozzle Geometry */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <Zap size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Tobera Fija Existente' : 'Fixed Nozzle Geometry'}
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <UiLabel className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                      <span>{isSpanish ? 'Garganta (Dt) [mm]' : 'Throat (Dt) [mm]'}</span>
                      {(isDt0GeDs || isDt0GeDc) && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                    </UiLabel>
                    <Input
                      type="number"
                      step="0.5"
                      value={inputValues.Dt0}
                      onChange={(e) => handleInputChange('Dt0', e.target.value)}
                      onBlur={() => handleBlur('Dt0')}
                      placeholder="8.0"
                      className={`h-8 text-xs font-mono font-bold ${isDt0EmptyOrInvalid || isDt0GeDs || isDt0GeDc ? 'border-red-500 bg-red-500/10' : ''}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <UiLabel className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                      <span>{isSpanish ? 'Salida (Ds) [mm]' : 'Exit (Ds) [mm]'}</span>
                      {isDt0GeDs && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                    </UiLabel>
                    <Input
                      type="number"
                      step="0.5"
                      value={inputValues.Ds}
                      onChange={(e) => handleInputChange('Ds', e.target.value)}
                      onBlur={() => handleBlur('Ds')}
                      placeholder="18.0"
                      className={`h-8 text-xs font-mono font-bold ${isDsEmptyOrInvalid || isDt0GeDs ? 'border-red-500 bg-red-500/10' : ''}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <UiLabel className="text-[10px] text-muted-foreground font-mono">
                      {isSpanish ? 'Ángulo (α) [°]' : 'Angle (α) [°]'}
                    </UiLabel>
                    <Input
                      type="number"
                      value={inputValues.alpha}
                      onChange={(e) => handleInputChange('alpha', e.target.value)}
                      placeholder="15"
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                {isDt0GeDs && (
                  <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" />
                    {isSpanish 
                      ? `⚠️ Dt (${Dt0Val} mm) ≥ Ds (${DsVal} mm). En toberas de Laval la garganta debe ser menor que la salida (ε > 1).` 
                      : `⚠️ Dt (${Dt0Val} mm) ≥ Ds (${DsVal} mm). In de Laval nozzles throat must be smaller than exit (ε > 1).`}
                  </p>
                )}
                {isDt0GeDc && (
                  <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" />
                    {isSpanish 
                      ? `⚠️ Dt (${Dt0Val} mm) ≥ Dc cámara (${DcVal} mm). La garganta no puede igualar o superar la cámara.` 
                      : `⚠️ Dt (${Dt0Val} mm) ≥ chamber Dc (${DcVal} mm). Throat cannot equal or exceed chamber diameter.`}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground font-mono">
                  {isSpanish 
                    ? `Área de garganta At = ${AtVal.toFixed(1)} mm² | Relación de expansión ε = ${expRatio.toFixed(2)}`
                    : `Throat area At = ${AtVal.toFixed(1)} mm² | Expansion ratio ε = ${expRatio.toFixed(2)}`}
                </p>
              </div>

              {/* Propellant Selection */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <Flame size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {isSpanish ? 'Propelente a Utilizar' : 'Selected Propellant'}
                  </h4>
                  <Select
                    value={propellantId.toString()}
                    onValueChange={(val) => setPropellantId(parseInt(val))}
                  >
                    <SelectTrigger className="h-9 text-xs font-mono font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allPropellants.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="text-xs font-mono">
                          {p.name} {p.isCustom ? (isSpanish ? '(Personalizado)' : '(Custom)') : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border border-border text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>T0: <strong className="text-foreground">{selectedPropellant.T0} K</strong></span>
                  <span>M: <strong className="text-foreground">{selectedPropellant.M} g/mol</strong></span>
                  <span>γ: <strong className="text-foreground">{selectedPropellant.k}</strong></span>
                  <span>ρ: <strong className="text-foreground">{selectedPropellant.rho} g/cm³</strong></span>
                  <span>n: <strong className="text-foreground">{selectedPropellant.n}</strong></span>
                </div>
              </div>

            </div>

            {/* Grid 3: Efficiencies & Ambient Environment */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase font-mono tracking-wider">
                <Sliders size={14} className="text-emerald-600 dark:text-emerald-400" />
                {isSpanish ? 'Rendimientos y Entorno Operativo' : 'Efficiencies & Operating Environment'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* etac */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold flex items-center justify-between">
                    <span>{isSpanish ? 'Rendimiento Cámara (ηc*)' : 'Chamber Efficiency (ηc*)'}</span>
                    <span className="text-emerald-600 font-bold">{Math.round((parseFloat(inputValues.etac) || 0.85) * 100)}%</span>
                  </UiLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.0"
                    value={inputValues.etac}
                    onChange={(e) => handleInputChange('etac', e.target.value)}
                    placeholder="0.85"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    {isSpanish ? 'Eficiencia de combustión (típico: 0.85 - 0.95)' : 'Combustion C* efficiency'}
                  </p>
                </div>

                {/* etanoz */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold flex items-center justify-between">
                    <span>{isSpanish ? 'Rendimiento Tobera (ηnoz)' : 'Nozzle Efficiency (ηnoz)'}</span>
                    <span className="text-emerald-600 font-bold">{Math.round((parseFloat(inputValues.etanoz) || 0.75) * 100)}%</span>
                  </UiLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.0"
                    value={inputValues.etanoz}
                    onChange={(e) => handleInputChange('etanoz', e.target.value)}
                    placeholder="0.75"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    {isSpanish ? 'Eficiencia de tobera / expansión (típico: 0.70 - 0.90)' : 'Nozzle thrust efficiency'}
                  </p>
                </div>

                {/* Pamb */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold">
                    {isSpanish ? 'Presión Ambiente (Pamb) [MPa]' : 'Ambient Pressure (Pamb) [MPa]'}
                  </UiLabel>
                  <Input
                    type="number"
                    step="0.005"
                    value={inputValues.Pamb}
                    onChange={(e) => handleInputChange('Pamb', e.target.value)}
                    placeholder="0.1013"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    {isSpanish ? 'Nivel del mar: 0.101325 MPa (1 atm)' : 'Sea level pressure: 0.101325 MPa'}
                  </p>
                </div>

              </div>
            </div>

            {/* Step 1 Footer Navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setActiveStep(0)}
                className="h-10 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={16} />
                {isSpanish ? 'Volver a Bandeja de Objetivos' : 'Back to Goal Inbox'}
              </Button>
              <Button
                onClick={() => setActiveStep(2)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {isSpanish ? 'Continuar a Fase 2: Granos' : 'Continue to Phase 2: Grains'}
                <ArrowRight size={16} />
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* FASE 2: GEOMETRÍA Y RESTRICCIONES DE GRANO */}
      {activeStep === 2 && (
        <Card data-tour="smart-search-phase2-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden border-t-4 border-t-emerald-500">
          <CardHeader className="py-3 px-4 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
                <Sliders size={16} />
                {isSpanish ? 'Fase 2: Geometría y Restricción de Granos' : 'Phase 2: Grain Geometry & Constraints'}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isSpanish ? 'Elige la forma del grano, caras activas de combustión y bloquea o libera dimensiones' : 'Select grain shape, active burn surfaces, and lock/unlock dimensions'}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border">
              <span>{isSpanish ? 'Cámara:' : 'Chamber:'} <strong className="text-foreground">Dc={DcVal}mm, Lc={LcVal}mm</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            
            {/* 1. Grain Shape & Segment Count Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Shape Selector */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                <UiLabel className="text-xs font-bold text-foreground block font-mono uppercase tracking-wider">
                  {isSpanish ? 'Geometría Base del Grano' : 'Base Grain Geometry'}
                </UiLabel>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShape(1)}
                    className={`p-2.5 rounded-lg border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      shape === 1 
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs' 
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="text-xs">BATES / Tubular</span>
                  </button>
                  <button
                    onClick={() => setShape(2)}
                    className={`p-2.5 rounded-lg border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      shape === 2 
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs' 
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="text-xs">{isSpanish ? 'Estrella (Star Core)' : 'Star Core'}</span>
                  </button>
                  <button
                    onClick={() => setShape(3)}
                    className={`p-2.5 rounded-lg border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      shape === 3 
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs' 
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="text-xs">{isSpanish ? 'Macizo (End-burner)' : 'Solid (End-burner)'}</span>
                  </button>
                </div>
              </div>

              {/* Segment Count (N) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                <UiLabel className="text-xs font-bold text-foreground block font-mono uppercase tracking-wider">
                  {isSpanish ? 'Número de Segmentos (Granos)' : 'Number of Grain Segments'}
                </UiLabel>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                    grainCountMode === 'range' ? 'border-emerald-500 bg-emerald-500/15' : 'border-border bg-background'
                  }`}>
                    <input
                      type="radio"
                      name="grainCountMode"
                      checked={grainCountMode === 'range'}
                      onChange={() => setGrainCountMode('range')}
                      className="text-emerald-600"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {isSpanish ? 'Rango (1 a N)' : 'Range (1 to N)'}
                    </span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                    grainCountMode === 'fixed' ? 'border-emerald-500 bg-emerald-500/15' : 'border-border bg-background'
                  }`}>
                    <input
                      type="radio"
                      name="grainCountMode"
                      checked={grainCountMode === 'fixed'}
                      onChange={() => setGrainCountMode('fixed')}
                      className="text-emerald-600"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {isSpanish ? 'Cantidad Fija' : 'Fixed Count'}
                    </span>
                  </label>
                </div>

                {grainCountMode === 'range' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">{isSpanish ? 'Explorar desde 1 hasta máximo:' : 'Explore from 1 up to:'}</span>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={inputValues.maxGrainCount}
                      onChange={(e) => handleInputChange('maxGrainCount', e.target.value)}
                      onBlur={() => handleBlur('maxGrainCount')}
                      placeholder="5"
                      className={`w-20 h-7 text-xs font-mono font-bold ${isGrainCountEmptyOrInvalid ? 'border-red-500 bg-red-500/10' : ''}`}
                    />
                    <span className="text-xs text-muted-foreground">{isSpanish ? 'granos' : 'grains'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">{isSpanish ? 'Cantidad exacta de granos:' : 'Exact grain count:'}</span>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={inputValues.fixedGrainCount}
                      onChange={(e) => handleInputChange('fixedGrainCount', e.target.value)}
                      onBlur={() => handleBlur('fixedGrainCount')}
                      placeholder="3"
                      className={`w-20 h-7 text-xs font-mono font-bold ${isGrainCountEmptyOrInvalid ? 'border-red-500 bg-red-500/10' : ''}`}
                    />
                    <span className="text-xs text-muted-foreground">{isSpanish ? 'granos' : 'grains'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Physical Variable Constraints (Free, Fixed, Range) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                  {isSpanish ? 'Restricciones y Dimensiones de Grano' : 'Grain Dimension Constraints'}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                  <span>{isSpanish ? 'Elige si fijar un valor, definir un rango o dejar libre al optimizador' : 'Choose fixed value, range, or free optimization'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Variable 1: Diámetro Exterior (D0) */}
                <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {isSpanish ? 'Diámetro Exterior (D0)' : 'Outer Diameter (D0)'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {isSpanish ? `Cámara Dc = ${DcVal} mm` : `Chamber Dc = ${DcVal} mm`}
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector Tabs: Free | Fixed | Range */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setModeD0('free')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeD0 === 'free'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Libre' : 'Free'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeD0('fixed')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeD0 === 'fixed'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Fijo' : 'Fixed'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeD0('range')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeD0 === 'range'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Rango' : 'Range'}
                    </button>
                  </div>

                  {/* Controls based on mode */}
                  {modeD0 === 'free' && (
                    <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                      {isSpanish ? 'Auto: Holgura óptima (Dc - 1 a 2.5 mm)' : 'Auto: Optimal casing clearance'}
                    </div>
                  )}

                  {modeD0 === 'fixed' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          value={inputValues.valD0}
                          onChange={(e) => handleInputChange('valD0', e.target.value)}
                          onBlur={() => handleBlur('valD0')}
                          placeholder="49.0"
                          className={`h-8 text-xs font-mono font-bold flex-1 ${isD0EmptyOrInvalid || isD0GeDc ? 'border-red-500 bg-red-500/10' : ''}`}
                        />
                        <span className="text-xs font-mono text-muted-foreground">mm</span>
                        {isD0GeDc && <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" />}
                      </div>
                      {isD0EmptyOrInvalid && (
                        <p className="text-[10px] text-red-500 font-medium">{isSpanish ? '⚠️ Introduce D0' : '⚠️ Enter D0'}</p>
                      )}
                      {isD0GeDc && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {isSpanish 
                            ? `⚠️ D0 (${valD0Num} mm) ≥ Dc cámara (${DcVal} mm). El grano debe ser menor que la cámara.` 
                            : `⚠️ D0 (${valD0Num} mm) ≥ chamber Dc (${DcVal} mm). Grain must fit inside casing.`}
                        </p>
                      )}
                    </div>
                  )}

                  {modeD0 === 'range' && (
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-mono">Mín (mm)</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={inputValues.minD0}
                            onChange={(e) => handleInputChange('minD0', e.target.value)}
                            placeholder="47.5"
                            className={`h-8 text-xs font-mono font-bold ${isD0RangeInverted ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-mono">Máx (mm)</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={inputValues.maxD0}
                            onChange={(e) => handleInputChange('maxD0', e.target.value)}
                            placeholder="49.2"
                            className={`h-8 text-xs font-mono font-bold ${isD0RangeInverted || isMaxD0GeDc ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                      </div>
                      {isMaxD0GeDc && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {isSpanish 
                            ? `⚠️ Máx D0 (${maxD0Num} mm) ≥ Dc (${DcVal} mm).` 
                            : `⚠️ Max D0 (${maxD0Num} mm) ≥ Chamber Dc (${DcVal} mm).`}
                        </p>
                      )}
                      {isD0RangeInverted && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {isSpanish 
                            ? `⚠️ Mín D0 (${minD0Num} mm) ≥ Máx D0 (${maxD0Num} mm). Rango invertido.` 
                            : `⚠️ Min D0 (${minD0Num} mm) ≥ Max D0 (${maxD0Num} mm). Inverted range.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Variable 2: Diámetro Núcleo (d0) */}
                {shape !== 3 ? (
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {isSpanish ? 'Diámetro Núcleo (d0)' : 'Core Diameter (d0)'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isSpanish ? 'Canal central de gas' : 'Central combustion port'}
                        </div>
                      </div>
                    </div>

                    {/* Mode Selector Tabs: Free | Fixed | Range */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => setModed0('free')}
                        className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                          moded0 === 'free'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isSpanish ? 'Libre' : 'Free'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModed0('fixed')}
                        className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                          moded0 === 'fixed'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isSpanish ? 'Fijo' : 'Fixed'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModed0('range')}
                        className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                          moded0 === 'range'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isSpanish ? 'Rango' : 'Range'}
                      </button>
                    </div>

                    {/* Controls based on mode */}
                    {moded0 === 'free' && (
                      <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                        {isSpanish ? 'Auto: Búsqueda del ratio Kn y empuje óptimo' : 'Auto: Sweep optimal Kn and thrust'}
                      </div>
                    )}

                    {moded0 === 'fixed' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="0.5"
                            value={inputValues.vald0}
                            onChange={(e) => handleInputChange('vald0', e.target.value)}
                            onBlur={() => handleBlur('vald0')}
                            placeholder="10.0"
                            className={`h-8 text-xs font-mono font-bold flex-1 ${isd0EmptyOrInvalid || isd0GeD0 ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                          <span className="text-xs font-mono text-muted-foreground">mm</span>
                          {isd0GeD0 && <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" />}
                        </div>
                        {isd0EmptyOrInvalid && (
                          <p className="text-[10px] text-red-500 font-medium">{isSpanish ? '⚠️ Introduce d0' : '⚠️ Enter d0'}</p>
                        )}
                        {isd0GeD0 && (
                          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {isSpanish 
                              ? `⚠️ d0 (${vald0Num} mm) ≥ D0 (${effectiveOuterD} mm). Espesor de quemado (web) nulo.` 
                              : `⚠️ d0 (${vald0Num} mm) ≥ D0 (${effectiveOuterD} mm). Zero web thickness.`}
                          </p>
                        )}
                      </div>
                    )}

                    {moded0 === 'range' && (
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-mono">Mín (mm)</span>
                            <Input
                              type="number"
                              step="0.5"
                              value={inputValues.mind0}
                              onChange={(e) => handleInputChange('mind0', e.target.value)}
                              placeholder="6.0"
                              className={`h-8 text-xs font-mono font-bold ${isd0RangeInverted || isMind0GeD0 ? 'border-red-500 bg-red-500/10' : ''}`}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-mono">Máx (mm)</span>
                            <Input
                              type="number"
                              step="0.5"
                              value={inputValues.maxd0}
                              onChange={(e) => handleInputChange('maxd0', e.target.value)}
                              placeholder="16.0"
                              className={`h-8 text-xs font-mono font-bold ${isd0RangeInverted ? 'border-red-500 bg-red-500/10' : ''}`}
                            />
                          </div>
                        </div>
                        {isd0RangeInverted && (
                          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {isSpanish 
                              ? `⚠️ Mín d0 (${mind0Num} mm) ≥ Máx d0 (${maxd0Num} mm). Rango invertido.` 
                              : `⚠️ Min d0 (${mind0Num} mm) ≥ Max d0 (${maxd0Num} mm). Inverted range.`}
                          </p>
                        )}
                        {isMind0GeD0 && (
                          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {isSpanish 
                              ? `⚠️ Mín d0 (${mind0Num} mm) ≥ D0 (${effectiveOuterD} mm).` 
                              : `⚠️ Min d0 (${mind0Num} mm) ≥ D0 (${effectiveOuterD} mm).`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-border bg-muted/10 flex flex-col items-center justify-center text-xs text-muted-foreground font-mono text-center">
                    <span>{isSpanish ? 'Grano macizo (Solid):' : 'Solid grain configuration:'}</span>
                    <strong className="text-foreground mt-1">d0 = 0 mm</strong>
                  </div>
                )}

                {/* Variable 3: Longitud de Grano (L0) */}
                <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {isSpanish ? 'Longitud de Grano (L0)' : 'Grain Length (L0)'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {isSpanish ? `Cámara Lc = ${LcVal} mm` : `Chamber Lc = ${LcVal} mm`}
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector Tabs: Free | Fixed | Range */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setModeL0('free')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeL0 === 'free'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Libre' : 'Free'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeL0('fixed')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeL0 === 'fixed'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Fija' : 'Fixed'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeL0('range')}
                      className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        modeL0 === 'range'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Rango' : 'Range'}
                    </button>
                  </div>

                  {/* Controls based on mode */}
                  {modeL0 === 'free' && (
                    <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                      {isSpanish ? 'Auto: Ajuste a longitud de cámara Lc' : 'Auto: Fit to chamber length Lc'}
                    </div>
                  )}

                  {modeL0 === 'fixed' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="1"
                          value={inputValues.valL0}
                          onChange={(e) => handleInputChange('valL0', e.target.value)}
                          onBlur={() => handleBlur('valL0')}
                          placeholder="50.0"
                          className={`h-8 text-xs font-mono font-bold flex-1 ${isL0EmptyOrInvalid || isL0ExceedsLc ? 'border-red-500 bg-red-500/10' : ''}`}
                        />
                        <span className="text-xs font-mono text-muted-foreground">mm</span>
                        {isL0ExceedsLc && <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" />}
                      </div>
                      {isL0EmptyOrInvalid && (
                        <p className="text-[10px] text-red-500 font-medium">{isSpanish ? '⚠️ Introduce L0' : '⚠️ Enter L0'}</p>
                      )}
                      {isL0ExceedsLc && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {isSpanish 
                            ? `⚠️ N×L0 (${fixedNNum} × ${valL0Num} = ${(fixedNNum * valL0Num).toFixed(1)} mm) supera Lc (${LcVal} mm).` 
                            : `⚠️ N×L0 (${fixedNNum} × ${valL0Num} = ${(fixedNNum * valL0Num).toFixed(1)} mm) exceeds Lc (${LcVal} mm).`}
                        </p>
                      )}
                    </div>
                  )}

                  {modeL0 === 'range' && (
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-mono">Mín (mm)</span>
                          <Input
                            type="number"
                            step="1"
                            value={inputValues.minL0}
                            onChange={(e) => handleInputChange('minL0', e.target.value)}
                            placeholder="30.0"
                            className={`h-8 text-xs font-mono font-bold ${isL0RangeInverted ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-mono">Máx (mm)</span>
                          <Input
                            type="number"
                            step="1"
                            value={inputValues.maxL0}
                            onChange={(e) => handleInputChange('maxL0', e.target.value)}
                            placeholder="70.0"
                            className={`h-8 text-xs font-mono font-bold ${isL0RangeInverted ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                      </div>
                      {isL0RangeInverted && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {isSpanish 
                            ? `⚠️ Mín L0 (${minL0Num} mm) ≥ Máx L0 (${maxL0Num} mm). Rango invertido.` 
                            : `⚠️ Min L0 (${minL0Num} mm) ≥ Max L0 (${maxL0Num} mm). Inverted range.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* 3. SUPERFICIES DE QUEMADO E INHIBICIONES */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                  {isSpanish ? 'Superficies de Quemado e Inhibición' : 'Burn Surfaces & Inhibitions'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isSpanish ? 'Seleccionado = Quema activa (Rojo) | Deseleccionado = Inhibido (Negro)' : 'Selected = Burns (Red) | Deselected = Inhibited (Black)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Botón 1: Cara Exterior */}
                <button
                  type="button"
                  onClick={() => setOuterBurns(!outerBurns)}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    outerBurns 
                      ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 font-bold shadow-xs' 
                      : 'border-slate-800 bg-slate-900/10 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      outerBurns ? 'border-red-600 bg-red-600 text-white' : 'border-slate-700 bg-slate-950 text-white'
                    }`}>
                      {outerBurns && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-bold font-mono">
                      {outerBurns 
                        ? (isSpanish ? 'Cara Exterior: Quema' : 'Outer Surface: Burns') 
                        : (isSpanish ? 'Cara Exterior: Inhibida' : 'Outer Surface: Inhibited')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {outerBurns ? (isSpanish ? '🔥 Quema (Rojo)' : '🔥 Burns (Red)') : (isSpanish ? '🛡️ Inhibida (Negro)' : '🛡️ Inhibited (Black)')}
                  </span>
                </button>

                {/* Botón 2: Núcleo */}
                <button
                  type="button"
                  onClick={() => setCoreBurns(!coreBurns)}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    coreBurns 
                      ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 font-bold shadow-xs' 
                      : 'border-slate-800 bg-slate-900/10 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      coreBurns ? 'border-red-600 bg-red-600 text-white' : 'border-slate-700 bg-slate-950 text-white'
                    }`}>
                      {coreBurns && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-bold font-mono">
                      {coreBurns 
                        ? (isSpanish ? 'Núcleo: Quema' : 'Core: Burns') 
                        : (isSpanish ? 'Núcleo: Inhibido' : 'Core: Inhibited')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {coreBurns ? (isSpanish ? '🔥 Quema (Rojo)' : '🔥 Burns (Red)') : (isSpanish ? '🛡️ Inhibido (Negro)' : '🛡️ Inhibited (Black)')}
                  </span>
                </button>

                {/* Botón 3: Extremos */}
                <button
                  type="button"
                  onClick={() => setEndsBurn(!endsBurn)}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    endsBurn 
                      ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 font-bold shadow-xs' 
                      : 'border-slate-800 bg-slate-900/10 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      endsBurn ? 'border-red-600 bg-red-600 text-white' : 'border-slate-700 bg-slate-950 text-white'
                    }`}>
                      {endsBurn && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-bold font-mono">
                      {endsBurn 
                        ? (isSpanish ? 'Extremos: Queman' : 'Ends: Burn') 
                        : (isSpanish ? 'Extremos: Inhibidos' : 'Ends: Inhibited')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {endsBurn ? (isSpanish ? '🔥 Queman (Rojo)' : '🔥 Burn (Red)') : (isSpanish ? '🛡️ Inhibidos (Negro)' : '🛡️ Inhibited (Black)')}
                  </span>
                </button>

              </div>
            </div>

            {/* 4. RESTRICCIÓN DE MASA TOTAL DE PROPELENTE */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                  <Flame size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Restricción de Masa Total de Propelente (Mprop)' : 'Total Propellant Mass Constraint (Mprop)'}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {isSpanish ? 'Fija o limita la masa total de todos los granos sumados' : 'Fix or bound total grain propellant mass'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  
                  {/* Mode selector */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setModeMprop('free')}
                      className={`py-1.5 rounded text-center font-bold transition-all cursor-pointer ${
                        modeMprop === 'free'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Libre' : 'Free'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeMprop('fixed')}
                      className={`py-1.5 rounded text-center font-bold transition-all cursor-pointer ${
                        modeMprop === 'fixed'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Fijar Masa' : 'Fixed Mass'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeMprop('range')}
                      className={`py-1.5 rounded text-center font-bold transition-all cursor-pointer ${
                        modeMprop === 'range'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isSpanish ? 'Rango' : 'Range'}
                    </button>
                  </div>

                  {/* Mode input controls */}
                  <div className="md:col-span-2">
                    {modeMprop === 'free' && (
                      <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2.5 rounded-lg text-center">
                        {isSpanish 
                          ? 'Auto: El optimizador calculará la masa máxima admisible según el volumen útil de la cámara' 
                          : 'Auto: Optimizer finds optimal mass filling available chamber volume'}
                      </div>
                    )}

                    {modeMprop === 'fixed' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {isSpanish ? 'Masa total exacta objetivo:' : 'Exact target total mass:'}
                        </span>
                        <Input
                          type="number"
                          step="5"
                          min="1"
                          value={inputValues.valMprop}
                          onChange={(e) => handleInputChange('valMprop', e.target.value)}
                          placeholder="250.0"
                          className="h-8 text-xs font-mono font-bold w-28"
                        />
                        <span className="text-xs font-mono text-muted-foreground font-bold">g (gramos)</span>
                      </div>
                    )}

                    {modeMprop === 'range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">Mín (g):</span>
                          <Input
                            type="number"
                            step="5"
                            value={inputValues.minMprop}
                            onChange={(e) => handleInputChange('minMprop', e.target.value)}
                            placeholder="150.0"
                            className="h-8 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">Máx (g):</span>
                          <Input
                            type="number"
                            step="5"
                            value={inputValues.maxMprop}
                            onChange={(e) => handleInputChange('maxMprop', e.target.value)}
                            placeholder="350.0"
                            className="h-8 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* Step 2 Footer Navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setActiveStep(1)}
                className="h-10 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={16} />
                {isSpanish ? 'Atrás (Fase 1)' : 'Back (Phase 1)'}
              </Button>
              <Button
                onClick={() => setActiveStep(3)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {isSpanish ? 'Continuar a Fase 3: Algoritmos' : 'Continue to Phase 3: Algorithms'}
                <ArrowRight size={16} />
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* FASE 3: ALGORITMOS Y EJECUCIÓN DEL OPTIMIZADOR */}
      {activeStep === 3 && (
        <Card data-tour="smart-search-phase3-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden border-t-4 border-t-emerald-500">
          <CardHeader className="py-3 px-4 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
                <Cpu size={16} />
                {isSpanish ? 'Fase 3: Algoritmos y Lanzamiento del Optimizador' : 'Phase 3: Algorithms & Optimizer Execution'}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isSpanish ? 'Configura el presupuesto de simulación y lanza la optimización balística global' : 'Configure simulation budget and launch global ballistic optimization'}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border">
              <span>{isSpanish ? 'Hardware:' : 'Hardware:'} <strong className="text-foreground">{DcVal}x{LcVal} mm, Dt={Dt0Val} mm</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            
            {/* Active Objective Summary Card (Pre-selected in Step 0 Inbox) */}
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <Rocket size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-mono">
                      {isSpanish ? 'Objetivo Activo de Misión' : 'Active Mission Objective'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                      {isSpanish ? 'Fijado en Bandeja' : 'Set in Inbox'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {isSpanish ? 'Máxima Altitud / Mayor Impulso Total Real (It)' : 'Maximum Altitude / Peak Total Real Impulse (It)'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isSpanish 
                      ? 'Maximización matemática estricta de It = ∫ F dt garantizando Pmax ≤ P_límite con reglas de Deb sin funciones de penalización arbitrarias.' 
                      : 'Strict mathematical maximization of It = ∫ F dt guaranteeing Pmax ≤ P_limit with Deb rules without arbitrary penalty weights.'}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStep(0)}
                className="h-8 text-xs font-mono border-emerald-500/40 hover:bg-emerald-500/20 shrink-0 cursor-pointer"
              >
                <ArrowLeft size={13} className="mr-1" />
                {isSpanish ? 'Cambiar Objetivo' : 'Change Objective'}
              </Button>
            </div>

            {/* UNIFIED DIFFERENTIAL EVOLUTION ARCHITECTURE & BUDGET SELECTOR */}
            <div data-tour="smart-search-precision-card" className="space-y-4 pt-3 border-t border-border">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                      <Cpu size={17} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-2">
                        <span>{isSpanish ? 'Motor Unificado: Differential Evolution (DE/rand/1/bin)' : 'Unified Engine: Differential Evolution (DE/rand/1/bin)'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                          {isSpanish ? 'Canónico' : 'Canonical'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isSpanish
                          ? 'Optimización estocástica global sin derivadas con muestreo Latino Hipercúbico (LHS), dither adaptativo y selección estricta de factibilidad de Deb.'
                          : 'Derivative-free global stochastic optimizer with Latin Hypercube Sampling (LHS), adaptive dithering, and Deb feasibility selection.'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold">
                      {isSpanish ? 'Objetivo: Max It (Impulso Total)' : 'Objective: Max It (Total Impulse)'}
                    </span>
                  </div>
                </div>

                {/* 4 Architectural Spec Badges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{isSpanish ? 'Estrategia' : 'Strategy'}</div>
                    <div className="font-bold text-foreground mt-0.5">DE/rand/1/bin (LHS)</div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{isSpanish ? 'Variables Activas' : 'Active Variables'}</div>
                    <div className="font-bold text-foreground mt-0.5">
                      {modeD0 !== 'fixed' ? 'D0 ' : ''}{moded0 !== 'fixed' && shape !== 3 ? 'd0 ' : ''}{modeL0 !== 'fixed' ? 'L0' : ''}
                      {modeD0 === 'fixed' && (moded0 === 'fixed' || shape === 3) && modeL0 === 'fixed' ? (isSpanish ? 'Ninguna (Fijadas)' : 'None (Fixed)') : ''}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{isSpanish ? 'Modo de Granos' : 'Grain Mode'}</div>
                    <div className="font-bold text-foreground mt-0.5">
                      {grainCountMode === 'range' ? `Auto (N = 1 .. ${inputValues.maxGrainCount || 5})` : `Fijo (N = ${inputValues.fixedGrainCount || 3})`}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{isSpanish ? 'Restricción Pmax' : 'Pmax Constraint'}</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">≤ {inputValues.Pmax_lim || '6.0'} MPa (Deb)</div>
                  </div>
                </div>
              </div>

              {/* Simulation Budget Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {isSpanish ? 'Presupuesto de Simulaciones por Valor de N' : 'Simulation Budget per Grain Count N'}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {isSpanish ? 'Configura la profundidad de la búsqueda global' : 'Configure global search evaluation depth'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preset 1: Fast (500) */}
                  <div
                    onClick={() => {
                      setBudgetPreset('fast');
                      setEvaluationsPerN(500);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      budgetPreset === 'fast' && evaluationsPerN === 500
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
                        : 'border-border bg-card/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Zap size={14} className="text-amber-500" />
                          {isSpanish ? 'Búsqueda Rápida' : 'Fast Search'}
                        </span>
                        {budgetPreset === 'fast' && evaluationsPerN === 500 && (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isSpanish ? '500 simulaciones / N. Exploración ágil para dimensionado preliminar.' : '500 simulations / N. Fast exploration for preliminary sizing.'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ⚡ ~1 - 2s {isSpanish ? 'por grano' : 'per grain'}
                    </div>
                  </div>

                  {/* Preset 2: Standard (1000) [Recommended] */}
                  <div
                    onClick={() => {
                      setBudgetPreset('standard');
                      setEvaluationsPerN(1000);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      budgetPreset === 'standard' && evaluationsPerN === 1000
                        ? 'border-emerald-500 bg-emerald-500/15 shadow-xs ring-2 ring-emerald-500/30'
                        : 'border-border bg-card/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles size={14} className="text-emerald-500" />
                          {isSpanish ? 'Estándar (Recomendado)' : 'Standard (Recommended)'}
                        </span>
                        {budgetPreset === 'standard' && evaluationsPerN === 1000 && (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isSpanish ? '1.000 simulaciones / N. Convergencia balística sólida de alta fidelidad.' : '1,000 simulations / N. Robust high-fidelity ballistic convergence.'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      🎯 ~2 - 4s {isSpanish ? 'por grano' : 'per grain'}
                    </div>
                  </div>

                  {/* Preset 3: Deep (2000) */}
                  <div
                    onClick={() => {
                      setBudgetPreset('deep');
                      setEvaluationsPerN(2000);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      budgetPreset === 'deep' && evaluationsPerN === 2000
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
                        : 'border-border bg-card/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Rocket size={14} className="text-purple-500" />
                          {isSpanish ? 'Búsqueda Profunda' : 'Deep Search'}
                        </span>
                        {budgetPreset === 'deep' && evaluationsPerN === 2000 && (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isSpanish ? '2.000 simulaciones / N. Máxima exploración global para geometrías complejas.' : '2,000 simulations / N. Exhaustive global exploration for complex geometries.'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      🔬 ~5 - 8s {isSpanish ? 'por grano' : 'per grain'}
                    </div>
                  </div>
                </div>

                {/* Transparent Budget Summary Banner */}
                <div className="p-3 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2 text-foreground">
                    <Activity size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      {grainCountMode === 'range' ? (
                        isSpanish ? (
                          <>Presupuesto: <strong>{evaluationsPerN.toLocaleString()}</strong> evals / grano × <strong>{inputValues.maxGrainCount || 5}</strong> valores de N = <strong className="text-emerald-600 dark:text-emerald-400">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} simulaciones totales</strong></>
                        ) : (
                          <>Budget: <strong>{evaluationsPerN.toLocaleString()}</strong> evals / grain × <strong>{inputValues.maxGrainCount || 5}</strong> N values = <strong className="text-emerald-600 dark:text-emerald-400">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} total simulations</strong></>
                        )
                      ) : (
                        isSpanish ? (
                          <>Presupuesto: <strong className="text-emerald-600 dark:text-emerald-400">{evaluationsPerN.toLocaleString()} simulaciones balísticas</strong> para N = {inputValues.fixedGrainCount || 3} granos fijos</>
                        ) : (
                          <>Budget: <strong className="text-emerald-600 dark:text-emerald-400">{evaluationsPerN.toLocaleString()} ballistic simulations</strong> for fixed N = {inputValues.fixedGrainCount || 3}</>
                        )
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{isSpanish ? 'Personalizar:' : 'Custom:'}</span>
                    <input
                      type="number"
                      min={100}
                      max={10000}
                      step={100}
                      value={evaluationsPerN}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 500;
                        setEvaluationsPerN(val);
                        if (val === 500) setBudgetPreset('fast');
                        else if (val === 1000) setBudgetPreset('standard');
                        else if (val === 2000) setBudgetPreset('deep');
                        else setBudgetPreset('standard');
                      }}
                      className="w-20 h-7 px-2 text-xs font-mono font-bold rounded-md border border-border bg-background text-foreground text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* HIGH-TECH FUTURISTIC OPTIMIZATION PROGRESS HUD */}
            {isSearching && (
              <div className="p-4 rounded-xl border border-emerald-500/50 bg-slate-950 text-white shadow-lg space-y-3 relative overflow-hidden animate-in fade-in duration-300">
                {/* Background ambient glow */}
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-emerald-500/15"></div>
                
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold animate-spin bg-emerald-500/20 text-emerald-400 shrink-0">
                      <Cpu size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono flex items-center gap-2 text-emerald-400">
                        <span>
                          {isSpanish ? 'EVOLUCIÓN DIFERENCIAL ACTIVA (DE/rand/1/bin)' : 'DIFFERENTIAL EVOLUTION RUNNING (DE/rand/1/bin)'}
                        </span>
                        <span className="inline-block w-2 h-2 rounded-full animate-ping bg-emerald-400"></span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                        {searchProgress?.stepDescription || (isSpanish ? 'Evaluando candidatos balísticos...' : 'Evaluating ballistic candidates...')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-base font-bold text-emerald-400">
                        {searchProgress?.percent || 0}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ⏱️ {searchProgress?.elapsedSeconds !== undefined ? searchProgress.elapsedSeconds : (searchProgress?.elapsedMs ? (searchProgress.elapsedMs / 1000).toFixed(1) : '0.0')}s
                      </div>
                    </div>

                    {/* Prominent Red Cancel Button inside HUD */}
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleCancelSearch}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-4 text-xs font-mono flex items-center gap-1.5 shadow-md border border-red-500 cursor-pointer shrink-0"
                    >
                      <XCircle size={15} />
                      {isSpanish ? 'CANCELAR SIMULACIÓN' : 'CANCEL SIMULATION'}
                    </Button>
                  </div>
                </div>

                {/* Glowing Animated Progress Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 relative">
                  <div 
                    className="h-full rounded-full transition-all duration-150 relative bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                    style={{ width: `${Math.min(100, Math.max(5, searchProgress?.percent || 5))}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>

                {/* Status Ticker */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity size={12} className="text-emerald-400" />
                    <span>
                      {isSpanish ? 'Simulaciones Balísticas:' : 'Ballistic Simulations:'}{' '}
                      <strong className="text-white">{searchProgress?.currentEvaluations || 0}</strong>
                      {searchProgress?.totalEstimated ? ` / ~${searchProgress.totalEstimated}` : ''}
                    </span>
                  </div>

                  {searchProgress?.bestConfigSummary && (
                    <div className="text-emerald-300 text-[10px] truncate max-w-xs sm:max-w-md">
                      🏆 {isSpanish ? 'Mejor:' : 'Best:'} <strong>{searchProgress.bestConfigSummary}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Geometric Conflict Warning Banner */}
            {hasGeometricConflict && (
              <div className="p-3.5 rounded-xl border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 flex items-start gap-3 text-xs font-mono shadow-xs">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    {isSpanish ? '⚠️ Restricción Geométrica No Física Detectada' : '⚠️ Non-Physical Geometric Constraint Detected'}
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {isDt0GeDs && (
                      <span className="block">• {isSpanish ? `Garganta tobera Dt (${Dt0Val} mm) ≥ Salida Ds (${DsVal} mm). En toberas de Laval la salida debe ser mayor.` : `Nozzle throat Dt (${Dt0Val} mm) ≥ Exit Ds (${DsVal} mm). Exit must be larger.`}</span>
                    )}
                    {isDt0GeDc && (
                      <span className="block">• {isSpanish ? `Garganta tobera Dt (${Dt0Val} mm) ≥ Cámara Dc (${DcVal} mm). La garganta no cabe en la cámara.` : `Nozzle throat Dt (${Dt0Val} mm) ≥ Chamber Dc (${DcVal} mm).`}</span>
                    )}
                    {isD0GeDc && (
                      <span className="block">• {isSpanish ? `Diámetro exterior D0 (${valD0Num} mm) ≥ Cámara Dc (${DcVal} mm). El grano no cabe en la cámara.` : `Grain outer D0 (${valD0Num} mm) ≥ Chamber Dc (${DcVal} mm). Grain does not fit.`}</span>
                    )}
                    {isMaxD0GeDc && (
                      <span className="block">• {isSpanish ? `Máximo D0 (${maxD0Num} mm) ≥ Cámara Dc (${DcVal} mm). Rango excede el diámetro de cámara.` : `Max D0 (${maxD0Num} mm) ≥ Chamber Dc (${DcVal} mm).`}</span>
                    )}
                    {isD0RangeInverted && (
                      <span className="block">• {isSpanish ? `Rango D0 invertido: Mín (${minD0Num} mm) ≥ Máx (${maxD0Num} mm).` : `Inverted D0 range: Min (${minD0Num} mm) ≥ Max (${maxD0Num} mm).`}</span>
                    )}
                    {isd0GeD0 && (
                      <span className="block">• {isSpanish ? `Núcleo interior d0 (${vald0Num} mm) ≥ Diámetro D0 (${effectiveOuterD} mm). Espesor de pared (web) nulo o negativo.` : `Inner core d0 (${vald0Num} mm) ≥ Outer D0 (${effectiveOuterD} mm). Zero or negative web.`}</span>
                    )}
                    {isd0RangeInverted && (
                      <span className="block">• {isSpanish ? `Rango d0 invertido: Mín (${mind0Num} mm) ≥ Máx (${maxd0Num} mm).` : `Inverted d0 range: Min (${mind0Num} mm) ≥ Max (${maxd0Num} mm).`}</span>
                    )}
                    {isMind0GeD0 && (
                      <span className="block">• {isSpanish ? `Mínimo d0 (${mind0Num} mm) ≥ Diámetro D0 (${effectiveOuterD} mm).` : `Min d0 (${mind0Num} mm) ≥ Outer D0 (${effectiveOuterD} mm).`}</span>
                    )}
                    {isL0ExceedsLc && (
                      <span className="block">• {isSpanish ? `Longitud total N×L0 (${(fixedNNum * valL0Num).toFixed(1)} mm) supera longitud útil de cámara Lc (${LcVal} mm).` : `Total length N×L0 (${(fixedNNum * valL0Num).toFixed(1)} mm) exceeds chamber Lc (${LcVal} mm).`}</span>
                    )}
                    {isL0RangeInverted && (
                      <span className="block">• {isSpanish ? `Rango L0 invertido: Mín (${minL0Num} mm) ≥ Máx (${maxL0Num} mm).` : `Inverted L0 range: Min (${minL0Num} mm) ≥ Max (${maxL0Num} mm).`}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-red-600 dark:text-red-400 font-bold pt-0.5">
                    {isSpanish 
                      ? 'Por favor, retrocede a la Fase 1 o Fase 2 y ajusta las dimensiones antes de iniciar la optimización.'
                      : 'Please return to Phase 1 or Phase 2 and adjust dimensions before starting optimization.'}
                  </div>
                </div>
              </div>
            )}

            {/* Launch Action Bar */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setActiveStep(2)}
                disabled={isSearching}
                className="h-11 px-5 text-xs font-bold flex items-center gap-2 w-full sm:w-auto cursor-pointer"
              >
                <ArrowLeft size={16} />
                {isSpanish ? 'Atrás (Fase 2)' : 'Back (Phase 2)'}
              </Button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {isSearching && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelSearch}
                    className="font-bold h-11 px-6 shadow-md flex items-center justify-center gap-2 text-sm tracking-wide transition-all w-full sm:w-auto cursor-pointer bg-red-600 hover:bg-red-700 text-white border border-red-500"
                  >
                    <XCircle size={18} />
                    {isSpanish ? 'CANCELAR SIMULACIÓN' : 'CANCEL SIMULATION'}
                  </Button>
                )}

                <Button
                  data-tour="smart-search-run-btn"
                  onClick={handleExecuteSearch}
                  disabled={isSearching || hasGeometricConflict}
                  className={`font-bold h-11 px-8 shadow-md flex items-center justify-center gap-2 text-sm tracking-wide transition-all w-full sm:w-auto cursor-pointer text-white ${
                    hasGeometricConflict 
                      ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {isSpanish 
                        ? 'Optimizando con Differential Evolution (DE/rand/1/bin)...' 
                        : 'Optimizing with Differential Evolution...'}
                    </>
                  ) : hasGeometricConflict ? (
                    <>
                      <AlertTriangle size={18} />
                      {isSpanish ? 'CORREGIR COTAS GEOMÉTRICAS' : 'FIX GEOMETRIC CONSTRAINTS'}
                    </>
                  ) : (
                    <>
                      <Cpu size={18} />
                      {isSpanish ? 'EJECUTAR OPTIMIZADOR GLOBAL (DIFFERENTIAL EVOLUTION)' : 'RUN GLOBAL OPTIMIZER (DIFFERENTIAL EVOLUTION)'}
                    </>
                  )}
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ================= RESULTS DASHBOARD (VISIBLE ONCE SEARCH HAS RUN) ================= */}
      {searchOutcome && (
        <div className="space-y-4 pt-2">
          
          {/* CANCELLATION NOTICE IF ABORTED EARLY */}
          {searchOutcome.isCancelled && (
            <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 flex items-center justify-between gap-3 text-xs font-mono shadow-xs">
              <div className="flex items-center gap-2.5">
                <XCircle size={20} className="text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <strong className="font-bold block text-sm">
                    {isSpanish ? 'Simulación cancelada por el usuario' : 'Simulation stopped by user'}
                  </strong>
                  <span className="text-[11px] text-muted-foreground">
                    {isSpanish
                      ? 'La optimización se interrumpió anticipadamente. Se conservan y muestran los mejores candidatos factibles evaluados hasta ese momento.'
                      : 'Optimization was stopped early. Preserving and displaying the best feasible candidates found up to that point.'}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-700 dark:text-red-300 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-red-500/30">
                {isSpanish ? 'Cancelada' : 'Cancelled'}
              </span>
            </div>
          )}
          
          {/* HIGHLY VISIBLE SOLUTIONS FOUND STATS BANNER */}
          <div className={`p-4 rounded-xl border shadow-xs flex flex-wrap items-center justify-between gap-3 ${
            searchOutcome.bestCandidates.length > 0 
              ? (isLight ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-950/20 border-emerald-500/40')
              : (isLight ? 'bg-red-500/10 border-red-500/30' : 'bg-red-950/20 border-red-500/40')
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                searchOutcome.bestCandidates.length > 0
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                {searchOutcome.bestCandidates.length > 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <div className="text-sm md:text-base font-bold text-foreground flex items-center gap-2 font-mono">
                  <span>
                    {searchOutcome.bestCandidates.length > 0
                      ? (isSpanish 
                          ? `${searchOutcome.bestCandidates.length} ${searchOutcome.bestCandidates.length === 1 ? 'Mejor Solución Óptima Encontrada' : 'Mejores Soluciones Óptimas Encontradas'}` 
                          : `${searchOutcome.bestCandidates.length} Top Optimal Solutions Found`)
                      : (isSpanish ? 'No se encontraron soluciones viables' : 'No viable solutions found')}
                  </span>
                  {searchOutcome.safeCount > 0 && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {searchOutcome.safeCount} {isSpanish ? '100% Seguras (P ≤ Pmax)' : 'Safe (P ≤ Pmax)'}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    🧬 Differential Evolution (DE/rand/1/bin)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isSpanish
                    ? `${searchOutcome.totalEvaluated} configuraciones evaluadas exhaustivamente en ${searchOutcome.executionTimeMs} ms`
                    : `${searchOutcome.totalEvaluated} configurations evaluated in ${searchOutcome.executionTimeMs} ms`}
                </div>
              </div>
            </div>

            {/* Overpressure badge indicator */}
            {searchOutcome.hasOverpressureWarning && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle size={15} />
                {isSpanish ? 'Aviso: Presión Elevada' : 'Notice: Elevated Pressure'}
              </span>
            )}
          </div>

          {/* GRAIN COUNT N COMPARISON BREAKDOWN (MODE B: AUTOMATIC N=1..X) */}
          {searchOutcome.grainSummaries && searchOutcome.grainSummaries.length > 1 && (
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="text-emerald-600 dark:text-emerald-400" size={16} />
                  <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                    {isSpanish
                      ? `Comparativa de Impulso por Número de Granos (N = 1 .. ${searchOutcome.grainSummaries.length})`
                      : `Impulse Comparison by Grain Count (N = 1 .. ${searchOutcome.grainSummaries.length})`}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {isSpanish ? 'Selección estricta del mejor impulso factible' : 'Strict selection of highest feasible impulse'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                {searchOutcome.grainSummaries.map((g) => {
                  const isWinner = searchOutcome.bestCandidates[0]?.config.grainCount === g.N;
                  return (
                    <div
                      key={g.N}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        isWinner
                          ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold font-mono text-foreground">
                            N = {g.N} {g.N === 1 ? (isSpanish ? 'grano' : 'grain') : (isSpanish ? 'granos' : 'grains')}
                          </span>
                          {isWinner && (
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                              ★ {isSpanish ? 'GANADOR' : 'WINNER'}
                            </span>
                          )}
                        </div>
                        <div className={`text-sm font-extrabold font-mono ${isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                          {g.bestFeasibleImpulse !== null ? `${g.bestFeasibleImpulse} N·s` : (isSpanish ? 'No factible' : 'Infeasible')}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                          {g.bestConfigLabel}
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-border/40 text-[9px] font-mono text-muted-foreground flex justify-between">
                        <span>{g.evaluations} evals</span>
                        <span>{g.isFeasible ? '✓ Factible' : '✗ Violación'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
                {isSpanish
                  ? `Configuración seleccionada: ${searchOutcome.bestCandidates[0]?.config.grainCount} granos (${searchOutcome.bestCandidates[0]?.metrics.totalImpulse} N·s) por ser la mejor solución encontrada entre todas las configuraciones factibles de N exploradas.`
                  : `Selected configuration: ${searchOutcome.bestCandidates[0]?.config.grainCount} grains (${searchOutcome.bestCandidates[0]?.metrics.totalImpulse} N·s) strictly yielding the highest feasible total impulse across all evaluated grain counts.`}
              </p>
            </div>
          )}

          {/* DETAILED DIAGNOSTIC FEEDBACK WHEN NO SOLUTION OR WARNING */}
          {searchOutcome.diagnostics && searchOutcome.diagnostics.length > 0 && (
            <div className="space-y-2">
              {searchOutcome.diagnostics.map((diag, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border text-xs shadow-xs space-y-1.5 ${
                    diag.code === 'OVERPRESSURE_ALL'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                      : 'bg-red-500/15 border-red-500/40 text-red-950 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle size={16} className={diag.code === 'OVERPRESSURE_ALL' ? 'text-amber-600' : 'text-red-600'} />
                    <span>{diag.title}</span>
                  </div>
                  <p className="leading-relaxed opacity-90 pl-6">
                    {diag.description}
                  </p>
                  <div className="pl-6 pt-1 font-semibold flex items-center gap-1.5">
                    <span>💡 <strong>{isSpanish ? 'Solución Recomendada:' : 'Recommendation:'}</strong> {diag.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TOP 5 CANDIDATES SELECTION GRID */}
          {searchOutcome.bestCandidates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  {isSpanish ? 'Las 5 Mejores Configuraciones Óptimas (Diversidad Balística)' : 'Top 5 Optimal Configurations (Ballistic Diversity)'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isSpanish ? 'Haz clic en una opción para ver su curva transitoria y cargarla' : 'Click an option to inspect curves and apply it'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {searchOutcome.bestCandidates.map((cand, idx) => {
                  const isSelected = selectedCandidateIndex === idx;
                  return (
                    <button
                      key={cand.id}
                      onClick={() => setSelectedCandidateIndex(idx)}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/15 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                            cand.rank === 1 
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            #{cand.rank} {cand.rank === 1 ? (isSpanish ? '★ ÓPTIMO' : '★ BEST') : ''}
                          </span>
                          <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {cand.metrics.totalImpulse} N·s
                          </span>
                        </div>

                        <div className="text-xs font-bold text-foreground font-mono">
                          {cand.config.grainCount}x L={cand.config.L0}mm
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          D={cand.config.D0} / d={cand.config.d0} mm
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/60 text-[10px] font-mono flex items-center justify-between text-muted-foreground">
                        <span>Pmax: <strong className={cand.metrics.maxPressure > parseFloat(inputValues.Pmax_lim || '6.0') ? 'text-amber-500 font-bold' : 'text-foreground'}>{cand.metrics.maxPressure} MPa</strong></span>
                        <span>tb: <strong className="text-foreground">{cand.metrics.burnTime}s</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CANDIDATE DETAIL DASHBOARD & CHARTS */}
          {currentCandidate && (
            <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      {isSpanish ? `Candidato #${currentCandidate.rank}` : `Candidate #${currentCandidate.rank}`}
                    </span>
                    <CardTitle className="text-sm font-bold text-foreground font-mono">
                      {currentCandidate.config.grainSummary}
                    </CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isSpanish 
                      ? `Longitud total ocupada: ${currentCandidate.config.totalGrainLength} mm dentro de cámara ${DcVal}x${LcVal} mm (${currentCandidate.metrics.chamberFillFraction}% llenado)`
                      : `Total grain stack: ${currentCandidate.config.totalGrainLength} mm inside ${DcVal}x${LcVal} mm chamber (${currentCandidate.metrics.chamberFillFraction}% filling)`}
                  </p>
                </div>

                {/* TRANSFER BUTTON TO MAIN ENGINE INPUTS */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleApplyToEngine(currentCandidate)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4 text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {appliedSuccess ? (
                      <>
                        <Check size={16} />
                        {isSpanish ? '¡Cargado en Inputs con éxito!' : 'Applied to Inputs!'}
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {isSpanish ? 'Cargar esta Configuración a Inputs' : 'Apply to Simulator Inputs'}
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                
                {/* Clean, Separated Metric Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {/* Category 1: Impulso Total & Clase */}
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                        <span>{isSpanish ? 'Impulso Total' : 'Total Impulse'}</span>
                        <Zap size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {currentCandidate.metrics.totalImpulse} <span className="text-xs font-normal">N·s</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{isSpanish ? 'Clase:' : 'Class:'}</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-bold">{currentCandidate.metrics.motorClass} ({currentCandidate.metrics.isp}s Isp)</strong>
                    </div>
                  </div>

                  {/* Category 2: Empuje y Fuerzas */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Empuje y Fuerzas' : 'Thrust & Forces'}</span>
                        <Flame size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {currentCandidate.metrics.maxThrust} <span className="text-xs font-normal">N (pico)</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{isSpanish ? 'Media / Inicial:' : 'Avg / Init:'}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.avgThrust}N / {currentCandidate.metrics.initialThrust}N</strong>
                    </div>
                  </div>

                  {/* Category 3: Presión en Cámara */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Presión Cámara' : 'Chamber Pressure'}</span>
                        <Activity size={13} />
                      </div>
                      <div className={`text-lg font-bold font-mono mt-1 ${
                        currentCandidate.metrics.maxPressure > parseFloat(inputValues.Pmax_lim || '6.0') 
                          ? 'text-amber-500' 
                          : 'text-foreground'
                      }`}>
                        {currentCandidate.metrics.maxPressure} <span className="text-xs font-normal">MPa</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{isSpanish ? 'P. Media:' : 'Avg Pres:'}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.avgPressure} MPa</strong>
                    </div>
                  </div>

                  {/* Category 4: Tiempos de Combustión y Perfil */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Tiempo de Quemado' : 'Burn Time'}</span>
                        <Clock size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {currentCandidate.metrics.burnTime} <span className="text-xs font-normal">s</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{isSpanish ? 'Planitud Perfil:' : 'Profile Flatness:'}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.thrustFlatness}%</strong>
                    </div>
                  </div>

                  {/* Category 5: Masa y Ocupación de Cámara */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Masa Propelente' : 'Propellant Mass'}</span>
                        <Layers size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {(currentCandidate.metrics.propellantMassKg * 1000).toFixed(1)} <span className="text-xs font-normal">g</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{isSpanish ? 'Llenado Cámara:' : 'Chamber Fill:'}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.chamberFillFraction}%</strong>
                    </div>
                  </div>
                </div>

                {/* Interactive Diagram Tabs: Curves | Ballistic Scatter Map | Convergence History */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-2">
                    {/* Tabs Selector */}
                    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setDiagramTab('curves')}
                        className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          diagramTab === 'curves'
                            ? 'bg-card text-foreground shadow-xs border border-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Activity size={13} className="text-emerald-500" />
                        <span>{isSpanish ? 'Curvas F(t) y P0(t)' : 'F(t) & P0(t) Curves'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDiagramTab('scatter')}
                        className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          diagramTab === 'scatter'
                            ? 'bg-card text-foreground shadow-xs border border-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <BarChart3 size={13} className="text-blue-500" />
                        <span>{isSpanish ? 'Espacio de Soluciones (Pmax vs It)' : 'Solution Space Map'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDiagramTab('convergence')}
                        className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          diagramTab === 'convergence'
                            ? 'bg-card text-foreground shadow-xs border border-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <TrendingUp size={13} className="text-amber-500" />
                        <span>{isSpanish ? 'Evolución / Convergencia' : 'Convergence History'}</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      {diagramTab === 'curves' && (isSpanish ? `${currentCandidate.simulation.t.length} puntos integrados` : `${currentCandidate.simulation.t.length} simulation steps`)}
                      {diagramTab === 'scatter' && (isSpanish ? `${scatterPoints.length} motores evaluados` : `${scatterPoints.length} evaluated configurations`)}
                      {diagramTab === 'convergence' && (isSpanish ? `${convergenceLineData.length} iteraciones registradas` : `${convergenceLineData.length} iterations tracked`)}
                    </span>
                  </div>

                  {/* TAB 1: Transient Curves */}
                  {diagramTab === 'curves' && (
                    <div className="h-64 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 10 }} 
                            unit="s"
                            stroke={isLight ? '#78716c' : '#94a3b8'} 
                          />
                          <YAxis 
                            yAxisId="thrust" 
                            orientation="left" 
                            tick={{ fontSize: 10 }} 
                            unit="N"
                            stroke="#10b981" 
                          />
                          <YAxis 
                            yAxisId="pressure" 
                            orientation="right" 
                            tick={{ fontSize: 10 }} 
                            unit="MPa"
                            stroke="#3b82f6" 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              fontSize: '11px', 
                              backgroundColor: isLight ? '#ffffff' : '#0f172a',
                              borderColor: isLight ? '#e7e5e4' : '#334155'
                            }} 
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                          <Line 
                            yAxisId="thrust" 
                            type="monotone" 
                            dataKey="F_N" 
                            name={isSpanish ? 'Empuje F (N)' : 'Thrust F (N)'} 
                            stroke="#10b981" 
                            strokeWidth={2.5} 
                            dot={false} 
                          />
                          <Line 
                            yAxisId="pressure" 
                            type="monotone" 
                            dataKey="P0_MPa" 
                            name={isSpanish ? 'Presión P0 (MPa)' : 'Pressure P0 (MPa)'} 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* TAB 2: Ballistic Solution Space (Pmax vs Total Impulse) */}
                  {diagramTab === 'scatter' && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Diagrama de puntos explorados durante la optimización (Verde = Seguro, Rojo/Naranja = Sobrepresión, Estrella = Candidato Seleccionado)' : 'Explored configurations map (Green = Safe, Red = Overpressure, Star = Selected)'}</span>
                      </div>
                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis 
                              type="number" 
                              dataKey="x" 
                              name={isSpanish ? "Presión Pico Pmax" : "Peak Pressure Pmax"} 
                              unit=" MPa"
                              tick={{ fontSize: 10 }}
                              stroke={isLight ? '#78716c' : '#94a3b8'}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="y" 
                              name={isSpanish ? "Impulso Total It" : "Total Impulse It"} 
                              unit=" N·s"
                              tick={{ fontSize: 10 }}
                              stroke={isLight ? '#78716c' : '#94a3b8'}
                            />
                            <ZAxis range={[30, 90]} />
                            <ReferenceLine 
                              x={parseFloat(inputValues.Pmax_lim || '6.0')} 
                              stroke="#ef4444" 
                              strokeDasharray="4 4" 
                              label={{ 
                                value: isSpanish ? `Límite Pmax (${inputValues.Pmax_lim} MPa)` : `Pmax limit (${inputValues.Pmax_lim} MPa)`, 
                                fill: '#ef4444', 
                                fontSize: 10,
                                position: 'insideTopRight'
                              }} 
                            />
                            <Tooltip 
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ payload }) => {
                                if (!payload || !payload.length) return null;
                                const pt = payload[0].payload;
                                return (
                                  <div className="p-2.5 rounded-lg border border-border bg-card shadow-md text-xs font-mono space-y-1">
                                    <div className="font-bold text-foreground">
                                      {pt.grainCount}x L={pt.L0}mm (D={pt.D0} / d={pt.d0}mm)
                                    </div>
                                    <div className="text-emerald-600 dark:text-emerald-400">
                                      {isSpanish ? 'Impulso Total:' : 'Total Impulse:'} <strong>{pt.totalImpulse} N·s</strong>
                                    </div>
                                    <div className={pt.maxPressure > parseFloat(inputValues.Pmax_lim || '6.0') ? 'text-red-500' : 'text-foreground'}>
                                      {isSpanish ? 'Presión Máx:' : 'Max Pressure:'} <strong>{pt.maxPressure} MPa</strong>
                                    </div>
                                    <div className="text-muted-foreground">
                                      tb: {pt.burnTime}s | Fmax: {pt.maxThrust}N
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Scatter name={isSpanish ? "Soluciones" : "Solutions"} data={scatterPoints}>
                              {scatterPoints.map((entry, index) => {
                                let fillColor = entry.isSafe ? '#10b981' : '#ef4444';
                                if (entry.isCurrentSelected) fillColor = '#f59e0b';
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={fillColor} 
                                    stroke={entry.isCurrentSelected ? '#ffffff' : 'none'}
                                    strokeWidth={entry.isCurrentSelected ? 2 : 0}
                                  />
                                );
                              })}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Convergence History Curve */}
                  {diagramTab === 'convergence' && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{isSpanish ? 'Evolución del mejor score y mejor impulso a lo largo de las evaluaciones del algoritmo genético' : 'Evolution of best score and impulse throughout the genetic search iterations'}</span>
                      </div>
                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={convergenceLineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis 
                              dataKey="iteration" 
                              tick={{ fontSize: 10 }} 
                              unit=""
                              stroke={isLight ? '#78716c' : '#94a3b8'} 
                            />
                            <YAxis 
                              yAxisId="score" 
                              orientation="left" 
                              tick={{ fontSize: 10 }} 
                              stroke="#f59e0b" 
                            />
                            <YAxis 
                              yAxisId="impulse" 
                              orientation="right" 
                              tick={{ fontSize: 10 }} 
                              unit=" N·s"
                              stroke="#10b981" 
                            />
                            <Tooltip 
                              contentStyle={{ 
                                fontSize: '11px', 
                                backgroundColor: isLight ? '#ffffff' : '#0f172a',
                                borderColor: isLight ? '#e7e5e4' : '#334155'
                              }} 
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                            <Line 
                              yAxisId="impulse" 
                              type="monotone" 
                              dataKey="bestImpulse" 
                              name={isSpanish ? 'Mejor Impulso It (N·s)' : 'Best Impulse (N·s)'} 
                              stroke="#10b981" 
                              strokeWidth={2.5} 
                              dot={false} 
                            />
                            <Line 
                              yAxisId="score" 
                              type="monotone" 
                              dataKey="bestScore" 
                              name={isSpanish ? 'Mejor Fitness Score' : 'Best Fitness Score'} 
                              stroke="#f59e0b" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4"
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>

              </CardContent>
            </Card>
          )}

        </div>
      )}

    </div>
  );
}
