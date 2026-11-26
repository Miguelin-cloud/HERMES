import React from 'react';
import { AlertCircle } from 'lucide-react';
import { GrainInput, MotorInput, NozzleInput } from '../lib/types';
import { calculateMotorStructure, getMaxGrainOuterDiameter } from '../lib/motorStructure';
import { computeMeridianLongitudinalCut, getGrainModule, MeridianSliceInfo } from '../lib/grains';

export function MotorPreview({
  motor,
  grains,
  nozzle,
  t,
  overpressure = false,
}: {
  motor: MotorInput;
  grains: GrainInput[];
  nozzle?: NozzleInput;
  t?: any;
  overpressure?: boolean;
}) {
  const struct = calculateMotorStructure(motor);
  const maxGrainD0 = getMaxGrainOuterDiameter(grains);

  const drawWidth = 760;
  const drawHeight = 190;
  const centerY = 88;

  // Nozzle geometry (mm)
  const rChamber = Math.max(1, motor.Dc / 2);
  const rThroat = Math.max(0.5, (nozzle?.Dt0 || motor.Dc * 0.3) / 2);
  const rExit = Math.max(rThroat + 0.5, (nozzle?.Ds || motor.Dc * 0.65) / 2);
  const alphaRad = ((nozzle?.alpha || 12) * Math.PI) / 180;
  const lConv = Math.max(8, Math.abs(rChamber - rThroat) / Math.tan((35 * Math.PI) / 180));
  const lDiv = Math.max(12, Math.abs(rExit - rThroat) / Math.max(0.08, Math.tan(alphaRad)));
  const frontClosureMm = Math.max(10, motor.Dc * 0.18);

  const totalAssemblyMm = frontClosureMm + Math.max(motor.Lc, 10) + lConv + lDiv;
  const maxRadialMm = Math.max(
    struct.outerDiameterMm,
    (nozzle?.Ds || 0) + 6,
    maxGrainD0 + 2 * struct.inhibitorThicknessMm
  );

  const scaleX = (drawWidth - 130) / Math.max(totalAssemblyMm, 20);
  const scaleY = (drawHeight - 58) / Math.max(maxRadialMm, 10);
  const scale = Math.min(scaleX, scaleY);

  const chamberStartX = 68 + frontClosureMm * scale;
  const chamberWidthPx = Math.max(10, motor.Lc * scale);
  const dcHalfPx = (motor.Dc / 2) * scale;
  const wallPx = Math.max(1.5, struct.wallThicknessMm * scale);
  const linerPx = motor.hasLiner ? Math.max(0, struct.linerThicknessMm * scale) : 0;
  const inhibPx = motor.hasInhibitor ? Math.max(0, struct.inhibitorThicknessMm * scale) : 0;
  const closureWidthPx = frontClosureMm * scale;

  let totalGrainLength = 0;
  let hasRadialInterference = false;
  grains.forEach((g) => {
    totalGrainLength += (Number(g.L0) || 0) * (Number(g.N) || 0);
    if ((Number(g.D0) || 0) > struct.availableGrainDiameterMm + 1e-6) {
      hasRadialInterference = true;
    }
  });

  const hasNegativeClearance = struct.availableGrainDiameterMm <= 0;
  const hasLengthError = totalGrainLength > motor.Lc + 1e-6;
  const hasError = hasLengthError || hasRadialInterference || hasNegativeClearance || overpressure;

  // Material visual tones
  const casingFill =
    struct.materialId === 'ss304'
      ? 'url(#casingSteelGrad)'
      : struct.materialId === 'custom'
        ? 'url(#casingCustomGrad)'
        : 'url(#casingAlGrad)';
  const casingStroke =
    struct.materialId === 'ss304'
      ? '#64748b'
      : struct.materialId === 'custom'
        ? '#8b5cf6'
        : '#60a5fa';

  const nozzleX0 = chamberStartX + chamberWidthPx;
  const nozzleXThroat = nozzleX0 + lConv * scale;
  const nozzleXExit = nozzleXThroat + lDiv * scale;
  const rThroatPx = rThroat * scale;
  const rExitPx = rExit * scale;
  const nozzleWallPx = Math.max(2, wallPx * 0.85);

  return (
    <div className="relative w-full h-full flex flex-col justify-between">
      {/* Top Bar: Legend & Design Alerts */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pt-1.5 z-10">
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono">
          <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-muted/80 px-1.5 py-0.5 rounded border border-border">
            {t?.motor_chamber || 'Chamber'} SCHEMATIC
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-[2px] border border-blue-400 bg-slate-400/80 inline-block" />
            {t?.casing_legend || 'Casing'} ({struct.wallThicknessMm.toFixed(1)}mm)
          </span>
          {motor.hasLiner && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-[2px] border border-amber-500 bg-amber-500/70 inline-block" />
              {t?.liner_legend || 'Liner'} ({struct.linerThicknessMm.toFixed(1)}mm)
            </span>
          )}
          {motor.hasInhibitor && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-[2px] border border-emerald-500 bg-emerald-600/70 inline-block" />
              {t?.inhibitor_legend || 'Inhibitor'} ({struct.inhibitorThicknessMm.toFixed(1)}mm)
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-[2px] border border-slate-500 bg-slate-300 inline-block" />
            {t?.propellant_legend || 'Propellant'}
          </span>
        </div>

        {hasError && (
          <div className="text-[9.5px] font-bold font-mono text-red-600 dark:text-red-300 bg-red-500/15 px-2 py-0.5 rounded border border-red-500/40 flex items-center gap-1 shadow-xs animate-pulse">
            <AlertCircle size={12} className="shrink-0" />
            <span className="uppercase tracking-wider">
              {t?.design_violations_label || 'Design Violations'}
            </span>
          </div>
        )}
      </div>

      {/* Main Blueprint SVG */}
      <div
        className={`w-full flex-1 min-h-[145px] overflow-hidden rounded-sm flex items-center justify-center px-2 pb-1 transition-colors duration-300 ${
          hasError ? 'bg-red-950/10' : 'bg-transparent'
        }`}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${drawWidth} ${drawHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="max-h-[185px] w-full"
        >
          <defs>
            <linearGradient id="casingAlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="casingSteelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="casingCustomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#c4b5fd" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.8" />
            </linearGradient>
            <pattern id="linerHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#b45309" fillOpacity="0.75" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.6" />
            </pattern>
            <pattern id="inhibHatch" width="5" height="5" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill="#047857" fillOpacity="0.8" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#34d399" strokeWidth="1" strokeOpacity="0.6" />
            </pattern>
            <marker id="dimArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Chamber Cavity Background */}
          <rect
            x={chamberStartX}
            y={centerY - dcHalfPx}
            width={chamberWidthPx}
            height={dcHalfPx * 2}
            fill="#0b1120"
            fillOpacity="0.7"
          />

          {/* OPTIONAL THERMAL LINER (Inside Dc wall) */}
          {motor.hasLiner && linerPx > 0 && (
            <g>
              <rect
                x={chamberStartX}
                y={centerY - dcHalfPx}
                width={chamberWidthPx}
                height={Math.min(dcHalfPx, linerPx)}
                fill="url(#linerHatch)"
                stroke="#f59e0b"
                strokeWidth="0.7"
              />
              <rect
                x={chamberStartX}
                y={centerY + dcHalfPx - Math.min(dcHalfPx, linerPx)}
                width={chamberWidthPx}
                height={Math.min(dcHalfPx, linerPx)}
                fill="url(#linerHatch)"
                stroke="#f59e0b"
                strokeWidth="0.7"
              />
            </g>
          )}

          {/* PROPELLANT GRAINS & OPTIONAL OUTER INHIBITOR */}
          {grains.map((g, index) => {
            let startX = chamberStartX;
            for (let i = 0; i < index; i++) {
              startX += grains[i].L0 * grains[i].N * scale;
            }

            let fillColor = '#cbd5e1';
            if (g.propellantType === 4 || g.propellantType === 5) fillColor = '#fca5a5';
            else if (g.propellantType === 6 || g.propellantType === 7) fillColor = '#94a3b8';
            else if (g.propellantType > 7) fillColor = '#c4b5fd';

            const grainOverlap = g.D0 > struct.availableGrainDiameterMm + 1e-6;
            const gapPx = g.N > 1 ? Math.min(2, g.L0 * scale * 0.05) : 0;

            let customMeridian: MeridianSliceInfo | null = null;
            if (g.shape === 10) {
              try {
                const loops = getGrainModule(10).getCrossSectionContoursMm?.(g, 0) ?? null;
                if (loops && loops.length > 0) {
                  customMeridian = computeMeridianLongitudinalCut(loops, Math.max(0.25, g.D0 / 2));
                }
              } catch {
                customMeridian = null;
              }
            }

            return (
              <g key={g.id}>
                {Array.from({ length: g.N }).map((_, j) => {
                  const segX = startX + j * g.L0 * scale + gapPx * 0.5;
                  const segW = Math.max(1, g.L0 * scale - gapPx);
                  const grainHalfPx = Math.max(0.5, (g.D0 / 2) * scale);
                  const propTop = centerY - grainHalfPx;
                  const propH = grainHalfPx * 2;

                  const coreHeight =
                    g.shape === 1 || g.shape === 5 || g.shape === 8
                      ? (g.d0 || 0) * scale
                      : g.shape === 2 || g.shape === 4 || g.shape === 9
                        ? Math.max(g.d0 || 0, g.d0mayor || 0) * scale
                        : 0;
                  const coreTop =
                    g.shape === 5
                      ? centerY - ((Number(g.coreOffset) || 0) + (g.d0 || 0) / 2) * scale
                      : centerY - coreHeight / 2;

                  const slotCutH =
                    g.shape === 6 || g.shape === 7
                      ? Math.min(propH - 1, Math.max(1, (Number(g.slotDepth) || g.D0 * 0.45) * scale))
                      : 0;
                  const innerCoreOnlyH = Math.max(0, (g.d0 || 0) * scale);
                  const innerCoreOnlyTop = centerY - innerCoreOnlyH / 2;
                  const rodH = g.shape === 8 ? Math.max(1, (Number(g.rodDiameter) || 0) * scale) : 0;

                  return (
                    <g key={j}>
                      {/* Optional Outer Inhibitor Sleeve */}
                      {motor.hasInhibitor && inhibPx > 0 && (
                        <g>
                          <rect
                            x={segX}
                            y={propTop - inhibPx}
                            width={segW}
                            height={inhibPx}
                            fill={grainOverlap ? '#ef4444' : 'url(#inhibHatch)'}
                            fillOpacity={grainOverlap ? 0.7 : 0.95}
                            stroke={grainOverlap ? '#f87171' : '#10b981'}
                            strokeWidth="0.6"
                          />
                          <rect
                            x={segX}
                            y={propTop + propH}
                            width={segW}
                            height={inhibPx}
                            fill={grainOverlap ? '#ef4444' : 'url(#inhibHatch)'}
                            fillOpacity={grainOverlap ? 0.7 : 0.95}
                            stroke={grainOverlap ? '#f87171' : '#10b981'}
                            strokeWidth="0.6"
                          />
                          {/* End inhibition cap visual indicator if ei === 0 */}
                          {g.ei === 0 && segW > 4 && (
                            <>
                              <rect
                                x={segX}
                                y={propTop}
                                width={Math.min(inhibPx, segW * 0.15)}
                                height={propH}
                                fill="url(#inhibHatch)"
                                opacity="0.85"
                              />
                              <rect
                                x={segX + segW - Math.min(inhibPx, segW * 0.15)}
                                y={propTop}
                                width={Math.min(inhibPx, segW * 0.15)}
                                height={propH}
                                fill="url(#inhibHatch)"
                                opacity="0.85"
                              />
                            </>
                          )}
                        </g>
                      )}

                      {/* Propellant Block */}
                      {g.shape === 10 && customMeridian ? (
                        <>
                          {customMeridian.topEdgeExposed || customMeridian.bottomEdgeExposed ? (
                            <>
                              <rect
                                x={segX}
                                y={propTop}
                                width={segW}
                                height={propH}
                                fill="none"
                                stroke={grainOverlap ? '#ef4444' : '#475569'}
                                strokeDasharray="2 2"
                                strokeWidth={grainOverlap ? 1.2 : 0.6}
                                opacity={0.75}
                              />
                              {customMeridian.solidIntervalsMm.map((band, bi) => {
                                const bTop = centerY + band.yMin * scale;
                                const bH = Math.max(0.5, (band.yMax - band.yMin) * scale);
                                return (
                                  <rect
                                    key={bi}
                                    x={segX}
                                    y={bTop}
                                    width={segW}
                                    height={bH}
                                    fill={fillColor}
                                    stroke={grainOverlap ? '#ef4444' : '#475569'}
                                    strokeWidth={grainOverlap ? 1.2 : 0.7}
                                    opacity={grainOverlap ? 0.8 : 1}
                                  />
                                );
                              })}
                            </>
                          ) : (
                            <>
                              <rect
                                x={segX}
                                y={propTop}
                                width={segW}
                                height={propH}
                                fill={fillColor}
                                stroke={grainOverlap ? '#ef4444' : '#475569'}
                                strokeWidth={grainOverlap ? 1.5 : 0.8}
                                opacity={grainOverlap ? 0.8 : 1}
                              />
                              {customMeridian.voidIntervalsMm.map((vBand, vi) => {
                                const vTop = Math.max(propTop + 0.5, centerY + vBand.yMin * scale);
                                const vBot = Math.min(propTop + propH - 0.5, centerY + vBand.yMax * scale);
                                const vH = Math.max(0, vBot - vTop);
                                if (vH <= 0.4) return null;
                                return (
                                  <rect
                                    key={vi}
                                    x={segX}
                                    y={vTop}
                                    width={segW}
                                    height={vH}
                                    fill="#0b1120"
                                    stroke="#64748b"
                                    strokeWidth="0.5"
                                    strokeDasharray="2 1"
                                  />
                                );
                              })}
                              {customMeridian.voidIntervalsMm.length === 0 &&
                                customMeridian.projectedVoidRangeMm && (
                                  <rect
                                    x={segX}
                                    y={Math.max(
                                      propTop + 0.5,
                                      centerY + customMeridian.projectedVoidRangeMm.yMin * scale
                                    )}
                                    width={segW}
                                    height={Math.min(
                                      propH - 1,
                                      Math.max(
                                        0,
                                        (customMeridian.projectedVoidRangeMm.yMax -
                                          customMeridian.projectedVoidRangeMm.yMin) *
                                          scale
                                      )
                                    )}
                                    fill="#1e293b"
                                    fillOpacity="0.6"
                                    stroke="#64748b"
                                    strokeWidth="0.45"
                                    strokeDasharray="2 1"
                                  />
                                )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <rect
                            x={segX}
                            y={propTop}
                            width={segW}
                            height={propH}
                            fill={fillColor}
                            stroke={grainOverlap ? '#ef4444' : '#475569'}
                            strokeWidth={grainOverlap ? 1.5 : 0.8}
                            opacity={grainOverlap ? 0.8 : 1}
                          />

                          {/* Shape-specific Inner Port / Cutaway */}
                          {(g.shape === 1 || g.shape === 5) && coreHeight > 0 && (
                            <rect
                              x={segX}
                              y={Math.max(propTop + 0.5, coreTop)}
                              width={segW}
                              height={Math.min(propH - 1, coreHeight)}
                              fill="#0b1120"
                              stroke="#64748b"
                              strokeWidth="0.5"
                              strokeDasharray="2 1"
                            />
                          )}

                          {(g.shape === 2 || g.shape === 4 || g.shape === 9) && coreHeight > 0 && (
                            <>
                              <rect
                                x={segX}
                                y={Math.max(propTop + 0.5, coreTop)}
                                width={segW}
                                height={Math.min(propH - 1, coreHeight)}
                                fill="#1e293b"
                                fillOpacity="0.65"
                                stroke="#64748b"
                                strokeWidth="0.45"
                                strokeDasharray="2 1"
                              />
                              {innerCoreOnlyH > 0 && (
                                <rect
                                  x={segX}
                                  y={Math.max(propTop + 0.5, innerCoreOnlyTop)}
                                  width={segW}
                                  height={Math.min(propH - 1, innerCoreOnlyH)}
                                  fill="#0b1120"
                                />
                              )}
                            </>
                          )}

                          {(g.shape === 6 || g.shape === 7) && slotCutH > 0 && (
                            <rect
                              x={segX}
                              y={propTop}
                              width={segW}
                              height={slotCutH}
                              fill="#0b1120"
                              fillOpacity={g.shape === 7 ? 0.92 : 0.72}
                              stroke="#64748b"
                              strokeWidth="0.5"
                              strokeDasharray="2 1"
                            />
                          )}

                          {g.shape === 8 && coreHeight > 0 && (
                            <>
                              <rect
                                x={segX}
                                y={Math.max(propTop + 0.5, centerY - coreHeight / 2)}
                                width={segW}
                                height={Math.min(propH - 1, coreHeight)}
                                fill="#0b1120"
                                stroke="#64748b"
                                strokeWidth="0.5"
                                strokeDasharray="2 1"
                              />
                              {rodH > 0 && (
                                <rect
                                  x={segX}
                                  y={centerY - rodH / 2}
                                  width={segW}
                                  height={rodH}
                                  fill={fillColor}
                                  stroke="#475569"
                                  strokeWidth="0.6"
                                />
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* Segment Index */}
                      {segW > 18 && propH > 12 && (
                        <text
                          x={segX + segW / 2}
                          y={centerY}
                          fontSize="8.5"
                          fill={
                            g.shape === 10
                              ? customMeridian?.voidIntervalsMm.some((v) => v.yMin <= -0.5 && v.yMax >= 0.5)
                                ? '#e2e8f0'
                                : '#0f172a'
                              : g.shape !== 3 && g.shape !== 8 && coreHeight > 10
                                ? '#e2e8f0'
                                : '#0f172a'
                          }
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {index + 1}.{j + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* CASING CYLINDER WALLS (Real wallThickness) */}
          <rect
            x={chamberStartX}
            y={centerY - dcHalfPx - wallPx}
            width={chamberWidthPx}
            height={wallPx}
            fill={casingFill}
            stroke={overpressure ? '#ef4444' : casingStroke}
            strokeWidth={overpressure ? 1.4 : 0.9}
          />
          <rect
            x={chamberStartX}
            y={centerY + dcHalfPx}
            width={chamberWidthPx}
            height={wallPx}
            fill={casingFill}
            stroke={overpressure ? '#ef4444' : casingStroke}
            strokeWidth={overpressure ? 1.4 : 0.9}
          />

          {/* FRONT CLOSURE / BULKHEAD + O-RINGS */}
          <rect
            x={chamberStartX - closureWidthPx}
            y={centerY - dcHalfPx - wallPx}
            width={closureWidthPx}
            height={(dcHalfPx + wallPx) * 2}
            rx="2"
            fill="#475569"
            stroke={casingStroke}
            strokeWidth="1"
          />
          {/* Bulkhead Flange Lip */}
          <rect
            x={chamberStartX - closureWidthPx - 4}
            y={centerY - dcHalfPx - wallPx - 2}
            width={5}
            height={(dcHalfPx + wallPx + 2) * 2}
            rx="1"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
          {/* O-rings in Forward Bulkhead */}
          <circle cx={chamberStartX - closureWidthPx * 0.35} cy={centerY - dcHalfPx} r={Math.max(1.5, Math.min(3.5, wallPx * 0.45))} fill="#f97316" />
          <circle cx={chamberStartX - closureWidthPx * 0.35} cy={centerY + dcHalfPx} r={Math.max(1.5, Math.min(3.5, wallPx * 0.45))} fill="#f97316" />

          {/* CONVERGENT-DIVERGENT NOZZLE */}
          <g>
            {/* Upper Nozzle Wall */}
            <polygon
              points={`
                ${nozzleX0},${centerY - dcHalfPx - wallPx}
                ${nozzleXThroat},${centerY - rThroatPx - nozzleWallPx}
                ${nozzleXExit},${centerY - rExitPx - nozzleWallPx * 0.7}
                ${nozzleXExit},${centerY - rExitPx}
                ${nozzleXThroat},${centerY - rThroatPx}
                ${nozzleX0},${centerY - dcHalfPx}
              `}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="0.9"
            />
            {/* Lower Nozzle Wall */}
            <polygon
              points={`
                ${nozzleX0},${centerY + dcHalfPx + wallPx}
                ${nozzleXThroat},${centerY + rThroatPx + nozzleWallPx}
                ${nozzleXExit},${centerY + rExitPx + nozzleWallPx * 0.7}
                ${nozzleXExit},${centerY + rExitPx}
                ${nozzleXThroat},${centerY + rThroatPx}
                ${nozzleX0},${centerY + dcHalfPx}
              `}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="0.9"
            />
            {/* Nozzle Interior Flow Passage */}
            <polygon
              points={`
                ${nozzleX0},${centerY - dcHalfPx}
                ${nozzleXThroat},${centerY - rThroatPx}
                ${nozzleXExit},${centerY - rExitPx}
                ${nozzleXExit},${centerY + rExitPx}
                ${nozzleXThroat},${centerY + rThroatPx}
                ${nozzleX0},${centerY + dcHalfPx}
              `}
              fill="#0b1120"
              fillOpacity="0.65"
            />
            {/* Throat Graphite Insert Highlight */}
            <rect
              x={nozzleXThroat - 3}
              y={centerY - rThroatPx - nozzleWallPx * 0.8}
              width="6"
              height={nozzleWallPx * 0.8}
              fill="#0f172a"
              stroke="#64748b"
              strokeWidth="0.6"
            />
            <rect
              x={nozzleXThroat - 3}
              y={centerY + rThroatPx}
              width="6"
              height={nozzleWallPx * 0.8}
              fill="#0f172a"
              stroke="#64748b"
              strokeWidth="0.6"
            />
            {/* Aft O-Ring */}
            <circle cx={nozzleX0 + 3} cy={centerY - dcHalfPx} r={Math.max(1.5, Math.min(3.5, wallPx * 0.45))} fill="#f97316" />
            <circle cx={nozzleX0 + 3} cy={centerY + dcHalfPx} r={Math.max(1.5, Math.min(3.5, wallPx * 0.45))} fill="#f97316" />
          </g>

          {/* CENTERLINE */}
          <line
            x1="12"
            y1={centerY}
            x2={drawWidth - 12}
            y2={centerY}
            stroke="#ef4444"
            strokeWidth="0.7"
            strokeDasharray="10 4 2 4"
            opacity="0.75"
          />

          {/* DIMENSION CALLOUTS */}
          {/* Chamber Length Lc */}
          <g>
            <line
              x1={chamberStartX}
              y1={centerY + dcHalfPx + wallPx + 4}
              x2={chamberStartX}
              y2={centerY + dcHalfPx + wallPx + 20}
              stroke="#64748b"
              strokeWidth="0.7"
              strokeDasharray="2 2"
            />
            <line
              x1={chamberStartX + chamberWidthPx}
              y1={centerY + dcHalfPx + wallPx + 4}
              x2={chamberStartX + chamberWidthPx}
              y2={centerY + dcHalfPx + wallPx + 20}
              stroke="#64748b"
              strokeWidth="0.7"
              strokeDasharray="2 2"
            />
            <line
              x1={chamberStartX + 2}
              y1={centerY + dcHalfPx + wallPx + 15}
              x2={chamberStartX + chamberWidthPx - 2}
              y2={centerY + dcHalfPx + wallPx + 15}
              stroke="#94a3b8"
              strokeWidth="1"
              markerStart="url(#dimArrow)"
              markerEnd="url(#dimArrow)"
            />
            <text
              x={chamberStartX + chamberWidthPx / 2}
              y={centerY + dcHalfPx + wallPx + 28}
              fontSize="10"
              fill="#cbd5e1"
              textAnchor="middle"
              fontWeight="bold"
              fontFamily="monospace"
            >
              Lc = {motor.Lc} mm • t = {struct.wallThicknessMm.toFixed(1)} mm
            </text>
          </g>

          {/* Outer & Inner Diameter Callout on Left */}
          <g>
            <line
              x1={chamberStartX - closureWidthPx - 14}
              y1={centerY - dcHalfPx - wallPx}
              x2={chamberStartX - closureWidthPx - 14}
              y2={centerY + dcHalfPx + wallPx}
              stroke="#94a3b8"
              strokeWidth="1"
              markerStart="url(#dimArrow)"
              markerEnd="url(#dimArrow)"
            />
            <text
              x={chamberStartX - closureWidthPx - 20}
              y={centerY - 4}
              fontSize="9"
              fill="#93c5fd"
              textAnchor="end"
              fontWeight="bold"
              fontFamily="monospace"
            >
              Øext {struct.outerDiameterMm.toFixed(1)}
            </text>
            <text
              x={chamberStartX - closureWidthPx - 20}
              y={centerY + 8}
              fontSize="8.5"
              fill="#94a3b8"
              textAnchor="end"
              fontFamily="monospace"
            >
              Dc {motor.Dc.toFixed(1)}
            </text>
          </g>

          {/* Nozzle Throat & Exit Callout on Right */}
          <g>
            <text
              x={nozzleXExit + 8}
              y={centerY - 4}
              fontSize="8.5"
              fill="#94a3b8"
              textAnchor="start"
              fontFamily="monospace"
            >
              Dt {nozzle?.Dt0 ?? '-'} mm
            </text>
            <text
              x={nozzleXExit + 8}
              y={centerY + 8}
              fontSize="8.5"
              fill="#94a3b8"
              textAnchor="start"
              fontFamily="monospace"
            >
              De {nozzle?.Ds ?? '-'} mm
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
