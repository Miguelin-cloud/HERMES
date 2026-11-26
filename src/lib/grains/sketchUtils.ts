import {
  CustomGrainLoopKind,
  CustomGrainLoopNorm,
  CustomGrainPointNorm,
  CustomGrainShape,
} from '../types';
import {
  analyzeCustomCrossSectionClipper,
  buildSequentialVoidLoopsMm,
  buildUnifiedVoidLoopsMm,
  estimateClipperWebThicknessMm,
  signedAreaMm2,
  solveClipperCrossSectionAtDepth,
  VoidSolidOperation,
} from './clipperSolver';
import { GrainContourLoop } from './types';

export interface SketchStroke {
  id: string;
  kind: CustomGrainLoopKind;
  tool: 'freehand' | 'polyline' | 'circle';
  basePoints: CustomGrainPointNorm[];
  symmetryCount: number;
  mirrorSector: boolean;
  smoothLevel?: 'low' | 'medium' | 'high';
}

export interface CustomShapeInspection {
  fillPercent: number;
  propellantAreaMm2: number;
  portAreaMm2: number;
  estimatedWebMm: number;
  propellantPieceCount: number;
  isEmpty: boolean;
  hasNoPropellant: boolean;
  isSplitOrHasIsland: boolean;
  previewContoursMm: GrainContourLoop[];
}

function perpDistance(
  p: CustomGrainPointNorm,
  a: CustomGrainPointNorm,
  b: CustomGrainPointNorm
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function ramerDouglasPeucker(
  pts: CustomGrainPointNorm[],
  epsilon: number
): CustomGrainPointNorm[] {
  if (pts.length <= 2) return pts.slice();
  let maxDist = 0;
  let maxIdx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
    const right = ramerDouglasPeucker(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Smooths raw pointer samples with moving-average passes and simplifies via
 * Ramer-Douglas-Peucker to remove hand jitter while keeping intentional corners/curves.
 */
export function smoothAndSimplifyClosedStroke(
  rawPoints: CustomGrainPointNorm[],
  smoothLevel: 'low' | 'medium' | 'high' = 'medium'
): CustomGrainPointNorm[] {
  if (rawPoints.length < 3) return rawPoints.slice();

  // Deduplicate tightly packed samples
  const deduped: CustomGrainPointNorm[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = rawPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 0.006) {
      deduped.push(curr);
    }
  }
  if (deduped.length < 3) return deduped;

  // Strip trailing point if almost identical to first
  if (
    deduped.length > 3 &&
    Math.hypot(deduped[deduped.length - 1].x - deduped[0].x, deduped[deduped.length - 1].y - deduped[0].y) < 0.015
  ) {
    deduped.pop();
  }

  const passes = smoothLevel === 'high' ? 3 : smoothLevel === 'low' ? 1 : 2;
  const rdpEps = smoothLevel === 'high' ? 0.014 : smoothLevel === 'low' ? 0.007 : 0.01;

  let current = deduped.slice();
  for (let pass = 0; pass < passes; pass++) {
    const n = current.length;
    if (n < 4) break;
    const next: CustomGrainPointNorm[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const curr = current[i];
      const nxt = current[(i + 1) % n];
      next[i] = {
        x: 0.22 * prev.x + 0.56 * curr.x + 0.22 * nxt.x,
        y: 0.22 * prev.y + 0.56 * curr.y + 0.22 * nxt.y,
      };
    }
    current = next;
  }

  // Run RDP on closed cycle by splitting at farthest vertex pair
  let farIdx = 0;
  let farDist = -1;
  for (let i = 1; i < current.length; i++) {
    const d = Math.hypot(current[i].x - current[0].x, current[i].y - current[0].y);
    if (d > farDist) {
      farDist = d;
      farIdx = i;
    }
  }
  if (farIdx <= 1 || farIdx >= current.length - 1) {
    return current;
  }

  const h1 = ramerDouglasPeucker(current.slice(0, farIdx + 1), rdpEps);
  const h2 = ramerDouglasPeucker([...current.slice(farIdx), current[0]], rdpEps);
  const merged = [...h1.slice(0, -1), ...h2.slice(0, -1)];
  return merged.length >= 3 ? merged : current;
}

export function snapPointToPolarGrid(
  pt: CustomGrainPointNorm,
  radialStep: number = 0.1,
  angleDegStep: number = 15
): CustomGrainPointNorm {
  const r = Math.hypot(pt.x, pt.y);
  if (r < 0.04) return { x: 0, y: 0 };
  const theta = Math.atan2(pt.y, pt.x);
  const stepRad = (angleDegStep * Math.PI) / 180;
  const snappedR = Math.min(1.2, Math.round(r / radialStep) * radialStep);
  const snappedTheta = Math.round(theta / stepRad) * stepRad;
  return {
    x: snappedR * Math.cos(snappedTheta),
    y: snappedR * Math.sin(snappedTheta),
  };
}

export function buildCirclePointsNorm(
  cx: number,
  cy: number,
  radius: number,
  segments: number = 48
): CustomGrainPointNorm[] {
  const r = Math.max(0.03, radius);
  const pts: CustomGrainPointNorm[] = new Array(segments);
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts[i] = {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    };
  }
  return pts;
}

function rotatePoints(pts: CustomGrainPointNorm[], angleRad: number): CustomGrainPointNorm[] {
  if (Math.abs(angleRad) < 1e-9) return pts.map((p) => ({ ...p }));
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return pts.map((p) => ({
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  }));
}

function mirrorAcrossHorizontal(pts: CustomGrainPointNorm[]): CustomGrainPointNorm[] {
  // Reversing keeps polygon orientation consistent after reflection
  return pts
    .slice()
    .reverse()
    .map((p) => ({ x: p.x, y: -p.y }));
}

export function expandStrokeWithSymmetry(
  basePoints: CustomGrainPointNorm[],
  kind: CustomGrainLoopKind,
  symmetryCount: number,
  mirrorSector: boolean
): CustomGrainLoopNorm[] {
  if (basePoints.length < 3) return [];
  const sym = Math.max(1, Math.min(24, Math.round(symmetryCount || 1)));

  const seedLoops: CustomGrainPointNorm[][] = [basePoints];
  if (mirrorSector) {
    seedLoops.push(mirrorAcrossHorizontal(basePoints));
  }

  const rawLoops: CustomGrainPointNorm[][] = [];
  for (let k = 0; k < sym; k++) {
    const angle = (2 * Math.PI * k) / sym;
    for (const seed of seedLoops) {
      rawLoops.push(rotatePoints(seed, angle));
    }
  }

  // Merge overlapping symmetric lobes cleanly with Clipper2
  const unified = buildUnifiedVoidLoopsMm(rawLoops, [], 1.0);
  return unified
    .filter((l) => l.length >= 3)
    .map((l) => ({
      points: l.map((p) => ({ x: p.x, y: p.y })),
      kind,
    }));
}

export function buildNormalizedLoopsFromStrokes(strokes: SketchStroke[]): CustomGrainLoopNorm[] {
  const operations: VoidSolidOperation[] = [];

  for (const stroke of strokes) {
    const expanded = expandStrokeWithSymmetry(
      stroke.basePoints,
      stroke.kind,
      stroke.symmetryCount,
      stroke.mirrorSector
    );
    for (const l of expanded) {
      if (l.points.length >= 3) {
        operations.push({
          loop: l.points,
          kind: l.kind === 'solid' ? 'solid' : 'void',
        });
      }
    }
  }

  if (operations.length === 0) return [];

  const sequential = buildSequentialVoidLoopsMm(operations, 1.0);
  return sequential
    .filter((l) => l.length >= 3)
    .map((l) => ({
      points: l.map((p) => ({ x: p.x, y: p.y })),
      kind: signedAreaMm2(l) >= 0 ? 'void' : 'solid',
    }));
}

export function inspectNormalizedLoops(
  loops: CustomGrainLoopNorm[],
  referenceDiameterMm: number = 56
): CustomShapeInspection {
  const safeD0 = Math.max(10, Number(referenceDiameterMm) || 56);
  const outerR = safeD0 * 0.5;
  const fullArea = Math.PI * outerR * outerR;

  if (!loops || loops.length === 0) {
    return {
      fillPercent: 100,
      propellantAreaMm2: fullArea,
      portAreaMm2: 0,
      estimatedWebMm: outerR,
      propellantPieceCount: 1,
      isEmpty: true,
      hasNoPropellant: false,
      isSplitOrHasIsland: false,
      previewContoursMm: [],
    };
  }

  const operations: VoidSolidOperation[] = [];
  for (const l of loops) {
    if (!l.points || l.points.length < 3) continue;
    operations.push({
      loop: l.points.map((p) => ({ x: p.x * outerR, y: p.y * outerR })),
      kind: l.kind === 'solid' ? 'solid' : 'void',
    });
  }

  const unifiedVoids = buildSequentialVoidLoopsMm(operations, outerR);

  const analysis = analyzeCustomCrossSectionClipper(outerR, unifiedVoids, {
    preserveVoidOrientation: true,
    ci: 1,
    osi: 0,
    circleSegments: 96,
  });

  const estimatedWebMm = estimateClipperWebThicknessMm({
    outerRadiusMm: outerR,
    ci: 1,
    osi: 0,
    ei: 0,
    L0: 50,
    innerVoidLoopsMm: unifiedVoids,
    preserveVoidOrientation: true,
    circleSegments: 72,
  });

  const previewContoursMm = solveClipperCrossSectionAtDepth(
    {
      outerRadiusMm: outerR,
      ci: 1,
      osi: 0,
      innerVoidLoopsMm: unifiedVoids,
      preserveVoidOrientation: true,
      circleSegments: 96,
    },
    0
  );

  const fillPercent = fullArea > 0 ? Math.max(0, Math.min(100, (analysis.crossSectionAreaMm2 / fullArea) * 100)) : 0;
  const hasNoPropellant = analysis.crossSectionAreaMm2 <= Math.max(1e-2, fullArea * 0.005);

  return {
    fillPercent,
    propellantAreaMm2: analysis.crossSectionAreaMm2,
    portAreaMm2: analysis.portAreaMm2,
    estimatedWebMm,
    propellantPieceCount: analysis.propellantPieceCount,
    isEmpty: unifiedVoids.length === 0,
    hasNoPropellant,
    isSplitOrHasIsland: !hasNoPropellant && analysis.propellantPieceCount > 1,
    previewContoursMm,
  };
}

export function createStarterTemplateStrokes(
  preset: 'star5' | 'finocyl6' | 'peanut' | 'ring_island'
): SketchStroke[] {
  const id = `seed-${Date.now()}`;
  if (preset === 'star5') {
    return [
      {
        id,
        kind: 'void',
        tool: 'polyline',
        symmetryCount: 5,
        mirrorSector: true,
        basePoints: [
          { x: 0.0, y: 0.0 },
          { x: 0.3, y: 0.0 },
          { x: 0.62, y: 0.08 },
          { x: 0.25, y: 0.19 },
        ],
      },
    ];
  }
  if (preset === 'finocyl6') {
    return [
      {
        id: `${id}-core`,
        kind: 'void',
        tool: 'circle',
        symmetryCount: 1,
        mirrorSector: false,
        basePoints: buildCirclePointsNorm(0, 0, 0.28, 48),
      },
      {
        id: `${id}-fins`,
        kind: 'void',
        tool: 'polyline',
        symmetryCount: 6,
        mirrorSector: false,
        basePoints: [
          { x: 0.22, y: -0.055 },
          { x: 0.72, y: -0.055 },
          { x: 0.72, y: 0.055 },
          { x: 0.22, y: 0.055 },
        ],
      },
    ];
  }
  if (preset === 'peanut') {
    return [
      {
        id,
        kind: 'void',
        tool: 'circle',
        symmetryCount: 2,
        mirrorSector: false,
        basePoints: buildCirclePointsNorm(0.24, 0, 0.26, 40),
      },
    ];
  }
  // ring_island: large port + central solid rod
  return [
    {
      id: `${id}-port`,
      kind: 'void',
      tool: 'circle',
      symmetryCount: 1,
      mirrorSector: false,
      basePoints: buildCirclePointsNorm(0, 0, 0.62, 56),
    },
    {
      id: `${id}-rod`,
      kind: 'solid',
      tool: 'circle',
      symmetryCount: 1,
      mirrorSector: false,
      basePoints: buildCirclePointsNorm(0, 0, 0.26, 40),
    },
  ];
}

export function renderCustomShapeSvgPaths(
  shape: CustomGrainShape | null | undefined,
  radiusPx: number = 13
): { voidPathsD: string[]; solidPathsD: string[] } {
  if (!shape || !shape.loops || shape.loops.length === 0) {
    return { voidPathsD: [], solidPathsD: [] };
  }
  const toPath = (pts: CustomGrainPointNorm[]) => {
    if (pts.length < 3) return '';
    return (
      pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * radiusPx).toFixed(2)},${(p.y * radiusPx).toFixed(2)}`)
        .join(' ') + ' Z'
    );
  };
  const voidPathsD: string[] = [];
  const solidPathsD: string[] = [];
  for (const l of shape.loops) {
    const d = toPath(l.points);
    if (!d) continue;
    if (l.kind === 'solid') solidPathsD.push(d);
    else voidPathsD.push(d);
  }
  return { voidPathsD, solidPathsD };
}
