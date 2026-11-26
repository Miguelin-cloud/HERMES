import React from 'react';
import { SimulationResults, getPropellantVisualProfile } from '../lib/types';
import { Language } from '../lib/i18n';
import {
  computeMeridianLongitudinalCut,
  contoursToSvgPath,
  getGrainModule,
  getGrainShapeLabel,
  hasCrossSectionContours,
} from '../lib/grains';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Layers } from 'lucide-react';

export function GrainViewer({ results, timeIndex, t, lang }: { results: SimulationResults, timeIndex: number, t?: any, lang?: Language }) {
  if (!results || !results.grains || !results.t || results.t.length === 0) return null;

  const profile = getPropellantVisualProfile(results.propellantType, lang || 'en', results.customPropellants);
  const grainFill = profile.grainColor2D || '#94a3b8';

  return (
    <Card className="h-full flex flex-col bg-card border-border shadow-sm text-card-foreground">
      <CardHeader className="border-b border-border py-2.5 px-4 bg-muted/60 flex-none text-foreground font-mono tracking-tight text-[11px] uppercase">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-cyan-500" />
              <span className="font-bold tracking-wider text-xs uppercase text-foreground">
                {t?.geometric_analysis || 'Geometric Regression Analysis'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold">
              {profile.displayName}
            </span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-5">
          {/* Longitudinal View */}
          <div>
             <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
               {t?.side_profile || 'Longitudinal View'}
             </h3>
             <div className="w-full flex justify-center bg-muted/40 rounded-xl p-3.5 overflow-hidden border border-border shadow-inner">
                <svg width="100%" height="85" viewBox="0 0 400 85" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '420px' }}>
                  <line x1="0" y1="42.5" x2="400" y2="42.5" stroke="#64748b" strokeDasharray="4 4" strokeWidth="1" />
                  {results.grains.map((g, i) => {
                     const xInfo = results.grains_x && results.grains_x[i] ? results.grains_x[i][timeIndex] : 0;
                     const x = xInfo || 0;
                     const totalL = results.grains.reduce((acc, curr) => acc + curr.L0 * curr.N, 0);
                     const scaleX = 360 / Math.max(1, totalL);
                     let startX = 20;
                     for (let j = 0; j < i; j++) {
                       startX += results.grains[j].L0 * results.grains[j].N * scaleX;
                     }
                     const maxScaleD = Math.max(1, ...results.grains.map(gx => gx.D0));
                     const scaleY = 60 / maxScaleD;
                     const yCenter = 42.5;

                     const burnbackTable = results.grains_burnback?.[i];
                     const usesContours = hasCrossSectionContours(g.shape);
                     const mod = getGrainModule(g.shape);
                     const contourLoops =
                       usesContours && (burnbackTable == null || g.shape === 10)
                         ? mod.getCrossSectionContoursMm?.(g, x, burnbackTable)
                         : null;
                     const isComplexExhausted = usesContours
                       ? burnbackTable
                         ? x >= burnbackTable.xMaxMm
                         : !contourLoops || contourLoops.length === 0
                       : false;
                     const currentL = isComplexExhausted ? 0 : Math.max(0, g.L0 - g.ei * x * 2);
                     const rOut = isComplexExhausted ? 0 : Math.max(0, g.D0 / 2 - g.osi * x);
                     const currentDOuter = rOut * 2;
                     const isAnalyticalExhausted =
                       !usesContours &&
                       (currentL <= 0 || rOut <= 0 || (g.shape === 1 && (g.d0 || 0) / 2 + g.ci * x >= rOut));

                     const gTop = yCenter - rOut * scaleY;
                     const gBot = yCenter + rOut * scaleY;
                     const gHeight = Math.max(0, currentDOuter * scaleY);

                     return (
                       <g key={`long-${i}`}>
                         {Array.from({ length: g.N }).map((_, j) => {
                           const segmentX = startX + j * g.L0 * scaleX + g.ei * x * scaleX;
                           const segmentW = Math.max(0, currentL * scaleX);
                           if (segmentW <= 0 || gHeight <= 0 || isComplexExhausted || isAnalyticalExhausted) {
                             return null;
                           }

                           // 3: Solid
                           if (g.shape === 3) {
                             return (
                               <g key={`seg-${j}`}>
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                               </g>
                             );
                           }

                           // 5: Moonburner (asymmetric offset bore)
                           if (g.shape === 5) {
                             const offMm = Math.max(0, Number(g.coreOffset) || 0);
                             const rBore = Math.max(0, (g.d0 || 0) / 2 + g.ci * x);
                             const boreCy = yCenter - offMm * scaleY;
                             const boreTop = Math.max(gTop, boreCy - rBore * scaleY);
                             const boreBot = Math.min(gBot, boreCy + rBore * scaleY);
                             const boreH = Math.max(0, boreBot - boreTop);
                             return (
                               <g key={`seg-${j}`}>
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                                 {boreH > 0 && (
                                   <rect x={segmentX} y={boreTop} width={segmentW} height={boreH} fill="#0f172a" rx="0.5" />
                                 )}
                               </g>
                             );
                           }

                           // 6: C-Slot (open radial slot from top perimeter downward)
                           if (g.shape === 6) {
                             const cutFromCenterMm = (g.D0 / 2 - (Number(g.slotDepth) || g.D0 * 0.5)) - g.ci * x;
                             const cutBot = Math.min(gBot, Math.max(gTop, yCenter - cutFromCenterMm * scaleY));
                             const pocketH = Math.max(0, cutBot - gTop);
                             return (
                               <g key={`seg-${j}`}>
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                                 {pocketH > 0 && (
                                   <>
                                     <rect x={segmentX} y={gTop} width={segmentW} height={pocketH} fill="#0f172a" opacity={0.76} />
                                     <line x1={segmentX} y1={cutBot} x2={segmentX + segmentW} y2={cutBot} stroke="#ef4444" strokeWidth="0.6" opacity={0.85} />
                                   </>
                                 )}
                               </g>
                             );
                           }

                           // 7: D-Grain (flat chord cut removed from top)
                           if (g.shape === 7) {
                             const cutFromCenterMm = (g.D0 / 2 - (Number(g.slotDepth) || g.D0 * 0.45)) - g.ci * x;
                             const webTop = Math.min(gBot, Math.max(gTop, yCenter - cutFromCenterMm * scaleY));
                             const webH = Math.max(0, gBot - webTop);
                             return (
                               <g key={`seg-${j}`}>
                                 {webTop > gTop && (
                                   <rect x={segmentX} y={gTop} width={segmentW} height={webTop - gTop} fill="none" stroke="#475569" strokeDasharray="2 2" strokeWidth="0.45" opacity={0.65} />
                                 )}
                                 {webH > 0 && (
                                   <rect x={segmentX} y={webTop} width={segmentW} height={webH} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="0.8" />
                                 )}
                               </g>
                             );
                           }

                           // 8: Rod & Tube (concentric solid rod inside hollow outer tube)
                           if (g.shape === 8) {
                             const tubeInnerR = Math.min(rOut, Math.max(0, (g.d0 || 0) / 2 + g.ci * x));
                             const rodR = Math.max(0, Math.min(tubeInnerR, (Number(g.rodDiameter) || 0) / 2 - g.ci * x));
                             const boreTop = yCenter - tubeInnerR * scaleY;
                             const boreH = Math.max(0, tubeInnerR * 2 * scaleY);
                             const rodTop = yCenter - rodR * scaleY;
                             const rodH = Math.max(0, rodR * 2 * scaleY);
                             return (
                               <g key={`seg-${j}`}>
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                                 {boreH > 0 && (
                                   <rect x={segmentX} y={boreTop} width={segmentW} height={boreH} fill="#0f172a" rx="0.5" />
                                 )}
                                 {rodH > 0 && (
                                   <rect x={segmentX} y={rodTop} width={segmentW} height={rodH} fill={grainFill} stroke="#475569" strokeWidth="0.45" rx="0.5" />
                                 )}
                               </g>
                             );
                           }

                           // 10: Custom Drawn Cross-Section (live meridian slice along x=0)
                           if (g.shape === 10) {
                             const rOutSafe = Math.max(0.25, rOut);
                             const edgeTolMm = Math.max(0.05, rOutSafe * 0.025);
                             const meridian =
                               contourLoops && contourLoops.length > 0
                                 ? computeMeridianLongitudinalCut(contourLoops, rOutSafe)
                                 : null;
                             if (!meridian || meridian.solidIntervalsMm.length === 0) {
                               return (
                                 <g key={`seg-${j}`}>
                                   <rect
                                     x={segmentX}
                                     y={gTop}
                                     width={segmentW}
                                     height={gHeight}
                                     fill="#0f172a"
                                     opacity={0.45}
                                     stroke="#475569"
                                     strokeDasharray="2 2"
                                     strokeWidth="0.45"
                                   />
                                 </g>
                               );
                             }

                             const showProj =
                               meridian.voidIntervalsMm.length === 0 &&
                               meridian.projectedVoidRangeMm !== null;

                             return (
                               <g key={`seg-${j}`}>
                                 {(meridian.topEdgeExposed || meridian.bottomEdgeExposed) && (
                                   <rect
                                     x={segmentX}
                                     y={gTop}
                                     width={segmentW}
                                     height={gHeight}
                                     fill="none"
                                     stroke="#475569"
                                     strokeDasharray="2 2"
                                     strokeWidth="0.45"
                                     opacity={0.65}
                                   />
                                 )}
                                 {meridian.solidIntervalsMm.map((band, bi) => {
                                   const bTop = yCenter + band.yMin * scaleY;
                                   const bBot = yCenter + band.yMax * scaleY;
                                   const bH = Math.max(0, bBot - bTop);
                                   const topInternal = band.yMin > -rOutSafe + edgeTolMm;
                                   const botInternal = band.yMax < rOutSafe - edgeTolMm;
                                   return (
                                     <g key={bi}>
                                       <rect
                                         x={segmentX}
                                         y={bTop}
                                         width={segmentW}
                                         height={bH}
                                         fill={grainFill}
                                         stroke="#475569"
                                         strokeWidth="0.5"
                                         rx="0.6"
                                       />
                                       {topInternal && (
                                         <line
                                           x1={segmentX}
                                           y1={bTop}
                                           x2={segmentX + segmentW}
                                           y2={bTop}
                                           stroke={g.ci === 1 ? '#ef4444' : '#10b981'}
                                           strokeWidth="0.6"
                                           opacity={0.85}
                                         />
                                       )}
                                       {botInternal && (
                                         <line
                                           x1={segmentX}
                                           y1={bBot}
                                           x2={segmentX + segmentW}
                                           y2={bBot}
                                           stroke={g.ci === 1 ? '#ef4444' : '#10b981'}
                                           strokeWidth="0.6"
                                           opacity={0.85}
                                         />
                                       )}
                                     </g>
                                   );
                                 })}
                                 {showProj && meridian.projectedVoidRangeMm && (
                                   <rect
                                     x={segmentX}
                                     y={yCenter + meridian.projectedVoidRangeMm.yMin * scaleY}
                                     width={segmentW}
                                     height={Math.max(
                                       0,
                                       (meridian.projectedVoidRangeMm.yMax - meridian.projectedVoidRangeMm.yMin) *
                                         scaleY
                                     )}
                                     fill="#0f172a"
                                     opacity={0.42}
                                     rx="0.5"
                                   />
                                 )}
                               </g>
                             );
                           }

                           // 1 (BATES), 2 (Star), 4 (Finocyl), 9 (Wagon Wheel)
                           const rInner = Math.min(rOut, Math.max(0, (g.d0 || 0) / 2 + g.ci * x));
                           const coreTop = yCenter - rInner * scaleY;
                           const coreHeight = Math.max(0, rInner * 2 * scaleY);

                           const hasFeatureBand = g.shape === 2 || g.shape === 4 || g.shape === 9;
                           const rValley = hasFeatureBand
                             ? Math.min(rOut, Math.max(rInner, (g.d0mayor || g.d0 || 0) / 2 + g.ci * x))
                             : rInner;
                           const featTop = yCenter - rValley * scaleY;
                           const featHeight = Math.max(0, rValley * 2 * scaleY);

                           return (
                             <g key={`seg-${j}`}>
                               <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                               {hasFeatureBand && featHeight > coreHeight && (
                                 <rect x={segmentX} y={featTop} width={segmentW} height={featHeight} fill="#0f172a" opacity={0.45} rx="0.5" />
                               )}
                               {coreHeight > 0 && (
                                 <rect x={segmentX} y={coreTop} width={segmentW} height={coreHeight} fill="#0f172a" rx="0.5" />
                               )}
                             </g>
                           );
                         })}
                       </g>
                     );
                  })}
                </svg>
             </div>
          </div>

          {/* Cross Section View */}
          <div>
            <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
              {t?.cross_section || 'Cross-Sectional View'}
            </h3>
            <div className="flex justify-center gap-3.5 flex-wrap overflow-y-auto no-scrollbar pb-3 min-h-0">
              {results.grains.map((g, i) => {
                const xInfo = results.grains_x && results.grains_x[i] ? results.grains_x[i][timeIndex] : 0;
                const x = xInfo || 0;
                const drawSize = 130; 
                const maxD = g.D0 || 100;
                const scale = (drawSize - 20) / maxD;
                const burnbackTable = results.grains_burnback?.[i];
                const usesContours = hasCrossSectionContours(g.shape);
                const mod = getGrainModule(g.shape);
                const previewLoops = usesContours
                  ? mod.getCrossSectionContoursMm?.(g, x, burnbackTable)
                  : null;
                const isComplexExhausted = usesContours
                  ? (burnbackTable ? x >= burnbackTable.xMaxMm : !previewLoops || previewLoops.length === 0)
                  : false;
                const currentL = isComplexExhausted ? 0 : Math.max(0, g.L0 - g.ei * x * 2);
                
                let pathStr = "";
                let corePathStr = "";
                let vectorPathStr = "";
                const rEnvPx = isComplexExhausted ? 0 : Math.max(0, (g.D0 / 2 - g.osi * x)) * scale;
                const rInitEnvPx = Math.max(0, (g.D0 / 2) * scale);

                if (usesContours) {
                  if (currentL > 0 && !isComplexExhausted && previewLoops && previewLoops.length > 0) {
                    vectorPathStr = contoursToSvgPath(previewLoops, drawSize / 2, drawSize / 2, scale);
                  }
                } else {
                  const primitives = getGrainModule(g.shape).getCrossSectionPrimitives(g, x);
                  const r_out = Math.max(0, primitives.outerRadiusMm) * scale;
                  if (primitives.innerCircleRadiusMm !== null) {
                    const r_in = Math.max(0, primitives.innerCircleRadiusMm) * scale;
                    if (currentL > 0 && r_out > r_in) {
                      pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
                      if (r_in > 0) {
                        corePathStr = `M ${drawSize/2+r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2-r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2+r_in} ${drawSize/2}`;
                      }
                    }
                  } else if (currentL > 0 && r_out > 0) {
                    pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
                  }
                }

                const shapeLabel = getGrainShapeLabel(g.shape, t);

                return (
                  <div key={g.id || i} className="flex flex-col items-center p-2.5 border border-border rounded-lg bg-card shadow-sm text-card-foreground">
                    <div className="flex items-center justify-between w-full mb-1.5 px-1 font-mono text-[10px] gap-2">
                      <span className="font-bold text-foreground uppercase">{t?.grains || 'Grano'} {i+1}</span>
                      <span className="text-muted-foreground text-[9px] font-semibold">({shapeLabel})</span>
                    </div>
                    <svg width={drawSize} height={drawSize} viewBox={`0 0 ${drawSize} ${drawSize}`} className="bg-muted/30 rounded border border-border">
                      <line x1={drawSize/2} y1="0" x2={drawSize/2} y2={drawSize} stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                      <line x1="0" y1={drawSize/2} x2={drawSize} y2={drawSize/2} stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                      {rInitEnvPx > 0 && (
                        <circle
                          cx={drawSize / 2}
                          cy={drawSize / 2}
                          r={rInitEnvPx}
                          fill="none"
                          stroke="#475569"
                          strokeDasharray="2 2"
                          strokeWidth="0.5"
                          opacity={0.45}
                        />
                      )}
                      
                      {usesContours ? (
                        <>
                          {vectorPathStr && rEnvPx > 0 && (
                            <circle
                              cx={drawSize / 2}
                              cy={drawSize / 2}
                              r={rEnvPx}
                              fill="#0f172a"
                              opacity={0.9}
                            />
                          )}
                          {vectorPathStr && (
                            <path
                              d={vectorPathStr}
                              fill={grainFill}
                              fillRule="evenodd"
                              stroke="#475569"
                              strokeWidth="0.6"
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {pathStr && (
                            <path d={pathStr} fill={grainFill} stroke="#475569" strokeWidth="0.5" fillRule="evenodd" />
                          )}
                          {g.shape === 1 && corePathStr && (
                            <path d={corePathStr} fill="#0f172a" />
                          )}
                        </>
                      )}
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

