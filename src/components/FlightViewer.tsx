import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ApogeeResult, computeStandardAtmosphere, getExitMach } from '../lib/apogee';
import { MotorInput, NozzleInput, CustomPropellant, getPropellantVisualProfile, getPropellantData } from '../lib/types';
import { Language } from '../lib/i18n';
import {
  detectSoftwareWebGL,
  createSoftParticleTexture,
  createPlumeShaderMaterial,
} from '../lib/motor3dMaterials';
import {
  createLaunchPadTexture,
  createDynamicSkyDome,
  sampleAltitudeAtmosphere,
  buildCoastalRangeEnvironment,
  buildCoheterosHangar,
  buildParametricRocket3D,
  buildTiltingTELTower,
} from '../lib/flight3dScene';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Navigation,
  Video,
  Compass,
  Rocket,
  Eye,
  GitCompare,
  Flag,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CameraMode = 'chase' | 'onboard' | 'pad' | 'arc';
type FlightPhase = 'pad' | 'powered' | 'coast' | 'drogue' | 'main' | 'descent' | 'landed';
type ActiveFlightMode = 'sim' | 'exp' | 'both';

interface TimelinePoint {
  t: number;
  x: number;
  h: number;
  v: number;
  vx: number;
  vy: number;
  a: number;
  mach: number;
  pitchRad: number;
  gammaDeg: number;
  thrusting: boolean;
  drogueOpen: number;
  mainOpen: number;
  phase: FlightPhase;
}

export interface MissionMilestone {
  id: 'maxq' | 'mach1' | 'burnout' | 'apogee' | 'drogue' | 'main';
  labelKey: string;
  fallbackLabel: string;
  t: number;
  index: number;
  x: number;
  h: number;
  detail: string;
  colorHex: number;
  badgeBg: string;
  badgeText: string;
}

interface FlightTimeline {
  points: TimelinePoint[];
  milestones: MissionMilestone[];
  apogeeIndex: number;
  burnoutTime: number;
  xApogee: number;
  maxApogee: number;
  flightPathAngleDeg: number;
  rocketDiameterM: number;
  launchAltitudeM: number;
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m?.dispose());
    } else if (mat) {
      mat.dispose();
    }
  });
}

function findTimelineIndexAtTime(points: TimelinePoint[], targetT: number): number {
  if (!points || points.length === 0) return 0;
  if (targetT <= points[0].t) return 0;
  const last = points.length - 1;
  if (targetT >= points[last].t) return last;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= targetT) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Allocation-free linear interpolation between adjacent timeline samples so
 * WebGL renders at full 60 FPS even across sparse long-duration descent segments.
 */
function sampleInterpolatedPoint(points: TimelinePoint[], targetT: number, out: TimelinePoint): number {
  const n = points.length;
  if (n === 0) return 0;
  if (n === 1 || targetT <= points[0].t) {
    Object.assign(out, points[0]);
    return 0;
  }
  if (targetT >= points[n - 1].t) {
    Object.assign(out, points[n - 1]);
    return n - 1;
  }
  const idx = findTimelineIndexAtTime(points, targetT);
  const p0 = points[idx];
  const p1 = points[Math.min(n - 1, idx + 1)];
  const span = p1.t - p0.t;
  const alpha = span > 1e-7 ? Math.max(0, Math.min(1, (targetT - p0.t) / span)) : 0;

  out.t = targetT;
  out.x = p0.x + (p1.x - p0.x) * alpha;
  out.h = p0.h + (p1.h - p0.h) * alpha;
  out.v = p0.v + (p1.v - p0.v) * alpha;
  out.vx = p0.vx + (p1.vx - p0.vx) * alpha;
  out.vy = p0.vy + (p1.vy - p0.vy) * alpha;
  out.a = p0.a + (p1.a - p0.a) * alpha;
  out.mach = p0.mach + (p1.mach - p0.mach) * alpha;
  out.pitchRad = p0.pitchRad + (p1.pitchRad - p0.pitchRad) * alpha;
  out.gammaDeg = p0.gammaDeg + (p1.gammaDeg - p0.gammaDeg) * alpha;
  out.drogueOpen = p0.drogueOpen + (p1.drogueOpen - p0.drogueOpen) * alpha;
  out.mainOpen = p0.mainOpen + (p1.mainOpen - p0.mainOpen) * alpha;
  out.thrusting = alpha < 0.5 ? p0.thrusting : p1.thrusting;
  out.phase = alpha < 0.5 ? p0.phase : p1.phase;
  return idx;
}

/**
 * Builds a complete mission timeline combining simulated/experimental ascent up to apogee
 * with realistic canopy inflation and parachute descent back to touchdown (h = 0),
 * plus automatic detection of MAX-Q, MACH 1, BURNOUT, and APOGEE milestones.
 */
function buildCompleteFlightTimeline(apogeeData: ApogeeResult | null): FlightTimeline {
  if (!apogeeData || !apogeeData.t || apogeeData.t.length === 0) {
    return {
      points: [],
      milestones: [],
      apogeeIndex: 0,
      burnoutTime: 0,
      xApogee: 0,
      maxApogee: 100,
      flightPathAngleDeg: 90,
      rocketDiameterM: 0.08,
      launchAltitudeM: 169,
    };
  }

  const N = apogeeData.t.length;
  const angleDeg = Math.max(0, Math.min(90, apogeeData.flightPathAngleDeg ?? 90));
  const rad0 = (angleDeg * Math.PI) / 180;
  const burnoutTime =
    apogeeData.burnoutTime > 0
      ? apogeeData.burnoutTime
      : apogeeData.t[Math.min(N - 1, Math.floor(N * 0.25))] || 0;
  const maxApogee = Math.max(0, apogeeData.maxApogee || 0);
  const rocketDiameterM = Math.max(0.03, apogeeData.rocketDiameterM || 0.08);
  const launchAltitudeM = apogeeData.launchAltitudeM ?? 169;

  // Find raw peak altitude index so ascent keeps dense sampling even when long parachute descent is present
  let rawPeakIdx = 0;
  let rawPeakH = -Infinity;
  for (let i = 0; i < N; i++) {
    const hv = apogeeData.h[i] ?? 0;
    if (hv >= rawPeakH) {
      rawPeakH = hv;
      rawPeakIdx = i;
    }
  }
  const hasIntegratedDescent = apogeeData.recoveryMode !== 'none' && rawPeakIdx < N - 1;

  // Downsample ascent (~450 pts) + optional integrated descent (~300 pts) preserving t=0, burnout, apogee, touchdown
  const ascentEnd = hasIntegratedDescent ? rawPeakIdx : N - 1;
  const ascentTarget = hasIntegratedDescent ? 450 : 750;
  const ascentStride = Math.max(1, Math.floor((ascentEnd + 1) / ascentTarget));
  const indices: number[] = [0];
  let burnoutAdded = false;

  for (let i = ascentStride; i < ascentEnd; i += ascentStride) {
    if (!burnoutAdded && apogeeData.t[i] >= burnoutTime) {
      let bIdx = i;
      while (bIdx > 0 && apogeeData.t[bIdx - 1] >= burnoutTime) bIdx--;
      if (indices[indices.length - 1] !== bIdx) indices.push(bIdx);
      burnoutAdded = true;
    }
    if (indices[indices.length - 1] !== i) indices.push(i);
  }
  if (indices[indices.length - 1] !== ascentEnd) indices.push(ascentEnd);

  if (hasIntegratedDescent) {
    const descentCount = N - 1 - rawPeakIdx;
    const descentStride = Math.max(1, Math.floor(descentCount / 600));
    const mainDeployT = apogeeData.mainDeployTime;
    let mainAdded = false;
    for (let i = rawPeakIdx + descentStride; i < N - 1; i += descentStride) {
      if (!mainAdded && mainDeployT !== undefined && apogeeData.t[i] >= mainDeployT) {
        let mIdx = i;
        while (mIdx > rawPeakIdx + 1 && apogeeData.t[mIdx - 1] >= mainDeployT) mIdx--;
        if (indices[indices.length - 1] !== mIdx) indices.push(mIdx);
        mainAdded = true;
      }
      if (indices[indices.length - 1] !== i) indices.push(i);
    }
    if (indices[indices.length - 1] !== N - 1) indices.push(N - 1);
  }

  const points: TimelinePoint[] = [];
  let peakH = -Infinity;
  let apogeeIndex = 0;
  let droguePointIdx = -1;
  let mainPointIdx = -1;
  const apogeeT = apogeeData.apogeeTime > 0 ? apogeeData.apogeeTime : apogeeData.t[rawPeakIdx] ?? 0;
  const drogueT = apogeeData.drogueDeployTime;
  const mainT = apogeeData.mainDeployTime;

  for (const idx of indices) {
    const tVal = apogeeData.t[idx] ?? 0;
    const xVal = apogeeData.x?.[idx] ?? 0;
    const hVal = apogeeData.h[idx] ?? 0;
    const vVal = apogeeData.v[idx] ?? 0;
    const vxVal = apogeeData.vx?.[idx] ?? vVal * Math.cos(rad0);
    const vyVal = apogeeData.vy?.[idx] ?? vVal * Math.sin(rad0);
    const aVal = apogeeData.a[idx] ?? 0;
    const machVal = apogeeData.mach?.[idx] ?? Math.abs(vVal) / 340.29;
    const pitchRad = apogeeData.pitch?.[idx] ?? rad0;
    const gammaDeg = apogeeData.gammaDeg?.[idx] ?? (pitchRad * 180) / Math.PI;
    const rawPhase = apogeeData.phase?.[idx];

    const isBurn = tVal <= burnoutTime + 1e-4 && (idx === 0 || hVal >= 0) && rawPhase !== 'drogue' && rawPhase !== 'main' && rawPhase !== 'landed';
    let phase: FlightPhase;
    let drogueOpen = 0;
    let mainOpen = 0;

    if (rawPhase === 'landed' || (hasIntegratedDescent && idx === N - 1 && hVal <= 0.05)) {
      phase = 'landed';
      drogueOpen = 0;
      mainOpen = 1;
    } else if (rawPhase === 'drogue') {
      phase = 'drogue';
      const deployStart = drogueT ?? apogeeT;
      drogueOpen = Math.min(1, Math.max(0.05, (tVal - deployStart) / 1.1));
      mainOpen = 0;
      if (droguePointIdx === -1) droguePointIdx = points.length;
    } else if (rawPhase === 'main' || (hasIntegratedDescent && idx > rawPeakIdx)) {
      phase = 'main';
      const deployStart = mainT ?? apogeeT;
      mainOpen = Math.min(1, Math.max(0.05, (tVal - deployStart) / 1.35));
      if (apogeeData.recoveryMode === 'dual' && drogueT !== undefined && deployStart > drogueT + 0.05) {
        drogueOpen = Math.max(0, 1 - (tVal - deployStart) / 0.45);
      } else {
        drogueOpen = 0;
      }
      if (mainPointIdx === -1) mainPointIdx = points.length;
    } else {
      phase = idx === 0 && vVal < 0.05 ? 'pad' : isBurn ? 'powered' : 'coast';
    }

    points.push({
      t: tVal,
      x: xVal,
      h: hVal,
      v: vVal,
      vx: vxVal,
      vy: vyVal,
      a: aVal,
      mach: machVal,
      pitchRad,
      gammaDeg,
      thrusting: isBurn,
      drogueOpen,
      mainOpen,
      phase,
    });

    if (hVal >= peakH) {
      peakH = hVal;
      apogeeIndex = points.length - 1;
    }
  }

  // Compute Mission Milestones along ascent + recovery deployment events
  const milestones: MissionMilestone[] = [];
  let maxQPa = -1;
  let maxQIdx = -1;
  let mach1Idx = -1;
  let burnoutPointIdx = -1;
  let minBurnDiff = Infinity;

  for (let i = 0; i <= apogeeIndex && i < points.length; i++) {
    const pt = points[i];
    const absAlt = Math.max(0, launchAltitudeM + pt.h);
    const rho = computeStandardAtmosphere(absAlt).rho;
    const qPa = 0.5 * rho * pt.v * pt.v;

    if (qPa > maxQPa) {
      maxQPa = qPa;
      maxQIdx = i;
    }
    if (mach1Idx === -1 && pt.mach >= 1.0) {
      mach1Idx = i;
    }
    const burnDiff = Math.abs(pt.t - burnoutTime);
    if (burnDiff < minBurnDiff) {
      minBurnDiff = burnDiff;
      burnoutPointIdx = i;
    }
  }

  if (maxQIdx > 0 && maxQPa > 25) {
    const mp = points[maxQIdx];
    milestones.push({
      id: 'maxq',
      labelKey: 'milestone_maxq',
      fallbackLabel: 'MAX-Q',
      t: mp.t,
      index: maxQIdx,
      x: mp.x,
      h: mp.h,
      detail: maxQPa >= 1000 ? `${(maxQPa / 1000).toFixed(1)} kPa` : `${maxQPa.toFixed(0)} Pa`,
      colorHex: 0xf59e0b,
      badgeBg: 'bg-amber-500/20 border-amber-500/50',
      badgeText: 'text-amber-300',
    });
  }

  if (mach1Idx > 0) {
    const mp = points[mach1Idx];
    milestones.push({
      id: 'mach1',
      labelKey: 'milestone_mach1',
      fallbackLabel: 'MACH 1',
      t: mp.t,
      index: mach1Idx,
      x: mp.x,
      h: mp.h,
      detail: `${mp.h.toFixed(0)} m`,
      colorHex: 0xec4899,
      badgeBg: 'bg-pink-500/20 border-pink-500/50',
      badgeText: 'text-pink-300',
    });
  }

  if (burnoutPointIdx > 0 && burnoutTime > 0) {
    const mp = points[burnoutPointIdx];
    milestones.push({
      id: 'burnout',
      labelKey: 'milestone_burnout',
      fallbackLabel: 'BURNOUT',
      t: mp.t,
      index: burnoutPointIdx,
      x: mp.x,
      h: mp.h,
      detail: `T+${mp.t.toFixed(2)}s`,
      colorHex: 0xf97316,
      badgeBg: 'bg-orange-500/20 border-orange-500/50',
      badgeText: 'text-orange-300',
    });
  }

  if (apogeeIndex > 0 && maxApogee > 0.5) {
    const mp = points[apogeeIndex];
    milestones.push({
      id: 'apogee',
      labelKey: 'milestone_apogee',
      fallbackLabel: 'APOGEO',
      t: mp.t,
      index: apogeeIndex,
      x: mp.x,
      h: mp.h,
      detail: `${mp.h.toFixed(0)} m`,
      colorHex: 0x38bdf8,
      badgeBg: 'bg-sky-500/20 border-sky-500/50',
      badgeText: 'text-sky-300',
    });
  }

  if (droguePointIdx > 0 && points[droguePointIdx]) {
    const mp = points[droguePointIdx];
    milestones.push({
      id: 'drogue',
      labelKey: 'milestone_drogue',
      fallbackLabel: 'DROGUE',
      t: mp.t,
      index: droguePointIdx,
      x: mp.x,
      h: mp.h,
      detail: `${mp.h.toFixed(0)} m`,
      colorHex: 0xfbbf24,
      badgeBg: 'bg-yellow-500/20 border-yellow-500/50',
      badgeText: 'text-yellow-300',
    });
  }

  if (mainPointIdx > 0 && points[mainPointIdx]) {
    const mp = points[mainPointIdx];
    milestones.push({
      id: 'main',
      labelKey: 'milestone_main',
      fallbackLabel: 'PRINCIPAL',
      t: mp.t,
      index: mainPointIdx,
      x: mp.x,
      h: mp.h,
      detail: `${mp.h.toFixed(0)} m`,
      colorHex: 0x34d399,
      badgeBg: 'bg-emerald-500/20 border-emerald-500/50',
      badgeText: 'text-emerald-300',
    });
  }

  milestones.sort((a, b) => a.t - b.t);

  // If solver stopped at apogee (recoveryMode === 'none'), append brief 2.2s visual canopy opening epilogue
  const lastAscent = points[points.length - 1];
  const xApogee = points[apogeeIndex]?.x ?? lastAscent.x;

  if (!hasIntegratedDescent && lastAscent.h > 0.5) {
    const deployDur = 2.2;
    const deploySteps = 18;
    const dtStep = deployDur / deploySteps;

    let tCur = lastAscent.t;
    let xCur = lastAscent.x;
    let hCur = lastAscent.h;
    let vxCur = lastAscent.vx;
    let vyCur = lastAscent.vy;
    let pitchCur = lastAscent.pitchRad;

    for (let s = 1; s <= deploySteps; s++) {
      const elapsedDeploy = s * dtStep;
      tCur = lastAscent.t + elapsedDeploy;

      const mainOpen = Math.min(1, elapsedDeploy / 1.45);
      vxCur *= Math.exp(-dtStep * (0.65 + 1.1 * mainOpen));

      const targetVy = -2.8 * mainOpen;
      vyCur += (targetVy - vyCur) * Math.min(1, dtStep * 2.5);

      xCur += vxCur * dtStep;
      hCur = Math.max(0, hCur + vyCur * dtStep);
      pitchCur += (Math.PI / 2 - pitchCur) * Math.min(1, dtStep * 2.4);

      const speedTotal = Math.sqrt(vxCur * vxCur + vyCur * vyCur);

      points.push({
        t: tCur,
        x: xCur,
        h: hCur,
        v: speedTotal,
        vx: vxCur,
        vy: vyCur,
        a: -1.4 * mainOpen,
        mach: speedTotal / 340.29,
        pitchRad: pitchCur,
        gammaDeg: (pitchCur * 180) / Math.PI,
        thrusting: false,
        drogueOpen: 0,
        mainOpen,
        phase: 'descent',
      });
    }
  } else if (points.length > 0) {
    points[points.length - 1].phase = 'landed';
  }

  return {
    points,
    milestones,
    apogeeIndex,
    burnoutTime,
    xApogee,
    maxApogee: Math.max(1, maxApogee),
    flightPathAngleDeg: angleDeg,
    rocketDiameterM,
    launchAltitudeM,
  };
}

export function FlightViewer({
  simApogee,
  expApogee,
  t,
  lang,
  avgChamberPressureMPa,
  propellantType = 1,
  motor,
  nozzle,
  customPropellants,
  syncEnabled = false,
  syncedTimeSec,
  syncedIsPlaying,
  syncedSpeed,
  onSyncTimeChange,
  onSyncTogglePlay,
  onSyncSpeedChange,
  onDurationChange,
}: {
  simApogee: ApogeeResult | null;
  expApogee: ApogeeResult | null;
  t: any;
  lang?: Language;
  avgChamberPressureMPa?: number;
  propellantType?: number;
  motor?: MotorInput;
  nozzle?: NozzleInput;
  customPropellants?: CustomPropellant[];
  syncEnabled?: boolean;
  syncedTimeSec?: number;
  syncedIsPlaying?: boolean;
  syncedSpeed?: number;
  onSyncTimeChange?: (tSec: number) => void;
  onSyncTogglePlay?: () => void;
  onSyncSpeedChange?: (spd: number) => void;
  onDurationChange?: (durationSec: number) => void;
}) {
  const [activeMode, setActiveMode] = useState<ActiveFlightMode>('sim');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (activeMode === 'sim' && !simApogee && expApogee) setActiveMode('exp');
    if (activeMode === 'exp' && !expApogee && simApogee) setActiveMode('sim');
    if (activeMode === 'both' && (!simApogee || !expApogee)) {
      setActiveMode(simApogee ? 'sim' : 'exp');
    }
  }, [simApogee, expApogee, activeMode]);

  const simTimeline = useMemo(() => buildCompleteFlightTimeline(simApogee), [simApogee]);
  const expTimeline = useMemo(() => buildCompleteFlightTimeline(expApogee), [expApogee]);

  const timeline = activeMode === 'exp' ? expTimeline : simTimeline;
  const secondaryTimeline = activeMode === 'both' ? expTimeline : null;

  const totalFlightDurationSec = useMemo(() => {
    const primaryLast = timeline.points[timeline.points.length - 1]?.t ?? 0;
    const secondaryLast = secondaryTimeline?.points[secondaryTimeline.points.length - 1]?.t ?? 0;
    return Math.max(primaryLast, secondaryLast);
  }, [timeline, secondaryTimeline]);

  useEffect(() => {
    onDurationChange?.(totalFlightDurationSec);
  }, [totalFlightDurationSec, onDurationChange]);

  const effectiveIsPlaying = syncEnabled && syncedIsPlaying !== undefined ? syncedIsPlaying : isPlaying;
  const effectiveSpeed = syncEnabled && syncedSpeed !== undefined ? syncedSpeed : speed;

  // High-precision continuous playback clock inside WebGL loop (eliminates post-apogee step lag & 60Hz React renders)
  const playbackTimeSecRef = useRef<number>(0);
  const speedRef = useRef<number>(effectiveSpeed);
  speedRef.current = effectiveSpeed;
  const syncEnabledRef = useRef<boolean>(syncEnabled);
  syncEnabledRef.current = syncEnabled;

  // Reset local playback when timeline changes
  useEffect(() => {
    setTimeIndex(0);
    setIsPlaying(false);
    playbackTimeSecRef.current = 0;
  }, [timeline]);

  useEffect(() => {
    if (syncEnabled && syncedTimeSec !== undefined) {
      playbackTimeSecRef.current = syncedTimeSec;
    }
  }, [syncEnabled, syncedTimeSec]);

  const effectiveTimeIndex = useMemo(() => {
    if (syncEnabled && syncedTimeSec !== undefined && timeline.points.length > 0) {
      return findTimelineIndexAtTime(timeline.points, syncedTimeSec);
    }
    return Math.min(Math.max(0, timeline.points.length - 1), timeIndex);
  }, [syncEnabled, syncedTimeSec, timeline.points, timeIndex]);

  const timeIndexRef = useRef<number>(0);
  timeIndexRef.current = effectiveTimeIndex;

  const handlePlayToggle = () => {
    if (syncEnabled && onSyncTogglePlay) {
      onSyncTogglePlay();
      return;
    }
    if (!isPlaying && timeline.points.length > 0) {
      const endT = timeline.points[timeline.points.length - 1]?.t ?? 0;
      if (effectiveTimeIndex >= timeline.points.length - 1 || playbackTimeSecRef.current >= endT - 1e-4) {
        playbackTimeSecRef.current = 0;
        setTimeIndex(0);
      }
    }
    setIsPlaying((p) => !p);
  };

  const seekToTimeIndex = (newIdx: number) => {
    const clamped = Math.max(0, Math.min(Math.max(0, timeline.points.length - 1), newIdx));
    const targetT = timeline.points[clamped]?.t ?? 0;
    if (syncEnabled && onSyncTimeChange && timeline.points.length > 0) {
      playbackTimeSecRef.current = targetT;
      onSyncTimeChange(targetT);
      return;
    }
    playbackTimeSecRef.current = targetT;
    setTimeIndex(clamped);
    setIsPlaying(false);
  };

  const handleSpeedUpdate = (newSpeed: number) => {
    if (syncEnabled && onSyncSpeedChange) {
      onSyncSpeedChange(newSpeed);
      return;
    }
    setSpeed(newSpeed);
  };

  // Three.js scene & live refs
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [webglRetryNonce, setWebglRetryNonce] = useState(0);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const isPlayingRef = useRef<boolean>(effectiveIsPlaying);
  isPlayingRef.current = effectiveIsPlaying;
  const propellantProfileRef = useRef(getPropellantVisualProfile(propellantType, lang || 'en', customPropellants));
  propellantProfileRef.current = getPropellantVisualProfile(propellantType, lang || 'en', customPropellants);

  const liveTimelineRef = useRef(timeline);
  liveTimelineRef.current = timeline;
  const liveSecondaryTimelineRef = useRef(secondaryTimeline);
  liveSecondaryTimelineRef.current = secondaryTimeline;

  const currentPointRef = useRef<TimelinePoint | null>(null);
  currentPointRef.current = timeline.points[effectiveTimeIndex] || null;

  const snapCameraRef = useRef<((mode: CameraMode) => void) | null>(null);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    snapCameraRef.current?.(cameraMode);
  }, [cameraMode]);

  const nozzleDtMm = nozzle?.Dt0 ?? Math.round((motor?.Dc ?? 60) * 0.25);
  const nozzleDsMm = nozzle?.Ds ?? Math.round((motor?.Dc ?? 60) * 0.6);
  const kProp = getPropellantData(propellantType, customPropellants).k || 1.2;
  const exitMach = useMemo(() => {
    const eps = Math.max(1.2, Math.pow(nozzleDsMm / Math.max(2, nozzleDtMm), 2));
    return getExitMach(eps, kProp);
  }, [nozzleDtMm, nozzleDsMm, kProp]);
  const exitMachRef = useRef(exitMach);
  exitMachRef.current = exitMach;
  const designExitPressureMPa = useMemo(() => {
    const p0 = avgChamberPressureMPa ?? 3.5;
    const pe = p0 * Math.pow(1 + ((kProp - 1) / 2) * exitMach * exitMach, -kProp / (kProp - 1));
    return Math.max(0.005, pe);
  }, [avgChamberPressureMPa, kProp, exitMach]);
  const designExitPressureRef = useRef(designExitPressureMPa);
  designExitPressureRef.current = designExitPressureMPa;

  // Build & manage Three.js Coastal Launch Complex + Broadcast Camera Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container || timeline.points.length === 0) return;

    setWebglError(null);

    const { isSoftwareGl } = detectSoftwareWebGL();
    const width = Math.max(300, container.clientWidth);
    const height = Math.max(280, container.clientHeight);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL 3D context unavailable');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(t?.flight_3d_unavail_title || 'WebGL context lost');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9ec5e8, 0.00014);

    // Procedural HDRI PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.25, 95000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.8;
    controls.maxDistance = 120000;
    controls.maxPolarAngle = Math.PI * 0.92;

    // 3-point atmospheric lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.78);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 2.25);
    sunLight.position.set(28, 36, -20);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 140;
      const d = 34;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    // 1. Dynamic Altitude Sky Dome
    const skyDome = createDynamicSkyDome();
    scene.add(skyDome.mesh);

    // 2. High-Altitude Starfield
    const starCount = isSoftwareGl ? 350 : 900;
    const starPos = new Float32Array(starCount * 3);
    let starSeed = 2026;
    const srand = () => {
      starSeed = (starSeed * 16807) % 2147483647;
      return (starSeed - 1) / 2147483646;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = srand() * Math.PI * 2;
      const phi = Math.acos(2 * srand() - 1);
      const r = 64000;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.85 + r * 0.05;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 220,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeom, starMat);
    starField.frustumCulled = false;
    scene.add(starField);

    // 3. Coastal Spaceport Environment: Cleared Launch Apron, Mountains (-X / +-Z), Animated Ocean (+X)
    const coastalEnv = buildCoastalRangeEnvironment(maxAnisotropy);
    scene.add(coastalEnv.root);

    // 4. Composite COHETEROS Aerospace Hangar with User Logo Signage
    const hangar = buildCoheterosHangar(maxAnisotropy);
    scene.add(hangar.root);

    // 5. Concrete Launch Pad Apron
    const padTex = createLaunchPadTexture();
    padTex.anisotropy = maxAnisotropy;
    const padMat = new THREE.MeshStandardMaterial({
      map: padTex,
      roughness: 0.82,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const padMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 0.24, 16), padMat);
    padMesh.position.set(1.2, 0.12, 0);
    padMesh.receiveShadow = true;
    scene.add(padMesh);

    // 6. Primary Parametric Rocket + Tilting TEL / Decotruck Launch Tower
    const rocketParts = buildParametricRocket3D(
      timeline.rocketDiameterM,
      nozzleDtMm,
      nozzleDsMm,
      activeMode === 'exp' ? 'exp' : 'sim'
    );
    const towerParts = buildTiltingTELTower(rocketParts.rocketLengthM, rocketParts.bodyRadiusM);
    towerParts.setTiltAngleDeg(timeline.flightPathAngleDeg);
    scene.add(towerParts.root);
    scene.add(rocketParts.root);

    towerParts.root.updateMatrixWorld(true);
    const padRocketOrigin = new THREE.Vector3(0, towerParts.rocketBaseOffsetAlongTower, 0).applyMatrix4(
      towerParts.strongbackPivot.matrixWorld
    );

    const beaconRingGeom = new THREE.RingGeometry(
      rocketParts.rocketLengthM * 0.6,
      rocketParts.rocketLengthM * 0.78,
      32
    );
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeom, beaconRingMat);
    rocketParts.root.add(beaconRing);

    // Primary Volumetric GLSL Plume + Light
    const plumeMatOuter = createPlumeShaderMaterial();
    const plumeMatCore = createPlumeShaderMaterial();
    plumeMatCore.uniforms.uOpacityScale.value = 1.25;

    const plumeGeomOuter = new THREE.CylinderGeometry(
      rocketParts.bodyRadiusM * 1.15,
      rocketParts.bodyRadiusM * 0.62,
      1.0,
      24,
      14,
      true
    );
    const plumeMeshOuter = new THREE.Mesh(plumeGeomOuter, plumeMatOuter);
    plumeMeshOuter.rotation.z = Math.PI;
    plumeMeshOuter.frustumCulled = false;
    plumeMeshOuter.visible = false;
    rocketParts.airframe.add(plumeMeshOuter);

    const plumeGeomCore = new THREE.CylinderGeometry(
      rocketParts.bodyRadiusM * 0.56,
      rocketParts.bodyRadiusM * 0.34,
      1.0,
      20,
      12,
      true
    );
    const plumeMeshCore = new THREE.Mesh(plumeGeomCore, plumeMatCore);
    plumeMeshCore.rotation.z = Math.PI;
    plumeMeshCore.frustumCulled = false;
    plumeMeshCore.visible = false;
    rocketParts.airframe.add(plumeMeshCore);

    const flameLight = new THREE.PointLight(0xff8c33, 0, 22, 1.5);
    flameLight.position.set(0, -rocketParts.bodyRadiusM * 1.5, 0);
    rocketParts.airframe.add(flameLight);

    // 7. Optional Secondary Experimental Ghost Rocket + Plume + Curve for Sim vs Exp mode
    const hasBoth = Boolean(activeMode === 'both' && secondaryTimeline && secondaryTimeline.points.length > 0);
    const expRocketParts = hasBoth
      ? buildParametricRocket3D(secondaryTimeline!.rocketDiameterM, nozzleDtMm, nozzleDsMm, 'exp')
      : null;
    let expPlumeMesh: THREE.Mesh | null = null;
    let expPlumeMat: THREE.ShaderMaterial | null = null;
    if (expRocketParts) {
      scene.add(expRocketParts.root);
      expPlumeMat = createPlumeShaderMaterial();
      expPlumeMat.uniforms.uOpacityScale.value = 0.78;
      const expPlumeGeom = new THREE.CylinderGeometry(
        expRocketParts.bodyRadiusM * 0.95,
        expRocketParts.bodyRadiusM * 0.5,
        1.0,
        20,
        10,
        true
      );
      expPlumeMesh = new THREE.Mesh(expPlumeGeom, expPlumeMat);
      expPlumeMesh.rotation.z = Math.PI;
      expPlumeMesh.frustumCulled = false;
      expPlumeMesh.visible = false;
      expRocketParts.airframe.add(expPlumeMesh);
    }

    // 8. 3D Volumetric Cloud Deck (scattered above coast & inland foothills)
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const cloudGeom = new THREE.SphereGeometry(1, 10, 8);
    const cloudCount = isSoftwareGl ? 10 : 22;
    const spanExtent = Math.max(900, timeline.maxApogee * 0.85);
    for (let c = 0; c < cloudCount; c++) {
      const cluster = new THREE.Group();
      const altC = 240 + srand() * Math.min(2600, Math.max(900, timeline.maxApogee * 0.85));
      const cx = (srand() - 0.25) * spanExtent * 1.7;
      const cz = (srand() - 0.5) * spanExtent * 1.4;
      const baseScale = 24 + srand() * 48;
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(cloudGeom, cloudMat);
        puff.position.set(
          (p - 1) * baseScale * 0.75,
          (srand() - 0.5) * baseScale * 0.25,
          (srand() - 0.5) * baseScale * 0.4
        );
        puff.scale.set(baseScale * (0.9 + srand() * 0.5), baseScale * 0.42, baseScale * 0.8);
        cluster.add(puff);
      }
      cluster.position.set(cx, altC, cz);
      cloudGroup.add(cluster);
    }
    scene.add(cloudGroup);

    // 9. 3D Trajectory Curves + Mission Milestone Beacons
    const trajPositions = new Float32Array(timeline.points.length * 3);
    let minX = 0;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < timeline.points.length; i++) {
      const pt = timeline.points[i];
      const wx = padRocketOrigin.x + pt.x;
      const wy = Math.max(0.05, padRocketOrigin.y + pt.h);
      trajPositions[i * 3] = wx;
      trajPositions[i * 3 + 1] = wy;
      trajPositions[i * 3 + 2] = padRocketOrigin.z;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy > maxY) maxY = wy;
    }

    const fullTrajGeom = new THREE.BufferGeometry();
    fullTrajGeom.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
    const fullTrajMat = new THREE.LineBasicMaterial({
      color: activeMode === 'exp' ? 0xa855f7 : 0x38bdf8,
      transparent: true,
      opacity: 0.45,
    });
    const fullTrajLine = new THREE.Line(fullTrajGeom, fullTrajMat);
    fullTrajLine.frustumCulled = false;
    scene.add(fullTrajLine);

    const flownTrajGeom = new THREE.BufferGeometry();
    flownTrajGeom.setAttribute('position', new THREE.BufferAttribute(trajPositions.slice(), 3));
    flownTrajGeom.setDrawRange(0, 1);
    const flownTrajMat = new THREE.LineBasicMaterial({
      color: activeMode === 'exp' ? 0xc084fc : 0xf59e0b,
      transparent: true,
      opacity: 0.96,
    });
    const flownTrajLine = new THREE.Line(flownTrajGeom, flownTrajMat);
    flownTrajLine.frustumCulled = false;
    scene.add(flownTrajLine);

    // Secondary Experimental trajectory line in Sim vs Exp mode (offset slightly on z=+0.15 for legibility)
    let expFlownGeom: THREE.BufferGeometry | null = null;
    if (hasBoth && secondaryTimeline) {
      const expPts = secondaryTimeline.points;
      const expPos = new Float32Array(expPts.length * 3);
      for (let i = 0; i < expPts.length; i++) {
        const pt = expPts[i];
        const wx = padRocketOrigin.x + pt.x;
        const wy = Math.max(0.05, padRocketOrigin.y + pt.h);
        expPos[i * 3] = wx;
        expPos[i * 3 + 1] = wy;
        expPos[i * 3 + 2] = padRocketOrigin.z + 0.18;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
      }
      const expFullGeom = new THREE.BufferGeometry();
      expFullGeom.setAttribute('position', new THREE.BufferAttribute(expPos, 3));
      const expFullLine = new THREE.Line(
        expFullGeom,
        new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.45 })
      );
      expFullLine.frustumCulled = false;
      scene.add(expFullLine);

      expFlownGeom = new THREE.BufferGeometry();
      expFlownGeom.setAttribute('position', new THREE.BufferAttribute(expPos.slice(), 3));
      expFlownGeom.setDrawRange(0, 1);
      const expFlownLine = new THREE.Line(
        expFlownGeom,
        new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.95 })
      );
      expFlownLine.frustumCulled = false;
      scene.add(expFlownLine);
    }

    // 3D Milestone Marker Rings (MAX-Q, MACH 1, BURNOUT, APOGEE) along trajectory curve
    const markerScale = Math.max(1.0, maxY * 0.016);
    const milestoneMeshes: THREE.Mesh[] = [];
    for (const m of timeline.milestones) {
      const ringGeom = new THREE.TorusGeometry(
        m.id === 'apogee' ? markerScale * 1.15 : markerScale * 0.72,
        markerScale * 0.11,
        10,
        24
      );
      ringGeom.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: m.colorHex,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(padRocketOrigin.x + m.x, padRocketOrigin.y + m.h, padRocketOrigin.z);
      scene.add(ring);
      milestoneMeshes.push(ring);
    }

    // 10. Dual Soft Particle Pools (Launch Pad Smoke + In-Flight Trail)
    const particleTex = createSoftParticleTexture();
    const makeParticlePool = (count: number, size: number) => {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) pos[i * 3 + 1] = -9999;
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        map: particleTex,
        size,
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const pts = new THREE.Points(geom, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      return {
        geom,
        mat,
        pts,
        count,
        vel: new Float32Array(count * 3),
        age: new Float32Array(count).fill(999),
        life: new Float32Array(count).fill(1),
        cursor: 0,
      };
    };

    const padSmokePool = makeParticlePool(isSoftwareGl ? 60 : 140, Math.max(1.8, rocketParts.bodyRadiusM * 26));
    const trailSmokePool = makeParticlePool(isSoftwareGl ? 90 : 220, Math.max(0.85, rocketParts.bodyRadiusM * 14));

    // Pre-allocated vectors for GC-free render loop
    const lastTrackedRocketPos = padRocketOrigin.clone();
    const rocketWorldPos = padRocketOrigin.clone();
    const expRocketWorldPos = padRocketOrigin.clone();
    const _localAxis = new THREE.Vector3();
    const _nozzleWorld = new THREE.Vector3();
    const _deltaPos = new THREE.Vector3();
    const _onboardCamPos = new THREE.Vector3();
    const _onboardLookPos = new THREE.Vector3();
    const _onboardUp = new THREE.Vector3();
    const _padTarget = new THREE.Vector3();
    const _padCurrentAim = new THREE.Vector3();
    let padFovOffset = 0;
    let simAnimTime = 0;

    const handlePadWheel = (e: WheelEvent) => {
      if (cameraModeRef.current !== 'pad') return;
      e.preventDefault();
      padFovOffset = THREE.MathUtils.clamp(padFovOffset + Math.sign(e.deltaY) * 2.5, -24, 22);
    };
    renderer.domElement.addEventListener('wheel', handlePadWheel, { passive: false });

    const clearParticlePool = (pool: typeof padSmokePool) => {
      const posArr = pool.geom.attributes.position.array as Float32Array;
      let changed = false;
      for (let i = 0; i < pool.count; i++) {
        if (pool.age[i] < pool.life[i] || posArr[i * 3 + 1] > -9000) {
          pool.age[i] = 999;
          posArr[i * 3 + 1] = -9999;
          changed = true;
        }
      }
      if (changed) pool.geom.attributes.position.needsUpdate = true;
    };

    const applyOnboardCameraPose = (pt: TimelinePoint, animSec: number) => {
      const rLen = rocketParts.rocketLengthM;
      const bodyR = rocketParts.bodyRadiusM;
      const vib = pt.thrusting && isPlayingRef.current ? Math.sin(animSec * 78) * bodyR * 0.04 : 0;

      // Mounted on -Z/back-left fuselage collar looking down along fins, exhaust plume, TEL pad, COHETEROS Hangar, mountains & sea!
      _onboardCamPos.set(-bodyR * 0.85 + vib, rLen * 0.78, -bodyR * 1.55);
      _onboardCamPos.applyEuler(rocketParts.root.rotation).add(rocketParts.root.position);

      _onboardLookPos.set(bodyR * 0.45, -rLen * 2.4, bodyR * 0.25);
      _onboardLookPos.applyEuler(rocketParts.root.rotation).add(rocketParts.root.position);

      _onboardUp.set(-0.22, 0, -0.98).normalize().applyEuler(rocketParts.root.rotation);

      camera.position.copy(_onboardCamPos);
      camera.up.copy(_onboardUp);
      camera.lookAt(_onboardLookPos);

      const targetFov = Math.min(72, 56 + pt.mach * 8);
      if (Math.abs(camera.fov - targetFov) > 0.2 || Math.abs(camera.near - 0.08) > 0.02) {
        camera.fov = targetFov;
        camera.near = 0.08;
        camera.updateProjectionMatrix();
      }
    };

    const snapCamera = (mode: CameraMode) => {
      const rLen = rocketParts.rocketLengthM;
      const cur = { ...(currentPointRef.current || timeline.points[0]) };
      if (timeline.points.length > 0) {
        sampleInterpolatedPoint(timeline.points, playbackTimeSecRef.current, cur);
      }
      const groundClear = padRocketOrigin.y;
      rocketWorldPos.set(padRocketOrigin.x + cur.x, groundClear + cur.h, padRocketOrigin.z);

      if (mode === 'onboard') {
        controls.enabled = false;
        rocketParts.root.position.copy(rocketWorldPos);
        rocketParts.root.rotation.set(0, 0, cur.pitchRad - Math.PI / 2);
        applyOnboardCameraPose(cur, simAnimTime);
        return;
      }

      if (mode === 'pad') {
        // Ground tripod planted near pad framing TEL launch ramp, rocket & COHETEROS Hangar backdrop, aiming up at rocket
        controls.enabled = false;
        padFovOffset = 0;
        camera.up.set(0, 1, 0);
        camera.position.set(14.5, 2.3, 18.0);
        const padBlend = cur.h < 10 ? 1 - cur.h / 10 : 0;
        _padCurrentAim.set(
          rocketWorldPos.x - 1.1 * padBlend,
          rocketWorldPos.y + rLen * 0.45,
          rocketWorldPos.z - 1.2 * padBlend
        );
        camera.lookAt(_padCurrentAim);
        const dist = camera.position.distanceTo(rocketWorldPos);
        camera.fov = THREE.MathUtils.clamp(46 - Math.max(0, dist - 28) * 0.022, 12, 58);
        camera.near = 0.35;
        camera.updateProjectionMatrix();
        return;
      }

      // Restore upright world-up and OrbitControls for Chase and Trajectory Arc cameras
      controls.enabled = true;
      camera.up.set(0, 1, 0);
      if (Math.abs(camera.fov - 48) > 0.2) {
        camera.fov = 48;
      }

      if (mode === 'arc') {
        const midX = (minX + maxX) * 0.5;
        const midY = Math.max(4, maxY * 0.45);
        const span = Math.max(28, maxX - minX, maxY * 1.35);
        controls.target.set(midX, midY, 0);
        camera.position.set(midX - span * 0.08, midY + span * 0.26, span * 1.18);
        const distToMid = camera.position.distanceTo(controls.target);
        camera.near = THREE.MathUtils.clamp(distToMid * 0.02, 0.5, 12.0);
      } else {
        // 'chase': close 3/4 view anchored to rocket looking slightly seaward (+X) & toward Hangar (-X/-Z)
        const targetPos = rocketWorldPos.clone().add(new THREE.Vector3(0, rLen * 0.45, 0));
        controls.target.copy(targetPos);
        camera.position.copy(targetPos).add(new THREE.Vector3(-rLen * 2.1 - 1.2, rLen * 0.65, rLen * 2.6 + 1.6));
        lastTrackedRocketPos.copy(rocketWorldPos);
        const distToRocket = camera.position.distanceTo(rocketWorldPos);
        camera.near = THREE.MathUtils.clamp(distToRocket * 0.14, 0.25, 1.8);
      }
      camera.updateProjectionMatrix();
      controls.update();
    };

    snapCameraRef.current = snapCamera;
    snapCamera(cameraModeRef.current);

    let resizeRafId: number | null = null;
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (!last) return;
      const w = Math.max(300, last.contentRect.width);
      const h = Math.max(280, last.contentRect.height);
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        if (disposed) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
    });
    ro.observe(container);

    let animRafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let prevMs = performance.now();
    let lastHudSyncMs = 0;
    let lastHudSyncedIdx = -1;

    const pt: TimelinePoint = { ...(timeline.points[0]) };
    const expPtScratch: TimelinePoint = { ...(secondaryTimeline?.points[0] ?? timeline.points[0]) };

    const afterDraw = (cb: FrameRequestCallback) => {
      if (isSoftwareGl) {
        timeoutId = setTimeout(() => {
          if (!disposed) animRafId = requestAnimationFrame(cb);
        }, 42);
      } else {
        animRafId = requestAnimationFrame(cb);
      }
    };

    const renderLoop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.08, Math.max(0.001, (now - prevMs) / 1000));
      prevMs = now;
      const playingNow = isPlayingRef.current;
      if (playingNow) {
        simAnimTime += dt;
      }

      coastalEnv.oceanTimeUniform.value = simAnimTime;

      const tl = liveTimelineRef.current;
      if (!tl.points || tl.points.length === 0) {
        afterDraw(renderLoop);
        return;
      }

      const endT = tl.points[tl.points.length - 1].t;
      if (playingNow && !syncEnabledRef.current && tl.points.length > 1) {
        playbackTimeSecRef.current = Math.min(endT, playbackTimeSecRef.current + dt * speedRef.current);
      }

      const ptIdx = sampleInterpolatedPoint(tl.points, playbackTimeSecRef.current, pt);

      if (playingNow && !syncEnabledRef.current) {
        if (playbackTimeSecRef.current >= endT - 1e-5) {
          const lastIdx = tl.points.length - 1;
          isPlayingRef.current = false;
          lastHudSyncedIdx = lastIdx;
          lastHudSyncMs = now;
          timeIndexRef.current = lastIdx;
          setTimeIndex(lastIdx);
          setIsPlaying(false);
        } else if (now - lastHudSyncMs >= 70 && ptIdx !== lastHudSyncedIdx) {
          lastHudSyncMs = now;
          lastHudSyncedIdx = ptIdx;
          timeIndexRef.current = ptIdx;
          setTimeIndex(ptIdx);
        }
      }

      if (!playingNow && pt.t <= 0.002) {
        clearParticlePool(padSmokePool);
        clearParticlePool(trailSmokePool);
      }

      const prof = propellantProfileRef.current;

      // 1. Update Primary Rocket World Position & Orientation
      const inChutePhase = pt.phase === 'drogue' || pt.phase === 'main' || pt.phase === 'descent';
      const groundClear =
        pt.t <= tl.burnoutTime || pt.h >= 20
          ? padRocketOrigin.y
          : inChutePhase || pt.phase === 'landed'
          ? padRocketOrigin.y * Math.min(1, pt.h / 20) + 0.04
          : padRocketOrigin.y;

      rocketWorldPos.set(padRocketOrigin.x + pt.x, groundClear + pt.h, padRocketOrigin.z);
      rocketParts.root.position.copy(rocketWorldPos);

      const chuteTotal = Math.max(pt.drogueOpen, pt.mainOpen);
      const swayZ = inChutePhase ? Math.sin(simAnimTime * 2.1) * 0.075 * chuteTotal : 0;
      const swayX = inChutePhase ? Math.cos(simAnimTime * 1.65) * 0.055 * chuteTotal : 0;
      rocketParts.root.rotation.set(swayX, 0, pt.pitchRad - Math.PI / 2 + swayZ);

      if (cameraModeRef.current === 'arc') {
        const arcBooster = Math.min(18, Math.max(1, maxY / 95));
        rocketParts.root.scale.setScalar(arcBooster);
        beaconRing.visible = maxY > 50;
        beaconRingMat.opacity = 0.55 + 0.25 * Math.sin(simAnimTime * 4.5);
        beaconRing.lookAt(camera.position);
      } else {
        rocketParts.root.scale.setScalar(1);
        beaconRing.visible = false;
      }

      // Independent 3D Drogue & Main canopies
      if (pt.drogueOpen > 0.02) {
        rocketParts.drogueGroup.visible = true;
        rocketParts.drogueGroup.scale.set(
          0.14 + 0.86 * pt.drogueOpen,
          0.24 + 0.76 * pt.drogueOpen,
          0.14 + 0.86 * pt.drogueOpen
        );
        rocketParts.drogueGroup.rotation.y = simAnimTime * 0.65;
      } else {
        rocketParts.drogueGroup.visible = false;
      }

      if (pt.mainOpen > 0.02) {
        rocketParts.parachuteGroup.visible = true;
        rocketParts.parachuteGroup.scale.set(
          0.12 + 0.88 * pt.mainOpen,
          0.22 + 0.78 * pt.mainOpen,
          0.12 + 0.88 * pt.mainOpen
        );
        rocketParts.parachuteGroup.rotation.y = simAnimTime * 0.4;
      } else {
        rocketParts.parachuteGroup.visible = false;
      }

      // 2. Update Secondary Experimental Rocket if Sim vs Exp comparison is active
      const secTl = liveSecondaryTimelineRef.current;
      let expPt: TimelinePoint | null = null;
      if (expRocketParts && secTl && secTl.points.length > 0) {
        sampleInterpolatedPoint(secTl.points, pt.t, expPtScratch);
        expPt = expPtScratch;
        const expInChute = expPt.phase === 'drogue' || expPt.phase === 'main' || expPt.phase === 'descent';
        const expGroundClear =
          expPt.t <= secTl.burnoutTime || expPt.h >= 20
            ? padRocketOrigin.y
            : expInChute || expPt.phase === 'landed'
            ? padRocketOrigin.y * Math.min(1, expPt.h / 20) + 0.04
            : padRocketOrigin.y;
        expRocketWorldPos.set(padRocketOrigin.x + expPt.x, expGroundClear + expPt.h, padRocketOrigin.z + 0.22);
        expRocketParts.root.position.copy(expRocketWorldPos);
        const expChuteTotal = Math.max(expPt.drogueOpen, expPt.mainOpen);
        const eSwayZ = expInChute ? Math.sin(simAnimTime * 2.0 + 1.1) * 0.075 * expChuteTotal : 0;
        const eSwayX = expInChute ? Math.cos(simAnimTime * 1.7) * 0.055 * expChuteTotal : 0;
        expRocketParts.root.rotation.set(eSwayX, 0, expPt.pitchRad - Math.PI / 2 + eSwayZ);
        expRocketParts.root.scale.setScalar(
          cameraModeRef.current === 'arc' ? Math.min(18, Math.max(1, maxY / 95)) : 1
        );

        if (expPt.drogueOpen > 0.02) {
          expRocketParts.drogueGroup.visible = true;
          expRocketParts.drogueGroup.scale.set(
            0.14 + 0.86 * expPt.drogueOpen,
            0.24 + 0.76 * expPt.drogueOpen,
            0.14 + 0.86 * expPt.drogueOpen
          );
          expRocketParts.drogueGroup.rotation.y = simAnimTime * 0.65;
        } else {
          expRocketParts.drogueGroup.visible = false;
        }

        if (expPt.mainOpen > 0.02) {
          expRocketParts.parachuteGroup.visible = true;
          expRocketParts.parachuteGroup.scale.set(
            0.12 + 0.88 * expPt.mainOpen,
            0.22 + 0.78 * expPt.mainOpen,
            0.12 + 0.88 * expPt.mainOpen
          );
          expRocketParts.parachuteGroup.rotation.y = simAnimTime * 0.4;
        } else {
          expRocketParts.parachuteGroup.visible = false;
        }

        if (expPlumeMesh && expPlumeMat) {
          const expThrustActive = expPt.thrusting && (expPt.h > 0 || expPt.t > 0 || playingNow);
          if (expThrustActive) {
            const pLen = expRocketParts.bodyRadiusM * (5.2 + 3.2) * (0.9 + 0.1 * Math.sin(simAnimTime * 38));
            expPlumeMesh.visible = true;
            expPlumeMesh.scale.set(1.0, pLen, 1.0);
            expPlumeMesh.position.set(0, -pLen * 0.5, 0);
            expPlumeMat.uniforms.uTime.value = simAnimTime;
            expPlumeMat.uniforms.uThrust.value = 1.0;
            expPlumeMat.uniforms.uFlameColor.value.setHex(0x2dd4bf);
            expPlumeMat.uniforms.uCoreColor.value.setHex(0xffffff);
            expPlumeMat.uniforms.uDiamondColor.value.setHex(0xa855f7);
            expPlumeMat.uniforms.uHasDiamonds.value = 0.6;
            expPlumeMat.uniforms.uMachExit.value = exitMachRef.current;
          } else {
            expPlumeMesh.visible = false;
          }
        }
      }

      // TEL umbilical clamp release once ascending above pad
      const clampFrac = pt.phase === 'pad' ? 0 : Math.min(1, Math.max(0, (pt.h - 0.15) / 1.8));
      towerParts.setClampOpenFraction(clampFrac);

      // 3. Broadcast Camera Positioning / Tracking + Safe Distance-Aware Near Plane
      const camMode = cameraModeRef.current;
      if (camMode === 'onboard') {
        applyOnboardCameraPose(pt, simAnimTime);
      } else if (camMode === 'pad') {
        // Keep tripod planted on ground near launch ramp looking upward toward rocket
        camera.position.set(14.5, 2.3, 18.0);
        camera.up.set(0, 1, 0);
        const padBlend = pt.h < 10 ? 1 - pt.h / 10 : 0;
        _padTarget.set(
          rocketWorldPos.x - 1.1 * padBlend,
          rocketWorldPos.y + rocketParts.rocketLengthM * 0.45,
          rocketWorldPos.z - 1.2 * padBlend
        );
        _padCurrentAim.lerp(_padTarget, Math.min(1, dt * 14));
        camera.lookAt(_padCurrentAim);

        const distToRocket = camera.position.distanceTo(rocketWorldPos);
        const padFov = THREE.MathUtils.clamp(46 - Math.max(0, distToRocket - 28) * 0.022 + padFovOffset, 10, 62);
        if (Math.abs(camera.fov - padFov) > 0.2 || Math.abs(camera.near - 0.35) > 0.02) {
          camera.fov = padFov;
          camera.near = 0.35;
          camera.updateProjectionMatrix();
        }
      } else {
        if (camMode === 'chase') {
          _deltaPos.subVectors(rocketWorldPos, lastTrackedRocketPos);
          if (_deltaPos.lengthSq() > 1e-8) {
            camera.position.add(_deltaPos);
            controls.target.add(_deltaPos);
          }
          lastTrackedRocketPos.copy(rocketWorldPos);
        }
        controls.update();

        // Keep exterior cameras safely above ground terrain
        if (camera.position.y < 0.6) {
          camera.position.y = 0.6;
        }

        // Compute near plane from distance to rocket/target (never from altitude Y, which clipped the rocket >1100m!)
        const distToTarget =
          camMode === 'chase'
            ? Math.max(0.8, camera.position.distanceTo(rocketWorldPos))
            : Math.max(5.0, camera.position.distanceTo(controls.target));
        const desiredNear =
          camMode === 'chase'
            ? THREE.MathUtils.clamp(distToTarget * 0.14, 0.25, 1.8)
            : THREE.MathUtils.clamp(distToTarget * 0.02, 0.5, 12.0);
        if (Math.abs(camera.near - desiredNear) > Math.max(0.08, camera.near * 0.15)) {
          camera.near = desiredNear;
          camera.updateProjectionMatrix();
        }
      }

      // 4. Dynamic Altitude Sky, Fog & Stars
      const absAlt = tl.launchAltitudeM + pt.h;
      const atmo = sampleAltitudeAtmosphere(absAlt);
      skyDome.mesh.position.copy(camera.position);
      starField.position.copy(camera.position);
      skyDome.material.uniforms.uZenithColor.value.copy(atmo.zenith);
      skyDome.material.uniforms.uHorizonColor.value.copy(atmo.horizon);
      skyDome.material.uniforms.uGroundColor.value.copy(atmo.ground);
      skyDome.material.uniforms.uSpaceFactor.value = atmo.spaceFactor;
      starMat.opacity = atmo.starOpacity;
      (scene.fog as THREE.FogExp2).color.copy(atmo.horizon);
      (scene.fog as THREE.FogExp2).density = 0.00014 * (1 - atmo.spaceFactor * 0.9);
      hemiLight.color.copy(atmo.horizon);
      cloudMat.opacity = Math.max(0, 0.72 * (1 - atmo.spaceFactor * 1.4));

      // 5. Trajectory Drawn Progress + Milestone Ring Rotation
      const drawVertCount = Math.max(1, Math.min(tl.points.length, ptIdx + 2));
      flownTrajGeom.setDrawRange(0, drawVertCount);
      if (expFlownGeom && secTl && expPt) {
        const expDrawCount = Math.max(
          1,
          Math.min(secTl.points.length, findTimelineIndexAtTime(secTl.points, pt.t) + 2)
        );
        expFlownGeom.setDrawRange(0, expDrawCount);
      }
      for (const mMesh of milestoneMeshes) {
        mMesh.rotation.y = simAnimTime * 0.9;
      }

      // 6. Exhaust Plume & Particle Systems (Particles ONLY emit and advance when playingNow === true!)
      const thrustActive = pt.thrusting && (pt.h > 0 || pt.t > 0 || playingNow);
      if (thrustActive) {
        const isApcp = prof.category === 'apcp';
        const isRnx = prof.category === 'rnx';
        const flameMult = isApcp ? 1.65 : isRnx ? 0.65 : 0.78;
        const plumeLen =
          rocketParts.bodyRadiusM * (5.2 + flameMult * 4.5) * (0.9 + 0.1 * Math.sin(simAnimTime * 42));
        const plumeRad = 1.0 + Math.min(0.85, pt.h / 18000);

        plumeMeshOuter.visible = true;
        plumeMeshOuter.scale.set(plumeRad, plumeLen, plumeRad);
        plumeMeshOuter.position.set(0, -plumeLen * 0.5, 0);

        plumeMeshCore.visible = true;
        plumeMeshCore.scale.set(plumeRad * 0.88, plumeLen * 0.62, plumeRad * 0.88);
        plumeMeshCore.position.set(0, -plumeLen * 0.31, 0);

        const pAmbAtAlt = Math.max(0.0005, computeStandardAtmosphere(tl.launchAltitudeM + pt.h).pressurePa / 1e6);
        const pePa = Math.min(2.6, Math.max(0.35, designExitPressureRef.current / pAmbAtAlt));
        const flameHex = isApcp ? 0xf97316 : prof.flameColorThree;
        const diamondHex = isApcp ? 0x38bdf8 : 0xfef08a;
        const smokeOpacityBase = prof.isSmoky ? (isRnx ? 0.8 : 0.65) : 0.4;
        const plumeOpacityScale = isApcp ? 1.0 : isRnx ? 0.55 : 0.65;

        for (const pm of [plumeMatOuter, plumeMatCore]) {
          pm.uniforms.uTime.value = simAnimTime;
          pm.uniforms.uThrust.value = 1.0;
          pm.uniforms.uFlameColor.value.setHex(flameHex);
          pm.uniforms.uCoreColor.value.setHex(0xffffff);
          pm.uniforms.uDiamondColor.value.setHex(diamondHex);
          pm.uniforms.uHasDiamonds.value = prof.hasDiamonds ? 1.0 : 0.35;
          pm.uniforms.uPePaRatio.value = pePa;
          pm.uniforms.uMachExit.value = exitMachRef.current;
          pm.uniforms.uOpacityScale.value = pm === plumeMatCore ? plumeOpacityScale * 1.2 : plumeOpacityScale;
        }
        flameLight.intensity = 5.5 + Math.sin(simAnimTime * 36) * 1.5;
        flameLight.color.setHex(flameHex);

        if (playingNow) {
          _localAxis.set(0, -1, 0).applyEuler(rocketParts.root.rotation).normalize();
          _nozzleWorld.copy(rocketWorldPos);

          trailSmokePool.mat.color.setHex(prof.smokeColorThree);
          trailSmokePool.mat.opacity = smokeOpacityBase * 0.68;
          const spawnTrailCount = isSoftwareGl ? 1 : 2;
          for (let k = 0; k < spawnTrailCount; k++) {
            const i = trailSmokePool.cursor;
            trailSmokePool.cursor = (trailSmokePool.cursor + 1) % trailSmokePool.count;
            const posArr = trailSmokePool.geom.attributes.position.array as Float32Array;
            posArr[i * 3] = _nozzleWorld.x + (Math.random() - 0.5) * rocketParts.bodyRadiusM * 1.4;
            posArr[i * 3 + 1] = Math.max(0.25, _nozzleWorld.y + (Math.random() - 0.5) * rocketParts.bodyRadiusM * 1.4);
            posArr[i * 3 + 2] = _nozzleWorld.z + (Math.random() - 0.5) * rocketParts.bodyRadiusM * 1.4;
            const ejectSpeed = 6 + Math.random() * 6;
            trailSmokePool.vel[i * 3] = _localAxis.x * ejectSpeed + (Math.random() - 0.5) * 2.2;
            trailSmokePool.vel[i * 3 + 1] = _localAxis.y * ejectSpeed + (Math.random() - 0.5) * 1.5;
            trailSmokePool.vel[i * 3 + 2] = _localAxis.z * ejectSpeed + (Math.random() - 0.5) * 2.2;
            trailSmokePool.age[i] = 0;
            trailSmokePool.life[i] = 1.6 + Math.random() * 1.6;
          }

          if (pt.h < 35) {
            padSmokePool.mat.color.setHex(prof.smokeColorThree);
            padSmokePool.mat.opacity = Math.max(0.15, (1 - pt.h / 35) * smokeOpacityBase * 0.85);
            const spawnPadCount = isSoftwareGl ? 2 : 4;
            for (let k = 0; k < spawnPadCount; k++) {
              const i = padSmokePool.cursor;
              padSmokePool.cursor = (padSmokePool.cursor + 1) % padSmokePool.count;
              const posArr = padSmokePool.geom.attributes.position.array as Float32Array;
              const angle = Math.random() * Math.PI * 2;
              const radialSpeed = 4.5 + Math.random() * 7.5;
              posArr[i * 3] = padRocketOrigin.x + Math.cos(angle) * 0.45;
              posArr[i * 3 + 1] = 0.35 + Math.random() * 0.45;
              posArr[i * 3 + 2] = padRocketOrigin.z + Math.sin(angle) * 0.45;
              padSmokePool.vel[i * 3] = Math.cos(angle) * radialSpeed;
              padSmokePool.vel[i * 3 + 1] = 0.8 + Math.random() * 2.2;
              padSmokePool.vel[i * 3 + 2] = Math.sin(angle) * radialSpeed;
              padSmokePool.age[i] = 0;
              padSmokePool.life[i] = 1.5 + Math.random() * 1.4;
            }
          }
        }
      } else {
        plumeMeshOuter.visible = false;
        plumeMeshCore.visible = false;
        flameLight.intensity = 0;
      }

      if (playingNow) {
        for (const pool of [padSmokePool, trailSmokePool]) {
          const posArr = pool.geom.attributes.position.array as Float32Array;
          let touched = false;
          for (let i = 0; i < pool.count; i++) {
            if (pool.age[i] < pool.life[i]) {
              pool.age[i] += dt;
              const drag = Math.exp(-dt * 1.2);
              pool.vel[i * 3] *= drag;
              pool.vel[i * 3 + 1] = pool.vel[i * 3 + 1] * drag + 0.65 * dt;
              pool.vel[i * 3 + 2] *= drag;
              posArr[i * 3] += pool.vel[i * 3] * dt;
              posArr[i * 3 + 1] = Math.max(0.2, posArr[i * 3 + 1] + pool.vel[i * 3 + 1] * dt);
              posArr[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
              if (pool.age[i] >= pool.life[i]) {
                posArr[i * 3 + 1] = -9999;
              }
              touched = true;
            }
          }
          if (touched) {
            pool.geom.attributes.position.needsUpdate = true;
          }
        }
      }

      renderer.render(scene, camera);
      afterDraw(renderLoop);
    };

    animRafId = requestAnimationFrame(renderLoop);

    return () => {
      disposed = true;
      cancelAnimationFrame(animRafId);
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      if (timeoutId) clearTimeout(timeoutId);
      renderer.domElement.removeEventListener('wheel', handlePadWheel);
      ro.disconnect();
      controls.dispose();
      envRT.dispose();

      disposeObject3D(scene);
      coastalEnv.textures.forEach((tx) => tx.dispose());
      hangar.textures.forEach((tx) => tx.dispose());
      padTex.dispose();
      particleTex.dispose();
      rocketParts.textures.forEach((tx) => tx.dispose());
      expRocketParts?.textures.forEach((tx) => tx.dispose());
      plumeMatOuter.dispose();
      plumeMatCore.dispose();
      expPlumeMat?.dispose();
      skyDome.material.dispose();

      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [timeline, secondaryTimeline, activeMode, nozzleDtMm, nozzleDsMm, motor?.Pamb, webglRetryNonce]);

  if (!simApogee && !expApogee) return null;

  const currentPt = timeline.points[effectiveTimeIndex] || timeline.points[0];
  const tCurrent = currentPt?.t ?? 0;
  const altCurrent = currentPt?.h ?? 0;
  const rangeCurrent = currentPt?.x ?? 0;
  const vCurrent = currentPt?.v ?? 0;
  const aCurrent = currentPt?.a ?? 0;
  const machCurrent = currentPt?.mach ?? 0;
  const pitchDegCurrent = currentPt?.gammaDeg ?? timeline.flightPathAngleDeg;
  const phase = currentPt?.phase ?? 'pad';

  const expPtHud =
    activeMode === 'both' && secondaryTimeline && secondaryTimeline.points.length > 0
      ? secondaryTimeline.points[findTimelineIndexAtTime(secondaryTimeline.points, tCurrent)]
      : null;

  const activeMilestones = timeline.milestones
    .filter((m) => Math.abs(tCurrent - m.t) <= 0.45 && tCurrent > 0.02)
    .slice(0, 2);

  const phaseLabel =
    phase === 'pad'
      ? t?.flight_phase_pad || 'EN TORRE TEL'
      : phase === 'powered'
      ? t?.flight_phase_powered || 'ASCENSO PROPULSADO'
      : phase === 'coast'
      ? t?.flight_phase_coast || 'VUELO INERCIAL'
      : phase === 'drogue'
      ? t?.flight_phase_drogue || 'DESCENSO DROGUE'
      : phase === 'main'
      ? t?.flight_phase_main || 'PARACAÍDAS PRINCIPAL'
      : phase === 'descent'
      ? t?.flight_phase_descent || 'APERTURA PARACAÍDAS'
      : t?.flight_phase_landed || 'ATERRIZAJE';

  const phaseDotClass =
    phase === 'powered'
      ? 'bg-orange-500'
      : phase === 'coast'
      ? 'bg-emerald-400'
      : phase === 'drogue'
      ? 'bg-amber-400'
      : phase === 'main' || phase === 'descent'
      ? 'bg-emerald-400'
      : phase === 'landed'
      ? 'bg-sky-400'
      : 'bg-amber-400';

  const maxIdx = Math.max(1, timeline.points.length - 1);

  return (
    <Card className="bg-slate-950 border-slate-800 shadow-xl flex flex-col h-full overflow-hidden min-h-[480px]">
      <CardHeader className="py-2 px-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-sky-400" />
          <CardTitle className="text-xs uppercase text-slate-200 font-mono font-bold tracking-wider whitespace-nowrap">
            {t?.flight_sim || 'Simulación 3D • Vuelo'}
          </CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Broadcast Camera Modes */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setCameraMode('chase')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                cameraMode === 'chase' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rocket size={11} />
              <span>{t?.flight_cam_chase || 'Seguir'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('onboard')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                cameraMode === 'onboard' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={11} />
              <span>{t?.flight_cam_onboard || 'A Bordo'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('pad')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                cameraMode === 'pad' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video size={11} />
              <span>{t?.flight_cam_pad || 'Pad Cam'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('arc')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                cameraMode === 'arc' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass size={11} />
              <span>{t?.flight_cam_arc || 'Trayectoria'}</span>
            </button>
          </div>

          {/* Flight Dataset Mode: Simulado / Experimental / Sim vs Exp */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={activeMode === 'sim' ? 'default' : 'outline'}
              disabled={!simApogee}
              onClick={() => setActiveMode('sim')}
              className={`h-6 text-[10px] px-2 font-mono font-bold whitespace-nowrap ${
                activeMode === 'sim'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {t?.simulated || 'Sim'}
            </Button>
            <Button
              size="sm"
              variant={activeMode === 'exp' ? 'default' : 'outline'}
              disabled={!expApogee}
              onClick={() => setActiveMode('exp')}
              className={`h-6 text-[10px] px-2 font-mono font-bold whitespace-nowrap ${
                activeMode === 'exp'
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {t?.experimental || 'Exp'}
            </Button>
            <Button
              size="sm"
              variant={activeMode === 'both' ? 'default' : 'outline'}
              disabled={!simApogee || !expApogee}
              title={!expApogee ? t?.flight_mode_both_hint || 'Load experimental data in Mission Control' : ''}
              onClick={() => setActiveMode('both')}
              className={`h-6 text-[10px] px-2 font-mono font-bold gap-1 whitespace-nowrap ${
                activeMode === 'both'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <GitCompare size={11} />
              <span>{t?.flight_mode_both || 'Sim vs Exp'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 relative bg-slate-950 overflow-hidden min-h-[340px]">
        {/* Isolated empty Three.js WebGL host container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {webglError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6">
            <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{t?.flight_3d_unavail_title || '3D Flight View Unavailable'}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t?.flight_3d_unavail_desc || 'WebGL could not be initialized on this device. The simulator and apogee analysis remain operational.'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 break-words">{webglError}</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setWebglRetryNonce((n) => n + 1)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>{t?.retry_3d_btn || 'Retry 3D'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Flight Phase & Active Milestone Callout (opaque slate over WebGL, zero backdrop-blur) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-950/95 px-3 py-1.5 rounded-lg border border-slate-800 shadow-xl font-mono text-[11px] font-bold text-slate-100">
            <div className={`w-2 h-2 rounded-full ${phaseDotClass}`} />
            <span>{phaseLabel}</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-300">{timeline.flightPathAngleDeg.toFixed(1)}°</span>
          </div>

          {activeMilestones.map((am) => (
            <div
              key={`callout-${am.id}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-slate-950/95 font-mono text-[10px] font-bold shadow-lg ${am.badgeBg} ${am.badgeText}`}
            >
              <Flag size={11} />
              <span>{t?.[am.labelKey] || am.fallbackLabel}</span>
              <span className="text-slate-400">·</span>
              <span className="text-white">{am.detail}</span>
            </div>
          ))}
        </div>

        {/* High-Contrast Telemetry Card (with live Sim vs Exp delta when both active) */}
        <div className="absolute top-3 right-3 z-20 font-mono text-xs bg-slate-950/95 p-3 rounded-lg border border-slate-800 shadow-2xl space-y-1.5 min-w-[178px] pointer-events-none">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 text-[11px]">
            <span>T+</span>
            <span className="font-bold text-white tabular-nums">{tCurrent.toFixed(2)} s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">ALT:</span>
            <span className="text-sky-300 font-bold text-sm tabular-nums">{altCurrent.toFixed(1)} m</span>
          </div>
          {expPtHud && (
            <div className="flex items-center justify-between text-[10px] border-t border-slate-800/70 pt-1">
              <span className="text-purple-300">EXP ALT:</span>
              <span className="font-bold text-teal-300 tabular-nums">
                {expPtHud.h.toFixed(1)} m ({altCurrent - expPtHud.h >= 0 ? '+' : ''}
                {(altCurrent - expPtHud.h).toFixed(1)})
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">{t?.flight_range_x || 'X'}:</span>
            <span className="text-cyan-300 font-bold tabular-nums">{rangeCurrent.toFixed(1)} m</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">VEL:</span>
            <span className="text-emerald-300 font-bold tabular-nums">{vCurrent.toFixed(1)} m/s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">ACEL:</span>
            <span className="text-amber-300 font-bold tabular-nums">{aCurrent.toFixed(1)} m/s²</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <span>
              MACH: <strong className="text-purple-300 tabular-nums">M {machCurrent.toFixed(2)}</strong>
            </span>
            <span>
              {t?.flight_pitch_label || 'γ'}:{' '}
              <strong className="text-slate-200 tabular-nums">{pitchDegCurrent.toFixed(1)}°</strong>
            </span>
          </div>
        </div>

        {/* Interactive Camera Hint */}
        <div className="absolute bottom-2.5 left-3 z-20 text-[10px] font-mono text-slate-300 bg-slate-950/88 px-2.5 py-1 rounded border border-slate-800 pointer-events-none">
          {cameraMode === 'onboard'
            ? t?.flight_cam_onboard || 'Onboard Rocket Cam'
            : cameraMode === 'pad'
            ? `${t?.flight_cam_pad || 'Pad Cam'} • ${t?.tip_zoom || 'Rueda del ratón para Zoom'}`
            : t?.tab_3d_hint || 'Arrastra para rotar • Rueda para zoom'}
        </div>
      </CardContent>

      {/* Clickable Mission Milestones Bar + Playback Scrubber */}
      <div className="flex flex-col bg-slate-900 border-t border-slate-800 z-20 shrink-0">
        {timeline.milestones.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 pb-0.5">
            {timeline.milestones.map((m) => {
              const isNear = Math.abs(effectiveTimeIndex - m.index) <= 4;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => seekToTimeIndex(m.index)}
                  className={`px-2 py-0.5 rounded border font-mono text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    isNear
                      ? 'bg-slate-800 border-white/60 text-white shadow-sm'
                      : `${m.badgeBg} ${m.badgeText} hover:brightness-125`
                  }`}
                >
                  <Flag size={9} />
                  <span>{t?.[m.labelKey] || m.fallbackLabel}</span>
                  <span className="opacity-80 font-normal">· {m.detail}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-2.5">
          <Button
            onClick={handlePlayToggle}
            className={`w-24 h-8 font-mono text-xs font-bold gap-1.5 ${
              effectiveIsPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            {effectiveIsPlaying ? <Pause size={14} /> : <Play size={14} />}
            {effectiveIsPlaying
              ? t?.pause || 'Pausar'
              : effectiveTimeIndex >= Math.max(0, timeline.points.length - 1)
              ? t?.restart || 'Reiniciar'
              : t?.play || 'Play'}
          </Button>

          <div className="flex-1 px-2 relative flex flex-col justify-center">
            <div className="relative w-full h-3 flex items-center">
              <input
                type="range"
                min="0"
                max={Math.max(0, timeline.points.length - 1)}
                value={effectiveTimeIndex}
                onChange={(e) => seekToTimeIndex(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 relative z-10"
              />
              {/* Visual Milestone Tick Pins along the scrubber */}
              {timeline.milestones.map((m) => (
                <button
                  key={`pin-${m.id}`}
                  type="button"
                  title={`${t?.[m.labelKey] || m.fallbackLabel} (${m.detail})`}
                  onClick={() => seekToTimeIndex(m.index)}
                  style={{ left: `${(m.index / maxIdx) * 100}%` }}
                  className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rotate-45 bg-amber-400 border border-slate-950 z-20 cursor-pointer hover:scale-125 transition-transform"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-[118px]">
            <span className="text-[10px] text-slate-400 font-mono uppercase">{t?.speed || 'Vel:'}</span>
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
                <SelectItem value="1">1.0x</SelectItem>
                <SelectItem value="2">2.0x</SelectItem>
                <SelectItem value="4">4.0x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}
