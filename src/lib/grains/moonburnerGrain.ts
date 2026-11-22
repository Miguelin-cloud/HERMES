import { GrainInput, MotorInput } from '../types';
import { buildCircleLoopMm } from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { GrainContourLoop, GrainValidationChecks } from './types';

export function getMaxMoonburnerOffsetMm(D0: number, d0: number): number {
  return Math.max(0, ((Number(D0) || 0) - (Number(d0) || 0)) * 0.5);
}

function resolveMoonburnerParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const rCore = Math.max(0.1, Math.min(outerR - 0.5, (Number(grain.d0) || outerR * 0.6) / 2));
  const maxOff = Math.max(0, outerR - rCore - 0.1);
  const rawOffset = Number(grain.coreOffset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.min(maxOff, rawOffset)
      : Math.min(maxOff, outerR * 0.35);
  return { outerR, rCore, offset };
}

function buildMoonburnerVoidLoopsMm(grain: GrainInput, circleSegments?: number): GrainContourLoop[] {
  const { rCore, offset } = resolveMoonburnerParams(grain);
  return [buildCircleLoopMm(rCore, offset, 0, circleSegments ?? 96)];
}

function validateMoonburner(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const offset = Number(grain.coreOffset ?? 0);
  const maxOffset = getMaxMoonburnerOffsetMm(grain.D0, grain.d0);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (!Number.isFinite(offset) || offset < 0) {
    geometryErrorCode = 'moonburner_offset_negative';
    geometryErrorLimitMm = 0;
  } else if (grain.d0 > 0 && grain.d0 < grain.D0 && offset >= maxOffset - 1e-6) {
    geometryErrorCode = 'moonburner_offset_exceeds';
    geometryErrorLimitMm = maxOffset;
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

export const moonburnerGrainModule = createComplexGrainModule({
  shape: 5,
  key: 'moonburner',
  buildVoidLoopsMm: buildMoonburnerVoidLoopsMm,
  validateGeometry: validateMoonburner,
  getCriticalDepthsMm: (g) => {
    const { outerR, rCore, offset } = resolveMoonburnerParams(g);
    const rate = (g.ci ? 1 : 0) + (g.osi ? 1 : 0);
    return rate > 0 ? [(outerR - offset - rCore) / rate] : [];
  },
  estimateInitialWebMm: (g) => {
    const rOut = Math.max(0, (g.D0 || 0) / 2);
    const rIn = Math.max(0, (g.d0 || 0) / 2);
    const off = Math.max(0, Number(g.coreOffset) || 0);
    const rate = (g.ci ? 1 : 0) + (g.osi ? 1 : 0) || 1;
    return Math.max(0, (rOut + off - rIn) / rate);
  },
});
