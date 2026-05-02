import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ApogeeResult } from '../lib/apogee';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function FlightViewer({ 
    simApogee, 
    expApogee, 
    t,
    propellantType = 1
}: { 
    simApogee: ApogeeResult | null, 
    expApogee: ApogeeResult | null, 
    t: any,
    propellantType?: number
}) {
    const [activeMode, setActiveMode] = useState<'sim' | 'exp'>('sim');
    const [isPlaying, setIsPlaying] = useState(false);
    const [timeIndex, setTimeIndex] = useState(0);
    const [speed, setSpeed] = useState(1);
    
    // Automatically switch to sim if exp disappears and vice versa
    useEffect(() => {
        if (activeMode === 'sim' && !simApogee && expApogee) setActiveMode('exp');
        if (activeMode === 'exp' && !expApogee && simApogee) setActiveMode('sim');
    }, [simApogee, expApogee, activeMode]);

    const apogeeData = activeMode === 'sim' ? simApogee : expApogee;

    const requestRef = useRef<number>(0);
    const previousTimeRef = useRef<number>(0);
    const simulatedTimeRef = useRef<number>(0);

    useEffect(() => {
        setTimeIndex(0);
        setIsPlaying(false);
        simulatedTimeRef.current = 0;
    }, [apogeeData, activeMode]);

    useEffect(() => {
        if (!isPlaying || !apogeeData || !apogeeData.t) return;
        
        simulatedTimeRef.current = apogeeData.t[timeIndex] || 0;
        previousTimeRef.current = performance.now();

        const animate = (time: number) => {
            const deltaTime = (time - previousTimeRef.current!) / 1000;
            simulatedTimeRef.current += deltaTime * speed;
            
            setTimeIndex(prev => {
                let newIndex = prev;
                while (newIndex < apogeeData.t.length - 1 && apogeeData.t[newIndex] < simulatedTimeRef.current) {
                    newIndex++;
                }
                if (newIndex >= apogeeData.t.length - 1) {
                    setIsPlaying(false);
                    return apogeeData.t.length - 1;
                }
                return newIndex;
            });
            
            previousTimeRef.current = time;
            requestRef.current = requestAnimationFrame(animate);
        };
        
        requestRef.current = requestAnimationFrame(animate);
        
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, speed, apogeeData]);

    const handlePlayToggle = () => {
        if (!isPlaying && apogeeData && timeIndex >= apogeeData.t.length - 1) {
            setTimeIndex(0);
            simulatedTimeRef.current = 0;
        }
        setIsPlaying(!isPlaying);
    };

    if (!simApogee && !expApogee) return null;

    const tCurrent = apogeeData?.t[timeIndex] || 0;
    const altCurrent = apogeeData?.h[timeIndex] || 0;
    const vCurrent = apogeeData?.v[timeIndex] || 0;
    const aCurrent = apogeeData?.a[timeIndex] || 0;
    const maxAlt = apogeeData?.maxApogee || 1000;
    
    // Smooth camera following logic
    const scale = 8; // pixels per meter
    const startFollowAlt = 15; // altitude to start panning camera
    const groundBaseBottom = 40; // baseline bottom offset in px

    const camAlt = Math.max(0, altCurrent - startFollowAlt);
    const rocketBottomPx = groundBaseBottom + (altCurrent - camAlt) * scale;

    const thrusting = vCurrent > 0 && aCurrent > 0 && (timeIndex < (apogeeData?.t.length || 0)/2);
    const falling = vCurrent < -0.5 || (apogeeData?.apogeeTime && tCurrent > apogeeData.apogeeTime);

    let flameColor = '#f97316';
    let diamondColor = '#fef08a';
    let flameSize = 1;
    let smokeColorHex = '#e2e8f0'; // slate-200
    let smokeOpacityNum = 0.3;

    if (propellantType >= 1 && propellantType <= 3) {
        // Candy/Dextrose: white smoke
        smokeColorHex = '#f8fafc'; // slate-50
        smokeOpacityNum = 0.6;
        flameSize = 1;
    } else if (propellantType === 4 || propellantType === 5) {
        // Epoxy/RNX: black smoke
        smokeColorHex = '#0f172a'; // slate-900
        smokeOpacityNum = 0.8;
        flameColor = '#ea580c';
        diamondColor = '#fdba74';
        flameSize = 0.8;
    } else if (propellantType >= 6) {
        // AP/HTPB: larger flame, less dense gray smoke
        flameSize = 2.0;
        flameColor = '#f97316';
        diamondColor = '#fbbf24';
        smokeColorHex = '#64748b'; // slate-500
        smokeOpacityNum = 0.5;
    }

    return (
        <Card className="bg-card border-border shadow-sm flex flex-col h-full overflow-hidden max-h-[500px]">
            <CardHeader className="py-2 px-3 bg-muted/50 border-b border-slate-700/50 flex flex-row items-center justify-between z-20 shrink-0">
                <CardTitle className="text-[12px] uppercase text-slate-300 font-bold">{t.flight_sim || "Simulación de Vuelo"}</CardTitle>
                <div className="flex gap-2">
                    <Button 
                        size="sm" 
                        variant={activeMode === 'sim' ? 'default' : 'outline'} 
                        disabled={!simApogee}
                        onClick={() => setActiveMode('sim')}
                        className="h-6 text-[10px] px-2 py-0 border-blue-500/50 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600"
                        data-state={activeMode === 'sim' ? 'active' : 'inactive'}
                    >
                        {t.simulated || "Simulado"}
                    </Button>
                    <Button 
                        size="sm" 
                        variant={activeMode === 'exp' ? 'default' : 'outline'} 
                        disabled={!expApogee}
                        onClick={() => setActiveMode('exp')}
                        className="h-6 text-[10px] px-2 py-0 border-purple-500/50 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-purple-600"
                        data-state={activeMode === 'exp' ? 'active' : 'inactive'}
                    >
                        {t.experimental || "Experimental"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative bg-gradient-to-t from-sky-400 via-blue-900 to-slate-900 overflow-hidden min-h-[300px]">
                {/* Background stars (visible higher up) */}
                <div className="absolute inset-0 z-0 transition-opacity duration-300" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center', opacity: altCurrent > maxAlt / 3 ? 0.4 * (altCurrent/maxAlt) : 0 }}></div>
                
                {/* Background clouds (parallax) */}
                <div 
                    className="absolute inset-0 z-0 transition-opacity duration-300" 
                    style={{ 
                        transform: `translateY(${camAlt * scale * 0.15}px)`,
                        opacity: altCurrent < 2000 ? 1 - (altCurrent/2000) : 0,
                        background: 'radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.1) 0%, transparent 60%), radial-gradient(ellipse at 20% 60%, rgba(255,255,255,0.1) 0%, transparent 40%)' 
                    }}
                >
                    {/* Add some drawn clouds */}
                    {[...Array(6)].map((_, i) => (
                        <div 
                            key={`cloud-${i}`} 
                            className="absolute opacity-60"
                            style={{
                                left: `${15 + (i * 35) % 80}%`,
                                bottom: `${150 + i * 200}px`,
                                filter: 'blur(4px)'
                            }}
                        >
                            <div className="w-24 h-8 bg-white rounded-full absolute -left-4 -top-2"></div>
                            <div className="w-16 h-12 bg-white rounded-full absolute left-4 -top-6"></div>
                            <div className="w-20 h-10 bg-white rounded-full absolute left-12 -top-3"></div>
                        </div>
                    ))}
                </div>

                {/* Stats Overlay */}
                <div className="absolute top-4 right-4 z-20 font-mono text-[11px] text-slate-300 space-y-1 bg-card/80 p-2 rounded-md border border-border backdrop-blur-sm shadow-sm text-right">
                    <div>T+ {tCurrent.toFixed(2)} s</div>
                    <div>ALT: <span className="text-blue-400 font-bold ml-1">{altCurrent.toFixed(1)} m</span></div>
                    <div>VEL: <span className="text-emerald-400 font-bold ml-1">{vCurrent.toFixed(1)} m/s</span></div>
                    <div>ACC: <span className="text-pink-400 font-bold ml-1">{aCurrent.toFixed(1)} m/s²</span></div>
                </div>

                <div className="absolute top-4 left-4 z-20 font-mono text-[13px] font-bold text-slate-300 bg-card/80 p-2 rounded-md border border-border backdrop-blur-sm">
                    {activeMode === 'sim' ? 'SIMULACIÓN APOGEO' : 'DATOS EXPERIMENTALES'}
                </div>

                {/* Rocket and Parachute Container */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-8 z-20 flex flex-col items-center justify-end"
                    style={{ 
                        bottom: `${rocketBottomPx}px`, 
                        height: '140px',
                        transition: isPlaying ? 'none' : 'bottom 0.3s ease-out'
                    }}
                >
                    {/* Parachute */}
                    {falling && (
                        <div className="absolute bottom-[80%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10 transition-opacity duration-500 opacity-100">
                           <svg viewBox="0 0 64 64" className="w-24 h-24 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                                <path d="M32 10 Q60 10 60 40 L4 40 Q4 10 32 10 Z" fill="#ef4444" opacity="0.9" />
                                <path d="M4 40 L32 60 L60 40" stroke="#cbd5e1" strokeWidth="1" />
                                <path d="M32 10 Q18 10 18 40" stroke="white" strokeWidth="2" opacity="0.3" />
                                <path d="M32 10 Q46 10 46 40" stroke="white" strokeWidth="2" opacity="0.3" />
                           </svg>
                        </div>
                    )}

                    {/* Rocket SVG */}
                    <svg 
                        viewBox="0 0 24 100" 
                        fill="none" 
                        className="w-full h-[120px] drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] z-20 relative origin-center"
                        style={{ 
                           transform: falling ? 'rotate(180deg)' : 'rotate(0deg)', 
                           transition: 'transform 0.5s ease-in-out' 
                        }}
                    >
                        {/* Nosecone */}
                        <path d="M12 0 L16 20 L8 20 Z" fill="#111827" />
                        {/* Upper Body */}
                        <rect x="8" y="20" width="8" height="30" fill="#111827" />
                        {/* Middle body (White band) */}
                        <rect x="8" y="50" width="8" height="15" fill="#f8fafc" />
                        {/* Lower body */}
                        <rect x="8" y="65" width="8" height="25" fill="#111827" />
                        {/* Tail Fins */}
                        <path d="M8 80 L2 95 L8 95 Z" fill="#334155" />
                        <path d="M16 80 L22 95 L16 95 Z" fill="#334155" />
                        {/* Nozzle */}
                        <path d="M9 90 L15 90 L16 94 L8 94 Z" fill="#cbd5e1" />
                        
                        {/* Flame */}
                        {thrusting && !falling && (
                            <path 
                                d={`M6 94 L12 ${94 + 20 * flameSize + Math.random()*15*flameSize} L18 94 Z`} 
                                fill={flameColor} 
                                className="animate-pulse"
                                style={{ filter: `drop-shadow(0 0 ${4 * flameSize}px ${flameColor})` }}
                            />
                        )}
                        {/* Main Diamond Flame */}
                        {thrusting && !falling && aCurrent > 30 && (
                             <path 
                                d={`M9 94 L12 ${94 + 8 * flameSize + Math.random()*5*flameSize} L15 94 Z`} 
                                fill={diamondColor} 
                             />
                        )}
                    </svg>

                    {/* Smoke particles leaving trail */}
                    {thrusting && !falling && (
                        <div 
                            className={`absolute top-[130px] left-1/2 -translate-x-1/2 pointer-events-none -z-10`}
                            style={{
                                width: flameSize > 1.5 ? '40px' : '24px',
                                height: flameSize > 1.5 ? '256px' : '160px',
                                filter: flameSize > 1.5 ? 'blur(24px)' : 'blur(12px)',
                                opacity: smokeOpacityNum,
                                background: `linear-gradient(to bottom, ${smokeColorHex}, transparent)`
                            }}
                        ></div>
                    )}
                </div>

                {/* World container (Translates DOWN as camera pans UP) */}
                <div 
                    className="absolute bottom-0 left-0 w-full h-[60px] z-10"
                    style={{ 
                        transform: `translateY(${camAlt * scale}px)`,
                        transition: isPlaying ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    {/* The Earth */}
                    <div className="absolute top-[20px] left-0 w-full h-[1000px] bg-slate-900 border-t border-emerald-800">
                        {/* Grass visual line */}
                        <div className="w-full h-1 bg-emerald-900/50"></div>
                    </div>

                    {/* Launch Pad Exhaust Deflection (Ground Smoke Bouncing) */}
                    {thrusting && !falling && altCurrent < 30 && (
                        <div 
                            className="absolute bottom-[40px] left-1/2 -translate-x-1/2 flex justify-center items-end flex-nowrap pointer-events-none z-30"
                            style={{ 
                                opacity: Math.max(0, 1 - altCurrent / 30) * smokeOpacityNum * 1.5,
                                transform: `scale(${1 + (altCurrent / 30) * 1.5})`
                            }}
                        >
                            {/* Left puff */}
                            <div 
                                className="w-[150px] h-[30px] rounded-[100%] animate-pulse relative left-4"
                                style={{
                                    background: `radial-gradient(ellipse at center, ${smokeColorHex} 0%, transparent 70%)`,
                                    filter: 'blur(12px)'
                                }}
                            ></div>
                            {/* Right puff */}
                            <div 
                                className="w-[150px] h-[30px] rounded-[100%] animate-pulse relative right-4"
                                style={{
                                    background: `radial-gradient(ellipse at center, ${smokeColorHex} 0%, transparent 70%)`,
                                    filter: 'blur(12px)'
                                }}
                            ></div>
                        </div>
                    )}

                    {/* Hangar with COHETEROS Text */}
                    <div className="absolute right-[calc(50%+40px)] bottom-[40px] w-56 h-24 bg-zinc-800 border-2 border-zinc-700 rounded-t-xl overflow-hidden shadow-2xl z-0">
                        {/* Hangar Door */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-14 bg-zinc-900 border-t border-l border-r border-zinc-700 flex flex-col items-center pt-2">
                           {/* Door lines */}
                           <div className="w-full h-0.5 bg-zinc-800 mb-2"></div>
                           <div className="w-full h-0.5 bg-zinc-800 mb-2"></div>
                           <div className="w-full h-0.5 bg-zinc-800 mb-2"></div>
                        </div>
                        {/* Red warning lights */}
                        <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        
                        {/* Text / Logo area */}
                        <div className="absolute top-3 w-full flex justify-center items-center gap-2 text-[14px] text-zinc-100 font-black italic tracking-[0.1em] drop-shadow-md">
                           <svg viewBox="0 0 100 100" className="w-6 h-6 fill-zinc-100 drop-shadow-md" style={{ transform: 'rotate(-5deg)' }}>
                                <path d="M50 0 L55 40 L100 50 L55 60 L50 100 L45 60 L0 50 L45 40 Z" />
                                <path d="M60 40 L85 25 L75 45 Z" />
                           </svg>
                           <span className="mt-1">COHETEROS</span>
                        </div>
                    </div>

                    {/* Launch Tower / Ramp */}
                    <div className="absolute left-[calc(50%+20px)] bottom-[40px] w-8 h-[350px] flex flex-col justify-end items-center pointer-events-none z-10">
                        <div className="absolute bottom-0 w-1.5 h-full bg-slate-600"></div>
                        
                        {/* Braces */}
                        <div className="absolute bottom-0 left-0 w-full h-full flex flex-col justify-between py-1">
                            {[...Array(25)].map((_, i) => (
                                <div key={`l-${i}`} className="w-full h-[2px] bg-slate-500/80 rotate-[30deg]"></div>
                            ))}
                        </div>
                        <div className="absolute bottom-0 right-0 w-full h-full flex flex-col justify-between py-1">
                            {[...Array(25)].map((_, i) => (
                                <div key={`r-${i}`} className="w-full h-[2px] bg-slate-500/80 -rotate-[30deg]"></div>
                            ))}
                        </div>
                        
                        {/* Support arms holding rocket */}
                        <div className="absolute top-[80px] right-[100%] w-6 h-1.5 bg-slate-500 rounded-l-sm"></div>
                        <div className="absolute top-[200px] right-[100%] w-6 h-1.5 bg-slate-500 rounded-l-sm"></div>
                        <div className="absolute top-[300px] right-[100%] w-6 h-1.5 bg-slate-500 rounded-l-sm"></div>
                    </div>
                </div>

            </CardContent>
            
            {/* Playback controls */}
            <div className="flex-none flex items-center gap-4 p-2 bg-muted/50 border-t border-slate-700/50">
                 <Button onClick={handlePlayToggle} size="sm" className="w-[100px] h-7 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px]">
                    {isPlaying ? <><Pause className="w-3 h-3 mr-1" /> {t.pause}</> : (apogeeData && timeIndex >= apogeeData.t.length - 1) ? <><RotateCcw className="w-3 h-3 mr-1"/> {t.restart}</> : <><Play className="w-3 h-3 mr-1" /> {t.play}</>}
                 </Button>
                 
                 <div className="flex-1 flex items-center mx-2">
                    <input 
                        type="range" 
                        min="0" 
                        max={(apogeeData?.t.length || 1) - 1} 
                        value={timeIndex} 
                        onChange={(e) => {
                            setTimeIndex(Number(e.target.value));
                            setIsPlaying(false);
                        }} 
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                    />
                 </div>
                 
                 <div className="flex items-center gap-2 w-[120px]">
                    <Label className="text-[10px] text-slate-400 font-mono uppercase">{t.speed || "Speed"}</Label>
                    <Select value={String(speed)} onValueChange={v => setSpeed(Number(v))}>
                       <SelectTrigger className="h-7 text-[10px] border-border bg-card text-blue-100 font-mono focus:ring-blue-500">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-card text-blue-100 font-mono text-[10px] border-border">
                         <SelectItem value="0.25">0.25x</SelectItem>
                         <SelectItem value="0.5">0.5x</SelectItem>
                         <SelectItem value="1">1.0x</SelectItem>
                         <SelectItem value="2">2.0x</SelectItem>
                         <SelectItem value="4">4.0x</SelectItem>
                         <SelectItem value="8">8.0x</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
            </div>
        </Card>
    );
}
