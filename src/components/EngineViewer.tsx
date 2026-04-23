import React, { useState, useEffect, useRef } from 'react';
import { SimulationResults } from '../lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function EngineViewer({ results, timeIndex, t }: { results: SimulationResults, timeIndex: number, t?: any }) {
  if (!results || !results.t || results.t.length === 0) return null;

  const thrust = results.F_N[timeIndex] || 0;
  const maxThrust = results.summary.Fmax_N || 1;
  const normalizedThrust = Math.min(1, Math.max(0, thrust / maxThrust));
  
  const pressure = results.P0_gage[timeIndex] || 0;
  const maxPressure = results.summary.Pmax_MPa || 1;
  const normalizedPressure = Math.min(1, Math.max(0, pressure / maxPressure));

  // Visual characteristics based on propellant type
  let isSmoky = false;
  let smokeColor = "#e5e7eb"; // White smoke for candy
  let hasFlame = false;
  let hasDiamonds = false;
  let flameLengthMult = 1.0;

  switch (results.propellantType) {
    case 1: // KNDX
    case 2: // KNSO
    case 3: // KNSU
      isSmoky = true;
      hasFlame = true; // small flame
      smokeColor = "#e5e7eb";
      flameLengthMult = 0.5; // Short flame
      break;
    case 4: // RNX-71V
    case 5: // RNX-57
      isSmoky = true;
      smokeColor = "#1f2937"; // Black smoke
      hasFlame = false;
      break;
    case 6: // AP+HTPB
    case 7: // AP+HTPB
      isSmoky = true;
      smokeColor = "#9ca3af"; // Light grey smoke at edges
      hasFlame = true;
      hasDiamonds = true;
      flameLengthMult = 1.5; // Long flame
      break;
    default:
      hasFlame = true;
      hasDiamonds = true;
      break;
  }

  const flameLength = 220 * normalizedThrust * flameLengthMult;
  const flameWidth = 30 + 35 * normalizedThrust;
  
  // High-performance React SVGs for purely visual CFD look
  const meshLines = [];
  for(let i=0; i<60; i++) {
    meshLines.push(<line key={`v${i}`} x1={i*10} y1={0} x2={i*10} y2={300} stroke="#1e293b" strokeWidth="0.5" opacity="0.3" />);
  }
  for(let i=0; i<30; i++) {
    meshLines.push(<line key={`h${i}`} x1={0} y1={i*10} x2={600} y2={i*10} stroke="#1e293b" strokeWidth="0.5" opacity="0.3" />);
  }

  const diamonds = [];
  if (hasDiamonds && normalizedThrust > 0.1) {
    const numDiamonds = Math.floor(normalizedThrust * 6);
    for (let i = 0; i < numDiamonds; i++) {
      const dx = 380 + (i * 35) * (0.8 + normalizedThrust*0.2);
      const intensity = 1 - (i / numDiamonds);
      diamonds.push(
        <ellipse 
          key={i} 
          cx={dx} 
          cy="150" 
          rx={15 + 10 * normalizedThrust} 
          ry={flameWidth * 0.3 * intensity} 
          fill="url(#diamondGrad)" 
          opacity={intensity * 0.9} 
          style={{ mixBlendMode: 'screen' }}
        />
      );
    }
  }

  // Generate smoke particles if applicable
  const smokeParticles = [];
  if (isSmoky && normalizedThrust > 0.05) {
     for (let i=0; i<10; i++) {
        // pseudo random based on timeIndex and i
        const seed = (timeIndex * 13 + i * 17) % 100;
        const dx = 380 + (seed / 100) * 200 * normalizedThrust;
        const dyNoise = (Math.sin(timeIndex * 0.1 + i) * 30);
        const dy = 150 + dyNoise;
        const size = 15 + (seed / 100) * 40 * normalizedThrust;
        const opacity = (1 - (seed/100)) * 0.6 * normalizedThrust;
        
        smokeParticles.push(
          <circle 
            key={`smoke${i}`} 
            cx={dx} cy={dy} r={size} 
            fill={smokeColor} 
            opacity={opacity} 
            style={{ filter: 'blur(5px)' }} 
          />
        );
     }
  }

  return (
    <Card className="bg-white border-slate-200 text-slate-800 shadow-md h-full flex flex-col">
      <CardHeader className="border-b border-slate-100 pb-3 bg-slate-50/50 flex-none">
        <div className="flex justify-between items-center">
          <CardTitle className="text-slate-800 font-mono tracking-tight flex items-center gap-2 text-sm md:text-base">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
            {t?.exhaust_sim || 'CFD EXHAUST SIMULATION'}
          </CardTitle>
          <div className="text-xs font-mono text-slate-500 uppercase">{t?.cfd_solver_title || 'HERMES FLOW SOLVER v1.0'}</div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="w-full relative overflow-hidden bg-white h-full min-h-[200px] flex justify-center items-center">
            
            <svg width="100%" height="100%" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" className="max-h-full">
              <defs>
                <linearGradient id="casingTemp" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset={`${normalizedPressure * 100}%`} stopColor={normalizedPressure > 0.8 ? "#fecaca" : "#fef08a"} />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>

                <linearGradient id="metallic" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="20%" stopColor="#e2e8f0" />
                  <stop offset="50%" stopColor="#cbd5e1" />
                  <stop offset="80%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
               
                <linearGradient id="metallicDark" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="30%" stopColor="#94a3b8" />
                  <stop offset="70%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                <radialGradient id="plumeBase" cx="0%" cy="50%" r="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="10%" stopColor="#fef08a" stopOpacity="0.95" />
                  <stop offset="30%" stopColor="#f97316" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#dc2626" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="diamondGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#93c5fd" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="heatMap" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#1e1b4b" />
                  <stop offset="20%" stopColor="#4c1d95" />
                  <stop offset="40%" stopColor="#be123c" />
                  <stop offset="60%" stopColor="#ea580c" />
                  <stop offset="80%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>

              {/* Mesh Grid */}
              <g>{meshLines}</g>
              
              {/* Centerline */}
              <line x1="0" y1="150" x2="600" y2="150" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="6 3" opacity="0.6" />

              {/* ROCKET ENGINE BODY */}
              {/* Outer Casing */}
              <rect x="50" y="110" width="300" height="80" rx="3" fill="url(#metallic)" stroke="#475569" strokeWidth="1" />
              {/* Internal Chamber showing valid pressure uniform map */}
              <rect x="55" y="115" width="295" height="70" fill={normalizedPressure > 0.8 ? "#ef4444" : normalizedPressure > 0.4 ? "#f97316" : "#facc15"} opacity={0.1 + (normalizedPressure * 0.8)} />
              {/* Core void (simulate grains missing vs current) */}
              <rect x="55" y="130" width="295" height="40" fill="#ffffff" opacity="0.9" />

              {/* Nozzle Profile */}
              <path d="M 350 115 
                       C 360 115, 365 130, 368 130
                       L 368 170
                       C 365 170, 360 185, 350 185 Z" 
                    fill="url(#metallicDark)" stroke="#1e293b" strokeWidth="1" />
              <path d="M 368 130 
                       C 375 130, 385 100, 395 100
                       L 395 200
                       C 385 200, 375 170, 368 170 Z" 
                    fill="url(#metallicDark)" stroke="#1e293b" strokeWidth="1" />
              
              {/* EXHAUST PLUME */}
              {normalizedThrust > 0.01 && (
                <g style={{ transition: 'all 0.05s linear' }}>
                  {isSmoky && <g>{smokeParticles}</g>}
                  {/* Outer boundary layer (low density/temp) */}
                  {hasFlame && (
                     <path 
                       d={`M 390 100 Q ${390 + flameLength*0.6} ${150 - flameWidth*1.5} ${390 + flameLength*1.2} 150 Q ${390 + flameLength*0.6} ${150 + flameWidth*1.5} 390 200 Z`} 
                       fill="#fca5a5" 
                       opacity={0.6 * normalizedThrust}
                       style={{ filter: 'blur(6px)' }}
                     />
                  )}
                  {/* Mid shear layer */}
                  {hasFlame && (
                     <path 
                       d={`M 390 115 Q ${390 + flameLength*0.5} ${150 - flameWidth} ${390 + flameLength} 150 Q ${390 + flameLength*0.5} ${150 + flameWidth} 390 185 Z`} 
                       fill="url(#plumeBase)" 
                       opacity={0.85}
                       style={{ filter: 'blur(3px)' }}
                     />
                  )}
                  
                  {/* Core flow / Shock Diamonds */}
                  <g>{diamonds}</g>
                </g>
              )}

              {/* Legend overlay for CFD */}
              <g transform="translate(10, 10)">
                <rect width="120" height="110" fill="#ffffff" opacity="0.9" rx="4" stroke="#e2e8f0" />
                <rect x="10" y="10" width="10" height="90" fill="url(#heatMap)" />
                <text x="25" y="18" fill="#475569" fontSize="9" fontFamily="monospace">{t?.mach || 'Mach'} ~ 3.0</text>
                <text x="25" y="28" fill="#475569" fontSize="9" fontFamily="monospace">{t?.temp_label || 'T (Temp)'} ~ 2500 K</text>
                
                <text x="25" y="55" fill="#475569" fontSize="9" fontFamily="monospace">{t?.cfd || 'CFD Field'}</text>
                
                <text x="25" y="88" fill="#475569" fontSize="9" fontFamily="monospace">{t?.mach || 'Mach'} ~ 0.0</text>
                <text x="25" y="98" fill="#475569" fontSize="9" fontFamily="monospace">{t?.temp_label || 'T (Temp)'} ~ 300 K</text>
              </g>

            </svg>
            
            <div className="absolute top-4 right-4 text-right font-mono text-xs bg-white/80 p-2 rounded border border-slate-100 pb-1">
              <div className="text-slate-500 uppercase">{t?.local_thrust || 'LOCAL THRUST'}</div>
              <div className="text-red-500 text-lg font-bold">{thrust.toFixed(1)} N</div>
              <div className="text-slate-500 mt-1 uppercase">{t?.motor_chamber_p || 'CHAMBER PRES'}</div>
              <div className="text-blue-500 text-lg font-bold">{(pressure * 10).toFixed(2)} bar</div>
            </div>
            
            {/* Real-time simulation info overlay */}
            <div className="absolute bottom-4 right-4 text-right font-mono text-[10px] text-slate-500 bg-white/80 p-1.5 rounded">
               <div>ITER: {timeIndex}</div>
               <div>{t?.times || 'T'}: {Number(results.t[timeIndex]).toFixed(4)}s</div>
               <div>{t?.cells || 'CELLS'}: 1.2M</div>
               <div>{t?.model_label || 'MODEL'}: {t?.navier_stokes || 'NAVIER-STOKES'}</div>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  );
}
