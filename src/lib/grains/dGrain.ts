import { GrainInput, MotorInput } from '../types';
import { buildDGrainVoidLoopMm } from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { GrainContourLoop, GrainValidationChecks } from './types';

function resolveDGrainParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const rawDepth = Number(grain.slotDepth);
  const cutDepth =
    Number.isFinite(rawDepth) && rawDepth > 0
      ? Math.min(outerR * 2 - 0.25, rawDepth)
      : outerR * 0.9;
  return { outerR, cutDepth };
}

function buildDGrainVoidLoopsMm(grain: GrainInput): GrainContourLoop[] {
  const { outerR, cutDepth } = resolveDGrainParams(grain);
  return [buildDGrainVoidLoopMm(outerR, cutDepth)];
}

function validateDGrain(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const cutDepth = Number(grain.slotDepth ?? 0);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (!Number.isFinite(cutDepth) || cutDepth <= 0) {
    geometryErrorCode = 'dgrain_cut_gt0';
  } else if (cutDepth >= grain.D0) {
    geometryErrorCode = 'dgrain_cut_gte_D0';
    geometryErrorLimitMm = grain.D0;
  }

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
    hasShapeGeometryError: geometryErrorCode !== null,
    geometryErrorCode,
    geometryErrorLimitMm,
  };
}

export const dGrainModule = createComplexGrainModule({
  shape: 7,
  key: 'dgrain',
  buildVoidLoopsMm: buildDGrainVoidLoopsMm,
  validateGeometry: validateDGrain,
  getCriticalDepthsMm: (g) => {
    const { outerR, cutDepth } = resolveDGrainParams(g);
    return g.osi && !g.ci && cutDepth > outerR ? [2 * outerR - cutDepth] : [];
  },
  estimateInitialWebMm: (g) => {
    const D0 = Math.max(0, Number(g.D0) || 0);
    const cut = Math.max(0, Number(g.slotDepth) || 0);
    const rem = Math.max(0, D0 - cut);
    return g.osi && g.ci ? rem * 0.5 : rem;
  },
});
