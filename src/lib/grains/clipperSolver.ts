import {
  areaPaths,
  difference,
  EndType,
  FillRule,
  inflatePaths,
  intersect,
  JoinType,
  Path64,
  Paths64,
  Point64,
  union,
} from 'clipper2-ts';
import {
  GrainBurnbackSample,
  GrainBurnbackTable,
  GrainContourLoop,
  GrainPoint2D,
} from './types';

export interface ClipperBurnbackOptions {
  outerRadiusMm: number;
  ci: number; // 0 o 1
  osi: number; // 0 o 1
  L0: number;
  /**
   * Bucles cerrados en mm que describen el/los huecos iniciales del núcleo.
   * Por defecto se normalizan a CCW; con `preserveVoidOrientation: true` se respeta
   * la orientación CW de islas sólidas internas (ej. varilla central en Rod & Tube).
   */
  innerVoidLoopsMm: GrainContourLoop[];
  preserveVoidOrientation?: boolean;
  sampleCount?: number;
  includeContours?: boolean;
  circleSegments?: number;
  arcToleranceMm?: number;
  criticalDepthsMm?: number[];
}

function chooseAdaptiveScale(outerRadiusMm: number): number {
  // Mantiene coordenadas enteras lejos del límite donde Clipper2 recurre a BigInt,
  // conservando resolución sub-micrométrica (~0.02 - 0.1 µm).
  const safeMaxRadius = Math.max(1, outerRadiusMm);
  return Math.max(1000, Math.min(50_000, Math.floor(1_000_000 / safeMaxRadius)));
}

function signedAreaMm2(pts: GrainPoint2D[]): number {
  const m = pts.length;
  if (m < 3) return 0;
  let sum = 0;
  for (let i = 0, j = m - 1; i < m; j = i++) {
    sum += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return sum * 0.5;
}

function ensureCcwLoop(loop: GrainContourLoop): GrainContourLoop {
  if (loop.length < 3) return loop;
  return signedAreaMm2(loop) < 0 ? loop.slice().reverse() : loop.slice();
}

function toPath64(loop: GrainContourLoop, scale: number): Path64 {
  const path: Path64 = new Array(loop.length);
  for (let i = 0; i < loop.length; i++) {
    path[i] = {
      x: Math.round(loop[i].x * scale),
      y: Math.round(loop[i].y * scale),
    };
  }
  return path;
}

function makeCirclePath64(radiusMm: number, segments: number, scale: number): Path64 {
  const path: Path64 = new Array(segments);
  const step = (2 * Math.PI) / segments;
  for (let i = 0; i < segments; i++) {
    const a = i * step;
    path[i] = {
      x: Math.round(radiusMm * Math.cos(a) * scale),
      y: Math.round(radiusMm * Math.sin(a) * scale),
    };
  }
  return path;
}

function fromPaths64(paths: Paths64, scale: number): GrainContourLoop[] {
  const inv = 1 / scale;
  const loops: GrainContourLoop[] = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p.length < 3) continue;
    const loop: GrainContourLoop = new Array(p.length);
    for (let k = 0; k < p.length; k++) {
      loop[k] = {
        x: p[k].x * inv,
        y: p[k].y * inv,
      };
    }
    loops.push(loop);
  }
  return loops;
}

/**
 * Construye el polígono cerrado (CCW) de una estrella regular de Np puntas en mm.
 */
export function buildStarCoreLoopMm(
  rTipMm: number,
  rValleyMm: number,
  Np: number
): GrainContourLoop {
  const points = Math.max(3, Math.round(Np || 5));
  const total = points * 2;
  const loop: GrainContourLoop = new Array(total);
  for (let k = 0; k < total; k++) {
    const angle = (Math.PI * 2 * k) / total;
    const r = k % 2 === 0 ? rTipMm : rValleyMm;
    loop[k] = {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    };
  }
  return loop;
}

/**
 * Construye un bucle circular cerrado (CCW) en mm (útil para Moonburner o núcleo de Finocyl).
 */
export function buildCircleLoopMm(
  radiusMm: number,
  centerXMm: number = 0,
  centerYMm: number = 0,
  segments: number = 64
): GrainContourLoop {
  const segs = Math.max(12, Math.round(segments));
  const loop: GrainContourLoop = new Array(segs);
  const step = (2 * Math.PI) / segs;
  for (let i = 0; i < segs; i++) {
    const a = i * step;
    loop[i] = {
      x: centerXMm + radiusMm * Math.cos(a),
      y: centerYMm + radiusMm * Math.sin(a),
    };
  }
  return loop;
}

/**
 * Construye un bucle rectangular/ranura orientado (CCW) en mm (base para aletas Finocyl o C-Slot).
 */
export function buildSlotLoopMm(
  rInnerMm: number,
  rOuterMm: number,
  halfWidthMm: number,
  angleRad: number = 0
): GrainContourLoop {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const local: GrainPoint2D[] = [
    { x: rInnerMm, y: -halfWidthMm },
    { x: rOuterMm, y: -halfWidthMm },
    { x: rOuterMm, y: halfWidthMm },
    { x: rInnerMm, y: halfWidthMm },
  ];
  return local.map((p) => ({
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  }));
}

/**
 * Construye el hueco de ranura radial abierta al exterior para C-Slot (mm).
 */
export function buildCSlotVoidLoopMm(
  outerRadiusMm: number,
  slotWidthMm: number,
  slotDepthMm: number
): GrainContourLoop {
  const rOut = Math.max(0.5, outerRadiusMm);
  const margin = Math.max(4, rOut * 0.25);
  const halfW = Math.max(0.05, slotWidthMm * 0.5);
  const xStart = rOut - slotDepthMm;
  return [
    { x: xStart, y: -halfW },
    { x: rOut + margin, y: -halfW },
    { x: rOut + margin, y: halfW },
    { x: xStart, y: halfW },
  ];
}

/**
 * Construye el semiplano de corte cordal para D-Grain (mm), recortando desde x = R - cutDepthMm hacia +x.
 */
export function buildDGrainVoidLoopMm(
  outerRadiusMm: number,
  cutDepthMm: number
): GrainContourLoop {
  const rOut = Math.max(0.5, outerRadiusMm);
  const margin = Math.max(4, rOut * 0.25);
  const extentY = rOut + margin;
  const xCut = rOut - cutDepthMm;
  return [
    { x: xCut, y: -extentY },
    { x: rOut + margin, y: -extentY },
    { x: rOut + margin, y: extentY },
    { x: xCut, y: extentY },
  ];
}

/**
 * Combina booleanamente bucles de vacío (`union` de addLoops, menos `subtractLoops`) en Clipper2,
 * devolviendo un conjunto limpio sin auto-intersecciones y con orientación exacta (CCW huecos, CW islas).
 */
export function buildUnifiedVoidLoopsMm(
  addLoopsMm: GrainContourLoop[],
  subtractLoopsMm: GrainContourLoop[] = [],
  outerRadiusRefMm: number = 50
): GrainContourLoop[] {
  const scale = chooseAdaptiveScale(Math.max(1, outerRadiusRefMm));
  const addPaths: Paths64 = addLoopsMm
    .filter((l) => l.length >= 3)
    .map((l) => toPath64(ensureCcwLoop(l), scale));
  if (addPaths.length === 0) return [];

  const unifiedAdd = addPaths.length > 1 ? union(addPaths, [], FillRule.NonZero) : addPaths;
  if (!subtractLoopsMm || subtractLoopsMm.length === 0) {
    return fromPaths64(unifiedAdd, scale);
  }

  const subPaths: Paths64 = subtractLoopsMm
    .filter((l) => l.length >= 3)
    .map((l) => toPath64(ensureCcwLoop(l), scale));
  if (subPaths.length === 0) {
    return fromPaths64(unifiedAdd, scale);
  }

  const diff = difference(unifiedAdd, subPaths, FillRule.NonZero);
  return fromPaths64(diff, scale);
}

/**
 * Evalúa exactamente área transversal, área de paso y perímetros iniciales en x = 0 mediante Clipper2.
 */
export function measureInitialCrossSectionClipper(
  outerRadiusMm: number,
  innerVoidLoopsMm: GrainContourLoop[],
  options?: {
    preserveVoidOrientation?: boolean;
    ci?: number;
    osi?: number;
    circleSegments?: number;
  }
): {
  crossSectionAreaMm2: number;
  portAreaMm2: number;
  innerBurnPerimeterMm: number;
  outerBurnPerimeterMm: number;
} {
  const outerR = Math.max(0.25, outerRadiusMm);
  const circleSegments = Math.max(48, Math.round(options?.circleSegments ?? 144));
  const scale = chooseAdaptiveScale(outerR);
  const invSq = 1 / (scale * scale);

  const outerPaths: Paths64 = [makeCirclePath64(outerR, circleSegments, scale)];
  const voidPaths: Paths64 = innerVoidLoopsMm
    .filter((l) => l.length >= 3)
    .map((l) => toPath64(options?.preserveVoidOrientation ? l : ensureCcwLoop(l), scale));

  const propellantPaths: Paths64 =
    voidPaths.length > 0 ? difference(outerPaths, voidPaths, FillRule.NonZero) : outerPaths;

  const crossSectionAreaMm2 = Math.max(0, areaPaths(propellantPaths) * invSq);
  const envArea = Math.PI * outerR * outerR;
  const portAreaMm2 = Math.max(0, envArea - crossSectionAreaMm2);

  const { innerBurnPerimeterMm, outerBurnPerimeterMm } = measureClassifiedPerimeters(
    propellantPaths,
    scale,
    outerR,
    circleSegments,
    options?.ci ?? 1,
    options?.osi ?? 0
  );

  return {
    crossSectionAreaMm2,
    portAreaMm2,
    innerBurnPerimeterMm,
    outerBurnPerimeterMm,
  };
}

/**
 * Recorta topológicamente un conjunto de bucles 2D al semiplano x >= 0 usando Clipper2.
 */
export function clipLoopsToRightHalfPlaneClipper(
  loops: GrainContourLoop[]
): GrainContourLoop[] {
  if (!loops || loops.length === 0) return [];
  let maxCoord = 1;
  for (const loop of loops) {
    for (const p of loop) {
      const ax = Math.abs(p.x);
      const ay = Math.abs(p.y);
      if (ax > maxCoord) maxCoord = ax;
      if (ay > maxCoord) maxCoord = ay;
    }
  }
  const scale = chooseAdaptiveScale(maxCoord);
  const subjectPaths: Paths64 = [];
  for (const loop of loops) {
    if (loop.length < 3 || Math.abs(signedAreaMm2(loop)) < 1e-6) continue;
    subjectPaths.push(toPath64(loop, scale));
  }
  if (subjectPaths.length === 0) return [];

  const extent = Math.round(maxCoord * 2.5 * scale);
  const halfPlaneClip: Paths64 = [
    [
      { x: 0, y: -extent },
      { x: extent, y: -extent },
      { x: extent, y: extent },
      { x: 0, y: extent },
    ],
  ];

  const clipped = intersect(subjectPaths, halfPlaneClip, FillRule.EvenOdd);
  return fromPaths64(clipped, scale);
}

/**
 * Separa el perímetro total de los polígonos de propelente en:
 * - Frente de combustión interno (`innerBurnPerimeterMm`)
 * - Frontera exterior sobre el diámetro R_eff (`outerBurnPerimeterMm`)
 * garantizando que los arcos exteriores pegados al inhibidor no se sumen cuando osi = 0.
 */
function measureClassifiedPerimeters(
  paths: Paths64,
  scale: number,
  effectiveOuterRadiusMm: number,
  circleSegments: number,
  ci: number,
  osi: number
): { innerBurnPerimeterMm: number; outerBurnPerimeterMm: number } {
  let innerBurnPerimeterMm = 0;
  let outerBurnPerimeterMm = 0;

  const inv = 1 / scale;
  const maxCircleChordMm = ((2 * Math.PI * effectiveOuterRadiusMm) / circleSegments) * 1.35;
  const radialTolMm = Math.max(0.0025, 3 * inv, effectiveOuterRadiusMm * 2.5e-4);
  const circleApothemMm = effectiveOuterRadiusMm * Math.cos(Math.PI / circleSegments);

  for (let pIdx = 0; pIdx < paths.length; pIdx++) {
    const path: Path64 = paths[pIdx];
    const m = path.length;
    if (m < 3) continue;

    for (let i = 0; i < m; i++) {
      const a: Point64 = path[i];
      const b: Point64 = path[(i + 1) % m];
      const ax = a.x * inv;
      const ay = a.y * inv;
      const bx = b.x * inv;
      const by = b.y * inv;

      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen <= 1e-10) continue;

      const rA = Math.hypot(ax, ay);
      const rB = Math.hypot(bx, by);
      const rMid = Math.hypot(0.5 * (ax + bx), 0.5 * (ay + by));
      // Las aristas del disco exterior (CCW) giran positivamente alrededor del origen
      const crossOrigin = ax * by - ay * bx;

      const isOuterArc =
        crossOrigin > 0 &&
        segLen <= maxCircleChordMm &&
        rA >= circleApothemMm - radialTolMm &&
        rA <= effectiveOuterRadiusMm + radialTolMm &&
        rB >= circleApothemMm - radialTolMm &&
        rB <= effectiveOuterRadiusMm + radialTolMm &&
        rMid >= circleApothemMm - radialTolMm &&
        rMid <= effectiveOuterRadiusMm + radialTolMm;

      if (isOuterArc) {
        if (osi === 1) outerBurnPerimeterMm += segLen;
      } else {
        if (ci === 1) innerBurnPerimeterMm += segLen;
      }
    }
  }

  return { innerBurnPerimeterMm, outerBurnPerimeterMm };
}

/**
 * Resuelve la regresión 2D de cualquier geometría compleja poligonal mediante
 * Polygon Offsetting vectorial exacto (Clipper2: JoinType.Round + Difference booleana).
 *
 * Pensado exclusivamente para geometrías complejas (Estrella, Finocyl, Moonburner, C-Slot, DXF);
 * las geometrías simples (BATES y Macizo) mantienen su cálculo analítico exacto.
 */
export function solveGrainBurnbackClipper(
  options: ClipperBurnbackOptions
): GrainBurnbackTable {
  const outerR = Math.max(1e-3, options.outerRadiusMm);
  const ci = options.ci ? 1 : 0;
  const osi = options.osi ? 1 : 0;
  const sampleCount = Math.max(24, Math.round(options.sampleCount ?? 64));
  const circleSegments = Math.max(48, Math.round(options.circleSegments ?? 144));
  const scale = chooseAdaptiveScale(outerR);
  const invSq = 1 / (scale * scale);

  const arcTolMm = options.arcToleranceMm ?? Math.max(0.01, Math.min(0.025, outerR * 4e-4));
  const arcTolScaled = Math.max(2, arcTolMm * scale);

  const normalizedVoids = options.innerVoidLoopsMm
    .filter((loop) => loop.length >= 3)
    .map((loop) => (options.preserveVoidOrientation ? loop : ensureCcwLoop(loop)));
  const initialVoidPaths: Paths64 = normalizedVoids.map((l) => toPath64(l, scale));
  const fixedOuterPaths: Paths64 = [makeCirclePath64(outerR, circleSegments, scale)];

  const evaluateCrossSection = (xMm: number, withPerimetersAndContours: boolean) => {
    const rEff = Math.max(0, outerR - osi * xMm);
    if (rEff <= 1e-4) {
      return {
        areaMm2: 0,
        innerBurnPerimeterMm: 0,
        outerBurnPerimeterMm: 0,
        contoursMm: [] as GrainContourLoop[],
      };
    }

    const outerPaths: Paths64 =
      osi === 1 && xMm > 1e-7
        ? [makeCirclePath64(rEff, circleSegments, scale)]
        : fixedOuterPaths;

    let voidPaths: Paths64 = initialVoidPaths;
    if (ci === 1 && xMm > 1e-7 && initialVoidPaths.length > 0) {
      voidPaths = inflatePaths(
        initialVoidPaths,
        xMm * scale,
        JoinType.Round,
        EndType.Polygon,
        2.0,
        arcTolScaled
      );
    }

    const propellantPaths: Paths64 =
      voidPaths.length > 0
        ? difference(outerPaths, voidPaths, FillRule.NonZero)
        : outerPaths;

    const areaMm2 = Math.max(0, areaPaths(propellantPaths) * invSq);
    if (areaMm2 <= 1e-5) {
      return {
        areaMm2: 0,
        innerBurnPerimeterMm: 0,
        outerBurnPerimeterMm: 0,
        contoursMm: [] as GrainContourLoop[],
      };
    }

    if (!withPerimetersAndContours) {
      return {
        areaMm2,
        innerBurnPerimeterMm: 0,
        outerBurnPerimeterMm: 0,
        contoursMm: undefined,
      };
    }

    const { innerBurnPerimeterMm, outerBurnPerimeterMm } = measureClassifiedPerimeters(
      propellantPaths,
      scale,
      rEff,
      circleSegments,
      ci,
      osi
    );

    const contoursMm = options.includeContours
      ? fromPaths64(propellantPaths, scale)
      : undefined;

    return {
      areaMm2,
      innerBurnPerimeterMm,
      outerBurnPerimeterMm,
      contoursMm,
    };
  };

  // Caso puramente axial (ci = 0 y osi = 0)
  if (ci === 0 && osi === 0) {
    const slice0 = evaluateCrossSection(0, true);
    const xMaxAxial = Math.max(1e-3, options.L0 * 0.5);
    const envArea0 = Math.PI * outerR * outerR;
    return {
      solver: 'clipper',
      gridSize: circleSegments,
      xMaxMm: xMaxAxial,
      samples: [
        {
          xMm: 0,
          crossSectionAreaMm2: slice0.areaMm2,
          portAreaMm2: Math.max(0, envArea0 - slice0.areaMm2),
          innerBurnPerimeterMm: 0,
          outerBurnPerimeterMm: 0,
          contoursMm: slice0.contoursMm,
        },
        {
          xMm: xMaxAxial,
          crossSectionAreaMm2: slice0.areaMm2,
          portAreaMm2: Math.max(0, envArea0 - slice0.areaMm2),
          innerBurnPerimeterMm: 0,
          outerBurnPerimeterMm: 0,
          contoursMm: slice0.contoursMm,
        },
      ],
    };
  }

  // 1. Localizar la profundidad exacta de extinción (xMaxMm) mediante búsqueda binaria
  const areaThresholdMm2 = Math.max(1e-4, Math.PI * outerR * outerR * 1e-5);
  let xLo = 0;
  let xHi = osi === 1 ? outerR : outerR * 2.02;

  // Acotar superiormente con precisión incluso si es excéntrico (Moonburner)
  while (xHi > xLo + 1e-4 && evaluateCrossSection(xHi, false).areaMm2 > areaThresholdMm2) {
    xLo = xHi;
    xHi *= 1.5;
    if (xHi > outerR * 4) break;
  }

  for (let iter = 0; iter < 18; iter++) {
    const mid = 0.5 * (xLo + xHi);
    const res = evaluateCrossSection(mid, false);
    if (res.areaMm2 > areaThresholdMm2) {
      xLo = mid;
    } else {
      xHi = mid;
    }
  }

  const xMaxMm = Math.max(1e-4, xHi);

  // 2. Muestrear la curva completa de regresión desde x = 0 hasta xMaxMm
  // con mayor densidad en el tramo final (tail-off de slivers)
  const bulkSteps = Math.max(8, Math.round(sampleCount * 0.6));
  const midTailSteps = Math.max(6, Math.round(sampleCount * 0.25));
  const tipTailSteps = Math.max(4, sampleCount - bulkSteps - midTailSteps);
  const xSplit1 = 0.78 * xMaxMm;
  const xSplit2 = 0.95 * xMaxMm;

  const sampleSet = new Set<number>();
  for (let i = 0; i < bulkSteps; i++) {
    sampleSet.add((i / bulkSteps) * xSplit1);
  }
  for (let i = 0; i < midTailSteps; i++) {
    sampleSet.add(xSplit1 + (i / midTailSteps) * (xSplit2 - xSplit1));
  }
  for (let i = 0; i < tipTailSteps; i++) {
    sampleSet.add(xSplit2 + (i / tipTailSteps) * (xMaxMm - xSplit2));
  }

  // Refinar alrededor de profundidades críticas de transición (rotura de radios o pared)
  if (options.criticalDepthsMm && options.criticalDepthsMm.length > 0) {
    const eps = Math.max(0.015, xMaxMm * 0.0025);
    for (const xc of options.criticalDepthsMm) {
      if (!Number.isFinite(xc) || xc <= 0.02 || xc >= xMaxMm - 0.02) continue;
      for (const delta of [-4 * eps, -1.5 * eps, -0.35 * eps, 0.35 * eps, 1.5 * eps, 4 * eps]) {
        const xv = xc + delta;
        if (xv > 0 && xv < xMaxMm) {
          sampleSet.add(xv);
        }
      }
    }
  }

  const sampleDepths = Array.from(sampleSet).sort((a, b) => a - b);

  const samples: GrainBurnbackSample[] = [];
  for (let s = 0; s < sampleDepths.length; s++) {
    const xMm = sampleDepths[s];
    const slice = evaluateCrossSection(xMm, true);
    const rEff = Math.max(0, outerR - osi * xMm);
    const envelopeArea = Math.PI * rEff * rEff;

    samples.push({
      xMm,
      crossSectionAreaMm2: slice.areaMm2,
      portAreaMm2: Math.max(0, envelopeArea - slice.areaMm2),
      innerBurnPerimeterMm: slice.innerBurnPerimeterMm,
      outerBurnPerimeterMm: slice.outerBurnPerimeterMm,
      contoursMm: slice.contoursMm,
    });
  }

  // Punto final exacto de extinción
  const rFinal = Math.max(0, outerR - osi * xMaxMm);
  samples.push({
    xMm: xMaxMm,
    crossSectionAreaMm2: 0,
    portAreaMm2: Math.PI * rFinal * rFinal,
    innerBurnPerimeterMm: 0,
    outerBurnPerimeterMm: 0,
    contoursMm: options.includeContours ? [] : undefined,
  });

  return {
    solver: 'clipper',
    gridSize: circleSegments,
    xMaxMm,
    samples,
  };
}

/**
 * Calcula únicamente la profundidad exacta de extinción radial (o axial si ci=0 && osi=0)
 * usando búsqueda binaria ligera sobre Clipper2, ideal para previsualización en tiempo real.
 */
export function estimateClipperWebThicknessMm(options: {
  outerRadiusMm: number;
  ci: number;
  osi: number;
  ei?: number;
  L0: number;
  innerVoidLoopsMm: GrainContourLoop[];
  preserveVoidOrientation?: boolean;
  circleSegments?: number;
}): number {
  const outerR = Math.max(0.25, options.outerRadiusMm);
  const ci = options.ci ? 1 : 0;
  const osi = options.osi ? 1 : 0;
  const ei = options.ei ? 1 : 0;
  const L0 = Math.max(0, options.L0 || 0);
  const axialMax = ei && L0 > 0 ? L0 * 0.5 : Infinity;

  if (ci === 0 && osi === 0) {
    return Number.isFinite(axialMax) ? axialMax : 0;
  }

  const circleSegments = Math.max(48, Math.round(options.circleSegments ?? 84));
  const scale = chooseAdaptiveScale(outerR);
  const invSq = 1 / (scale * scale);
  const arcTolScaled = Math.max(2, Math.max(0.02, outerR * 0.001) * scale);

  const normalizedVoids = options.innerVoidLoopsMm
    .filter((loop) => loop.length >= 3)
    .map((loop) => (options.preserveVoidOrientation ? loop : ensureCcwLoop(loop)));
  const initialVoidPaths: Paths64 = normalizedVoids.map((l) => toPath64(l, scale));
  const fixedOuterPaths: Paths64 = [makeCirclePath64(outerR, circleSegments, scale)];
  const areaThresholdMm2 = Math.max(1e-4, Math.PI * outerR * outerR * 1e-4);

  const areaAt = (xMm: number): number => {
    const rEff = Math.max(0, outerR - osi * xMm);
    if (rEff <= 1e-4) return 0;
    const outerPaths =
      osi === 1 && xMm > 1e-7 ? [makeCirclePath64(rEff, circleSegments, scale)] : fixedOuterPaths;
    const voidPaths =
      ci === 1 && xMm > 1e-7 && initialVoidPaths.length > 0
        ? inflatePaths(initialVoidPaths, xMm * scale, JoinType.Round, EndType.Polygon, 2.0, arcTolScaled)
        : initialVoidPaths;
    const prop = voidPaths.length > 0 ? difference(outerPaths, voidPaths, FillRule.NonZero) : outerPaths;
    return Math.max(0, areaPaths(prop) * invSq);
  };

  let xLo = 0;
  let xHi = osi === 1 ? outerR : outerR * 2.02;
  while (xHi > xLo + 1e-4 && areaAt(xHi) > areaThresholdMm2) {
    xLo = xHi;
    xHi *= 1.5;
    if (xHi > outerR * 4) break;
  }
  for (let iter = 0; iter < 16; iter++) {
    const mid = 0.5 * (xLo + xHi);
    if (areaAt(mid) > areaThresholdMm2) xLo = mid;
    else xHi = mid;
  }

  return Math.min(Math.max(0, xHi), axialMax);
}

/**
 * Evalúa exactamente los contornos vectoriales 2D en una profundidad continua `xMm` cualquiera,
 * evitando saltos discretos entre muestras durante la reproducción 2D y 3D.
 */
export function solveClipperCrossSectionAtDepth(
  options: Pick<
    ClipperBurnbackOptions,
    | 'outerRadiusMm'
    | 'ci'
    | 'osi'
    | 'innerVoidLoopsMm'
    | 'preserveVoidOrientation'
    | 'circleSegments'
    | 'arcToleranceMm'
  >,
  xMm: number
): GrainContourLoop[] {
  const outerR = Math.max(1e-3, options.outerRadiusMm);
  const ci = options.ci ? 1 : 0;
  const osi = options.osi ? 1 : 0;
  const circleSegments = Math.max(48, Math.round(options.circleSegments ?? 144));
  const scale = chooseAdaptiveScale(outerR);
  const invSq = 1 / (scale * scale);
  const arcTolMm = options.arcToleranceMm ?? Math.max(0.01, Math.min(0.025, outerR * 4e-4));
  const arcTolScaled = Math.max(2, arcTolMm * scale);

  const xClamped = Math.max(0, xMm);
  const rEff = Math.max(0, outerR - osi * xClamped);
  if (rEff <= 1e-4) return [];

  const outerPaths: Paths64 = [makeCirclePath64(rEff, circleSegments, scale)];
  const initialVoidPaths: Paths64 = options.innerVoidLoopsMm
    .filter((loop) => loop.length >= 3)
    .map((l) => toPath64(options.preserveVoidOrientation ? l : ensureCcwLoop(l), scale));

  let voidPaths: Paths64 = initialVoidPaths;
  if (ci === 1 && xClamped > 1e-7 && initialVoidPaths.length > 0) {
    voidPaths = inflatePaths(
      initialVoidPaths,
      xClamped * scale,
      JoinType.Round,
      EndType.Polygon,
      2.0,
      arcTolScaled
    );
  }

  const propellantPaths: Paths64 =
    voidPaths.length > 0 ? difference(outerPaths, voidPaths, FillRule.NonZero) : outerPaths;

  if (areaPaths(propellantPaths) * invSq <= 1e-5) {
    return [];
  }

  return fromPaths64(propellantPaths, scale);
}
