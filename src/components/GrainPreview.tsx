import React from 'react';

export function GrainPreview({ 
  grain, 
  disableLabel, 
  mode = 'both', 
  t 
}: { 
  grain: any, 
  disableLabel?: boolean, 
  mode?: 'both' | 'transversal' | 'longitudinal',
  t?: any 
}) {
  const drawSize = 120;
  const maxD = grain.D0 || 100;
  const scale = maxD > 0 ? (drawSize - 10) / maxD : 1; 
  
  let pathStr = "";
  let corePathStr = "";

  if (grain.shape === 1) {
    const r_out = Math.max(0, (grain.D0 / 2)) * scale;
    const r_in = (grain.d0 / 2) * scale;
    if (r_out > r_in) {
      pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
      if (r_in > 0) {
        corePathStr = `M ${drawSize/2+r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2-r_in} ${drawSize/2} A ${r_in} ${r_in} 0 1 1 ${drawSize/2+r_in} ${drawSize/2}`;
      }
    }
  } else if (grain.shape === 3) {
    const r_out = Math.max(0, (grain.D0 / 2)) * scale;
    if (r_out > 0) {
       pathStr = `M ${drawSize/2+r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2-r_out} ${drawSize/2} A ${r_out} ${r_out} 0 1 0 ${drawSize/2+r_out} ${drawSize/2}`;
    }
  } else if (grain.shape === 2) {
    const r_out = Math.max(0, (grain.D0 / 2)) * scale;
    const base_tip = grain.d0 / 2;
    const base_valley = grain.d0mayor / 2;
    
    const pts = [];
    const Np = grain.Np || 5;
    for (let k = 0; k < Np * 2; k++) {
      const angle = (Math.PI * 2 * k) / (Np * 2);
      const isTip = k % 2 === 0;
      const current_r = Math.min(grain.D0/2, (isTip ? base_tip : base_valley));
      
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

  const transversal = (
    <div className="flex flex-col items-center justify-center relative w-full h-full">
      {!disableLabel && (
        <span className="absolute top-1 left-2 text-[8px] font-bold text-slate-400 uppercase bg-white/50 px-1 rounded z-10 transition-colors">
          {t?.cross_section || "Cross-Section"}
        </span>
      )}
      <svg width="100%" height="100%" viewBox={`0 0 ${drawSize} ${drawSize}`} className="bg-neutral-50/50" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <line x1={drawSize/2} y1="0" x2={drawSize/2} y2={drawSize} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.5" />
        <line x1="0" y1={drawSize/2} x2={drawSize} y2={drawSize/2} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.5" />
        
        {pathStr && (
          <path 
            d={pathStr} 
            fill="#64748b" 
            fillRule="evenodd" 
            stroke={grain.osi === 1 ? "#ef4444" : "#d97706"} 
            strokeWidth={grain.osi === 1 ? "2" : "1.5"} 
          />
        )}
        
        {grain.shape === 2 && corePathStr && (
          <polygon 
            points={corePathStr.replace(/M |L |Z/g, "")} 
            fill="#ffffff" 
            stroke={grain.ci === 1 ? "#ef4444" : "#d97706"} 
            strokeWidth={grain.ci === 1 ? "2" : "1.5"} 
          />
        )}
        
        {grain.shape === 1 && corePathStr && (
          <path 
            d={corePathStr} 
            fill="#ffffff" 
            stroke={grain.ci === 1 ? "#ef4444" : "#d97706"} 
            strokeWidth={grain.ci === 1 ? "2" : "1.5"} 
          />
        )}
      </svg>
    </div>
  );

  const longitudinal = (
    <div className="flex flex-col items-center justify-center relative w-full h-full bg-white">
      {!disableLabel && (
        <span className="absolute top-1 left-2 text-[8px] font-bold text-slate-400 uppercase bg-white/50 px-1 rounded z-10 transition-colors">
          {t?.side_view || "Side View"}
        </span>
      )}
      <div className="w-full h-full flex items-center justify-center p-2">
        <svg width="100%" height="80" viewBox={`0 0 160 80`} preserveAspectRatio="xMidYMid meet">
            {(() => {
                const lTotal = grain.L0 * grain.N;
                const lScale = Math.min(1, 140 / Math.max(1, lTotal));
                const yCenter = 40;
                const scaledL = lTotal * lScale;
                const scaledD = grain.D0 * (40 / Math.max(1, grain.D0));
                const topY = yCenter - scaledD / 2;
                const innerY_half = ((grain.shape === 2 ? grain.d0mayor : grain.d0) / 2) * (scaledD / grain.D0);
                
                return (
                  <g>
                    {/* Horizontal center line */}
                    <line x1="0" y1={yCenter} x2="160" y2={yCenter} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="0.5" />
                    
                    <g transform={`translate(${(160 - scaledL) / 2}, 0)`}>
                      {/* Body and Outer boundary */}
                      <rect 
                        x={0} 
                        y={topY} 
                        width={scaledL} 
                        height={scaledD} 
                        fill="#64748b" 
                        rx="1" 
                        stroke="none" 
                      />
                      
                      {/* Top burn line */}
                      <line 
                        x1={0} y1={topY} x2={scaledL} y2={topY} 
                        stroke={grain.osi === 1 ? "#ef4444" : "#d97706"} 
                        strokeWidth={grain.osi === 1 ? "2" : "1"} 
                      />
                      {/* Bottom burn line */}
                      <line 
                        x1={0} y1={topY + scaledD} x2={scaledL} y2={topY + scaledD} 
                        stroke={grain.osi === 1 ? "#ef4444" : "#d97706"} 
                        strokeWidth={grain.osi === 1 ? "2" : "1"} 
                      />
                      
                      {/* Left and Right end faces */}
                      <line 
                        x1={0} y1={topY} x2={0} y2={topY + scaledD} 
                        stroke={grain.ei === 1 ? "#ef4444" : "#d97706"} 
                        strokeWidth={grain.ei === 1 ? "2" : "1"} 
                      />
                      <line 
                        x1={scaledL} y1={topY} x2={scaledL} y2={topY + scaledD} 
                        stroke={grain.ei === 1 ? "#ef4444" : "#d97706"} 
                        strokeWidth={grain.ei === 1 ? "2" : "1"} 
                      />

                      {/* Inner core if hollow */}
                      {grain.shape !== 3 && (
                        <g>
                          <rect 
                            x={0} 
                            y={yCenter - innerY_half} 
                            width={scaledL} 
                            height={innerY_half * 2} 
                            fill="#ffffff" 
                            stroke="none"
                          />
                          {/* Top core line */}
                          <line 
                            x1={0} y1={yCenter - innerY_half} x2={scaledL} y2={yCenter - innerY_half} 
                            stroke={grain.ci === 1 ? "#ef4444" : "#d97706"} 
                            strokeWidth={grain.ci === 1 ? "2" : "1"} 
                          />
                          {/* Bottom core line */}
                          <line 
                            x1={0} y1={yCenter + innerY_half} x2={scaledL} y2={yCenter + innerY_half} 
                            stroke={grain.ci === 1 ? "#ef4444" : "#d97706"} 
                            strokeWidth={grain.ci === 1 ? "2" : "1"} 
                          />
                        </g>
                      )}
                      
                      {/* Segment lines - strictly vertical interior lines */}
                      {grain.N > 1 && Array.from({length: grain.N - 1}).map((_, j) => (
                        <line 
                          key={j} 
                          x1={(j + 1) * grain.L0 * lScale} 
                          y1={topY} 
                          x2={(j + 1) * grain.L0 * lScale} 
                          y2={topY + scaledD} 
                          stroke="#334155" 
                          strokeWidth="0.5" 
                          strokeDasharray="2 2"
                        />
                      ))}
                    </g>
                  </g>
                );
            })()}
        </svg>
      </div>
    </div>
  );

  if (mode === 'transversal') return transversal;
  if (mode === 'longitudinal') return longitudinal;

  return (
    <div className="flex flex-col h-full w-full relative">
       <div className="flex-1 border-b border-slate-100">{transversal}</div>
       <div className="flex-1">{longitudinal}</div>
    </div>
  );
}
