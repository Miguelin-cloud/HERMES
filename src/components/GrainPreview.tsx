import React, { useId, useMemo } from 'react';
import {
  contoursToSvgPath,
  GrainContourLoop,
  getGrainModule,
  hasCrossSectionContours,
} from '../lib/grains';
import { GrainValidationResult } from '../lib/motorStructure';
import { GrainInput } from '../lib/types';

interface GrainPreviewProps {
  grain: GrainInput;
  disableLabel?: boolean;
  mode?: 'both' | 'transversal' | 'longitudinal';
  availableGrainDiameterMm?: number;
  validation?: GrainValidationResult;
  t?: any;
}

const BURN_COLOR = '#ef4444'; // Burning active front
const BURN_GLOW = 'rgba(239, 68, 68, 0.28)';
const INHIB_COLOR = '#10b981'; // Inhibited face (visible in both light & dark themes)

function splitContourStrokes(
  loops: GrainContourLoop[],
  outerRadiusMm: number,
  cx: number,
  cy: number,
  scale: number
): { outerArcPath: string; innerCutPath: string } {
  if (!loops || loops.length === 0) {
    return { outerArcPath: '', innerCutPath: '' };
  }

  const outerParts: string[] = [];
  const innerParts: string[] = [];
  const rTol = Math.max(0.2, outerRadiusMm * 0.015);
  const rMin = Math.max(0, outerRadiusMm - rTol);
  const rMax = outerRadiusMm + rTol;

  for (const loop of loops) {
    const m = loop.length;
    if (m < 3) continue;

    for (let i = 0; i < m; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % m];
      const mx = 0.5 * (a.x + b.x);
      const my = 0.5 * (a.y + b.y);
      const rA = Math.hypot(a.x, a.y);
      const rB = Math.hypot(b.x, b.y);
      const rMid = Math.hypot(mx, my);
      const crossOrigin = a.x * b.y - a.y * b.x;

      const isOuter =
        crossOrigin > 0 &&
        rA >= rMin &&
        rA <= rMax &&
        rB >= rMin &&
        rB <= rMax &&
        rMid >= rMin &&
        rMid <= rMax;

      const sx = (cx + a.x * scale).toFixed(2);
      const sy = (cy + a.y * scale).toFixed(2);
      const ex = (cx + b.x * scale).toFixed(2);
      const ey = (cy + b.y * scale).toFixed(2);
      const seg = `M ${sx} ${sy} L ${ex} ${ey}`;

      if (isOuter) outerParts.push(seg);
      else innerParts.push(seg);
    }
  }

  return {
    outerArcPath: outerParts.join(' '),
    innerCutPath: innerParts.join(' '),
  };
}

export function GrainPreview({
  grain,
  disableLabel,
  mode = 'both',
  availableGrainDiameterMm,
  validation,
  t,
}: GrainPreviewProps) {
  const uid = useId().replace(/:/g, '');
  const hatchId = `cad-hatch-${uid}`;
  const slotShadeId = `cad-slot-${uid}`;
  const dimArrowId = `cad-arrow-${uid}`;

  const mod = getGrainModule(grain.shape);
  const isComplex = hasCrossSectionContours(grain.shape);

  const hasClearanceErr =
    availableGrainDiameterMm !== undefined &&
    availableGrainDiameterMm > 0 &&
    grain.D0 > availableGrainDiameterMm + 1e-6;

  const hasGeomErr = Boolean(
    validation?.isD0Invalid ||
      validation?.isd0Invalid ||
      validation?.isd0ExceedsD0 ||
      validation?.hasStarError ||
      validation?.hasShapeGeometryError
  );

  const initGeom = useMemo(() => {
    try {
      return mod.getInitialGeometry(grain);
    } catch {
      return {
        blockVolumeMm3: 0,
        totalVolumeMm3: 0,
        crossSectionAreaMm2: 0,
        portAreaMm2: 0,
        starHoleAreaMm2: 0,
        tweb0: 0,
      };
    }
  }, [mod, grain]);

  const drawSize = 132;
  const cx = drawSize / 2;
  const cy = drawSize / 2;
  const maxRefD = Math.max(
    1,
    grain.D0 || 100,
    hasClearanceErr && availableGrainDiameterMm ? availableGrainDiameterMm : 0
  );
  const scale = (drawSize - 26) / maxRefD;

  const rOutPx = Math.max(0.5, (grain.D0 / 2) * scale);
  const availRPx =
    availableGrainDiameterMm && availableGrainDiameterMm > 0
      ? (availableGrainDiameterMm / 2) * scale
      : null;

  const complexLoops = useMemo(() => {
    if (!isComplex || grain.D0 <= 0) return null;
    try {
      return mod.getCrossSectionContoursMm?.(grain, 0) ?? null;
    } catch {
      return null;
    }
  }, [isComplex, mod, grain]);

  const complexPaths = useMemo(() => {
    if (!complexLoops || complexLoops.length === 0) {
      return { fillPath: '', outerArcPath: '', innerCutPath: '' };
    }
    const fillPath = contoursToSvgPath(complexLoops, cx, cy, scale);
    const { outerArcPath, innerCutPath } = splitContourStrokes(
      complexLoops,
      Math.max(0.25, grain.D0 / 2),
      cx,
      cy,
      scale
    );
    return { fillPath, outerArcPath, innerCutPath };
  }, [complexLoops, cx, cy, scale, grain.D0]);

  const batesInnerRPx =
    grain.shape === 1
      ? Math.max(0, Math.min(rOutPx, ((grain.d0 || 0) / 2) * scale))
      : 0;

  const extStroke = grain.osi === 1 ? BURN_COLOR : INHIB_COLOR;
  const intStroke = grain.ci === 1 ? BURN_COLOR : INHIB_COLOR;
  const endStroke = grain.ei === 1 ? BURN_COLOR : INHIB_COLOR;

  const transversal = (
    <div className="flex flex-col justify-between relative w-full h-full px-1.5 py-1 select-none">
      {/* Top CAD Header + Burn/Inhib Mini Legend */}
      {!disableLabel && (
        <div className="flex items-center justify-between gap-1 z-10 shrink-0">
          <span className="text-[8.5px] font-mono font-bold tracking-wider text-muted-foreground uppercase bg-muted/70 border border-border/70 px-1.5 py-0.5 rounded">
            {t?.cross_section || 'Cross-Section'}
          </span>
          <div className="flex items-center gap-1.5 text-[8px] font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              {t?.cad_burning || 'Burn'}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {t?.cad_inhibited || 'Inhib.'}
            </span>
          </div>
        </div>
      )}

      {/* Transversal CAD Blueprint SVG */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${drawSize} ${drawSize}`}
          className="max-h-[115px]"
        >
          <defs>
            <pattern
              id={hatchId}
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="#64748b" fillOpacity="0.45" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.1" strokeOpacity="0.55" />
            </pattern>
            <pattern
              id={slotShadeId}
              width="5"
              height="5"
              patternTransform="rotate(-45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="5" height="5" fill="#334155" fillOpacity="0.28" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#64748b" strokeWidth="0.9" strokeOpacity="0.35" />
            </pattern>
            <marker
              id={dimArrowId}
              viewBox="0 0 8 8"
              refX="4"
              refY="4"
              markerWidth="3.5"
              markerHeight="3.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 4 L 0 7 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* CAD Centerlines */}
          <line
            x1={cx}
            y1="4"
            x2={cx}
            y2={drawSize - 4}
            stroke="var(--border)"
            strokeDasharray="6 3 1.5 3"
            strokeWidth="0.7"
          />
          <line
            x1="4"
            y1={cy}
            x2={drawSize - 4}
            y2={cy}
            stroke="var(--border)"
            strokeDasharray="6 3 1.5 3"
            strokeWidth="0.7"
          />

          {/* Available chamber clearance circle when exceeded */}
          {hasClearanceErr && availRPx !== null && availRPx > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={availRPx}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
          )}

          {/* Complex Clipper2 Contours (Shapes 2, 4, 5, 6, 7, 8, 9) */}
          {isComplex ? (
            <>
              {complexPaths.fillPath && (
                <path
                  d={complexPaths.fillPath}
                  fill={`url(#${hatchId})`}
                  fillRule="evenodd"
                  stroke="none"
                />
              )}
              {/* Burning glow behind active inner walls */}
              {grain.ci === 1 && complexPaths.innerCutPath && (
                <path
                  d={complexPaths.innerCutPath}
                  fill="none"
                  stroke={BURN_GLOW}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
              )}
              {grain.osi === 1 && complexPaths.outerArcPath && (
                <path
                  d={complexPaths.outerArcPath}
                  fill="none"
                  stroke={BURN_GLOW}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
              )}
              {complexPaths.outerArcPath && (
                <path
                  d={complexPaths.outerArcPath}
                  fill="none"
                  stroke={extStroke}
                  strokeWidth={grain.osi === 1 ? '1.9' : '2.6'}
                  strokeLinecap="round"
                />
              )}
              {complexPaths.innerCutPath && (
                <path
                  d={complexPaths.innerCutPath}
                  fill="none"
                  stroke={intStroke}
                  strokeWidth={grain.ci === 1 ? '1.8' : '2.4'}
                  strokeLinecap="round"
                />
              )}
            </>
          ) : (
            <>
              {/* Analytical BATES (1) or Solid (3) */}
              {grain.shape === 1 && batesInnerRPx > 0 && rOutPx > batesInnerRPx ? (
                <>
                  <path
                    d={`M ${cx + rOutPx} ${cy} A ${rOutPx} ${rOutPx} 0 1 0 ${cx - rOutPx} ${cy} A ${rOutPx} ${rOutPx} 0 1 0 ${cx + rOutPx} ${cy} M ${cx + batesInnerRPx} ${cy} A ${batesInnerRPx} ${batesInnerRPx} 0 1 1 ${cx - batesInnerRPx} ${cy} A ${batesInnerRPx} ${batesInnerRPx} 0 1 1 ${cx + batesInnerRPx} ${cy}`}
                    fill={`url(#${hatchId})`}
                    fillRule="evenodd"
                  />
                  {grain.osi === 1 && (
                    <circle cx={cx} cy={cy} r={rOutPx} fill="none" stroke={BURN_GLOW} strokeWidth="4.2" />
                  )}
                  {grain.ci === 1 && (
                    <circle cx={cx} cy={cy} r={batesInnerRPx} fill="none" stroke={BURN_GLOW} strokeWidth="4.2" />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rOutPx}
                    fill="none"
                    stroke={extStroke}
                    strokeWidth={grain.osi === 1 ? '1.9' : '2.6'}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={batesInnerRPx}
                    fill="none"
                    stroke={intStroke}
                    strokeWidth={grain.ci === 1 ? '1.9' : '2.5'}
                  />
                </>
              ) : (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rOutPx}
                    fill={`url(#${hatchId})`}
                    stroke={extStroke}
                    strokeWidth={grain.osi === 1 ? '1.9' : '2.6'}
                  />
                </>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Bottom CAD Callout Strip */}
      {!disableLabel && (
        <div className="flex items-center justify-between gap-1 text-[8.5px] font-mono tabular-nums z-10 shrink-0 px-0.5">
          <span className={hasClearanceErr ? 'text-amber-500 font-bold' : 'text-muted-foreground'}>
            Ø{Number(grain.D0 || 0).toFixed(1)}
          </span>
          {hasGeomErr ? (
            <span className="text-red-500 font-bold uppercase tracking-tight">
              {t?.cad_invalid_geom || 'Invalid'}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t?.cad_web || 'Web'} {initGeom.tweb0.toFixed(1)}mm
            </span>
          )}
        </div>
      )}
    </div>
  );

  const longitudinal = (
    <div className="flex flex-col justify-between relative w-full h-full px-1.5 py-1 select-none">
      {!disableLabel && (
        <div className="flex items-center justify-between gap-1 z-10 shrink-0">
          <span className="text-[8.5px] font-mono font-bold tracking-wider text-muted-foreground uppercase bg-muted/70 border border-border/70 px-1.5 py-0.5 rounded">
            {t?.side_view || 'Side View'}
          </span>
          <span className="text-[8.5px] font-mono tabular-nums text-muted-foreground">
            {grain.N}×{Number(grain.L0 || 0).toFixed(0)}mm
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 176 96"
          preserveAspectRatio="xMidYMid meet"
          className="max-h-[115px]"
        >
          {(() => {
            const totalL = Math.max(1, (grain.L0 || 1) * Math.max(1, grain.N || 1));
            const safeD0 = Math.max(1, grain.D0 || 10);
            const aspect = totalL / safeD0;

            // Keep realistic aspect ratio within comfortable CAD framing
            const maxDrawW = 142;
            const maxDrawH = 54;
            let scaledD = Math.min(maxDrawH, Math.max(24, maxDrawW / Math.max(0.6, aspect)));
            let scaledL = Math.min(maxDrawW, Math.max(36, scaledD * aspect));
            if (scaledL > maxDrawW) {
              scaledL = maxDrawW;
            }
            const yCenter = 43;
            const topY = yCenter - scaledD / 2;
            const botY = yCenter + scaledD / 2;
            const pxPerMmY = scaledD / safeD0;
            const segPxL = scaledL / Math.max(1, grain.N || 1);

            const startX = (176 - scaledL) / 2;
            const d0Px = Math.min(scaledD - 2, Math.max(0, (grain.d0 || 0) * pxPerMmY));
            const d0MayorPx = Math.min(scaledD - 1, Math.max(d0Px, (grain.d0mayor || 0) * pxPerMmY));

            return (
              <g>
                {/* Axial Centerline */}
                <line
                  x1="6"
                  y1={yCenter}
                  x2="170"
                  y2={yCenter}
                  stroke="var(--border)"
                  strokeDasharray="7 3 1.5 3"
                  strokeWidth="0.75"
                />

                <g transform={`translate(${startX}, 0)`}>
                  {/* Shape-specific axial cutaway */}
                  {(() => {
                    // 3: Solid cylinder
                    if (grain.shape === 3) {
                      return (
                        <rect
                          x={0}
                          y={topY}
                          width={scaledL}
                          height={scaledD}
                          fill={`url(#${hatchId})`}
                          rx="1"
                        />
                      );
                    }

                    // 5: Moonburner (asymmetric offset bore shifted upward)
                    if (grain.shape === 5) {
                      const offPx = Math.max(0, (Number(grain.coreOffset) || 0) * pxPerMmY);
                      const boreTop = Math.max(topY + 1, yCenter - offPx - d0Px / 2);
                      const boreBot = Math.min(botY - 1, yCenter - offPx + d0Px / 2);
                      return (
                        <g>
                          <rect x={0} y={topY} width={scaledL} height={Math.max(0, boreTop - topY)} fill={`url(#${hatchId})`} />
                          <rect x={0} y={boreBot} width={scaledL} height={Math.max(0, botY - boreBot)} fill={`url(#${hatchId})`} />
                          <line x1={0} y1={boreTop} x2={scaledL} y2={boreTop} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.7' : '2.2'} />
                          <line x1={0} y1={boreBot} x2={scaledL} y2={boreBot} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.7' : '2.2'} />
                        </g>
                      );
                    }

                    // 6: C-Slot (open slot cut down from top surface)
                    if (grain.shape === 6) {
                      const depthPx = Math.min(scaledD - 2, Math.max(2, (Number(grain.slotDepth) || safeD0 * 0.5) * pxPerMmY));
                      const cutBot = topY + depthPx;
                      return (
                        <g>
                          {/* Lower solid propellant body + slot side projection */}
                          <rect x={0} y={topY} width={scaledL} height={depthPx} fill={`url(#${slotShadeId})`} />
                          <rect x={0} y={cutBot} width={scaledL} height={Math.max(0, botY - cutBot)} fill={`url(#${hatchId})`} />
                          <line x1={0} y1={cutBot} x2={scaledL} y2={cutBot} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.7' : '2.2'} />
                        </g>
                      );
                    }

                    // 7: D-Grain (top chord removed)
                    if (grain.shape === 7) {
                      const cutPx = Math.min(scaledD - 2, Math.max(2, (Number(grain.slotDepth) || safeD0 * 0.45) * pxPerMmY));
                      const webTop = topY + cutPx;
                      return (
                        <g>
                          {/* Empty upper D-cut outline hint */}
                          <rect x={0} y={topY} width={scaledL} height={cutPx} fill="none" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.6" />
                          <rect x={0} y={webTop} width={scaledL} height={Math.max(0, botY - webTop)} fill={`url(#${hatchId})`} />
                          <line x1={0} y1={webTop} x2={scaledL} y2={webTop} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.8' : '2.3'} />
                        </g>
                      );
                    }

                    // 8: Rod & Tube (concentric solid rod in center + outer tube walls)
                    if (grain.shape === 8) {
                      const rodPx = Math.min(d0Px - 2, Math.max(2, (Number(grain.rodDiameter) || safeD0 * 0.25) * pxPerMmY));
                      const tubeInnerTop = yCenter - d0Px / 2;
                      const tubeInnerBot = yCenter + d0Px / 2;
                      const rodTop = yCenter - rodPx / 2;
                      const rodBot = yCenter + rodPx / 2;
                      return (
                        <g>
                          {/* Upper & lower outer tube */}
                          <rect x={0} y={topY} width={scaledL} height={Math.max(0, tubeInnerTop - topY)} fill={`url(#${hatchId})`} />
                          <rect x={0} y={tubeInnerBot} width={scaledL} height={Math.max(0, botY - tubeInnerBot)} fill={`url(#${hatchId})`} />
                          {/* Central solid rod */}
                          <rect x={0} y={rodTop} width={scaledL} height={rodPx} fill={`url(#${hatchId})`} />
                          {/* Burning/inhibited inner surfaces */}
                          <line x1={0} y1={tubeInnerTop} x2={scaledL} y2={tubeInnerTop} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.6' : '2.1'} />
                          <line x1={0} y1={tubeInnerBot} x2={scaledL} y2={tubeInnerBot} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.6' : '2.1'} />
                          <line x1={0} y1={rodTop} x2={scaledL} y2={rodTop} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.5' : '2.0'} />
                          <line x1={0} y1={rodBot} x2={scaledL} y2={rodBot} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.5' : '2.0'} />
                        </g>
                      );
                    }

                    // 1 (BATES), 2 (Star), 4 (Finocyl), 9 (Wagon Wheel)
                    const hasFeatureBand = (grain.shape === 2 || grain.shape === 4 || grain.shape === 9) && d0MayorPx > d0Px;
                    const coreTop = yCenter - d0Px / 2;
                    const coreBot = yCenter + d0Px / 2;
                    const featTop = yCenter - d0MayorPx / 2;
                    const featBot = yCenter + d0MayorPx / 2;

                    return (
                      <g>
                        {/* Outer propellant wall */}
                        <rect
                          x={0}
                          y={topY}
                          width={scaledL}
                          height={Math.max(0, (hasFeatureBand ? featTop : coreTop) - topY)}
                          fill={`url(#${hatchId})`}
                        />
                        <rect
                          x={0}
                          y={hasFeatureBand ? featBot : coreBot}
                          width={scaledL}
                          height={Math.max(0, botY - (hasFeatureBand ? featBot : coreBot))}
                          fill={`url(#${hatchId})`}
                        />
                        {/* Fin/Arm/Spoke depth pocket shading */}
                        {hasFeatureBand && (
                          <>
                            <rect x={0} y={featTop} width={scaledL} height={Math.max(0, coreTop - featTop)} fill={`url(#${slotShadeId})`} />
                            <rect x={0} y={coreBot} width={scaledL} height={Math.max(0, featBot - coreBot)} fill={`url(#${slotShadeId})`} />
                            <line
                              x1={0}
                              y1={featTop}
                              x2={scaledL}
                              y2={featTop}
                              stroke={intStroke}
                              strokeWidth="1.0"
                              strokeDasharray="3 1.5"
                              opacity="0.85"
                            />
                            <line
                              x1={0}
                              y1={featBot}
                              x2={scaledL}
                              y2={featBot}
                              stroke={intStroke}
                              strokeWidth="1.0"
                              strokeDasharray="3 1.5"
                              opacity="0.85"
                            />
                          </>
                        )}
                        {/* Central bore */}
                        <line x1={0} y1={coreTop} x2={scaledL} y2={coreTop} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.7' : '2.2'} />
                        <line x1={0} y1={coreBot} x2={scaledL} y2={coreBot} stroke={intStroke} strokeWidth={grain.ci === 1 ? '1.7' : '2.2'} />
                      </g>
                    );
                  })()}

                  {/* Outer wall lines (EXT / osi) - for D-Grain top edge is cut away */}
                  {grain.shape !== 7 && (
                    <line
                      x1={0}
                      y1={topY}
                      x2={scaledL}
                      y2={topY}
                      stroke={extStroke}
                      strokeWidth={grain.osi === 1 ? '1.8' : '2.5'}
                    />
                  )}
                  <line
                    x1={0}
                    y1={botY}
                    x2={scaledL}
                    y2={botY}
                    stroke={extStroke}
                    strokeWidth={grain.osi === 1 ? '1.8' : '2.5'}
                  />

                  {/* Left & Right end faces (ENDS / ei) */}
                  {(() => {
                    const endTopY =
                      grain.shape === 7
                        ? topY + Math.min(scaledD - 2, Math.max(2, (Number(grain.slotDepth) || safeD0 * 0.45) * pxPerMmY))
                        : topY;
                    return (
                      <>
                        <line
                          x1={0}
                          y1={endTopY}
                          x2={0}
                          y2={botY}
                          stroke={endStroke}
                          strokeWidth={grain.ei === 1 ? '1.8' : '2.6'}
                        />
                        <line
                          x1={scaledL}
                          y1={endTopY}
                          x2={scaledL}
                          y2={botY}
                          stroke={endStroke}
                          strokeWidth={grain.ei === 1 ? '1.8' : '2.6'}
                        />
                      </>
                    );
                  })()}

                  {/* Multi-segment N dividers */}
                  {grain.N > 1 &&
                    Array.from({ length: grain.N - 1 }).map((_, j) => {
                      const divX = (j + 1) * segPxL;
                      return (
                        <line
                          key={j}
                          x1={divX}
                          y1={topY + 1}
                          x2={divX}
                          y2={botY - 1}
                          stroke={endStroke}
                          strokeWidth="0.9"
                          strokeDasharray="2 1.5"
                          opacity="0.85"
                        />
                      );
                    })}

                  {/* Bottom length dimension line */}
                  <line
                    x1={0}
                    y1={botY + 3}
                    x2={0}
                    y2={botY + 12}
                    stroke="#64748b"
                    strokeWidth="0.6"
                  />
                  <line
                    x1={scaledL}
                    y1={botY + 3}
                    x2={scaledL}
                    y2={botY + 12}
                    stroke="#64748b"
                    strokeWidth="0.6"
                  />
                  <line
                    x1={2}
                    y1={botY + 8.5}
                    x2={Math.max(2, scaledL - 2)}
                    y2={botY + 8.5}
                    stroke="#94a3b8"
                    strokeWidth="0.9"
                    markerStart={`url(#${dimArrowId})`}
                    markerEnd={`url(#${dimArrowId})`}
                  />
                  <text
                    x={scaledL / 2}
                    y={botY + 17.5}
                    fontSize="7.5"
                    fill="#94a3b8"
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ΣL={totalL.toFixed(0)}mm
                  </text>
                </g>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Bottom Face Summary Strip */}
      {!disableLabel && (
        <div className="flex items-center justify-center gap-2 text-[8px] font-mono text-muted-foreground z-10 shrink-0">
          <span className={grain.osi === 1 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
            EXT:{grain.osi ? 'ON' : 'INHIB'}
          </span>
          <span className="opacity-35">·</span>
          <span className={grain.ei === 1 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
            END:{grain.ei ? 'ON' : 'INHIB'}
          </span>
          {grain.shape !== 3 && (
            <>
              <span className="opacity-35">·</span>
              <span className={grain.ci === 1 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                INT:{grain.ci ? 'ON' : 'INHIB'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (mode === 'transversal') return transversal;
  if (mode === 'longitudinal') return longitudinal;

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex-1 border-b border-border/60">{transversal}</div>
      <div className="flex-1">{longitudinal}</div>
    </div>
  );
}
