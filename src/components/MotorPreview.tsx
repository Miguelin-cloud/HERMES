import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export function MotorPreview({ motor, grains }: { motor: any, grains: any[] }) {
  const drawWidth = 400;
  const drawHeight = 160;
  
  const totalLength = motor.Lc;
  const scale = (drawWidth - 60) / Math.max(totalLength, 10);
  const center_y = drawHeight / 2;

  let totalGrainLength = 0;
  let hasDiameterError = false;

  grains.forEach(g => {
    totalGrainLength += (g.L0 * g.N);
    if (g.D0 > motor.Dc) {
      hasDiameterError = true;
    }
  });

  const hasLengthError = totalGrainLength > motor.Lc;
  const hasError = hasLengthError || hasDiameterError;

  const casingThickness = 4 * scale;
  const nozzleLength = 40 * scale; // Assuming a visual proportional length for the diverging section

  return (
    <>
      {hasError && (
          <div className="absolute top-1 right-2 text-[8px] font-medium text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200 flex items-center gap-1 z-20">
            <AlertCircle size={10} /> <span>Design Violations</span>
          </div>
      )}
      <div className={`w-full h-full min-h-[120px] overflow-hidden rounded-sm flex items-center justify-center p-2 ${hasError ? 'bg-red-50' : 'bg-transparent'}`}>
        <svg width="100%" height="100%" viewBox={`0 0 ${drawWidth} ${drawHeight + 50}`} preserveAspectRatio="xMidYMid meet" className="max-h-[140px] max-w-[95%]">
            {/* GRAINS */}
            {grains.map((g, index) => {
              let startX = 20;
              for (let i = 0; i < index; i++) {
                startX += grains[i].L0 * grains[i].N * scale;
              }
              const gWidth = g.L0 * g.N * scale;
              const gTop = center_y - (g.D0 / 2) * scale;
              const gHeight = g.D0 * scale;

              let coreTop = center_y;
              let coreHeight = 0;
              if (g.shape === 1) {
                coreTop = center_y - (g.d0 / 2) * scale;
                coreHeight = g.d0 * scale;
              } else if (g.shape === 2) {
                coreTop = center_y - (g.d0mayor / 2) * scale;
                coreHeight = g.d0mayor * scale;
              }

              let fillColor = "#cbd5e1";
              if (g.propellantType === 4 || g.propellantType === 5) fillColor = "#fca5a5";
              else if (g.propellantType === 6 || g.propellantType === 7) fillColor = "#94a3b8";

              return (
                <g key={g.id}>
                  {/* Outer Grain Surface */}
                  <rect 
                    x={startX} 
                    y={gTop} 
                    width={gWidth} 
                    height={gHeight} 
                    fill={fillColor} 
                    stroke="#1e293b" 
                    strokeWidth="1" 
                    opacity={g.D0 > motor.Dc ? 0.4 : 1}
                  />

                  {/* Hollow Core */}
                  {g.shape !== 3 && (
                    <rect 
                      x={startX} 
                      y={coreTop} 
                      width={gWidth} 
                      height={coreHeight} 
                      fill="#ffffff" 
                      stroke="#64748b"
                      strokeWidth="0.5"
                      strokeDasharray="2 1"
                    />
                  )}

                  {/* Draw Segment Lines */}
                  {Array.from({length: g.N + 1}).map((_, j) => (
                    <line 
                      key={j} 
                      x1={startX + j * g.L0 * scale} 
                      y1={gTop} 
                      x2={startX + j * g.L0 * scale} 
                      y2={gTop + gHeight} 
                      stroke="#0f172a" 
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Labels: Positioned in the middle of each grain section */}
                  {gWidth > 15 && (
                    <text 
                      x={startX + gWidth/2} 
                      y={center_y} 
                      fontSize="9" 
                      fill="#1e293b" 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      fontWeight="black"
                    >
                      {index + 1}
                    </text>
                  )}
                </g>
              );
            })}

            {/* CASING */}
            <rect 
              x="20" 
              y={center_y - motor.Dc/2*scale} 
              width={motor.Lc*scale} 
              height={motor.Dc*scale} 
              fill="none" 
              stroke="#0f172a" 
              strokeWidth="2"
            />
            
            {/* Front Closure */}
            <rect x="15" y={center_y - motor.Dc/2*scale} width="5" height={motor.Dc*scale} fill="#1e293b" />

            {/* Centerline */}
            <line x1="0" y1={center_y} x2={drawWidth} y2={center_y} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="8 4" />
            
            {/* Dimension Lines */}
            <g markerEnd="url(#arrow)" markerStart="url(#arrow)">
               <line x1="20" y1={center_y + motor.Dc/2*scale + 20} x2={20 + motor.Lc*scale} y2={center_y + motor.Dc/2*scale + 20} stroke="#475569" strokeWidth="1" />
            </g>
            <text x={20 + (motor.Lc*scale)/2} y={center_y + motor.Dc/2*scale + 35} fontSize="9" fill="#1e293b" textAnchor="middle" fontWeight="bold">Lc = {motor.Lc} mm</text>
            
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
              </marker>
            </defs>
        </svg>
        </div>
    </>
  );
}
