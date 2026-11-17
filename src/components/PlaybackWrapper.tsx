import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SimulationResults, MotorInput, NozzleInput, getPropellantVisualProfile } from '../lib/types';
import { Motor3DViewer } from './Motor3DViewer';
import { GrainViewer } from './GrainViewer';
import { NozzleFlowViewer } from './NozzleFlowViewer';
import { evaluateBurnbackTableAtDepth, isComplexGrain } from '../lib/grains';
import { Button } from '@/components/ui/button';
import {
  Box,
  Layers,
  Play,
  Pause,
  Activity,
  Wind,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function findTimeIndex(arr: number[], targetT: number): number {
  if (!arr || arr.length === 0) return 0;
  if (targetT <= arr[0]) return 0;
  const last = arr.length - 1;
  if (targetT >= arr[last]) return last;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= targetT) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function sampleSeriesAtTime(tArr: number[], vArr: number[], tSec: number): number {
  if (!tArr?.length || !vArr?.length) return 0;
  if (tSec <= tArr[0]) return vArr[0] || 0;
  const last = tArr.length - 1;
  if (tSec >= tArr[last]) return vArr[last] || 0;
  const lo = findTimeIndex(tArr, tSec);
  const hi = Math.min(last, lo + 1);
  const span = tArr[hi] - tArr[lo];
  const f = span > 1e-9 ? (tSec - tArr[lo]) / span : 0;
  return (vArr[lo] || 0) + ((vArr[hi] || 0) - (vArr[lo] || 0)) * f;
}

export function PlaybackWrapper({
  results,
  t_parent,
  motor,
  nozzle,
  syncEnabled = false,
  syncedTimeSec,
  syncedIsPlaying,
  syncedSpeed,
  onSyncTimeChange,
  onSyncTogglePlay,
  onSyncSpeedChange,
}: {
  results: SimulationResults;
  t_parent?: any;
  motor?: MotorInput;
  nozzle?: NozzleInput;
  syncEnabled?: boolean;
  syncedTimeSec?: number;
  syncedIsPlaying?: boolean;
  syncedSpeed?: number;
  onSyncTimeChange?: (tSec: number) => void;
  onSyncTogglePlay?: () => void;
  onSyncSpeedChange?: (spd: number) => void;
}) {
  const t = t_parent || {};

  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'nozzle_flow'>('3d');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeSec, setTimeSec] = useState(0);
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);

  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);

  const tMin = results?.t?.[0] ?? 0;
  const tMax = results?.t?.[Math.max(0, (results?.t?.length || 1) - 1)] ?? 0;
  const winMin = zoomRange ? Math.max(tMin, zoomRange[0]) : tMin;
  const winMax = zoomRange ? Math.min(tMax, Math.max(winMin + 0.002, zoomRange[1])) : tMax;

  useEffect(() => {
    setTimeSec(results?.t?.[0] ?? 0);
    setIsPlaying(false);
    setZoomRange(null);
    simulatedTimeRef.current = results?.t?.[0] ?? 0;
  }, [results]);

  // Continuous sub-step clock when sync is disabled
  useEffect(() => {
    if (syncEnabled || !isPlaying || !results || !results.t || results.t.length === 0) return;

    simulatedTimeRef.current = timeSec;
    previousTimeRef.current = performance.now();

    const animate = (now: number) => {
      const deltaTime = Math.min(0.05, Math.max(0, (now - previousTimeRef.current) / 1000));
      previousTimeRef.current = now;

      const nextT = simulatedTimeRef.current + deltaTime * speed;
      if (nextT >= winMax) {
        simulatedTimeRef.current = winMax;
        setTimeSec(winMax);
        setIsPlaying(false);
        return;
      }

      simulatedTimeRef.current = nextT;
      setTimeSec(nextT);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [syncEnabled, isPlaying, speed, results, winMax]);

  const effectiveTimeSec = useMemo(() => {
    if (syncEnabled && syncedTimeSec !== undefined) {
      return Math.max(tMin, Math.min(tMax, syncedTimeSec));
    }
    return Math.max(tMin, Math.min(tMax, timeSec));
  }, [syncEnabled, syncedTimeSec, timeSec, tMin, tMax]);

  const effectiveTimeIndex = useMemo(() => {
    return findTimeIndex(results?.t || [], effectiveTimeSec);
  }, [results?.t, effectiveTimeSec]);

  const effectiveIsPlaying = syncEnabled && syncedIsPlaying !== undefined ? syncedIsPlaying : isPlaying;
  const effectiveSpeed = syncEnabled && syncedSpeed !== undefined ? syncedSpeed : speed;

  const handlePlayToggle = () => {
    if (syncEnabled && onSyncTogglePlay) {
      onSyncTogglePlay();
      return;
    }
    if (!isPlaying && timeSec >= winMax - 1e-6) {
      simulatedTimeRef.current = winMin;
      setTimeSec(winMin);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeekIndex = (newIdx: number) => {
    const clampedIdx = Math.max(0, Math.min((results?.t?.length || 1) - 1, newIdx));
    const targetSec = results?.t?.[clampedIdx] ?? 0;
    if (syncEnabled && onSyncTimeChange) {
      onSyncTimeChange(targetSec);
      return;
    }
    simulatedTimeRef.current = targetSec;
    setTimeSec(targetSec);
    setIsPlaying(false);
  };

  const handleSeekTimeSec = (targetSec: number) => {
    const clamped = Math.max(tMin, Math.min(tMax, targetSec));
    if (syncEnabled && onSyncTimeChange) {
      onSyncTimeChange(clamped);
      return;
    }
    simulatedTimeRef.current = clamped;
    setTimeSec(clamped);
    setIsPlaying(false);
  };

  const handleSpeedUpdate = (newSpeed: number) => {
    if (syncEnabled && onSyncSpeedChange) {
      onSyncSpeedChange(newSpeed);
      return;
    }
    setSpeed(newSpeed);
  };

  const handleToggleIgnitionZoom = (startSec: number, endSec: number) => {
    if (zoomRange) {
      setZoomRange(null);
      return;
    }
    const clampedStart = Math.max(tMin, startSec);
    const clampedEnd = Math.min(tMax, Math.max(clampedStart + 0.005, endSec));
    setZoomRange([clampedStart, clampedEnd]);
    handleSeekTimeSec(clampedStart);
    handleSpeedUpdate(0.05);
  };

  const handleJumpToTimeSec = (targetSec: number, suggestedSpeed?: number) => {
    if (suggestedSpeed !== undefined) {
      handleSpeedUpdate(suggestedSpeed);
    }
    if (zoomRange && (targetSec < zoomRange[0] || targetSec > zoomRange[1])) {
      setZoomRange(null);
    }
    handleSeekTimeSec(targetSec);
  };

  const handleMicroStep = (dir: -1 | 1) => {
    const span = Math.max(0.002, winMax - winMin);
    const step = zoomRange ? span / 250 : Math.min(span / 400, 0.0025);
    handleSeekTimeSec(Math.max(winMin, Math.min(winMax, effectiveTimeSec + dir * step)));
  };

  const profile = useMemo(() => {
    return getPropellantVisualProfile(results?.propellantType || 1);
  }, [results?.propellantType]);

  if (!results || !results.t) return null;

  const currentThrust = sampleSeriesAtTime(results.t, results.E_N || results.F_N, effectiveTimeSec);
  const currentP = sampleSeriesAtTime(results.t, results.P0_gage, effectiveTimeSec);
  const maxThrust = Math.max(1, results.summary.Fmax_N || 1);
  const normThrust = Math.min(1, Math.max(0, currentThrust / maxThrust));

  const finePrecision = effectiveSpeed <= 0.1 || zoomRange !== null;
  const subMsWindow = (winMax - winMin) < 0.02;
  const decPlaces = subMsWindow ? 5 : finePrecision ? 4 : 3;
  const timeFmt = effectiveTimeSec.toFixed(decPlaces);
  const sliderSteps = 2000;
  const sliderValue = Math.round(
    ((effectiveTimeSec - winMin) / Math.max(1e-9, winMax - winMin)) * sliderSteps
  );

  return (
    <div className="flex flex-col w-full h-full min-h-[490px] gap-2">
      {/* Sub-navigation bar for 3D vs 2D vs Nozzle Flow Views */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-muted/40 rounded-lg border border-border shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={activeTab === '3d' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('3d')}
            className={`h-7 text-xs font-mono font-bold gap-1.5 transition-all ${
              activeTab === '3d'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Box size={14} />
            <span>{t?.active_tab_3d || 'Motor 3D Interactivo'}</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === '2d' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('2d')}
            className={`h-7 text-xs font-mono font-bold gap-1.5 transition-all ${
              activeTab === '2d'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers size={14} />
            <span>{t?.active_tab_2d || 'Análisis Geométrico 2D'}</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'nozzle_flow' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('nozzle_flow')}
            className={`h-7 text-xs font-mono font-bold gap-1.5 transition-all ${
              activeTab === 'nozzle_flow'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wind size={14} />
            <span>{t?.active_tab_nozzle_flow || 'Flujo en Tobera 2D (TTI)'}</span>
          </Button>
        </div>

        <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
          {activeTab === '3d'
            ? t?.tab_3d_hint || 'Gira con clic y arrastre • Zoom con rueda'
            : activeTab === '2d'
              ? t?.tab_2d_hint || 'Perfiles longitudinales y transversales'
              : t?.tab_nozzle_flow_hint || 'Onda de choque normal (OCN), abanicos Prandtl-Meyer y diamantes de Mach'}
        </span>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-[430px] relative rounded-xl overflow-hidden border border-border">
        {activeTab === '3d' ? (
          <Motor3DViewer
            results={results}
            timeIndex={effectiveTimeIndex}
            motor={motor}
            nozzle={nozzle}
            onTimeChange={handleSeekIndex}
            isPlaying={effectiveIsPlaying}
            onTogglePlay={handlePlayToggle}
            speed={effectiveSpeed}
            onSpeedChange={handleSpeedUpdate}
            t={t}
          />
        ) : (
          <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative select-none">
            {/* TOP HUD BAR FOR 2D / NOZZLE FLOW VIEWS */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <div>
                  <span className="font-bold text-xs uppercase tracking-widest text-white font-mono flex items-center gap-2">
                    {activeTab === 'nozzle_flow' ? (
                      <Wind size={14} className="text-cyan-400" />
                    ) : (
                      <Layers size={14} className="text-cyan-400" />
                    )}
                    {activeTab === 'nozzle_flow'
                      ? t?.nozzle_flow_title || 'Dinámica de Flujo y Onda de Choque 2D (TTI)'
                      : t?.motor_2d_title || 'Evolución Geométrica 2D de Granos'}
                  </span>
                  <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="text-sky-300 font-semibold">{profile.displayName}</span>
                    <span>•</span>
                    <span>
                      {results.grains.length} {t?.grains_types || 'tipos de granos'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Gauges in HUD */}
              <div className="flex items-center gap-4 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs tabular-nums">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase">{t?.thrust || 'Thrust'}:</span>
                  <span className="font-bold text-orange-400">{currentThrust.toFixed(1)} N</span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase">{t?.pressure || 'Pressure'}:</span>
                  <span className="font-bold text-sky-400">{(currentP * 10).toFixed(2)} bar</span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase">{t?.axis_time?.split(' ')[0] || 'Time'}:</span>
                  <span className="font-bold text-cyan-300">T+ {timeFmt}s</span>
                </div>
              </div>

              {/* Motor Status Badge */}
              <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 font-mono text-[11px] text-slate-200">
                <Activity size={13} className="text-emerald-400" />
                <span>
                  {normThrust > 0.05
                    ? `🔥 ${t?.motor_firing || 'EN COMBUSTIÓN'}`
                    : effectiveTimeSec >= tMax - 1e-4
                      ? `🏁 ${t?.motor_exhausted || 'AGOTADO'}`
                      : `⏸ ${t?.motor_standby || 'EN ESPERA'}`}
                </span>
              </div>
            </div>

            {/* Middle 2D / Nozzle Flow Area */}
            {activeTab === 'nozzle_flow' ? (
              <div className="flex-1 min-h-0 flex flex-col p-2.5 bg-slate-950/60 overflow-hidden">
                <NozzleFlowViewer
                  results={results}
                  timeIndex={effectiveTimeIndex}
                  timeSec={effectiveTimeSec}
                  motor={motor}
                  nozzle={nozzle}
                  isPlaying={effectiveIsPlaying}
                  speed={effectiveSpeed}
                  isIgnitionZoom={zoomRange !== null}
                  onToggleIgnitionZoom={handleToggleIgnitionZoom}
                  onJumpToTimeSec={handleJumpToTimeSec}
                  t={t}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-2.5 p-3 bg-slate-950/60 overflow-y-auto">
                <div className="flex-1 min-h-[290px] rounded-lg border border-slate-800 overflow-hidden">
                  <GrainViewer results={results} timeIndex={effectiveTimeIndex} t={t} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 shrink-0">
                  {results.grains.map((g, gi) => {
                    const xBurn = results.grains_x?.[gi]?.[effectiveTimeIndex] || 0;
                    const burnbackTable = results.grains_burnback?.[gi];
                    const isComplex = isComplexGrain(g.shape);
                    const isComplexExhausted = isComplex && burnbackTable ? xBurn >= burnbackTable.xMaxMm : false;
                    const curL = isComplexExhausted ? 0 : Math.max(0, g.L0 - g.ei * xBurn * 2);
                    const curDOut = isComplexExhausted ? 0 : Math.max(0, g.D0 - g.osi * xBurn * 2);
                    const curDIn =
                      g.shape === 1
                        ? Math.min(curDOut, g.d0 + g.ci * xBurn * 2)
                        : isComplex
                          ? Math.min(curDOut, g.d0mayor + g.ci * xBurn * 2)
                          : 0;
                    let burnPct = 0;
                    if (isComplex && burnbackTable) {
                      const eval0 = evaluateBurnbackTableAtDepth(burnbackTable, 0, g, motor?.Dc || g.D0);
                      const evalNow = evaluateBurnbackTableAtDepth(burnbackTable, xBurn, g, motor?.Dc || g.D0);
                      burnPct = eval0.Vg > 0
                        ? Math.min(100, Math.max(0, (1 - evalNow.Vg / eval0.Vg) * 100))
                        : 100;
                    } else {
                      burnPct = Math.min(
                        100,
                        Math.max(
                          0,
                          (1 -
                            (curL * Math.max(0.001, curDOut - curDIn)) /
                              Math.max(0.001, g.L0 * Math.max(0.001, g.D0 - (g.shape === 3 ? 0 : g.d0)))) *
                            100
                        )
                      );
                    }

                    return (
                      <div
                        key={g.id || gi}
                        className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 font-mono text-[10px] flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="font-bold text-cyan-300 uppercase">
                            {t?.grains || 'Grano'} #{gi + 1} ×{g.N}
                          </span>
                          <span className="text-amber-300 font-bold">{burnPct.toFixed(0)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-slate-300 pt-0.5 tabular-nums">
                          <div>
                            <span className="text-slate-500 block text-[9px]">D₀</span>
                            <strong>{curDOut.toFixed(1)}</strong> mm
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">d₀</span>
                            <strong>{g.shape === 3 ? '—' : `${curDIn.toFixed(1)} mm`}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">L</span>
                            <strong>{curL.toFixed(1)}</strong> mm
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BOTTOM PLAYBACK CONTROLS BAR */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-900 border-t border-slate-800 z-10 shrink-0">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleMicroStep(-1)}
                  className="h-8 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title={t?.step_prev_hint || 'Retroceder micropaso'}
                >
                  <ChevronLeft size={15} />
                </Button>

                <Button
                  onClick={handlePlayToggle}
                  className={`w-24 h-8 font-mono text-xs font-bold gap-1.5 transition-all shadow-md ${
                    effectiveIsPlaying
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  {effectiveIsPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {effectiveIsPlaying
                    ? t?.pause || 'Pausar'
                    : effectiveTimeSec >= winMax - 1e-6
                      ? t?.restart || 'Reiniciar'
                      : t?.play || 'Play'}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleMicroStep(1)}
                  className="h-8 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title={t?.step_next_hint || 'Avanzar micropaso'}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>

              <div className="flex-1 min-w-[160px] flex flex-col justify-center px-1">
                <input
                  type="range"
                  min={0}
                  max={sliderSteps}
                  value={Math.max(0, Math.min(sliderSteps, sliderValue))}
                  onChange={(e) => {
                    const f = Number(e.target.value) / sliderSteps;
                    handleSeekTimeSec(winMin + f * (winMax - winMin));
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono tabular-nums">
                  <span>{winMin.toFixed(finePrecision ? 4 : 3)}s</span>
                  <span className="font-bold text-white text-xs">
                    T+ {timeFmt}s / {(results.summary.t_quemado || tMax).toFixed(3)}s
                  </span>
                  <span>{winMax.toFixed(finePrecision ? 4 : 3)}s</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 w-[115px]">
                <span className="text-[10px] text-slate-400 font-mono uppercase">
                  {t?.speed_label || t?.playback_speed || 'Vel:'}
                </span>
                <Select value={String(effectiveSpeed)} onValueChange={(v) => handleSpeedUpdate(Number(v))}>
                  <SelectTrigger className="h-7 text-[10px] border-slate-700 bg-slate-950 text-sky-300 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-sky-200 font-mono text-[10px] border-slate-700">
                    <SelectItem value="0.01">0.01x</SelectItem>
                    <SelectItem value="0.02">0.02x</SelectItem>
                    <SelectItem value="0.05">0.05x</SelectItem>
                    <SelectItem value="0.1">0.1x</SelectItem>
                    <SelectItem value="0.25">0.25x</SelectItem>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="1">1.0x ({t?.real_time || 'Real'})</SelectItem>
                    <SelectItem value="2">2.0x</SelectItem>
                    <SelectItem value="4">4.0x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
