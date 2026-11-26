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
  const m = loop.length;
  if (m < 3) return loop[0] || { x: 0, y: 0 };

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < m; i++) {
    if (loop[i].y < minY) minY = loop[i].y;
    if (loop[i].y > maxY) maxY = loop[i].y;
  }

  const spanY = maxY - minY;
  if (spanY <= 1e-9) return loop[0];

  const fractions = [0.5, 0.37, 0.63, 0.25, 0.75];
  for (const frac of fractions) {
    const yTest = minY + spanY * frac;
    const xs: number[] = [];
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const a = loop[j];
      const b = loop[i];
      if ((a.y <= yTest && b.y > yTest) || (b.y <= yTest && a.y > yTest)) {
        const t = (yTest - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    if (xs.length >= 2) {
      xs.sort((u, v) => u - v);
      let bestW = -1;
      let bestX = xs[0];
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const w = xs[k + 1] - xs[k];
        if (w > bestW) {
          bestW = w;
          bestX = 0.5 * (xs[k] + xs[k + 1]);
        }
      }
      if (bestW > 1e-7) {
        return { x: bestX, y: yTest };
      }
    }
  }

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
 * Determina mediante la regla even-odd si un punto (px, py) cae dentro del sólido de propelente.
 */
export function isPointInsideContourLoops(
  px: number,
  py: number,
  loops: GrainContourLoop[] | null | undefined
): boolean {
  if (!loops || loops.length === 0) return false;
  let inside = false;
  for (let i = 0; i < loops.length; i++) {
    if (loops[i].length >= 3 && pointInPolygon2D(px, py, loops[i])) {
      inside = !inside;
    }
  }
  return inside;
}

export interface MeridianIntervalMm {
  yMin: number;
  yMax: number;
}

export interface MeridianSliceInfo {
  solidIntervalsMm: MeridianIntervalMm[];
  voidIntervalsMm: MeridianIntervalMm[];
  projectedVoidRangeMm: MeridianIntervalMm | null;
  dEqMm: number;
  topEdgeExposed: boolean;
  bottomEdgeExposed: boolean;
}

/**
 * Calcula la sección longitudinal exacta sobre el plano meridiano vertical x = 0
 * para vistas CAD laterales, esquemáticos del motor y reportes PDF.
 */
export function computeMeridianLongitudinalCut(
  loops: GrainContourLoop[] | null | undefined,
  outerRadiusMm: number
): MeridianSliceInfo {
  const rOut = Math.max(0.25, outerRadiusMm);
  if (!loops || loops.length === 0) {
    return {
      solidIntervalsMm: [],
      voidIntervalsMm: [{ yMin: -rOut, yMax: rOut }],
      projectedVoidRangeMm: null,
      dEqMm: 2 * rOut,
      topEdgeExposed: true,
      bottomEdgeExposed: true,
    };
  }

  const ys: number[] = [];
  for (let l = 0; l < loops.length; l++) {
    const loop = loops[l];
    const m = loop.length;
    if (m < 3) continue;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const a = loop[j];
      const b = loop[i];
      if ((a.x <= 0 && b.x > 0) || (b.x <= 0 && a.x > 0)) {
        const t = (0 - a.x) / (b.x - a.x);
        const y = Math.max(-rOut, Math.min(rOut, a.y + t * (b.y - a.y)));
        ys.push(y);
      }
    }
  }

  ys.sort((a, b) => a - b);

  const solidIntervalsMm: MeridianIntervalMm[] = [];
  const minBand = Math.max(1e-3, rOut * 1e-4);
  for (let i = 0; i + 1 < ys.length; i += 2) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (y1 - y0 > minBand) {
      const prev = solidIntervalsMm[solidIntervalsMm.length - 1];
      if (prev && y0 - prev.yMax <= minBand) {
        prev.yMax = Math.max(prev.yMax, y1);
      } else {
        solidIntervalsMm.push({ yMin: y0, yMax: y1 });
      }
    }
  }

  const voidIntervalsMm: MeridianIntervalMm[] = [];
  let cursor = -rOut;
  for (const band of solidIntervalsMm) {
    if (band.yMin - cursor > minBand) {
      voidIntervalsMm.push({ yMin: cursor, yMax: band.yMin });
    }
    cursor = Math.max(cursor, band.yMax);
  }
  if (rOut - cursor > minBand) {
    voidIntervalsMm.push({ yMin: cursor, yMax: rOut });
  }

  const classified = classifyContoursToOutersAndHoles(loops);
  let solidAreaMm2 = 0;
  let projMinY = Infinity;
  let projMaxY = -Infinity;
  const rTol = Math.max(0.05, rOut * 0.015);

  for (const item of classified) {
    solidAreaMm2 += Math.abs(signedLoopArea2D(item.outer));
    for (const h of item.holes) {
      solidAreaMm2 -= Math.abs(signedLoopArea2D(h));
      for (const p of h) {
        if (p.y < projMinY) projMinY = p.y;
        if (p.y > projMaxY) projMaxY = p.y;
      }
    }
    // Also detect off-meridian slots/indentations carved inward from outer perimeter
    for (const p of item.outer) {
      if (Math.hypot(p.x, p.y) < rOut - rTol) {
        if (p.y < projMinY) projMinY = p.y;
        if (p.y > projMaxY) projMaxY = p.y;
      }
    }
  }

  const envArea = Math.PI * rOut * rOut;
  const portArea = Math.max(0, envArea - Math.max(0, solidAreaMm2));
  const dEqMm = Math.min(2 * rOut, 2 * Math.sqrt(portArea / Math.PI));

  const projectedVoidRangeMm =
    Number.isFinite(projMinY) && Number.isFinite(projMaxY) && projMaxY - projMinY > minBand
      ? {
          yMin: Math.max(-rOut, projMinY),
          yMax: Math.min(rOut, projMaxY),
        }
      : null;

  const edgeTol = Math.max(0.05, rOut * 0.02);
  const topEdgeExposed =
    solidIntervalsMm.length === 0 || solidIntervalsMm[0].yMin > -rOut + edgeTol;
  const bottomEdgeExposed =
    solidIntervalsMm.length === 0 ||
    solidIntervalsMm[solidIntervalsMm.length - 1].yMax < rOut - edgeTol;

  return {
    solidIntervalsMm,
    voidIntervalsMm,
    projectedVoidRangeMm,
    dEqMm,
    topEdgeExposed,
    bottomEdgeExposed,
  };
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
