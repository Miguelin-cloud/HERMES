import { GrainInput, MotorInput } from '../types';
import {
  buildCircleLoopMm,
  buildSlotLoopMm,
  buildUnifiedVoidLoopsMm,
} from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { GrainContourLoop, GrainValidationChecks } from './types';

export function getMaxFinocylWidthMm(d0: number, finCount: number): number {
  const safeD0 = Math.max(0, Number(d0) || 0);
  const fins = Math.round(Number(finCount) || 0);
  if (safeD0 <= 0 || fins < 2) return 0;
  return safeD0 * Math.sin(Math.PI / fins);
}

function resolveFinocylParams(grain: Partial<GrainInput>) {
  const outerR = Math.max(0.5, (Number(grain.D0) || 40) / 2);
  const rCore = Math.max(0.1, Math.min(outerR - 0.5, (Number(grain.d0) || outerR * 0.56) / 2));
  const finCount = Math.max(2, Math.round(Number(grain.Np) || 6));
  const rFinTip = Math.max(
    rCore + 0.2,
    Math.min(outerR - 0.1, (Number(grain.d0mayor) || outerR * 1.36) / 2)
  );
  const rawFinWidth = Number(grain.finWidth);
  const finWidth =
    Number.isFinite(rawFinWidth) && rawFinWidth > 0
      ? rawFinWidth
      : Math.max(1.0, Math.min(rCore * 0.7, rCore * 2 * Math.sin(Math.PI / finCount) * 0.6));
  return { outerR, rCore, finCount, rFinTip, finWidth };
}

function buildFinocylVoidLoopsMm(grain: GrainInput, circleSegments?: number): GrainContourLoop[] {
  const { outerR, rCore, finCount, rFinTip, finWidth } = resolveFinocylParams(grain);
  const halfW = Math.max(0.05, finWidth * 0.5);
  const addLoops: GrainContourLoop[] = [buildCircleLoopMm(rCore, 0, 0, circleSegments ?? 72)];
  for (let k = 0; k < finCount; k++) {
    const angle = (2 * Math.PI * k) / finCount;
    addLoops.push(buildSlotLoopMm(0, rFinTip, halfW, angle));
  }
  return buildUnifiedVoidLoopsMm(addLoops, [], outerR);
}

function validateFinocyl(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const fins = Math.round(Number(grain.Np) || 0);
  const finTipDia = Number(grain.d0mayor) || 0;
  const finWidth = Number(grain.finWidth) || 0;
  const maxWidth = getMaxFinocylWidthMm(grain.d0, fins);

  let geometryErrorCode: string | null = null;
  let geometryErrorLimitMm: number | undefined;

  if (fins < 2) {
    geometryErrorCode = 'finocyl_min_fins';
    geometryErrorLimitMm = 2;
  } else if (finTipDia <= grain.d0) {
    geometryErrorCode = 'finocyl_tip_lte_d0';
    geometryErrorLimitMm = grain.d0;
  } else if (finTipDia >= grain.D0) {
    geometryErrorCode = 'finocyl_tip_gte_D0';
    geometryErrorLimitMm = grain.D0;
  } else if (finWidth <= 0) {
    geometryErrorCode = 'finocyl_width_gt0';
  } else if (finWidth >= maxWidth - 1e-6) {
    geometryErrorCode = 'finocyl_width_overlap';
    geometryErrorLimitMm = maxWidth;
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
    isStarPointsInvalid: fins < 2,
    isStarValleyTooSmall: finTipDia <= grain.d0,
    isStarValleyExceedsD0: finTipDia >= grain.D0,
    hasStarError: false,
    hasShapeGeometryError: geometryErrorCode !== null,
    geometryErrorCode,
    geometryErrorLimitMm,
  };
}

export const finocylGrainModule = createComplexGrainModule({
  shape: 4,
  key: 'finocyl',
  buildVoidLoopsMm: buildFinocylVoidLoopsMm,
  validateGeometry: validateFinocyl,
  getCriticalDepthsMm: (g) => {
    const { outerR, rFinTip } = resolveFinocylParams(g);
    const rate = (g.ci ? 1 : 0) + (g.osi ? 1 : 0);
    return rate > 0 ? [(outerR - rFinTip) / rate] : [];
  },
  estimateInitialWebMm: (g) => Math.max(0, (g.D0 - (g.d0 || 0)) / 2),
});
