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
   * Bucles cerrados en mm (orientación CCW positiva) que describen el/los huecos iniciales del núcleo.
   * Permite modelar Estrella, Finocyl, Moonburner, C-Slot, D-Grain, Wagon Wheel o DXF arbitrarios.
   */
  innerVoidLoopsMm: GrainContourLoop[];
  sampleCount?: number;
  includeContours?: boolean;
  circleSegments?: number;
  arcToleranceMm?: number;
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
  const circleSegments = Math.max(72, Math.round(options.circleSegments ?? 144));
  const scale = chooseAdaptiveScale(outerR);
  const invSq = 1 / (scale * scale);

  const arcTolMm = options.arcToleranceMm ?? Math.max(0.01, Math.min(0.025, outerR * 4e-4));
  const arcTolScaled = Math.max(2, arcTolMm * scale);

  const normalizedVoids = options.innerVoidLoopsMm
    .filter((loop) => loop.length >= 3)
    .map(ensureCcwLoop);
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
  const samples: GrainBurnbackSample[] = [];
  for (let s = 0; s < sampleCount; s++) {
    const xMm = (s / sampleCount) * xMaxMm;
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
 * Evalúa exactamente los contornos vectoriales 2D en una profundidad continua `xMm` cualquiera,
 * evitando saltos discretos entre muestras durante la reproducción 2D y 3D.
 */
export function solveClipperCrossSectionAtDepth(
  options: Pick<
    ClipperBurnbackOptions,
    'outerRadiusMm' | 'ci' | 'osi' | 'innerVoidLoopsMm' | 'circleSegments' | 'arcToleranceMm'
  >,
  xMm: number
): GrainContourLoop[] {
  const outerR = Math.max(1e-3, options.outerRadiusMm);
  const ci = options.ci ? 1 : 0;
  const osi = options.osi ? 1 : 0;
  const circleSegments = Math.max(72, Math.round(options.circleSegments ?? 144));
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
    .map((l) => toPath64(ensureCcwLoop(l), scale));

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
