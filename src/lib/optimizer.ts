import { 
  GrainInput, 
  MotorInput, 
  MotorMaterialId,
  NozzleInput, 
  SimulationInputs, 
  SimulationResults, 
  CustomPropellant, 
  DEFAULT_PROPELLANTS 
} from './types';
import { calculateMotorStructure } from './motorStructure';
import { getMinStarValleyDiameterMm } from './grains';
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
  safetyFactor?: number;
  
  // Fixed Nozzle Data from Phase 1
  Dt0: number; // Throat diameter (mm)
  Ds: number;  // Exit diameter (mm)
  alpha: number; // Divergence angle (deg)
  etanoz?: number; // Nozzle efficiency (default 0.75)
  e?: number; // Throat variation / erosion (mm)
  propellantId: number; // Selected propellant
  
  // Phase 2: Grain Constraints & Free vs Locked variables
  shape: 1 | 2 | 3; // 1: Cylindrical/BATES, 2: Star, 3: Solid
  grainCountMode: 'range' | 'fixed';
  maxGrainCount: number; // Maximum grain count when mode is 'range' (1 to X)
  fixedGrainCount: number; // Exact grain count when mode is 'fixed'
  
  // Outer Diameter (D0)
  modeD0?: VariableConstraintMode;
  lockD0?: boolean;
  valD0?: number; // Grain outer diameter when fixed
  minD0?: number; // Minimum D0 when range
  maxD0?: number; // Maximum D0 when range
  
  // Core Diameter / Star Inner Tip Diameter (d0)
  moded0?: VariableConstraintMode;
  lockd0?: boolean;
  vald0?: number; // Grain core diameter when fixed
  mind0?: number; // Minimum d0 when range
  maxd0?: number; // Maximum d0 when range

  // Star Valley Diameter (d0mayor / Dp) - active when shape === 2
  moded0mayor?: VariableConstraintMode;
  vald0mayor?: number;
  mind0mayor?: number;
  maxd0mayor?: number;

  // Star Point Count (Np) - active when shape === 2
  modeNp?: VariableConstraintMode;
  valNp?: number;
  minNp?: number;
  maxNp?: number;
  
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
    shape: number;
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
  D0: number;
  d0: number;
  d0mayor: number;
  Np: number;
  L0: number;
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
}

function buildOptimizerMotorInput(config: SmartSearchConfig): MotorInput {
  return {
    Dc: config.Dc,
    Lc: config.Lc,
    Gstar: config.Gstar !== undefined ? config.Gstar : 1.0,
    kv: config.kv !== undefined ? config.kv : 0.1,
    etac: config.etac !== undefined ? config.etac : 0.85,
    paso_de_tiempo: 0.005,
    Pamb: config.Pamb !== undefined ? config.Pamb : 0.101325,
    hasLiner: Boolean(config.hasLiner),
    linerThickness: config.linerThickness !== undefined ? config.linerThickness : 2.0,
    hasInhibitor: Boolean(config.hasInhibitor),
    inhibitorThickness: config.inhibitorThickness !== undefined ? config.inhibitorThickness : 2.0,
    wallThickness: config.wallThickness,
    materialId: config.materialId,
    safetyFactor: config.safetyFactor,
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
  const rawRoundNp = config.shape === 2 ? Math.round(Np) : 0;
  const roundNp = config.shape === 2 ? Math.max(3, rawRoundNp || 0) : 0;

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

  // Core diameter checks for hollow shapes
  if (config.shape !== 3) {
    // Minimum web thickness for hollow cylindrical/star grain: 2 mm total diameter difference
    const minWeb = 2.0;
    if (d0 > D0 - 2 * minWeb) {
      geomViolation += Math.pow((d0 - (D0 - 2 * minWeb)) / Math.max(1, D0), 2) * 100 + 2;
    }
    if (d0 < 3.0) {
      geomViolation += Math.pow((3.0 - d0) / 3.0, 2) * 50 + 2;
    }

    // Star grain checks:
    // 1. Np >= 3
    // 2. Concave star condition matching Inputs tab: d0mayor > d0 / cos(pi / Np)
    //    (prevents star from collapsing into a convex polygon such as a pentagon)
    // 3. When optimizer picks d0mayor (free/range), enforce minimum arm depth so
    //    max_impulse cannot hug the collinear polygon boundary.
    // 4. Valleys must remain strictly inside outer diameter D0.
    if (config.shape === 2) {
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

  // 2. Build full simulator inputs
  const simMotor: MotorInput = buildOptimizerMotorInput(config);

  const simNozzle: NozzleInput = {
    Dt0: config.Dt0,
    Ds: config.Ds,
    e: config.e !== undefined ? config.e : 0,
    alpha: config.alpha || 15,
    etanoz: config.etanoz !== undefined ? config.etanoz : 0.75
  };

  const simGrains: GrainInput[] = [{
    id: '1',
    shape: config.shape,
    propellantType: config.propellantId,
    D0: D0,
    d0: config.shape === 3 ? 0 : d0,
    d0mayor: config.shape === 2 ? d0mayor : 0,
    L0: L0,
    N: N,
    Np: config.shape === 2 ? roundNp : 0,
    osi: config.osi,
    ci: config.shape === 3 ? 0 : config.ci,
    ei: config.ei,
    rhorat: 1.0
  }];

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
  config: SmartSearchConfig,
  customProps: CustomPropellant[],
  allPropellants: CustomPropellant[]
): CandidateResult {
  const propObj = allPropellants.find(p => p.id === config.propellantId) || allPropellants[0];
  const roundNp = config.shape === 2 ? Math.max(3, Math.round(Np || 5)) : 0;
  const effectiveD0mayor = config.shape === 2 ? d0mayor : 0;

  const simMotor: MotorInput = buildOptimizerMotorInput(config);

  const simNozzle: NozzleInput = {
    Dt0: config.Dt0,
    Ds: config.Ds,
    e: config.e !== undefined ? config.e : 0,
    alpha: config.alpha || 15,
    etanoz: config.etanoz !== undefined ? config.etanoz : 0.75
  };

  const simGrains: GrainInput[] = [{
    id: '1',
    shape: config.shape,
    propellantType: config.propellantId,
    D0: D0,
    d0: config.shape === 3 ? 0 : d0,
    d0mayor: effectiveD0mayor,
    L0: L0,
    N: N,
    Np: roundNp,
    osi: config.osi,
    ci: config.shape === 3 ? 0 : config.ci,
    ei: config.ei,
    rhorat: 1.0
  }];

  const simInputs: SimulationInputs = {
    motor: simMotor,
    grains: simGrains,
    nozzle: simNozzle,
    customPropellants: customProps
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

  const shapeLabel = config.shape === 1 ? 'BATES' : config.shape === 2 ? 'Estrella' : 'Macizo';
  const grainSummary = config.shape === 2
    ? `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, Dp=${effectiveD0mayor.toFixed(1)}, Np=${roundNp}, L0=${L0.toFixed(1)} mm] ${shapeLabel}`
    : `${N}x [D0=${D0.toFixed(1)}, d0=${d0.toFixed(1)}, L0=${L0.toFixed(1)} mm] ${shapeLabel}`;

  const isSafe = Pmax <= config.Pmax_lim && Pmax >= 0.4;

  return {
    id,
    rank,
    config: {
      grainCount: N,
      D0: parseFloat(D0.toFixed(1)),
      d0: parseFloat(d0.toFixed(1)),
      d0mayor: parseFloat(effectiveD0mayor.toFixed(1)),
      Np: roundNp,
      L0: parseFloat(L0.toFixed(1)),
      totalGrainLength: parseFloat((N * L0).toFixed(1)),
      shape: config.shape,
      Dt0: config.Dt0,
      Ds: config.Ds,
      propellantId: config.propellantId,
      propellantName: propObj.name,
      grainSummary,
      osi: config.osi,
      ci: config.ci,
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

type ActiveVarName = 'D0' | 'd0' | 'd0mayor' | 'L0' | 'Np';

/**
 * Calculates continuous bounds for active optimization variables for a specific grain count N,
 * respecting radial clearance after liner/inhibitor deductions and full Star geometry degrees of freedom.
 */
function getVariableBoundsForN(
  N: number,
  config: SmartSearchConfig,
  availableD0: number
): {
  activeVars: ActiveVarName[];
  bounds: VariableBound[];
  fixedValues: { D0?: number; d0?: number; d0mayor?: number; L0?: number; Np?: number };
} {
  const Lc = config.Lc;
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
  const fixedValues: { D0?: number; d0?: number; d0mayor?: number; L0?: number; Np?: number } = {};

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
    // FREE mode: Continuous interval respecting liner + inhibitor inner diameter
    const min = Math.max(10, maxD0Allowed - 6.0);
    const max = Math.max(min + 0.5, maxD0Free);
    activeVars.push('D0');
    bounds.push({ min, max });
  }

  const effectiveMaxD0 = fixedValues.D0 !== undefined ? fixedValues.D0 : maxD0Allowed;

  // 2. Np (Number of Star Points - active only when shape === 2)
  // Compute before d0 & d0mayor so trigonometric concavity bounds can tighten DE search space.
  let maxNpForBounds = 10;
  if (config.shape !== 2) {
    fixedValues.Np = 0;
    maxNpForBounds = 0;
  } else if (modeNp === 'fixed') {
    const rawFixedNp = Math.round(config.valNp !== undefined ? config.valNp : 5);
    fixedValues.Np = rawFixedNp;
    maxNpForBounds = Math.max(3, rawFixedNp);
  } else if (modeNp === 'range') {
    const minN = Math.max(3, Math.round(config.minNp !== undefined ? config.minNp : 3));
    const maxN = Math.max(minN, Math.round(config.maxNp !== undefined ? config.maxNp : 8));
    maxNpForBounds = maxN;
    if (maxN > minN) {
      activeVars.push('Np');
      // Slightly widened half-integer edges give equal sampling probability to boundary integers under Math.round()
      bounds.push({ min: minN - 0.45, max: maxN + 0.45 });
    } else {
      fixedValues.Np = minN;
    }
  } else {
    // FREE mode for star points: explore 3 to 10 points
    maxNpForBounds = 10;
    activeVars.push('Np');
    bounds.push({ min: 3 - 0.45, max: 10 + 0.45 });
  }

  // 3. d0 (Core / Inner Star Tip Diameter)
  const cosMaxNp = config.shape === 2 && maxNpForBounds >= 3 ? Math.cos(Math.PI / maxNpForBounds) : 1;
  const maxD0AllowedByStarDp =
    config.shape === 2 && moded0mayor === 'fixed' && config.vald0mayor !== undefined
      ? config.vald0mayor * cosMaxNp
      : config.shape === 2 && moded0mayor === 'range' && config.maxd0mayor !== undefined
        ? Math.min(effectiveMaxD0 - 0.5, config.maxd0mayor) * cosMaxNp
        : (effectiveMaxD0 - 0.5) * cosMaxNp;

  if (config.shape === 3) {
    // Solid grain has no active core
    fixedValues.d0 = 0;
  } else if (moded0 === 'fixed') {
    fixedValues.d0 = config.vald0 !== undefined ? config.vald0 : 10.0;
  } else if (moded0 === 'range') {
    const min = Math.max(3.0, config.mind0 !== undefined ? config.mind0 : 6.0);
    const maxLimit = config.shape === 2
      ? Math.min(effectiveMaxD0 - 4.0, maxD0AllowedByStarDp)
      : effectiveMaxD0 - 4.0;
    const rawMax = config.maxd0 !== undefined ? config.maxd0 : maxLimit;
    const max = min <= maxLimit ? Math.min(maxLimit, rawMax) : rawMax;
    if (max > min + 0.1) {
      activeVars.push('d0');
      bounds.push({ min, max });
    } else {
      fixedValues.d0 = min;
    }
  } else {
    // FREE mode: Continuous interval tightened by star concavity ceiling when shape === 2
    const min = 4.0;
    const starFreeCeiling = config.shape === 2 ? Math.max(min + 0.5, maxD0AllowedByStarDp * 0.88) : (effectiveMaxD0 - 4.0);
    const max = config.shape === 2
      ? Math.max(min + 1.0, Math.min(effectiveMaxD0 - 5.0, starFreeCeiling))
      : Math.max(min + 1.0, effectiveMaxD0 - 4.0);
    activeVars.push('d0');
    bounds.push({ min, max });
  }

  // 4. d0mayor (Star Valley Diameter - active only when shape === 2)
  if (config.shape !== 2) {
    fixedValues.d0mayor = 0;
  } else if (moded0mayor === 'fixed') {
    fixedValues.d0mayor = config.vald0mayor !== undefined ? config.vald0mayor : (effectiveMaxD0 * 0.65);
  } else if (moded0mayor === 'range') {
    const minGeomBase =
      fixedValues.d0 !== undefined && maxNpForBounds >= 3
        ? getMinStarValleyDiameterMm(fixedValues.d0, fixedValues.Np ?? maxNpForBounds)
        : 4.5;
    const minBase = fixedValues.d0 !== undefined ? Math.max(4.5, minGeomBase + 0.1) : 4.5;
    const rawMin = config.mind0mayor !== undefined ? config.mind0mayor : effectiveMaxD0 * 0.45;
    const min = Math.max(minBase, rawMin);
    const maxLimit = effectiveMaxD0 - 0.5;
    const rawMax = config.maxd0mayor !== undefined ? config.maxd0mayor : maxLimit;
    const max = min <= maxLimit ? Math.min(maxLimit, rawMax) : rawMax;
    if (max > min + 0.1) {
      activeVars.push('d0mayor');
      bounds.push({ min, max });
    } else {
      fixedValues.d0mayor = min;
    }
  } else {
    // FREE mode for star valleys: enforce genuine concave arm minimum when d0 is known
    let minBase = 5.5;
    if (fixedValues.d0 !== undefined && maxNpForBounds >= 3) {
      const minGeom = getMinStarValleyDiameterMm(fixedValues.d0, fixedValues.Np ?? maxNpForBounds);
      minBase = Math.max(minGeom * 1.15, minGeom + 1.5);
    }
    const maxLimit = Math.max(minBase + 0.5, effectiveMaxD0 - 0.6);
    activeVars.push('d0mayor');
    bounds.push({ min: minBase, max: maxLimit });
  }

  // 5. L0 (Grain Segment Length)
  // Physical constraint: N * L0 <= Lc => L0_max = Lc / N
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
    // FREE mode: Continuous interval [5, Lc / N]
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

    const statusMsg = config.grainCountMode === 'fixed'
      ? `Optimizando configuración ${config.shape === 2 ? 'Estrella ' : ''}de ${currentN} granos con Evolución Diferencial...`
      : `Optimizando grano ${config.shape === 2 ? 'Estrella ' : ''}N = ${currentN} de ${N_values.length} [DE/rand/1/bin]...`;

    // Differential Evolution evaluator callback
    const deEvaluator = (rawPhysical: number[]) => {
      // Reconstruct full (D0, d0, d0mayor, L0, Np) from rawPhysical active variables + fixedValues
      let D0 = fixedValues.D0 !== undefined ? fixedValues.D0 : 0;
      let d0 = fixedValues.d0 !== undefined ? fixedValues.d0 : 0;
      let d0mayor = fixedValues.d0mayor !== undefined ? fixedValues.d0mayor : 0;
      let L0 = fixedValues.L0 !== undefined ? fixedValues.L0 : 0;
      let Np = fixedValues.Np !== undefined ? fixedValues.Np : (config.shape === 2 ? 5 : 0);

      for (let i = 0; i < activeVars.length; i++) {
        const vName = activeVars[i];
        if (vName === 'D0') D0 = rawPhysical[i];
        else if (vName === 'd0') d0 = rawPhysical[i];
        else if (vName === 'd0mayor') d0mayor = rawPhysical[i];
        else if (vName === 'L0') L0 = rawPhysical[i];
        else if (vName === 'Np') Np = rawPhysical[i];
      }

      // Continuous precision rounding to avoid tiny floating point chatter in cache
      D0 = parseFloat(D0.toFixed(2));
      d0 = parseFloat(d0.toFixed(2));
      d0mayor = config.shape === 2 ? parseFloat(d0mayor.toFixed(2)) : 0;
      L0 = parseFloat(L0.toFixed(2));
      Np = config.shape === 2 ? Math.max(3, Math.round(Np)) : 0;

      const cacheKey = `${currentN}_${D0}_${d0}_${d0mayor}_${L0}_${Np}`;
      let compEval = evaluationCache.get(cacheKey);

      if (!compEval) {
        totalEvaluationsAcrossAll++;
        nEvaluations++;

        const evalRes = evaluateGeometry(currentN, D0, d0, d0mayor, L0, Np, config, customProps, availableD0);
        
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
          L0
        };

        evaluationCache.set(cacheKey, compEval);

        if (compEval.metrics.burnTime > 0) viableCount++;
        if (compEval.isFeasible) safeCount++;

        // Add to compact evaluated points for UI scatter diagram
        if (compEval.metrics.burnTime > 0) {
          const configLabel = config.shape === 2
            ? `N=${currentN} D0=${D0} d0=${d0} Dp=${d0mayor} Np=${Np} L0=${L0}`
            : `N=${currentN} D0=${D0} d0=${d0} L0=${L0}`;
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
            D0,
            d0,
            d0mayor,
            Np,
            L0,
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
              ? (config.shape === 2
                ? `${globalBestFeasible.N}x [D0=${globalBestFeasible.D0}, d0=${globalBestFeasible.d0}, Dp=${globalBestFeasible.d0mayor}, ${globalBestFeasible.Np}p, L0=${globalBestFeasible.L0}] (${globalBestFeasible.metrics.totalImpulse} N·s)`
                : `${globalBestFeasible.N}x [D0=${globalBestFeasible.D0}, d0=${globalBestFeasible.d0}, L0=${globalBestFeasible.L0}] (${globalBestFeasible.metrics.totalImpulse} N·s)`)
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
        ? (config.shape === 2
          ? `${currentN}x [${nBest.D0}/${nBest.d0}/Dp${nBest.d0mayor}/${nBest.Np}p/${nBest.L0}]`
          : `${currentN}x [${nBest.D0}/${nBest.d0}/${nBest.L0} mm]`)
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

  feasibleList.sort((a, b) => b.metrics.totalImpulse - a.metrics.totalImpulse);
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
            c.L0 === bestForThisN.L0
        )
      ) {
        selectedCompactCandidates.push(bestForThisN);
      }
    }

    for (const cand of feasibleList) {
      if (selectedCompactCandidates.length >= 6) break;
      if (!selectedCompactCandidates.some(c => c.N === cand.N && Math.abs(c.metrics.totalImpulse - cand.metrics.totalImpulse) < 0.5)) {
        selectedCompactCandidates.push(cand);
      }
    }
  } else if (infeasibleList.length > 0) {
    selectedCompactCandidates.push(infeasibleList[0]);
    for (let i = 1; i < Math.min(5, infeasibleList.length); i++) {
      selectedCompactCandidates.push(infeasibleList[i]);
    }
  }

  // 5. Independent Verification Simulation
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
