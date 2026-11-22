import { GrainInput, GrainShapeId, MotorInput } from '../types';
import {
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
  GrainRuntimeContext,
  GrainRuntimeState,
  GrainShapeKey,
  GrainStepEvaluation,
  GrainValidationChecks,
} from './types';

export interface ComplexGrainSpec {
  shape: GrainShapeId;
  key: GrainShapeKey;
  preserveVoidOrientation?: boolean;
  buildVoidLoopsMm: (grain: GrainInput, circleSegments?: number) => GrainContourLoop[];
  validateGeometry: (
    grain: GrainInput,
    motor: Pick<MotorInput, 'Dc' | 'Lc'>,
    availableGrainDiameterMm: number
  ) => GrainValidationChecks;
  estimateInitialWebMm?: (grain: GrainInput) => number;
  getCriticalDepthsMm?: (grain: GrainInput) => number[];
  getCrossSectionPrimitives?: (
    grain: GrainInput,
    xBurnMm: number
  ) => GrainCrossSectionPrimitives;
}

const BURNBACK_CACHE_LIMIT = 96;
const SLICE_CACHE_LIMIT = 384;
const WEB_CACHE_LIMIT = 128;
const burnbackCache = new Map<string, GrainBurnbackTable>();
const sliceCache = new Map<string, GrainContourLoop[]>();
const webCache = new Map<string, number>();

function buildGeometryKey(grain: Partial<GrainInput>): string {
  return [
    grain.shape ?? 1,
    (Number(grain.D0) || 0).toFixed(3),
    (Number(grain.d0) || 0).toFixed(3),
    (Number(grain.d0mayor) || 0).toFixed(3),
    Math.round(Number(grain.Np) || 0),
    (Number(grain.finWidth) || 0).toFixed(3),
    (Number(grain.spokeWidth) || 0).toFixed(3),
    (Number(grain.coreOffset) || 0).toFixed(3),
    (Number(grain.slotWidth) || 0).toFixed(3),
    (Number(grain.slotDepth) || 0).toFixed(3),
    (Number(grain.rodDiameter) || 0).toFixed(3),
  ].join('|');
}

export function createComplexGrainModule(spec: ComplexGrainSpec): GrainGeometryModule {
  const getOrComputeTable = (
    grain: GrainInput,
    options?: {
      circleSegments?: number;
      voidCircleSegments?: number;
      sampleCount?: number;
      arcToleranceMm?: number;
      includeContours?: boolean;
    }
  ): GrainBurnbackTable => {
    const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
    const ci = grain.ci ? 1 : 0;
    const osi = grain.osi ? 1 : 0;
    const circleSegments = options?.circleSegments ?? 144;
    const voidCircleSegments = options?.voidCircleSegments;
    const sampleCount = options?.sampleCount ?? 112;
    const includeContours = options?.includeContours ?? false;
    const arcToleranceMm =
      options?.arcToleranceMm ?? Math.max(0.01, Math.min(0.025, outerR * 4e-4));
    const effectiveL0 = ci === 0 && osi === 0 ? Math.max(1, Number(grain.L0) || 50) : 0;

    const cacheKey = `${buildGeometryKey(grain)}|${ci}|${osi}|${effectiveL0.toFixed(2)}|${circleSegments}|${voidCircleSegments ?? 0}|${sampleCount}|${arcToleranceMm.toFixed(4)}|${includeContours ? 1 : 0}`;
    const cached = burnbackCache.get(cacheKey);
    if (cached) {
      burnbackCache.delete(cacheKey);
      burnbackCache.set(cacheKey, cached);
      return cached;
    }

    const innerVoidLoopsMm = spec.buildVoidLoopsMm(grain, voidCircleSegments);
    const criticalDepthsMm = spec.getCriticalDepthsMm?.(grain);
    const table = solveGrainBurnbackClipper({
      outerRadiusMm: outerR,
      ci,
      osi,
      L0: Math.max(1, Number(grain.L0) || 50),
      innerVoidLoopsMm,
      preserveVoidOrientation: spec.preserveVoidOrientation,
      circleSegments,
      sampleCount,
      arcToleranceMm,
      includeContours,
      criticalDepthsMm,
    });

    if (burnbackCache.size >= BURNBACK_CACHE_LIMIT) {
      const oldest = burnbackCache.keys().next().value;
      if (oldest !== undefined) burnbackCache.delete(oldest);
    }
    burnbackCache.set(cacheKey, table);
    return table;
  };

  return {
    shape: spec.shape,
    key: spec.key,
    solverMode: 'clipper',

    getInitialGeometry(grain): GrainInitialGeometry {
      const fullGrain = grain as GrainInput;
      const outerR = Math.max(0.25, (Number(fullGrain.D0) || 10) / 2);
      const voids = spec.buildVoidLoopsMm(fullGrain);
      const measured = measureInitialCrossSectionClipper(outerR, voids, {
        preserveVoidOrientation: spec.preserveVoidOrientation,
        ci: 1,
        osi: 1,
        circleSegments: 144,
      });

      const L0 = Math.max(0, Number(fullGrain.L0) || 0);
      const N = Math.max(0, Number(fullGrain.N) || 0);
      const blockVolumeMm3 = Math.max(0, measured.crossSectionAreaMm2 * L0);
      const totalVolumeMm3 = Math.max(0, blockVolumeMm3 * N);
      const ci = fullGrain.ci !== undefined ? (fullGrain.ci ? 1 : 0) : 1;
      const osi = fullGrain.osi !== undefined ? (fullGrain.osi ? 1 : 0) : 0;
      const ei = fullGrain.ei !== undefined ? (fullGrain.ei ? 1 : 0) : 0;

      const webKey = `${buildGeometryKey(fullGrain)}|${ci}|${osi}|${ei}|${ei ? L0.toFixed(2) : '0'}`;
      let tweb0 = webCache.get(webKey);
      if (tweb0 === undefined) {
        tweb0 = estimateClipperWebThicknessMm({
          outerRadiusMm: outerR,
          ci,
          osi,
          ei,
          L0,
          innerVoidLoopsMm: voids,
          preserveVoidOrientation: spec.preserveVoidOrientation,
        });
        if (webCache.size >= WEB_CACHE_LIMIT) {
          const oldest = webCache.keys().next().value;
          if (oldest !== undefined) webCache.delete(oldest);
        }
        webCache.set(webKey, tweb0);
      }

      return {
        blockVolumeMm3,
        totalVolumeMm3,
        crossSectionAreaMm2: measured.crossSectionAreaMm2,
        portAreaMm2: measured.portAreaMm2,
        starHoleAreaMm2: measured.portAreaMm2,
        tweb0,
      };
    },

    computeInitialAduct(grain: GrainInput, motorDcMm: number): number {
      const geom = this.getInitialGeometry(grain);
      const chamberArea = (Math.PI / 4) * Math.pow(motorDcMm, 2);
      return Math.max(1e-6, chamberArea - geom.crossSectionAreaMm2);
    },

    computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas {
      const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
      const voids = spec.buildVoidLoopsMm(grain);
      const measured = measureInitialCrossSectionClipper(outerR, voids, {
        preserveVoidOrientation: spec.preserveVoidOrientation,
        ci: grain.ci ? 1 : 0,
        osi: grain.osi ? 1 : 0,
        circleSegments: 144,
      });

      const Abe = (grain.ei ? 1 : 0) * 2 * grain.N * measured.crossSectionAreaMm2;
      const Abc = (grain.ci ? 1 : 0) * measured.innerBurnPerimeterMm * totalLengthMm;
      const Abs = (grain.osi ? 1 : 0) * measured.outerBurnPerimeterMm * totalLengthMm;
      const Ab = Math.max(0, Abe + Abc + Abs);

      return { Abe, Abc, Abs, Ab };
    },

    createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState {
      const isFast = context.geometryQuality === 'fast';
      const outerR = Math.max(0.25, (Number(grain.D0) || 10) / 2);
      const burnbackTable = getOrComputeTable(grain, {
        circleSegments: isFast ? 56 : 144,
        voidCircleSegments: isFast ? 40 : undefined,
        sampleCount: isFast ? 36 : 112,
        arcToleranceMm: isFast ? Math.max(0.05, outerR * 0.0025) : undefined,
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
        d: grain.d0 || 0,
        D: grain.D0,
        L: Lg0,
        tweb: tweb0,
        Vg: Vg0,
        mg: mg0,
        dmayor: grain.d0mayor || 0,
        dmenor: grain.d0 || 0,
        Abe: eval0.Abe,
        Abc: eval0.Abc,
        Abs: eval0.Abs,
        Ab: eval0.Ab,
        prop: context.prop,
        rhoreal,
        Aduct: eval0.Aduct,
        xincp: 0,
        x: 0,
        betha: 0,
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
        getOrComputeTable(state, {
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
      return spec.validateGeometry(grain, motor, availableGrainDiameterMm);
    },

    getCrossSectionPrimitives(grain, xBurnMm: number = 0): GrainCrossSectionPrimitives {
      if (spec.getCrossSectionPrimitives) {
        return spec.getCrossSectionPrimitives(grain as GrainInput, xBurnMm);
      }
      const outerRadiusMm = Math.max(0, (grain.D0 || 0) / 2 - (grain.osi || 0) * xBurnMm);
      return {
        outerRadiusMm,
        innerCircleRadiusMm: null,
        innerPolygonMm: null,
      };
    },

    getCrossSectionContoursMm(
      grain,
      xBurnMm: number,
      burnbackTable?: GrainBurnbackTable | null
    ): GrainContourLoop[] | null {
      const xClamped = Math.max(0, xBurnMm);
      if (burnbackTable && xClamped >= burnbackTable.xMaxMm) {
        return [];
      }

      const fullGrain = grain as GrainInput;
      const outerR = Math.max(0.25, (Number(fullGrain.D0) || 10) / 2);
      const ci = fullGrain.ci ? 1 : 0;
      const osi = fullGrain.osi ? 1 : 0;
      const xKey = Math.round(xClamped * 100) / 100;

      const sliceKey = `${buildGeometryKey(fullGrain)}|${ci}|${osi}|${xKey.toFixed(2)}`;
      const cached = sliceCache.get(sliceKey);
      if (cached) {
        sliceCache.delete(sliceKey);
        sliceCache.set(sliceKey, cached);
        return cached;
      }

      const loops = solveClipperCrossSectionAtDepth(
        {
          outerRadiusMm: outerR,
          ci,
          osi,
          innerVoidLoopsMm: spec.buildVoidLoopsMm(fullGrain),
          preserveVoidOrientation: spec.preserveVoidOrientation,
          circleSegments: 144,
        },
        xKey
      );

      if (sliceCache.size >= SLICE_CACHE_LIMIT) {
        const oldest = sliceCache.keys().next().value;
        if (oldest !== undefined) sliceCache.delete(oldest);
      }
      sliceCache.set(sliceKey, loops);
      return loops;
    },
  };
}
