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

export const solidGrainModule: GrainGeometryModule = {
  shape: 3,
  key: 'solid',
  solverMode: 'analytical',

  getInitialGeometry(
    grain: Pick<GrainInput, 'shape' | 'D0' | 'd0' | 'd0mayor' | 'L0' | 'N' | 'Np'>
  ): GrainInitialGeometry {
    const crossSectionAreaMm2 = Math.max(0, (Math.PI / 4) * Math.pow(grain.D0, 2));
    const blockVolumeMm3 = Math.max(0, crossSectionAreaMm2 * grain.L0);
    const totalVolumeMm3 = Math.max(0, blockVolumeMm3 * (grain.N || 0));
    const tweb0 = grain.D0 / 2;

    return {
      blockVolumeMm3,
      totalVolumeMm3,
      crossSectionAreaMm2,
      portAreaMm2: 0,
      starHoleAreaMm2: 0,
      tweb0,
    };
  },

  computeInitialAduct(grain: GrainInput, motorDcMm: number): number {
    return (Math.PI / 4) * Math.pow(motorDcMm, 2) - (Math.PI / 4) * Math.pow(grain.D0, 2);
  },

  computeInitialAreas(grain: GrainInput, totalLengthMm: number): GrainInitialAreas {
    const Abe = grain.ei * 2 * grain.N * (Math.PI / 4) * Math.pow(grain.D0, 2);
    const Abc = 0;
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
    const D = state.D0 - state.osi * 2 * xMm;
    const L = state.L0 * state.N - state.ei * 2 * state.N * xMm;
    const tweb = D / 2;

    if (D <= 0 || L <= 0) {
      return {
        isConsumed: true,
        d: state.d,
        D: 0,
        L: 0,
        dmenor: state.dmenor,
        dmayor: 0,
        tweb: 0,
        Vg: 0,
        Abe: 0,
        Abc: 0,
        Abs: 0,
        Ab: 1e-4,
        Aduct: (Math.PI / 4) * Math.pow(motorDcMm, 2),
      };
    }

    const crossArea = (Math.PI / 4) * Math.pow(D, 2);
    const Aduct = (Math.PI / 4) * Math.pow(motorDcMm, 2) - crossArea;
    const Abe = state.ei * 2 * state.N * crossArea;
    const Abs = state.osi * Math.PI * D * L;
    const Abc = 0;
    const Ab = Math.max(0, Abe + Abs);
    const Vg = crossArea * L;

    return {
      isConsumed: false,
      d: state.d,
      D,
      L,
      dmenor: state.dmenor,
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
      isd0Invalid: false,
      isd0ExceedsD0: false,
      isd0ExceedsDc: false,
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
    return {
      outerRadiusMm,
      innerCircleRadiusMm: null,
      innerPolygonMm: null,
    };
  },
};
