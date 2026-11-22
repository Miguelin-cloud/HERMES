import { GrainInput, MotorInput } from '../types';
import { buildCircleLoopMm } from './clipperSolver';
import {
  GrainContourLoop,
  GrainCrossSectionPrimitives,
  GrainGeometryModule,
  GrainInitialAreas,
  GrainInitialGeometry,
  GrainRuntimeContext,
  GrainRuntimeState,
  GrainStepEvaluation,
  GrainValidationChecks,
} from './types';

function resolveRodTubeParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const tubeInnerR = Math.max(
    0.3,
    Math.min(outerR - 0.2, (Number(grain.d0) || outerR * 1.24) / 2)
  );
  const rawRod = Number(grain.rodDiameter);
  const rodR =
    Number.isFinite(rawRod) && rawRod > 0
      ? Math.min(tubeInnerR - 0.15, rawRod * 0.5)
      : Math.max(0.1, tubeInnerR * 0.45);
  return { outerR, tubeInnerR, rodR };
}

function evaluateRodTubeSlice(
  grain: Pick<GrainInput, 'D0' | 'd0' | 'rodDiameter' | 'osi' | 'ci'>,
  xMm: number
) {
  const { outerR, tubeInnerR, rodR } = resolveRodTubeParams(grain);
  const osi = grain.osi ? 1 : 0;
  const ci = grain.ci ? 1 : 0;
  const clampedX = Math.max(0, xMm);

  const rTubeOut = Math.max(0, outerR - osi * clampedX);
  const rTubeIn = Math.max(0, tubeInnerR + ci * clampedX);
  const tubeAlive = rTubeOut > rTubeIn + 1e-6;
  const tubeArea = tubeAlive ? Math.PI * (rTubeOut * rTubeOut - rTubeIn * rTubeIn) : 0;
  const tubeOuterPerim = tubeAlive ? 2 * Math.PI * rTubeOut : 0;
  const tubeInnerPerim = tubeAlive ? 2 * Math.PI * rTubeIn : 0;

  // La varilla interior solo tiene frontera al canal central (ci), nunca a la camisa exterior (osi).
  const rRod = Math.max(0, rodR - ci * clampedX);
  const rodAlive = rRod > 1e-6;
  const rodArea = rodAlive ? Math.PI * rRod * rRod : 0;
  const rodPerim = rodAlive ? 2 * Math.PI * rRod : 0;

  const crossSectionAreaMm2 = tubeArea + rodArea;
  const envArea = Math.PI * rTubeOut * rTubeOut;
  const portAreaMm2 = Math.max(0, Math.PI * outerR * outerR - crossSectionAreaMm2);

  const innerBurnPerimeterMm = ci * (tubeInnerPerim + rodPerim);
  const outerBurnPerimeterMm = osi * tubeOuterPerim;

  return {
    outerR,
    tubeInnerR,
    rodR,
    rTubeOut,
    rTubeIn,
    rRod,
    tubeAlive,
    rodAlive,
    tubeArea,
    rodArea,
    crossSectionAreaMm2,
    envArea,
    portAreaMm2,
    innerBurnPerimeterMm,
    outerBurnPerimeterMm,
  };
}

function computeEffectiveRodTubeWebMm(
  grain: Pick<GrainInput, 'D0' | 'd0' | 'rodDiameter' | 'L0'> &
    Partial<Pick<GrainInput, 'osi' | 'ci' | 'ei'>>
): number {
  const { outerR, tubeInnerR, rodR } = resolveRodTubeParams(grain);
  const osi = grain.osi !== undefined ? (grain.osi ? 1 : 0) : 1;
  const ci = grain.ci !== undefined ? (grain.ci ? 1 : 0) : 1;
  const ei = grain.ei ? 1 : 0;
  const axialMax = ei && grain.L0 > 0 ? grain.L0 * 0.5 : Infinity;

  const tubeBurns = osi === 1 || ci === 1 || ei === 1;
  const tubeRadialMax = osi + ci > 0 ? Math.max(0, (outerR - tubeInnerR) / (osi + ci)) : Infinity;
  const tubeMax = tubeBurns ? Math.min(tubeRadialMax, axialMax) : 0;

  const rodBurns = ci === 1 || ei === 1;
  const rodRadialMax = ci > 0 ? Math.max(0, rodR / ci) : Infinity;
  const rodMax = rodBurns ? Math.min(rodRadialMax, axialMax) : 0;

  const activeMax = Math.max(tubeMax, rodMax);
  if (Number.isFinite(activeMax) && activeMax > 0) {
    return activeMax;
  }
  return Math.max(Math.max(0, (outerR - tubeInnerR) * 0.5), rodR);
}

function validateRodTube(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const rodDia = Number(grain.rodDiameter ?? 0);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (!Number.isFinite(rodDia) || rodDia <= 0) {
    geometryErrorCode = 'rodtube_rod_gt0';
  } else if (grain.d0 > 0 && rodDia >= grain.d0 - 1e-6) {
    geometryErrorCode = 'rodtube_rod_gte_d0';
    geometryErrorLimitMm = grain.d0;
  }

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
    minD0mayor: 0,
    isStarPointsInvalid: false,
    isStarValleyTooSmall: false,
    isStarValleyExceedsD0: false,
    hasStarError: false,
    hasShapeGeometryError: geometryErrorCode !== null,
    geometryErrorCode,
    geometryErrorLimitMm,
  };
}

export const rodAndTubeGrainModule: GrainGeometryModule = {
  shape: 8,
  key: 'rodtube',
  solverMode: 'analytical',

  getInitialGeometry(grain): GrainInitialGeometry {
    const slice0 = evaluateRodTubeSlice(
      {
        D0: grain.D0,
        d0: grain.d0,
        rodDiameter: grain.rodDiameter,
        osi: 1,
        ci: 1,
      },
      0
    );
    const L0 = Math.max(0, Number(grain.L0) || 0);
    const N = Math.max(0, Number(grain.N) || 0);
    const blockVolumeMm3 = Math.max(0, slice0.crossSectionAreaMm2 * L0);
    const totalVolumeMm3 = Math.max(0, blockVolumeMm3 * N);
    const tweb0 = computeEffectiveRodTubeWebMm(grain);

    return {
      blockVolumeMm3,
      totalVolumeMm3,
      crossSectionAreaMm2: slice0.crossSectionAreaMm2,
      portAreaMm2: slice0.portAreaMm2,
      starHoleAreaMm2: slice0.portAreaMm2,
      tweb0,
    };
  },

  computeInitialAduct(grain: GrainInput, motorDcMm: number): number {
    const slice0 = evaluateRodTubeSlice(grain, 0);
    const chamberArea = (Math.PI / 4) * Math.pow(motorDcMm, 2);
    return Math.max(1e-6, chamberArea - slice0.crossSectionAreaMm2);
  },

  computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas {
    const slice0 = evaluateRodTubeSlice(grain, 0);
    const Abe = (grain.ei ? 1 : 0) * 2 * grain.N * slice0.crossSectionAreaMm2;
    const Abc = slice0.innerBurnPerimeterMm * totalLengthMm;
    const Abs = slice0.outerBurnPerimeterMm * totalLengthMm;
    const Ab = Math.max(0, Abe + Abc + Abs);

    return { Abe, Abc, Abs, Ab };
  },

  createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState {
    const slice0 = evaluateRodTubeSlice(grain, 0);
    const Lg0 = grain.L0 * grain.N;
    const Vg0 = slice0.crossSectionAreaMm2 * Lg0;
    const rhoreal = context.prop.rho * grain.rhorat;
    const mg0 = (rhoreal * Vg0) / 1e6;
    const tweb0 = computeEffectiveRodTubeWebMm(grain);
    const Aduct = Math.max(1e-6, (Math.PI / 4) * Math.pow(context.motor.Dc, 2) - slice0.crossSectionAreaMm2);
    const Abe = (grain.ei ? 1 : 0) * 2 * grain.N * slice0.crossSectionAreaMm2;
    const Abc = slice0.innerBurnPerimeterMm * Lg0;
    const Abs = slice0.outerBurnPerimeterMm * Lg0;
    const Ab = Math.max(0, Abe + Abc + Abs);

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
      Abe,
      Abc,
      Abs,
      Ab,
      prop: context.prop,
      rhoreal,
      Aduct,
      xincp: 0,
      x: 0,
      betha: 0,
      pablo: 1,
      miguel: 1,
      alpha_deg: context.nozzle.alpha || 12,
      At: (Math.PI / 4) * Math.pow(context.nozzle.Dt0, 2),
      solverMode: 'analytical',
    };
  },

  evaluateAtBurnDepth(
    state: GrainRuntimeState,
    xMm: number,
    motorDcMm: number
  ): GrainStepEvaluation {
    const clampedX = Math.max(0, xMm);
    const L = state.L0 * state.N - state.ei * 2 * state.N * clampedX;
    const chamberArea = (Math.PI / 4) * Math.pow(motorDcMm, 2);

    if (L <= 0) {
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

    const slice = evaluateRodTubeSlice(state, clampedX);
    if (!slice.tubeAlive && !slice.rodAlive) {
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

    const Abe = (state.ei ? 1 : 0) * 2 * state.N * slice.crossSectionAreaMm2;
    const Abc = slice.innerBurnPerimeterMm * L;
    const Abs = slice.outerBurnPerimeterMm * L;
    const Ab = Math.max(0, Abe + Abc + Abs);
    const Vg = slice.crossSectionAreaMm2 * L;
    const Aduct = Math.max(1e-6, chamberArea - slice.crossSectionAreaMm2);
    const tweb = Math.max(0, state.tweb0 - clampedX);

    if (Ab <= 1e-9) {
      return {
        isConsumed: true,
        d: slice.tubeAlive ? slice.rTubeIn * 2 : 0,
        D: slice.tubeAlive ? slice.rTubeOut * 2 : slice.rRod * 2,
        L,
        dmenor: slice.rRod * 2,
        dmayor: slice.tubeAlive ? slice.rTubeIn * 2 : 0,
        tweb: 0,
        Vg,
        Abe: 0,
        Abc: 0,
        Abs: 0,
        Ab: 0,
        Aduct,
      };
    }

    return {
      isConsumed: false,
      d: slice.tubeAlive ? slice.rTubeIn * 2 : 0,
      D: slice.tubeAlive ? slice.rTubeOut * 2 : slice.rRod * 2,
      L,
      dmenor: slice.rRod * 2,
      dmayor: slice.tubeAlive ? slice.rTubeIn * 2 : 0,
      tweb,
      Vg,
      Abe,
      Abc,
      Abs,
      Ab,
      Aduct,
    };
  },

  validate: validateRodTube,

  getCrossSectionPrimitives(grain, xBurnMm: number = 0): GrainCrossSectionPrimitives {
    const slice = evaluateRodTubeSlice(grain as GrainInput, xBurnMm);
    return {
      outerRadiusMm: slice.tubeAlive ? slice.rTubeOut : slice.rodAlive ? slice.rRod : 0,
      innerCircleRadiusMm: slice.tubeAlive ? slice.rTubeIn : null,
      innerPolygonMm: null,
    };
  },

  getCrossSectionContoursMm(grain, xBurnMm: number = 0): GrainContourLoop[] | null {
    const fullGrain = grain as GrainInput;
    const xClamped = Math.max(0, xBurnMm);
    const L = (Number(fullGrain.L0) || 0) - (fullGrain.ei ? 1 : 0) * 2 * xClamped;
    if (L <= 0) return [];

    const slice = evaluateRodTubeSlice(fullGrain, xClamped);
    const loops: GrainContourLoop[] = [];
    if (slice.tubeAlive) {
      loops.push(buildCircleLoopMm(slice.rTubeOut, 0, 0, 144));
      if (slice.rTubeIn > 1e-4) {
        loops.push(buildCircleLoopMm(slice.rTubeIn, 0, 0, 144).slice().reverse());
      }
    }
    if (slice.rodAlive) {
      loops.push(buildCircleLoopMm(slice.rRod, 0, 0, 96));
    }
    return loops;
  },
};
