import { GrainInput } from '../types';
import { batesGrainModule } from './batesGrain';
import { cSlotGrainModule } from './cSlotGrain';
import { dGrainModule } from './dGrain';
import { finocylGrainModule } from './finocylGrain';
import { moonburnerGrainModule } from './moonburnerGrain';
import { rodAndTubeGrainModule } from './rodAndTubeGrain';
import { solidGrainModule } from './solidGrain';
import { starGrainModule } from './starGrain';
import { GrainGeometryModule, GrainShapeId, GrainSolverMode } from './types';
import { wagonWheelGrainModule } from './wagonWheelGrain';

const GRAIN_MODULES: Record<GrainShapeId, GrainGeometryModule> = {
  1: batesGrainModule,
  2: starGrainModule,
  3: solidGrainModule,
  4: finocylGrainModule,
  5: moonburnerGrainModule,
  6: cSlotGrainModule,
  7: dGrainModule,
  8: rodAndTubeGrainModule,
  9: wagonWheelGrainModule,
};

export function getGrainModule(shape: number): GrainGeometryModule {
  if (shape in GRAIN_MODULES) {
    return GRAIN_MODULES[shape as GrainShapeId];
  }
  return GRAIN_MODULES[3];
}

export function getGrainSolverMode(shape: number): GrainSolverMode {
  return getGrainModule(shape).solverMode;
}

export function isComplexGrain(shape: number): boolean {
  return getGrainSolverMode(shape) === 'clipper';
}

export function hasCrossSectionContours(shape: number): boolean {
  return typeof getGrainModule(shape).getCrossSectionContoursMm === 'function';
}

export function getAllGrainModules(): GrainGeometryModule[] {
  return [
    GRAIN_MODULES[1],
    GRAIN_MODULES[2],
    GRAIN_MODULES[3],
    GRAIN_MODULES[4],
    GRAIN_MODULES[5],
    GRAIN_MODULES[6],
    GRAIN_MODULES[7],
    GRAIN_MODULES[8],
    GRAIN_MODULES[9],
  ];
}

/**
 * Devuelve valores geométricos iniciales válidos y sin conflictos para la forma seleccionada,
 * escalados proporcionalmente al diámetro exterior D0 actual.
 */
export function getDefaultGrainParamsForShape(
  shape: GrainShapeId,
  D0: number
): Partial<GrainInput> {
  const safeD0 = Math.max(10, Number(D0) || 40);
  const r = (v: number) => Math.max(0.5, Math.round(v * 10) / 10);

  switch (shape) {
    case 1:
      return { shape: 1, d0: r(safeD0 * 0.3) };
    case 2: {
      const d0 = r(safeD0 * 0.25);
      const Np = 5;
      const d0mayor = r(Math.max(d0 / Math.cos(Math.PI / Np) + 2, safeD0 * 0.65));
      return { shape: 2, d0, d0mayor: Math.min(r(safeD0 - 2), d0mayor), Np };
    }
    case 3:
      return { shape: 3, d0: 0, ci: 0 };
    case 4: {
      const d0 = r(safeD0 * 0.28);
      const Np = 6;
      const d0mayor = r(safeD0 * 0.68);
      const maxW = d0 * Math.sin(Math.PI / Np);
      const finWidth = r(Math.min(maxW * 0.6, Math.max(1.5, safeD0 * 0.08)));
      return { shape: 4, d0, d0mayor, Np, finWidth, ci: 1 };
    }
    case 5: {
      const d0 = r(safeD0 * 0.3);
      const coreOffset = r(Math.max(1, (safeD0 - d0) * 0.22));
      return { shape: 5, d0, coreOffset, ci: 1 };
    }
    case 6: {
      const slotWidth = r(Math.max(2, safeD0 * 0.15));
      const slotDepth = r(safeD0 * 0.55);
      return { shape: 6, slotWidth, slotDepth, ci: 1 };
    }
    case 7: {
      const slotDepth = r(safeD0 * 0.45);
      return { shape: 7, slotDepth, ci: 1 };
    }
    case 8: {
      const d0 = r(safeD0 * 0.62);
      const rodDiameter = r(safeD0 * 0.28);
      return { shape: 8, d0, rodDiameter, ci: 1, osi: 0 };
    }
    case 9: {
      const d0 = r(safeD0 * 0.28);
      const d0mayor = r(safeD0 * 0.72);
      const Np = 6;
      const maxW = d0 * Math.sin(Math.PI / Np);
      const spokeWidth = r(Math.min(maxW * 0.55, Math.max(1.5, safeD0 * 0.075)));
      return { shape: 9, d0, d0mayor, Np, spokeWidth, ci: 1 };
    }
    default:
      return { shape };
  }
}
