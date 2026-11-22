import {
  BoltGradeId,
  BoltMetricId,
  GrainInput,
  GrainShapeId,
  MotorInput,
  MotorMaterialId,
  NozzleInput,
  SimulationInputs,
  SimulationResults,
  CustomPropellant,
  DEFAULT_PROPELLANTS,
} from './types';
import { calculateMotorStructure } from './motorStructure';
import {
  getGrainModule,
  getGrainShapeLabel,
  getMaxCSlotDepthMm,
  getMaxFinocylWidthMm,
  getMaxMoonburnerOffsetMm,
  getMaxWagonWheelSpokeWidthMm,
  getMinStarValleyDiameterMm,
} from './grains';
import { runSimulation } from './simulator';
import { 
  runDifferentialEvolution, 
  VariableBound, 
  Individual, 
  DeterministicRNG 
} from './differentialEvolution';

export type SmartSearchGoal = 'max_impulse' | 'fast_speed' | 'flat_thrust' | 'progressive' | 'target_impulse';

export type VariableConstraintMode = 'free' | 'fixed' | 'range';

export type OptimizationBudgetPreset = 'fast' | 'standard' | 'deep';

export interface SmartSearchConfig {
  // Evaluation budget / precision
  evaluationsPerN?: number; // Evaluations allocated per grain count N (e.g. 500, 1000, 2000)
  budgetPreset?: OptimizationBudgetPreset;
  randomSeed?: number;

  // Phase 1: Hardware & Chamber Limits & Efficiencies
  Dc: number; // Chamber inner diameter (mm)
  Lc: number; // Chamber usable length (mm)
  Pmax_lim: number; // Maximum allowable safe chamber pressure (MPa)
  etac?: number; // Combustion chamber efficiency (default 0.85)
  Gstar?: number;
  kv?: number;
  Pamb?: number; // Atmospheric pressure (MPa, default 0.101325)
  hasLiner?: boolean; // Optional thermal liner inside casing
  linerThickness?: number; // Radial liner thickness (mm)
  hasInhibitor?: boolean; // Optional grain outer inhibitor sleeve
  inhibitorThickness?: number; // Radial inhibitor thickness (mm)
  wallThickness?: number;
  materialId?: MotorMaterialId;
  customMaterialName?: string;
  customMaterialDensity?: number;
  customMaterialYieldMPa?: number;
  safetyFactor?: number;
  hasBoltedClosure?: boolean;
  boltMetric?: BoltMetricId;
  boltGrade?: BoltGradeId;
  boltCount?: number;
  paso_de_tiempo?: number;
  
  // Fixed Nozzle Data from Phase 1
  Dt0: number; // Throat diameter (mm)
  Ds: number;  // Exit diameter (mm)
  alpha: number; // Divergence angle (deg)
  etanoz?: number; // Nozzle efficiency (default 0.75)
  e?: number; // Throat variation / erosion (mm)
  propellantId: number; // Selected propellant
  
  // Phase 2: Grain Constraints & Free vs Locked variables
  shape: GrainShapeId; // 1: BATES, 2: Star, 3: Solid, 4: Finocyl, 5: Moonburner, 6: C-Slot, 7: D-Grain, 8: Rod & Tube, 9: Wagon Wheel
  grainCountMode: 'range' | 'fixed';
  maxGrainCount: number; // Maximum grain count when mode is 'range' (1 to X)
  fixedGrainCount: number; // Exact grain count when mode is 'fixed'
  
  // Outer Diameter (D0)
  modeD0?: VariableConstraintMode;
  lockD0?: boolean;
  valD0?: number; // Grain outer diameter when fixed
  minD0?: number; // Minimum D0 when range
  maxD0?: number; // Maximum D0 when range
  
  // Core Diameter / Star Inner Tip Diameter / Tube Inner Diameter (d0)
  moded0?: VariableConstraintMode;
  lockd0?: boolean;
  vald0?: number; // Grain core diameter when fixed
  mind0?: number; // Minimum d0 when range
  maxd0?: number; // Maximum d0 when range

  // Outer Radial Feature Diameter (d0mayor: Star valley / Finocyl tip / Wagon Wheel window) - active when shape is 2, 4, or 9
  moded0mayor?: VariableConstraintMode;
  vald0mayor?: number;
  mind0mayor?: number;
  maxd0mayor?: number;

  // Radial Feature Count (Np: Star points / Finocyl fins / Wagon Wheel spokes) - active when shape is 2, 4, or 9
  modeNp?: VariableConstraintMode;
  valNp?: number;
  minNp?: number;
  maxNp?: number;

  // Finocyl Fin Slot Width (shape === 4)
  modeFinWidth?: VariableConstraintMode;
  valFinWidth?: number;
  minFinWidth?: number;
  maxFinWidth?: number;

  // Wagon Wheel Spoke Width (shape === 9)
  modeSpokeWidth?: VariableConstraintMode;
  valSpokeWidth?: number;
  minSpokeWidth?: number;
  maxSpokeWidth?: number;

  // Moonburner Core Offset (shape === 5)
  modeCoreOffset?: VariableConstraintMode;
  valCoreOffset?: number;
  minCoreOffset?: number;
  maxCoreOffset?: number;

  // C-Slot Width (shape === 6)
  modeSlotWidth?: VariableConstraintMode;
  valSlotWidth?: number;
  minSlotWidth?: number;
  maxSlotWidth?: number;

  // C-Slot / D-Grain Cut Depth (shape === 6 or 7)
  modeSlotDepth?: VariableConstraintMode;
  valSlotDepth?: number;
  minSlotDepth?: number;
  maxSlotDepth?: number;

  // Rod & Tube Central Rod Diameter (shape === 8)
  modeRodDiameter?: VariableConstraintMode;
  valRodDiameter?: number;
  minRodDiameter?: number;
  maxRodDiameter?: number;
  
  // Grain Length (L0)
  modeL0?: VariableConstraintMode;
  lockL0?: boolean;
  valL0?: number; // Grain segment length when fixed
  minL0?: number; // Minimum L0 when range
  maxL0?: number; // Maximum L0 when range

  // Total Propellant Mass Constraint (Mprop)
  modeMprop?: VariableConstraintMode;
  valMprop?: number; // Total propellant mass when fixed (g)
  minMprop?: number; // Minimum propellant mass (g)
  maxMprop?: number; // Maximum propellant mass (g)
  
  // Burn Surfaces: 1 = Burns (active), 0 = Inhibited
  osi: number; // Outer surface
  ci: number;  // Core
  ei: number;  // Ends
  
  // Phase 3: Mission Goal
  goal: SmartSearchGoal;
  targetAltitudeVal?: number; // Target Apogee in meters
  rocketDryMassKg?: number;   // Rocket dry mass in kg
  targetImpulseVal?: number;
  customPropellants?: CustomPropellant[];

  // Cancellation support
  shouldStop?: () => boolean;

  // Legacy field support for backward compatibility with old UI state
  searchPrecision?: string;
}

export interface CandidateResult {
  id: string;
  rank: number;
  config: {
    grainCount: number;
    D0: number;
    d0: number;
    d0mayor: number;
    Np: number;
    L0: number;
    totalGrainLength: number;
    shape: GrainShapeId;
    finWidth?: number;
    spokeWidth?: number;
    coreOffset?: number;
    slotWidth?: number;
    slotDepth?: number;
    rodDiameter?: number;
    Dt0: number;
    Ds: number;
    propellantId: number;
    propellantName: string;
    grainSummary: string;
    osi: number;
    ci: number;
    ei: number;
  };
  simulation: SimulationResults;
  score: number;
  isSafe: boolean;
  metrics: {
    totalImpulse: number;
    maxPressure: number;
    avgPressure: number;
    maxThrust: number;
    avgThrust: number;
    initialThrust: number;
    burnTime: number;
    actionTime: number;
    isp: number;
    motorClass: string;
    thrustFlatness: number; // Ratio Fmed / Fmax (100% is perfectly flat)
    chamberFillFraction: number; // Total grain length / Lc (100% is full)
    propellantMassKg: number;
    propellantMassGrams?: number;
    predictedApogeeMeters?: number;
  };
  inputs: SimulationInputs;
}

export interface EvaluatedPoint {
  id: string;
  order: number;
  totalImpulse: number;
  maxPressure: number;
  avgPressure: number;
  burnTime: number;
  maxThrust: number;
  avgThrust: number;
  initialThrust: number;
  grainCount: number;
  shape: GrainShapeId;
  D0: number;
  d0: number;
  d0mayor: number;
  Np: number;
  L0: number;
  finWidth?: number;
  spokeWidth?: number;
  coreOffset?: number;
  slotWidth?: number;
  slotDepth?: number;
  rodDiameter?: number;
  isSafe: boolean;
  score: number;
  bestScoreSoFar: number;
  configLabel: string;
}

export interface GrainCountEvaluationSummary {
  N: number;
  bestFeasibleImpulse: number | null;
  evaluations: number;
  isFeasible: boolean;
  bestConfigLabel?: string;
}

export interface DiagnosticDetail {
  code: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface SmartSearchOutcome {
  bestCandidates: CandidateResult[];
  allEvaluatedPoints: EvaluatedPoint[];
  convergenceHistory: Array<{
    iteration: number;
    score: number;
    bestScore: number;
    candidateLabel: string;
    totalImpulse: number;
    maxPressure: number;
  }>;
  totalEvaluated: number;
  viableCount: number;
  safeCount: number;
  executionTimeMs: number;
  hasOverpressureWarning: boolean;
  message?: string;
  algorithmUsed: string;
  grainSummaries?: GrainCountEvaluationSummary[];
  diagnostics?: DiagnosticDetail[];
  isCancelled?: boolean;
}

export interface OptimizationProgress {
  phase?: string;
  stepDescription?: string;
  currentEvaluations?: number;
  totalEstimated?: number;
  percent?: number;
  elapsedMs?: number;
  elapsedSeconds?: number;
  bestScoreSoFar?: number;
  bestConfigSummary?: string;
  statusText?: string;
  currentN?: number;
  totalN?: number;
  generation?: number;
  maxGenerations?: number;
}

/**
 * Compact candidate evaluation record to avoid storing large simulation arrays in memory
 */
interface CompactEvaluation {
  isFeasible: boolean;
  constraintViolation: number;
  objective: number;
  metrics: {
    totalImpulse: number;
    maxPressure: number;
    avgPressure: number;
    maxThrust: number;
    avgThrust: number;
    initialThrust: number;
    burnTime: number;
    actionTime: number;
    isp: number;
    motorClass: string;
    thrustFlatness: number;
    chamberFillFraction: number;
    propellantMassKg: number;
    propellantMassGrams: number;
    predictedApogeeMeters: number;
  };
  N: number;
  D0: number;
  d0: number;
  d0mayor: number;
  Np: number;
  L0: number;
  finWidth?: number;
  spokeWidth?: number;
  coreOffset?: number;
  slotWidth?: number;
  slotDepth?: number;
  rodDiameter?: number;
}

function buildOptimizerMotorInput(config: SmartSearchConfig, dtOverride?: number): MotorInput {
  return {
    Dc: config.Dc,
    Lc: config.Lc,
    Gstar: config.Gstar !== undefined ? config.Gstar : 1.0,
    kv: config.kv !== undefined ? config.kv : 0.1,
    etac: config.etac !== undefined ? config.etac : 0.85,
    paso_de_tiempo: dtOverride ?? 0.005,
    Pamb: config.Pamb !== undefined ? config.Pamb : 0.101325,
    hasLiner: Boolean(config.hasLiner),
    linerThickness: config.linerThickness !== undefined ? config.linerThickness : 2.0,
    hasInhibitor: Boolean(config.hasInhibitor),
    inhibitorThickness: config.inhibitorThickness !== undefined ? config.inhibitorThickness : 2.0,
    wallThickness: config.wallThickness,
    materialId: config.materialId,
    customMaterialName: config.customMaterialName,
    customMaterialDensity: config.customMaterialDensity,
    customMaterialYieldMPa: config.customMaterialYieldMPa,
    safetyFactor: config.safetyFactor,
    hasBoltedClosure: config.hasBoltedClosure,
    boltMetric: config.boltMetric,
    boltGrade: config.boltGrade,
    boltCount: config.boltCount,
  };
}

function getAvailableGrainDiameterMm(config: SmartSearchConfig): number {
  const motorStruct = calculateMotorStructure(buildOptimizerMotorInput(config));
  return motorStruct.availableGrainDiameterMm;
}

/**
 * Suborbital 1D ballistic apogee estimation for rocket flight info
 */
function estimateApogee(
  Dc: number,
  Fmed: number,
  tb: number,
  propMassKg: number,
  rocketDryMassKg: number = 1.5
): number {
  const dryMassKg = Math.max(0.2, rocketDryMassKg);
  const avgFlightMassKg = dryMassKg + 0.5 * propMassKg;
  const rocketDiamM = Math.max(0.05, (Dc * 1.15) / 1000);
  const dragArea = Math.PI * Math.pow(rocketDiamM / 2, 2);
  const Cd = 0.45;
  const g = 9.80665;
  const avgNetAccel = Math.max(0, (Fmed / avgFlightMassKg) - g);
  const burnoutVel = avgNetAccel * tb * 0.94; // approx aerodynamic drag loss during boost
  const burnoutAlt = 0.5 * avgNetAccel * Math.pow(tb, 2);
  const dragFactor = (0.5 * 1.225 * burnoutVel * Cd * dragArea) / dryMassKg;
  const coastAlt = Math.pow(burnoutVel, 2) / (2 * g * (1 + dragFactor));
  return Math.max(0, Math.round(burnoutAlt + coastAlt));
}

interface ExtraShapeParams {
  finWidth: number;
  spokeWidth: number;
  coreOffset: number;
  slotWidth: number;
  slotDepth: number;
  rodDiameter: number;
}

function shapeUsesCorePort(shape: GrainShapeId): boolean {
  return shape === 1 || shape === 2 || shape === 4 || shape === 5 || shape === 8 || shape === 9;
}

function shapeUsesD0MayorAndNp(shape: GrainShapeId): boolean {
  return shape === 2 || shape === 4 || shape === 9;
}

function buildGrainInputForShape(
  shape: GrainShapeId,
  propellantId: number,
  N: number,
  D0: number,
  d0: number,
  d0mayor: number,
  L0: number,
  Np: number,
  extra: ExtraShapeParams,
  osi: number,
  ci: number,
  ei: number
): GrainInput {
  const usesCore = shapeUsesCorePort(shape);
  const usesRadial = shapeUsesD0MayorAndNp(shape);
  const effectiveNp =
    shape === 4 ? Math.max(2, Math.round(Np || 6)) : usesRadial ? Math.max(3, Math.round(Np || 5)) : 0;

  return {
    id: '1',
    shape,
    propellantType: propellantId,
    D0,
    d0: usesCore ? d0 : 0,
    d0mayor: usesRadial ? d0mayor : 0,
    L0,
    N,
    Np: effectiveNp,
    osi,
    ci: shape === 3 ? 0 : ci,
    ei,
    rhorat: 1.0,
    ...(shape === 4 ? { finWidth: extra.finWidth } : {}),
    ...(shape === 9 ? { spokeWidth: extra.spokeWidth } : {}),
    ...(shape === 5 ? { coreOffset: extra.coreOffset } : {}),
    ...(shape === 6 ? { slotWidth: extra.slotWidth, slotDepth: extra.slotDepth } : {}),
    ...(shape === 7 ? { slotDepth: extra.slotDepth } : {}),
    ...(shape === 8 ? { rodDiameter: extra.rodDiameter } : {}),
  };
}

function formatCompactGrainLabel(
  shape: GrainShapeId,
  N: number,
  D0: number,
  d0: number,
  d0mayor: number,
  L0: number,
  Np: number,
  extra: ExtraShapeParams
): string {
  switch (shape) {
    case 2:
      return `N=${N} D0=${D0} d0=${d0} Dp=${d0mayor} Np=${Np} L0=${L0}`;
    case 3:
      return `N=${N} D0=${D0} L0=${L0}`;
    case 4:
      return `N=${N} D0=${D0} d0=${d0} Df=${d0mayor} ${Np}f wf=${extra.finWidth} L0=${L0}`;
    case 5:
      return `N=${N} D0=${D0} d0=${d0} off=${extra.coreOffset} L0=${L0}`;
    case 6:
      return `N=${N} D0=${D0} w=${extra.slotWidth} depth=${extra.slotDepth} L0=${L0}`;
    case 7:
      return `N=${N} D0=${D0} cut=${extra.slotDepth} L0=${L0}`;
    case 8:
      return `N=${N} D0=${D0} d0=${d0} rod=${extra.rodDiameter} L0=${L0}`;
    case 9:
      return `N=${N} D0=${D0} d0=${d0} Dw=${d0mayor} ${Np}s ws=${extra.spokeWidth} L0=${L0}`;
    case 1:
    default:
      return `N=${N} D0=${D0} d0=${d0} L0=${L0}`;
  }
}

function formatCandidateSummary(
  shape: GrainShapeId,
  N: number,
  D0: number,
  d0: number,
  d0mayor: number,
  L0: number,
  Np: number,
  extra: ExtraShapeParams
): string {
  const label = getGrainShapeLabel(shape);
  switch (shape) {
    case 2:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, Dp=${d0mayor.toFixed(1)}, Np=${Np}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 3:
      return `${N}x [D0=${D0.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 4:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, Df=${d0mayor.toFixed(1)}, ${Np}f, wf=${extra.finWidth.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 5:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, off=${extra.coreOffset.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 6:
      return `${N}x [D0=${D0.toFixed(1)}, w=${extra.slotWidth.toFixed(1)}, depth=${extra.slotDepth.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 7:
      return `${N}x [D0=${D0.toFixed(1)}, cut=${extra.slotDepth.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 8:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, rod=${extra.rodDiameter.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 9:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, Dw=${d0mayor.toFixed(1)}, ${Np}s, ws=${extra.spokeWidth.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
    case 1:
    default:
      return `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${label}`;
  }
}

/**
 * Centralized simulation and constraint evaluator.
 * Follows strict physical equations from the HERMES simulator.
 */
function evaluateGeometry(
  N: number,
  D0: number,
  d0: number,
  d0mayor: number,
  L0: number,
  Np: number,
  extra: ExtraShapeParams,
  config: SmartSearchConfig,
  customProps: CustomPropellant[],
  availableD0: number
): {
  isFeasible: boolean;
  constraintViolation: number;
  objective: number;
  metrics: CompactEvaluation['metrics'] | null;
} {
  const Dc = config.Dc;
  const Lc = config.Lc;
  const Pmax_lim = config.Pmax_lim;
  const shape = config.shape;
  const usesCore = shapeUsesCorePort(shape);
  const usesRadial = shapeUsesD0MayorAndNp(shape);
  const rawRoundNp = usesRadial ? Math.round(Np) : 0;
  const minNpRequired = shape === 4 ? 2 : 3;
  const roundNp = usesRadial ? Math.max(minNpRequired, rawRoundNp || 0) : 0;

  if (availableD0 <= 0) {
    return {
      isFeasible: false,
      constraintViolation: 1000,
      objective: -1000,
      metrics: null
    };
  }

  // 1. Geometrical feasibility checks
  let geomViolation = 0;

  // Chamber length constraint: N * L0 <= Lc
  if (L0 * N > Lc) {
    geomViolation += Math.pow((L0 * N - Lc) / Lc, 2) * 100 + ((L0 * N - Lc) / Lc) * 10;
  }
  // Chamber + liner + inhibitor radial clearance constraint: D0 <= availableD0
  const maxAllowedD0 = (config.hasLiner || config.hasInhibitor)
    ? availableD0
    : Math.max(10, availableD0 - 0.1);
  if (D0 > maxAllowedD0 + 1e-6) {
    const overFrac = (D0 - maxAllowedD0) / Math.max(1, availableD0);
    geomViolation += Math.pow(overFrac, 2) * 120 + overFrac * 15;
  }
  // Minimal length
  if (L0 < 5) {
    geomViolation += Math.pow((5 - L0) / 5, 2) * 50;
  }
  // Minimal diameter
  if (D0 < 10) {
    geomViolation += Math.pow((10 - D0) / 10, 2) * 50;
  }

  // Core diameter checks for core-bearing shapes (1, 2, 4, 5, 8, 9)
  if (usesCore) {
    const minWeb = shape === 8 ? 1.5 : 2.0;
    if (d0 > D0 - 2 * minWeb) {
      geomViolation += Math.pow((d0 - (D0 - 2 * minWeb)) / Math.max(1, D0), 2) * 100 + 2;
    }
    if (d0 < 3.0) {
      geomViolation += Math.pow((3.0 - d0) / 3.0, 2) * 50 + 2;
    }

    // Star grain checks (shape === 2)
    if (shape === 2) {
      if (rawRoundNp < 3) {
        geomViolation += 50;
      } else {
        const minStarGeomDp = getMinStarValleyDiameterMm(d0, rawRoundNp);
        const desiredArmDp = Math.max(minStarGeomDp * 1.15, minStarGeomDp + 1.5);
        const moded0mayor = config.moded0mayor || 'free';
        const effectiveMinDp =
          moded0mayor === 'fixed'
            ? minStarGeomDp
            : moded0mayor === 'range' && config.maxd0mayor !== undefined && config.maxd0mayor > minStarGeomDp
              ? Math.max(minStarGeomDp + 0.05, Math.min(config.maxd0mayor - 0.05, desiredArmDp))
              : desiredArmDp;

        if (d0mayor <= minStarGeomDp + 1e-6) {
          const deficitFrac = (minStarGeomDp - d0mayor + 0.5) / Math.max(1, minStarGeomDp);
          geomViolation += Math.pow(deficitFrac, 2) * 140 + deficitFrac * 20 + 5;
        } else if (d0mayor < effectiveMinDp) {
          const deficitFrac = (effectiveMinDp - d0mayor) / Math.max(1, effectiveMinDp);
          geomViolation += Math.pow(deficitFrac, 2) * 100 + deficitFrac * 10 + 2;
        }
      }
      if (d0mayor >= D0 - 0.5) {
        const overFrac = (d0mayor - (D0 - 0.5)) / Math.max(1, D0);
        geomViolation += Math.pow(overFrac, 2) * 100 + overFrac * 10 + 2;
      }
    }

    // Finocyl checks (shape === 4)
    if (shape === 4) {
      if (rawRoundNp < 2) {
        geomViolation += 50;
      }
      const minTipDia = d0 + 1.0;
      if (d0mayor <= minTipDia) {
        const def = (minTipDia - d0mayor + 0.5) / Math.max(1, d0);
        geomViolation += Math.pow(def, 2) * 120 + def * 15 + 3;
      }
      if (d0mayor >= D0 - 0.8) {
        const over = (d0mayor - (D0 - 0.8)) / Math.max(1, D0);
        geomViolation += Math.pow(over, 2) * 100 + over * 15 + 3;
      }
      const maxFinW = getMaxFinocylWidthMm(d0, roundNp);
      if (extra.finWidth <= 0.4) {
        geomViolation += Math.pow((0.5 - extra.finWidth) / 0.5, 2) * 60 + 2;
      } else if (extra.finWidth >= maxFinW - 0.15) {
        const overW = (extra.finWidth - (maxFinW - 0.15)) / Math.max(0.5, maxFinW);
        geomViolation += Math.pow(overW, 2) * 120 + overW * 15 + 4;
      }
    }

    // Moonburner checks (shape === 5)
    if (shape === 5) {
      const maxOff = getMaxMoonburnerOffsetMm(D0, d0);
      if (extra.coreOffset < 0) {
        geomViolation += Math.abs(extra.coreOffset) * 20 + 5;
      } else if (extra.coreOffset >= maxOff - 0.5) {
        const overOff = (extra.coreOffset - (maxOff - 0.5)) / Math.max(0.5, maxOff);
        geomViolation += Math.pow(overOff, 2) * 120 + overOff * 15 + 4;
      }
    }

    // Rod & Tube checks (shape === 8)
    if (shape === 8) {
      const maxRod = d0 - 1.2;
      if (extra.rodDiameter < 1.0) {
        geomViolation += Math.pow((1.0 - extra.rodDiameter), 2) * 60 + 3;
      } else if (extra.rodDiameter >= maxRod) {
        const overRod = (extra.rodDiameter - maxRod) / Math.max(1, d0);
        geomViolation += Math.pow(overRod, 2) * 130 + overRod * 20 + 5;
      }
    }

    // Wagon Wheel checks (shape === 9)
    if (shape === 9) {
      if (rawRoundNp < 3) {
        geomViolation += 50;
      }
      const minWinDia = d0 + 1.5;
      if (d0mayor <= minWinDia) {
        const def = (minWinDia - d0mayor + 0.5) / Math.max(1, d0);
        geomViolation += Math.pow(def, 2) * 120 + def * 15 + 3;
      }
      if (d0mayor >= D0 - 0.8) {
        const over = (d0mayor - (D0 - 0.8)) / Math.max(1, D0);
        geomViolation += Math.pow(over, 2) * 100 + over * 15 + 3;
      }
      const maxSpokeW = getMaxWagonWheelSpokeWidthMm(d0, roundNp);
      if (extra.spokeWidth <= 0.4) {
        geomViolation += Math.pow((0.5 - extra.spokeWidth) / 0.5, 2) * 60 + 2;
      } else if (extra.spokeWidth >= maxSpokeW - 0.15) {
        const overW = (extra.spokeWidth - (maxSpokeW - 0.15)) / Math.max(0.5, maxSpokeW);
        geomViolation += Math.pow(overW, 2) * 120 + overW * 15 + 4;
      }
    }
  }

  // C-Slot checks (shape === 6)
  if (shape === 6) {
    if (extra.slotWidth <= 0.5) {
      geomViolation += Math.pow((0.5 - extra.slotWidth), 2) * 60 + 3;
    } else if (extra.slotWidth >= D0 - 2.0) {
      const overW = (extra.slotWidth - (D0 - 2.0)) / Math.max(1, D0);
      geomViolation += Math.pow(overW, 2) * 120 + overW * 15 + 4;
    }
    const maxSlotD = getMaxCSlotDepthMm(D0, extra.slotWidth);
    if (extra.slotDepth <= 0.8) {
      geomViolation += Math.pow((0.8 - extra.slotDepth), 2) * 60 + 3;
    } else if (extra.slotDepth >= maxSlotD - 0.8) {
      const overD = (extra.slotDepth - (maxSlotD - 0.8)) / Math.max(1, maxSlotD);
      geomViolation += Math.pow(overD, 2) * 130 + overD * 20 + 5;
    }
  }

  // D-Grain checks (shape === 7)
  if (shape === 7) {
    if (extra.slotDepth <= 0.8) {
      geomViolation += Math.pow((0.8 - extra.slotDepth), 2) * 60 + 3;
    } else if (extra.slotDepth >= D0 - 2.0) {
      const overD = (extra.slotDepth - (D0 - 2.0)) / Math.max(1, D0);
      geomViolation += Math.pow(overD, 2) * 130 + overD * 20 + 5;
    }
  }

  // If geometric constraints are violated, abort before calling simulator
  if (geomViolation > 0) {
    return {
      isFeasible: false,
      constraintViolation: geomViolation + 10,
      objective: -geomViolation,
      metrics: null
    };
  }

  // 2. Build full simulator inputs and cross-check module validation
  const simMotor: MotorInput = buildOptimizerMotorInput(config);

  const simNozzle: NozzleInput = {
    Dt0: config.Dt0,
    Ds: config.Ds,
    e: config.e !== undefined ? config.e : 0,
    alpha: config.alpha || 15,
    etanoz: config.etanoz !== undefined ? config.etanoz : 0.75
  };

  const simGrain = buildGrainInputForShape(
    shape,
    config.propellantId,
    N,
    D0,
    d0,
    d0mayor,
    L0,
    roundNp,
    extra,
    config.osi,
    config.ci,
    config.ei
  );

  const checks = getGrainModule(shape).validate(simGrain, { Dc, Lc }, availableD0);
  if (
    checks.isD0Invalid ||
    checks.isD0ExceedsClearance ||
    checks.isL0Invalid ||
    checks.isGrainLengthExceedsLc ||
    checks.isNInvalid ||
    checks.isd0Invalid ||
    checks.isd0ExceedsD0 ||
    checks.hasStarError ||
    checks.hasShapeGeometryError
  ) {
    return {
      isFeasible: false,
      constraintViolation: 25,
      objective: -25,
      metrics: null
    };
  }

  const simGrains: GrainInput[] = [simGrain];

  const simInputs: SimulationInputs = {
    motor: simMotor,
    grains: simGrains,
    nozzle: simNozzle,
    customPropellants: customProps,
    geometryQuality: 'fast',
  };

  // 3. Execute original simulator
  try {
    const simResult = runSimulation(simInputs);
    if (!simResult || !simResult.summary || simResult.summary.t_quemado <= 0) {
      return {
        isFeasible: false,
        constraintViolation: 1000,
        objective: -1000,
        metrics: null
      };
    }

    const summary = simResult.summary;
    const Pmax = summary.Pmax_MPa;
    const It = summary.It_total_N_s;
    const Fmax = summary.Fmax_N;
    const Fmed = summary.Fmed_N;
    const tb = summary.t_quemado;
    const isp = summary.Isp_total_s;
    const propMassKg = (summary.initial_mass_g && summary.initial_mass_g > 0)
      ? summary.initial_mass_g / 1000
      : (simResult.mgra_total && simResult.mgra_total[0] ? simResult.mgra_total[0] / 1000 : 0.2);
    const propMassGrams = propMassKg * 1000;

    const thrustFlatness = Fmax > 0 ? (Fmed / Fmax) : 0;
    const fillFraction = (N * L0) / Lc;
    const initialF = simResult.F_N[1] || simResult.F_N[0] || Fmed;
    const predictedApogeeMeters = estimateApogee(Dc, Fmed, tb, propMassKg, config.rocketDryMassKg);

    // 4. Physical constraint violations
    let constraintViolation = 0;

    // Hard pressure constraint: Pmax <= Pmax_lim
    if (Pmax > Pmax_lim) {
      const overFrac = (Pmax - Pmax_lim) / Pmax_lim;
      constraintViolation += Math.pow(overFrac, 2) * 200 + overFrac * 50;
    }

    // Minimum pressure / Chuffing constraint: Pmax >= 0.4 MPa
    if (Pmax < 0.4) {
      const underFrac = (0.4 - Pmax) / 0.4;
      constraintViolation += Math.pow(underFrac, 2) * 150 + underFrac * 30;
    }

    // Propellant mass constraint
    if (config.modeMprop === 'fixed' && config.valMprop && config.valMprop > 0) {
      const targetM = config.valMprop;
      const diffM = Math.abs(propMassGrams - targetM);
      const fracM = diffM / targetM;
      if (fracM > 0.015) { // 1.5% tolerance
        constraintViolation += Math.pow(fracM - 0.015, 2) * 100 + fracM * 20;
      }
    } else if (config.modeMprop === 'range') {
      const minM = config.minMprop !== undefined ? config.minMprop : 0;
      const maxM = config.maxMprop !== undefined ? config.maxMprop : Infinity;
      if (propMassGrams < minM && minM > 0) {
        const underM = (minM - propMassGrams) / minM;
        constraintViolation += Math.pow(underM, 2) * 100 + underM * 20;
      } else if (propMassGrams > maxM && maxM < Infinity) {
        const overM = (propMassGrams - maxM) / maxM;
        constraintViolation += Math.pow(overM, 2) * 100 + overM * 20;
      }
    }

    const isFeasible = constraintViolation <= 1e-6 && Pmax <= Pmax_lim && Pmax >= 0.4;

    // 5. Canonical objective calculation
    let objective = 0;

    switch (config.goal) {
      case 'max_impulse': {
        // STRICT TOTAL IMPULSE: Maximize actual It_total_N_s from the simulator.
        // No artificial weighted scores or arbitrary multipliers!
        objective = It;
        break;
      }
      case 'fast_speed': {
        // High initial thrust with early peak and regressive tail
        const peakIdx = simResult.F_N.indexOf(Fmax);
        const peakFrac = peakIdx >= 0 ? peakIdx / Math.max(1, simResult.F_N.length) : 0;
        const earlyPeakBonus = peakFrac <= 0.20 ? (1.0 - peakFrac * 2.5) : -Math.pow(peakFrac - 0.20, 2) * 50;
        const initialThrustRatio = Fmax > 0 ? (initialF / Fmax) : 0.5;
        const endF = simResult.F_N[Math.floor(simResult.F_N.length * 0.85)] || (Fmed * 0.5);
        const regressiveBonus = Math.max(0, (initialF - endF) / Math.max(1, Fmed));
        objective = (initialF * 2.0 + Fmax) * (1 + 0.3 * initialThrustRatio + 0.3 * regressiveBonus + 0.2 * Math.max(0, earlyPeakBonus));
        break;
      }
      case 'flat_thrust': {
        // Neutral burning: thrust flatness (Fmed / Fmax) combined with impulse
        objective = It * Math.pow(thrustFlatness, 1.5);
        break;
      }
      case 'progressive': {
        // Progressive ramp
        const midF = simResult.F_N[Math.floor(simResult.F_N.length * 0.75)] || Fmed;
        const progressivity = Math.max(0, (midF - initialF) / Math.max(1, Fmed));
        objective = It * (1 + 2.0 * progressivity);
        break;
      }
      case 'target_impulse': {
        // Closeness to target impulse
        const targetIt = config.targetImpulseVal || 250;
        const diffIt = Math.abs(It - targetIt);
        objective = -diffIt;
        break;
      }
      default: {
        objective = It;
        break;
      }
    }

    const metrics: CompactEvaluation['metrics'] = {
      totalImpulse: parseFloat(It.toFixed(1)),
      maxPressure: parseFloat(Pmax.toFixed(2)),
      avgPressure: parseFloat(summary.Pmed_MPa.toFixed(2)),
      maxThrust: parseFloat(Fmax.toFixed(1)),
      avgThrust: parseFloat(Fmed.toFixed(1)),
      initialThrust: parseFloat(initialF.toFixed(1)),
      burnTime: parseFloat(tb.toFixed(2)),
      actionTime: parseFloat((tb * 1.04).toFixed(2)),
      isp: parseFloat(isp.toFixed(1)),
      motorClass: summary.motorClass || 'N/A',
      thrustFlatness: parseFloat((thrustFlatness * 100).toFixed(0)),
      chamberFillFraction: parseFloat((fillFraction * 100).toFixed(0)),
      propellantMassKg: parseFloat(propMassKg.toFixed(3)),
      propellantMassGrams: parseFloat(propMassGrams.toFixed(1)),
      predictedApogeeMeters
    };

    return {
      isFeasible,
      constraintViolation,
      objective,
      metrics
    };
  } catch (err) {
    return {
      isFeasible: false,
      constraintViolation: 1000,
      objective: -1000,
      metrics: null
    };
  }
}

/**
 * Builds full SimulationResults and CandidateResult for top selected candidates
 */
function buildFullCandidateResult(
  id: string,
  rank: number,
  N: number,
  D0: number,
  d0: number,
  d0mayor: number,
  L0: number,
  Np: number,
  extra: ExtraShapeParams,
  config: SmartSearchConfig,
  customProps: CustomPropellant[],
  allPropellants: CustomPropellant[]
): CandidateResult {
  const propObj = allPropellants.find(p => p.id === config.propellantId) || allPropellants[0];
  const shape = config.shape;
  const usesRadial = shapeUsesD0MayorAndNp(shape);
  const roundNp = shape === 4 ? Math.max(2, Math.round(Np || 6)) : usesRadial ? Math.max(3, Math.round(Np || 5)) : 0;
  const effectiveD0mayor = usesRadial ? d0mayor : 0;
  const effectiveD0 = shapeUsesCorePort(shape) ? d0 : 0;

  const simMotor: MotorInput = buildOptimizerMotorInput(config, config.paso_de_tiempo || 0.0005);

  const simNozzle: NozzleInput = {
    Dt0: config.Dt0,
    Ds: config.Ds,
    e: config.e !== undefined ? config.e : 0,
    alpha: config.alpha || 15,
    etanoz: config.etanoz !== undefined ? config.etanoz : 0.75
  };

  const simGrain = buildGrainInputForShape(
    shape,
    config.propellantId,
    N,
    D0,
    effectiveD0,
    effectiveD0mayor,
    L0,
    roundNp,
    extra,
    config.osi,
    config.ci,
    config.ei
  );

  const simInputs: SimulationInputs = {
    motor: simMotor,
    grains: [simGrain],
    nozzle: simNozzle,
    customPropellants: customProps,
    geometryQuality: 'high',
  };

  const simResult = runSimulation(simInputs);
  const summary = simResult.summary;
  const Pmax = summary.Pmax_MPa;
  const It = summary.It_total_N_s;
  const Fmax = summary.Fmax_N;
  const Fmed = summary.Fmed_N;
  const tb = summary.t_quemado;
  const isp = summary.Isp_total_s;
  const propMassKg = (summary.initial_mass_g && summary.initial_mass_g > 0)
    ? summary.initial_mass_g / 1000
    : (simResult.mgra_total && simResult.mgra_total[0] ? simResult.mgra_total[0] / 1000 : 0.2);
  const propMassGrams = propMassKg * 1000;

  const thrustFlatness = Fmax > 0 ? (Fmed / Fmax) : 0;
  const fillFraction = (N * L0) / config.Lc;
  const initialF = simResult.F_N[1] || simResult.F_N[0] || Fmed;
  const predictedApogeeMeters = estimateApogee(config.Dc, Fmed, tb, propMassKg, config.rocketDryMassKg);

  const grainSummary = formatCandidateSummary(
    shape,
    N,
    D0,
    effectiveD0,
    effectiveD0mayor,
    L0,
    roundNp,
    extra
  );

  const isSafe = Pmax <= config.Pmax_lim && Pmax >= 0.4;

  return {
    id,
    rank,
    config: {
      grainCount: N,
      D0: parseFloat(D0.toFixed(1)),
      d0: parseFloat(effectiveD0.toFixed(1)),
      d0mayor: parseFloat(effectiveD0mayor.toFixed(1)),
      Np: roundNp,
      L0: parseFloat(L0.toFixed(1)),
      totalGrainLength: parseFloat((N * L0).toFixed(1)),
      shape,
      ...(shape === 4 ? { finWidth: parseFloat(extra.finWidth.toFixed(1)) } : {}),
      ...(shape === 9 ? { spokeWidth: parseFloat(extra.spokeWidth.toFixed(1)) } : {}),
      ...(shape === 5 ? { coreOffset: parseFloat(extra.coreOffset.toFixed(1)) } : {}),
      ...(shape === 6 ? { slotWidth: parseFloat(extra.slotWidth.toFixed(1)), slotDepth: parseFloat(extra.slotDepth.toFixed(1)) } : {}),
      ...(shape === 7 ? { slotDepth: parseFloat(extra.slotDepth.toFixed(1)) } : {}),
      ...(shape === 8 ? { rodDiameter: parseFloat(extra.rodDiameter.toFixed(1)) } : {}),
      Dt0: config.Dt0,
      Ds: config.Ds,
      propellantId: config.propellantId,
      propellantName: propObj.name,
      grainSummary,
      osi: config.osi,
      ci: shape === 3 ? 0 : config.ci,
      ei: config.ei
    },
    simulation: simResult,
    score: parseFloat(It.toFixed(1)),
    isSafe,
    metrics: {
      totalImpulse: parseFloat(It.toFixed(1)),
      maxPressure: parseFloat(Pmax.toFixed(2)),
      avgPressure: parseFloat(summary.Pmed_MPa.toFixed(2)),
      maxThrust: parseFloat(Fmax.toFixed(1)),
      avgThrust: parseFloat(Fmed.toFixed(1)),
      initialThrust: parseFloat(initialF.toFixed(1)),
      burnTime: parseFloat(tb.toFixed(2)),
      actionTime: parseFloat((tb * 1.04).toFixed(2)),
      isp: parseFloat(isp.toFixed(1)),
      motorClass: summary.motorClass || 'N/A',
      thrustFlatness: parseFloat((thrustFlatness * 100).toFixed(0)),
      chamberFillFraction: parseFloat((fillFraction * 100).toFixed(0)),
      propellantMassKg: parseFloat(propMassKg.toFixed(3)),
      propellantMassGrams: parseFloat(propMassGrams.toFixed(1)),
      predictedApogeeMeters
    },
    inputs: simInputs
  };
}

type ActiveVarName =
  | 'D0'
  | 'd0'
  | 'd0mayor'
  | 'L0'
  | 'Np'
  | 'finWidth'
  | 'spokeWidth'
  | 'coreOffset'
  | 'slotWidth'
  | 'slotDepth'
  | 'rodDiameter';

interface FixedValuesMap {
  D0?: number;
  d0?: number;
  d0mayor?: number;
  L0?: number;
  Np?: number;
  finWidth?: number;
  spokeWidth?: number;
  coreOffset?: number;
  slotWidth?: number;
  slotDepth?: number;
  rodDiameter?: number;
}

function addContinuousVar(
  name: ActiveVarName,
  mode: VariableConstraintMode | undefined,
  fixedVal: number | undefined,
  rangeMin: number | undefined,
  rangeMax: number | undefined,
  defaultFixed: number,
  freeMin: number,
  freeMax: number,
  absMin: number,
  absMaxLimit: number,
  activeVars: ActiveVarName[],
  bounds: VariableBound[],
  fixedValues: FixedValuesMap
) {
  const m = mode || 'free';
  if (m === 'fixed') {
    fixedValues[name] = fixedVal !== undefined ? fixedVal : defaultFixed;
  } else if (m === 'range') {
    const min = Math.max(absMin, rangeMin !== undefined ? rangeMin : freeMin);
    const rawMax = rangeMax !== undefined ? rangeMax : absMaxLimit;
    const max = min <= absMaxLimit ? Math.min(absMaxLimit, rawMax) : rawMax;
    if (max > min + 0.08) {
      activeVars.push(name);
      bounds.push({ min, max });
    } else {
      fixedValues[name] = min;
    }
  } else {
    const lo = Math.max(absMin, freeMin);
    const hi = Math.max(lo + 0.25, freeMax);
    activeVars.push(name);
    bounds.push({ min: lo, max: hi });
  }
}

/**
 * Calculates continuous bounds for active optimization variables for a specific grain count N,
 * respecting radial clearance after liner/inhibitor deductions and full geometry degrees of freedom.
 */
function getVariableBoundsForN(
  N: number,
  config: SmartSearchConfig,
  availableD0: number
): {
  activeVars: ActiveVarName[];
  bounds: VariableBound[];
  fixedValues: FixedValuesMap;
} {
  const Lc = config.Lc;
  const shape = config.shape;
  const usesCore = shapeUsesCorePort(shape);
  const usesRadial = shapeUsesD0MayorAndNp(shape);
  const hasInsulation = Boolean(config.hasLiner || config.hasInhibitor);
  const freeMargin = hasInsulation ? 0.0 : 0.5;
  const maxD0Allowed = Math.max(10.0, availableD0);
  const maxD0Free = Math.max(10.5, maxD0Allowed - freeMargin);

  const modeD0 = config.modeD0 || (config.lockD0 ? 'fixed' : 'free');
  const moded0 = config.moded0 || (config.lockd0 ? 'fixed' : 'free');
  const moded0mayor = config.moded0mayor || 'free';
  const modeL0 = config.modeL0 || (config.lockL0 ? 'fixed' : 'free');
  const modeNp = config.modeNp || 'fixed';

  const activeVars: ActiveVarName[] = [];
  const bounds: VariableBound[] = [];
  const fixedValues: FixedValuesMap = {
    finWidth: 0,
    spokeWidth: 0,
    coreOffset: 0,
    slotWidth: 0,
    slotDepth: 0,
    rodDiameter: 0,
  };

  // 1. D0 (External Diameter)
  if (modeD0 === 'fixed') {
    fixedValues.D0 = config.valD0 !== undefined ? config.valD0 : maxD0Free;
  } else if (modeD0 === 'range') {
    const min = Math.max(10, config.minD0 !== undefined ? config.minD0 : Math.max(10, maxD0Allowed - 4));
    const maxRaw = config.maxD0 !== undefined ? config.maxD0 : maxD0Allowed;
    const max = min <= maxD0Allowed ? Math.min(maxD0Allowed, maxRaw) : maxRaw;
    if (max > min + 0.1) {
      activeVars.push('D0');
      bounds.push({ min, max });
    } else {
      fixedValues.D0 = min;
    }
  } else {
    const min = Math.max(10, maxD0Allowed - 6.0);
    const max = Math.max(min + 0.5, maxD0Free);
    activeVars.push('D0');
    bounds.push({ min, max });
  }

  const effectiveMaxD0 = fixedValues.D0 !== undefined ? fixedValues.D0 : maxD0Allowed;

  // 2. Np (Star points / Finocyl fins / Wagon Wheel spokes - active for shapes 2, 4, 9)
  const minNpRequired = shape === 4 ? 2 : 3;
  const defaultNpFixed = shape === 2 ? 5 : 6;
  const maxNpFreeCeiling = shape === 2 ? 10 : 8;
  let maxNpForBounds = maxNpFreeCeiling;
  let minNpForBounds = minNpRequired;

  if (!usesRadial) {
    fixedValues.Np = 0;
    maxNpForBounds = 0;
    minNpForBounds = 0;
  } else if (modeNp === 'fixed') {
    const rawFixedNp = Math.round(config.valNp !== undefined ? config.valNp : defaultNpFixed);
    fixedValues.Np = rawFixedNp;
    maxNpForBounds = Math.max(minNpRequired, rawFixedNp);
    minNpForBounds = Math.max(minNpRequired, rawFixedNp);
  } else if (modeNp === 'range') {
    const minN = Math.max(minNpRequired, Math.round(config.minNp !== undefined ? config.minNp : minNpRequired));
    const maxN = Math.max(minN, Math.round(config.maxNp !== undefined ? config.maxNp : 8));
    minNpForBounds = minN;
    maxNpForBounds = maxN;
    if (maxN > minN) {
      activeVars.push('Np');
      bounds.push({ min: minN - 0.45, max: maxN + 0.45 });
    } else {
      fixedValues.Np = minN;
    }
  } else {
    minNpForBounds = minNpRequired;
    maxNpForBounds = maxNpFreeCeiling;
    activeVars.push('Np');
    bounds.push({ min: minNpRequired - 0.45, max: maxNpFreeCeiling + 0.45 });
  }

  // 3. d0 (Core / Inner Star Tip / Tube ID - active for shapes 1, 2, 4, 5, 8, 9)
  const cosMaxNp = shape === 2 && maxNpForBounds >= 3 ? Math.cos(Math.PI / maxNpForBounds) : 1;
  const maxD0AllowedByStarDp =
    shape === 2 && moded0mayor === 'fixed' && config.vald0mayor !== undefined
      ? config.vald0mayor * cosMaxNp
      : shape === 2 && moded0mayor === 'range' && config.maxd0mayor !== undefined
        ? Math.min(effectiveMaxD0 - 0.5, config.maxd0mayor) * cosMaxNp
        : (effectiveMaxD0 - 0.5) * cosMaxNp;

  if (!usesCore) {
    fixedValues.d0 = 0;
  } else if (moded0 === 'fixed') {
    fixedValues.d0 = config.vald0 !== undefined ? config.vald0 : Math.max(4, effectiveMaxD0 * (shape === 8 ? 0.6 : 0.28));
  } else if (moded0 === 'range') {
    const min = Math.max(3.0, config.mind0 !== undefined ? config.mind0 : (shape === 8 ? Math.max(6, effectiveMaxD0 * 0.3) : 6.0));
    let maxLimit = effectiveMaxD0 - (shape === 8 ? 3.0 : 4.0);
    if (shape === 2) maxLimit = Math.min(maxLimit, maxD0AllowedByStarDp);
    if ((shape === 4 || shape === 9) && moded0mayor === 'fixed' && config.vald0mayor !== undefined) {
      maxLimit = Math.min(maxLimit, config.vald0mayor - 1.5);
    }
    const rawMax = config.maxd0 !== undefined ? config.maxd0 : maxLimit;
    const max = min <= maxLimit ? Math.min(maxLimit, rawMax) : rawMax;
    if (max > min + 0.1) {
      activeVars.push('d0');
      bounds.push({ min, max });
    } else {
      fixedValues.d0 = min;
    }
  } else {
    // FREE mode for d0
    if (shape === 8) {
      const rodFloor = config.modeRodDiameter === 'fixed' && config.valRodDiameter !== undefined
        ? config.valRodDiameter + 2.0
        : 6.0;
      const min = Math.max(6.0, rodFloor);
      const max = Math.max(min + 1.0, effectiveMaxD0 - 3.0);
      activeVars.push('d0');
      bounds.push({ min, max });
    } else if (shape === 4 || shape === 9) {
      const min = Math.max(4.0, effectiveMaxD0 * 0.16);
      let max = Math.max(min + 1.0, effectiveMaxD0 * 0.62);
      if (moded0mayor === 'fixed' && config.vald0mayor !== undefined) {
        max = Math.max(min + 0.5, Math.min(max, config.vald0mayor - 1.5));
      }
      activeVars.push('d0');
      bounds.push({ min, max });
    } else if (shape === 5) {
      const offsetReserve = config.modeCoreOffset === 'fixed' && config.valCoreOffset !== undefined
        ? 2 * config.valCoreOffset + 2.0
        : 5.0;
      const min = 4.0;
      const max = Math.max(min + 1.0, effectiveMaxD0 - offsetReserve);
      activeVars.push('d0');
      bounds.push({ min, max });
    } else {
      const min = 4.0;
      const starFreeCeiling = shape === 2 ? Math.max(min + 0.5, maxD0AllowedByStarDp * 0.88) : (effectiveMaxD0 - 4.0);
      const max = shape === 2
        ? Math.max(min + 1.0, Math.min(effectiveMaxD0 - 5.0, starFreeCeiling))
        : Math.max(min + 1.0, effectiveMaxD0 - 4.0);
      activeVars.push('d0');
      bounds.push({ min, max });
    }
  }

  // 4. d0mayor (Star Valley / Finocyl Fin Tip / Wagon Wheel Window Outer Dia - active for 2, 4, 9)
  if (!usesRadial) {
    fixedValues.d0mayor = 0;
  } else if (moded0mayor === 'fixed') {
    fixedValues.d0mayor = config.vald0mayor !== undefined ? config.vald0mayor : (effectiveMaxD0 * 0.68);
  } else if (moded0mayor === 'range') {
    let minBase = 5.5;
    if (shape === 2 && fixedValues.d0 !== undefined && maxNpForBounds >= 3) {
      const minGeomBase = getMinStarValleyDiameterMm(fixedValues.d0, fixedValues.Np ?? maxNpForBounds);
      minBase = Math.max(4.5, minGeomBase + 0.1);
    } else if ((shape === 4 || shape === 9) && fixedValues.d0 !== undefined) {
      minBase = fixedValues.d0 + 1.5;
    }
    const rawMin = config.mind0mayor !== undefined ? config.mind0mayor : effectiveMaxD0 * 0.45;
    const min = Math.max(minBase, rawMin);
    const maxLimit = effectiveMaxD0 - 0.8;
    const rawMax = config.maxd0mayor !== undefined ? config.maxd0mayor : maxLimit;
    const max = min <= maxLimit ? Math.min(maxLimit, rawMax) : rawMax;
    if (max > min + 0.1) {
      activeVars.push('d0mayor');
      bounds.push({ min, max });
    } else {
      fixedValues.d0mayor = min;
    }
  } else {
    let minBase = Math.max(6.0, effectiveMaxD0 * 0.35);
    if (shape === 2 && fixedValues.d0 !== undefined && maxNpForBounds >= 3) {
      const minGeom = getMinStarValleyDiameterMm(fixedValues.d0, fixedValues.Np ?? maxNpForBounds);
      minBase = Math.max(minGeom * 1.15, minGeom + 1.5);
    } else if ((shape === 4 || shape === 9) && fixedValues.d0 !== undefined) {
      minBase = Math.max(minBase, fixedValues.d0 + 2.0);
    }
    const maxLimit = Math.max(minBase + 0.5, effectiveMaxD0 - 0.8);
    activeVars.push('d0mayor');
    bounds.push({ min: minBase, max: maxLimit });
  }

  // 5. Shape-specific geometry variables (shapes 4, 5, 6, 7, 8, 9)
  const d0BoundRef =
    fixedValues.d0 !== undefined
      ? fixedValues.d0
      : (() => {
          const idx = activeVars.indexOf('d0');
          return idx >= 0 ? bounds[idx].max : effectiveMaxD0 * 0.35;
        })();

  if (shape === 4) {
    // Finocyl Fin Slot Width
    const theoreticalMax = getMaxFinocylWidthMm(d0BoundRef, Math.max(2, minNpForBounds));
    const safeMaxW = Math.max(1.8, theoreticalMax * 0.88);
    addContinuousVar(
      'finWidth',
      config.modeFinWidth,
      config.valFinWidth,
      config.minFinWidth,
      config.maxFinWidth,
      Math.max(1.2, Math.min(safeMaxW * 0.65, effectiveMaxD0 * 0.08)),
      1.0,
      safeMaxW,
      0.5,
      Math.max(1.5, theoreticalMax * 0.95),
      activeVars,
      bounds,
      fixedValues
    );
  } else if (shape === 9) {
    // Wagon Wheel Spoke Width
    const theoreticalMax = getMaxWagonWheelSpokeWidthMm(d0BoundRef, Math.max(3, minNpForBounds));
    const safeMaxW = Math.max(1.8, theoreticalMax * 0.85);
    addContinuousVar(
      'spokeWidth',
      config.modeSpokeWidth,
      config.valSpokeWidth,
      config.minSpokeWidth,
      config.maxSpokeWidth,
      Math.max(1.2, Math.min(safeMaxW * 0.6, effectiveMaxD0 * 0.075)),
      1.0,
      safeMaxW,
      0.5,
      Math.max(1.5, theoreticalMax * 0.95),
      activeVars,
      bounds,
      fixedValues
    );
  } else if (shape === 5) {
    // Moonburner Core Offset
    const d0MinRef =
      fixedValues.d0 !== undefined
        ? fixedValues.d0
        : (() => {
            const idx = activeVars.indexOf('d0');
            return idx >= 0 ? bounds[idx].min : 4.0;
          })();
    const maxOffsetPhys = Math.max(1.0, getMaxMoonburnerOffsetMm(effectiveMaxD0, d0MinRef) - 0.5);
    addContinuousVar(
      'coreOffset',
      config.modeCoreOffset,
      config.valCoreOffset,
      config.minCoreOffset,
      config.maxCoreOffset,
      Math.min(maxOffsetPhys, Math.max(1.5, (effectiveMaxD0 - d0MinRef) * 0.22)),
      1.0,
      maxOffsetPhys * 0.9,
      0.0,
      maxOffsetPhys,
      activeVars,
      bounds,
      fixedValues
    );
  } else if (shape === 6) {
    // C-Slot Width + Depth
    addContinuousVar(
      'slotWidth',
      config.modeSlotWidth,
      config.valSlotWidth,
      config.minSlotWidth,
      config.maxSlotWidth,
      Math.max(2.0, effectiveMaxD0 * 0.15),
      Math.max(1.5, effectiveMaxD0 * 0.06),
      Math.max(3.5, effectiveMaxD0 * 0.42),
      0.6,
      effectiveMaxD0 - 2.0,
      activeVars,
      bounds,
      fixedValues
    );
    const refSlotWidth =
      fixedValues.slotWidth !== undefined
        ? fixedValues.slotWidth
        : Math.max(2.0, effectiveMaxD0 * 0.1);
    const maxSlotDepthAllowed = Math.max(4.0, getMaxCSlotDepthMm(effectiveMaxD0, refSlotWidth) - 1.0);
    addContinuousVar(
      'slotDepth',
      config.modeSlotDepth,
      config.valSlotDepth,
      config.minSlotDepth,
      config.maxSlotDepth,
      Math.min(maxSlotDepthAllowed, Math.max(4.0, effectiveMaxD0 * 0.55)),
      Math.max(2.5, effectiveMaxD0 * 0.18),
      maxSlotDepthAllowed * 0.92,
      1.0,
      maxSlotDepthAllowed,
      activeVars,
      bounds,
      fixedValues
    );
  } else if (shape === 7) {
    // D-Grain Cut Depth
    const maxCutAllowed = Math.max(4.0, effectiveMaxD0 - 2.5);
    addContinuousVar(
      'slotDepth',
      config.modeSlotDepth,
      config.valSlotDepth,
      config.minSlotDepth,
      config.maxSlotDepth,
      Math.min(maxCutAllowed, Math.max(3.0, effectiveMaxD0 * 0.45)),
      Math.max(2.0, effectiveMaxD0 * 0.12),
      Math.min(maxCutAllowed, effectiveMaxD0 * 0.72),
      1.0,
      maxCutAllowed,
      activeVars,
      bounds,
      fixedValues
    );
  } else if (shape === 8) {
    // Rod & Tube Central Rod Diameter
    const maxRodAllowed = Math.max(2.5, d0BoundRef - 1.5);
    addContinuousVar(
      'rodDiameter',
      config.modeRodDiameter,
      config.valRodDiameter,
      config.minRodDiameter,
      config.maxRodDiameter,
      Math.min(maxRodAllowed, Math.max(2.0, effectiveMaxD0 * 0.28)),
      Math.max(1.5, effectiveMaxD0 * 0.08),
      Math.max(2.5, maxRodAllowed * 0.9),
      1.0,
      maxRodAllowed,
      activeVars,
      bounds,
      fixedValues
    );
  }

  // 6. L0 (Grain Segment Length)
  const maxL0Physical = Math.max(5.0, Lc / N);
  if (modeL0 === 'fixed') {
    fixedValues.L0 = config.valL0 !== undefined ? config.valL0 : (Lc / (N * 1.2));
  } else if (modeL0 === 'range') {
    const min = Math.max(5.0, config.minL0 !== undefined ? config.minL0 : 20.0);
    const maxRaw = config.maxL0 !== undefined ? config.maxL0 : maxL0Physical;
    const max = min <= maxL0Physical ? Math.min(maxL0Physical, maxRaw) : maxRaw;
    if (max > min + 0.1) {
      activeVars.push('L0');
      bounds.push({ min, max });
    } else {
      fixedValues.L0 = min;
    }
  } else {
    const min = Math.max(5.0, Math.min(15.0, maxL0Physical * 0.2));
    const max = maxL0Physical;
    activeVars.push('L0');
    bounds.push({ min, max });
  }

  return { activeVars, bounds, fixedValues };
}

/**
 * Unified Differential Evolution Optimization Engine for HERMES
 * 
 * Replaces old legacy algorithms (basic grid search, neighborhood search, CMA-ES, Nelder-Mead)
 * with a canonical Differential Evolution algorithm.
 * 
 * Guarantees:
 * 1. Strict maximum total impulse objective (I_total = It_total_N_s) for max_impulse mode.
 * 2. Feasibility-first selection (Deb's rules) with hard chamber pressure constraint.
 * 3. Discrete grain count N exploration (1 to X or fixed N) without losing high-impulse solutions.
 * 4. Transparent evaluation budgeting per N and total.
 * 5. Reproducible trajectories using deterministic seeding.
 * 6. Non-blocking asynchronous execution with real-time UI HUD progress.
 */
export async function runSmartSearchAsync(
  config: SmartSearchConfig,
  onProgress?: (progress: OptimizationProgress) => void
): Promise<SmartSearchOutcome> {
  const startTime = performance.now();
  const customProps = config.customPropellants || [];
  const allPropellants = [...DEFAULT_PROPELLANTS, ...customProps];

  // 1. Determine evaluation budget per N
  let evaluationsPerN = config.evaluationsPerN;
  if (!evaluationsPerN) {
    if (config.budgetPreset === 'fast') {
      evaluationsPerN = 500;
    } else if (config.budgetPreset === 'deep') {
      evaluationsPerN = 2000;
    } else {
      evaluationsPerN = 1000; // Standard default benchmark
    }
  }

  // 2. Determine grain counts to explore
  let N_values: number[] = [];
  if (config.grainCountMode === 'fixed') {
    N_values = [Math.max(1, config.fixedGrainCount || 3)];
  } else {
    const maxN = Math.max(1, config.maxGrainCount || 5);
    for (let i = 1; i <= maxN; i++) {
      N_values.push(i);
    }
  }

  const totalEstimatedEvaluations = N_values.length * evaluationsPerN;
  let totalEvaluationsAcrossAll = 0;
  let viableCount = 0;
  let safeCount = 0;

  const allPoints: EvaluatedPoint[] = [];
  const convergenceHistory: SmartSearchOutcome['convergenceHistory'] = [];
  const evaluationCache = new Map<string, CompactEvaluation>();
  const bestFeasibleCandidatesPerN = new Map<number, CompactEvaluation>();
  let globalBestFeasible: CompactEvaluation | null = null;
  let globalBestCandidate: CompactEvaluation | null = null;

  const grainSummaries: GrainCountEvaluationSummary[] = [];

  const baseSeed = config.randomSeed ?? 0x8675309;

  const availableD0 = getAvailableGrainDiameterMm(config);

  if (availableD0 <= 0) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    return {
      bestCandidates: [],
      allEvaluatedPoints: [],
      convergenceHistory: [],
      totalEvaluated: 0,
      viableCount: 0,
      safeCount: 0,
      executionTimeMs,
      hasOverpressureWarning: false,
      message: `El espesor acumulado del liner y/o inhibidor agota el diámetro interior de cámara (Dc = ${config.Dc} mm → D0 máx = ${availableD0.toFixed(1)} mm).`,
      algorithmUsed: 'Differential Evolution (DE/rand/1/bin)',
      grainSummaries: [],
      diagnostics: [{
        code: 'CLEARANCE_EXHAUSTED',
        title: 'Espacio radial insuficiente tras descontar liner e inhibidor',
        description: `Con Dc = ${config.Dc} mm y los espesores configurados, el diámetro máximo disponible para el grano es ${availableD0.toFixed(1)} mm (≤ 0 mm).`,
        recommendation: 'Reduce el espesor de liner/inhibidor o aumenta el diámetro interior de la cámara Dc.'
      }],
      isCancelled: false
    };
  }

  // Report initial progress
  if (onProgress) {
    onProgress({
      phase: 'starting',
      stepDescription: `Iniciando Evolución Diferencial (DE/rand/1/bin)... Presupuesto: ${evaluationsPerN} evals/grano (${totalEstimatedEvaluations} totales)`,
      currentEvaluations: 0,
      totalEstimated: totalEstimatedEvaluations,
      percent: 2,
      elapsedMs: 0,
      elapsedSeconds: 0,
      statusText: 'Iniciando optimizador diferencial global...'
    });
  }
  await new Promise(r => setTimeout(r, 0));

  // 3. Sequential evaluation of each grain count N
  for (let nIndex = 0; nIndex < N_values.length; nIndex++) {
    if (config.shouldStop && config.shouldStop()) {
      break;
    }

    const currentN = N_values[nIndex];
    const nSeed = (baseSeed + currentN * 1013904223) >>> 0;

    const { activeVars, bounds, fixedValues } = getVariableBoundsForN(currentN, config, availableD0);
    const dimensions = activeVars.length;

    let nEvaluations = 0;
    let nBestFeasible: CompactEvaluation | null = null;

    const shapeLabelForMsg = getGrainShapeLabel(config.shape);
    const statusMsg = config.grainCountMode === 'fixed'
      ? `Optimizando configuración ${shapeLabelForMsg} de ${currentN} granos con Evolución Diferencial...`
      : `Optimizando grano ${shapeLabelForMsg} N = ${currentN} de ${N_values.length} [DE/rand/1/bin]...`;

    // Differential Evolution evaluator callback
    const deEvaluator = (rawPhysical: number[]) => {
      const shape = config.shape;
      const usesCore = shapeUsesCorePort(shape);
      const usesRadial = shapeUsesD0MayorAndNp(shape);
      const minNpReq = shape === 4 ? 2 : 3;

      let D0 = fixedValues.D0 !== undefined ? fixedValues.D0 : 0;
      let d0 = fixedValues.d0 !== undefined ? fixedValues.d0 : 0;
      let d0mayor = fixedValues.d0mayor !== undefined ? fixedValues.d0mayor : 0;
      let L0 = fixedValues.L0 !== undefined ? fixedValues.L0 : 0;
      let Np = fixedValues.Np !== undefined ? fixedValues.Np : (usesRadial ? (shape === 2 ? 5 : 6) : 0);
      let finWidth = fixedValues.finWidth ?? 0;
      let spokeWidth = fixedValues.spokeWidth ?? 0;
      let coreOffset = fixedValues.coreOffset ?? 0;
      let slotWidth = fixedValues.slotWidth ?? 0;
      let slotDepth = fixedValues.slotDepth ?? 0;
      let rodDiameter = fixedValues.rodDiameter ?? 0;

      for (let i = 0; i < activeVars.length; i++) {
        const vName = activeVars[i];
        if (vName === 'D0') D0 = rawPhysical[i];
        else if (vName === 'd0') d0 = rawPhysical[i];
        else if (vName === 'd0mayor') d0mayor = rawPhysical[i];
        else if (vName === 'L0') L0 = rawPhysical[i];
        else if (vName === 'Np') Np = rawPhysical[i];
        else if (vName === 'finWidth') finWidth = rawPhysical[i];
        else if (vName === 'spokeWidth') spokeWidth = rawPhysical[i];
        else if (vName === 'coreOffset') coreOffset = rawPhysical[i];
        else if (vName === 'slotWidth') slotWidth = rawPhysical[i];
        else if (vName === 'slotDepth') slotDepth = rawPhysical[i];
        else if (vName === 'rodDiameter') rodDiameter = rawPhysical[i];
      }

      // Continuous precision rounding to avoid tiny floating point chatter in cache
      D0 = parseFloat(D0.toFixed(2));
      d0 = usesCore ? parseFloat(d0.toFixed(2)) : 0;
      d0mayor = usesRadial ? parseFloat(d0mayor.toFixed(2)) : 0;
      L0 = parseFloat(L0.toFixed(2));
      Np = usesRadial ? Math.max(minNpReq, Math.round(Np)) : 0;
      finWidth = shape === 4 ? parseFloat(finWidth.toFixed(2)) : 0;
      spokeWidth = shape === 9 ? parseFloat(spokeWidth.toFixed(2)) : 0;
      coreOffset = shape === 5 ? parseFloat(coreOffset.toFixed(2)) : 0;
      slotWidth = shape === 6 ? parseFloat(slotWidth.toFixed(2)) : 0;
      slotDepth = shape === 6 || shape === 7 ? parseFloat(slotDepth.toFixed(2)) : 0;
      rodDiameter = shape === 8 ? parseFloat(rodDiameter.toFixed(2)) : 0;

      const extra: ExtraShapeParams = {
        finWidth,
        spokeWidth,
        coreOffset,
        slotWidth,
        slotDepth,
        rodDiameter,
      };

      const cacheKey = `${shape}_${currentN}_${D0}_${d0}_${d0mayor}_${L0}_${Np}_${finWidth}_${spokeWidth}_${coreOffset}_${slotWidth}_${slotDepth}_${rodDiameter}`;
      let compEval = evaluationCache.get(cacheKey);

      if (!compEval) {
        totalEvaluationsAcrossAll++;
        nEvaluations++;

        const evalRes = evaluateGeometry(currentN, D0, d0, d0mayor, L0, Np, extra, config, customProps, availableD0);
        
        compEval = {
          isFeasible: evalRes.isFeasible,
          constraintViolation: evalRes.constraintViolation,
          objective: evalRes.objective,
          metrics: evalRes.metrics || {
            totalImpulse: 0,
            maxPressure: 99,
            avgPressure: 0,
            maxThrust: 0,
            avgThrust: 0,
            initialThrust: 0,
            burnTime: 0,
            actionTime: 0,
            isp: 0,
            motorClass: 'N/A',
            thrustFlatness: 0,
            chamberFillFraction: parseFloat(((currentN * L0) / config.Lc * 100).toFixed(0)),
            propellantMassKg: 0,
            propellantMassGrams: 0,
            predictedApogeeMeters: 0
          },
          N: currentN,
          D0,
          d0,
          d0mayor,
          Np,
          L0,
          ...(shape === 4 ? { finWidth } : {}),
          ...(shape === 9 ? { spokeWidth } : {}),
          ...(shape === 5 ? { coreOffset } : {}),
          ...(shape === 6 ? { slotWidth, slotDepth } : {}),
          ...(shape === 7 ? { slotDepth } : {}),
          ...(shape === 8 ? { rodDiameter } : {}),
        };

        evaluationCache.set(cacheKey, compEval);

        if (compEval.metrics.burnTime > 0) viableCount++;
        if (compEval.isFeasible) safeCount++;

        // Add to compact evaluated points for UI scatter diagram
        if (compEval.metrics.burnTime > 0) {
          const configLabel = formatCompactGrainLabel(shape, currentN, D0, d0, d0mayor, L0, Np, extra);
          allPoints.push({
            id: `pt_${allPoints.length + 1}`,
            order: allPoints.length + 1,
            totalImpulse: compEval.metrics.totalImpulse,
            maxPressure: compEval.metrics.maxPressure,
            avgPressure: compEval.metrics.avgPressure,
            burnTime: compEval.metrics.burnTime,
            maxThrust: compEval.metrics.maxThrust,
            avgThrust: compEval.metrics.avgThrust,
            initialThrust: compEval.metrics.initialThrust,
            grainCount: currentN,
            shape,
            D0,
            d0,
            d0mayor,
            Np,
            L0,
            ...(shape === 4 ? { finWidth } : {}),
            ...(shape === 9 ? { spokeWidth } : {}),
            ...(shape === 5 ? { coreOffset } : {}),
            ...(shape === 6 ? { slotWidth, slotDepth } : {}),
            ...(shape === 7 ? { slotDepth } : {}),
            ...(shape === 8 ? { rodDiameter } : {}),
            isSafe: compEval.isFeasible,
            score: compEval.objective,
            bestScoreSoFar: globalBestFeasible ? globalBestFeasible.metrics.totalImpulse : 0,
            configLabel
          });
        }
      }

      // Track best for current N
      if (compEval.isFeasible) {
        if (!nBestFeasible || compEval.objective > nBestFeasible.objective) {
          nBestFeasible = compEval;
        }
        // Track global best feasible
        if (!globalBestFeasible || compEval.objective > globalBestFeasible.objective) {
          globalBestFeasible = compEval;
        }
      }
      if (!globalBestCandidate || compEval.objective > globalBestCandidate.objective) {
        globalBestCandidate = compEval;
      }

      return {
        objective: compEval.objective,
        constraintViolation: compEval.constraintViolation,
        isFeasible: compEval.isFeasible,
        extra: compEval
      };
    };

    // When all dimensions are fixed, evaluate directly once without DE mutation overhead
    if (dimensions === 0) {
      const fixedEval = deEvaluator([]);
      if (fixedEval.isFeasible && fixedEval.extra) {
        bestFeasibleCandidatesPerN.set(currentN, fixedEval.extra);
      }
    } else {
      // Run canonical Differential Evolution for current N
      const deResult = await runDifferentialEvolution<CompactEvaluation>({
        dimensions,
        bounds,
        populationSize: Math.max(30, 15 * dimensions),
        maxEvaluations: evaluationsPerN,
        maxGenerations: Math.ceil(evaluationsPerN / Math.max(30, 15 * dimensions)),
        F: 0.7,
        ditherF: true,
        CR: 0.85,
        seed: nSeed,
        stagnationGenerations: 25,
        shouldStop: config.shouldStop,
        evaluate: deEvaluator,
        onGeneration: (genInfo) => {
          if (onProgress) {
            const currentEvals = totalEvaluationsAcrossAll;
            const pct = Math.min(98, Math.max(4, Math.round((currentEvals / totalEstimatedEvaluations) * 92) + 4));
            const elapsed = Math.round(performance.now() - startTime);
            const bestScore = globalBestFeasible
              ? globalBestFeasible.metrics.totalImpulse
              : (globalBestCandidate ? globalBestCandidate.metrics.totalImpulse : 0);
            const bestSummary = globalBestFeasible
              ? `${formatCompactGrainLabel(
                  config.shape,
                  globalBestFeasible.N,
                  globalBestFeasible.D0,
                  globalBestFeasible.d0,
                  globalBestFeasible.d0mayor,
                  globalBestFeasible.L0,
                  globalBestFeasible.Np,
                  {
                    finWidth: globalBestFeasible.finWidth ?? 0,
                    spokeWidth: globalBestFeasible.spokeWidth ?? 0,
                    coreOffset: globalBestFeasible.coreOffset ?? 0,
                    slotWidth: globalBestFeasible.slotWidth ?? 0,
                    slotDepth: globalBestFeasible.slotDepth ?? 0,
                    rodDiameter: globalBestFeasible.rodDiameter ?? 0,
                  }
                )} (${globalBestFeasible.metrics.totalImpulse} N·s)`
              : (globalBestCandidate ? `N=${globalBestCandidate.N} (infeasible)` : '');

            onProgress({
              phase: 'optimizing',
              stepDescription: statusMsg,
              currentEvaluations: currentEvals,
              totalEstimated: totalEstimatedEvaluations,
              percent: pct,
              elapsedMs: elapsed,
              elapsedSeconds: parseFloat((elapsed / 1000).toFixed(1)),
              bestScoreSoFar: parseFloat(bestScore.toFixed(1)),
              bestConfigSummary: bestSummary,
              statusText: statusMsg,
              currentN,
              totalN: N_values.length,
              generation: genInfo.generation
            });
          }
        }
      });

      // Record best for this N
      if (deResult.bestFeasible && deResult.bestFeasible.extra) {
        bestFeasibleCandidatesPerN.set(currentN, deResult.bestFeasible.extra);
      }
    }

    const nBest = bestFeasibleCandidatesPerN.get(currentN);
    grainSummaries.push({
      N: currentN,
      bestFeasibleImpulse: nBest ? nBest.metrics.totalImpulse : null,
      evaluations: nEvaluations,
      isFeasible: !!nBest,
      bestConfigLabel: nBest
        ? formatCompactGrainLabel(
            config.shape,
            currentN,
            nBest.D0,
            nBest.d0,
            nBest.d0mayor,
            nBest.L0,
            nBest.Np,
            {
              finWidth: nBest.finWidth ?? 0,
              spokeWidth: nBest.spokeWidth ?? 0,
              coreOffset: nBest.coreOffset ?? 0,
              slotWidth: nBest.slotWidth ?? 0,
              slotDepth: nBest.slotDepth ?? 0,
              rodDiameter: nBest.rodDiameter ?? 0,
            }
          )
        : 'No factible'
    });

    // Append to convergence history
    convergenceHistory.push({
      iteration: currentN,
      score: nBest ? nBest.objective : 0,
      bestScore: globalBestFeasible ? globalBestFeasible.metrics.totalImpulse : 0,
      candidateLabel: nBest ? `${currentN}x granos` : `N=${currentN} (inviable)`,
      totalImpulse: nBest ? nBest.metrics.totalImpulse : 0,
      maxPressure: nBest ? nBest.metrics.maxPressure : 0
    });
  }

  // 4. Assemble and rank candidates
  const feasibleList: CompactEvaluation[] = [];
  const infeasibleList: CompactEvaluation[] = [];

  for (const item of evaluationCache.values()) {
    if (item.metrics && item.metrics.burnTime > 0) {
      if (item.isFeasible) {
        feasibleList.push(item);
      } else {
        infeasibleList.push(item);
      }
    }
  }

  feasibleList.sort((a, b) => b.objective - a.objective);
  infeasibleList.sort((a, b) => a.constraintViolation - b.constraintViolation);

  const selectedCompactCandidates: CompactEvaluation[] = [];

  if (feasibleList.length > 0) {
    selectedCompactCandidates.push(feasibleList[0]);

    for (const nVal of N_values) {
      const bestForThisN = bestFeasibleCandidatesPerN.get(nVal);
      if (
        bestForThisN &&
        !selectedCompactCandidates.some(
          c =>
            c.N === bestForThisN.N &&
            c.D0 === bestForThisN.D0 &&
            c.d0 === bestForThisN.d0 &&
            c.d0mayor === bestForThisN.d0mayor &&
            c.Np === bestForThisN.Np &&
            c.L0 === bestForThisN.L0 &&
            c.finWidth === bestForThisN.finWidth &&
            c.spokeWidth === bestForThisN.spokeWidth &&
            c.coreOffset === bestForThisN.coreOffset &&
            c.slotWidth === bestForThisN.slotWidth &&
            c.slotDepth === bestForThisN.slotDepth &&
            c.rodDiameter === bestForThisN.rodDiameter
        )
      ) {
        selectedCompactCandidates.push(bestForThisN);
      }
    }

    for (const cand of feasibleList) {
      if (selectedCompactCandidates.length >= 6) break;
      if (!selectedCompactCandidates.some(c => c.N === cand.N && Math.abs(c.objective - cand.objective) < 0.5 && Math.abs(c.metrics.totalImpulse - cand.metrics.totalImpulse) < 0.5)) {
        selectedCompactCandidates.push(cand);
      }
    }
  } else if (infeasibleList.length > 0) {
    selectedCompactCandidates.push(infeasibleList[0]);
    for (let i = 1; i < Math.min(5, infeasibleList.length); i++) {
      selectedCompactCandidates.push(infeasibleList[i]);
    }
  }

  // 5. Independent Verification Simulation (full high-precision Clipper2)
  const bestCandidates: CandidateResult[] = [];

  for (let idx = 0; idx < selectedCompactCandidates.length; idx++) {
    const comp = selectedCompactCandidates[idx];
    const fullCand = buildFullCandidateResult(
      `cand_${idx + 1}`,
      idx + 1,
      comp.N,
      comp.D0,
      comp.d0,
      comp.d0mayor,
      comp.L0,
      comp.Np,
      {
        finWidth: comp.finWidth ?? 0,
        spokeWidth: comp.spokeWidth ?? 0,
        coreOffset: comp.coreOffset ?? 0,
        slotWidth: comp.slotWidth ?? 0,
        slotDepth: comp.slotDepth ?? 0,
        rodDiameter: comp.rodDiameter ?? 0,
      },
      config,
      customProps,
      allPropellants
    );
    bestCandidates.push(fullCand);
  }

  const executionTimeMs = Math.round(performance.now() - startTime);

  // Final progress update
  if (onProgress) {
    onProgress({
      phase: 'complete',
      stepDescription: 'Optimización completada con éxito. Re-simulación independiente verificada.',
      currentEvaluations: totalEvaluationsAcrossAll,
      totalEstimated: totalEstimatedEvaluations,
      percent: 100,
      elapsedMs: executionTimeMs,
      elapsedSeconds: parseFloat((executionTimeMs / 1000).toFixed(1)),
      bestScoreSoFar: bestCandidates[0] ? bestCandidates[0].metrics.totalImpulse : 0,
      bestConfigSummary: bestCandidates[0] ? bestCandidates[0].config.grainSummary : '',
      statusText: 'Búsqueda finalizada'
    });
  }

  const diagnostics: DiagnosticDetail[] = [];
  if (safeCount === 0 && viableCount > 0) {
    diagnostics.push({
      code: 'OVERPRESSURE_ALL',
      title: 'Todas las configuraciones superan la presión máxima permitida',
      description: `El área de garganta (Dt0 = ${config.Dt0} mm) es demasiado pequeña o el diámetro útil de cámara (${availableD0.toFixed(1)} mm) impone un área de quemado que eleva la presión por encima de Pmax_lim (${config.Pmax_lim} MPa).`,
      recommendation: `Incrementa el diámetro de garganta Dt0 (ej. a ${(config.Dt0 * 1.15).toFixed(1)} mm) o aumenta la presión máxima admisible Pmax_lim.`
    });
  }

  const isCancelled = !!(config.shouldStop && config.shouldStop());

  let outcomeMessage = '';
  if (isCancelled) {
    outcomeMessage = bestCandidates.length > 0
      ? `Simulación cancelada por el usuario. Se conservan ${bestCandidates.length} configuraciones factibles evaluadas hasta la cancelación (Mejor It: ${bestCandidates[0].metrics.totalImpulse} N·s).`
      : 'Simulación cancelada por el usuario antes de hallar candidatos factibles.';
  } else if (bestCandidates.length > 0) {
    outcomeMessage = `Evolución Diferencial finalizada. Mejor impulso factible: ${bestCandidates[0].metrics.totalImpulse} N·s (${bestCandidates[0].config.grainCount} granos).`;
  } else {
    outcomeMessage = 'No se encontraron configuraciones balísticamente factibles dentro de los límites físicos especificados.';
  }

  return {
    bestCandidates,
    allEvaluatedPoints: allPoints,
    convergenceHistory,
    totalEvaluated: totalEvaluationsAcrossAll,
    viableCount,
    safeCount,
    executionTimeMs,
    hasOverpressureWarning: safeCount === 0 && viableCount > 0,
    message: outcomeMessage,
    algorithmUsed: 'Differential Evolution (DE/rand/1/bin)',
    grainSummaries,
    diagnostics,
    isCancelled
  };
}

/**
 * Synchronous compatibility wrapper
 */
export function runSmartSearch(
  config: SmartSearchConfig,
  onProgress?: (progress: OptimizationProgress) => void
): Promise<SmartSearchOutcome> {
  return runSmartSearchAsync(config, onProgress);
}
