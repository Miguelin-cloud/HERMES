import { GrainContourLoop, GrainPoint2D } from './types';
import { clipLoopsToRightHalfPlaneClipper } from './clipperSolver';

export interface ClassifiedContourShape {
  outer: GrainPoint2D[]; // CCW
  holes: GrainPoint2D[][]; // CW
}

export function signedLoopArea2D(loop: GrainPoint2D[]): number {
  const m = loop.length;
  if (m < 3) return 0;
  let sum = 0;
  for (let i = 0, j = m - 1; i < m; j = i++) {
    sum += loop[j].x * loop[i].y - loop[i].x * loop[j].y;
  }
  return sum * 0.5;
}

export function pointInPolygon2D(px: number, py: number, poly: GrainPoint2D[]): boolean {
  let inside = false;
  const m = poly.length;
  for (let i = 0, j = m - 1; i < m; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const intersect =
      a.y > py !== b.y > py &&
      px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y + 1e-18) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getLoopInteriorTestPoint(loop: GrainPoint2D[]): GrainPoint2D {
  return loop[0];
}

/**
 * Clasifica un conjunto de bucles cerrados (regla even-odd) en contornos exteriores CCW
 * y sus agujeros interiores CW correspondientes (soporta tanto huecos centrales como múltiples slivers).
 */
export function classifyContoursToOutersAndHoles(
  loops: GrainContourLoop[]
): ClassifiedContourShape[] {
  const valid = loops.filter((l) => l.length >= 3 && Math.abs(signedLoopArea2D(l)) > 1e-6);
  if (valid.length === 0) return [];

  const areas = valid.map((l) => Math.abs(signedLoopArea2D(l)));
  const depths = valid.map(() => 0);
  const parentOuterIdx = valid.map(() => -1);

  for (let i = 0; i < valid.length; i++) {
    const pt = getLoopInteriorTestPoint(valid[i]);
    let bestParent = -1;
    let bestParentArea = Infinity;
    let count = 0;

    for (let j = 0; j < valid.length; j++) {
      if (i === j || areas[j] <= areas[i]) continue;
      if (pointInPolygon2D(pt.x, pt.y, valid[j])) {
        count++;
        if (areas[j] < bestParentArea) {
          bestParentArea = areas[j];
          bestParent = j;
        }
      }
    }
    depths[i] = count;
    parentOuterIdx[i] = bestParent;
  }

  const shapeByLoopIdx = new Map<number, ClassifiedContourShape>();
  const shapes: ClassifiedContourShape[] = [];

  // Crear formas exteriores (profundidad par, orientadas CCW: área > 0)
  for (let i = 0; i < valid.length; i++) {
    if (depths[i] % 2 === 0) {
      const signed = signedLoopArea2D(valid[i]);
      const outer = signed < 0 ? valid[i].slice().reverse() : valid[i].slice();
      const shape: ClassifiedContourShape = { outer, holes: [] };
      shapeByLoopIdx.set(i, shape);
      shapes.push(shape);
    }
  }

  // Asignar agujeros (profundidad impar, orientados CW: área < 0) a su padre inmediato
  for (let i = 0; i < valid.length; i++) {
    if (depths[i] % 2 === 1) {
      const parentIdx = parentOuterIdx[i];
      const parentShape = parentIdx >= 0 ? shapeByLoopIdx.get(parentIdx) : shapes[0];
      if (parentShape) {
        const signed = signedLoopArea2D(valid[i]);
        const hole = signed > 0 ? valid[i].slice().reverse() : valid[i].slice();
        parentShape.holes.push(hole);
      }
    }
  }

  return shapes;
}

/**
 * Recorta topológicamente un conjunto de contornos 2D al semiplano derecho (x >= 0)
 * mediante Clipper2 para construir vistas cutaway en 3D sin artefactos en bordes o agujeros.
 */
export function clipContoursToRightHalfPlane(
  loops: GrainContourLoop[]
): ClassifiedContourShape[] {
  const clippedLoops = clipLoopsToRightHalfPlaneClipper(loops);
  return classifyContoursToOutersAndHoles(clippedLoops);
}

/**
 * Convierte contornos vectoriales en un path SVG único usando fillRule="evenodd"
 * (soporta huecos interiores y slivers desconectados de manera uniforme).
 */
export function contoursToSvgPath(
  loops: GrainContourLoop[],
  centerX: number,
  centerY: number,
  scale: number
): string {
  if (!loops || loops.length === 0) return '';
  const parts: string[] = [];

  for (let l = 0; l < loops.length; l++) {
    const loop = loops[l];
    if (loop.length < 3) continue;
    let d = '';
    for (let i = 0; i < loop.length; i++) {
      const px = (centerX + loop[i].x * scale).toFixed(2);
      const py = (centerY + loop[i].y * scale).toFixed(2);
      d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    d += ' Z';
    parts.push(d);
  }

  return parts.join(' ');
}
