import { GrainInput, MotorInput } from '../types';
import { buildCSlotVoidLoopMm } from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { GrainContourLoop, GrainValidationChecks } from './types';

export function getMaxCSlotDepthMm(D0: number, slotWidth: number): number {
  const r = Math.max(0, (Number(D0) || 0) * 0.5);
  const hw = Math.max(0, (Number(slotWidth) || 0) * 0.5);
  if (r <= 0 || hw >= r) return 0;
  return r + Math.sqrt(Math.max(0, r * r - hw * hw));
}

function resolveCSlotParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const rawWidth = Number(grain.slotWidth);
  const slotWidth =
    Number.isFinite(rawWidth) && rawWidth > 0
      ? Math.min(outerR * 1.9, rawWidth)
      : outerR * 0.3;
  const maxDepth = Math.max(0.5, getMaxCSlotDepthMm(outerR * 2, slotWidth) - 0.5);
  const rawDepth = Number(grain.slotDepth);
  const slotDepth =
    Number.isFinite(rawDepth) && rawDepth > 0
      ? Math.min(maxDepth, rawDepth)
      : Math.min(maxDepth, outerR * 1.1);
  return { outerR, slotWidth, slotDepth };
}

function buildCSlotVoidLoopsMm(grain: GrainInput): GrainContourLoop[] {
  const { outerR, slotWidth, slotDepth } = resolveCSlotParams(grain);
  return [buildCSlotVoidLoopMm(outerR, slotWidth, slotDepth)];
}

function validateCSlot(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const slotWidth = Number(grain.slotWidth ?? 0);
  const slotDepth = Number(grain.slotDepth ?? 0);
  const maxDepth = getMaxCSlotDepthMm(grain.D0, slotWidth);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (!Number.isFinite(slotWidth) || slotWidth <= 0) {
    geometryErrorCode = 'cslot_width_gt0';
  } else if (slotWidth >= grain.D0) {
    geometryErrorCode = 'cslot_width_gte_D0';
    geometryErrorLimitMm = grain.D0;
  } else if (!Number.isFinite(slotDepth) || slotDepth <= 0) {
    geometryErrorCode = 'cslot_depth_gt0';
  } else if (slotDepth >= maxDepth - 1e-6) {
    geometryErrorCode = 'cslot_depth_splits_grain';
    geometryErrorLimitMm = maxDepth;
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

export const cSlotGrainModule = createComplexGrainModule({
  shape: 6,
  key: 'cslot',
  buildVoidLoopsMm: buildCSlotVoidLoopsMm,
  validateGeometry: validateCSlot,
  getCriticalDepthsMm: (g) => {
    const { outerR, slotDepth } = resolveCSlotParams(g);
    return g.osi && !g.ci && slotDepth > outerR ? [2 * outerR - slotDepth] : [];
  },
  estimateInitialWebMm: (g) => {
    const d0 = Math.max(0, Number(g.D0) || 0);
    const depth = Math.max(0, Number(g.slotDepth) || 0);
    return Math.max(0, d0 - depth);
  },
});
