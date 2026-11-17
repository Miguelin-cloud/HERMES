import { CustomPropellant, GrainInput, MOTOR_MATERIALS, MotorInput, MotorMaterialId, NozzleInput, getPropellantData } from './types';
import { computeStarHoleAreaMm2, getGrainModule } from './grains';

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
    rawMaterial === 'ss304l' || rawMaterial === 'ss174ph'
      ? 'ss174ph'
      : rawMaterial === 'custom'
        ? 'custom'
        : 'al6082';
  return {
    ...DEFAULT_MOTOR_STRUCTURE,
    ...motor,
    materialId: migratedMaterial,
  };
}

/**
 * Computes structural pressure limits (Lamé thick-wall hoop stress with safety factor),
 * casing/closure/nozzle mass estimation (m_motor = 1.3 * m_cylinder),
 * and radial clearance available for propellant grains considering optional liner & inhibitor.
 */
export function calculateMotorStructure(motor: MotorInput): MotorStructureResult {
  const dc = Math.max(0, Number(motor.Dc) || 0);
  const lc = Math.max(0, Number(motor.Lc) || 0);
  const wallThicknessMm = Math.max(0, Number(motor.wallThickness ?? DEFAULT_MOTOR_STRUCTURE.wallThickness) || 0);
  const rawMaterial = motor.materialId as string | undefined;
  const materialId: MotorMaterialId =
    rawMaterial === 'ss174ph' || rawMaterial === 'ss304l'
      ? 'ss174ph'
      : rawMaterial === 'custom'
        ? 'custom'
        : 'al6082';
  const safetyFactor = Math.max(0.1, Number(motor.safetyFactor ?? DEFAULT_MOTOR_STRUCTURE.safetyFactor) || DEFAULT_MOTOR_STRUCTURE.safetyFactor);

  let densityKgM3 = MOTOR_MATERIALS.al6082.densityKgM3;
  let yieldStrengthMPa = MOTOR_MATERIALS.al6082.yieldStrengthMPa;

  if (materialId === 'ss174ph') {
    densityKgM3 = MOTOR_MATERIALS.ss174ph.densityKgM3;
    yieldStrengthMPa = MOTOR_MATERIALS.ss174ph.yieldStrengthMPa;
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

  // Lamé circumferential (hoop) stress at inner wall: P_adm = (sigma_y / SF) * (ro^2 - ri^2) / (ro^2 + ri^2)
  const allowStressMPa = yieldStrengthMPa / safetyFactor;
  const maxAdmissiblePressureMPa =
    ri > 0 && ro > ri && allowStressMPa > 0
      ? allowStressMPa * ((ro * ro - ri * ri) / (ro * ro + ri * ri))
      : 0;
  const maxAdmissiblePressureBar = maxAdmissiblePressureMPa * 10;

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
export function calculateGrainVolumeMm3(g: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'Np'>): {
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
}

export interface MotorInputsValidation {
  totalGrainsLengthMm: number;
  maxGrainD0Mm: number;
  hasRadialClearanceError: boolean;
  hasLengthOverflow: boolean;
  hasChamberError: boolean;
  hasNozzleError: boolean;
  hasAnyError: boolean;
  grainChecks: Record<string, GrainValidationResult>;
}

export function validateMotorInputs(
  motor: MotorInput,
  grains: GrainInput[],
  nozzle: NozzleInput,
  motorStruct?: MotorStructureResult
): MotorInputsValidation {
  const struct = motorStruct || calculateMotorStructure(motor);
  const totalGrainsLengthMm = calculateTotalGrainsLengthMm(grains);
  const maxGrainD0Mm = getMaxGrainOuterDiameter(grains);

  const hasRadialClearanceError =
    struct.availableGrainDiameterMm <= 0 ||
    maxGrainD0Mm > struct.availableGrainDiameterMm + 1e-6;
  const hasLengthOverflow = totalGrainsLengthMm > motor.Lc;
  const hasChamberError = motor.Dc <= 0 || motor.Lc <= 0 || struct.wallThicknessMm <= 0;
  const hasNozzleError = nozzle.Dt0 <= 0 || nozzle.Ds <= 0 || nozzle.Ds < nozzle.Dt0;

  let hasGrainError = grains.length === 0;
  const grainChecks: Record<string, GrainValidationResult> = {};

  for (const g of grains) {
    const checks = getGrainModule(g.shape).validate(g, motor, struct.availableGrainDiameterMm);
    if (
      checks.isD0Invalid ||
      checks.isL0Invalid ||
      checks.isNInvalid ||
      checks.isd0Invalid ||
      checks.hasStarError
    ) {
      hasGrainError = true;
    }

    grainChecks[g.id] = checks;
  }

  return {
    totalGrainsLengthMm,
    maxGrainD0Mm,
    hasRadialClearanceError,
    hasLengthOverflow,
    hasChamberError,
    hasNozzleError,
    hasAnyError: hasChamberError || hasNozzleError || hasGrainError,
    grainChecks,
  };
}

