import { GrainInput, MotorInput } from '../types';
import {
  buildCircleLoopMm,
  buildSlotLoopMm,
  buildUnifiedVoidLoopsMm,
} from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { GrainContourLoop, GrainValidationChecks } from './types';

export function getMaxWagonWheelSpokeWidthMm(d0: number, spokeCount: number): number {
  const safeD0 = Math.max(0, Number(d0) || 0);
  const spokes = Math.round(Number(spokeCount) || 0);
  if (safeD0 <= 0 || spokes < 3) return 0;
  return safeD0 * Math.sin(Math.PI / spokes);
}

function resolveWagonWheelParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const rInner = Math.max(0.2, Math.min(outerR - 0.6, (Number(grain.d0) || outerR * 0.56) / 2));
  const rSlotOuter = Math.max(
    rInner + 0.3,
    Math.min(outerR - 0.15, (Number(grain.d0mayor) || outerR * 1.44) / 2)
  );
  const spokeCount = Math.max(3, Math.round(Number(grain.Np) || 6));
  const rawSpokeW = Number(grain.spokeWidth);
  const spokeWidth =
    Number.isFinite(rawSpokeW) && rawSpokeW > 0
      ? rawSpokeW
      : Math.max(1.0, Math.min(rInner * 0.65, rInner * 2 * Math.sin(Math.PI / spokeCount) * 0.55));
  return { outerR, rInner, rSlotOuter, spokeCount, spokeWidth };
}

function buildWagonWheelVoidLoopsMm(grain: GrainInput, circleSegments?: number): GrainContourLoop[] {
  const { outerR, rInner, rSlotOuter, spokeCount, spokeWidth } = resolveWagonWheelParams(grain);
  const halfW = Math.max(0.05, spokeWidth * 0.5);
  const spokes: GrainContourLoop[] = [];
  for (let k = 0; k < spokeCount; k++) {
    const angle = (2 * Math.PI * k) / spokeCount;
    // Prolongar ligeramente más allá de rSlotOuter para cortar limpiamente la cavidad circular
    spokes.push(buildSlotLoopMm(rInner, rSlotOuter + 1.5, halfW, angle));
  }
  return buildUnifiedVoidLoopsMm([buildCircleLoopMm(rSlotOuter, 0, 0, circleSegments ?? 96)], spokes, outerR);
}

function validateWagonWheel(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const spokes = Math.round(Number(grain.Np) || 0);
  const slotOuterDia = Number(grain.d0mayor) || 0;
  const spokeWidth = Number(grain.spokeWidth) || 0;
  const maxSpokeWidth = getMaxWagonWheelSpokeWidthMm(grain.d0, spokes);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (spokes < 3) {
    geometryErrorCode = 'wagon_min_spokes';
    geometryErrorLimitMm = 3;
  } else if (slotOuterDia <= grain.d0) {
    geometryErrorCode = 'wagon_outer_lte_d0';
    geometryErrorLimitMm = grain.d0;
  } else if (slotOuterDia >= grain.D0) {
    geometryErrorCode = 'wagon_outer_gte_D0';
    geometryErrorLimitMm = grain.D0;
  } else if (spokeWidth <= 0) {
    geometryErrorCode = 'wagon_spoke_gt0';
  } else if (spokeWidth >= maxSpokeWidth - 1e-6) {
    geometryErrorCode = 'wagon_spoke_overlap';
    geometryErrorLimitMm = maxSpokeWidth;
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
    minD0mayor: grain.d0,
    isStarPointsInvalid: spokes < 3,
    isStarValleyTooSmall: slotOuterDia <= grain.d0,
    isStarValleyExceedsD0: slotOuterDia >= grain.D0,
    hasStarError: false,
    hasShapeGeometryError: geometryErrorCode !== null,
    geometryErrorCode,
    geometryErrorLimitMm,
  };
}

export const wagonWheelGrainModule = createComplexGrainModule({
  shape: 9,
  key: 'wagonwheel',
  buildVoidLoopsMm: buildWagonWheelVoidLoopsMm,
  validateGeometry: validateWagonWheel,
  getCriticalDepthsMm: (g) => {
    const { outerR, rSlotOuter, spokeWidth } = resolveWagonWheelParams(g);
    const depths: number[] = [];
    if (g.ci) depths.push(spokeWidth * 0.5);
    const rate = (g.ci ? 1 : 0) + (g.osi ? 1 : 0);
    if (rate > 0) depths.push((outerR - rSlotOuter) / rate);
    return depths;
  },
  estimateInitialWebMm: (g) => Math.max(0, (g.D0 - (g.d0 || 0)) / 2),
});
