import { CustomGrainShape, CustomPropellant, GrainInput, GrainShapeId, MotorInput, NozzleInput } from '../types';

export type { GrainShapeId };

/**
 * Estrategia de cálculo de regresión por tipo de grano:
 * - 'analytical': ecuaciones cerradas exactas y ultrarrápidas (BATES, Macizo).
 * - 'clipper': Polygon Offsetting vectorial exacto con Clipper2 para geometrías complejas.
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

export interface GrainBurnbackSlopes {
  area: number[];
  innerPerim: number[];
  outerPerim: number[];
}

export interface GrainBurnbackTable {
  solver: 'clipper';
  gridSize: number;
  xMaxMm: number; // Espesor de alma real (tweb0) extraído de la geometría
  samples: GrainBurnbackSample[];
  pchipSlopes?: GrainBurnbackSlopes;
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
  customGrainShapes?: CustomGrainShape[];
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
  isConsumed?: boolean;
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
  hasShapeGeometryError?: boolean;
  geometryErrorCode?: string | null;
  geometryErrorLimitMm?: number;
}

export type GrainShapeKey =
  | 'bates'
  | 'star'
  | 'solid'
  | 'finocyl'
  | 'moonburner'
  | 'cslot'
  | 'dgrain'
  | 'rodtube'
  | 'wagonwheel'
  | 'custom';

export interface GrainGeometryModule {
  readonly shape: GrainShapeId;
  readonly key: GrainShapeKey;
  readonly solverMode: GrainSolverMode;

  getInitialGeometry(
    grain: Pick<
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
      | 'customGrainId'
      | 'customGrainSnapshot'
    > & Partial<Pick<GrainInput, 'osi' | 'ci' | 'ei'>>
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
    grain: Pick<
      GrainInput,
      | 'shape'
      | 'D0'
      | 'd0'
      | 'd0mayor'
      | 'Np'
      | 'osi'
      | 'ci'
      | 'finWidth'
      | 'spokeWidth'
      | 'coreOffset'
      | 'slotWidth'
      | 'slotDepth'
      | 'rodDiameter'
      | 'customGrainId'
      | 'customGrainSnapshot'
    >,
    xBurnMm?: number
  ): GrainCrossSectionPrimitives;

  getCrossSectionContoursMm?(
    grain: Pick<
      GrainInput,
      | 'shape'
      | 'D0'
      | 'd0'
      | 'd0mayor'
      | 'L0'
      | 'Np'
      | 'osi'
      | 'ci'
      | 'finWidth'
      | 'spokeWidth'
      | 'coreOffset'
      | 'slotWidth'
      | 'slotDepth'
      | 'rodDiameter'
      | 'customGrainId'
      | 'customGrainSnapshot'
    >,
    xBurnMm: number,
    burnbackTable?: GrainBurnbackTable | null
  ): GrainContourLoop[] | null;
}

function computePchipSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d = new Array<number>(n).fill(0);
  if (n < 2) return d;
  if (n === 2) {
    const h = xs[1] - xs[0];
    const s = h > 1e-12 ? (ys[1] - ys[0]) / h : 0;
    return [s, s];
  }

  const h = new Array<number>(n - 1);
  const delta = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = Math.max(1e-12, xs[i + 1] - xs[i]);
    delta[i] = (ys[i + 1] - ys[i]) / h[i];
  }

  for (let k = 1; k < n - 1; k++) {
    const d0 = delta[k - 1];
    const d1 = delta[k];
    if (d0 * d1 <= 0) {
      d[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      d[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }

  const edgeSlope = (h0: number, h1: number, del0: number, del1: number): number => {
    let s = ((2 * h0 + h1) * del0 - h0 * del1) / (h0 + h1);
    if (s * del0 <= 0) {
      s = 0;
    } else if (del0 * del1 <= 0 && Math.abs(s) > Math.abs(3 * del0)) {
      s = 3 * del0;
    } else if (Math.abs(s) > Math.abs(3 * del0)) {
      s = 3 * del0;
    }
    return s;
  };

  d[0] = edgeSlope(h[0], h[1], delta[0], delta[1]);
  d[n - 1] = edgeSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);
  return d;
}

function getOrBuildTablePchipSlopes(table: GrainBurnbackTable): GrainBurnbackSlopes {
  if (table.pchipSlopes && table.pchipSlopes.area.length === table.samples.length) {
    return table.pchipSlopes;
  }
  const samples = table.samples;
  const xs = samples.map((s) => s.xMm);
  const slopes: GrainBurnbackSlopes = {
    area: computePchipSlopes(xs, samples.map((s) => s.crossSectionAreaMm2)),
    innerPerim: computePchipSlopes(xs, samples.map((s) => s.innerBurnPerimeterMm)),
    outerPerim: computePchipSlopes(xs, samples.map((s) => s.outerBurnPerimeterMm)),
  };
  table.pchipSlopes = slopes;
  return slopes;
}

function evalPchipSegment(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  d0: number,
  d1: number,
  x: number
): number {
  const h = x1 - x0;
  if (h <= 1e-12) return y0;
  const t = Math.max(0, Math.min(1, (x - x0) / h));
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * y0 + h10 * h * d0 + h01 * y1 + h11 * h * d1;
}

/**
 * Interpola con Hermite cúbica monótona (PCHIP C1) una tabla de quemado precalculada (Clipper2)
 * para garantizar derivada dVg/dx continua sin dientes de sierra ni escalones artificiales,
 * respetando exactamente todos los puntos físicos medidos.
 */
export function evaluateBurnbackTableAtDepth(
  table: GrainBurnbackTable,
  xMm: number,
  grain: Pick<GrainInput, 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'ei' | 'ci' | 'osi'> &
    Partial<Pick<GrainInput, 'shape'>>,
  motorDcMm: number
): GrainStepEvaluation {
  const chamberArea = (Math.PI / 4) * Math.pow(motorDcMm, 2);
  const L = grain.L0 * grain.N - grain.ei * 2 * grain.N * xMm;
  const effectiveMaxX =
    grain.ei && grain.L0 > 0
      ? Math.min(table.xMaxMm, grain.L0 * 0.5)
      : table.xMaxMm;

  if (L <= 0 || xMm >= effectiveMaxX || table.samples.length === 0) {
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
      Ab: 0,
      Aduct: chamberArea,
    };
  }

  const samples = table.samples;
  const clampedX = Math.max(0, xMm);

  let lo = 0;
  let hi = samples.length - 1;

  if (clampedX <= samples[0].xMm) {
    hi = 0;
  } else if (clampedX >= samples[hi].xMm) {
    lo = hi;
  } else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].xMm <= clampedX) lo = mid;
      else hi = mid;
    }
  }

  const s0 = samples[lo];
  const s1 = samples[hi];
  let crossArea = s0.crossSectionAreaMm2;
  let innerPerim = s0.innerBurnPerimeterMm;
  let outerPerim = s0.outerBurnPerimeterMm;

  if (lo !== hi) {
    const slopes = getOrBuildTablePchipSlopes(table);
    crossArea = Math.max(
      0,
      evalPchipSegment(
        s0.xMm,
        s1.xMm,
        s0.crossSectionAreaMm2,
        s1.crossSectionAreaMm2,
        slopes.area[lo],
        slopes.area[hi],
        clampedX
      )
    );
    innerPerim = Math.max(
      0,
      evalPchipSegment(
        s0.xMm,
        s1.xMm,
        s0.innerBurnPerimeterMm,
        s1.innerBurnPerimeterMm,
        slopes.innerPerim[lo],
        slopes.innerPerim[hi],
        clampedX
      )
    );
    outerPerim = Math.max(
      0,
      evalPchipSegment(
        s0.xMm,
        s1.xMm,
        s0.outerBurnPerimeterMm,
        s1.outerBurnPerimeterMm,
        slopes.outerPerim[lo],
        slopes.outerPerim[hi],
        clampedX
      )
    );
  }

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
      Ab: 0,
      Aduct: chamberArea,
    };
  }

  const Abe = grain.ei * 2 * grain.N * crossArea;
  const Abc = grain.ci * innerPerim * L;
  const Abs = grain.osi * outerPerim * L;
  const Ab = Math.max(0, Abe + Abc + Abs);
  const Vg = crossArea * L;
  const Aduct = Math.max(1e-6, chamberArea - crossArea);
  const tweb = Math.max(0, effectiveMaxX - clampedX);
  const D = Math.max(1e-4, grain.D0 - grain.osi * 2 * clampedX);

  let d = Math.min(D, Math.max(0, grain.d0 || 0) + grain.ci * 2 * clampedX);
  let dmayor = Math.min(D, Math.max(0, grain.d0mayor || 0) + grain.ci * 2 * clampedX);
  if (grain.shape === 10) {
    const grainEnvArea = (Math.PI / 4) * D * D;
    const portAreaApprox = Math.max(0, grainEnvArea - crossArea);
    const dEq = Math.min(D, 2 * Math.sqrt(portAreaApprox / Math.PI));
    d = dEq;
    dmayor = dEq;
  }

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
