import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Shield,
  ShieldCheck,
  Send,
  Info,
  Star,
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
import { smartLoc } from '../lib/smartSearchI18n';
import { translations } from '../lib/i18n';
import { ThemeColors } from '../lib/theme';
import { calculateMotorStructure } from '../lib/motorStructure';
import {
  getAllGrainModules,
  getDefaultGrainParamsForShape,
  getGrainShapeDesc,
  getGrainShapeLabel,
  getMaxCSlotDepthMm,
  getMaxFinocylWidthMm,
  getMaxMoonburnerOffsetMm,
  getMaxWagonWheelSpokeWidthMm,
  getMinStarValleyDiameterMm,
  isComplexGrain,
} from '../lib/grains';
import { GrainShapeIcon } from './MotorInputsPanel';
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
  GrainShapeId,
  CustomPropellant, 
  DEFAULT_PROPELLANTS 
} from '../lib/types';

interface SmartVarCardProps {
  title: string;
  subtitle: string;
  unit?: string;
  step?: string;
  mode: VariableConstraintMode;
  setMode: (m: VariableConstraintMode) => void;
  val: string;
  minVal: string;
  maxVal: string;
  onChangeVal: (v: string) => void;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
  onBlurVal?: () => void;
  freeText: string;
  placeholderFixed?: string;
  placeholderMin?: string;
  placeholderMax?: string;
  errorText?: string | null;
  warningText?: string | null;
  loc: (es: string, en: string, fr?: string, it?: string) => string;
}

function SmartVarConstraintCard({
  title,
  subtitle,
  unit = 'mm',
  step = '0.5',
  mode,
  setMode,
  val,
  minVal,
  maxVal,
  onChangeVal,
  onChangeMin,
  onChangeMax,
  onBlurVal,
  freeText,
  placeholderFixed,
  placeholderMin,
  placeholderMax,
  errorText,
  warningText,
  loc,
}: SmartVarCardProps) {
  const hasErr = Boolean(errorText);
  return (
    <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
      <div>
        <div className="text-xs font-bold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground font-mono tabular-nums">{subtitle}</div>
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
        <button
          type="button"
          onClick={() => setMode('free')}
          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
            mode === 'free' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {loc('Libre', 'Free')}
        </button>
        <button
          type="button"
          onClick={() => setMode('fixed')}
          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
            mode === 'fixed' ? 'bg-amber-500 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {loc('Fijo', 'Fixed')}
        </button>
        <button
          type="button"
          onClick={() => setMode('range')}
          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
            mode === 'range' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {loc('Rango', 'Range')}
        </button>
      </div>

      {mode === 'free' && (
        <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
          {freeText}
        </div>
      )}

      {mode === 'fixed' && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step={step}
            value={val}
            onChange={(e) => onChangeVal(e.target.value)}
            onBlur={onBlurVal}
            placeholder={placeholderFixed}
            className={`h-8 text-xs font-mono font-bold flex-1 tabular-nums ${hasErr ? 'border-red-500 bg-red-500/10' : ''}`}
          />
          {unit && <span className="text-xs font-mono text-muted-foreground">{unit}</span>}
          {hasErr && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
        </div>
      )}

      {mode === 'range' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground font-mono">Mín {unit ? `(${unit})` : ''}</span>
            <Input
              type="number"
              step={step}
              value={minVal}
              onChange={(e) => onChangeMin(e.target.value)}
              placeholder={placeholderMin}
              className={`h-8 text-xs font-mono font-bold tabular-nums ${hasErr ? 'border-red-500 bg-red-500/10' : ''}`}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground font-mono">Máx {unit ? `(${unit})` : ''}</span>
            <Input
              type="number"
              step={step}
              value={maxVal}
              onChange={(e) => onChangeMax(e.target.value)}
              placeholder={placeholderMax}
              className={`h-8 text-xs font-mono font-bold tabular-nums ${hasErr ? 'border-red-500 bg-red-500/10' : ''}`}
            />
          </div>
        </div>
      )}

      {errorText && (
        <p className="text-[10px] text-red-500 font-medium flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </p>
      )}
      {!errorText && warningText && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{warningText}</span>
        </p>
      )}
    </div>
  );
}

interface SmartSearchEngineProps {
  initialMotor: MotorInput;
  initialNozzle: NozzleInput;
  initialGrains: GrainInput[];
  customPropellants?: CustomPropellant[];
  lang: string;
  theme: string;
  themeColors?: ThemeColors;
  onApplyConfiguration: (motor: MotorInput, nozzle: NozzleInput, grains: GrainInput[]) => void;
}

export function SmartSearchEngine({
  initialMotor,
  initialNozzle,
  initialGrains,
  customPropellants = [],
  lang,
  theme,
  themeColors,
  onApplyConfiguration
}: SmartSearchEngineProps) {
  const isSpanish = lang === 'es';
  const isFrench = lang === 'fr';
  const isItalian = lang === 'it';
  const isLight = theme === 'light';
  const t = translations[lang] || translations.en;

  const chartThrustColor = themeColors?.chartThrust || '#059669';
  const chartPressureColor = themeColors?.chartPressure || '#2563eb';
  const chartImpulseColor = themeColors?.primary || '#0f766e';
  const chartSecondaryColor = themeColors?.secondary || '#d97706';

  const tooltipStyle = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  }), []);

  const loc = (es: string, en: string, fr?: string, it?: string): string => {
    return smartLoc(es, en, lang, fr, it);
  };

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
        stepDescription: loc(
          'Cancelando simulación y recuperando candidatos evaluados...',
          'Cancelling simulation and gathering evaluated candidates...',
          'Annulation de la simulation et récupération des candidats évalués...',
          'Annullamento della simulazione e recupero dei candidati valutati...'
        )
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

  // Optional thermal insulation layers in Phase 1 (synced initially from main motor inputs)
  const [hasLiner, setHasLiner] = useState<boolean>(() => Boolean(initialMotor.hasLiner));
  const [hasInhibitor, setHasInhibitor] = useState<boolean>(() => Boolean(initialMotor.hasInhibitor));

  // Initial structural clearance helper for clean non-conflicting default bounds
  const initialAvailableD0 = useMemo(() => {
    const struct = calculateMotorStructure(initialMotor);
    return Math.max(12, struct.availableGrainDiameterMm || (initialMotor.Dc || 50) - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // String-based inputs state to allow natural empty string on backspace without forcing '1'
  const [inputValues, setInputValues] = useState({
    Dc: (initialMotor.Dc || 50).toString(),
    Lc: (initialMotor.Lc || 250).toString(),
    Pmax_lim: '6.0',
    linerThickness: (initialMotor.linerThickness ?? 2.0).toString(),
    inhibitorThickness: (initialMotor.inhibitorThickness ?? 2.0).toString(),
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
    // D0 modes (respecting liner/inhibitor available inner diameter)
    valD0: Math.max(10, parseFloat((initialAvailableD0 - 0.5).toFixed(1))).toString(),
    minD0: Math.max(10, parseFloat((initialAvailableD0 - 3.0).toFixed(1))).toString(),
    maxD0: Math.max(10.5, parseFloat(initialAvailableD0.toFixed(1))).toString(),
    // d0 modes
    vald0: (initialGrains[0]?.d0 && initialGrains[0].d0 > 0
      ? initialGrains[0].d0
      : parseFloat(Math.max(6, initialAvailableD0 * 0.3).toFixed(1))
    ).toString(),
    mind0: '6.0',
    maxd0: Math.max(16, parseFloat((initialAvailableD0 * 0.65).toFixed(1))).toString(),
    // Radial feature outer diameter (d0mayor / Dp / Dfin / Dwin) modes
    vald0mayor: (initialGrains[0]?.d0mayor && initialGrains[0].d0mayor > 0
      ? initialGrains[0].d0mayor
      : Math.max(16, parseFloat((initialAvailableD0 * 0.68).toFixed(1)))
    ).toString(),
    mind0mayor: Math.max(14, parseFloat((initialAvailableD0 * 0.45).toFixed(1))).toString(),
    maxd0mayor: Math.max(20, parseFloat((initialAvailableD0 - 3.0).toFixed(1))).toString(),
    // Feature count (Np: Star points / Finocyl fins / Wagon Wheel spokes) modes
    valNp: (initialGrains[0]?.Np && initialGrains[0].Np >= 2
      ? initialGrains[0].Np
      : initialGrains[0]?.shape === 4 || initialGrains[0]?.shape === 9 ? 6 : 5
    ).toString(),
    minNp: initialGrains[0]?.shape === 4 ? '2' : '3',
    maxNp: '8',
    // Finocyl finWidth modes
    valFinWidth: (initialGrains[0]?.finWidth && initialGrains[0].finWidth > 0
      ? initialGrains[0].finWidth
      : parseFloat(Math.max(1.5, initialAvailableD0 * 0.08).toFixed(1))
    ).toString(),
    minFinWidth: '1.2',
    maxFinWidth: parseFloat(Math.max(3.0, initialAvailableD0 * 0.16).toFixed(1)).toString(),
    // Wagon Wheel spokeWidth modes
    valSpokeWidth: (initialGrains[0]?.spokeWidth && initialGrains[0].spokeWidth > 0
      ? initialGrains[0].spokeWidth
      : parseFloat(Math.max(1.5, initialAvailableD0 * 0.075).toFixed(1))
    ).toString(),
    minSpokeWidth: '1.2',
    maxSpokeWidth: parseFloat(Math.max(3.0, initialAvailableD0 * 0.14).toFixed(1)).toString(),
    // Moonburner coreOffset modes
    valCoreOffset: (initialGrains[0]?.coreOffset !== undefined && initialGrains[0].coreOffset >= 0
      ? initialGrains[0].coreOffset
      : parseFloat(Math.max(2.0, initialAvailableD0 * 0.15).toFixed(1))
    ).toString(),
    minCoreOffset: '1.0',
    maxCoreOffset: parseFloat(Math.max(4.0, initialAvailableD0 * 0.3).toFixed(1)).toString(),
    // C-Slot slotWidth modes
    valSlotWidth: (initialGrains[0]?.slotWidth && initialGrains[0].slotWidth > 0
      ? initialGrains[0].slotWidth
      : parseFloat(Math.max(2.5, initialAvailableD0 * 0.15).toFixed(1))
    ).toString(),
    minSlotWidth: '2.0',
    maxSlotWidth: parseFloat(Math.max(5.0, initialAvailableD0 * 0.35).toFixed(1)).toString(),
    // C-Slot / D-Grain slotDepth modes
    valSlotDepth: (initialGrains[0]?.slotDepth && initialGrains[0].slotDepth > 0
      ? initialGrains[0].slotDepth
      : parseFloat(Math.max(6.0, initialAvailableD0 * 0.5).toFixed(1))
    ).toString(),
    minSlotDepth: parseFloat(Math.max(3.0, initialAvailableD0 * 0.2).toFixed(1)).toString(),
    maxSlotDepth: parseFloat(Math.max(8.0, initialAvailableD0 * 0.72).toFixed(1)).toString(),
    // Rod & Tube rodDiameter modes
    valRodDiameter: (initialGrains[0]?.rodDiameter && initialGrains[0].rodDiameter > 0
      ? initialGrains[0].rodDiameter
      : parseFloat(Math.max(3.0, initialAvailableD0 * 0.28).toFixed(1))
    ).toString(),
    minRodDiameter: '2.5',
    maxRodDiameter: parseFloat(Math.max(5.0, initialAvailableD0 * 0.45).toFixed(1)).toString(),
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
  const [shape, setShape] = useState<GrainShapeId>(() => {
    const s = initialGrains[0]?.shape;
    return s && s >= 1 && s <= 9 ? (s as GrainShapeId) : 1;
  });
  const [grainCountMode, setGrainCountMode] = useState<'range' | 'fixed'>('range');
  
  // Advanced Variable Constraint Modes: 'free' | 'fixed' | 'range'
  const [modeD0, setModeD0] = useState<VariableConstraintMode>('free');
  const [moded0, setModed0] = useState<VariableConstraintMode>('free');
  const [moded0mayor, setModed0mayor] = useState<VariableConstraintMode>('free');
  const [modeNp, setModeNp] = useState<VariableConstraintMode>('range');
  const [modeFinWidth, setModeFinWidth] = useState<VariableConstraintMode>('free');
  const [modeSpokeWidth, setModeSpokeWidth] = useState<VariableConstraintMode>('free');
  const [modeCoreOffset, setModeCoreOffset] = useState<VariableConstraintMode>('free');
  const [modeSlotWidth, setModeSlotWidth] = useState<VariableConstraintMode>('free');
  const [modeSlotDepth, setModeSlotDepth] = useState<VariableConstraintMode>('free');
  const [modeRodDiameter, setModeRodDiameter] = useState<VariableConstraintMode>('free');
  const [modeL0, setModeL0] = useState<VariableConstraintMode>('free');
  const [modeMprop, setModeMprop] = useState<VariableConstraintMode>('free');

  // Burn surfaces: 1 = Burns (active), 0 = Inhibited (protected)
  const [outerBurns, setOuterBurns] = useState<boolean>(() => Boolean(initialGrains[0]?.osi));
  const [coreBurns, setCoreBurns] = useState<boolean>(() =>
    initialGrains[0] ? Boolean(initialGrains[0].ci || initialGrains[0].shape !== 3) : true
  );
  const [endsBurn, setEndsBurn] = useState<boolean>(() =>
    initialGrains[0] ? Boolean(initialGrains[0].ei) : true
  );

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

  // Derived values for live hardware preview & radial clearance after Liner/Inhibitor
  const DcVal = parseFloat(inputValues.Dc) || 50;
  const LcVal = parseFloat(inputValues.Lc) || 250;
  const linerThicknessVal = Math.max(0, parseFloat(inputValues.linerThickness) || 0);
  const inhibitorThicknessVal = Math.max(0, parseFloat(inputValues.inhibitorThickness) || 0);

  const liveMotorStruct = useMemo(() => calculateMotorStructure({
    ...initialMotor,
    Dc: DcVal,
    Lc: LcVal,
    hasLiner,
    linerThickness: linerThicknessVal,
    hasInhibitor,
    inhibitorThickness: inhibitorThicknessVal,
  }), [initialMotor, DcVal, LcVal, hasLiner, linerThicknessVal, hasInhibitor, inhibitorThicknessVal]);

  const availableD0 = liveMotorStruct.availableGrainDiameterMm;
  const radialDeductionDiamMm = 2 * liveMotorStruct.linerThicknessMm + 2 * liveMotorStruct.inhibitorThicknessMm;
  const isClearanceCollapsed = availableD0 <= 0;

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
  const hasCorePort = shape === 1 || shape === 2 || shape === 4 || shape === 5 || shape === 8 || shape === 9;
  const usesRadialD0MayorAndNp = shape === 2 || shape === 4 || shape === 9;

  const isD0EmptyOrInvalid = modeD0 === 'fixed' && touched['valD0'] && (!inputValues.valD0.trim() || parseFloat(inputValues.valD0) <= 0);
  const isd0EmptyOrInvalid = hasCorePort && moded0 === 'fixed' && touched['vald0'] && (!inputValues.vald0.trim() || parseFloat(inputValues.vald0) <= 0);
  const isd0mayorEmptyOrInvalid = usesRadialD0MayorAndNp && moded0mayor === 'fixed' && touched['vald0mayor'] && (!inputValues.vald0mayor.trim() || parseFloat(inputValues.vald0mayor) <= 0);
  const isL0EmptyOrInvalid = modeL0 === 'fixed' && touched['valL0'] && (!inputValues.valL0.trim() || parseFloat(inputValues.valL0) <= 0);

  // Geometric & Physical validation helpers for Phase 1 & 2
  const isDt0GeDs = Dt0Val >= DsVal;
  const isDt0GeDc = Dt0Val >= DcVal;

  const valD0Num = parseFloat(inputValues.valD0) || 0;
  const minD0Num = parseFloat(inputValues.minD0) || 0;
  const maxD0Num = parseFloat(inputValues.maxD0) || 0;

  const vald0Num = parseFloat(inputValues.vald0) || 0;
  const mind0Num = parseFloat(inputValues.mind0) || 0;
  const maxd0Num = parseFloat(inputValues.maxd0) || 0;

  const vald0mayorNum = parseFloat(inputValues.vald0mayor) || 0;
  const mind0mayorNum = parseFloat(inputValues.mind0mayor) || 0;
  const maxd0mayorNum = parseFloat(inputValues.maxd0mayor) || 0;

  const valNpNum = parseInt(inputValues.valNp) || 0;
  const minNpNum = parseInt(inputValues.minNp) || 0;
  const maxNpNum = parseInt(inputValues.maxNp) || 0;

  const valFinWidthNum = parseFloat(inputValues.valFinWidth) || 0;
  const minFinWidthNum = parseFloat(inputValues.minFinWidth) || 0;
  const maxFinWidthNum = parseFloat(inputValues.maxFinWidth) || 0;

  const valSpokeWidthNum = parseFloat(inputValues.valSpokeWidth) || 0;
  const minSpokeWidthNum = parseFloat(inputValues.minSpokeWidth) || 0;
  const maxSpokeWidthNum = parseFloat(inputValues.maxSpokeWidth) || 0;

  const valCoreOffsetNum = parseFloat(inputValues.valCoreOffset);
  const minCoreOffsetNum = parseFloat(inputValues.minCoreOffset);
  const maxCoreOffsetNum = parseFloat(inputValues.maxCoreOffset);

  const valSlotWidthNum = parseFloat(inputValues.valSlotWidth) || 0;
  const minSlotWidthNum = parseFloat(inputValues.minSlotWidth) || 0;
  const maxSlotWidthNum = parseFloat(inputValues.maxSlotWidth) || 0;

  const valSlotDepthNum = parseFloat(inputValues.valSlotDepth) || 0;
  const minSlotDepthNum = parseFloat(inputValues.minSlotDepth) || 0;
  const maxSlotDepthNum = parseFloat(inputValues.maxSlotDepth) || 0;

  const valRodDiameterNum = parseFloat(inputValues.valRodDiameter) || 0;
  const minRodDiameterNum = parseFloat(inputValues.minRodDiameter) || 0;
  const maxRodDiameterNum = parseFloat(inputValues.maxRodDiameter) || 0;

  const valL0Num = parseFloat(inputValues.valL0) || 0;
  const minL0Num = parseFloat(inputValues.minL0) || 0;
  const maxL0Num = parseFloat(inputValues.maxL0) || 0;

  const fixedNNum = parseInt(inputValues.fixedGrainCount) || 1;

  // D0 checks against available inner diameter (Dc - 2*liner - 2*inhibitor)
  const isD0ExceedsClearance = !isClearanceCollapsed && modeD0 === 'fixed' && valD0Num > availableD0 + 1e-6 && valD0Num > 0;
  const isMaxD0ExceedsClearance = !isClearanceCollapsed && modeD0 === 'range' && maxD0Num > availableD0 + 1e-6 && maxD0Num > 0;
  const isMinD0ExceedsClearance = !isClearanceCollapsed && modeD0 === 'range' && minD0Num > availableD0 + 1e-6 && minD0Num > 0;
  const isD0RangeInverted = modeD0 === 'range' && minD0Num > 0 && maxD0Num > 0 && minD0Num >= maxD0Num;

  // d0 checks for core-bearing shapes (1, 2, 4, 5, 8, 9):
  const effectiveOuterD = modeD0 === 'fixed' && valD0Num > 0
    ? Math.min(valD0Num, Math.max(0, availableD0))
    : modeD0 === 'range' && maxD0Num > 0
      ? Math.min(maxD0Num, Math.max(0, availableD0))
      : Math.max(0, availableD0);
  const effectiveMinOuterD = modeD0 === 'fixed' && valD0Num > 0
    ? valD0Num
    : modeD0 === 'range' && minD0Num > 0
      ? minD0Num
      : Math.max(10, availableD0 - 4);
  const effectiveMaxd0Ref = moded0 === 'fixed' && vald0Num > 0
    ? vald0Num
    : moded0 === 'range' && maxd0Num > 0
      ? maxd0Num
      : effectiveOuterD * 0.6;
  const effectiveMind0Ref = moded0 === 'fixed' && vald0Num > 0
    ? vald0Num
    : moded0 === 'range' && mind0Num > 0
      ? mind0Num
      : 4.0;

  const isd0GeD0 = hasCorePort && moded0 === 'fixed' && vald0Num > 0 && vald0Num >= effectiveOuterD;
  const isd0RangeInverted = hasCorePort && moded0 === 'range' && mind0Num > 0 && maxd0Num > 0 && mind0Num >= maxd0Num;
  const isMind0GeD0 = hasCorePort && moded0 === 'range' && mind0Num > 0 && mind0Num >= effectiveOuterD;

  // Star checks (shape === 2):
  const starMaxNpPossible =
    modeNp === 'fixed'
      ? Math.max(3, valNpNum)
      : modeNp === 'range'
        ? Math.max(3, maxNpNum)
        : 10;
  const starRefNpForDisplay =
    modeNp === 'fixed'
      ? Math.max(3, valNpNum)
      : modeNp === 'range'
        ? Math.max(3, minNpNum || 3)
        : 5;
  const starMinD0Ref =
    moded0 === 'fixed'
      ? vald0Num
      : moded0 === 'range'
        ? mind0Num
        : 0;
  const minStarD0mayorStrict =
    shape === 2 && starMinD0Ref > 0 && starMaxNpPossible >= 3
      ? getMinStarValleyDiameterMm(starMinD0Ref, starMaxNpPossible)
      : 0;
  const minStarD0mayorDisplay =
    shape === 2 && starMinD0Ref > 0 && starRefNpForDisplay >= 3
      ? getMinStarValleyDiameterMm(starMinD0Ref, starRefNpForDisplay)
      : 0;

  const isd0mayorLeqd0 = shape === 2 && moded0mayor === 'fixed' && moded0 === 'fixed' && vald0mayorNum > 0 && vald0Num > 0 && vald0mayorNum <= vald0Num;
  const isStarDpBelowGeomMin =
    shape === 2 &&
    moded0mayor === 'fixed' &&
    vald0mayorNum > 0 &&
    minStarD0mayorStrict > 0 &&
    vald0mayorNum <= minStarD0mayorStrict + 1e-6;
  const isd0mayorGeD0 = usesRadialD0MayorAndNp && moded0mayor === 'fixed' && vald0mayorNum > 0 && vald0mayorNum >= effectiveOuterD;
  const isd0mayorRangeInverted = usesRadialD0MayorAndNp && moded0mayor === 'range' && mind0mayorNum > 0 && maxd0mayorNum > 0 && mind0mayorNum >= maxd0mayorNum;
  const isMaxd0mayorGeD0 = usesRadialD0MayorAndNp && moded0mayor === 'range' && maxd0mayorNum > 0 && maxd0mayorNum >= effectiveOuterD;
  const isMind0mayorGeD0 = usesRadialD0MayorAndNp && moded0mayor === 'range' && mind0mayorNum > 0 && mind0mayorNum >= effectiveOuterD;
  const isMaxd0mayorLeqd0 = usesRadialD0MayorAndNp && moded0mayor === 'range' && moded0 === 'fixed' && maxd0mayorNum > 0 && vald0Num > 0 && maxd0mayorNum <= vald0Num;
  const isMaxd0mayorLeqMind0 = usesRadialD0MayorAndNp && moded0mayor === 'range' && moded0 === 'range' && maxd0mayorNum > 0 && mind0Num > 0 && maxd0mayorNum <= mind0Num;
  const isStarMaxDpBelowGeomMin =
    shape === 2 &&
    moded0mayor === 'range' &&
    maxd0mayorNum > 0 &&
    minStarD0mayorStrict > 0 &&
    maxd0mayorNum <= minStarD0mayorStrict + 1e-6;
  const isStarRangeMinDpPartial =
    shape === 2 &&
    moded0mayor === 'range' &&
    !isStarMaxDpBelowGeomMin &&
    mind0mayorNum > 0 &&
    minStarD0mayorDisplay > 0 &&
    mind0mayorNum <= minStarD0mayorDisplay + 1e-6;
  const isStarGeomExceedsD0 =
    shape === 2 &&
    !isClearanceCollapsed &&
    minStarD0mayorStrict > 0 &&
    effectiveOuterD > 0 &&
    minStarD0mayorStrict >= effectiveOuterD - 0.5;

  const minNpRequired = shape === 4 ? 2 : 3;
  const isNpInvalid = usesRadialD0MayorAndNp && modeNp === 'fixed' && valNpNum < minNpRequired;
  const isNpRangeInvalid = usesRadialD0MayorAndNp && modeNp === 'range' && (minNpNum < minNpRequired || maxNpNum < minNpRequired || minNpNum > maxNpNum);
  const hasStarGeometricAlert =
    shape === 2 &&
    (isNpInvalid ||
      isNpRangeInvalid ||
      isd0mayorLeqd0 ||
      isStarDpBelowGeomMin ||
      isd0mayorGeD0 ||
      isd0mayorRangeInverted ||
      isMaxd0mayorGeD0 ||
      isMind0mayorGeD0 ||
      isMaxd0mayorLeqd0 ||
      isMaxd0mayorLeqMind0 ||
      isStarMaxDpBelowGeomMin ||
      isStarGeomExceedsD0);

  // Finocyl (4) & Wagon Wheel (9) radial feature checks
  const isRadialTipLeqd0 = (shape === 4 || shape === 9) && moded0mayor === 'fixed' && moded0 === 'fixed' && vald0mayorNum > 0 && vald0Num > 0 && vald0mayorNum <= vald0Num;
  const refNpForMaxWidth = modeNp === 'fixed' ? Math.max(minNpRequired, valNpNum) : modeNp === 'range' ? Math.max(minNpRequired, minNpNum) : 6;
  const maxFinWidthAllowed = shape === 4 ? getMaxFinocylWidthMm(effectiveMaxd0Ref, refNpForMaxWidth) : 999;
  const isFinWidthInvalid = shape === 4 && (
    (modeFinWidth === 'fixed' && (valFinWidthNum <= 0 || valFinWidthNum >= maxFinWidthAllowed - 1e-6)) ||
    (modeFinWidth === 'range' && ((minFinWidthNum > 0 && maxFinWidthNum > 0 && minFinWidthNum >= maxFinWidthNum) || minFinWidthNum >= maxFinWidthAllowed - 1e-6))
  );
  const maxSpokeWidthAllowed = shape === 9 ? getMaxWagonWheelSpokeWidthMm(effectiveMaxd0Ref, refNpForMaxWidth) : 999;
  const isSpokeWidthInvalid = shape === 9 && (
    (modeSpokeWidth === 'fixed' && (valSpokeWidthNum <= 0 || valSpokeWidthNum >= maxSpokeWidthAllowed - 1e-6)) ||
    (modeSpokeWidth === 'range' && ((minSpokeWidthNum > 0 && maxSpokeWidthNum > 0 && minSpokeWidthNum >= maxSpokeWidthNum) || minSpokeWidthNum >= maxSpokeWidthAllowed - 1e-6))
  );

  // Moonburner (5) checks
  const maxMoonOffsetAllowed = shape === 5 ? getMaxMoonburnerOffsetMm(effectiveOuterD, effectiveMind0Ref) : 999;
  const isMoonOffsetInvalid = shape === 5 && (
    (modeCoreOffset === 'fixed' && (isNaN(valCoreOffsetNum) || valCoreOffsetNum < 0 || valCoreOffsetNum >= maxMoonOffsetAllowed - 0.1)) ||
    (modeCoreOffset === 'range' && ((!isNaN(minCoreOffsetNum) && !isNaN(maxCoreOffsetNum) && minCoreOffsetNum >= maxCoreOffsetNum) || (!isNaN(minCoreOffsetNum) && (minCoreOffsetNum < 0 || minCoreOffsetNum >= maxMoonOffsetAllowed - 0.1))))
  );

  // C-Slot (6) checks
  const refCSlotWidth = modeSlotWidth === 'fixed' ? valSlotWidthNum : modeSlotWidth === 'range' ? minSlotWidthNum : Math.max(2, effectiveOuterD * 0.1);
  const maxCSlotDepthAllowed = shape === 6 ? getMaxCSlotDepthMm(effectiveOuterD, refCSlotWidth) : 999;
  const isCSlotWidthInvalid = shape === 6 && (
    (modeSlotWidth === 'fixed' && (valSlotWidthNum <= 0 || valSlotWidthNum >= effectiveOuterD)) ||
    (modeSlotWidth === 'range' && ((minSlotWidthNum > 0 && maxSlotWidthNum > 0 && minSlotWidthNum >= maxSlotWidthNum) || minSlotWidthNum >= effectiveOuterD))
  );
  const isCSlotDepthInvalid = shape === 6 && (
    (modeSlotDepth === 'fixed' && (valSlotDepthNum <= 0 || valSlotDepthNum >= maxCSlotDepthAllowed - 0.1)) ||
    (modeSlotDepth === 'range' && ((minSlotDepthNum > 0 && maxSlotDepthNum > 0 && minSlotDepthNum >= maxSlotDepthNum) || minSlotDepthNum >= maxCSlotDepthAllowed - 0.1))
  );

  // D-Grain (7) checks
  const isDGrainDepthInvalid = shape === 7 && (
    (modeSlotDepth === 'fixed' && (valSlotDepthNum <= 0 || valSlotDepthNum >= effectiveOuterD - 1.0)) ||
    (modeSlotDepth === 'range' && ((minSlotDepthNum > 0 && maxSlotDepthNum > 0 && minSlotDepthNum >= maxSlotDepthNum) || minSlotDepthNum >= effectiveOuterD - 1.0))
  );

  // Rod & Tube (8) checks
  const maxRodAllowed = shape === 8 ? Math.max(0, effectiveMaxd0Ref - 0.5) : 999;
  const isRodTubeInvalid = shape === 8 && (
    (modeRodDiameter === 'fixed' && (valRodDiameterNum <= 0 || valRodDiameterNum >= maxRodAllowed)) ||
    (modeRodDiameter === 'range' && ((minRodDiameterNum > 0 && maxRodDiameterNum > 0 && minRodDiameterNum >= maxRodDiameterNum) || minRodDiameterNum >= maxRodAllowed))
  );

  // L0 checks:
  const isL0ExceedsLc = modeL0 === 'fixed' && grainCountMode === 'fixed' && valL0Num > 0 && (valL0Num * fixedNNum) > LcVal;
  const isL0RangeInverted = modeL0 === 'range' && minL0Num > 0 && maxL0Num > 0 && minL0Num >= maxL0Num;

  // Critical geometric conflict preventing launch
  const hasGeometricConflict =
    isClearanceCollapsed ||
    isDt0GeDs ||
    isDt0GeDc ||
    isD0ExceedsClearance ||
    isMaxD0ExceedsClearance ||
    isMinD0ExceedsClearance ||
    isD0RangeInverted ||
    isd0GeD0 ||
    isd0RangeInverted ||
    isMind0GeD0 ||
    isd0mayorLeqd0 ||
    isStarDpBelowGeomMin ||
    isd0mayorGeD0 ||
    isd0mayorRangeInverted ||
    isMaxd0mayorGeD0 ||
    isMind0mayorGeD0 ||
    isMaxd0mayorLeqd0 ||
    isMaxd0mayorLeqMind0 ||
    isStarMaxDpBelowGeomMin ||
    isStarGeomExceedsD0 ||
    isNpInvalid ||
    isNpRangeInvalid ||
    isRadialTipLeqd0 ||
    isFinWidthInvalid ||
    isSpokeWidthInvalid ||
    isMoonOffsetInvalid ||
    isCSlotWidthInvalid ||
    isCSlotDepthInvalid ||
    isDGrainDepthInvalid ||
    isRodTubeInvalid ||
    isL0ExceedsLc ||
    isL0RangeInverted;

  const handleShapeSelect = (newShape: GrainShapeId) => {
    setShape(newShape);
    const defs = getDefaultGrainParamsForShape(newShape, effectiveMinOuterD);
    if (newShape === 3) {
      setCoreBurns(false);
      setOuterBurns(true);
    } else if (shape === 3) {
      setCoreBurns(true);
    }
    setInputValues((prev) => ({
      ...prev,
      ...(defs.d0 && defs.d0 > 0 ? { vald0: defs.d0.toString() } : {}),
      ...(defs.d0mayor && defs.d0mayor > 0 ? { vald0mayor: defs.d0mayor.toString() } : {}),
      ...(defs.Np && defs.Np > 0 ? { valNp: defs.Np.toString(), minNp: newShape === 4 ? '2' : '3' } : {}),
      ...(defs.finWidth !== undefined ? { valFinWidth: defs.finWidth.toString() } : {}),
      ...(defs.spokeWidth !== undefined ? { valSpokeWidth: defs.spokeWidth.toString() } : {}),
      ...(defs.coreOffset !== undefined ? { valCoreOffset: defs.coreOffset.toString() } : {}),
      ...(defs.slotWidth !== undefined ? { valSlotWidth: defs.slotWidth.toString() } : {}),
      ...(defs.slotDepth !== undefined ? { valSlotDepth: defs.slotDepth.toString() } : {}),
      ...(defs.rodDiameter !== undefined ? { valRodDiameter: defs.rodDiameter.toString() } : {}),
    }));
  };


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
      stepDescription: loc('Inicializando espacio de búsqueda balístico...', 'Initializing ballistic search space...'),
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
      const linerThicknessNum = Math.max(0, parseFloat(inputValues.linerThickness) || 0);
      const inhibitorThicknessNum = Math.max(0, parseFloat(inputValues.inhibitorThickness) || 0);
      const Dt0Num = parseFloat(inputValues.Dt0) || 8.0;
      const DsNum = parseFloat(inputValues.Ds) || 18.0;
      const alphaNum = parseFloat(inputValues.alpha) || 15;
      const maxNNum = parseInt(inputValues.maxGrainCount) || 5;
      const fixedNNum = parseInt(inputValues.fixedGrainCount) || 3;
      
      // D0
      const valD0NumExec = parseFloat(inputValues.valD0) || Math.max(10, availableD0 - 0.5);
      const minD0NumExec = parseFloat(inputValues.minD0) || Math.max(10, availableD0 - 3.0);
      const maxD0NumExec = parseFloat(inputValues.maxD0) || Math.max(10.5, availableD0);
      
      // d0
      const vald0NumExec = parseFloat(inputValues.vald0) || 10.0;
      const mind0NumExec = parseFloat(inputValues.mind0) || 6.0;
      const maxd0NumExec = parseFloat(inputValues.maxd0) || 16.0;

      // d0mayor & Np (Star / Finocyl / Wagon Wheel)
      const vald0mayorNumExec = parseFloat(inputValues.vald0mayor) || Math.max(16, availableD0 * 0.68);
      const mind0mayorNumExec = parseFloat(inputValues.mind0mayor) || Math.max(14, availableD0 * 0.45);
      const maxd0mayorNumExec = parseFloat(inputValues.maxd0mayor) || Math.max(20, availableD0 - 3.0);
      const minNpFloor = shape === 4 ? 2 : 3;
      const valNpNumExec = Math.max(minNpFloor, parseInt(inputValues.valNp) || (shape === 2 ? 5 : 6));
      const minNpNumExec = Math.max(minNpFloor, parseInt(inputValues.minNp) || minNpFloor);
      const maxNpNumExec = Math.max(minNpNumExec, parseInt(inputValues.maxNp) || 8);

      // Shape-specific parameter values
      const valFinWidthExec = parseFloat(inputValues.valFinWidth) || 3.0;
      const minFinWidthExec = parseFloat(inputValues.minFinWidth) || 1.2;
      const maxFinWidthExec = parseFloat(inputValues.maxFinWidth) || 6.0;

      const valSpokeWidthExec = parseFloat(inputValues.valSpokeWidth) || 3.0;
      const minSpokeWidthExec = parseFloat(inputValues.minSpokeWidth) || 1.2;
      const maxSpokeWidthExec = parseFloat(inputValues.maxSpokeWidth) || 6.0;

      const valCoreOffsetExec = parseFloat(inputValues.valCoreOffset);
      const minCoreOffsetExec = parseFloat(inputValues.minCoreOffset);
      const maxCoreOffsetExec = parseFloat(inputValues.maxCoreOffset);

      const valSlotWidthExec = parseFloat(inputValues.valSlotWidth) || 5.0;
      const minSlotWidthExec = parseFloat(inputValues.minSlotWidth) || 2.0;
      const maxSlotWidthExec = parseFloat(inputValues.maxSlotWidth) || 12.0;

      const valSlotDepthExec = parseFloat(inputValues.valSlotDepth) || 16.0;
      const minSlotDepthExec = parseFloat(inputValues.minSlotDepth) || 6.0;
      const maxSlotDepthExec = parseFloat(inputValues.maxSlotDepth) || 30.0;

      const valRodDiameterExec = parseFloat(inputValues.valRodDiameter) || 10.0;
      const minRodDiameterExec = parseFloat(inputValues.minRodDiameter) || 2.5;
      const maxRodDiameterExec = parseFloat(inputValues.maxRodDiameter) || 18.0;
      
      // L0
      const valL0NumExec = parseFloat(inputValues.valL0) || 50.0;
      const minL0NumExec = parseFloat(inputValues.minL0) || 30.0;
      const maxL0NumExec = parseFloat(inputValues.maxL0) || 70.0;
      
      const targetItNum = parseFloat(inputValues.targetImpulseVal) || 250;
      const targetAltNum = parseFloat(inputValues.targetAltitudeVal) || 1500;
      const dryMassNum = parseFloat(inputValues.rocketDryMassKg) || 1.5;

      const numOr = (raw: string | undefined, fallback: number) => {
        const parsed = parseFloat(raw ?? '');
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const etacNum = numOr(inputValues.etac, 0.85);
      const etanozNum = numOr(inputValues.etanoz, 0.75);
      const PambNum = numOr(inputValues.Pamb, 0.101325);
      const GstarNum = numOr(inputValues.Gstar, 1.0);
      const kvNum = numOr(inputValues.kv, 0.1);
      const eNum = numOr(inputValues.e, 0);

      const valMpropNum = parseFloat(inputValues.valMprop) || 250.0;
      const minMpropNum = parseFloat(inputValues.minMprop) || 150.0;
      const maxMpropNum = parseFloat(inputValues.maxMprop) || 350.0;

      const outcome = await runSmartSearchAsync({
        Dc: DcNum,
        Lc: LcNum,
        Pmax_lim: PmaxNum,
        hasLiner,
        linerThickness: linerThicknessNum,
        hasInhibitor,
        inhibitorThickness: inhibitorThicknessNum,
        wallThickness: initialMotor.wallThickness,
        materialId: initialMotor.materialId,
        customMaterialName: initialMotor.customMaterialName,
        customMaterialDensity: initialMotor.customMaterialDensity,
        customMaterialYieldMPa: initialMotor.customMaterialYieldMPa,
        safetyFactor: initialMotor.safetyFactor,
        hasBoltedClosure: initialMotor.hasBoltedClosure,
        boltMetric: initialMotor.boltMetric,
        boltGrade: initialMotor.boltGrade,
        boltCount: initialMotor.boltCount,
        paso_de_tiempo: initialMotor.paso_de_tiempo || 0.0005,
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
        valD0: valD0NumExec,
        minD0: minD0NumExec,
        maxD0: maxD0NumExec,
        moded0,
        vald0: vald0NumExec,
        mind0: mind0NumExec,
        maxd0: maxd0NumExec,
        moded0mayor,
        vald0mayor: vald0mayorNumExec,
        mind0mayor: mind0mayorNumExec,
        maxd0mayor: maxd0mayorNumExec,
        modeNp,
        valNp: valNpNumExec,
        minNp: minNpNumExec,
        maxNp: maxNpNumExec,
        modeFinWidth,
        valFinWidth: valFinWidthExec,
        minFinWidth: minFinWidthExec,
        maxFinWidth: maxFinWidthExec,
        modeSpokeWidth,
        valSpokeWidth: valSpokeWidthExec,
        minSpokeWidth: minSpokeWidthExec,
        maxSpokeWidth: maxSpokeWidthExec,
        modeCoreOffset,
        valCoreOffset: Number.isFinite(valCoreOffsetExec) ? valCoreOffsetExec : 5.0,
        minCoreOffset: Number.isFinite(minCoreOffsetExec) ? minCoreOffsetExec : 1.0,
        maxCoreOffset: Number.isFinite(maxCoreOffsetExec) ? maxCoreOffsetExec : 12.0,
        modeSlotWidth,
        valSlotWidth: valSlotWidthExec,
        minSlotWidth: minSlotWidthExec,
        maxSlotWidth: maxSlotWidthExec,
        modeSlotDepth,
        valSlotDepth: valSlotDepthExec,
        minSlotDepth: minSlotDepthExec,
        maxSlotDepth: maxSlotDepthExec,
        modeRodDiameter,
        valRodDiameter: valRodDiameterExec,
        minRodDiameter: minRodDiameterExec,
        maxRodDiameter: maxRodDiameterExec,
        modeL0,
        valL0: valL0NumExec,
        minL0: minL0NumExec,
        maxL0: maxL0NumExec,
        // Propellant mass constraints
        modeMprop,
        valMprop: valMpropNum,
        minMprop: minMpropNum,
        maxMprop: maxMpropNum,
        osi: outerBurns ? 1 : 0,
        ci: shape === 3 ? 0 : (coreBurns ? 1 : 0),
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
    const motorToApply = {
      ...cand.inputs.motor,
      paso_de_tiempo: initialMotor.paso_de_tiempo || cand.inputs.motor.paso_de_tiempo || 0.001
    };
    onApplyConfiguration(motorToApply, cand.inputs.nozzle, cand.inputs.grains);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3500);
  };

  return (
    <div className="space-y-4">
      
      {/* ================= TOP HEADER & STEP TRACKER ================= */}
      <div className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/25 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-foreground flex flex-wrap items-center gap-2 font-mono">
                HERMES SMART SEARCH v2.1.0
                <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                  · {loc('Optimizador Balístico Inteligente', 'Intelligent Ballistic Optimizer', 'Optimiseur Balistique Intelligent', 'Ottimizzatore Balistico Intelligente')}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {loc(
                  'Búsqueda evolutiva de geometrías de grano óptimas para cámara y tobera existentes',
                  'Evolutionary inverse optimization of propellant grain geometries for fixed chamber and nozzle',
                  'Optimisation inverse évolutive des géométries de grains pour chambre et tuyère fixes',
                  'Ottimizzazione inversa evolutiva delle geometrie dei grani per camera e ugello fissi'
                )}
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
            className="h-8 text-xs font-mono flex items-center gap-1.5 border-border cursor-pointer"
          >
            <Info size={14} className="text-primary" />
            {loc('Algoritmo & Formulación', 'Algorithm & Formulation', 'Algorithme & Formulation', 'Algoritmo & Formulazione')}
          </Button>

          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border flex-wrap">
            <button
              onClick={() => setActiveStep(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 0 
                  ? 'bg-primary text-primary-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Target size={13} />
              {loc('Objetivo: Máx Altitud', 'Goal: Max Altitude', 'Objectif : Altitude Max', 'Obiettivo: Altitudine Max')}
            </button>

            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(1)}
              data-tour="smart-search-phase-1-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 1 
                  ? 'bg-primary text-primary-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded bg-black/15 dark:bg-white/15 flex items-center justify-center text-[10px] font-mono tabular-nums">1</span>
              {loc('Fase 1: Hardware', 'Phase 1: Hardware', 'Phase 1 : Matériel', 'Fase 1: Hardware')}
            </button>
            
            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(2)}
              data-tour="smart-search-phase-2-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 2 
                  ? 'bg-primary text-primary-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded bg-black/15 dark:bg-white/15 flex items-center justify-center text-[10px] font-mono tabular-nums">2</span>
              {loc('Fase 2: Granos', 'Phase 2: Grains', 'Phase 2 : Grains', 'Fase 2: Grani')}
            </button>

            <ChevronRight size={14} className="text-muted-foreground opacity-50" />

            <button
              onClick={() => setActiveStep(3)}
              data-tour="smart-search-phase-3-btn"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeStep === 3 
                  ? 'bg-primary text-primary-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="w-4 h-4 rounded bg-black/15 dark:bg-white/15 flex items-center justify-center text-[10px] font-mono tabular-nums">3</span>
              {loc('Fase 3: Algoritmos', 'Phase 3: Algorithms', 'Phase 3 : Algorithmes', 'Fase 3: Algoritmi')}
            </button>
          </div>
        </div>
      </div>

      {/* ================= INFORMATIVE MODAL / BANNER: ALGORITHM & SIMULATION FORMULATION ================= */}
      {showAlgorithmInfo && (
        <div className="p-5 rounded-xl border border-border bg-card text-foreground space-y-4 text-xs leading-relaxed transition-all shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h4 className="font-bold font-mono text-sm flex items-center gap-2 text-primary">
              <Zap size={18} className="text-primary" />
              {loc('Guía Completa de Smart Search: Flujo de Misión, Algoritmos, Modus Operandi y Formulación', 'Smart Search Complete Guide: Mission Workflow, Algorithms, Modus Operandi & Formulation')}
            </h4>
            <button 
              onClick={() => setShowAlgorithmInfo(false)}
              className="text-xs font-bold px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
            >
              ✕ {loc('Cerrar Guía', 'Close Guide')}
            </button>
          </div>

          {/* Workflow Sequence: Goal -> Phase 1 -> Phase 2 -> Phase 3 */}
          <div className="space-y-2 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <span className="font-bold font-mono uppercase text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Target size={15} />
              {loc('1. Flujo Secuencial de Optimización (De Objetivo a Ejecución)', '1. Sequential Optimization Workflow (Goal to Execution)')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-card/80 border border-emerald-500/40 space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">0. Objetivo Primario</span>
                <p className="text-[10px] text-muted-foreground">
                  {loc('Bandeja inicial donde se selecciona Máxima Altitud (Mayor Impulso Total It = ∫ F dt) antes de configurar cotas.', 'Initial tray to select Maximum Altitude (Peak Total Impulse It = ∫ F dt) prior to configuring dimensions.')}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">1. Fase 1: Hardware</span>
                <p className="text-[10px] text-muted-foreground">
                  {loc('Cotado de cámara (Dc, Lc), límite de sobrepresión Pmax_lim, tobera fija (Dt, Ds, α) y avisos de expansión en vivo.', 'Fixed casing (Dc, Lc), MEOP pressure threshold, nozzle geometry (Dt, Ds, α), and real-time expansion alerts.')}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">2. Fase 2: Granos</span>
                <p className="text-[10px] text-muted-foreground">
                  {loc('9 geometrías (BATES, Estrella, Macizo, Finocyl, Moonburner, C-Slot, D-Grain, Rod & Tube, Wagon Wheel), N granos, modos Libre/Fijo/Rango y caras activas.', '9 shapes (BATES, Star, Solid, Finocyl, Moonburner, C-Slot, D-Grain, Rod & Tube, Wagon Wheel), N grains, Free/Fixed/Range bounds & burn faces.')}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-card/80 border border-border space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">3. Fase 3: Algoritmos</span>
                <p className="text-[10px] text-muted-foreground">
                  {loc('Elección del presupuesto DE, botón de Cancelar Simulación en vivo y monitoreo del HUD de evolución.', 'DE budget preset selection, live Cancel Simulation button, and real-time convergence HUD monitoring.')}
                </p>
              </div>
            </div>
          </div>

          {/* Section A: The 3 Search Algorithms & Modus Operandi */}
          <div className="space-y-2">
            <span className="font-bold font-mono uppercase text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Cpu size={15} />
              {loc('2. Los 3 Modos de Algoritmo de Búsqueda Evolutiva y su Modus Operandi', '2. The 3 Evolutionary Search Algorithm Modes & Modus Operandi')}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Algorithm 1: Fast */}
              <div className="p-3 rounded-xl border border-border bg-card/70 space-y-1.5">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    {loc('Búsqueda Rápida', 'Fast Search')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                    500 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {loc('Modus Operandi: Población compacta NP = 15 con G = 33 generaciones de DE/rand/1/bin inicializadas mediante muestreo hipercubo latino (LHS). Emplea mutación adaptativa rápida con cruce binomial CR = 0.85.', 'Modus Operandi: Compact population NP = 15 with G = 33 generations of DE/rand/1/bin seeded by Latin Hypercube Sampling (LHS). Uses fast adaptive mutation and binomial crossover CR = 0.85.')}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {loc('🎯 ~1 - 2s por N | Barrido veloz de viabilidad inicial.', '🎯 ~1 - 2s per N | Fast initial feasibility sweep.')}
                </div>
              </div>

              {/* Algorithm 2: Standard */}
              <div className="p-3 rounded-xl border border-emerald-500/50 bg-card/90 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Sparkles size={14} />
                    {loc('Búsqueda Estándar (Recomendado)', 'Standard Search (Recommended)')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    1.000 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {loc('Modus Operandi: Población balanceada NP = 25 con G = 40 generaciones. Incorpora dither estocástico del factor de escala F ∈ [0.5, 0.9] por generación y vector, garantizando diversidad y evitando estancamientos en óptimos locales.', 'Modus Operandi: Balanced population NP = 25 with G = 40 generations. Incorporates stochastic dithering of scale factor F ∈ [0.5, 0.9] per generation, preventing premature local minima convergence.')}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {loc('🎯 ~2 - 4s por N | Diseño balístico definitivo de alta fidelidad.', '🎯 ~2 - 4s per N | Production high-fidelity motor design.')}
                </div>
              </div>

              {/* Algorithm 3: Deep */}
              <div className="p-3 rounded-xl border border-secondary/40 bg-card/70 space-y-1.5">
                <div className="flex items-center justify-between font-mono font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Rocket size={14} className="text-secondary" />
                    {loc('Búsqueda Profunda', 'Deep Search')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-bold tabular-nums">
                    2.000 evals / N
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {loc('Modus Operandi: Población expandida NP = 40 con G = 50 generaciones. Explora exhaustivamente hipervolúmenes restringidos donde el límite de sobrepresión Pmax está muy próximo a la frontera crítica de rotura.', 'Modus Operandi: Expanded population NP = 40 with G = 50 generations. Exhaustively explores constrained hyperspaces where Pmax limit operates near critical burst boundaries.')}
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-border/40">
                  {loc('🔬 ~5 - 8s por N | Geometrías estrella e hiperespacios complejos.', '🔬 ~5 - 8s per N | Star geometries & complex hyperspaces.')}
                </div>
              </div>

            </div>
          </div>

          {/* Section B: Cancel Simulation & Preserving Partial Results */}
          <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 space-y-1 text-[11px]">
            <span className="font-bold text-red-600 dark:text-red-400 font-mono uppercase flex items-center gap-1.5">
              <XCircle size={15} />
              {loc('3. Cancelación de Simulación en Vivo y Retorno de Resultados Parciales', '3. Live Simulation Cancellation & Partial Results Preservation')}
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {loc('Durante la ejecución del optimizador (en búsquedas profundas o presupuestos elevados), aparece un botón rojo de CANCELAR SIMULACIÓN visible en el HUD de progreso y en la barra de lanzamiento. Al pulsarlo, el algoritmo detiene inmediatamente el bucle evolutivo de forma segura y devuelve todos los mejores candidatos factibles evaluados hasta ese momento, permitiendo corregir parámetros sin perder el trabajo cómputo previo.', 'During search execution, a prominent red CANCEL SIMULATION button is available inside the HUD and action bar. Clicking it safely aborts the evolution loop and returns the best feasible candidates found up to that timestamp, allowing instant configuration adjustments without losing evaluated data.')}
            </p>
          </div>

          {/* Section C: Exact 0D Simulation & Deb Feasibility Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-500/20">
            <div className="space-y-1.5">
              <span className="font-bold text-foreground font-mono uppercase text-[11px] block">
                {loc('4. Motor de Simulación Numérico 0D Intacto', '4. Untouched Exact Numerical 0D Solver')}
              </span>
              <p>
                {loc('El optimizador NO modifica ni aproxima las leyes físicas. Resuelve para cada vector [D0, d0, L0] la integración balística 0D completa con la ley de Vieille (r = a·Pⁿ), continuidad másica en cámara con tobera de Laval y regresión geométrica 3D de todas las caras de grano activas. El impulso total It = ∫ F dt devuelto es el valor físico exacto sin puntuaciones artificiales ni penalizaciones ficticias.', 'The optimizer does NOT alter or approximate physical laws. It solves complete 0D transient ballistics with Vieille burn law (r = a·Pⁿ), chamber mass continuity with Laval nozzle, and 3D regression of active faces for each vector [D0, d0, L0]. The returned total impulse It = ∫ F dt is exact.')}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-foreground font-mono uppercase text-[11px] block">
                {loc('5. Reglas de Factibilidad de Deb (1998) y Selección Rígida', '5. Deb Feasibility Rules (1998) & Strict Selection')}
              </span>
              <p>
                {loc('Los métodos continuos basados en gradiente fracasan en balística debido a las discontinuidades del quemado y censurado por sobrepresión. La Selección de Deb garantiza que: 1) Cualquier solución factible (Pmax ≤ Plim) vence a una inviable; 2) Entre factibles gana estrictamente el mayor impulso total puro (Max It); 3) Entre inviables gana la de menor sobrepresión sin penalizaciones arbitrarias.', 'Gradient methods fail in ballistics due to burning sliver discontinuities and pressure censoring. Deb Selection guarantees: 1) Any feasible candidate dominates infeasible ones; 2) Among feasible candidates, strictly highest total impulse (Max It) wins; 3) Among infeasible candidates, lowest pressure violation wins without arbitrary weights.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMFORTABLE FULL-WIDTH CONFIGURATION WORKSPACE ================= */}
      
      {/* STEP 0: BANDEJA DE OBJETIVOS DE MISIÓN */}
      {activeStep === 0 && (
        <Card data-tour="smart-search-goal-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="py-3.5 px-5 bg-card-header text-card-header-foreground border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2 font-mono">
                <Target size={16} />
                {loc('Bandeja de Objetivos de Misión', 'Mission Objectives Inbox', 'Boîte des Objectifs de Mission', 'Casella degli Obiettivi di Missione')}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loc(
                  'Selecciona el objetivo propulsivo para iniciar la configuración de motor, restricciones de grano y algoritmos de optimización',
                  'Select your propulsion mission goal to enter the hardware, grain constraints, and algorithm configuration flow',
                  'Sélectionnez votre objectif propulsif pour commencer la configuration du moteur, des grains et des algorithmes',
                  'Seleziona l\'obiettivo propulsivo per avviare la configurazione del motore, dei vincoli dei grani e degli algoritmi'
                )}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-lg border border-border">
              <span>{loc('Flujo:', 'Workflow:', 'Flux :', 'Flusso:')} <strong className="text-foreground">{loc('Objetivo → Fase 1 → Fase 2 → Fase 3', 'Goal → Phase 1 → Phase 2 → Phase 3', 'Objectif → Phase 1 → Phase 2 → Phase 3', 'Obiettivo → Fase 1 → Fase 2 → Fase 3')}</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase font-mono tracking-wider text-muted-foreground">
                {loc('Objetivo Primario de Optimización', 'Primary Optimization Objective', 'Objectif Principal d\'Optimisation', 'Obiettivo Primario di Ottimizzazione')}
              </span>
              
              {/* Objective Drawer / Tray: Max Altitude / Max Total Impulse */}
              <div 
                onClick={() => {
                  setGoal('max_impulse');
                  setActiveStep(1);
                }}
                className="group relative p-5 rounded-xl border border-primary/40 bg-primary/5 hover:border-primary hover:shadow-md transition-all cursor-pointer space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                      <Rocket size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                          {loc('Bandeja Principal de Misión', 'Main Mission Tray', 'Bac Principal de Mission', 'Cassetto Principale di Missione')}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-primary">
                          · {loc('Activo', 'Active', 'Actif', 'Attivo')}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mt-0.5 font-mono flex items-center gap-2">
                        {loc('Máxima Altitud / Mayor Impulso Total (It)', 'Maximum Altitude / Peak Total Impulse (It)', 'Altitude Maximale / Impulsion Totale Maximale (It)', 'Massima Altitudine / Massimo Impulso Totale (It)')}
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
                    <span>{loc('Configurar Motor y Tobera (Fase 1)', 'Configure Motor & Nozzle (Phase 1)', 'Configurer Moteur et Tuyère (Phase 1)', 'Configura Motore e Ugello (Fase 1)')}</span>
                    <ArrowRight size={16} />
                  </Button>
                </div>

                {/* Mathematical Formulation & Objective Rules */}
                <div className="p-3.5 rounded-xl bg-card/80 border border-border/80 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-foreground">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      {loc('Criterio de Selección Estricto:', 'Strict Selection Criterion:', 'Critère de Sélection Strict :', 'Criterio di Selezione Severo:')}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-muted text-foreground font-bold border border-border text-[11px]">
                      {loc('Mejor Solución = max I_total  [sujeto a P_max ≤ P_límite]', 'Best Solution = max I_total  [subject to P_max ≤ P_limit]', 'Meilleure Solution = max I_total  [sujet à P_max ≤ P_limite]', 'Migliore Soluzione = max I_total  [soggetto a P_max ≤ P_limite]')}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                    {loc(
                      'Maximiza estrictamente la energía propulsiva total acumulada obtenida de la integración temporal completa del empuje (I_total = ∫ F dt) devuelta por el simulador físico. No premia artificialmente geometrías por planitud ni ocupación de cámara si entregan menor impulso total. La selección global de granos (N) y cotas geométricas se rige por factibilidad de Deb.',
                      'Strictly maximizes total propulsive energy from complete physical thrust time integration (I_total = ∫ F dt) returned by the simulator. Does not artificially favor flat thrust or packing volume if total impulse is lower. Global grain count (N) and dimensions are governed by Deb feasibility selection.',
                      'Maximise strictement l\'énergie propulsive totale issue de l\'intégration temporelle de la poussée (I_total = ∫ F dt) calculée par le simulateur. Ne favorise pas artificiellement la planéité si l\'impulsion totale est moindre. Le nombre de grains (N) et les cotes obéissent aux règles de Deb.',
                      'Massimizza rigorosamente l\'energia propulsiva totale derivante dall\'integrazione temporale della spinta (I_total = ∫ F dt) restituita dal simulatore. Non favorisce artificialmente la piattezza se l\'impulso totale è inferiore. Il numero di grani (N) e le dimensioni seguono le regole di Deb.'
                    )}
                  </p>
                </div>

                {/* Feature Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{loc('Cálculo Físico', 'Physics Calculation', 'Calcul Physique', 'Calcolo Fisico')}</span>
                    <span className="font-bold text-foreground">{loc('Impulso Total Puro (N·s)', 'Pure Total Impulse (N·s)', 'Impulsion Totale Pure (N·s)', 'Impulso Totale Puro (N·s)')}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{loc('Manejo de Restricciones', 'Constraint Handling', 'Gestion des Contraintes', 'Gestione dei Vincoli')}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{loc('Reglas de Deb (Sin penalizaciones)', 'Deb Rules (No arbitrary penalties)', 'Règles de Deb (Sans pénalités)', 'Regole di Deb (Senza penalità)')}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">{loc('Comparativa de Granos', 'Grain Exploration', 'Exploration des Grains', 'Esplorazione dei Grani')}</span>
                    <span className="font-bold text-foreground">{loc('Automática N = 1 .. N_max', 'Automatic N = 1 .. N_max', 'Automatique N = 1 .. N_max', 'Automatica N = 1 .. N_max')}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FASE 1: HARDWARE DEFINIDO (CÁMARA Y TOBERA) */}
      {activeStep === 1 && (
        <Card data-tour="smart-search-phase1-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-card-header text-card-header-foreground border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                <Sliders size={16} />
                {loc('Fase 1: Hardware Definido (Cámara y Tobera)', 'Phase 1: Defined Hardware (Chamber & Nozzle)', 'Phase 1 : Matériel Défini (Chambre & Tuyère)', 'Fase 1: Hardware Definito (Camera & Ugello)')}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loc('Introduce las cotas de la cámara y tobera existente que vamos a equipar', 'Enter existing motor casing and nozzle dimensions', 'Entrez les dimensions de la chambre et de la tuyère existantes', 'Inserisci le dimensioni della camera e dell\'ugello esistenti')}
              </p>
            </div>
            
            {/* Live Quick Hardware Indicators */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground bg-muted/40 px-3 py-1 rounded-lg border border-border tabular-nums">
              <span>Vol: <strong className="text-foreground">{chamberVolumeCm3.toFixed(1)} cm³</strong></span>
              <span>•</span>
              <span>{loc('Esbeltez (Lc/Dc):', 'Slenderness (Lc/Dc):', 'Élancement (Lc/Dc) :', 'Snellezza (Lc/Dc):')} <strong className="text-foreground">{slendernessRatio.toFixed(1)}</strong></span>
              <span>•</span>
              <span>{loc('Expansión (ε = Ae/At):', 'Expansion (ε = Ae/At):', 'Expansion (ε = Ae/At) :', 'Espansione (ε = Ae/At):')} <strong className="text-foreground">{expRatio.toFixed(2)}</strong></span>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            
            {/* Grid 1: Chamber Geometry & Pressure Limit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Dc */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Layers size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {loc('Diámetro Interior Cámara (Dc)', 'Chamber Inner Diameter (Dc)')}
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
                    {loc('⚠️ Recomendación: define un diámetro válido (> 0 mm)', '⚠️ Recommendation: define a valid diameter (> 0 mm)')}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {loc('Diámetro interno disponible para el grano + liner', 'Usable inner diameter for propellant & liner')}
                  </p>
                )}
              </div>

              {/* Lc */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Layers size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {loc('Longitud Útil Cámara (Lc)', 'Chamber Usable Length (Lc)')}
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
                    {loc('⚠️ Recomendación: define una longitud válida (> 0 mm)', '⚠️ Recommendation: define a valid length (> 0 mm)')}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {loc('Longitud entre cierres/tobera disponible para granos', 'Usable length inside casing')}
                  </p>
                )}
              </div>

              {/* Pmax Limit (Manual input with warning if left empty) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <UiLabel className="text-xs font-bold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {loc('Presión Máxima Segura (Pmax)', 'Max Safe Pressure Limit (Pmax)')}
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
                    {loc('⚠️ Recomendación: define un límite de presión (ej: 6.0 MPa) para una simulación realista', '⚠️ Recommendation: define a pressure limit (e.g. 6.0 MPa) for realistic simulation')}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {loc('Límite estructural admisible para descartar sobrepresiones', 'Maximum allowable MEOP / proof pressure threshold')}
                    {liveMotorStruct.maxAdmissiblePressureMPa > 0 && (
                      <button
                        type="button"
                        onClick={() => handleInputChange('Pmax_lim', liveMotorStruct.maxAdmissiblePressureMPa.toFixed(2))}
                        className="ml-1.5 inline-flex items-center text-[10px] font-mono font-bold text-primary hover:underline cursor-pointer"
                        title={loc('Aplicar Padm calculada según tubo y tornillos', 'Apply calculated Padm from casing & bolts')}
                      >
                        (Padm: {liveMotorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa)
                      </button>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Optional Thermal Liner & Grain Outer Inhibitor (matches Inputs Tab) */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <Shield size={14} className="text-amber-600 dark:text-amber-400" />
                  {loc('Protección Térmica Opcional (Liner e Inhibidor)', 'Optional Thermal Protection (Liner & Inhibitor)')}
                </h4>
                <div className={`text-[11px] font-mono tabular-nums px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                  isClearanceCollapsed
                    ? 'bg-red-500/15 border-red-500/50 text-red-700 dark:text-red-300 font-bold'
                    : radialDeductionDiamMm > 0
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200 font-semibold'
                      : 'bg-background/80 border-border text-muted-foreground'
                }`}>
                  <span>{loc('Diámetro máx. grano (D0 máx):', 'Max allowed grain (D0 max):')}</span>
                  <strong className={isClearanceCollapsed ? 'text-red-600 dark:text-red-400' : 'text-foreground'}>
                    {availableD0.toFixed(1)} mm
                  </strong>
                  {radialDeductionDiamMm > 0 && (
                    <span className="text-[10px] opacity-80">
                      (Dc {DcVal.toFixed(1)} − {radialDeductionDiamMm.toFixed(1)} mm)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Optional Liner */}
                <div className={`p-3 rounded-lg border transition-colors flex flex-col gap-2 ${
                  hasLiner
                    ? 'bg-amber-500/12 border-amber-500/60'
                    : 'bg-card/60 border-border hover:border-amber-500/45'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <UiLabel
                      htmlFor="smart-has-liner-chk"
                      className={`text-xs font-semibold uppercase tracking-tight cursor-pointer flex items-center gap-2 flex-1 min-w-0 ${
                        hasLiner ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/85'
                      }`}
                    >
                      <Checkbox
                        id="smart-has-liner-chk"
                        checked={hasLiner}
                        onCheckedChange={(c) => setHasLiner(Boolean(c))}
                        className="w-4 h-4 rounded-sm border border-amber-600/70 bg-background data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 data-[state=checked]:text-white shrink-0"
                      />
                      <span>{loc('Añadir Liner Interno', 'Add Internal Liner')}</span>
                    </UiLabel>
                    <span className={`text-[10px] font-mono font-bold shrink-0 ${
                      hasLiner ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                    }`}>
                      {hasLiner ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {loc('Aislante térmico interno entre cámara Dc y grano/inhibidor (resta 2×espesor al diámetro útil).', 'Internal thermal liner inside casing Dc (reduces available diameter by 2×thickness).')}
                  </p>
                  {hasLiner && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-500/25">
                      <span className="text-[11px] font-mono text-foreground font-semibold">
                        {loc('Espesor Liner (radial):', 'Liner Thickness (radial):')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={inputValues.linerThickness}
                          onChange={(e) => handleInputChange('linerThickness', e.target.value)}
                          className="w-20 h-7 text-xs font-mono font-bold tabular-nums bg-background"
                        />
                        <span className="text-[11px] font-mono text-muted-foreground">mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Inhibitor */}
                <div className={`p-3 rounded-lg border transition-colors flex flex-col gap-2 ${
                  hasInhibitor
                    ? 'bg-emerald-500/12 border-emerald-500/60'
                    : 'bg-card/60 border-border hover:border-emerald-500/45'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <UiLabel
                      htmlFor="smart-has-inhibitor-chk"
                      className={`text-xs font-semibold uppercase tracking-tight cursor-pointer flex items-center gap-2 flex-1 min-w-0 ${
                        hasInhibitor ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground/85'
                      }`}
                    >
                      <Checkbox
                        id="smart-has-inhibitor-chk"
                        checked={hasInhibitor}
                        onCheckedChange={(c) => setHasInhibitor(Boolean(c))}
                        className="w-4 h-4 rounded-sm border border-emerald-600/70 bg-background data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 data-[state=checked]:text-white shrink-0"
                      />
                      <span>{loc('Añadir Inhibidor / Funda', 'Add Outer Inhibitor Sleeve')}</span>
                    </UiLabel>
                    <span className={`text-[10px] font-mono font-bold shrink-0 ${
                      hasInhibitor ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                    }`}>
                      {hasInhibitor ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {loc('Camisa exterior sobre el grano para proteger pared e inhibir cara externa (resta 2×espesor al diámetro útil).', 'Outer sleeve around propellant grain (reduces available diameter by 2×thickness).')}
                  </p>
                  {hasInhibitor && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-500/25">
                      <span className="text-[11px] font-mono text-foreground font-semibold">
                        {loc('Espesor Inhibidor (radial):', 'Inhibitor Thickness (radial):')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={inputValues.inhibitorThickness}
                          onChange={(e) => handleInputChange('inhibitorThickness', e.target.value)}
                          className="w-20 h-7 text-xs font-mono font-bold tabular-nums bg-background"
                        />
                        <span className="text-[11px] font-mono text-muted-foreground">mm</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isClearanceCollapsed && (
                <div className="p-2.5 rounded-lg border border-red-500/50 bg-red-500/12 text-red-700 dark:text-red-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  <span>
                    {loc(
                      `Espacio radial nulo o negativo (${availableD0.toFixed(1)} mm): la suma 2×liner + 2×inhibidor (${radialDeductionDiamMm.toFixed(1)} mm) iguala o supera Dc (${DcVal.toFixed(1)} mm).`,
                      `Zero/negative radial clearance (${availableD0.toFixed(1)} mm): 2×liner + 2×inhibitor (${radialDeductionDiamMm.toFixed(1)} mm) equals or exceeds Dc (${DcVal.toFixed(1)} mm).`
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Grid 2: Nozzle & Propellant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              
              {/* Nozzle Geometry */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <Zap size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {loc('Tobera Fija Existente', 'Fixed Nozzle Geometry')}
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <UiLabel className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                      <span>{loc('Garganta (Dt) [mm]', 'Throat (Dt) [mm]')}</span>
                      {(isDt0GeDs || isDt0GeDc) && <AlertTriangle size={12} className="text-red-500" />}
                    </UiLabel>
                    <Input
                      type="number"
                      step="0.5"
                      value={inputValues.Dt0}
                      onChange={(e) => handleInputChange('Dt0', e.target.value)}
                      onBlur={() => handleBlur('Dt0')}
                      placeholder="8.0"
                      className={`h-8 text-xs font-mono font-bold tabular-nums ${isDt0EmptyOrInvalid || isDt0GeDs || isDt0GeDc ? 'border-red-500 bg-red-500/10' : ''}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <UiLabel className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                      <span>{loc('Salida (Ds) [mm]', 'Exit (Ds) [mm]')}</span>
                      {isDt0GeDs && <AlertTriangle size={12} className="text-red-500" />}
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
                      {loc('Ángulo (α) [°]', 'Angle (α) [°]')}
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
                    {loc(`⚠️ Dt (${Dt0Val} mm) ≥ Ds (${DsVal} mm). En toberas de Laval la garganta debe ser menor que la salida (ε > 1).`, `⚠️ Dt (${Dt0Val} mm) ≥ Ds (${DsVal} mm). In de Laval nozzles throat must be smaller than exit (ε > 1).`)}
                  </p>
                )}
                {isDt0GeDc && (
                  <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" />
                    {loc(`⚠️ Dt (${Dt0Val} mm) ≥ Dc cámara (${DcVal} mm). La garganta no puede igualar o superar la cámara.`, `⚠️ Dt (${Dt0Val} mm) ≥ chamber Dc (${DcVal} mm). Throat cannot equal or exceed chamber diameter.`)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground font-mono">
                  {loc(`Área de garganta At = ${AtVal.toFixed(1)} mm² | Relación de expansión ε = ${expRatio.toFixed(2)}`, `Throat area At = ${AtVal.toFixed(1)} mm² | Expansion ratio ε = ${expRatio.toFixed(2)}`)}
                </p>
              </div>

              {/* Propellant Selection */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <Flame size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {loc('Propelente a Utilizar', 'Selected Propellant')}
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
                          {p.name} {p.isCustom ? (loc('(Personalizado)', '(Custom)')) : ''}
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
                {loc('Rendimientos y Entorno Operativo', 'Efficiencies & Operating Environment')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* etac */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold flex items-center justify-between">
                    <span>{loc('Rendimiento Cámara (ηc*)', 'Chamber Efficiency (ηc*)')}</span>
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
                    {loc('Eficiencia de combustión (típico: 0.85 - 0.95)', 'Combustion C* efficiency')}
                  </p>
                </div>

                {/* etanoz */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold flex items-center justify-between">
                    <span>{loc('Rendimiento Tobera (ηnoz)', 'Nozzle Efficiency (ηnoz)')}</span>
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
                    {loc('Eficiencia de tobera / expansión (típico: 0.70 - 0.90)', 'Nozzle thrust efficiency')}
                  </p>
                </div>

                {/* Pamb */}
                <div className="space-y-1">
                  <UiLabel className="text-[10px] text-muted-foreground font-mono font-bold">
                    {loc('Presión Ambiente (Pamb) [MPa]', 'Ambient Pressure (Pamb) [MPa]')}
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
                    {loc('Nivel del mar: 0.101325 MPa (1 atm)', 'Sea level pressure: 0.101325 MPa')}
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
                {loc('Volver a Bandeja de Objetivos', 'Back to Goal Inbox')}
              </Button>
              <Button
                onClick={() => setActiveStep(2)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {loc('Continuar a Fase 2: Granos', 'Continue to Phase 2: Grains')}
                <ArrowRight size={16} />
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* FASE 2: GEOMETRÍA Y RESTRICCIONES DE GRANO */}
      {activeStep === 2 && (
        <Card data-tour="smart-search-phase2-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-card-header text-card-header-foreground border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                <Sliders size={16} />
                {loc('Fase 2: Geometría y Restricción de Granos', 'Phase 2: Grain Geometry & Constraints')}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loc('Elige la forma del grano, caras activas de combustión y bloquea o libera dimensiones', 'Select grain shape, active burn surfaces, and lock/unlock dimensions')}
              </p>
            </div>
            <div className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border tabular-nums flex items-center gap-2 ${
              isClearanceCollapsed
                ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}>
              <span>
                {loc('Cámara:', 'Chamber:')} <strong className="text-foreground">Dc={DcVal}mm, Lc={LcVal}mm</strong>
              </span>
              <span>•</span>
              <span>
                {loc('D0 máx útil:', 'Max D0 clearance:')} <strong className={isClearanceCollapsed ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{availableD0.toFixed(1)}mm</strong>
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {isClearanceCollapsed && (
              <div className="p-3 rounded-xl border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 flex items-center gap-2.5 text-xs font-mono">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <span>
                  {loc(
                    `Aviso crítico: Dc (${DcVal} mm) menos liner/inhibidor (${radialDeductionDiamMm.toFixed(1)} mm) deja ${availableD0.toFixed(1)} mm disponibles. Ajusta la Fase 1 antes de definir granos.`,
                    `Critical warning: Dc (${DcVal} mm) minus liner/inhibitor (${radialDeductionDiamMm.toFixed(1)} mm) leaves ${availableD0.toFixed(1)} mm clearance. Adjust Phase 1 first.`
                  )}
                </span>
              </div>
            )}
            
            {/* 1. Grain Shape & Segment Count Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Shape Selector (All 9 Geometries) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <UiLabel className="text-xs font-bold text-foreground block font-mono uppercase tracking-wider">
                    {loc('Geometría Base del Grano', 'Base Grain Geometry')}
                  </UiLabel>
                  {isComplexGrain(shape) && (
                    <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                      Clipper2 2D
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {getAllGrainModules().map((mod) => {
                    const isActive = shape === mod.shape;
                    const label = getGrainShapeLabel(mod.shape, t);
                    const desc = getGrainShapeDesc(mod.shape, t);
                    return (
                      <button
                        key={mod.shape}
                        type="button"
                        title={desc}
                        onClick={() => handleShapeSelect(mod.shape)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs ring-1 ring-emerald-500/30'
                            : 'border-border bg-background/70 hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <GrainShapeIcon shape={mod.shape} grainId={`ss-${mod.shape}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] leading-tight truncate">{label}</div>
                          <div className="text-[9px] font-mono opacity-75 truncate">
                            {mod.solverMode === 'clipper' ? 'Clipper2' : loc('Analítico', 'Analytical')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-snug pt-0.5">
                  {getGrainShapeDesc(shape, t)}
                </p>
              </div>

              {/* Segment Count (N) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                <UiLabel className="text-xs font-bold text-foreground block font-mono uppercase tracking-wider">
                  {loc('Número de Segmentos (Granos)', 'Number of Grain Segments')}
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
                      {loc('Rango (1 a N)', 'Range (1 to N)')}
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
                      {loc('Cantidad Fija', 'Fixed Count')}
                    </span>
                  </label>
                </div>

                {grainCountMode === 'range' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">{loc('Explorar desde 1 hasta máximo:', 'Explore from 1 up to:')}</span>
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
                    <span className="text-xs text-muted-foreground">{loc('granos', 'grains')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">{loc('Cantidad exacta de granos:', 'Exact grain count:')}</span>
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
                    <span className="text-xs text-muted-foreground">{loc('granos', 'grains')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Physical Variable Constraints (Free, Fixed, Range) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                  {loc('Restricciones y Dimensiones de Grano', 'Grain Dimension Constraints')}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                  <span>{loc('Elige si fijar un valor, definir un rango o dejar libre al optimizador', 'Choose fixed value, range, or free optimization')}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Variable 1: Diámetro Exterior (D0) */}
                <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {loc('Diámetro Exterior (D0)', 'Outer Diameter (D0)')}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {radialDeductionDiamMm > 0
                          ? loc(`Máx útil = ${availableD0.toFixed(1)} mm (Dc ${DcVal} − aislamiento)`, `Max D0 = ${availableD0.toFixed(1)} mm (Dc ${DcVal} − insulation)`)
                          : loc(`Cámara Dc = ${DcVal} mm (Máx = ${availableD0.toFixed(1)} mm)`, `Chamber Dc = ${DcVal} mm (Max = ${availableD0.toFixed(1)} mm)`)}
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
                      {loc('Libre', 'Free')}
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
                      {loc('Fijo', 'Fixed')}
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
                      {loc('Rango', 'Range')}
                    </button>
                  </div>

                  {/* Controls based on mode */}
                  {modeD0 === 'free' && (
                    <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center tabular-nums">
                      {radialDeductionDiamMm > 0
                        ? loc(`Auto: Holgura respetando liner/inhibidor (≤ ${availableD0.toFixed(1)} mm)`, `Auto: Respects liner/inhibitor (≤ ${availableD0.toFixed(1)} mm)`)
                        : loc(`Auto: Ajuste óptimo en cámara (≤ ${(availableD0 - 0.5).toFixed(1)} mm)`, `Auto: Optimal casing clearance (≤ ${(availableD0 - 0.5).toFixed(1)} mm)`)}
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
                          placeholder={Math.max(10, availableD0 - 0.5).toFixed(1)}
                          className={`h-8 text-xs font-mono font-bold flex-1 tabular-nums ${isD0EmptyOrInvalid || isD0ExceedsClearance ? 'border-red-500 bg-red-500/10' : ''}`}
                        />
                        <span className="text-xs font-mono text-muted-foreground">mm</span>
                        {isD0ExceedsClearance && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                      </div>
                      {isD0EmptyOrInvalid && (
                        <p className="text-[10px] text-red-500 font-medium">{loc('⚠️ Introduce D0', '⚠️ Enter D0')}</p>
                      )}
                      {isD0ExceedsClearance && (
                        <p className="text-[10px] text-red-500 font-medium flex items-start gap-1">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>
                            {radialDeductionDiamMm > 0
                              ? loc(`D0 (${valD0Num} mm) supera el máximo permitido (${availableD0.toFixed(1)} mm) tras descontar liner/inhibidor (−${radialDeductionDiamMm.toFixed(1)} mm sobre Dc=${DcVal} mm).`, `D0 (${valD0Num} mm) exceeds max allowed (${availableD0.toFixed(1)} mm) after liner/inhibitor (−${radialDeductionDiamMm.toFixed(1)} mm from Dc=${DcVal} mm).`)
                              : loc(`D0 (${valD0Num} mm) supera el diámetro útil de cámara (${availableD0.toFixed(1)} mm).`, `D0 (${valD0Num} mm) exceeds chamber clearance (${availableD0.toFixed(1)} mm).`)}
                          </span>
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
                            placeholder={Math.max(10, availableD0 - 3.0).toFixed(1)}
                            className={`h-8 text-xs font-mono font-bold tabular-nums ${isD0RangeInverted || isMinD0ExceedsClearance ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-mono">Máx (mm)</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={inputValues.maxD0}
                            onChange={(e) => handleInputChange('maxD0', e.target.value)}
                            placeholder={availableD0.toFixed(1)}
                            className={`h-8 text-xs font-mono font-bold tabular-nums ${isD0RangeInverted || isMaxD0ExceedsClearance ? 'border-red-500 bg-red-500/10' : ''}`}
                          />
                        </div>
                      </div>
                      {(isMaxD0ExceedsClearance || isMinD0ExceedsClearance) && (
                        <p className="text-[10px] text-red-500 font-medium flex items-start gap-1">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>
                            {radialDeductionDiamMm > 0
                              ? loc(`El rango de D0 (hasta ${Math.max(minD0Num, maxD0Num)} mm) supera el máximo permitido (${availableD0.toFixed(1)} mm) con liner/inhibidor activo.`, `D0 range (up to ${Math.max(minD0Num, maxD0Num)} mm) exceeds max allowed (${availableD0.toFixed(1)} mm) with active liner/inhibitor.`)
                              : loc(`Máx D0 (${maxD0Num} mm) supera el diámetro útil (${availableD0.toFixed(1)} mm).`, `Max D0 (${maxD0Num} mm) exceeds clearance (${availableD0.toFixed(1)} mm).`)}
                          </span>
                        </p>
                      )}
                      {isD0RangeInverted && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {loc(`⚠️ Mín D0 (${minD0Num} mm) ≥ Máx D0 (${maxD0Num} mm). Rango invertido.`, `⚠️ Min D0 (${minD0Num} mm) ≥ Max D0 (${maxD0Num} mm). Inverted range.`)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Variable 2: Diámetro Núcleo (d0) */}
                {hasCorePort ? (
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {shape === 2
                            ? loc('Diámetro Puntas Internas (d0)', 'Inner Star Tip Diameter (d0)')
                            : shape === 8
                              ? loc('Diámetro Interior Tubo (d0)', 'Outer Tube Inner Dia. (d0)')
                              : loc('Diámetro Núcleo / Canal (d0)', 'Core / Port Diameter (d0)')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {shape === 2
                            ? loc('Diámetro interior entre puntas de la estrella', 'Inner diameter across star tips')
                            : shape === 8
                              ? loc('Pared interna del tubo exterior (d0 > varilla)', 'Inner bore of outer tube (d0 > rod)')
                              : shape === 5
                                ? loc('Canal circular excéntrico del grano', 'Eccentric circular bore diameter')
                                : loc('Canal central de gas', 'Central combustion port')}
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
                        {loc('Libre', 'Free')}
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
                        {loc('Fijo', 'Fixed')}
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
                        {loc('Rango', 'Range')}
                      </button>
                    </div>

                    {/* Controls based on mode */}
                    {moded0 === 'free' && (
                      <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                        {loc('Auto: Búsqueda del ratio Kn y empuje óptimo', 'Auto: Sweep optimal Kn and thrust')}
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
                          {isd0GeD0 && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                        </div>
                        {isd0EmptyOrInvalid && (
                          <p className="text-[10px] text-red-500 font-medium">{loc('⚠️ Introduce d0', '⚠️ Enter d0')}</p>
                        )}
                        {isd0GeD0 && (
                          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {loc(`⚠️ d0 (${vald0Num} mm) ≥ D0 (${effectiveOuterD} mm). Espesor de quemado (web) nulo.`, `⚠️ d0 (${vald0Num} mm) ≥ D0 (${effectiveOuterD} mm). Zero web thickness.`)}
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
                            {loc(`⚠️ Mín d0 (${mind0Num} mm) ≥ Máx d0 (${maxd0Num} mm). Rango invertido.`, `⚠️ Min d0 (${mind0Num} mm) ≥ Max d0 (${maxd0Num} mm). Inverted range.`)}
                          </p>
                        )}
                        {isMind0GeD0 && (
                          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {loc(`⚠️ Mín d0 (${mind0Num} mm) ≥ D0 (${effectiveOuterD} mm).`, `⚠️ Min d0 (${mind0Num} mm) ≥ D0 (${effectiveOuterD} mm).`)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-border bg-muted/10 flex flex-col items-center justify-center text-xs text-muted-foreground font-mono text-center space-y-1">
                    <span>{getGrainShapeLabel(shape, t)}:</span>
                    <strong className="text-foreground">d0 = 0 mm</strong>
                    <span className="text-[10px] opacity-80">
                      {shape === 6
                        ? loc('Usa anchura y profundidad de ranura abajo', 'Configured via Slot Width & Depth below')
                        : shape === 7
                          ? loc('Usa profundidad de corte cordal abajo', 'Configured via Chord Cut Depth below')
                          : loc('Sin canal interior (combustión extrema/exterior)', 'No internal bore (end/outer burn)')}
                    </span>
                  </div>
                )}

                {/* Variable 3: Longitud de Grano (L0) */}
                <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {loc('Longitud de Grano (L0)', 'Grain Length (L0)')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {loc(`Cámara Lc = ${LcVal} mm`, `Chamber Lc = ${LcVal} mm`)}
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
                      {loc('Libre', 'Free')}
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
                      {loc('Fija', 'Fixed')}
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
                      {loc('Rango', 'Range')}
                    </button>
                  </div>

                  {/* Controls based on mode */}
                  {modeL0 === 'free' && (
                    <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                      {loc('Auto: Ajuste a longitud de cámara Lc', 'Auto: Fit to chamber length Lc')}
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
                        {isL0ExceedsLc && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                      </div>
                      {isL0EmptyOrInvalid && (
                        <p className="text-[10px] text-red-500 font-medium">{loc('⚠️ Introduce L0', '⚠️ Enter L0')}</p>
                      )}
                      {isL0ExceedsLc && (
                        <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} className="shrink-0" />
                          {loc(`⚠️ N×L0 (${fixedNNum} × ${valL0Num} = ${(fixedNNum * valL0Num).toFixed(1)} mm) supera Lc (${LcVal} mm).`, `⚠️ N×L0 (${fixedNNum} × ${valL0Num} = ${(fixedNNum * valL0Num).toFixed(1)} mm) exceeds Lc (${LcVal} mm).`)}
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
                          {loc(`⚠️ Mín L0 (${minL0Num} mm) ≥ Máx L0 (${maxL0Num} mm). Rango invertido.`, `⚠️ Min L0 (${minL0Num} mm) ≥ Max L0 (${maxL0Num} mm). Inverted range.`)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Dedicated Shape Parameters Panel for Complex Shapes (2, 4, 5, 6, 7, 8, 9) */}
              {shape === 2 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Star size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros Específicos de Grano en Estrella (Clipper2)', 'Star Grain Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('El optimizador añade Dp y Np a la evolución diferencial', 'Optimizer expands Differential Evolution across Dp & Np')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {loc('Diámetro Valles Estrella (d0mayor / Dp)', 'Star Valley Diameter (d0mayor / Dp)')}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          {minStarD0mayorDisplay > 0
                            ? loc(
                                `Mín. geom. estrella = ${minStarD0mayorDisplay.toFixed(1)} mm (d0/cos(π/Np)) · Máx < ${effectiveOuterD.toFixed(1)} mm`,
                                `Star geom. min = ${minStarD0mayorDisplay.toFixed(1)} mm (d0/cos(π/Np)) · Max < ${effectiveOuterD.toFixed(1)} mm`
                              )
                            : loc(`Debe cumplir Dp > d0/cos(π/Np) y Dp < D0 (≤ ${effectiveOuterD.toFixed(1)} mm)`, `Must satisfy Dp > d0/cos(π/Np) & Dp < D0 (≤ ${effectiveOuterD.toFixed(1)} mm)`)}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={() => setModed0mayor('free')}
                          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                            moded0mayor === 'free' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {loc('Libre', 'Free')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModed0mayor('fixed')}
                          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                            moded0mayor === 'fixed' ? 'bg-amber-500 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {loc('Fijo', 'Fixed')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModed0mayor('range')}
                          className={`py-1 rounded text-center font-bold transition-all cursor-pointer ${
                            moded0mayor === 'range' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {loc('Rango', 'Range')}
                        </button>
                      </div>

                      {moded0mayor === 'free' && (
                        <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2 rounded-lg text-center">
                          {loc('Auto: Valles siempre > mín. geom. d0/cos(π/Np) garantizando puntas de estrella', 'Auto: Valleys always > d0/cos(π/Np) ensuring genuine star arms')}
                        </div>
                      )}

                      {moded0mayor === 'fixed' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              step="0.5"
                              value={inputValues.vald0mayor}
                              onChange={(e) => handleInputChange('vald0mayor', e.target.value)}
                              onBlur={() => handleBlur('vald0mayor')}
                              placeholder="30.0"
                              className={`h-8 text-xs font-mono font-bold flex-1 tabular-nums ${
                                isd0mayorEmptyOrInvalid || isd0mayorLeqd0 || isStarDpBelowGeomMin || isd0mayorGeD0 ? 'border-red-500 bg-red-500/10' : ''
                              }`}
                            />
                            <span className="text-xs font-mono text-muted-foreground">mm</span>
                            {(isd0mayorLeqd0 || isStarDpBelowGeomMin || isd0mayorGeD0) && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                          </div>
                          {isd0mayorEmptyOrInvalid && (
                            <p className="text-[10px] text-red-500 font-medium">{loc('⚠️ Introduce d0mayor', '⚠️ Enter d0mayor')}</p>
                          )}
                          {isd0mayorLeqd0 && (
                            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {loc(`Dp (${vald0mayorNum} mm) debe ser mayor que puntas d0 (${vald0Num} mm).`, `Dp (${vald0mayorNum} mm) must exceed inner tips d0 (${vald0Num} mm).`)}
                            </p>
                          )}
                          {!isd0mayorLeqd0 && isStarDpBelowGeomMin && (
                            <p className="text-[10px] text-red-500 font-medium flex items-start gap-1">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>
                                {loc(
                                  `Dp (${vald0mayorNum} mm) ≤ mín. geom. (${minStarD0mayorStrict.toFixed(1)} mm): no forma puntas de estrella (colapsa en polígono convexo).`,
                                  `Dp (${vald0mayorNum} mm) ≤ geom. min (${minStarD0mayorStrict.toFixed(1)} mm): cannot form star arms (collapses into convex polygon).`
                                )}
                              </span>
                            </p>
                          )}
                          {isd0mayorGeD0 && (
                            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {loc(`Dp (${vald0mayorNum} mm) ≥ D0 útil (${effectiveOuterD.toFixed(1)} mm). Los valles perforan la pared exterior.`, `Dp (${vald0mayorNum} mm) ≥ outer D0 (${effectiveOuterD.toFixed(1)} mm). Valleys pierce outer wall.`)}
                            </p>
                          )}
                        </div>
                      )}

                      {moded0mayor === 'range' && (
                        <div className="space-y-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-muted-foreground font-mono">Mín (mm)</span>
                              <Input
                                type="number"
                                step="0.5"
                                value={inputValues.mind0mayor}
                                onChange={(e) => handleInputChange('mind0mayor', e.target.value)}
                                placeholder="18.0"
                                className={`h-8 text-xs font-mono font-bold tabular-nums ${
                                  isd0mayorRangeInverted || isMind0mayorGeD0 ? 'border-red-500 bg-red-500/10' : ''
                                }`}
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground font-mono">Máx (mm)</span>
                              <Input
                                type="number"
                                step="0.5"
                                value={inputValues.maxd0mayor}
                                onChange={(e) => handleInputChange('maxd0mayor', e.target.value)}
                                placeholder="40.0"
                                className={`h-8 text-xs font-mono font-bold tabular-nums ${
                                  isd0mayorRangeInverted || isMaxd0mayorGeD0 || isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0 || isStarMaxDpBelowGeomMin ? 'border-red-500 bg-red-500/10' : ''
                                }`}
                              />
                            </div>
                          </div>
                          {isd0mayorRangeInverted && (
                            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {loc(`Mín Dp (${mind0mayorNum} mm) ≥ Máx Dp (${maxd0mayorNum} mm). Rango invertido.`, `Min Dp (${mind0mayorNum} mm) ≥ Max Dp (${maxd0mayorNum} mm). Inverted range.`)}
                            </p>
                          )}
                          {(isMaxd0mayorGeD0 || isMind0mayorGeD0) && (
                            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {loc(`El rango de Dp supera el diámetro exterior D0 (${effectiveOuterD.toFixed(1)} mm).`, `Dp range exceeds outer diameter D0 (${effectiveOuterD.toFixed(1)} mm).`)}
                            </p>
                          )}
                          {(isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0) && (
                            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {loc('El máximo de Dp debe superar a d0.', 'Max Dp must be greater than d0.')}
                            </p>
                          )}
                          {!(isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0) && isStarMaxDpBelowGeomMin && (
                            <p className="text-[10px] text-red-500 font-medium flex items-start gap-1">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>
                                {loc(
                                  `Máx Dp (${maxd0mayorNum} mm) ≤ mín. geom. (${minStarD0mayorStrict.toFixed(1)} mm): ninguna estrella en este rango tiene puntas válidas.`,
                                  `Max Dp (${maxd0mayorNum} mm) ≤ geom. min (${minStarD0mayorStrict.toFixed(1)} mm): no valid star geometry in range.`
                                )}
                              </span>
                            </p>
                          )}
                          {isStarRangeMinDpPartial && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-start gap-1">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>
                                {loc(
                                  `Nota: se descartarán automáticamente valores con Dp ≤ mín. geom. (${minStarD0mayorDisplay.toFixed(1)} mm) para conservar la forma de estrella.`,
                                  `Note: candidates with Dp ≤ geom. min (${minStarD0mayorDisplay.toFixed(1)} mm) will be discarded to preserve star shape.`
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <SmartVarConstraintCard
                      title={loc('Número de Puntas de Estrella (Np)', 'Number of Star Points (Np)')}
                      subtitle={loc('Entero ≥ 3 puntas (controla área inicial y progresividad)', 'Integer ≥ 3 points (controls initial port area & progressivity)')}
                      unit={loc('puntas', 'pts')}
                      step="1"
                      mode={modeNp}
                      setMode={setModeNp}
                      val={inputValues.valNp}
                      minVal={inputValues.minNp}
                      maxVal={inputValues.maxNp}
                      onChangeVal={(v) => handleInputChange('valNp', v)}
                      onChangeMin={(v) => handleInputChange('minNp', v)}
                      onChangeMax={(v) => handleInputChange('maxNp', v)}
                      onBlurVal={() => handleBlur('valNp')}
                      freeText={loc('Auto: Búsqueda global de puntas Np ∈ [3, 10]', 'Auto: Global search over Np ∈ [3, 10] points')}
                      placeholderFixed="5"
                      placeholderMin="3"
                      placeholderMax="8"
                      errorText={
                        isNpInvalid
                          ? loc('Una estrella requiere al menos Np ≥ 3 puntas.', 'Star grain requires at least Np ≥ 3 points.')
                          : isNpRangeInvalid
                            ? loc('Rango de Np inválido: ambos deben ser ≥ 3 y Mín ≤ Máx.', 'Invalid Np range: both must be ≥ 3 and Min ≤ Max.')
                            : null
                      }
                      loc={loc}
                    />
                  </div>

                  {hasStarGeometricAlert && (
                    <div className="p-2.5 rounded-lg border border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-300 flex flex-col gap-0.5 text-[11px] font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={13} className="shrink-0" />
                        {loc('Alerta Configuración Estrella', 'Star Configuration Alert')}
                      </span>
                      {(isNpInvalid || isNpRangeInvalid) && (
                        <span>• {loc('Requiere >= 3 puntas (y Mín ≤ Máx)', 'Requires >= 3 points (and Min ≤ Max)')}</span>
                      )}
                      {(isd0mayorLeqd0 || isStarDpBelowGeomMin || isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0 || isStarMaxDpBelowGeomMin) && (
                        <span>
                          • {loc(
                            `Valle (Dp) > mín. geom. (${(minStarD0mayorStrict > 0 ? minStarD0mayorStrict : vald0Num).toFixed(1)} mm) para formar estrella real`,
                            `Valley (Dp) > geom. min (${(minStarD0mayorStrict > 0 ? minStarD0mayorStrict : vald0Num).toFixed(1)} mm) for genuine star arms`
                          )}
                        </span>
                      )}
                      {(isd0mayorGeD0 || isMaxd0mayorGeD0 || isMind0mayorGeD0) && (
                        <span>• {loc(`Valle (Dp) < D0 exterior (${effectiveOuterD.toFixed(1)} mm)`, `Valley (Dp) < outer D0 (${effectiveOuterD.toFixed(1)} mm)`)}</span>
                      )}
                      {isStarGeomExceedsD0 && (
                        <span>
                          • {loc(
                            `Con d0 ≥ ${starMinD0Ref.toFixed(1)} mm y Np ≤ ${starMaxNpPossible}, el mín. geom. de valles (${minStarD0mayorStrict.toFixed(1)} mm) supera D0 útil (${effectiveOuterD.toFixed(1)} mm).`,
                            `With d0 ≥ ${starMinD0Ref.toFixed(1)} mm & Np ≤ ${starMaxNpPossible}, valley geom. min (${minStarD0mayorStrict.toFixed(1)} mm) reaches outer D0 (${effectiveOuterD.toFixed(1)} mm).`
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Finocyl (4) Specific Panel */}
              {shape === 4 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros Finocyl Longitudinal (Clipper2)', 'Full-Length Finocyl Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('Aletas continuas de longitud completa en cada segmento L0', 'Radial fin slots spanning full grain length L0')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SmartVarConstraintCard
                      title={t.finocyl_tip_d0 || 'Fin Tip Dia.'}
                      subtitle={loc(`Debe cumplir d0 < D_fin < ${effectiveOuterD.toFixed(1)} mm`, `Must satisfy d0 < D_fin < ${effectiveOuterD.toFixed(1)} mm`)}
                      mode={moded0mayor}
                      setMode={setModed0mayor}
                      val={inputValues.vald0mayor}
                      minVal={inputValues.mind0mayor}
                      maxVal={inputValues.maxd0mayor}
                      onChangeVal={(v) => handleInputChange('vald0mayor', v)}
                      onChangeMin={(v) => handleInputChange('mind0mayor', v)}
                      onChangeMax={(v) => handleInputChange('maxd0mayor', v)}
                      freeText={loc('Auto: Entre canal central d0 y pared exterior D0', 'Auto: Between core d0 and outer wall D0')}
                      placeholderFixed="32"
                      placeholderMin="18"
                      placeholderMax="44"
                      errorText={
                        isd0mayorGeD0 || isMaxd0mayorGeD0 || isMind0mayorGeD0
                          ? loc(`Debe ser < D0 (${effectiveOuterD.toFixed(1)} mm)`, `Must be < D0 (${effectiveOuterD.toFixed(1)} mm)`)
                          : isRadialTipLeqd0 || isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0
                            ? loc('Debe superar al diámetro central d0', 'Must exceed central bore d0')
                            : isd0mayorRangeInverted
                              ? loc('Rango invertido (Mín ≥ Máx)', 'Inverted range (Min ≥ Max)')
                              : null
                      }
                      loc={loc}
                    />
                    <SmartVarConstraintCard
                      title={t.finocyl_n_fins || 'Fin Count (Np)'}
                      subtitle={loc('Entero ≥ 2 aletas simétricas', 'Integer ≥ 2 symmetric fins')}
                      unit={loc('aletas', 'fins')}
                      step="1"
                      mode={modeNp}
                      setMode={setModeNp}
                      val={inputValues.valNp}
                      minVal={inputValues.minNp}
                      maxVal={inputValues.maxNp}
                      onChangeVal={(v) => handleInputChange('valNp', v)}
                      onChangeMin={(v) => handleInputChange('minNp', v)}
                      onChangeMax={(v) => handleInputChange('maxNp', v)}
                      freeText={loc('Auto: Búsqueda en Np ∈ [2, 8] aletas', 'Auto: Sweep Np ∈ [2, 8] fins')}
                      placeholderFixed="6"
                      placeholderMin="2"
                      placeholderMax="8"
                      errorText={
                        isNpInvalid || isNpRangeInvalid
                          ? loc('Finocyl requiere ≥ 2 aletas y Mín ≤ Máx.', 'Finocyl requires ≥ 2 fins and Min ≤ Max.')
                          : null
                      }
                      loc={loc}
                    />
                    <SmartVarConstraintCard
                      title={t.finocyl_width || 'Fin Slot Width'}
                      subtitle={loc(`Máx sin solape ≈ ${maxFinWidthAllowed.toFixed(1)} mm`, `Non-overlap max ≈ ${maxFinWidthAllowed.toFixed(1)} mm`)}
                      step="0.2"
                      mode={modeFinWidth}
                      setMode={setModeFinWidth}
                      val={inputValues.valFinWidth}
                      minVal={inputValues.minFinWidth}
                      maxVal={inputValues.maxFinWidth}
                      onChangeVal={(v) => handleInputChange('valFinWidth', v)}
                      onChangeMin={(v) => handleInputChange('minFinWidth', v)}
                      onChangeMax={(v) => handleInputChange('maxFinWidth', v)}
                      freeText={loc('Auto: Anchura óptima sin solapamiento entre aletas', 'Auto: Optimal width without fin overlap')}
                      placeholderFixed="3.0"
                      placeholderMin="1.2"
                      placeholderMax="6.0"
                      errorText={
                        isFinWidthInvalid
                          ? loc(`Anchura inválida o solapa aletas adyacentes (máx ${maxFinWidthAllowed.toFixed(1)} mm).`, `Invalid width or overlaps adjacent fins (max ${maxFinWidthAllowed.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}

              {/* Moonburner (5) Specific Panel */}
              {shape === 5 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros Moonburner (Clipper2)', 'Moonburner Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc(`Excentricidad radial respecto al eje (máx ≈ ${maxMoonOffsetAllowed.toFixed(1)} mm)`, `Radial core eccentricity (max ≈ ${maxMoonOffsetAllowed.toFixed(1)} mm)`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SmartVarConstraintCard
                      title={t.moonburner_offset || 'Core Offset'}
                      subtitle={loc(`0 ≤ offset < (D0 - d0)/2 (${maxMoonOffsetAllowed.toFixed(1)} mm)`, `0 ≤ offset < (D0 - d0)/2 (${maxMoonOffsetAllowed.toFixed(1)} mm)`)}
                      step="0.5"
                      mode={modeCoreOffset}
                      setMode={setModeCoreOffset}
                      val={inputValues.valCoreOffset}
                      minVal={inputValues.minCoreOffset}
                      maxVal={inputValues.maxCoreOffset}
                      onChangeVal={(v) => handleInputChange('valCoreOffset', v)}
                      onChangeMin={(v) => handleInputChange('minCoreOffset', v)}
                      onChangeMax={(v) => handleInputChange('maxCoreOffset', v)}
                      freeText={loc('Auto: Excentricidad óptima respetando pared exterior', 'Auto: Optimal eccentricity keeping wall clearance')}
                      placeholderFixed="6.0"
                      placeholderMin="1.0"
                      placeholderMax="12.0"
                      errorText={
                        isMoonOffsetInvalid
                          ? loc(`Desfase inválido o perfora la pared exterior (máx ${maxMoonOffsetAllowed.toFixed(1)} mm).`, `Invalid offset or breaches outer wall (max ${maxMoonOffsetAllowed.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}

              {/* C-Slot (6) Specific Panel */}
              {shape === 6 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros C-Slot (Clipper2)', 'C-Slot Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('Ranura lateral abierta desde la superficie exterior', 'Lateral slot cut inward from outer perimeter')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SmartVarConstraintCard
                      title={t.cslot_width || 'Slot Width'}
                      subtitle={loc(`0 < anchura < D0 (${effectiveOuterD.toFixed(1)} mm)`, `0 < width < D0 (${effectiveOuterD.toFixed(1)} mm)`)}
                      step="0.5"
                      mode={modeSlotWidth}
                      setMode={setModeSlotWidth}
                      val={inputValues.valSlotWidth}
                      minVal={inputValues.minSlotWidth}
                      maxVal={inputValues.maxSlotWidth}
                      onChangeVal={(v) => handleInputChange('valSlotWidth', v)}
                      onChangeMin={(v) => handleInputChange('minSlotWidth', v)}
                      onChangeMax={(v) => handleInputChange('maxSlotWidth', v)}
                      freeText={loc('Auto: Anchura óptima de ranura C-Slot', 'Auto: Optimal C-Slot width')}
                      placeholderFixed="6.0"
                      placeholderMin="2.0"
                      placeholderMax="14.0"
                      errorText={
                        isCSlotWidthInvalid
                          ? loc(`Anchura inválida o ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`, `Invalid width or ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                    <SmartVarConstraintCard
                      title={t.cslot_depth || 'Slot Depth'}
                      subtitle={loc(`0 < profundidad < ${maxCSlotDepthAllowed.toFixed(1)} mm (sin partir el grano)`, `0 < depth < ${maxCSlotDepthAllowed.toFixed(1)} mm (must not split grain)`)}
                      step="0.5"
                      mode={modeSlotDepth}
                      setMode={setModeSlotDepth}
                      val={inputValues.valSlotDepth}
                      minVal={inputValues.minSlotDepth}
                      maxVal={inputValues.maxSlotDepth}
                      onChangeVal={(v) => handleInputChange('valSlotDepth', v)}
                      onChangeMin={(v) => handleInputChange('minSlotDepth', v)}
                      onChangeMax={(v) => handleInputChange('maxSlotDepth', v)}
                      freeText={loc('Auto: Profundidad óptima sin dividir el grano en dos', 'Auto: Optimal depth without splitting grain')}
                      placeholderFixed="20.0"
                      placeholderMin="8.0"
                      placeholderMax="35.0"
                      errorText={
                        isCSlotDepthInvalid
                          ? loc(`La ranura parte el grano en dos (máx ${maxCSlotDepthAllowed.toFixed(1)} mm).`, `Slot splits grain in two (max ${maxCSlotDepthAllowed.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}

              {/* D-Grain (7) Specific Panel */}
              {shape === 7 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros D-Grain (Clipper2)', 'D-Grain Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('Corte plano cordal desde el borde exterior', 'Flat chordal cut inward from outer edge')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SmartVarConstraintCard
                      title={t.dgrain_cut_depth || 'Chord Cut Depth'}
                      subtitle={loc(`0 < corte < D0 (${effectiveOuterD.toFixed(1)} mm)`, `0 < cut < D0 (${effectiveOuterD.toFixed(1)} mm)`)}
                      step="0.5"
                      mode={modeSlotDepth}
                      setMode={setModeSlotDepth}
                      val={inputValues.valSlotDepth}
                      minVal={inputValues.minSlotDepth}
                      maxVal={inputValues.maxSlotDepth}
                      onChangeVal={(v) => handleInputChange('valSlotDepth', v)}
                      onChangeMin={(v) => handleInputChange('minSlotDepth', v)}
                      onChangeMax={(v) => handleInputChange('maxSlotDepth', v)}
                      freeText={loc('Auto: Profundidad cordal óptima', 'Auto: Optimal chord cut depth')}
                      placeholderFixed="18.0"
                      placeholderMin="5.0"
                      placeholderMax="32.0"
                      errorText={
                        isDGrainDepthInvalid
                          ? loc(`Corte inválido o ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`, `Invalid cut or ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}

              {/* Rod & Tube (8) Specific Panel */}
              {shape === 8 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros Rod & Tube (Clipper2)', 'Rod & Tube Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('Varilla central sólida + tubo concéntrico exterior (combustión neutra)', 'Inner solid rod + outer tube (neutral burn)')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SmartVarConstraintCard
                      title={t.rodtube_rod_d || 'Center Rod Dia.'}
                      subtitle={loc(`0 < varilla < d0 tubo (${effectiveMaxd0Ref.toFixed(1)} mm)`, `0 < rod < tube ID d0 (${effectiveMaxd0Ref.toFixed(1)} mm)`)}
                      step="0.5"
                      mode={modeRodDiameter}
                      setMode={setModeRodDiameter}
                      val={inputValues.valRodDiameter}
                      minVal={inputValues.minRodDiameter}
                      maxVal={inputValues.maxRodDiameter}
                      onChangeVal={(v) => handleInputChange('valRodDiameter', v)}
                      onChangeMin={(v) => handleInputChange('minRodDiameter', v)}
                      onChangeMax={(v) => handleInputChange('maxRodDiameter', v)}
                      freeText={loc('Auto: Diámetro óptimo dejando canal anular de paso', 'Auto: Optimal rod keeping annular gas channel')}
                      placeholderFixed="10.0"
                      placeholderMin="3.0"
                      placeholderMax="20.0"
                      errorText={
                        isRodTubeInvalid
                          ? loc(`La varilla debe ser > 0 y menor que d0 del tubo (${effectiveMaxd0Ref.toFixed(1)} mm).`, `Rod must be > 0 and smaller than tube ID (${effectiveMaxd0Ref.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}

              {/* Wagon Wheel (9) Specific Panel */}
              {shape === 9 && (
                <div className="mt-3 p-4 rounded-xl border border-primary/35 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                        {loc('Parámetros Wagon Wheel (Clipper2)', 'Wagon Wheel Specific Parameters (Clipper2)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {loc('Cavidad anular segmentada por radios sólidos de propelente', 'Annular cavity segmented by radial propellant spokes')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SmartVarConstraintCard
                      title={t.wagon_outer_d0 || 'Window Outer Dia.'}
                      subtitle={loc(`Debe cumplir d0 < D_win < ${effectiveOuterD.toFixed(1)} mm`, `Must satisfy d0 < D_win < ${effectiveOuterD.toFixed(1)} mm`)}
                      mode={moded0mayor}
                      setMode={setModed0mayor}
                      val={inputValues.vald0mayor}
                      minVal={inputValues.mind0mayor}
                      maxVal={inputValues.maxd0mayor}
                      onChangeVal={(v) => handleInputChange('vald0mayor', v)}
                      onChangeMin={(v) => handleInputChange('mind0mayor', v)}
                      onChangeMax={(v) => handleInputChange('maxd0mayor', v)}
                      freeText={loc('Auto: Entre canal central d0 y pared exterior D0', 'Auto: Between core d0 and outer wall D0')}
                      placeholderFixed="34"
                      placeholderMin="18"
                      placeholderMax="44"
                      errorText={
                        isd0mayorGeD0 || isMaxd0mayorGeD0 || isMind0mayorGeD0
                          ? loc(`Debe ser < D0 (${effectiveOuterD.toFixed(1)} mm)`, `Must be < D0 (${effectiveOuterD.toFixed(1)} mm)`)
                          : isRadialTipLeqd0 || isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0
                            ? loc('Debe superar al diámetro central d0', 'Must exceed central bore d0')
                            : isd0mayorRangeInverted
                              ? loc('Rango invertido (Mín ≥ Máx)', 'Inverted range (Min ≥ Max)')
                              : null
                      }
                      loc={loc}
                    />
                    <SmartVarConstraintCard
                      title={t.wagon_spokes || 'Spoke Count (Np)'}
                      subtitle={loc('Entero ≥ 3 radios simétricos', 'Integer ≥ 3 symmetric spokes')}
                      unit={loc('radios', 'spokes')}
                      step="1"
                      mode={modeNp}
                      setMode={setModeNp}
                      val={inputValues.valNp}
                      minVal={inputValues.minNp}
                      maxVal={inputValues.maxNp}
                      onChangeVal={(v) => handleInputChange('valNp', v)}
                      onChangeMin={(v) => handleInputChange('minNp', v)}
                      onChangeMax={(v) => handleInputChange('maxNp', v)}
                      freeText={loc('Auto: Búsqueda en Np ∈ [3, 8] radios', 'Auto: Sweep Np ∈ [3, 8] spokes')}
                      placeholderFixed="6"
                      placeholderMin="3"
                      placeholderMax="8"
                      errorText={
                        isNpInvalid || isNpRangeInvalid
                          ? loc('Wagon Wheel requiere ≥ 3 radios y Mín ≤ Máx.', 'Wagon Wheel requires ≥ 3 spokes and Min ≤ Max.')
                          : null
                      }
                      loc={loc}
                    />
                    <SmartVarConstraintCard
                      title={t.wagon_spoke_width || 'Spoke Thickness'}
                      subtitle={loc(`Máx sin solape ≈ ${maxSpokeWidthAllowed.toFixed(1)} mm`, `Non-overlap max ≈ ${maxSpokeWidthAllowed.toFixed(1)} mm`)}
                      step="0.2"
                      mode={modeSpokeWidth}
                      setMode={setModeSpokeWidth}
                      val={inputValues.valSpokeWidth}
                      minVal={inputValues.minSpokeWidth}
                      maxVal={inputValues.maxSpokeWidth}
                      onChangeVal={(v) => handleInputChange('valSpokeWidth', v)}
                      onChangeMin={(v) => handleInputChange('minSpokeWidth', v)}
                      onChangeMax={(v) => handleInputChange('maxSpokeWidth', v)}
                      freeText={loc('Auto: Espesor de radio óptimo sin cierre del núcleo', 'Auto: Optimal spoke thickness without core pinch')}
                      placeholderFixed="2.8"
                      placeholderMin="1.2"
                      placeholderMax="5.5"
                      errorText={
                        isSpokeWidthInvalid
                          ? loc(`Espesor inválido o solapa en el núcleo (máx ${maxSpokeWidthAllowed.toFixed(1)} mm).`, `Invalid thickness or overlaps at core (max ${maxSpokeWidthAllowed.toFixed(1)} mm).`)
                          : null
                      }
                      loc={loc}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. SUPERFICIES DE QUEMADO E INHIBICIONES */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground">
                  {loc('Superficies de Quemado e Inhibición', 'Burn Surfaces & Inhibitions')}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {loc('Seleccionado = Quema activa (Rojo) | Deseleccionado = Inhibido (Negro)', 'Selected = Burns (Red) | Deselected = Inhibited (Black)')}
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
                        ? (loc('Cara Exterior: Quema', 'Outer Surface: Burns')) 
                        : (loc('Cara Exterior: Inhibida', 'Outer Surface: Inhibited'))}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {outerBurns ? (loc('🔥 Quema (Rojo)', '🔥 Burns (Red)')) : (loc('🛡️ Inhibida (Negro)', '🛡️ Inhibited (Black)'))}
                  </span>
                </button>

                {/* Botón 2: Núcleo / Ranura / Varilla */}
                <button
                  type="button"
                  disabled={shape === 3}
                  onClick={() => shape !== 3 && setCoreBurns(!coreBurns)}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-between gap-2 ${
                    shape === 3
                      ? 'border-border bg-muted/40 text-muted-foreground opacity-60 cursor-not-allowed'
                      : coreBurns
                        ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 font-bold shadow-xs cursor-pointer'
                        : 'border-slate-800 bg-slate-900/10 text-slate-800 dark:text-slate-200 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      shape === 3
                        ? 'border-muted-foreground/40 bg-muted text-transparent'
                        : coreBurns
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-slate-700 bg-slate-950 text-white'
                    }`}>
                      {shape !== 3 && coreBurns && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-bold font-mono">
                      {shape === 3
                        ? loc('Núcleo: N/A (Macizo)', 'Core: N/A (Solid)')
                        : shape === 6 || shape === 7
                          ? (coreBurns ? loc('Pared Ranura/Corte: Quema', 'Slot/Cut Face: Burns') : loc('Pared Ranura/Corte: Inhibida', 'Slot/Cut Face: Inhibited'))
                          : (coreBurns ? loc('Núcleo: Quema', 'Core: Burns') : loc('Núcleo: Inhibido', 'Core: Inhibited'))}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {shape === 3
                      ? '—'
                      : coreBurns
                        ? loc('🔥 Quema (Rojo)', '🔥 Burns (Red)')
                        : loc('🛡️ Inhibido (Negro)', '🛡️ Inhibited (Black)')}
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
                        ? (loc('Extremos: Queman', 'Ends: Burn')) 
                        : (loc('Extremos: Inhibidos', 'Ends: Inhibited'))}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">
                    {endsBurn ? (loc('🔥 Queman (Rojo)', '🔥 Burn (Red)')) : (loc('🛡️ Inhibidos (Negro)', '🛡️ Inhibited (Black)'))}
                  </span>
                </button>

              </div>
            </div>

            {/* 4. RESTRICCIÓN DE MASA TOTAL DE PROPELENTE */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                  <Flame size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {loc('Restricción de Masa Total de Propelente (Mprop)', 'Total Propellant Mass Constraint (Mprop)')}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {loc('Fija o limita la masa total de todos los granos sumados', 'Fix or bound total grain propellant mass')}
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
                      {loc('Libre', 'Free')}
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
                      {loc('Fijar Masa', 'Fixed Mass')}
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
                      {loc('Rango', 'Range')}
                    </button>
                  </div>

                  {/* Mode input controls */}
                  <div className="md:col-span-2">
                    {modeMprop === 'free' && (
                      <div className="text-[11px] text-muted-foreground font-mono bg-muted/20 p-2.5 rounded-lg text-center">
                        {loc('Auto: El optimizador calculará la masa máxima admisible según el volumen útil de la cámara', 'Auto: Optimizer finds optimal mass filling available chamber volume')}
                      </div>
                    )}

                    {modeMprop === 'fixed' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {loc('Masa total exacta objetivo:', 'Exact target total mass:')}
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
                {loc('Atrás (Fase 1)', 'Back (Phase 1)')}
              </Button>
              <Button
                onClick={() => setActiveStep(3)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {loc('Continuar a Fase 3: Algoritmos', 'Continue to Phase 3: Algorithms')}
                <ArrowRight size={16} />
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* FASE 3: ALGORITMOS Y EJECUCIÓN DEL OPTIMIZADOR */}
      {activeStep === 3 && (
        <Card data-tour="smart-search-phase3-card" className="bg-card border-border shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-card-header text-card-header-foreground border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                <Cpu size={16} />
                {loc('Fase 3: Algoritmos y Lanzamiento del Optimizador', 'Phase 3: Algorithms & Optimizer Execution')}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loc('Configura el presupuesto de simulación y lanza la optimización balística global', 'Configure simulation budget and launch global ballistic optimization')}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border tabular-nums">
              <span>{loc('Hardware:', 'Hardware:')} <strong className="text-foreground">{DcVal}x{LcVal} mm, Dt={Dt0Val} mm</strong></span>
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
                      {loc('Objetivo Activo de Misión', 'Active Mission Objective')}
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold border border-emerald-500/30">
                      {loc('Fijado en Bandeja', 'Set in Inbox')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {loc('Máxima Altitud / Mayor Impulso Total Real (It)', 'Maximum Altitude / Peak Total Real Impulse (It)')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {loc('Maximización matemática estricta de It = ∫ F dt garantizando Pmax ≤ P_límite con reglas de Deb sin funciones de penalización arbitrarias.', 'Strict mathematical maximization of It = ∫ F dt guaranteeing Pmax ≤ P_limit with Deb rules without arbitrary penalty weights.')}
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
                {loc('Cambiar Objetivo', 'Change Objective')}
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
                        <span>{loc('Motor Unificado: Differential Evolution (DE/rand/1/bin)', 'Unified Engine: Differential Evolution (DE/rand/1/bin)')}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                          {loc('Canónico', 'Canonical')}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {loc('Optimización estocástica global sin derivadas con muestreo Latino Hipercúbico (LHS), dither adaptativo y selección estricta de factibilidad de Deb.', 'Derivative-free global stochastic optimizer with Latin Hypercube Sampling (LHS), adaptive dithering, and Deb feasibility selection.')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold">
                      {loc('Objetivo: Max It (Impulso Total)', 'Objective: Max It (Total Impulse)')}
                    </span>
                  </div>
                </div>

                {/* 4 Architectural Spec Badges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{loc('Estrategia', 'Strategy')}</div>
                    <div className="font-bold text-foreground mt-0.5">
                      {isComplexGrain(shape) ? 'DE/rand/1/bin + Clipper2' : 'DE/rand/1/bin (LHS)'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{loc('Variables Activas', 'Active Variables')}</div>
                    <div className="font-bold text-foreground mt-0.5">
                      {(() => {
                        const vars: string[] = [];
                        if (modeD0 !== 'fixed') vars.push('D0');
                        if (hasCorePort && moded0 !== 'fixed') vars.push('d0');
                        if (usesRadialD0MayorAndNp && moded0mayor !== 'fixed') {
                          vars.push(shape === 4 ? 'Df' : shape === 9 ? 'Dw' : 'Dp');
                        }
                        if (usesRadialD0MayorAndNp && modeNp !== 'fixed') vars.push('Np');
                        if (shape === 4 && modeFinWidth !== 'fixed') vars.push('wf');
                        if (shape === 9 && modeSpokeWidth !== 'fixed') vars.push('ws');
                        if (shape === 5 && modeCoreOffset !== 'fixed') vars.push('off');
                        if (shape === 6 && modeSlotWidth !== 'fixed') vars.push('w');
                        if ((shape === 6 || shape === 7) && modeSlotDepth !== 'fixed') vars.push(shape === 7 ? 'cut' : 'depth');
                        if (shape === 8 && modeRodDiameter !== 'fixed') vars.push('rod');
                        if (modeL0 !== 'fixed') vars.push('L0');
                        return vars.length > 0 ? vars.join(' · ') : loc('Ninguna (Fijadas)', 'None (Fixed)');
                      })()}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{loc('Geometría y Granos', 'Shape & Grains')}</div>
                    <div className="font-bold text-foreground mt-0.5 truncate">
                      {getGrainShapeLabel(shape, t)} · {grainCountMode === 'range' ? `N=1..${inputValues.maxGrainCount || 5}` : `N=${inputValues.fixedGrainCount || 3}`}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">{loc('Límites Cámara', 'Chamber Limits')}</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                      P≤{inputValues.Pmax_lim || '6.0'} MPa · D0≤{availableD0.toFixed(1)}mm
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Budget Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {loc('Presupuesto de Simulaciones por Valor de N', 'Simulation Budget per Grain Count N')}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {loc('Configura la profundidad de la búsqueda global', 'Configure global search evaluation depth')}
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
                          {loc('Búsqueda Rápida', 'Fast Search')}
                        </span>
                        {budgetPreset === 'fast' && evaluationsPerN === 500 && (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {loc('500 simulaciones / N. Exploración ágil para dimensionado preliminar.', '500 simulations / N. Fast exploration for preliminary sizing.')}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ⚡ ~1 - 2s {loc('por grano', 'per grain')}
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
                          {loc('Estándar (Recomendado)', 'Standard (Recommended)')}
                        </span>
                        {budgetPreset === 'standard' && evaluationsPerN === 1000 && (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {loc('1.000 simulaciones / N. Convergencia balística sólida de alta fidelidad.', '1,000 simulations / N. Robust high-fidelity ballistic convergence.')}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      🎯 ~2 - 4s {loc('por grano', 'per grain')}
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
                        ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                        : 'border-border bg-card/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Rocket size={14} className="text-secondary" />
                          {loc('Búsqueda Profunda', 'Deep Search')}
                        </span>
                        {budgetPreset === 'deep' && evaluationsPerN === 2000 && (
                          <CheckCircle2 size={16} className="text-primary" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {loc('2.000 simulaciones / N. Máxima exploración global para geometrías complejas.', '2,000 simulations / N. Exhaustive global exploration for complex geometries.')}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] font-mono font-bold text-primary tabular-nums">
                      ~5 - 8s {loc('por grano', 'per grain')}
                    </div>
                  </div>
                </div>

                {/* Transparent Budget Summary Banner */}
                <div className="p-3 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <div className="flex items-center gap-2 text-foreground">
                    <Activity size={15} className="text-primary shrink-0" />
                    <span>
                      {grainCountMode === 'range' ? (
                        lang === 'es' ? (
                          <>Presupuesto: <strong>{evaluationsPerN.toLocaleString()}</strong> evals / grano × <strong>{inputValues.maxGrainCount || 5}</strong> valores de N = <strong className="text-primary">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} simulaciones totales</strong></>
                        ) : lang === 'fr' ? (
                          <>Budget : <strong>{evaluationsPerN.toLocaleString()}</strong> évals / grain × <strong>{inputValues.maxGrainCount || 5}</strong> valeurs de N = <strong className="text-primary">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} simulations au total</strong></>
                        ) : lang === 'it' ? (
                          <>Budget: <strong>{evaluationsPerN.toLocaleString()}</strong> valutazioni / grano × <strong>{inputValues.maxGrainCount || 5}</strong> valori di N = <strong className="text-primary">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} simulazioni totali</strong></>
                        ) : (
                          <>Budget: <strong>{evaluationsPerN.toLocaleString()}</strong> evals / grain × <strong>{inputValues.maxGrainCount || 5}</strong> N values = <strong className="text-primary">~{(evaluationsPerN * (parseInt(inputValues.maxGrainCount) || 5)).toLocaleString()} total simulations</strong></>
                        )
                      ) : (
                        lang === 'es' ? (
                          <>Presupuesto: <strong className="text-primary">{evaluationsPerN.toLocaleString()} simulaciones balísticas</strong> para N = {inputValues.fixedGrainCount || 3} granos fijos</>
                        ) : lang === 'fr' ? (
                          <>Budget : <strong className="text-primary">{evaluationsPerN.toLocaleString()} simulations balistiques</strong> pour N = {inputValues.fixedGrainCount || 3} grains fixes</>
                        ) : lang === 'it' ? (
                          <>Budget: <strong className="text-primary">{evaluationsPerN.toLocaleString()} simulazioni balistiche</strong> per N = {inputValues.fixedGrainCount || 3} grani fissi</>
                        ) : (
                          <>Budget: <strong className="text-primary">{evaluationsPerN.toLocaleString()} ballistic simulations</strong> for fixed N = {inputValues.fixedGrainCount || 3}</>
                        )
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{loc('Personalizar:', 'Custom:')}</span>
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
                      className="w-20 h-7 px-2 text-xs font-mono font-bold rounded-md border border-border bg-background text-foreground text-center tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* OPTIMIZATION PROGRESS TELEMETRY */}
            {isSearching && (
              <div className="p-4 rounded-xl border border-primary/40 bg-card text-foreground shadow-sm space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold border border-primary/30 bg-primary/10 text-primary shrink-0">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono flex items-center gap-2 text-primary">
                        <span>
                          {loc('EVOLUCIÓN DIFERENCIAL ACTIVA (DE/rand/1/bin)', 'DIFFERENTIAL EVOLUTION RUNNING (DE/rand/1/bin)')}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {searchProgress?.stepDescription || (loc('Evaluando candidatos balísticos...', 'Evaluating ballistic candidates...'))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-base font-bold text-primary">
                        {searchProgress?.percent || 0}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {searchProgress?.elapsedSeconds !== undefined ? searchProgress.elapsedSeconds : (searchProgress?.elapsedMs ? (searchProgress.elapsedMs / 1000).toFixed(1) : '0.0')}s
                      </div>
                    </div>

                    {/* Prominent Red Cancel Button inside HUD */}
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleCancelSearch}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-4 text-xs font-mono flex items-center gap-1.5 shadow-sm border border-red-500 cursor-pointer shrink-0"
                    >
                      <XCircle size={15} />
                      {loc('CANCELAR SIMULACIÓN', 'CANCEL SIMULATION')}
                    </Button>
                  </div>
                </div>

                {/* Crisp Progress Bar */}
                <div className="w-full h-2 bg-muted rounded-md overflow-hidden border border-border">
                  <div 
                    className="h-full rounded-sm transition-all duration-150 bg-primary"
                    style={{ width: `${Math.min(100, Math.max(4, searchProgress?.percent || 4))}%` }}
                  />
                </div>

                {/* Status Ticker */}
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border tabular-nums">
                  <div className="flex items-center gap-2">
                    <Activity size={12} className="text-primary" />
                    <span>
                      {loc('Simulaciones Balísticas:', 'Ballistic Simulations:')}{' '}
                      <strong className="text-foreground">{searchProgress?.currentEvaluations || 0}</strong>
                      {searchProgress?.totalEstimated ? ` / ~${searchProgress.totalEstimated}` : ''}
                    </span>
                  </div>

                  {searchProgress?.bestConfigSummary && (
                    <div className="text-primary text-[10px] truncate max-w-xs sm:max-w-md font-semibold">
                      {loc('Mejor:', 'Best:')} <strong>{searchProgress.bestConfigSummary}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Geometric Conflict Warning Banner */}
            {hasGeometricConflict && (
              <div className="p-3.5 rounded-xl border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 flex items-start gap-3 text-xs font-mono shadow-xs">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    {loc('⚠️ Restricción Geométrica No Física Detectada', '⚠️ Non-Physical Geometric Constraint Detected')}
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {isClearanceCollapsed && (
                      <span className="block">• {loc(`Espacio radial agotado (D0 máx = ${availableD0.toFixed(1)} mm): el espesor de liner e inhibidor (${radialDeductionDiamMm.toFixed(1)} mm) iguala o supera Dc (${DcVal} mm).`, `Radial clearance exhausted (D0 max = ${availableD0.toFixed(1)} mm): liner + inhibitor (${radialDeductionDiamMm.toFixed(1)} mm) equals or exceeds Dc (${DcVal} mm).`)}</span>
                    )}
                    {isDt0GeDs && (
                      <span className="block">• {loc(`Garganta tobera Dt (${Dt0Val} mm) ≥ Salida Ds (${DsVal} mm). En toberas de Laval la salida debe ser mayor.`, `Nozzle throat Dt (${Dt0Val} mm) ≥ Exit Ds (${DsVal} mm). Exit must be larger.`)}</span>
                    )}
                    {isDt0GeDc && (
                      <span className="block">• {loc(`Garganta tobera Dt (${Dt0Val} mm) ≥ Cámara Dc (${DcVal} mm). La garganta no cabe en la cámara.`, `Nozzle throat Dt (${Dt0Val} mm) ≥ Chamber Dc (${DcVal} mm).`)}</span>
                    )}
                    {isD0ExceedsClearance && (
                      <span className="block">• {loc(`Diámetro exterior D0 (${valD0Num} mm) > Diámetro útil permitido (${availableD0.toFixed(1)} mm${radialDeductionDiamMm > 0 ? ' tras liner/inhibidor' : ''}). El grano no cabe.`, `Outer D0 (${valD0Num} mm) > Available diameter (${availableD0.toFixed(1)} mm${radialDeductionDiamMm > 0 ? ' after liner/inhibitor' : ''}).`)}</span>
                    )}
                    {(isMaxD0ExceedsClearance || isMinD0ExceedsClearance) && (
                      <span className="block">• {loc(`Rango D0 (hasta ${Math.max(minD0Num, maxD0Num)} mm) > Diámetro útil permitido (${availableD0.toFixed(1)} mm).`, `D0 range (up to ${Math.max(minD0Num, maxD0Num)} mm) > Available diameter (${availableD0.toFixed(1)} mm).`)}</span>
                    )}
                    {isD0RangeInverted && (
                      <span className="block">• {loc(`Rango D0 invertido: Mín (${minD0Num} mm) ≥ Máx (${maxD0Num} mm).`, `Inverted D0 range: Min (${minD0Num} mm) ≥ Max (${maxD0Num} mm).`)}</span>
                    )}
                    {isd0GeD0 && (
                      <span className="block">• {loc(`Núcleo interior d0 (${vald0Num} mm) ≥ Diámetro exterior útil (${effectiveOuterD.toFixed(1)} mm). Espesor de pared (web) nulo o negativo.`, `Inner core d0 (${vald0Num} mm) ≥ Outer D0 (${effectiveOuterD.toFixed(1)} mm). Zero or negative web.`)}</span>
                    )}
                    {isd0RangeInverted && (
                      <span className="block">• {loc(`Rango d0 invertido: Mín (${mind0Num} mm) ≥ Máx (${maxd0Num} mm).`, `Inverted d0 range: Min (${mind0Num} mm) ≥ Max (${maxd0Num} mm).`)}</span>
                    )}
                    {isMind0GeD0 && (
                      <span className="block">• {loc(`Mínimo d0 (${mind0Num} mm) ≥ Diámetro D0 (${effectiveOuterD.toFixed(1)} mm).`, `Min d0 (${mind0Num} mm) ≥ Outer D0 (${effectiveOuterD.toFixed(1)} mm).`)}</span>
                    )}
                    {isd0mayorLeqd0 && (
                      <span className="block">• {loc(`Estrella: diámetro de valles Dp (${vald0mayorNum} mm) ≤ puntas d0 (${vald0Num} mm).`, `Star: valley diameter Dp (${vald0mayorNum} mm) ≤ inner tips d0 (${vald0Num} mm).`)}</span>
                    )}
                    {!isd0mayorLeqd0 && isStarDpBelowGeomMin && (
                      <span className="block">• {loc(`Estrella: diámetro de valles Dp (${vald0mayorNum} mm) ≤ mín. geom. (${minStarD0mayorStrict.toFixed(1)} mm). Colapsa en polígono sin puntas de estrella.`, `Star: valley diameter Dp (${vald0mayorNum} mm) ≤ geom. min (${minStarD0mayorStrict.toFixed(1)} mm). Collapses into non-star polygon.`)}</span>
                    )}
                    {isd0mayorGeD0 && (
                      <span className="block">• {loc(`Estrella: diámetro de valles Dp (${vald0mayorNum} mm) ≥ D0 útil (${effectiveOuterD.toFixed(1)} mm).`, `Star: valley diameter Dp (${vald0mayorNum} mm) ≥ outer D0 (${effectiveOuterD.toFixed(1)} mm).`)}</span>
                    )}
                    {isd0mayorRangeInverted && (
                      <span className="block">• {loc(`Estrella: rango Dp invertido (${mind0mayorNum} ≥ ${maxd0mayorNum} mm).`, `Star: inverted Dp range (${mind0mayorNum} ≥ ${maxd0mayorNum} mm).`)}</span>
                    )}
                    {(isMaxd0mayorGeD0 || isMind0mayorGeD0) && (
                      <span className="block">• {loc(`Estrella: rango de Dp supera diámetro exterior útil (${effectiveOuterD.toFixed(1)} mm).`, `Star: Dp range exceeds outer diameter (${effectiveOuterD.toFixed(1)} mm).`)}</span>
                    )}
                    {(isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0) && (
                      <span className="block">• {loc('Estrella: el diámetro máximo de valles Dp debe ser mayor que d0.', 'Star: max valley diameter Dp must exceed d0.')}</span>
                    )}
                    {!(isMaxd0mayorLeqd0 || isMaxd0mayorLeqMind0) && isStarMaxDpBelowGeomMin && (
                      <span className="block">• {loc(`Estrella: el máximo de Dp (${maxd0mayorNum} mm) ≤ mín. geom. (${minStarD0mayorStrict.toFixed(1)} mm). No forma estrella válida.`, `Star: max Dp (${maxd0mayorNum} mm) ≤ geom. min (${minStarD0mayorStrict.toFixed(1)} mm). No valid star.`)}</span>
                    )}
                    {isStarGeomExceedsD0 && (
                      <span className="block">• {loc(`Estrella: el mínimo geométrico de valles (${minStarD0mayorStrict.toFixed(1)} mm) iguala o supera D0 útil (${effectiveOuterD.toFixed(1)} mm). Reduce d0 o aumenta Np/D0.`, `Star: valley geom. min (${minStarD0mayorStrict.toFixed(1)} mm) reaches outer D0 (${effectiveOuterD.toFixed(1)} mm). Lower d0 or raise Np/D0.`)}</span>
                    )}
                    {(isNpInvalid || isNpRangeInvalid) && (
                      <span className="block">• {loc(`${getGrainShapeLabel(shape, t)}: Np debe ser ≥ ${minNpRequired} (y Mín ≤ Máx).`, `${getGrainShapeLabel(shape, t)}: Np must be ≥ ${minNpRequired} (and Min ≤ Max).`)}</span>
                    )}
                    {isRadialTipLeqd0 && (
                      <span className="block">• {loc(`${getGrainShapeLabel(shape, t)}: el diámetro exterior del rasgo debe superar a d0.`, `${getGrainShapeLabel(shape, t)}: outer feature diameter must exceed core d0.`)}</span>
                    )}
                    {isFinWidthInvalid && (
                      <span className="block">• {loc(`Finocyl: anchura de aleta inválida o solapa aletas adyacentes (máx ${maxFinWidthAllowed.toFixed(1)} mm).`, `Finocyl: fin slot width invalid or overlaps adjacent fins (max ${maxFinWidthAllowed.toFixed(1)} mm).`)}</span>
                    )}
                    {isSpokeWidthInvalid && (
                      <span className="block">• {loc(`Wagon Wheel: espesor de radio inválido o solapa en el núcleo (máx ${maxSpokeWidthAllowed.toFixed(1)} mm).`, `Wagon Wheel: spoke thickness invalid or overlaps at core (max ${maxSpokeWidthAllowed.toFixed(1)} mm).`)}</span>
                    )}
                    {isMoonOffsetInvalid && (
                      <span className="block">• {loc(`Moonburner: excentricidad inválida o perfora la pared exterior (máx ${maxMoonOffsetAllowed.toFixed(1)} mm).`, `Moonburner: core offset invalid or breaches outer wall (max ${maxMoonOffsetAllowed.toFixed(1)} mm).`)}</span>
                    )}
                    {isCSlotWidthInvalid && (
                      <span className="block">• {loc(`C-Slot: anchura de ranura inválida o ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`, `C-Slot: slot width invalid or ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`)}</span>
                    )}
                    {isCSlotDepthInvalid && (
                      <span className="block">• {loc(`C-Slot: profundidad de ranura parte el grano (máx ${maxCSlotDepthAllowed.toFixed(1)} mm).`, `C-Slot: slot depth splits grain (max ${maxCSlotDepthAllowed.toFixed(1)} mm).`)}</span>
                    )}
                    {isDGrainDepthInvalid && (
                      <span className="block">• {loc(`D-Grain: profundidad de corte cordal inválida o ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`, `D-Grain: chord cut depth invalid or ≥ D0 (${effectiveOuterD.toFixed(1)} mm).`)}</span>
                    )}
                    {isRodTubeInvalid && (
                      <span className="block">• {loc(`Rod & Tube: diámetro de varilla inválido o ≥ d0 tubo (${effectiveMaxd0Ref.toFixed(1)} mm).`, `Rod & Tube: rod diameter invalid or ≥ tube ID (${effectiveMaxd0Ref.toFixed(1)} mm).`)}</span>
                    )}
                    {isL0ExceedsLc && (
                      <span className="block">• {loc(`Longitud total N×L0 (${(fixedNNum * valL0Num).toFixed(1)} mm) supera longitud útil de cámara Lc (${LcVal} mm).`, `Total length N×L0 (${(fixedNNum * valL0Num).toFixed(1)} mm) exceeds chamber Lc (${LcVal} mm).`)}</span>
                    )}
                    {isL0RangeInverted && (
                      <span className="block">• {loc(`Rango L0 invertido: Mín (${minL0Num} mm) ≥ Máx (${maxL0Num} mm).`, `Inverted L0 range: Min (${minL0Num} mm) ≥ Max (${maxL0Num} mm).`)}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-red-600 dark:text-red-400 font-bold pt-0.5">
                    {loc('Por favor, retrocede a la Fase 1 o Fase 2 y ajusta las dimensiones antes de iniciar la optimización.', 'Please return to Phase 1 or Phase 2 and adjust dimensions before starting optimization.')}
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
                {loc('Atrás (Fase 2)', 'Back (Phase 2)')}
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
                    {loc('CANCELAR SIMULACIÓN', 'CANCEL SIMULATION')}
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
                      {loc('Optimizando con Differential Evolution (DE/rand/1/bin)...', 'Optimizing with Differential Evolution...')}
                    </>
                  ) : hasGeometricConflict ? (
                    <>
                      <AlertTriangle size={18} />
                      {loc('CORREGIR COTAS GEOMÉTRICAS', 'FIX GEOMETRIC CONSTRAINTS')}
                    </>
                  ) : (
                    <>
                      <Cpu size={18} />
                      {loc('EJECUTAR OPTIMIZADOR GLOBAL (DIFFERENTIAL EVOLUTION)', 'RUN GLOBAL OPTIMIZER (DIFFERENTIAL EVOLUTION)')}
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
                    {loc('Simulación cancelada por el usuario', 'Simulation stopped by user')}
                  </strong>
                  <span className="text-[11px] text-muted-foreground">
                    {loc('La optimización se interrumpió anticipadamente. Se conservan y muestran los mejores candidatos factibles evaluados hasta ese momento.', 'Optimization was stopped early. Preserving and displaying the best feasible candidates found up to that point.')}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-700 dark:text-red-300 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-red-500/30">
                {loc('Cancelada', 'Cancelled')}
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
                      ? (loc(`${searchOutcome.bestCandidates.length} ${searchOutcome.bestCandidates.length === 1 ? 'Mejor Solución Óptima Encontrada' : 'Mejores Soluciones Óptimas Encontradas'}`, `${searchOutcome.bestCandidates.length} Top Optimal Solutions Found`))
                      : (loc('No se encontraron soluciones viables', 'No viable solutions found'))}
                  </span>
                  {searchOutcome.safeCount > 0 && (
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tabular-nums">
                      {searchOutcome.safeCount} {loc('100% Seguras (P ≤ Pmax)', 'Safe (P ≤ Pmax)')}
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border bg-primary/10 text-primary border-primary/30">
                    Differential Evolution (DE/rand/1/bin)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {loc(`${searchOutcome.totalEvaluated} configuraciones evaluadas exhaustivamente en ${searchOutcome.executionTimeMs} ms`, `${searchOutcome.totalEvaluated} configurations evaluated in ${searchOutcome.executionTimeMs} ms`)}
                </div>
              </div>
            </div>

            {/* Overpressure badge indicator */}
            {searchOutcome.hasOverpressureWarning && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle size={15} />
                {loc('Aviso: Presión Elevada', 'Notice: Elevated Pressure')}
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
                    {loc(`Comparativa de Impulso por Número de Granos (N = 1 .. ${searchOutcome.grainSummaries.length})`, `Impulse Comparison by Grain Count (N = 1 .. ${searchOutcome.grainSummaries.length})`)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {loc('Selección estricta del mejor impulso factible', 'Strict selection of highest feasible impulse')}
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
                            N = {g.N} {g.N === 1 ? (loc('grano', 'grain')) : (loc('granos', 'grains'))}
                          </span>
                          {isWinner && (
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                              ★ {loc('GANADOR', 'WINNER')}
                            </span>
                          )}
                        </div>
                        <div className={`text-sm font-extrabold font-mono ${isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                          {g.bestFeasibleImpulse !== null ? `${g.bestFeasibleImpulse} N·s` : (loc('No factible', 'Infeasible'))}
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
                {loc(`Configuración seleccionada: ${searchOutcome.bestCandidates[0]?.config.grainCount} granos (${searchOutcome.bestCandidates[0]?.metrics.totalImpulse} N·s) por ser la mejor solución encontrada entre todas las configuraciones factibles de N exploradas.`, `Selected configuration: ${searchOutcome.bestCandidates[0]?.config.grainCount} grains (${searchOutcome.bestCandidates[0]?.metrics.totalImpulse} N·s) strictly yielding the highest feasible total impulse across all evaluated grain counts.`)}
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
                    <span>💡 <strong>{loc('Solución Recomendada:', 'Recommendation:')}</strong> {diag.recommendation}</span>
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
                  {loc('Las 5 Mejores Configuraciones Óptimas (Diversidad Balística)', 'Top 5 Optimal Configurations (Ballistic Diversity)')}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {loc('Haz clic en una opción para ver su curva transitoria y cargarla', 'Click an option to inspect curves and apply it')}
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
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md tabular-nums ${
                            cand.rank === 1 
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            #{cand.rank} {cand.rank === 1 ? (loc('★ ÓPTIMO', '★ BEST')) : ''}
                          </span>
                          <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {cand.metrics.totalImpulse} N·s
                          </span>
                        </div>

                        <div className="text-xs font-bold text-foreground font-mono">
                          {cand.config.grainCount}x L={cand.config.L0}mm · {getGrainShapeLabel(cand.config.shape, t)}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {cand.config.shape === 3
                            ? `D=${cand.config.D0} mm`
                            : cand.config.shape === 6
                              ? `D=${cand.config.D0} / w=${cand.config.slotWidth} / d=${cand.config.slotDepth} mm`
                              : cand.config.shape === 7
                                ? `D=${cand.config.D0} / cut=${cand.config.slotDepth} mm`
                                : cand.config.shape === 5
                                  ? `D=${cand.config.D0} / d=${cand.config.d0} / off=${cand.config.coreOffset} mm`
                                  : cand.config.shape === 8
                                    ? `D=${cand.config.D0} / d=${cand.config.d0} / rod=${cand.config.rodDiameter} mm`
                                    : cand.config.shape === 4
                                      ? `D=${cand.config.D0} / d=${cand.config.d0} / Df=${cand.config.d0mayor} (${cand.config.Np}f)`
                                      : cand.config.shape === 9
                                        ? `D=${cand.config.D0} / d=${cand.config.d0} / Dw=${cand.config.d0mayor} (${cand.config.Np}s)`
                                        : `D=${cand.config.D0} / d=${cand.config.d0}${cand.config.shape === 2 ? ` / Dp=${cand.config.d0mayor} (${cand.config.Np}p)` : ''} mm`}
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
                      {loc(`Candidato #${currentCandidate.rank}`, `Candidate #${currentCandidate.rank}`)}
                    </span>
                    <CardTitle className="text-sm font-bold text-foreground font-mono">
                      {currentCandidate.config.grainSummary}
                    </CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {loc(`Longitud total ocupada: ${currentCandidate.config.totalGrainLength} mm dentro de cámara ${DcVal}x${LcVal} mm (${currentCandidate.metrics.chamberFillFraction}% llenado)`, `Total grain stack: ${currentCandidate.config.totalGrainLength} mm inside ${DcVal}x${LcVal} mm chamber (${currentCandidate.metrics.chamberFillFraction}% filling)`)}
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
                        {loc('¡Cargado en Inputs con éxito!', 'Applied to Inputs!')}
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {loc('Cargar esta Configuración a Inputs', 'Apply to Simulator Inputs')}
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
                        <span>{loc('Impulso Total', 'Total Impulse')}</span>
                        <Zap size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {currentCandidate.metrics.totalImpulse} <span className="text-xs font-normal">N·s</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{loc('Clase:', 'Class:')}</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-bold">{currentCandidate.metrics.motorClass} ({currentCandidate.metrics.isp}s Isp)</strong>
                    </div>
                  </div>

                  {/* Category 2: Empuje y Fuerzas */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{loc('Empuje y Fuerzas', 'Thrust & Forces')}</span>
                        <Flame size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {currentCandidate.metrics.maxThrust} <span className="text-xs font-normal">N (pico)</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{loc('Media / Inicial:', 'Avg / Init:')}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.avgThrust}N / {currentCandidate.metrics.initialThrust}N</strong>
                    </div>
                  </div>

                  {/* Category 3: Presión en Cámara */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{loc('Presión Cámara', 'Chamber Pressure')}</span>
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
                      <span>{loc('P. Media:', 'Avg Pres:')}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.avgPressure} MPa</strong>
                    </div>
                  </div>

                  {/* Category 4: Tiempos de Combustión y Perfil */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{loc('Tiempo de Quemado', 'Burn Time')}</span>
                        <Clock size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {currentCandidate.metrics.burnTime} <span className="text-xs font-normal">s</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{loc('Planitud Perfil:', 'Profile Flatness:')}</span>
                      <strong className="text-foreground">{currentCandidate.metrics.thrustFlatness}%</strong>
                    </div>
                  </div>

                  {/* Category 5: Masa y Ocupación de Cámara */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase font-mono text-muted-foreground flex items-center justify-between">
                        <span>{loc('Masa Propelente', 'Propellant Mass')}</span>
                        <Layers size={13} />
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {(currentCandidate.metrics.propellantMassKg * 1000).toFixed(1)} <span className="text-xs font-normal">g</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between">
                      <span>{loc('Llenado Cámara:', 'Chamber Fill:')}</span>
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
                        <span>{loc('Curvas F(t) y P0(t)', 'F(t) & P0(t) Curves')}</span>
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
                        <span>{loc('Espacio de Soluciones (Pmax vs It)', 'Solution Space Map')}</span>
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
                        <span>{loc('Evolución / Convergencia', 'Convergence History')}</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      {diagramTab === 'curves' && (loc(`${currentCandidate.simulation.t.length} puntos integrados`, `${currentCandidate.simulation.t.length} simulation steps`))}
                      {diagramTab === 'scatter' && (loc(`${scatterPoints.length} motores evaluados`, `${scatterPoints.length} evaluated configurations`))}
                      {diagramTab === 'convergence' && (loc(`${convergenceLineData.length} iteraciones registradas`, `${convergenceLineData.length} iterations tracked`))}
                    </span>
                  </div>

                  {/* TAB 1: Transient Curves */}
                  {diagramTab === 'curves' && (
                    <div className="h-64 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} 
                            unit="s"
                            stroke="var(--muted-foreground)" 
                          />
                          <YAxis 
                            yAxisId="thrust" 
                            orientation="left" 
                            tick={{ fontSize: 10, fill: chartThrustColor }} 
                            unit="N"
                            stroke={chartThrustColor} 
                          />
                          <YAxis 
                            yAxisId="pressure" 
                            orientation="right" 
                            tick={{ fontSize: 10, fill: chartPressureColor }} 
                            unit="MPa"
                            stroke={chartPressureColor} 
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                          <Line 
                            yAxisId="thrust" 
                            type="monotone" 
                            dataKey="F_N" 
                            name={loc('Empuje F (N)', 'Thrust F (N)')} 
                            stroke={chartThrustColor} 
                            strokeWidth={2.5} 
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line 
                            yAxisId="pressure" 
                            type="monotone" 
                            dataKey="P0_MPa" 
                            name={loc('Presión P0 (MPa)', 'Pressure P0 (MPa)')} 
                            stroke={chartPressureColor} 
                            strokeWidth={2} 
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* TAB 2: Ballistic Solution Space (Pmax vs Total Impulse) */}
                  {diagramTab === 'scatter' && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{loc('Diagrama de puntos explorados durante la optimización (Verde = Seguro, Rojo/Naranja = Sobrepresión, Estrella = Candidato Seleccionado)', 'Explored configurations map (Green = Safe, Red = Overpressure, Star = Selected)')}</span>
                      </div>
                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
                            <XAxis 
                              type="number" 
                              dataKey="x" 
                              name={loc("Presión Pico Pmax", "Peak Pressure Pmax")} 
                              unit=" MPa"
                              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                              stroke="var(--muted-foreground)"
                            />
                            <YAxis 
                              type="number" 
                              dataKey="y" 
                              name={loc("Impulso Total It", "Total Impulse It")} 
                              unit=" N·s"
                              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                              stroke="var(--muted-foreground)"
                            />
                            <ZAxis range={[30, 90]} />
                            <ReferenceLine 
                              x={parseFloat(inputValues.Pmax_lim || '6.0')} 
                              stroke="#ef4444" 
                              strokeDasharray="4 4" 
                              label={{ 
                                value: loc(`Límite Pmax (${inputValues.Pmax_lim} MPa)`, `Pmax limit (${inputValues.Pmax_lim} MPa)`), 
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
                                  <div className="p-2.5 rounded-lg border border-border bg-card text-foreground shadow-md text-xs font-mono tabular-nums space-y-1">
                                    <div className="font-bold text-foreground">
                                      {pt.configLabel || `${pt.grainCount}x L=${pt.L0}mm (D=${pt.D0}${pt.d0 > 0 ? ` / d=${pt.d0}` : ''}mm)`}
                                    </div>
                                    <div className="text-primary font-semibold">
                                      {loc('Impulso Total:', 'Total Impulse:')} <strong>{pt.totalImpulse} N·s</strong>
                                    </div>
                                    <div className={pt.maxPressure > parseFloat(inputValues.Pmax_lim || '6.0') ? 'text-red-500' : 'text-foreground'}>
                                      {loc('Presión Máx:', 'Max Pressure:')} <strong>{pt.maxPressure} MPa</strong>
                                    </div>
                                    <div className="text-muted-foreground">
                                      tb: {pt.burnTime}s | Fmax: {pt.maxThrust}N
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Scatter name={loc("Soluciones", "Solutions")} data={scatterPoints}>
                              {scatterPoints.map((entry, index) => {
                                let fillColor = entry.isSafe ? chartThrustColor : '#ef4444';
                                if (entry.isCurrentSelected) fillColor = chartSecondaryColor;
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={fillColor} 
                                    stroke={entry.isCurrentSelected ? 'var(--foreground)' : 'none'}
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
                        <span>{loc('Evolución del mejor score y mejor impulso a lo largo de las evaluaciones del algoritmo genético', 'Evolution of best score and impulse throughout the genetic search iterations')}</span>
                      </div>
                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={convergenceLineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
                            <XAxis 
                              dataKey="iteration" 
                              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} 
                              unit=""
                              stroke="var(--muted-foreground)" 
                            />
                            <YAxis 
                              yAxisId="score" 
                              orientation="left" 
                              tick={{ fontSize: 10, fill: chartSecondaryColor }} 
                              stroke={chartSecondaryColor} 
                            />
                            <YAxis 
                              yAxisId="impulse" 
                              orientation="right" 
                              tick={{ fontSize: 10, fill: chartImpulseColor }} 
                              unit=" N·s"
                              stroke={chartImpulseColor} 
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                            <Line 
                              yAxisId="impulse" 
                              type="monotone" 
                              dataKey="bestImpulse" 
                              name={loc('Mejor Impulso It (N·s)', 'Best Impulse (N·s)')} 
                              stroke={chartImpulseColor} 
                              strokeWidth={2.5} 
                              dot={false} 
                            />
                            <Line 
                              yAxisId="score" 
                              type="monotone" 
                              dataKey="bestScore" 
                              name={loc('Mejor Fitness Score', 'Best Fitness Score')} 
                              stroke={chartSecondaryColor} 
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
