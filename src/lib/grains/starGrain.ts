import { GrainInput, MotorInput } from '../types';
import {
  buildStarCoreLoopMm,
  estimateClipperWebThicknessMm,
  measureInitialCrossSectionClipper,
  solveClipperCrossSectionAtDepth,
  solveGrainBurnbackClipper,
} from './clipperSolver';
import {
  evaluateBurnbackTableAtDepth,
  GrainBurnbackTable,
  GrainContourLoop,
  GrainCrossSectionPrimitives,
  GrainGeometryModule,
  GrainInitialAreas,
  GrainInitialGeometry,
  GrainPoint2D,
  GrainRuntimeContext,
  GrainRuntimeState,
  GrainStepEvaluation,
  GrainValidationChecks,
} from './types';

const STAR_BURNBACK_CACHE_LIMIT = 64;
const starBurnbackCache = new Map<string, GrainBurnbackTable>();
const STAR_SLICE_CACHE_LIMIT = 256;
const starSliceCache = new Map<string, GrainContourLoop[]>();
const STAR_WEB_CACHE_LIMIT = 128;
const starWebCache = new Map<string, number>();

/**
 * Exact minimum valley diameter (d0mayor / Dp) required for a concave star core:
 * Dp_min = d0 / cos(pi / Np). For Dp <= Dp_min the 2*Np-gon degenerates into a
 * convex polygon (e.g., pentagon for Np=5) with zero star arm concavity.
 */
export function getMinStarValleyDiameterMm(d0: number, Np: number): number {
  const safeD0 = Math.max(0, Number(d0) || 0);
  const points = Math.round(Number(Np) || 0);
  if (safeD0 <= 0 || points < 3) {
    return safeD0;
  }
  return safeD0 / Math.cos(Math.PI / points);
}

export function computeStarHoleAreaMm2(d0: number, d0mayor: number, Np: number): number {
  const points = Math.max(3, Np || 5);
  return (
    points * 0.5 * (d0mayor / 2 - (d0 / 2) * Math.cos(Math.PI / points)) * d0 * Math.sin(Math.PI / points) +
    points * 0.5 * Math.pow(d0 / 2, 2) * Math.sin((2 * Math.PI) / points)
  );
}

export function buildStarPolygonPointsMm(d0: number, d0mayor: number, Np: number, D0: number): GrainPoint2D[] {
  const pointsCount = Math.max(3, Math.round(Np || 5));
  const rTip = Math.max(0, d0 / 2);
  const rValley = Math.max(0, d0mayor / 2);
  const rMax = Math.max(0, D0 / 2);
  const pts: GrainPoint2D[] = [];

  for (let k = 0; k < pointsCount * 2; k++) {
    const angle = (Math.PI * 2 * k) / (pointsCount * 2);
    const isTip = k % 2 === 0;
    const r = Math.min(rMax, isTip ? rTip : rValley);
    pts.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    });
  }
  return pts;
}

export function getOrComputeStarBurnbackTable(
  grain: Pick<GrainInput, 'D0' | 'd0' | 'd0mayor' | 'Np' | 'ci' | 'osi' | 'L0'>,
  options?: {
    circleSegments?: number;
    sampleCount?: number;
    arcToleranceMm?: number;
    includeContours?: boolean;
  }
): GrainBurnbackTable {
  const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
  const rTip = Math.max(0.05, Math.min(outerR - 0.1, (Number(grain.d0) || 2) / 2));
  const rValley = Math.max(
    rTip + 0.05,
    Math.min(outerR - 0.02, (Number(grain.d0mayor) || rTip * 2.5) / 2)
  );
  const Np = Math.max(3, Math.round(Number(grain.Np) || 5));
  const ci = grain.ci ? 1 : 0;
  const osi = grain.osi ? 1 : 0;
  const circleSegments = options?.circleSegments ?? 144;
  const sampleCount = options?.sampleCount ?? 112;
  const includeContours = options?.includeContours ?? false;
  const arcToleranceMm =
    options?.arcToleranceMm ?? Math.max(0.01, Math.min(0.025, outerR * 4e-4));
  // L0 solo influye en xMax si ci===0 && osi===0
  const effectiveL0 = ci === 0 && osi === 0 ? Math.max(1, Number(grain.L0) || 50) : 0;

  const cacheKey = `${outerR.toFixed(4)}|${rTip.toFixed(4)}|${rValley.toFixed(4)}|${Np}|${ci}|${osi}|${effectiveL0.toFixed(3)}|${circleSegments}|${sampleCount}|${arcToleranceMm.toFixed(4)}|${includeContours ? 1 : 0}`;
  const cached = starBurnbackCache.get(cacheKey);
  if (cached) {
    // Refrescar orden LRU
    starBurnbackCache.delete(cacheKey);
    starBurnbackCache.set(cacheKey, cached);
    return cached;
  }

  const criticalDepthsMm: number[] = [];
  if (ci + osi > 0) {
    criticalDepthsMm.push((outerR - rValley) / (ci + osi));
  }

  const table = solveGrainBurnbackClipper({
    outerRadiusMm: outerR,
    ci,
    osi,
    L0: Math.max(1, Number(grain.L0) || 50),
    innerVoidLoopsMm: [buildStarCoreLoopMm(rTip, rValley, Np)],
    circleSegments,
    sampleCount,
    arcToleranceMm,
    includeContours,
    criticalDepthsMm,
  });

  if (starBurnbackCache.size >= STAR_BURNBACK_CACHE_LIMIT) {
    const oldestKey = starBurnbackCache.keys().next().value;
    if (oldestKey !== undefined) {
      starBurnbackCache.delete(oldestKey);
    }
  }
  starBurnbackCache.set(cacheKey, table);
  return table;
}

/**
 * Módulo de geometría en Estrella (shape = 2).
 * Resuelve el quemado real 2D mediante Polygon Offsetting vectorial exacto (Clipper2),
 * capturando redondeo de puntas por Huygens, transición al diámetro exterior y separación en slivers.
 */
export const starGrainModule: GrainGeometryModule = {
  shape: 2,
  key: 'star',
  solverMode: 'clipper',

  getInitialGeometry(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'Np'> &
      Partial<Pick<GrainInput, 'osi' | 'ci' | 'ei'>>
  ): GrainInitialGeometry {
    const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
    const rTip = Math.max(0.05, Math.min(outerR - 0.1, (Number(grain.d0) || 2) / 2));
    const rValley = Math.max(
      rTip + 0.05,
      Math.min(outerR - 0.02, (Number(grain.d0mayor) || rTip * 2.5) / 2)
    );
    const Np = Math.max(3, Math.round(Number(grain.Np) || 5));
    const voidLoop = [buildStarCoreLoopMm(rTip, rValley, Np)];
    const measured = measureInitialCrossSectionClipper(outerR, voidLoop, {
      ci: 1,
      osi: 1,
      circleSegments: 144,
    });
    const starHoleAreaMm2 = measured.portAreaMm2;
    const crossSectionAreaMm2 = measured.crossSectionAreaMm2;
    const blockVolumeMm3 = Math.max(0, crossSectionAreaMm2 * (grain.L0 || 0));
    const totalVolumeMm3 = Math.max(0, blockVolumeMm3 * (grain.N || 0));

    const ci = grain.ci !== undefined ? (grain.ci ? 1 : 0) : 1;
    const osi = grain.osi !== undefined ? (grain.osi ? 1 : 0) : 0;
    const ei = grain.ei !== undefined ? (grain.ei ? 1 : 0) : 0;
    const L0 = Math.max(0, Number(grain.L0) || 0);
    const webKey = `${outerR.toFixed(3)}|${rTip.toFixed(3)}|${rValley.toFixed(3)}|${Np}|${ci}|${osi}|${ei}|${ei ? L0.toFixed(2) : '0'}`;
    let tweb0 = starWebCache.get(webKey);
    if (tweb0 === undefined) {
      tweb0 = estimateClipperWebThicknessMm({
        outerRadiusMm: outerR,
        ci,
        osi,
        ei,
        L0,
        innerVoidLoopsMm: voidLoop,
      });
      if (starWebCache.size >= STAR_WEB_CACHE_LIMIT) {
        const oldest = starWebCache.keys().next().value;
        if (oldest !== undefined) starWebCache.delete(oldest);
      }
      starWebCache.set(webKey, tweb0);
    }

    return {
      blockVolumeMm3,
      totalVolumeMm3,
      crossSectionAreaMm2,
      portAreaMm2: starHoleAreaMm2,
      starHoleAreaMm2,
      tweb0,
    };
  },

  computeInitialAduct(grain: GrainInput, motorDcMm: number): number {
    const geom = this.getInitialGeometry(grain);
    return (
      (Math.PI / 4) * Math.pow(motorDcMm, 2) -
      geom.crossSectionAreaMm2
    );
  },

  computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas {
    const Np = grain.Np || 5;
    const starHoleArea = computeStarHoleAreaMm2(grain.d0, grain.d0mayor, Np);
    const armLength = Math.sqrt(
      Math.pow(grain.d0mayor / 2 - (grain.d0 / 2) * Math.cos(Math.PI / Np), 2) +
        Math.pow((grain.d0 / 2) * Math.sin(Math.PI / Np), 2)
    );

    const Abe = grain.ei * 2 * grain.N * ((Math.PI / 4) * Math.pow(grain.D0, 2) - starHoleArea);
    const Abc = grain.ci * 2 * Np * armLength * totalLengthMm;
    const Abs = grain.osi * Math.PI * grain.D0 * totalLengthMm;
    const Ab = Math.max(0, Abe + Abc + Abs);

    return { Abe, Abc, Abs, Ab };
  },

  createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState {
    const isFast = context.geometryQuality === 'fast';
    const burnbackTable = getOrComputeStarBurnbackTable(grain, {
      circleSegments: isFast ? 96 : 144,
      sampleCount: isFast ? 42 : 112,
      arcToleranceMm: isFast ? 0.025 : undefined,
      includeContours: false,
    });

    const eval0 = evaluateBurnbackTableAtDepth(burnbackTable, 0, grain, context.motor.Dc);
    const Lg0 = grain.L0 * grain.N;
    const Vg0 = eval0.Vg;
    const rhoreal = context.prop.rho * grain.rhorat;
    const mg0 = (rhoreal * Vg0) / 1e6;
    const tweb0 = eval0.tweb;

    return {
      ...grain,
      tweb0,
      d: grain.d0,
      D: grain.D0,
      L: Lg0,
      tweb: tweb0,
      Vg: Vg0,
      mg: mg0,
      dmayor: grain.d0mayor,
      dmenor: grain.d0,
      Abe: eval0.Abe,
      Abc: eval0.Abc,
      Abs: eval0.Abs,
      Ab: eval0.Ab,
      prop: context.prop,
      rhoreal,
      Aduct: eval0.Aduct,
      xincp: 0,
      x: 0,
      betha: (2 * Math.PI) / (grain.Np || 5),
      pablo: 1,
      miguel: 1,
      alpha_deg: context.nozzle.alpha || 12,
      At: (Math.PI / 4) * Math.pow(context.nozzle.Dt0, 2),
      solverMode: 'clipper',
      burnbackTable,
    };
  },

  evaluateAtBurnDepth(
    state: GrainRuntimeState,
    xMm: number,
    motorDcMm: number
  ): GrainStepEvaluation {
    const table =
      state.burnbackTable ??
      getOrComputeStarBurnbackTable(state, {
        circleSegments: 144,
        sampleCount: 112,
        includeContours: false,
      });

    return evaluateBurnbackTableAtDepth(table, xMm, state, motorDcMm);
  },

  validate(
    grain: GrainInput,
    motor: Pick<MotorInput, 'Dc' | 'Lc'>,
    availableGrainDiameterMm: number
  ): GrainValidationChecks {
    // Exige condición geométrica estricta de estrella cóncava: d0mayor > d0 / cos(pi / Np)
    // Si d0mayor <= d0 / cos(pi / Np), la cavidad degenera en un polígono convexo (ej. pentágono) sin puntas de estrella.
    const points = Math.round(grain.Np || 0);
    const minD0mayor = getMinStarValleyDiameterMm(grain.d0, points);
    const isStarPointsInvalid = grain.Np < 3 || points < 3;
    const isStarValleyTooSmall = grain.d0mayor <= minD0mayor + 1e-6;
    const isStarValleyExceedsD0 = grain.d0mayor >= grain.D0;
    const hasStarError =
      grain.d0mayor <= 0 || isStarPointsInvalid || isStarValleyTooSmall || isStarValleyExceedsD0;

    return {
      id: grain.id,
      isD0Invalid: grain.D0 <= 0,
      isD0ExceedsClearance: grain.D0 > availableGrainDiameterMm + 1e-6,
      isL0Invalid: grain.L0 <= 0,
      isGrainLengthExceedsLc: grain.L0 * grain.N > motor.Lc,
      isNInvalid: grain.N < 1,
      isd0Invalid: grain.d0 <= 0,
      isd0ExceedsD0: grain.d0 >= grain.D0,
      isd0ExceedsDc: grain.d0 >= motor.Dc,
      minD0mayor,
      isStarPointsInvalid,
      isStarValleyTooSmall,
      isStarValleyExceedsD0,
      hasStarError,
    };
  },

  getCrossSectionPrimitives(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'Np' | 'osi' | 'ci'>,
    xBurnMm: number = 0
  ): GrainCrossSectionPrimitives {
    const outerRadiusMm = Math.max(0, grain.D0 / 2 - (grain.osi || 0) * xBurnMm);
    const d0Now = grain.d0 + 2 * (grain.ci || 0) * xBurnMm;
    const d0mayorNow = grain.d0mayor + 2 * (grain.ci || 0) * xBurnMm;
    return {
      outerRadiusMm,
      innerCircleRadiusMm: null,
      innerPolygonMm: buildStarPolygonPointsMm(d0Now, d0mayorNow, grain.Np || 5, outerRadiusMm * 2),
    };
  },

  getCrossSectionContoursMm(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'Np' | 'osi' | 'ci'>,
    xBurnMm: number,
    burnbackTable?: GrainBurnbackTable | null
  ): GrainContourLoop[] | null {
    const xClamped = Math.max(0, xBurnMm);
    if (burnbackTable && xClamped >= burnbackTable.xMaxMm) {
      return [];
    }

    const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
    const rTip = Math.max(0.05, Math.min(outerR - 0.1, (Number(grain.d0) || 2) / 2));
    const rValley = Math.max(
      rTip + 0.05,
      Math.min(outerR - 0.02, (Number(grain.d0mayor) || rTip * 2.5) / 2)
    );
    const Np = Math.max(3, Math.round(Number(grain.Np) || 5));
    const ci = grain.ci ? 1 : 0;
    const osi = grain.osi ? 1 : 0;
    const xKey = Math.round(xClamped * 100) / 100;

    const sliceKey = `${outerR.toFixed(3)}|${rTip.toFixed(3)}|${rValley.toFixed(3)}|${Np}|${ci}|${osi}|${xKey.toFixed(2)}`;
    const cached = starSliceCache.get(sliceKey);
    if (cached) {
      starSliceCache.delete(sliceKey);
      starSliceCache.set(sliceKey, cached);
      return cached;
    }

    const loops = solveClipperCrossSectionAtDepth(
      {
        outerRadiusMm: outerR,
        ci,
        osi,
        innerVoidLoopsMm: [buildStarCoreLoopMm(rTip, rValley, Np)],
        circleSegments: 144,
      },
      xKey
    );

    if (starSliceCache.size >= STAR_SLICE_CACHE_LIMIT) {
      const oldestKey = starSliceCache.keys().next().value;
      if (oldestKey !== undefined) {
        starSliceCache.delete(oldestKey);
      }
    }
    starSliceCache.set(sliceKey, loops);
    return loops;
  },
};
