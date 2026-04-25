import React, { useMemo } from 'react';
import { SimulationResults } from '../lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function EngineViewer({ results, timeIndex, t }: { results: SimulationResults, timeIndex: number, t?: any }) {
  if (!results || !results.t || results.t.length === 0) return null;

  const totalL = results.grains.reduce((acc, g) => acc + g.L0 * g.N, 0);
  const maxD = Math.max(...results.grains.map(g => g.D0));
  
  const thrust = results.F_N[timeIndex] || 0;
  const maxThrust = results.summary.Fmax_N || 1;
  const normalizedThrust = Math.min(1, Math.max(0, thrust / maxThrust));
  
  const pressure = results.P0_gage[timeIndex] || 0;
  const maxPressure = results.summary.Pmax_MPa || 1;
  const normalizedPressure = Math.min(1, Math.max(0, pressure / maxPressure));

  // Visual characteristics based on propellant type
  let isSmoky = false;
  let smokeColor = "#f8fafc"; // White smoke for candy
  let smokeOpacityBase = 0.8;
  let hasFlame = false;
  let hasDiamonds = false;
  let flameLengthMult = 1.0;

  switch (results.propellantType) {
    case 1: // KNDX
    case 2: // KNSO
    case 3: // KNSU
      isSmoky = true;
      hasFlame = true; // small flame at the nozzle
      smokeColor = "#f1f5f9"; // thick white/grey
      smokeOpacityBase = 0.9;
      flameLengthMult = 0.5; // Short flame hidden in smoke
      break;
    case 4: // RNX-71V
    case 5: // RNX-57
      isSmoky = true;
      smokeColor = "#000000"; // dense black smoke
      smokeOpacityBase = 0.95;
      hasFlame = false;
      break;
    case 6: // APCP
    case 7: // APCP
      isSmoky = true;
      smokeColor = "#cbd5e1"; // light grey smoke at start/end
      smokeOpacityBase = 0.3; // very little smoke
      hasFlame = true;
      hasDiamonds = true;
      flameLengthMult = 1.6; // Long bright flame
      break;
    default:
      hasFlame = true;
      hasDiamonds = true;
      break;
  }

  // Calculate dynamic flame properties
  const flameLength = 220 * normalizedThrust * flameLengthMult;
  const flameWidth = 25 + 30 * normalizedThrust;
  
  // Background grid
  const meshLines = useMemo(() => {
    const lines = [];
    for(let i=0; i<60; i++) {
      lines.push(<line key={`v${i}`} x1={i*10} y1={0} x2={i*10} y2={300} stroke="#cbd5e1" strokeWidth="0.5" opacity="0.3" />);
    }
    for(let i=0; i<30; i++) {
      lines.push(<line key={`h${i}`} x1={0} y1={i*10} x2={600} y2={i*10} stroke="#cbd5e1" strokeWidth="0.5" opacity="0.3" />);
    }
    return lines;
  }, []);

  const diamonds = useMemo(() => {
    const arr = [];
    if (hasDiamonds && normalizedThrust > 0.1) {
      const numDiamonds = Math.floor(normalizedThrust * 6);
      for (let i = 0; i < numDiamonds; i++) {
        const dx = 380 + (i * 35) * (0.8 + normalizedThrust*0.2);
        const intensity = 1 - (i / numDiamonds);
        arr.push(
          <ellipse 
            key={i} 
            cx={dx} 
            cy="150" 
            rx={10 + 8 * normalizedThrust} 
            ry={flameWidth * 0.25 * intensity} 
            fill="url(#diamondGrad)" 
            opacity={intensity * 0.9} 
            style={{ mixBlendMode: 'screen' }}
          />
        );
      }
    }
    return arr;
  }, [hasDiamonds, normalizedThrust, flameWidth]);

  // Generate smoke particles dynamically to simulate movement
  const smokeParticles = useMemo(() => {
    const arr = [];
    if (isSmoky && normalizedThrust > 0.02) {
       for (let i=0; i<30; i++) {
          const seed = (timeIndex * 7 + i * 13) % 200;
          const dx = 380 + (seed / 200) * 300 * normalizedThrust;
          const dyNoise = (Math.sin(timeIndex * 0.1 + i) * 80) * (seed/200);
          const dy = 150 + dyNoise;
          const size = 20 + (seed / 200) * 60 * normalizedThrust;
          const opacity = (1 - (seed/200)) * smokeOpacityBase * normalizedPressure;
          
          arr.push(
            <circle 
              key={`smoke${i}`} 
              cx={dx} cy={dy} r={size} 
              fill={smokeColor} 
              opacity={opacity} 
              style={{ filter: 'blur(8px)', mixBlendMode: 'normal' }} 
            />
          );
       }
    }
    return arr;
  }, [isSmoky, normalizedThrust, timeIndex, smokeColor, smokeOpacityBase, normalizedPressure]);

  return (
    <Card className="bg-card border-border text-card-foreground shadow-sm h-full flex flex-col max-h-[500px]">
      <CardHeader className="border-b border-border pb-3 bg-muted/50 flex-none z-10 w-full">
        <div className="flex justify-between items-center">
            <span className="font-bold tracking-widest flex items-center gap-2 text-xs uppercase text-slate-300 font-sans">
               <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.6)]"></div>
               {t?.exhaust_sim || '2D CFD Engine Simulation'}
            </span>
            <div className="text-[10px] text-slate-400 font-mono">HERMES SOLVER</div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0 relative bg-card rounded-b-xl overflow-hidden w-full h-full">
         <div className="absolute top-4 left-4 z-10 font-mono text-[11px] text-slate-300 space-y-1 bg-card/80 p-2 rounded-md border border-border backdrop-blur-sm shadow-sm">
            <div>THRUST: <span className="text-orange-400 font-bold ml-1">{thrust.toFixed(1)} N</span></div>
            <div>PRESSURE: <span className="text-blue-400 font-bold ml-1">{(pressure * 10).toFixed(2)} bar</span></div>
         </div>

         <div className="absolute bottom-4 right-4 z-10 font-mono text-[11px] text-slate-400 space-y-1 bg-card/80 p-2 rounded-md border border-border backdrop-blur-sm shadow-sm text-right">
            <div>T+ {Number(results.t[timeIndex]).toFixed(3)}s</div>
            <div>CFD RENDER (Simplified)</div>
         </div>

         <div className="w-full h-full flex justify-center items-center overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" className="max-h-full" style={{ background: "#0a0f18" }}>
              <defs>
                <linearGradient id="metallic" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="20%" stopColor="#f1f5f9" />
                  <stop offset="50%" stopColor="#cbd5e1" />
                  <stop offset="80%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
               
                <linearGradient id="metallicDark" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="30%" stopColor="#94a3b8" />
                  <stop offset="70%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                <radialGradient id="plumeBase" cx="0%" cy="50%" r="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="20%" stopColor="#fef08a" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#f97316" stopOpacity="0.8" />
                  <stop offset="80%" stopColor="#dc2626" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="diamondGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="40%" stopColor="#60a5fa" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
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
              <line x1="20" y1="150" x2="580" y2="150" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="8 4" opacity="0.6" />

               {/* ROCKET ENGINE BODY */}
              {/* Outer Casing */}
              <rect x="50" y="110" width="300" height="80" rx="4" fill="url(#metallic)" stroke="#475569" strokeWidth="1.5" />
              
              {/* Heat Map Overlay inside chamber based on pressure */}
              <rect x="52" y="112" width="296" height="76" rx="3" fill="#ef4444" opacity={0.05 + (normalizedPressure * 0.3)} />
              
              {/* Dynamic Propellant Core (showing regression) */}
              {results.grains.map((g, i) => {
                 const x = results.grains_x && results.grains_x[i] ? results.grains_x[i][timeIndex] || 0 : 0;
                 let startX = 60;
                 for (let j = 0; j < i; j++) {
                    startX += (results.grains[j].L0 * (results.grains[j].N || 1)) / totalL * 280;
                 }
                 const w = (g.L0 * g.N / totalL) * 280;
                 // Simplification: just show a central hole getting bigger if tubular, 
                 // or outside getting smaller.
                 const isBurnedOut = g.L0 - g.ei * x * 2 <= 0 || g.D0 - g.osi * x * 2 <= 0;
                 if (isBurnedOut) return null;
                 
                 const holeRatio = g.shape === 1 ? Math.min(1, (g.d0 + g.ci * x * 2) / g.D0) : 1;
                 const holeHeight = 80 * holeRatio;
                 
                 return (
                   <g key={`grain-${i}`}>
                     {/* The solid grain */}
                     <rect x={startX} y={112} width={w} height={38 - holeHeight/2} fill="#cbd5e1" stroke="#94a3b8" />
                     <rect x={startX} y={150 + holeHeight/2} width={w} height={38 - holeHeight/2} fill="#cbd5e1" stroke="#94a3b8" />
                   </g>
                 )
              })}

              {/* Nozzle Profile */}
              <path d="M 350 110 
                       C 365 110, 368 135, 370 135
                       L 370 165
                       C 368 165, 365 190, 350 190 Z" 
                    fill="url(#metallicDark)" stroke="#1e293b" strokeWidth="1" />
              <path d="M 370 135 
                       C 375 135, 385 105, 395 105
                       L 395 195
                       C 385 195, 375 165, 370 165 Z" 
                    fill="url(#metallicDark)" stroke="#1e293b" strokeWidth="1" />
              
              {/* EXHAUST PLUME */}
              {normalizedThrust > 0.01 && (
                <g style={{ transition: 'all 0.05s linear' }}>
                  {isSmoky && <g>{smokeParticles}</g>}
                  
                  {/* Outer boundary layer (low density/temp) */}
                  {hasFlame && (
                     <path 
                       d={`M 390 105 Q ${390 + flameLength*0.6} ${150 - flameWidth*1.5} ${390 + flameLength*1.2} 150 Q ${390 + flameLength*0.6} ${150 + flameWidth*1.5} 390 195 Z`} 
                       fill="#fca5a5" 
                       opacity={0.6 * normalizedThrust}
                       style={{ filter: 'blur(8px)', mixBlendMode: 'screen' }}
                     />
                  )}
                  {/* Mid shear layer */}
                  {hasFlame && (
                     <path 
                       d={`M 390 115 Q ${390 + flameLength*0.5} ${150 - flameWidth} ${390 + flameLength} 150 Q ${390 + flameLength*0.5} ${150 + flameWidth} 390 185 Z`} 
                       fill="url(#plumeBase)" 
                       opacity={0.9}
                       style={{ filter: 'blur(4px)', mixBlendMode: 'screen' }}
                     />
                  )}
                  
                  {/* Core flow / Shock Diamonds */}
                  <g>{diamonds}</g>
                </g>
              )}
            </svg>
         </div>
      </CardContent>
    </Card>
  );
}

