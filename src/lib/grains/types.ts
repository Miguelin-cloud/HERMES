import { CustomPropellant, GrainInput, MotorInput, NozzleInput } from '../types';

export type GrainShapeId = 1 | 2 | 3;

/**
 * Estrategia de cálculo de regresión por tipo de grano:
 * - 'analytical': ecuaciones cerradas exactas y ultrarrápidas (BATES, Macizo).
 * - 'clipper': Polygon Offsetting vectorial exacto con Clipper2 para geometrías complejas (Estrella y futuras formas).
 */
export type GrainSolverMode = 'analytical' | 'clipper';

export interface GrainPoint2D {
  x: number;
  y: number;
}

export type GrainContourLoop = GrainPoint2D[];

/**
 * Muestra precalculada de regresión para una profundidad de quemado x [mm].
 * Desacopla el solver vectorial Clipper2 de la integración temporal en simulator.ts.
 */
export interface GrainBurnbackSample {
  xMm: number;
  crossSectionAreaMm2: number; // Área transversal de propelente restante [mm²]
  portAreaMm2: number; // Área de paso libre interior [mm²]
  innerBurnPerimeterMm: number; // Perímetro de quemado interno activo [mm]
  outerBurnPerimeterMm: number; // Perímetro de quemado externo activo [mm]
  contoursMm?: GrainContourLoop[]; // Polilíneas de referencia para visores 2D/3D
}

export interface GrainBurnbackTable {
  solver: 'clipper';
  gridSize: number;
  xMaxMm: number; // Espesor de alma real (tweb0) extraído de la geometría
  samples: GrainBurnbackSample[];
}

export interface GrainInitialGeometry {
  blockVolumeMm3: number;
  totalVolumeMm3: number;
  crossSectionAreaMm2: number;
  portAreaMm2: number;
  starHoleAreaMm2: number; // Mantiene compatibilidad exacta con motorStructure
  tweb0: number;
}

export interface GrainInitialAreas {
  Abe: number;
  Abc: number;
  Abs: number;
  Ab: number;
}

export interface GrainRuntimeContext {
  motor: MotorInput;
  nozzle: NozzleInput;
  prop: CustomPropellant;
  customPropellants?: CustomPropellant[];
  geometryQuality?: 'fast' | 'high';
}

/**
 * Estado en tiempo de ejecución de un bloque de grano dentro del simulador.
 * Mantiene los mismos nombres de variables de área, volumen y regresión de simulator.ts
 * para garantizar compatibilidad total con la física balística y TTI.
 */
export interface GrainRuntimeState extends GrainInput {
  tweb0: number;
  d: number;
  D: number;
  L: number;
  tweb: number;
  Vg: number;
  mg: number;
  dmayor: number;
  dmenor: number;
  Abe: number;
  Abc: number;
  Abs: number;
  Ab: number;
  prop: CustomPropellant;
  rhoreal: number;
  Aduct: number;
  xincp: number;
  x: number;
  betha: number;
  pablo: number;
  miguel: number;
  alpha_deg: number;
  At: number;
  solverMode: GrainSolverMode;
  burnbackTable?: GrainBurnbackTable;
}

export interface GrainStepEvaluation {
  isConsumed: boolean;
  d: number;
  D: number;
  L: number;
  dmenor: number;
  dmayor: number;
  tweb: number;
  Vg: number;
  Abe: number;
  Abc: number;
  Abs: number;
  Ab: number;
  Aduct: number;
  betha?: number;
}

export interface GrainCrossSectionPrimitives {
  outerRadiusMm: number;
  innerCircleRadiusMm: number | null;
  innerPolygonMm: GrainPoint2D[] | null;
}

export interface GrainValidationChecks {
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

export interface GrainGeometryModule {
  readonly shape: GrainShapeId;
  readonly key: 'bates' | 'star' | 'solid';
  readonly solverMode: GrainSolverMode;

  getInitialGeometry(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'Np'>
  ): GrainInitialGeometry;

  computeInitialAduct(grain: GrainInput, motorDcMm: number): number;

  computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas;

  createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState;

  evaluateAtBurnDepth(
    state: GrainRuntimeState,
    xMm: number,
    motorDcMm: number
  ): GrainStepEvaluation;

  validate(
    grain: GrainInput,
    motor: Pick<MotorInput, 'Dc' | 'Lc'>,
    availableGrainDiameterMm: number
  ): GrainValidationChecks;

  getCrossSectionPrimitives(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'Np' | 'osi' | 'ci'>,
    xBurnMm?: number
  ): GrainCrossSectionPrimitives;

  getCrossSectionContoursMm?(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'Np' | 'osi' | 'ci'>,
    xBurnMm: number,
    burnbackTable?: GrainBurnbackTable | null
  ): GrainContourLoop[] | null;
}

/**
 * Interpola linealmente una tabla de quemado precalculada (Clipper2)
 * y la traduce directamente a las áreas, volumen y paso libre que espera simulator.ts.
 */
export function evaluateBurnbackTableAtDepth(
  table: GrainBurnbackTable,
  xMm: number,
  grain: Pick<GrainInput, 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'ei' | 'ci' | 'osi'>,
  motorDcMm: number
): GrainStepEvaluation {
  const L = grain.L0 * grain.N - grain.ei * 2 * grain.N * xMm;
  const chamberArea = (Math.PI / 4) * Math.pow(motorDcMm, 2);

  if (L <= 0 || xMm >= table.xMaxMm || table.samples.length === 0) {
    return {
      isConsumed: true,
      d: 0,
      D: 0,
      L: 0,
      dmenor: 0,
      dmayor: 0,
      tweb: 0,
      Vg: 0,
      Abe: 0,
      Abc: 0,
      Abs: 0,
      Ab: 1e-4,
      Aduct: chamberArea,
    };
  }

  const samples = table.samples;
  const clampedX = Math.max(0, xMm);

  let s0 = samples[0];
  let s1 = samples[samples.length - 1];

  if (clampedX <= s0.xMm) {
    s1 = s0;
  } else if (clampedX >= s1.xMm) {
    s0 = s1;
  } else {
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].xMm <= clampedX) lo = mid;
      else hi = mid;
    }
    s0 = samples[lo];
    s1 = samples[hi];
  }

  const span = s1.xMm - s0.xMm;
  const alpha = span > 1e-12 ? (clampedX - s0.xMm) / span : 0;

  const crossArea = s0.crossSectionAreaMm2 + alpha * (s1.crossSectionAreaMm2 - s0.crossSectionAreaMm2);
  const innerPerim = s0.innerBurnPerimeterMm + alpha * (s1.innerBurnPerimeterMm - s0.innerBurnPerimeterMm);
  const outerPerim = s0.outerBurnPerimeterMm + alpha * (s1.outerBurnPerimeterMm - s0.outerBurnPerimeterMm);

  if (crossArea <= 1e-6) {
    return {
      isConsumed: true,
      d: 0,
      D: 0,
      L: 0,
      dmenor: 0,
      dmayor: 0,
      tweb: 0,
      Vg: 0,
      Abe: 0,
      Abc: 0,
      Abs: 0,
      Ab: 1e-4,
      Aduct: chamberArea,
    };
  }

  const Abe = grain.ei * 2 * grain.N * crossArea;
  const Abc = grain.ci * innerPerim * L;
  const Abs = grain.osi * outerPerim * L;
  const Ab = Math.max(1e-4, Abe + Abc + Abs);
  const Vg = crossArea * L;
  const Aduct = Math.max(1e-6, chamberArea - crossArea);
  const tweb = Math.max(0, table.xMaxMm - clampedX);
  const D = Math.max(1e-4, grain.D0 - grain.osi * 2 * clampedX);
  const d = Math.min(D, grain.d0 + grain.ci * 2 * clampedX);
  const dmayor = Math.min(D, grain.d0mayor + grain.ci * 2 * clampedX);

  return {
    isConsumed: false,
    d,
    D,
    L,
    dmenor: d,
    dmayor,
    tweb,
    Vg,
    Abe,
    Abc,
    Abs,
    Ab,
    Aduct,
  };
}

/**
 * Devuelve los contornos reales (en mm) más cercanos a la profundidad xMm desde una tabla de quemado.
 */
export function getBurnbackContoursAtDepth(
  table: GrainBurnbackTable | null | undefined,
  xMm: number
): GrainContourLoop[] | null {
  if (!table || table.samples.length === 0) return null;
  if (xMm >= table.xMaxMm) return [];

  const clampedX = Math.max(0, xMm);
  const samples = table.samples;

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s.contoursMm) continue;
    const dist = Math.abs(s.xMm - clampedX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return samples[bestIdx]?.contoursMm ?? null;
}
