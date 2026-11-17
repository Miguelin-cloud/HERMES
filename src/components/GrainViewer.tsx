import React from 'react';
import { SimulationResults, getPropellantVisualProfile } from '../lib/types';
import {
  contoursToSvgPath,
  getGrainModule,
  isComplexGrain,
} from '../lib/grains';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Layers } from 'lucide-react';

export function GrainViewer({ results, timeIndex, t }: { results: SimulationResults, timeIndex: number, t?: any }) {
  if (!results || !results.grains || !results.t || results.t.length === 0) return null;

  const profile = getPropellantVisualProfile(results.propellantType);
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
                     let startX = 20;
                     for (let j = 0; j < i; j++) {
                       startX += results.grains[j].L0 * results.grains[j].N * (360 / (results.grains.reduce((acc, curr) => acc + curr.L0 * curr.N, 0)));
                     }
                     const totalL = results.grains.reduce((acc, curr) => acc + curr.L0 * curr.N, 0);
                     const scaleX = 360 / Math.max(1, totalL);
                     const maxScaleD = Math.max(...results.grains.map(gx => gx.D0));
                     const scaleY = 60 / maxScaleD;
                     
                     const burnbackTable = results.grains_burnback?.[i];
                     const isComplexExhausted = isComplexGrain(g.shape) && burnbackTable ? x >= burnbackTable.xMaxMm : false;
                     const currentL = isComplexExhausted ? 0 : Math.max(0, g.L0 - g.ei * x * 2);
                     const currentDOuter = isComplexExhausted ? 0 : Math.max(0, g.D0 - g.osi * x * 2);
                     
                     let coreTop = 42.5;
                     let coreHeight = 0;
                     
                     if (g.shape === 1) { // Tubular
                       const currentDInner = Math.min(currentDOuter, g.d0 + g.ci * x * 2);
                       coreTop = 42.5 - (currentDInner/2) * scaleY;
                       coreHeight = currentDInner * scaleY;
                     } else if (isComplexGrain(g.shape) && !isComplexExhausted) { // Geometría compleja (Estrella, etc.)
                       const currentDInner = Math.min(currentDOuter, g.d0mayor + g.ci * x * 2);
                       coreTop = 42.5 - (currentDInner/2) * scaleY;
                       coreHeight = currentDInner * scaleY;
                     }

                     return (
                       <g key={`long-${i}`}>
                         {Array.from({length: g.N}).map((_, j) => {
                           const segmentX = startX + j * g.L0 * scaleX + (g.ei * x * scaleX);
                           const segmentW = Math.max(0, currentL * scaleX);
                           const gTop = 42.5 - (currentDOuter/2) * scaleY;
                           const gHeight = Math.max(0, currentDOuter * scaleY);
                           
                           return (
                             <g key={`seg-${j}`}>
                               {segmentW > 0 && gHeight > 0 && (
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill={grainFill} stroke="#475569" strokeWidth="0.5" rx="1" />
                               )}
                               {g.shape !== 3 && segmentW > 0 && coreHeight > 0 && (
                                 <rect x={segmentX} y={coreTop} width={segmentW} height={coreHeight} fill="#0f172a" rx="0.5" />
                               )}
                             </g>
                           )
                         })}
                       </g>
                     )
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
                const currentL = Math.max(0, g.L0 - g.ei * x * 2);
                
                let pathStr = "";
                let corePathStr = "";
                let vectorPathStr = "";
                const rEnvPx = Math.max(0, (g.D0 / 2 - g.osi * x)) * scale;

                if (isComplexGrain(g.shape)) {
                  if (currentL > 0) {
                    const loops = getGrainModule(g.shape).getCrossSectionContoursMm?.(
                      g,
                      x,
                      results.grains_burnback?.[i]
                    );
                    if (loops && loops.length > 0) {
                      vectorPathStr = contoursToSvgPath(loops, drawSize / 2, drawSize / 2, scale);
                    }
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

                const shapeLabel = g.shape === 1 ? 'Tubular' : g.shape === 2 ? 'Estrella' : 'Macizo';

                return (
                  <div key={g.id || i} className="flex flex-col items-center p-2.5 border border-border rounded-lg bg-card shadow-sm text-card-foreground">
                    <div className="flex items-center justify-between w-full mb-1.5 px-1 font-mono text-[10px]">
                      <span className="font-bold text-foreground uppercase">{t?.grains || 'Grano'} {i+1}</span>
                      <span className="text-muted-foreground text-[9px] font-semibold">({shapeLabel})</span>
                    </div>
                    <svg width={drawSize} height={drawSize} viewBox={`0 0 ${drawSize} ${drawSize}`} className="bg-muted/30 rounded border border-border">
                      <line x1={drawSize/2} y1="0" x2={drawSize/2} y2={drawSize} stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                      <line x1="0" y1={drawSize/2} x2={drawSize} y2={drawSize/2} stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                      
                      {isComplexGrain(g.shape) ? (
                        <>
                          {rEnvPx > 0 && (
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

