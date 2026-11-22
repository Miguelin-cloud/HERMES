import {
  BOLT_GRADES,
  BOLT_METRICS,
  BoltGradeId,
  BoltMetricId,
  CustomPropellant,
  GrainInput,
  MOTOR_MATERIALS,
  MotorInput,
  MotorMaterialId,
  NozzleInput,
  getPropellantData,
} from './types';
import { computeStarHoleAreaMm2, getGrainModule } from './grains';

export type PadmGoverningLimit = 'cylinder' | 'bolt_shear' | 'wall_bearing' | 'net_section';

export const DEFAULT_MOTOR_STRUCTURE = {
  wallThickness: 3.0,
  materialId: 'al6082' as MotorMaterialId,
  customMaterialName: '',
  customMaterialDensity: 2700,
  customMaterialYieldMPa: 250,
  safetyFactor: 2.0,
  hasLiner: false,
  linerThickness: 2.0,
  hasInhibitor: true,
  inhibitorThickness: 2.0,
  hasBoltedClosure: true,
  boltMetric: 'M6' as BoltMetricId,
  boltGrade: 'c8_8' as BoltGradeId,
  boltCount: 6,
};

export interface MotorStructureResult {
  materialId: MotorMaterialId;
  densityKgM3: number;
  yieldStrengthMPa: number;
  wallThicknessMm: number;
  safetyFactor: number;
  linerThicknessMm: number;
  inhibitorThicknessMm: number;
  outerDiameterMm: number;
  availableGrainDiameterMm: number;
  // Detailed Admissible Pressure breakdown (room temperature, no thermal derating)
  hasBoltedClosure: boolean;
  boltMetric: BoltMetricId;
  boltGrade: BoltGradeId;
  boltCount: number;
  boltDiameterMm: number;
  boltStressAreaMm2: number;
  boltYieldStrengthMPa: number;
  boreAreaMm2: number;
  cylinderPressureMPa: number;
  boltShearPressureMPa: number | null;
  wallBearingPressureMPa: number | null;
  netSectionPressureMPa: number | null;
  governingLimit: PadmGoverningLimit;
  axialForceAtPadmKN: number;
  boltPitchMm: number | null;
  minEdgeDistanceMm: number | null;
  isBoltSpacingTight: boolean;
  maxAdmissiblePressureMPa: number;
  maxAdmissiblePressureBar: number;
  cylinderMassKg: number;
  closureMassKg: number;
  nozzleMassKg: number;
  motorMassKg: number;
}

export function normalizeMotorWithStructure(motor: Partial<MotorInput> & Pick<MotorInput, 'Dc' | 'Lc' | 'Gstar' | 'kv' | 'etac' | 'paso_de_tiempo' | 'Pamb'>): MotorInput {
  const rawMaterial = (motor.materialId as string | undefined);
  const migratedMaterial: MotorMaterialId =
    rawMaterial === 'ss304' || rawMaterial === 'ss304l' || rawMaterial === 'ss174ph'
      ? 'ss304'
      : rawMaterial === 'custom'
        ? 'custom'
        : 'al6082';
  const rawMetric = motor.boltMetric as BoltMetricId | undefined;
  const boltMetric: BoltMetricId = rawMetric && rawMetric in BOLT_METRICS ? rawMetric : DEFAULT_MOTOR_STRUCTURE.boltMetric;
  const rawGrade = motor.boltGrade as BoltGradeId | undefined;
  const boltGrade: BoltGradeId = rawGrade && rawGrade in BOLT_GRADES ? rawGrade : DEFAULT_MOTOR_STRUCTURE.boltGrade;
  return {
    ...DEFAULT_MOTOR_STRUCTURE,
    ...motor,
    materialId: migratedMaterial,
    boltMetric,
    boltGrade,
    boltCount: Math.max(1, Math.round(Number(motor.boltCount ?? DEFAULT_MOTOR_STRUCTURE.boltCount) || DEFAULT_MOTOR_STRUCTURE.boltCount)),
  };
}

/**
 * Computes structural pressure limits at room temperature:
 * 1) Lamé thick-wall cylinder hoop stress on inner wall: P_cyl = (σy / SF) * (ro² - ri²) / (ro² + ri²)
 * 2) When radial bolted closure is active (smooth casing + inserted O-ring bulkhead/nozzle):
 *    - Bolt single shear (Von Mises τ_y = σy,bolt / √3): P_bolt = (N_b · A_s · τ_adm) / (π·ri²)
 *    - Casing wall hole bearing (σ_br,adm = 1.5·σy,tubo / SF): P_bear = (N_b · d · t · σ_br,adm) / (π·ri²)
 *    - Perforated casing net-section axial tension: P_net = ((π·(ro²-ri²) - N_b·d·t) · σ_adm) / (π·ri²)
 * Global Padm = min of active limits.
 */
export function calculateMotorStructure(motor: MotorInput): MotorStructureResult {
  const dc = Math.max(0, Number(motor.Dc) || 0);
  const lc = Math.max(0, Number(motor.Lc) || 0);
  const wallThicknessMm = Math.max(0, Number(motor.wallThickness ?? DEFAULT_MOTOR_STRUCTURE.wallThickness) || 0);
  const rawMaterial = motor.materialId as string | undefined;
  const materialId: MotorMaterialId =
    rawMaterial === 'ss304' || rawMaterial === 'ss304l' || rawMaterial === 'ss174ph'
      ? 'ss304'
      : rawMaterial === 'custom'
        ? 'custom'
        : 'al6082';
  const safetyFactor = Math.max(0.1, Number(motor.safetyFactor ?? DEFAULT_MOTOR_STRUCTURE.safetyFactor) || DEFAULT_MOTOR_STRUCTURE.safetyFactor);

  let densityKgM3 = MOTOR_MATERIALS.al6082.densityKgM3;
  let yieldStrengthMPa = MOTOR_MATERIALS.al6082.yieldStrengthMPa;

  if (materialId === 'ss304') {
    densityKgM3 = MOTOR_MATERIALS.ss304.densityKgM3;
    yieldStrengthMPa = MOTOR_MATERIALS.ss304.yieldStrengthMPa;
  } else if (materialId === 'custom') {
    densityKgM3 = Math.max(0, Number(motor.customMaterialDensity ?? DEFAULT_MOTOR_STRUCTURE.customMaterialDensity) || 0);
    yieldStrengthMPa = Math.max(0, Number(motor.customMaterialYieldMPa ?? DEFAULT_MOTOR_STRUCTURE.customMaterialYieldMPa) || 0);
  }

  const linerThicknessMm = motor.hasLiner ? Math.max(0, Number(motor.linerThickness ?? DEFAULT_MOTOR_STRUCTURE.linerThickness) || 0) : 0;
  const inhibitorThicknessMm = motor.hasInhibitor ? Math.max(0, Number(motor.inhibitorThickness ?? DEFAULT_MOTOR_STRUCTURE.inhibitorThickness) || 0) : 0;

  const ri = dc / 2;
  const ro = ri + wallThicknessMm;
  const outerDiameterMm = dc + 2 * wallThicknessMm;

  // Available internal diameter for propellant outer D0 after subtracting radial liner + inhibitor
  const availableGrainDiameterMm = dc - 2 * linerThicknessMm - 2 * inhibitorThicknessMm;

  // 1) Lamé circumferential (hoop) stress at inner wall: P_adm = (sigma_y / SF) * (ro^2 - ri^2) / (ro^2 + ri^2)
  const allowStressMPa = yieldStrengthMPa / safetyFactor;
  const cylinderPressureMPa =
    ri > 0 && ro > ri && allowStressMPa > 0
      ? allowStressMPa * ((ro * ro - ri * ri) / (ro * ro + ri * ri))
      : 0;

  // 2) Radial bolted closure checks (smooth tube + inserted O-ring bulkhead/nozzle)
  const hasBoltedClosure = motor.hasBoltedClosure ?? DEFAULT_MOTOR_STRUCTURE.hasBoltedClosure;
  const rawMetric = motor.boltMetric as BoltMetricId | undefined;
  const boltMetric: BoltMetricId = rawMetric && rawMetric in BOLT_METRICS ? rawMetric : DEFAULT_MOTOR_STRUCTURE.boltMetric;
  const rawGrade = motor.boltGrade as BoltGradeId | undefined;
  const boltGrade: BoltGradeId = rawGrade && rawGrade in BOLT_GRADES ? rawGrade : DEFAULT_MOTOR_STRUCTURE.boltGrade;
  const boltCount = Math.max(1, Math.round(Number(motor.boltCount ?? DEFAULT_MOTOR_STRUCTURE.boltCount) || DEFAULT_MOTOR_STRUCTURE.boltCount));

  const metricSpec = BOLT_METRICS[boltMetric];
  const gradeSpec = BOLT_GRADES[boltGrade];
  const boltDiameterMm = metricSpec.diameterMm;
  const boltStressAreaMm2 = metricSpec.stressAreaMm2;
  const boltYieldStrengthMPa = gradeSpec.yieldStrengthMPa;

  const boreAreaMm2 = ri > 0 ? Math.PI * ri * ri : 0;

  let boltShearPressureMPa: number | null = null;
  let wallBearingPressureMPa: number | null = null;
  let netSectionPressureMPa: number | null = null;
  let governingLimit: PadmGoverningLimit = 'cylinder';
  let maxAdmissiblePressureMPa = cylinderPressureMPa;
  let boltPitchMm: number | null = null;
  let minEdgeDistanceMm: number | null = null;
  let isBoltSpacingTight = false;

  if (hasBoltedClosure) {
    if (boreAreaMm2 > 0) {
      // Single shear Von Mises yield stress: tau_adm = (sigma_y_bolt / sqrt(3)) / SF
      const boltAllowShearMPa = (boltYieldStrengthMPa / Math.sqrt(3)) / safetyFactor;
      boltShearPressureMPa = (boltCount * boltStressAreaMm2 * boltAllowShearMPa) / boreAreaMm2;

      // Casing wall bearing yield pressure: sigma_bearing_adm = (1.5 * sigma_y_tube) / SF over projected d * t per bolt
      const allowBearingMPa = 1.5 * allowStressMPa;
      wallBearingPressureMPa =
        wallThicknessMm > 0
          ? (boltCount * boltDiameterMm * wallThicknessMm * allowBearingMPa) / boreAreaMm2
          : 0;

      // Perforated casing net-section axial tension check: A_net = pi*(ro^2 - ri^2) - N_b * d * t
      const grossWallAreaMm2 = Math.PI * Math.max(0, ro * ro - ri * ri);
      const netWallAreaMm2 = Math.max(0, grossWallAreaMm2 - boltCount * boltDiameterMm * wallThicknessMm);
      netSectionPressureMPa = (netWallAreaMm2 * allowStressMPa) / boreAreaMm2;

      const candidates: Array<{ mode: PadmGoverningLimit; p: number }> = [
        { mode: 'cylinder', p: cylinderPressureMPa },
        { mode: 'bolt_shear', p: boltShearPressureMPa },
        { mode: 'wall_bearing', p: wallBearingPressureMPa },
        { mode: 'net_section', p: netSectionPressureMPa },
      ];
      let best = candidates[0];
      for (const c of candidates) {
        if (c.p < best.p) {
          best = c;
        }
      }
      governingLimit = best.mode;
      maxAdmissiblePressureMPa = Math.max(0, best.p);
    } else {
      boltShearPressureMPa = 0;
      wallBearingPressureMPa = 0;
      netSectionPressureMPa = 0;
      maxAdmissiblePressureMPa = 0;
    }

    boltPitchMm = dc > 0 ? (Math.PI * dc) / boltCount : 0;
    minEdgeDistanceMm = 2.5 * boltDiameterMm;
    isBoltSpacingTight = dc > 0 && boltPitchMm < 2.2 * boltDiameterMm;
  }

  const maxAdmissiblePressureBar = maxAdmissiblePressureMPa * 10;
  // Axial ejection force in kN at Padm: F [N] = P [MPa] * A_bore [mm²]
  const axialForceAtPadmKN = (maxAdmissiblePressureMPa * boreAreaMm2) / 1000;

  // Hollow cylinder volume in m^3: pi * (ro^2 - ri^2) * Lc * 1e-9
  const cylVolumeM3 = Math.PI * Math.max(0, ro * ro - ri * ri) * lc * 1e-9;
  const cylinderMassKg = densityKgM3 * cylVolumeM3;
  const closureMassKg = 0.1 * cylinderMassKg;
  const nozzleMassKg = 0.2 * cylinderMassKg;
  const motorMassKg = cylinderMassKg + closureMassKg + nozzleMassKg; // 1.3 * m_cyl

  return {
    materialId,
    densityKgM3,
    yieldStrengthMPa,
    wallThicknessMm,
    safetyFactor,
    linerThicknessMm,
    inhibitorThicknessMm,
    outerDiameterMm,
    availableGrainDiameterMm,
    hasBoltedClosure,
    boltMetric,
    boltGrade,
    boltCount,
    boltDiameterMm,
    boltStressAreaMm2,
    boltYieldStrengthMPa,
    boreAreaMm2,
    cylinderPressureMPa,
    boltShearPressureMPa,
    wallBearingPressureMPa,
    netSectionPressureMPa,
    governingLimit,
    axialForceAtPadmKN,
    boltPitchMm,
    minEdgeDistanceMm,
    isBoltSpacingTight,
    maxAdmissiblePressureMPa,
    maxAdmissiblePressureBar,
    cylinderMassKg,
    closureMassKg,
    nozzleMassKg,
    motorMassKg,
  };
}

export function getMaxGrainOuterDiameter(grains: GrainInput[]): number {
  return Math.max(0, ...grains.map((g) => Number(g.D0) || 0));
}

/**
 * Exact cross-sectional area of a star perforation core (mm^2).
 * Single source of truth shared between simulator.ts and UI mass/clearance previews.
 */
export function calculateStarHoleAreaMm2(d0: number, d0mayor: number, Np: number): number {
  return computeStarHoleAreaMm2(d0, d0mayor, Np);
}

/**
 * Computes initial grain volume (single block & total N blocks), star hole area, and web thickness.
 */
export function calculateGrainVolumeMm3(
  g: Pick<
    GrainInput,
    | 'shape'
    | 'D0'
    | 'd0'
    | 'd0mayor'
    | 'L0'
    | 'N'
    | 'Np'
    | 'finWidth'
    | 'spokeWidth'
    | 'coreOffset'
    | 'slotWidth'
    | 'slotDepth'
    | 'rodDiameter'
  >
): {
  blockVolumeMm3: number;
  totalVolumeMm3: number;
  starHoleAreaMm2: number;
  tweb0: number;
} {
  const geom = getGrainModule(g.shape).getInitialGeometry(g);
  return {
    blockVolumeMm3: geom.blockVolumeMm3,
    totalVolumeMm3: geom.totalVolumeMm3,
    starHoleAreaMm2: geom.starHoleAreaMm2,
    tweb0: geom.tweb0,
  };
}

/**
 * Computes total initial propellant mass across all grains [kg].
 */
export function calculateTotalPropellantMassKg(
  grains: GrainInput[],
  customPropellants?: CustomPropellant[]
): number {
  let mass = 0;
  for (const g of grains) {
    const { totalVolumeMm3 } = calculateGrainVolumeMm3(g);
    const propData = getPropellantData(g.propellantType, customPropellants);
    const rhoreal = propData.rho * (g.rhorat || 1); // g/cm^3
    mass += (rhoreal * totalVolumeMm3) / 1e6; // kg
  }
  return mass;
}

export function calculateTotalGrainsLengthMm(grains: GrainInput[]): number {
  return grains.reduce((acc, g) => acc + (Number(g.L0) || 0) * (Number(g.N) || 0), 0);
}

export interface GrainValidationResult {
  id: string;
  isD0Invalid: boolean;
  isD0ExceedsClearance: boolean;
  isL0Invalid: boolean;
  isGrainLengthExceedsLc: boolean;
  isNInvalid: boolean;
  isd0Invalid: boolean;
  isd0ExceedsD0: boolean;
  isd0ExceedsDc: boolean;
  minD0mayor: number;
  isStarPointsInvalid: boolean;
  isStarValleyTooSmall: boolean;
  isStarValleyExceedsD0: boolean;
  hasStarError: boolean;
  hasShapeGeometryError?: boolean;
  geometryErrorCode?: string | null;
  geometryErrorLimitMm?: number;
  isRhoratInvalid?: boolean;
  hasNoBurnFaces?: boolean;
  hasInvalidPropellant?: boolean;
}

export interface MotorInputsValidation {
  totalGrainsLengthMm: number;
  maxGrainD0Mm: number;
  hasRadialClearanceError: boolean;
  hasLengthOverflow: boolean;
  hasChamberError: boolean;
  hasNozzleError: boolean;
  hasGrainError: boolean;
  hasBlockingError: boolean;
  hasAnyError: boolean;
  isDtInvalid: boolean;
  isEtacInvalid: boolean;
  isPambInvalid: boolean;
  isGstarInvalid: boolean;
  isKvInvalid: boolean;
  isAlphaInvalid: boolean;
  isEtanozInvalid: boolean;
  isThroatSlagInvalid: boolean;
  isDsLtDt0: boolean;
  grainChecks: Record<string, GrainValidationResult>;
}

export function validateMotorInputs(
  motor: MotorInput,
  grains: GrainInput[],
  nozzle: NozzleInput,
  motorStruct?: MotorStructureResult,
  customPropellants?: CustomPropellant[]
): MotorInputsValidation {
  const struct = motorStruct || calculateMotorStructure(motor);
  const totalGrainsLengthMm = calculateTotalGrainsLengthMm(grains);
  const maxGrainD0Mm = getMaxGrainOuterDiameter(grains);

  const hasRadialClearanceError =
    struct.availableGrainDiameterMm <= 0 ||
    maxGrainD0Mm > struct.availableGrainDiameterMm + 1e-6;
  const hasLengthOverflow = totalGrainsLengthMm > motor.Lc;

  const isDtInvalid = !(Number.isFinite(motor.paso_de_tiempo) && motor.paso_de_tiempo > 0);
  const isEtacInvalid = !(Number.isFinite(motor.etac) && motor.etac > 0 && motor.etac <= 1);
  const isPambInvalid = !(Number.isFinite(motor.Pamb) && motor.Pamb > 0);
  const isGstarInvalid = !(Number.isFinite(motor.Gstar) && motor.Gstar >= 0);
  const isKvInvalid = !(Number.isFinite(motor.kv) && motor.kv >= 0);

  const hasChamberError =
    !(Number.isFinite(motor.Dc) && motor.Dc > 0) ||
    !(Number.isFinite(motor.Lc) && motor.Lc > 0) ||
    !(Number.isFinite(struct.wallThicknessMm) && struct.wallThicknessMm > 0) ||
    isDtInvalid ||
    isEtacInvalid ||
    isPambInvalid ||
    isGstarInvalid ||
    isKvInvalid;

  const isAlphaInvalid = !(Number.isFinite(nozzle.alpha) && nozzle.alpha > 0 && nozzle.alpha < 90);
  const isEtanozInvalid = !(Number.isFinite(nozzle.etanoz) && nozzle.etanoz > 0 && nozzle.etanoz <= 1);
  const throatEndMm = (Number(nozzle.Dt0) || 0) + (Number(nozzle.e) || 0);
  const isThroatSlagInvalid = !Number.isFinite(throatEndMm) || throatEndMm <= 0;
  const isDsLtDt0 = Number(nozzle.Ds) < Number(nozzle.Dt0);

  const hasNozzleError =
    !(Number.isFinite(nozzle.Dt0) && nozzle.Dt0 > 0) ||
    !(Number.isFinite(nozzle.Ds) && nozzle.Ds > 0) ||
    isDsLtDt0 ||
    isAlphaInvalid ||
    isEtanozInvalid ||
    isThroatSlagInvalid;

  let hasGrainError = grains.length === 0;
  const grainChecks: Record<string, GrainValidationResult> = {};

  for (const g of grains) {
    const baseChecks = getGrainModule(g.shape).validate(g, motor, struct.availableGrainDiameterMm);
    const isRhoratInvalid = !(Number.isFinite(g.rhorat) && g.rhorat > 0);
    const hasActiveCore = g.shape !== 3 && g.ci === 1;
    const hasNoBurnFaces = g.osi !== 1 && g.ei !== 1 && !hasActiveCore;

    let hasInvalidPropellant = false;
    if (customPropellants) {
      const prop = getPropellantData(g.propellantType, customPropellants);
      if (
        !(prop.rho > 0) ||
        !(prop.T0 > 0) ||
        !(prop.M > 0) ||
        !(prop.k > 1.0) ||
        !prop.pressureRanges ||
        prop.pressureRanges.length === 0 ||
        prop.pressureRanges.some(
          (r) => !Number.isFinite(r.pMin) || !Number.isFinite(r.pMax) || r.pMin >= r.pMax || !(r.a > 0) || !Number.isFinite(r.n)
        )
      ) {
        hasInvalidPropellant = true;
      }
    }

    const checks: GrainValidationResult = {
      ...baseChecks,
      isRhoratInvalid,
      hasNoBurnFaces,
      hasInvalidPropellant,
    };

    if (
      checks.isD0Invalid ||
      checks.isL0Invalid ||
      checks.isNInvalid ||
      checks.isd0Invalid ||
      checks.isd0ExceedsD0 ||
      checks.hasStarError ||
      checks.hasShapeGeometryError ||
      isRhoratInvalid ||
      hasNoBurnFaces ||
      hasInvalidPropellant
    ) {
      hasGrainError = true;
    }

    grainChecks[g.id] = checks;
  }

  const hasBlockingError = hasChamberError || hasNozzleError || hasGrainError;

  return {
    totalGrainsLengthMm,
    maxGrainD0Mm,
    hasRadialClearanceError,
    hasLengthOverflow,
    hasChamberError,
    hasNozzleError,
    hasGrainError,
    hasBlockingError,
    hasAnyError: hasBlockingError,
    isDtInvalid,
    isEtacInvalid,
    isPambInvalid,
    isGstarInvalid,
    isKvInvalid,
    isAlphaInvalid,
    isEtanozInvalid,
    isThroatSlagInvalid,
    isDsLtDt0,
    grainChecks,
  };
}

