import { CustomGrainShape, GrainInput, MotorInput } from '../types';
import {
  analyzeCustomCrossSectionClipper,
  buildSequentialVoidLoopsMm,
  VoidSolidOperation,
} from './clipperSolver';
import { createComplexGrainModule } from './complexGrainFactory';
import { computeCustomGrainHash, resolveCustomGrainShape } from './customGrainStorage';
import {
  GrainContourLoop,
  GrainCrossSectionPrimitives,
  GrainGeometryModule,
  GrainRuntimeContext,
  GrainRuntimeState,
  GrainValidationChecks,
} from './types';

export function buildCustomVoidLoopsMm(
  grain: Pick<GrainInput, 'D0' | 'customGrainId' | 'customGrainSnapshot'>,
  customGrainShapes?: CustomGrainShape[]
): GrainContourLoop[] {
  const customShape = resolveCustomGrainShape(grain, customGrainShapes);
  if (!customShape || !Array.isArray(customShape.loops) || customShape.loops.length === 0) {
    return [];
  }

  const outerR = Math.max(0.25, (Number(grain.D0) || 40) / 2);
  const operations: VoidSolidOperation[] = [];

  for (const loop of customShape.loops) {
    if (!loop.points || loop.points.length < 3) continue;
    operations.push({
      loop: loop.points.map((p) => ({
        x: p.x * outerR,
        y: p.y * outerR,
      })),
      kind: loop.kind === 'solid' ? 'solid' : 'void',
    });
  }

  if (operations.length === 0) {
    return [];
  }

  return buildSequentialVoidLoopsMm(operations, outerR);
}

function validateCustomSketch(
  grain: GrainInput,
  motor: Pick<MotorInput, 'Dc' | 'Lc'>,
  availableGrainDiameterMm: number
): GrainValidationChecks {
  const outerR = Math.max(0.25, (Number(grain.D0) || 40) / 2);
  const customShape = resolveCustomGrainShape(grain);

  let geometryErrorCode: string | null = null;

  if (!customShape || !Array.isArray(customShape.loops) || customShape.loops.length === 0) {
    geometryErrorCode = 'custom_grain_empty';
  } else {
    const voids = buildCustomVoidLoopsMm(grain);
    const analysis = analyzeCustomCrossSectionClipper(outerR, voids, {
      preserveVoidOrientation: true,
      ci: grain.ci ? 1 : 0,
      osi: grain.osi ? 1 : 0,
      circleSegments: 96,
    });

    if (analysis.crossSectionAreaMm2 <= Math.max(1e-2, Math.PI * outerR * outerR * 0.005)) {
      geometryErrorCode = 'custom_grain_no_propellant';
    } else if (
      grain.osi !== 1 &&
      grain.ei !== 1 &&
      (grain.ci !== 1 || analysis.innerBurnPerimeterMm <= 1e-4)
    ) {
      geometryErrorCode = 'custom_grain_no_burn_surface';
    }
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
  };
}

function getCustomCrossSectionPrimitives(
  grain: GrainInput,
  xBurnMm: number = 0
): GrainCrossSectionPrimitives {
  const outerRadiusMm = Math.max(0, (grain.D0 || 0) / 2 - (grain.osi || 0) * xBurnMm);
  return {
    outerRadiusMm,
    innerCircleRadiusMm: null,
    innerPolygonMm: null,
  };
}

const baseCustomSketchModule = createComplexGrainModule({
  shape: 10,
  key: 'custom',
  preserveVoidOrientation: true,
  adaptiveRefine: true,
  buildVoidLoopsMm: (grain) => buildCustomVoidLoopsMm(grain),
  extraGeometryKey: (grain) => computeCustomGrainHash(resolveCustomGrainShape(grain)),
  validateGeometry: validateCustomSketch,
  getCrossSectionPrimitives: getCustomCrossSectionPrimitives,
});

export const customSketchGrainModule: GrainGeometryModule = {
  ...baseCustomSketchModule,
  createRuntimeState(grain: GrainInput, context: GrainRuntimeContext): GrainRuntimeState {
    const resolvedShape = resolveCustomGrainShape(grain, context.customGrainShapes);
    const enrichedGrain: GrainInput = resolvedShape
      ? {
          ...grain,
          customGrainId: grain.customGrainId ?? resolvedShape.id,
          customGrainSnapshot: resolvedShape,
        }
      : grain;
    return baseCustomSketchModule.createRuntimeState(enrichedGrain, context);
  },
};
