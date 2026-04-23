import React from 'react';
import { SimulationResults } from '../lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function GrainViewer({ results, timeIndex, t }: { results: SimulationResults, timeIndex: number, t?: any }) {
  if (!results || !results.grains || !results.t || results.t.length === 0) return null;

  return (
    <Card className="h-full flex flex-col bg-white border border-slate-200 text-slate-800 shadow-md">
      <CardHeader className="border-b border-slate-100 pb-3 bg-slate-50/50 flex-none text-slate-800 font-mono tracking-tight text-sm">
        <div className="flex justify-between items-center">
            {t?.geometric_analysis || 'Geometric Regression Analysis'}
            <div className="text-xs font-mono text-slate-500 uppercase">{t?.propellant_geometry || 'PROPELLANT GEOMETRY'}</div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-6">
          {/* Longitudinal View */}
          <div>
             <h3 className="text-sm font-semibold text-neutral-500 mb-2 uppercase tracking-wider">{t?.side_profile || 'Longitudinal View'}</h3>
             <div className="w-full flex justify-center bg-neutral-100 rounded-xl p-4 overflow-hidden border border-neutral-200">
                <svg width="100%" height="80" viewBox="0 0 400 80" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '400px' }}>
                  <line x1="0" y1="40" x2="400" y2="40" stroke="#cbd5e1" strokeDasharray="4 4" />
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
                     
                     const currentL = Math.max(0, g.L0 - g.ei * x * 2);
                     const currentDOuter = Math.max(0, g.D0 - g.osi * x * 2);
                     
                     let coreTop = 40;
                     let coreHeight = 0;
                     
                     if (g.shape === 1) { // Tubular
                       const currentDInner = g.d0 + g.ci * x * 2;
                       coreTop = 40 - (currentDInner/2) * scaleY;
                       coreHeight = currentDInner * scaleY;
                     } else if (g.shape === 2) { // Star
                       const currentDInner = g.d0mayor + g.ci * x * 2;
                       coreTop = 40 - (currentDInner/2) * scaleY;
                       coreHeight = currentDInner * scaleY;
                     } // shape 3 solid has zero core

                     return (
                       <g key={`long-${i}`}>
                         {Array.from({length: g.N}).map((_, j) => {
                           const segmentX = startX + j * g.L0 * scaleX + (g.ei * x * scaleX);
                           const segmentW = Math.max(0, currentL * scaleX);
                           const gTop = 40 - (currentDOuter/2) * scaleY;
                           const gHeight = Math.max(0, currentDOuter * scaleY);
                           
                           return (
                             <g key={`seg-${j}`}>
                               {segmentW > 0 && gHeight > 0 && (
                                 <rect x={segmentX} y={gTop} width={segmentW} height={gHeight} fill="#64748b" />
                               )}
                               {g.shape !== 3 && segmentW > 0 && coreHeight > 0 && (
                                 <rect x={segmentX} y={coreTop} width={segmentW} height={coreHeight} fill="#f5f5f5" />
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
            <h3 className="text-sm font-semibold text-neutral-500 mb-2 uppercase tracking-wider">{t?.cross_section || 'Cross-Sectional View'}</h3>
            <div className="flex justify-center gap-4 flex-wrap overflow-y-auto no-scrollbar pb-6 min-h-0">
              {results.grains.map((g, i) => {
                const xInfo = results.grains_x && results.grains_x[i] ? results.grains_x[i][timeIndex] : 0;
                const x = xInfo || 0;
                const drawSize = 140; 
                const maxD = g.D0 || 100;
                const scale = (drawSize - 20) / maxD;
                
                let pathStr = "";
                let corePathStr = "";

                if (g.shape === 1) {
                  const r_out = Math.max(0, (g.D0 / 2 - g.osi * x)) * scale;
                  const r_in = (g.d0 / 2 + g.ci * x) * scale;
                  if (r_out > r_in) {
                    pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
                    if (r_in > 0) {
                      corePathStr = `M ${drawSize/2+r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2-r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2+r_in} ${drawSize/2}`;
                    }
                  }
                } else if (g.shape === 3) {
                  const r_out = Math.max(0, (g.D0 / 2 - g.osi * x)) * scale;
                  if (r_out > 0) {
                     pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
                  }
                } else if (g.shape === 2) {
                  const r_out = Math.max(0, (g.D0 / 2 - g.osi * x)) * scale;
                  const base_tip = g.d0 / 2;
                  const base_valley = g.d0mayor / 2;
                  
                  const pts = [];
                  for (let k = 0; k < g.Np * 2; k++) {
                    const angle = (Math.PI * 2 * k) / (g.Np * 2);
                    const isTip = k % 2 === 0;
                    const current_r = Math.min(g.D0/2, (isTip ? base_tip : base_valley) + g.ci * x);
                    
                    const px = drawSize/2 + current_r * scale * Math.cos(angle);
                    const py = drawSize/2 + current_r * scale * Math.sin(angle);
                    pts.push(`${px},${py}`);
                  }
                  
                  if (r_out > 0) {
                    pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
                  }
                  if (pts.length > 0) {
                      corePathStr = `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
                  }
                }

                return (
                  <div key={g.id} className="flex flex-col items-center p-2 border border-slate-100 rounded-lg bg-white shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tighter">{t?.grains || 'Grain'} {i+1}</span>
                    <svg width={drawSize} height={drawSize} viewBox={`0 0 ${drawSize} ${drawSize}`} className="bg-neutral-50 rounded border border-neutral-100">
                      <line x1={drawSize/2} y1="0" x2={drawSize/2} y2={drawSize} stroke="#e5e5e5" strokeDasharray="2 2" />
                      <line x1="0" y1={drawSize/2} x2={drawSize} y2={drawSize/2} stroke="#e5e5e5" strokeDasharray="2 2" />
                      
                      {pathStr && (
                        <path d={pathStr} fill="#64748b" fillRule="evenodd" />
                      )}
                      
                      {g.shape === 2 && corePathStr && (
                        <polygon points={corePathStr.replace(/M |L |Z/g, "")} fill="#fafafa" />
                      )}
                      
                      {g.shape === 1 && corePathStr && (
                        <path d={corePathStr} fill="#fafafa" />
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
