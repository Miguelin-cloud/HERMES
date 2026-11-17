import { batesGrainModule } from './batesGrain';
import { solidGrainModule } from './solidGrain';
import { starGrainModule } from './starGrain';
import { GrainGeometryModule, GrainShapeId, GrainSolverMode } from './types';

const GRAIN_MODULES: Record<GrainShapeId, GrainGeometryModule> = {
  1: batesGrainModule,
  2: starGrainModule,
  3: solidGrainModule,
};

export function getGrainModule(shape: number): GrainGeometryModule {
  if (shape === 1) return GRAIN_MODULES[1];
  if (shape === 2) return GRAIN_MODULES[2];
  return GRAIN_MODULES[3];
}

export function getGrainSolverMode(shape: number): GrainSolverMode {
  return getGrainModule(shape).solverMode;
}

export function isComplexGrain(shape: number): boolean {
  return getGrainSolverMode(shape) === 'clipper';
}
