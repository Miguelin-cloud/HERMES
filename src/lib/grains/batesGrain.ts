import { GrainInput, MotorInput } from '../types';
import {
  GrainCrossSectionPrimitives,
  GrainGeometryModule,
  GrainInitialAreas,
  GrainInitialGeometry,
  GrainRuntimeContext,
  GrainRuntimeState,
  GrainStepEvaluation,
  GrainValidationChecks,
} from './types';

export const batesGrainModule: GrainGeometryModule = {
  shape: 1,
  key: 'bates',
  solverMode: 'analytical',

  getInitialGeometry(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'Np'> &
      Partial<Pick<GrainInput, 'osi' | 'ci' | 'ei'>>
  ): GrainInitialGeometry {
    const crossSectionAreaMm2 = Math.max(0, (Math.PI / 4) * (Math.pow(grain.D0, 2) - Math.pow(grain.d0, 2)));
    const portAreaMm2 = Math.max(0, (Math.PI / 4) * Math.pow(grain.d0, 2));
    const blockVolumeMm3 = Math.max(0, crossSectionAreaMm2 * grain.L0);
    const totalVolumeMm3 = Math.max(0, blockVolumeMm3 * (grain.N || 0));

    const hasFaceFlags = grain.osi !== undefined || grain.ci !== undefined || grain.ei !== undefined;
    const radialRate = hasFaceFlags ? (grain.osi ? 1 : 0) + (grain.ci ? 1 : 0) : 1;
    const radialWeb = radialRate > 0 ? Math.max(0, (grain.D0 - grain.d0) / (2 * radialRate)) : Infinity;
    const axialWeb = grain.ei && grain.L0 > 0 ? grain.L0 * 0.5 : Infinity;
    const minWeb = Math.min(radialWeb, axialWeb);
    const tweb0 = Number.isFinite(minWeb) ? minWeb : Math.max(0, (grain.D0 - grain.d0) / 2);

    return {
      blockVolumeMm3,
      totalVolumeMm3,
      crossSectionAreaMm2,
      portAreaMm2,
      starHoleAreaMm2: 0,
      tweb0,
    };
  },

  computeInitialAduct(grain: GrainInput, motorDcMm: number): number {
    return (
      (Math.PI / 4) * Math.pow(motorDcMm, 2) -
      (Math.PI / 4) * (Math.pow(grain.D0, 2) - Math.pow(grain.d0, 2))
    );
  },

  computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas {
    const Abe = grain.ei * 2 * grain.N * (Math.PI / 4) * (Math.pow(grain.D0, 2) - Math.pow(grain.d0, 2));
    const Abc = grain.ci * Math.PI * grain.d0 * totalLengthMm;
    const Abs = grain.osi * Math.PI * grain.D0 * totalLengthMm;
    const Ab = Math.max(0, Abe + Abc + Abs);

    return { Abe, Abc, Abs, Ab };
  },

  createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState {
    const geom = this.getInitialGeometry(grain);
    const Lg0 = grain.L0 * grain.N;
    const Vg0 = geom.blockVolumeMm3 * grain.N;
    const rhoreal = context.prop.rho * grain.rhorat;
    const mg0 = (rhoreal * Vg0) / 1e6;
    const Aduct = this.computeInitialAduct(grain, context.motor.Dc);
    const areas = this.computeInitialAreas(grain, Lg0);

    return {
      ...grain,
      tweb0: geom.tweb0,
      d: grain.d0,
      D: grain.D0,
      L: Lg0,
      tweb: geom.tweb0,
      Vg: Vg0,
      mg: mg0,
      dmayor: 0,
      dmenor: grain.d0,
      ...areas,
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
    const d = state.d0 + state.ci * 2 * xMm;
    const D = state.D0 - state.osi * 2 * xMm;
    const L = state.L0 * state.N - state.ei * 2 * state.N * xMm;

    if (d >= D || L <= 0) {
      return {
        isConsumed: true,
        D: 0,
        d: 0,
        L: 0,
        dmenor: 0,
        dmayor: 0,
        tweb: 0,
        Vg: 0,
        Abe: 0,
        Abc: 0,
        Abs: 0,
        Ab: 0,
        Aduct: (Math.PI / 4) * Math.pow(motorDcMm, 2),
      };
    }

    const radialRate = (state.osi ? 1 : 0) + (state.ci ? 1 : 0);
    const radialTweb = radialRate > 0 ? Math.max(0, (D - d) / (2 * radialRate)) : Infinity;
    const axialTweb = state.ei && state.N > 0 ? Math.max(0, L / (2 * state.N)) : Infinity;
    const minTweb = Math.min(radialTweb, axialTweb);
    const tweb = Number.isFinite(minTweb) ? minTweb : Math.max(0, (D - d) / 2);

    const crossArea = (Math.PI / 4) * (Math.pow(D, 2) - Math.pow(d, 2));
    const Aduct = (Math.PI / 4) * Math.pow(motorDcMm, 2) - crossArea;
    const Abe = state.ei * 2 * state.N * crossArea;
    const Abc = state.ci * Math.PI * d * L;
    const Abs = state.osi * Math.PI * D * L;
    const Ab = Math.max(0, Abe + Abc + Abs);
    const Vg = crossArea * L;

    return {
      isConsumed: false,
      d,
      D,
      L,
      dmenor: d,
      dmayor: 0,
      tweb,
      Vg,
      Abe,
      Abc,
      Abs,
      Ab,
      Aduct,
    };
  },

  validate(
    grain: GrainInput,
    motor: Pick<MotorInput, 'Dc' | 'Lc'>,
    availableGrainDiameterMm: number
  ): GrainValidationChecks {
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
    };
  },

  getCrossSectionPrimitives(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'Np' | 'osi' | 'ci'>,
    xBurnMm: number = 0
  ): GrainCrossSectionPrimitives {
    const outerRadiusMm = Math.max(0, grain.D0 / 2 - (grain.osi || 0) * xBurnMm);
    const innerCircleRadiusMm = Math.max(0, grain.d0 / 2 + (grain.ci || 0) * xBurnMm);
    return {
      outerRadiusMm,
      innerCircleRadiusMm: innerCircleRadiusMm < outerRadiusMm ? innerCircleRadiusMm : outerRadiusMm,
      innerPolygonMm: null,
    };
  },
};
