import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MotorInput, NozzleInput, SimulationResults } from '../lib/types';
import {
  buildNozzleAxialProfile,
  computeNozzleFlowStateAtTime,
  findOcnWindows,
  NozzleAxialPoint,
  NozzleFlowRegime,
  NozzleFlowState,
} from '../lib/nozzleShock';
import { Eye, Flame, Gauge, LineChart, Search, Thermometer, Waves, Zap } from 'lucide-react';

export type NozzleFlowViewMode = 'mach' | 'pressure' | 'thermal' | 'schlieren';

export interface NozzleFlowViewerProps {
  results: SimulationResults;
  timeIndex: number;
  timeSec?: number;
  motor?: MotorInput;
  nozzle?: NozzleInput;
  isPlaying: boolean;
  speed: number;
  isIgnitionZoom?: boolean;
  onToggleIgnitionZoom?: (startSec: number, endSec: number) => void;
  onJumpToTimeSec?: (tSec: number, suggestedSpeed?: number) => void;
  t?: any;
}

interface FlowParticle {
  u: number; // -0.45 .. 3.8 axial progress (nozzle is -0.45..1.0, plume is 1.0..3.8)
  vFrac: number; // -0.94 .. +0.94 radial streamline fraction
  seed: number; // deterministic random phase in [0, 1)
}

interface LocalFieldSample {
  mach: number;
  pOverP0: number;
  tempNorm: number;
  schlierenGrad: number;
  speedNorm: number; // normalized axial advection speed
  radialFocus: number; // 1.0 neutral, <1 pinched at shock core, >1 flared in expansion
  inShockCore: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], f: number): [number, number, number] {
  const t = clamp(f, 0, 1);
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function samplePalette(
  stops: Array<{ p: number; c: [number, number, number] }>,
  value: number,
  alpha = 1
): string {
  const v = clamp(value, 0, 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v >= a.p && v <= b.p) {
      const f = (v - a.p) / Math.max(1e-6, b.p - a.p);
      const [r, g, bl] = lerpColor(a.c, b.c, f);
      return alpha >= 0.999 ? `rgb(${r}, ${g}, ${bl})` : `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
    }
  }
  const last = stops[stops.length - 1].c;
  return alpha >= 0.999
    ? `rgb(${last[0]}, ${last[1]}, ${last[2]})`
    : `rgba(${last[0]}, ${last[1]}, ${last[2]}, ${alpha.toFixed(3)})`;
}

const MACH_STOPS: Array<{ p: number; c: [number, number, number] }> = [
  { p: 0.0, c: [56, 189, 248] },
  { p: 0.28, c: [34, 211, 238] },
  { p: 0.5, c: [52, 211, 153] },
  { p: 0.75, c: [251, 191, 36] },
  { p: 1.0, c: [248, 113, 113] },
];

const PRESSURE_STOPS: Array<{ p: number; c: [number, number, number] }> = [
  { p: 0.0, c: [59, 130, 246] },
  { p: 0.28, c: [34, 211, 238] },
  { p: 0.55, c: [250, 204, 21] },
  { p: 0.8, c: [251, 146, 60] },
  { p: 1.0, c: [255, 237, 213] },
];

const THERMAL_STOPS: Array<{ p: number; c: [number, number, number] }> = [
  { p: 0.0, c: [99, 102, 241] },
  { p: 0.3, c: [239, 68, 68] },
  { p: 0.58, c: [249, 115, 22] },
  { p: 0.82, c: [253, 224, 71] },
  { p: 1.0, c: [255, 253, 240] },
];

function sampleAxialProfile(profile: NozzleAxialPoint[], xNorm: number): NozzleAxialPoint {
  if (profile.length === 0) {
    return { xNorm, radiusNorm: 1, mach: 0, pOverP0: 1, tempK: 288 };
  }
  if (xNorm <= profile[0].xNorm) return profile[0];
  const last = profile[profile.length - 1];
  if (xNorm >= last.xNorm) return last;

  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (xNorm >= a.xNorm && xNorm <= b.xNorm) {
      const f = (xNorm - a.xNorm) / Math.max(1e-6, b.xNorm - a.xNorm);
      return {
        xNorm,
        radiusNorm: lerp(a.radiusNorm, b.radiusNorm, f),
        mach: lerp(a.mach, b.mach, f),
        pOverP0: lerp(a.pOverP0, b.pOverP0, f),
        tempK: lerp(a.tempK, b.tempK, f),
      };
    }
  }
  return last;
}

/**
 * Evaluates local aerodynamic properties at normalized coordinates (u, vFrac):
 * - Inside nozzle (u <= 1.0): exact 1D/boundary-layer TTI profile with OCN shock jump
 * - Outside nozzle (u > 1.0): 2D spatial (x, r) shock-expansion cell topology where
 *   particles DECELLERATE sharply behind shocks/Mach disks & ACCELERATE in expansion fans,
 *   causing Mach shock diamonds to emerge naturally from continuity & compression!
 */
function evaluateLocalField(
  u: number,
  vFrac: number,
  state: NozzleFlowState,
  profile: NozzleAxialPoint[],
  cellCountInPlume: number
): LocalFieldSample {
  const absV = Math.abs(vFrac);
  const tDenom = Math.max(300, state.T0r_K - 280);

  if (state.regime === 'idle') {
    return {
      mach: 0,
      pOverP0: 1,
      tempNorm: 0,
      schlierenGrad: 0.2,
      speedNorm: 0,
      radialFocus: 1,
      inShockCore: false,
    };
  }

  // --- INSIDE NOZZLE ---
  if (u <= 1.0) {
    const pt = sampleAxialProfile(profile, clamp(u, -0.45, 1.0));
    const tempNorm = clamp((pt.tempK - 280) / tDenom, 0.05, 1);

    // Wall boundary layer drag + post-shock separation slowing near walls
    let wallFactor = absV > 0.84 ? lerp(1, 0.48, (absV - 0.84) / 0.16) : 1.0;
    const isSeparatedWall =
      state.separationPosNorm !== null &&
      u > state.separationPosNorm &&
      absV > 0.72;
    if (isSeparatedWall) {
      wallFactor *= 0.35;
    }

    // Continuity-realistic speed: drops sharply across OCN shock (M1 -> M2)
    const speedNorm = (0.24 + pt.mach * 1.25) * wallFactor;
    const nearOcn =
      state.regime === 'normal_shock' &&
      state.shockPosNorm !== null &&
      u >= state.shockPosNorm &&
      u <= state.shockPosNorm + 0.18;

    return {
      mach: pt.mach * wallFactor,
      pOverP0: pt.pOverP0,
      tempNorm,
      schlierenGrad: nearOcn ? 0.92 : clamp(0.25 + pt.mach * 0.16, 0.2, 0.75),
      speedNorm,
      radialFocus: isSeparatedWall ? 0.96 : 1.0,
      inShockCore: nearOcn,
    };
  }

  // --- EXTERNAL PLUME (u in 1.0 .. 3.8) ---
  const plumeProgress = clamp((u - 1.0) / 2.8, 0, 1);
  const cellCoord = plumeProgress * Math.max(1.8, cellCountInPlume);
  const cellIdx = Math.floor(cellCoord);
  const cellPhase = cellCoord - cellIdx; // 0..1 inside shock cell
  const damp = Math.exp(-0.26 * cellIdx);
  const teNorm = clamp((state.Te_K - 280) / tDenom, 0.08, 1);
  const peOverP0 = state.Pe_MPa / Math.max(1e-6, state.P0_MPa);

  // Shear mixing slowdown along ambient boundary (|vFrac| -> 1)
  const shearAtten = absV > 0.86 ? lerp(1, 0.55, (absV - 0.86) / 0.14) : 1.0;

  if (state.regime === 'subsonic' || state.regime === 'normal_shock') {
    const m = state.Me_actual * Math.exp(-0.85 * plumeProgress) * shearAtten;
    return {
      mach: m,
      pOverP0: state.Pp,
      tempNorm: teNorm * Math.exp(-0.65 * plumeProgress),
      schlierenGrad: 0.32,
      speedNorm: 0.28 + m * 1.15,
      radialFocus: 1,
      inShockCore: false,
    };
  }

  if (state.regime === 'adapted') {
    const m = state.Ms2 * (1 - 0.14 * plumeProgress) * shearAtten;
    // Weak Mach lines crossing
    const onMachLine = Math.abs(absV - Math.abs(1 - 2 * cellPhase)) < 0.08;
    return {
      mach: m,
      pOverP0: state.pis2,
      tempNorm: teNorm * (1 - 0.14 * plumeProgress),
      schlierenGrad: onMachLine ? 0.65 : 0.3,
      speedNorm: 0.32 + m * 1.25,
      radialFocus: 1,
      inShockCore: false,
    };
  }

  const stemFrac = clamp(state.machDiskRatio * damp, 0, 0.48);

  // OVEREXPANDED (OCO): Incident oblique shock from lips inward -> diamond / Mach disk -> reflected expansion
  if (state.regime === 'overexpanded') {
    let localM = state.Ms2;
    let localP = peOverP0;
    let localT = teNorm;
    let radialFocus = 1.0;
    let inShockCore = false;
    let schlieren = 0.28;

    if (cellPhase < 0.5) {
      // Incident oblique shock sweeps inward from |v|=1 (phase=0) to |v|=stemFrac (phase=0.5)
      const shockR = lerp(1.0, stemFrac, cellPhase / 0.5);
      if (absV < shockR - 0.03) {
        // Upstream of oblique shock: fast unshocked core
        localM = state.Ms2 * (1 - 0.05 * cellIdx);
        localP = peOverP0;
        localT = teNorm;
        schlieren = 0.24;
      } else {
        // Behind incident oblique shock: decelerated, compressed, warmer
        const slowFactor = lerp(0.86, 0.62, state.waveIntensity * damp);
        localM = Math.max(0.85, state.MextJet * slowFactor);
        localP = lerp(peOverP0, state.Pp * 1.25, state.waveIntensity * damp);
        localT = Math.min(0.95, teNorm + 0.28 * state.waveIntensity * damp);
        radialFocus = lerp(1, 0.9, state.waveIntensity * damp);
        schlieren = Math.abs(absV - shockR) < 0.08 ? 0.94 : 0.62;
        inShockCore = Math.abs(absV - shockR) < 0.12;
      }
    } else {
      // Reflected expansion fan sweeps outward from |v|=stemFrac (phase=0.5) to |v|=1.0 (phase=1.0)
      const expR = lerp(stemFrac, 1.0, (cellPhase - 0.5) / 0.5);
      if (absV < expR) {
        // Inside the hot compressed Mach diamond core (behind Mach disk / crossed oblique shocks)!
        const subsonicWake = stemFrac > 0.06 && absV < stemFrac * 1.15;
        localM = subsonicWake
          ? Math.max(0.42, state.M2_shock || 0.55)
          : Math.max(0.72, state.MextJet * lerp(0.8, 0.52, state.waveIntensity * damp));
        localP = Math.min(1, state.Pp * lerp(1.15, 1.85, state.waveIntensity * damp));
        localT = Math.min(1.0, teNorm + (subsonicWake ? 0.58 : 0.42) * state.waveIntensity * damp);
        radialFocus = lerp(1, 0.82, state.waveIntensity * damp);
        schlieren = 0.9;
        inShockCore = true;
      } else {
        // Outside reflected expansion wave: flow accelerates rapidly again!
        localM = lerp(state.MextJet, state.Ms2, 0.65) * (1 + 0.12 * state.waveIntensity * damp);
        localP = peOverP0 * 0.92;
        localT = teNorm * 0.88;
        radialFocus = 1.04;
        schlieren = Math.abs(absV - expR) < 0.08 ? 0.18 : 0.34;
      }
    }

    localM *= shearAtten;
    // Key physical rule: SLOWER in shock compression, FASTER in expansion!
    const speedNorm = clamp(0.24 + localM * 1.25, 0.24, 4.8);
    return {
      mach: localM,
      pOverP0: localP,
      tempNorm: localT,
      schlierenGrad: schlieren,
      speedNorm,
      radialFocus,
      inShockCore,
    };
  }

  // UNDEREXPANDED (Prandtl-Meyer): Expansion fan (phase 0..0.46 -> very fast!),
  // then Barrel/Mach Disk shock compression (phase 0.52..0.95 -> slow dense glowing diamond!)
  let localM = state.Ms2;
  let localP = peOverP0;
  let localT = teNorm;
  let radialFocus = 1.0;
  let inShockCore = false;
  let schlieren = 0.3;

  if (cellPhase < 0.46) {
    // Prandtl-Meyer expansion fan: rapid acceleration & cooling!
    const fanProgress = cellPhase / 0.46;
    localM = lerp(state.Ms2, state.MextJet, clamp(fanProgress * 1.15, 0, 1)) * (1 - 0.04 * cellIdx);
    localP = lerp(peOverP0, state.Pp * 0.42, fanProgress * damp);
    localT = teNorm * lerp(1.0, 0.52, fanProgress * damp);
    radialFocus = lerp(1.0, 1.1, fanProgress * damp);
    schlieren = 0.16 + 0.12 * (1 - fanProgress);
  } else {
    // Barrel shock curves inward from |v|=1 (phase=0.46) to |v|=stemFrac (phase=0.78),
    // compressing flow into a bright slow Mach diamond core through phase=0.96
    const barrelFrac = clamp((cellPhase - 0.46) / 0.32, 0, 1);
    const barrelR = lerp(1.0, stemFrac, barrelFrac);

    if (cellPhase < 0.78 && absV < barrelR - 0.04) {
      // Inner core not yet hit by barrel shock -> still expanding very fast!
      localM = state.MextJet * (1 - 0.04 * cellIdx);
      localP = state.Pp * 0.42;
      localT = teNorm * 0.54;
      schlieren = 0.2;
    } else {
      // Crossed Barrel Shock or Mach Disk! Abrupt deceleration + high compression + hot diamond!
      const postDiskCenter = cellPhase >= 0.74 && absV < Math.max(0.32, stemFrac * 1.2);
      const decayOut = cellPhase > 0.82 ? clamp((cellPhase - 0.82) / 0.18, 0, 1) : 0;
      const slowTarget = postDiskCenter
        ? Math.max(0.45, state.Ms2 * lerp(0.55, 0.34, state.waveIntensity * damp))
        : Math.max(0.9, state.MextJet * 0.62);
      localM = lerp(slowTarget, state.Ms2 * 1.05, decayOut * 0.65);
      localP = lerp(Math.min(1, state.Pp * 1.85), state.Pp * 0.9, decayOut * 0.5);
      localT = lerp(Math.min(1.0, teNorm + 0.48 * damp), teNorm * 0.9, decayOut * 0.5);
      radialFocus = lerp(1.0, 0.78, (1 - decayOut) * state.waveIntensity * damp);
      schlieren = postDiskCenter ? 0.96 : 0.8;
      inShockCore = cellPhase >= 0.72 && cellPhase <= 0.95 && absV < 0.72;
    }
  }

  localM *= shearAtten;
  const speedNorm = clamp(0.24 + localM * 1.2, 0.22, 5.2);
  return {
    mach: localM,
    pOverP0: localP,
    tempNorm: localT,
    schlierenGrad: schlieren,
    speedNorm,
    radialFocus,
    inShockCore,
  };
}

function getBucketColor(
  mode: NozzleFlowViewMode,
  bucketVal: number,
  alpha: number
): string {
  if (mode === 'mach') return samplePalette(MACH_STOPS, bucketVal, alpha);
  if (mode === 'pressure') return samplePalette(PRESSURE_STOPS, bucketVal, alpha);
  if (mode === 'thermal') return samplePalette(THERMAL_STOPS, bucketVal, alpha);
  const g = clamp(Math.round(35 + bucketVal * 215), 25, 255);
  return `rgba(${g}, ${Math.min(255, g + 5)}, ${Math.min(255, g + 12)}, ${alpha.toFixed(3)})`;
}

function getRegimeMeta(regime: NozzleFlowRegime, t?: any) {
  switch (regime) {
    case 'idle':
      return {
        label: t?.nozzle_regime_idle || 'EN ESPERA / SIN FLUJO',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700',
      };
    case 'subsonic':
      return {
        label: t?.nozzle_regime_subsonic || 'SUBSÓNICO NO BLOQUEADO',
        dotClass: 'bg-sky-400',
        badgeClass: 'bg-sky-950/70 text-sky-300 border-sky-700/60',
      };
    case 'normal_shock':
      return {
        label: t?.nozzle_regime_ocn || 'ONDA DE CHOQUE NORMAL (OCN)',
        dotClass: 'bg-rose-400 animate-pulse',
        badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-600/70',
      };
    case 'overexpanded':
      return {
        label: t?.nozzle_regime_oco || 'SOBREEXPANDIDA (CHOQUE OBLICUO)',
        dotClass: 'bg-amber-400',
        badgeClass: 'bg-amber-950/75 text-amber-300 border-amber-600/60',
      };
    case 'adapted':
      return {
        label: t?.nozzle_regime_adapted || 'ADAPTADA (Pe ≈ Pa)',
        dotClass: 'bg-emerald-400',
        badgeClass: 'bg-emerald-950/75 text-emerald-300 border-emerald-600/60',
      };
    case 'underexpanded':
      return {
        label: t?.nozzle_regime_underexpanded || 'SUBEXPANDIDA (EXPANSIÓN PRANDTL-MEYER)',
        dotClass: 'bg-orange-400',
        badgeClass: 'bg-orange-950/75 text-orange-300 border-orange-600/60',
      };
  }
}

function createInitialParticles(count = 920): FlowParticle[] {
  const arr: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    // Low-discrepancy Halton-like jitter for clean fluid distribution without grid bands
    const phi1 = ((i * 0.61803398875) % 1);
    const phi2 = ((i * 0.38196601125 + 0.13) % 1);
    const vFrac = (phi1 - 0.5) * 1.88;
    arr.push({
      u: -0.45 + (i / count) * 4.25,
      vFrac,
      seed: phi2,
    });
  }
  return arr;
}

/**
 * Advances particles briefly under current aerodynamic velocity field so that even when
 * paused or freshly scrubbed, continuity bunching (slow dense shocks vs fast stretched expansions)
 * immediately manifests shock diamonds naturally.
 */
function relaxParticlesContinuity(
  particles: FlowParticle[],
  state: NozzleFlowState,
  profile: NozzleAxialPoint[],
  cellCountInPlume: number,
  passes = 32
) {
  if (state.regime === 'idle') return;
  const dt = 0.045;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const field = evaluateLocalField(pt.u, pt.vFrac, state, profile, cellCountInPlume);
      pt.u += dt * field.speedNorm;
      if (pt.u > 3.8) {
        pt.u = -0.45 + ((pt.u - 3.8) % 0.18);
      }
    }
  }
}

function drawNozzleScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NozzleFlowState,
  profile: NozzleAxialPoint[],
  mode: NozzleFlowViewMode,
  showAxialPlot: boolean,
  showWaveGuides: boolean,
  particles: FlowParticle[],
  t?: any
) {
  ctx.clearRect(0, 0, width, height);

  // Dark CFD / Schlieren wind tunnel backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, mode === 'schlieren' ? '#10141d' : '#04070f');
  bgGrad.addColorStop(1, mode === 'schlieren' ? '#171d29' : '#080c18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Wind tunnel background grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
  ctx.lineWidth = 1;
  const gridStep = Math.max(24, Math.round(width / 28));
  for (let gx = 0; gx < width; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  const plotH = showAxialPlot ? Math.max(96, Math.round(height * 0.28)) : 0;
  const tunnelH = height - plotH;

  // Nozzle proportions
  const padLeft = Math.max(18, Math.round(width * 0.03));
  const chamberLeftX = padLeft;
  const nozzleSpanTarget = clamp(
    width * (0.31 + Math.min(0.11, (state.L_div_mm / Math.max(5, state.Dt_mm)) * 0.025)),
    width * 0.31,
    width * 0.43
  );
  const nozzleExitX = Math.round(chamberLeftX + nozzleSpanTarget);
  const plumeRightX = width - Math.max(14, Math.round(width * 0.02));
  const plumeLen = Math.max(100, plumeRightX - nozzleExitX);

  const xMin = -0.45;
  const xMax = 1.0;
  const xNormToPx = (xn: number) =>
    chamberLeftX + ((xn - xMin) / (xMax - xMin)) * (nozzleExitX - chamberLeftX);
  const throatX = xNormToPx(0);

  const tunnelCy = tunnelH * 0.5;
  const maxRcNorm = profile.length > 0 ? profile[0].radiusNorm : 2.1;
  const reNorm = profile.length > 0 ? profile[profile.length - 1].radiusNorm : 1.7;
  const maxPlumeScale = Math.max(maxRcNorm, reNorm * Math.max(1.3, state.jetExpansionRatio * 1.18));
  const throatHalfH = clamp(
    (tunnelH * 0.35) / Math.max(1.4, maxPlumeScale),
    9,
    tunnelH * 0.2
  );
  const rExitPx = throatHalfH * reNorm;
  const DsPx = rExitPx * 2;
  const maxMachScale = Math.max(2.6, state.Ms2 * 1.25, state.MextJet * 1.05);
  const cellLenPx = clamp(state.diamondSpacing_Ds * DsPx * 0.92, 46, plumeLen * 0.48);
  const cellCountInPlume = plumeLen / cellLenPx;

  const getPlumeHalfHeight = (dx: number): number => {
    if (dx <= 0) return rExitPx;
    const progress = dx / plumeLen;
    if (state.regime === 'idle') return rExitPx;
    if (state.regime === 'subsonic') {
      return rExitPx * (1 + 0.38 * progress);
    }
    if (state.regime === 'normal_shock') {
      return rExitPx * (0.94 + 0.36 * progress);
    }
    if (state.regime === 'adapted') {
      return rExitPx * (1 + 0.07 * progress);
    }
    const theta = (dx / cellLenPx) * Math.PI * 2;
    const damping = Math.exp(-0.26 * (dx / cellLenPx));
    const shearSpread = 1 + 0.11 * progress;
    if (state.regime === 'overexpanded') {
      const amp = Math.max(0.08, 1 - state.jetExpansionRatio);
      const mod = 1 - amp * (0.52 + 0.48 * (-Math.cos(theta))) * damping;
      return rExitPx * mod * shearSpread;
    }
    const amp = Math.max(0.1, state.jetExpansionRatio - 1);
    const wave = 1 + amp * 0.54 * (1 - Math.cos(theta)) * damping;
    return rExitPx * wave * shearSpread;
  };

  // --- 1. SUBTLE GAS VOLUME BACKDROP (NO fake painted diamonds — diamonds emerge purely from particles!) ---
  if (state.regime !== 'idle') {
    const plumeSegs = 60;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nozzleExitX, tunnelCy - rExitPx);
    for (let i = 1; i <= plumeSegs; i++) {
      const dx = (i / plumeSegs) * plumeLen;
      ctx.lineTo(nozzleExitX + dx, tunnelCy - getPlumeHalfHeight(dx));
    }
    for (let i = plumeSegs; i >= 0; i--) {
      const dx = (i / plumeSegs) * plumeLen;
      ctx.lineTo(nozzleExitX + dx, tunnelCy + getPlumeHalfHeight(dx));
    }
    ctx.closePath();
    const faintPlumeGrad = ctx.createLinearGradient(nozzleExitX, 0, plumeRightX, 0);
    if (mode === 'schlieren') {
      faintPlumeGrad.addColorStop(0, 'rgba(30, 41, 59, 0.28)');
      faintPlumeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.04)');
    } else {
      faintPlumeGrad.addColorStop(0, 'rgba(14, 116, 144, 0.16)');
      faintPlumeGrad.addColorStop(0.5, 'rgba(30, 58, 138, 0.09)');
      faintPlumeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');
    }
    ctx.fillStyle = faintPlumeGrad;
    ctx.fill();
    ctx.restore();

    // Faint continuous background inside nozzle chamber/convergent/divergent
    const nozzleGrad = ctx.createLinearGradient(chamberLeftX, 0, nozzleExitX, 0);
    nozzleGrad.addColorStop(0, mode === 'thermal' ? 'rgba(234, 88, 12, 0.28)' : 'rgba(14, 165, 233, 0.16)');
    nozzleGrad.addColorStop(0.35, mode === 'thermal' ? 'rgba(245, 158, 11, 0.24)' : 'rgba(16, 185, 129, 0.14)');
    nozzleGrad.addColorStop(1, 'rgba(30, 64, 175, 0.12)');
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < profile.length; i++) {
      const px = xNormToPx(profile[i].xNorm);
      const py = tunnelCy - profile[i].radiusNorm * throatHalfH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = profile.length - 1; i >= 0; i--) {
      const px = xNormToPx(profile[i].xNorm);
      const py = tunnelCy + profile[i].radiusNorm * throatHalfH;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = nozzleGrad;
    ctx.fill();
    ctx.restore();
  }

  // Boundary-layer separation shade near walls downstream of strong shock
  if (state.separationPosNorm !== null && state.separationPosNorm < 0.98) {
    const sepStartX = xNormToPx(state.separationPosNorm);
    const sepStartH = sampleAxialProfile(profile, state.separationPosNorm).radiusNorm * throatHalfH;
    const pocketThick = Math.max(4, (rExitPx - sepStartH) * 0.48 + rExitPx * 0.08);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
    ctx.beginPath();
    ctx.moveTo(sepStartX, tunnelCy - sepStartH);
    ctx.lineTo(nozzleExitX, tunnelCy - rExitPx);
    ctx.lineTo(nozzleExitX, tunnelCy - rExitPx + pocketThick);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sepStartX, tunnelCy + sepStartH);
    ctx.lineTo(nozzleExitX, tunnelCy + rExitPx);
    ctx.lineTo(nozzleExitX, tunnelCy + rExitPx - pocketThick);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- 2. OPTIONAL DELICATE WAVE REFERENCE GUIDES (Shocks & Prandtl-Meyer Fans) ---
  if (
    showWaveGuides &&
    (state.regime === 'overexpanded' ||
      state.regime === 'underexpanded' ||
      state.regime === 'adapted')
  ) {
    const waveAlpha = state.regime === 'adapted' ? 0.24 : clamp(0.28 + 0.34 * state.waveIntensity, 0.26, 0.62);
    const numCells = Math.min(6, Math.max(2, Math.ceil(plumeLen / cellLenPx)));

    for (let c = 0; c < numCells; c++) {
      const cellStart = nozzleExitX + c * cellLenPx;
      const cellEnd = cellStart + cellLenPx;
      if (cellStart > plumeRightX) break;

      const damp = Math.exp(-0.26 * c);
      const cellA = waveAlpha * damp;
      if (cellA < 0.06) continue;

      const hStart = getPlumeHalfHeight(c * cellLenPx);
      const hMid = getPlumeHalfHeight((c + 0.5) * cellLenPx);
      const hEnd = getPlumeHalfHeight((c + 1) * cellLenPx);

      ctx.save();
      if (state.regime === 'overexpanded') {
        const stemHalf = Math.min(rExitPx * 0.48, state.machDiskRatio * DsPx * 0.5 * damp);
        const crossX = Math.min(plumeRightX, cellStart + cellLenPx * 0.5);

        ctx.strokeStyle =
          mode === 'schlieren'
            ? `rgba(255, 255, 255, ${(cellA * 1.1).toFixed(2)})`
            : `rgba(251, 146, 60, ${cellA.toFixed(2)})`;
        ctx.lineWidth = c === 0 ? 1.5 : 1.0;
        ctx.beginPath();
        ctx.moveTo(cellStart, tunnelCy - hStart);
        ctx.lineTo(crossX, tunnelCy - stemHalf);
        ctx.moveTo(cellStart, tunnelCy + hStart);
        ctx.lineTo(crossX, tunnelCy + stemHalf);
        ctx.stroke();

        if (stemHalf > 2.5) {
          ctx.strokeStyle =
            mode === 'schlieren'
              ? `rgba(255, 255, 255, ${Math.min(0.95, cellA * 1.3).toFixed(2)})`
              : `rgba(244, 63, 94, ${Math.min(0.9, cellA * 1.25).toFixed(2)})`;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(crossX, tunnelCy - stemHalf);
          ctx.lineTo(crossX, tunnelCy + stemHalf);
          ctx.stroke();
        }

        if (crossX < plumeRightX) {
          const endX = Math.min(plumeRightX, cellEnd);
          const endFrac = (endX - crossX) / Math.max(1, cellEnd - crossX);
          const targetTop = lerp(tunnelCy - stemHalf, tunnelCy - hEnd, endFrac);
          const targetBot = lerp(tunnelCy + stemHalf, tunnelCy + hEnd, endFrac);
          ctx.strokeStyle = `rgba(56, 189, 248, ${(cellA * 0.7).toFixed(2)})`;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(crossX, tunnelCy - stemHalf);
          ctx.lineTo(endX, targetTop);
          ctx.moveTo(crossX, tunnelCy + stemHalf);
          ctx.lineTo(endX, targetBot);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (state.regime === 'underexpanded') {
        const fanEndX = Math.min(plumeRightX, cellStart + cellLenPx * 0.46);
        const bulgeH = getPlumeHalfHeight(Math.max(0, fanEndX - nozzleExitX));
        const nodeX = Math.min(plumeRightX, cellStart + cellLenPx * 0.78);
        const stemHalf = Math.min(rExitPx * 0.5, state.machDiskRatio * DsPx * 0.5 * damp);

        const rays = c === 0 ? 5 : 3;
        ctx.strokeStyle = `rgba(56, 189, 248, ${(cellA * 0.65).toFixed(2)})`;
        ctx.lineWidth = 0.9;
        ctx.setLineDash([3, 3]);
        for (let r = 0; r < rays; r++) {
          const frac = r / (rays - 1);
          const targetX = lerp(cellStart + cellLenPx * 0.25, fanEndX, frac);
          const fanUpperSpan = lerp(bulgeH * 0.96, -hStart * 0.16, frac);
          if (targetX <= plumeRightX) {
            ctx.beginPath();
            ctx.moveTo(cellStart, tunnelCy - hStart);
            ctx.lineTo(targetX, tunnelCy - fanUpperSpan);
            ctx.moveTo(cellStart, tunnelCy + hStart);
            ctx.lineTo(targetX, tunnelCy + fanUpperSpan);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);

        if (fanEndX < plumeRightX) {
          ctx.strokeStyle =
            mode === 'schlieren'
              ? `rgba(255, 255, 255, ${(cellA * 1.1).toFixed(2)})`
              : `rgba(251, 146, 60, ${cellA.toFixed(2)})`;
          ctx.lineWidth = c === 0 ? 1.5 : 1.0;
          ctx.beginPath();
          ctx.moveTo(fanEndX, tunnelCy - bulgeH * 0.96);
          ctx.quadraticCurveTo(
            lerp(fanEndX, nodeX, 0.55),
            tunnelCy - bulgeH * 0.44,
            nodeX,
            tunnelCy - stemHalf
          );
          ctx.moveTo(fanEndX, tunnelCy + bulgeH * 0.96);
          ctx.quadraticCurveTo(
            lerp(fanEndX, nodeX, 0.55),
            tunnelCy + bulgeH * 0.44,
            nodeX,
            tunnelCy + stemHalf
          );
          ctx.stroke();

          if (stemHalf > 2.5) {
            ctx.strokeStyle =
              mode === 'schlieren'
                ? `rgba(255, 255, 255, ${Math.min(0.95, cellA * 1.3).toFixed(2)})`
                : `rgba(244, 63, 94, ${Math.min(0.9, cellA * 1.25).toFixed(2)})`;
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(nodeX, tunnelCy - stemHalf);
            ctx.lineTo(nodeX, tunnelCy + stemHalf);
            ctx.stroke();
          }
        }
      } else {
        const crossX = Math.min(plumeRightX, cellStart + cellLenPx * 0.5);
        ctx.strokeStyle = `rgba(52, 211, 153, ${(cellA * 0.7).toFixed(2)})`;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(cellStart, tunnelCy - hStart);
        ctx.lineTo(crossX, tunnelCy);
        ctx.lineTo(Math.min(plumeRightX, cellEnd), tunnelCy - hMid);
        ctx.moveTo(cellStart, tunnelCy + hStart);
        ctx.lineTo(crossX, tunnelCy);
        ctx.lineTo(Math.min(plumeRightX, cellEnd), tunnelCy + hMid);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Faint outer plume shear boundary
      ctx.strokeStyle = `rgba(148, 163, 184, ${(0.22 * damp).toFixed(2)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const sx = lerp(cellStart, Math.min(plumeRightX, cellEnd), s / 12);
        const sy = getPlumeHalfHeight(sx - nozzleExitX);
        if (s === 0) ctx.moveTo(sx, tunnelCy - sy);
        else ctx.lineTo(sx, tunnelCy - sy);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const sx = lerp(cellStart, Math.min(plumeRightX, cellEnd), s / 12);
        const sy = getPlumeHalfHeight(sx - nozzleExitX);
        if (s === 0) ctx.moveTo(sx, tunnelCy + sy);
        else ctx.lineTo(sx, tunnelCy + sy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- 3. PARTICLE-EMERGENT FLOW FIELD (920+ Continuity-Driven Particles) ---
  // Particles decelerate sharply in shock waves (piling up tightly and glowing bright/hot),
  // and accelerate rapidly in Prandtl-Meyer expansion zones (stretching fast and thin),
  // forming the Mach Shock Diamonds naturally!
  if (state.regime !== 'idle') {
    const numBuckets = 8;
    const buckets: Array<Array<[number, number, number, number, number]>> = Array.from(
      { length: numBuckets },
      () => []
    );

    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const f = evaluateLocalField(pt.u, pt.vFrac, state, profile, cellCountInPlume);

      let px: number;
      let halfH: number;
      if (pt.u <= 1.0) {
        const xn = clamp(pt.u, -0.45, 1.0);
        px = xNormToPx(xn);
        halfH = sampleAxialProfile(profile, xn).radiusNorm * throatHalfH;
      } else {
        const dx = ((pt.u - 1.0) / 2.8) * plumeLen;
        px = nozzleExitX + dx;
        if (px > plumeRightX) continue;
        halfH = getPlumeHalfHeight(dx) * f.radialFocus;
      }

      const py = tunnelCy + pt.vFrac * (halfH * 0.9);
      // Fast particles in expansion zones draw longer sleek streamlines;
      // slow particles inside shock compression draw compact dense glowing beads!
      const streak = f.inShockCore
        ? clamp(1.8 + f.mach * 2.2, 1.8, 5.5)
        : clamp(2.0 + f.speedNorm * 4.8, 2.0, 18.5);
      const thick = f.inShockCore ? 2.15 + pt.seed * 0.85 : 1.15 + pt.seed * 0.55;

      let valNorm = 0.5;
      if (mode === 'mach') {
        valNorm = clamp(f.mach / maxMachScale, 0, 1);
      } else if (mode === 'pressure') {
        valNorm = clamp(Math.pow(clamp(f.pOverP0, 0, 1), 0.52), 0, 1);
      } else if (mode === 'thermal') {
        valNorm = clamp(f.tempNorm, 0, 1);
      } else {
        valNorm = clamp(f.schlierenGrad, 0, 1);
      }

      const bIdx = Math.min(numBuckets - 1, Math.max(0, Math.floor(valNorm * numBuckets)));
      buckets[bIdx].push([px - streak, py, px, py, thick]);
    }

    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < numBuckets; b++) {
      const segs = buckets[b];
      if (segs.length === 0) continue;
      const bucketVal = (b + 0.5) / numBuckets;

      // Subtle glowing halo pass for bright/hot compressed buckets
      const isHotBucket =
        mode === 'mach'
          ? b <= 2 || state.regime === 'normal_shock' // slower post-shock compression glows vividly too
          : b >= numBuckets - 3;

      if (isHotBucket && mode !== 'schlieren') {
        ctx.strokeStyle = getBucketColor(mode, bucketVal, 0.22);
        ctx.lineWidth = 4.4;
        ctx.beginPath();
        for (let k = 0; k < segs.length; k++) {
          const [x0, y0, x1, y1] = segs[k];
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      }

      // Main crisp particle pass (slow particles thicker/brighter, fast particles sleeker)
      ctx.strokeStyle = getBucketColor(mode, bucketVal, mode === 'schlieren' ? 0.78 : 0.88);
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      for (let k = 0; k < segs.length; k++) {
        const [x0, y0, x1, y1] = segs[k];
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }

    // Extra crisp white-hot center beads for shock-compressed particles (forming radiant Mach diamonds!)
    ctx.fillStyle = mode === 'schlieren' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 248, 225, 0.85)';
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const f = evaluateLocalField(pt.u, pt.vFrac, state, profile, cellCountInPlume);
      if (!f.inShockCore) continue;
      let px: number;
      let halfH: number;
      if (pt.u <= 1.0) {
        const xn = clamp(pt.u, -0.45, 1.0);
        px = xNormToPx(xn);
        halfH = sampleAxialProfile(profile, xn).radiusNorm * throatHalfH;
      } else {
        const dx = ((pt.u - 1.0) / 2.8) * plumeLen;
        px = nozzleExitX + dx;
        if (px > plumeRightX) continue;
        halfH = getPlumeHalfHeight(dx) * f.radialFocus;
      }
      const py = tunnelCy + pt.vFrac * (halfH * 0.9);
      const r = 1.35 + pt.seed * 0.9;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // --- 4. NOZZLE NORMAL SHOCK FRONT (OCN) WITH CURVED CORE & LAMBDA FOOT ---
  if (state.regime === 'normal_shock' && state.shockPosNorm !== null) {
    const shockX = xNormToPx(state.shockPosNorm);
    const sampledShock = sampleAxialProfile(profile, state.shockPosNorm);
    const shockHalfH = sampledShock.radiusNorm * throatHalfH;

    ctx.save();
    const glow = ctx.createLinearGradient(shockX - 10, 0, shockX + 10, 0);
    glow.addColorStop(0, 'rgba(244, 63, 94, 0)');
    glow.addColorStop(0.5, mode === 'schlieren' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(244, 63, 94, 0.48)');
    glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(shockX - 10, tunnelCy - shockHalfH, 20, shockHalfH * 2);

    ctx.strokeStyle = mode === 'schlieren' ? '#ffffff' : '#fb7185';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(shockX, tunnelCy - shockHalfH * 0.78);
    ctx.quadraticCurveTo(shockX + 3.5, tunnelCy, shockX, tunnelCy + shockHalfH * 0.78);
    ctx.stroke();

    // Bifurcated Lambda-foot at divergent walls
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(shockX, tunnelCy - shockHalfH * 0.78);
    ctx.lineTo(shockX - 8, tunnelCy - shockHalfH);
    ctx.moveTo(shockX, tunnelCy - shockHalfH * 0.78);
    ctx.lineTo(shockX + 5, tunnelCy - shockHalfH);
    ctx.moveTo(shockX, tunnelCy + shockHalfH * 0.78);
    ctx.lineTo(shockX - 8, tunnelCy + shockHalfH);
    ctx.moveTo(shockX, tunnelCy + shockHalfH * 0.78);
    ctx.lineTo(shockX + 5, tunnelCy + shockHalfH);
    ctx.stroke();

    const jumpStr = state.shockPressureJump ? ` · P₂/P₁=${state.shockPressureJump.toFixed(1)}×` : '';
    const tagText = `OCN x/L=${(state.shockPosNorm * 100).toFixed(1)}% · M₁=${state.M1_shock?.toFixed(2)}→${state.M2_shock?.toFixed(2)}${jumpStr}`;
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    const textW = ctx.measureText(tagText).width + 12;
    const tagX = clamp(shockX - textW / 2, 10, nozzleExitX - textW + 70);
    const tagY = Math.max(8, tunnelCy - shockHalfH - 38);
    ctx.fillStyle = 'rgba(136, 19, 55, 0.94)';
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, textW, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe4e6';
    ctx.fillText(tagText, tagX + 6, tagY + 12.5);
    ctx.restore();
  }

  // --- 5. NOZZLE SOLID WALL CASING & THROAT GRAPHITE ---
  const wallThickness = Math.max(9, Math.round(throatHalfH * 0.42));
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < profile.length; i++) {
    const px = xNormToPx(profile[i].xNorm);
    const py = tunnelCy - profile[i].radiusNorm * throatHalfH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  const topOuterY = tunnelCy - maxRcNorm * throatHalfH - wallThickness;
  ctx.lineTo(nozzleExitX + 2, topOuterY);
  ctx.lineTo(chamberLeftX, topOuterY);
  ctx.closePath();

  const wallGradTop = ctx.createLinearGradient(0, topOuterY, 0, tunnelCy);
  wallGradTop.addColorStop(0, '#334155');
  wallGradTop.addColorStop(0.65, '#475569');
  wallGradTop.addColorStop(1, '#1e293b');
  ctx.fillStyle = wallGradTop;
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < profile.length; i++) {
    const px = xNormToPx(profile[i].xNorm);
    const py = tunnelCy + profile[i].radiusNorm * throatHalfH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  const botOuterY = tunnelCy + maxRcNorm * throatHalfH + wallThickness;
  ctx.lineTo(nozzleExitX + 2, botOuterY);
  ctx.lineTo(chamberLeftX, botOuterY);
  ctx.closePath();

  const wallGradBot = ctx.createLinearGradient(0, tunnelCy, 0, botOuterY);
  wallGradBot.addColorStop(0, '#1e293b');
  wallGradBot.addColorStop(0.35, '#475569');
  wallGradBot.addColorStop(1, '#334155');
  ctx.fillStyle = wallGradBot;
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(throatX, tunnelCy - throatHalfH - wallThickness * 0.5);
  ctx.lineTo(throatX, tunnelCy + throatHalfH + wallThickness * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`Dt ${state.Dt_mm.toFixed(2)}mm`, throatX - 28, botOuterY + 13);
  ctx.fillText(
    `Ds ${state.Ds_mm.toFixed(1)}mm · α=${state.alphaDeg.toFixed(0)}°`,
    Math.max(throatX + 38, nozzleExitX - 115),
    botOuterY + 13
  );

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chamberLeftX, tunnelCy);
  ctx.lineTo(plumeRightX, tunnelCy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.beginPath();
  ctx.moveTo(nozzleExitX, tunnelCy - rExitPx - 6);
  ctx.lineTo(nozzleExitX, tunnelCy + rExitPx + 6);
  ctx.stroke();
  ctx.restore();

  // --- 6. ANNOTATIONS & COLORBAR LEGEND ---
  ctx.save();
  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  if (state.regime === 'overexpanded' && state.betaObliqueDeg !== null) {
    ctx.fillStyle = '#fcd34d';
    ctx.fillText(
      `β=${state.betaObliqueDeg.toFixed(1)}° · δ=${state.alphaDeflectDeg?.toFixed(1)}° · λ≈${state.diamondSpacing_Ds.toFixed(2)}·Ds`,
      nozzleExitX + 12,
      Math.max(18, tunnelCy - rExitPx - 14)
    );
  } else if (state.regime === 'underexpanded' && state.thetaPMDeg !== null) {
    ctx.fillStyle = '#fdba74';
    ctx.fillText(
      `θ_PM=${state.thetaPMDeg.toFixed(1)}° · Mjet=${state.MextJet.toFixed(2)} · λ≈${state.diamondSpacing_Ds.toFixed(2)}·Ds`,
      nozzleExitX + 12,
      Math.max(18, tunnelCy - rExitPx - 18)
    );
  } else if (state.regime === 'adapted') {
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(
      `Pe ≈ Pa · Me=${state.Me_actual.toFixed(2)} · μ=${state.betaObliqueDeg?.toFixed(1)}°`,
      nozzleExitX + 12,
      Math.max(18, tunnelCy - rExitPx - 12)
    );
  }

  const barW = 122;
  const barH = 8;
  const barX = width - barW - 14;
  const barY = 12;
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  const stops =
    mode === 'mach'
      ? MACH_STOPS
      : mode === 'pressure'
        ? PRESSURE_STOPS
        : mode === 'thermal'
          ? THERMAL_STOPS
          : null;

  if (stops) {
    stops.forEach((s) => barGrad.addColorStop(s.p, `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`));
  } else {
    barGrad.addColorStop(0, 'rgb(35,40,47)');
    barGrad.addColorStop(0.5, 'rgb(142,147,154)');
    barGrad.addColorStop(1, 'rgb(250,255,255)');
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
  ctx.beginPath();
  ctx.roundRect(barX - 8, barY - 6, barW + 16, 44, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = barGrad;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  const leftLbl =
    mode === 'mach' ? '0' : mode === 'pressure' ? '0.0' : mode === 'thermal' ? '300K' : '∇ρ-';
  const rightLbl =
    mode === 'mach'
      ? `M ${maxMachScale.toFixed(1)}`
      : mode === 'pressure'
        ? 'P₀'
        : mode === 'thermal'
          ? `${Math.round(state.T0r_K)}K`
          : '∇ρ+';
  ctx.fillText(leftLbl, barX, barY + 19);
  ctx.fillText(rightLbl, barX + barW - ctx.measureText(rightLbl).width, barY + 19);

  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(barX, barY + 29);
  ctx.lineTo(barX + 12, barY + 29);
  ctx.stroke();
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(t?.shock_diamonds_label?.split(' ')[0] || 'Shock', barX + 15, barY + 32);

  ctx.strokeStyle = '#38bdf8';
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(barX + 60, barY + 29);
  ctx.lineTo(barX + 72, barY + 29);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText(t?.expansion_fan_label?.split(' ')[0] || 'Exp', barX + 75, barY + 32);
  ctx.restore();

  // --- 7. BOTTOM 1D AXIAL TELEMETRY STRIP ---
  if (showAxialPlot && plotH > 44) {
    const plotTop = tunnelH;
    const plotBottom = height - 8;
    const innerTop = plotTop + 20;
    const innerH = Math.max(34, plotBottom - innerTop - 10);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(0, plotTop, width, plotH);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, plotTop);
    ctx.lineTo(width, plotTop);
    ctx.stroke();

    ctx.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(t?.axial_profile_label || 'Perfil Axial: M(x) · P(x)/P₀ · T(x)/T₀', chamberLeftX, plotTop + 13);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText('— M(x)', chamberLeftX + 260, plotTop + 13);
    ctx.fillStyle = '#fb923c';
    ctx.fillText('— P/P₀', chamberLeftX + 312, plotTop + 13);
    ctx.fillStyle = '#facc15';
    ctx.fillText('— T/T₀', chamberLeftX + 362, plotTop + 13);

    const machMaxPlot = Math.max(2.5, state.Ms2 * 1.15);
    const machToY = (m: number) => innerTop + innerH * (1 - clamp(m / machMaxPlot, 0, 1));
    const normToY = (val: number) => innerTop + innerH * (1 - clamp(val, 0, 1));

    const yM1 = machToY(1.0);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chamberLeftX, yM1);
    ctx.lineTo(nozzleExitX, yM1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
    ctx.font = '8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('M=1', chamberLeftX - 18, yM1 + 3);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    ctx.moveTo(throatX, innerTop);
    ctx.lineTo(throatX, innerTop + innerH);
    ctx.moveTo(nozzleExitX, innerTop);
    ctx.lineTo(nozzleExitX, innerTop + innerH);
    ctx.stroke();

    if (state.regime === 'normal_shock' && state.shockPosNorm !== null) {
      const sx = xNormToPx(state.shockPosNorm);
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, innerTop);
      ctx.lineTo(sx, innerTop + innerH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < profile.length; i++) {
      const px = xNormToPx(profile[i].xNorm);
      const py = normToY(profile[i].tempK / Math.max(1, state.T0r_K));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < profile.length; i++) {
      const px = xNormToPx(profile[i].xNorm);
      const py = normToY(profile[i].pOverP0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let i = 0; i < profile.length; i++) {
      const px = xNormToPx(profile[i].xNorm);
      const py = machToY(profile[i].mach);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const infoX = nozzleExitX + 20;
    const infoW = Math.max(140, width - infoX - 14);
    if (infoW > 150) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.68)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.75)';
      ctx.beginPath();
      ctx.roundRect(infoX, plotTop + 8, infoW, plotH - 16, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('TTI THRESHOLDS & THRUST DECOMPOSITION', infoX + 10, plotTop + 21);

      const barLeft = infoX + 10;
      const barRight = infoX + infoW - 12;
      const maxPRef = Math.max(state.P_adapt_MPa * 1.25, state.P0_MPa * 1.15, 0.8);
      const pToBarX = (p: number) => barLeft + clamp(p / maxPRef, 0, 1) * (barRight - barLeft);

      const barTrackY = plotTop + 31;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barLeft, barTrackY, barRight - barLeft, 6);

      const xChoke = pToBarX(state.P_choke_MPa);
      const xExitShock = pToBarX(state.P_exit_shock_MPa);
      const xAdapt = pToBarX(state.P_adapt_MPa);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.fillRect(barLeft, barTrackY, Math.max(0, xChoke - barLeft), 6);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.fillRect(xChoke, barTrackY, Math.max(0, xExitShock - xChoke), 6);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.fillRect(xExitShock, barTrackY, Math.max(0, xAdapt - xExitShock), 6);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
      ctx.fillRect(xAdapt, barTrackY, Math.max(0, barRight - xAdapt), 6);

      const xNow = pToBarX(state.P0_MPa);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xNow - 1.5, barTrackY - 3, 3, 12);

      ctx.font = '8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `Choke: ${state.P_choke_MPa.toFixed(2)} | Exit: ${state.P_exit_shock_MPa.toFixed(2)} | Adapt: ${state.P_adapt_MPa.toFixed(2)} MPa`,
        infoX + 10,
        barTrackY + 19
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(
        `F_mom: ${state.momentumThrust_N.toFixed(0)}N + F_pres: ${state.pressureThrust_N.toFixed(0)}N · η_flujo: ${(state.MachFactor * 100).toFixed(1)}% · Ae/At: ${state.exprat.toFixed(2)}`,
        infoX + 10,
        barTrackY + 32
      );
    }

    ctx.restore();
  }
}

export const NozzleFlowViewer: React.FC<NozzleFlowViewerProps> = ({
  results,
  timeIndex,
  timeSec,
  motor,
  nozzle,
  isPlaying,
  speed,
  isIgnitionZoom = false,
  onToggleIgnitionZoom,
  onJumpToTimeSec,
  t,
}) => {
  const [viewMode, setViewMode] = useState<NozzleFlowViewMode>('mach');
  const [showAxialPlot, setShowAxialPlot] = useState(true);
  const [showWaveGuides, setShowWaveGuides] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<FlowParticle[]>(createInitialParticles(920));
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 420 });

  const effectiveTimeSec =
    timeSec !== undefined ? timeSec : (results.t?.[timeIndex] ?? 0);

  const flowState = useMemo(
    () => computeNozzleFlowStateAtTime(results, effectiveTimeSec, motor, nozzle),
    [results, effectiveTimeSec, motor, nozzle]
  );

  const axialProfile = useMemo(
    () => buildNozzleAxialProfile(flowState, 96),
    [flowState]
  );

  const ocnWindows = useMemo(
    () => findOcnWindows(results, motor, nozzle),
    [results, motor, nozzle]
  );

  const regimeMeta = useMemo(() => getRegimeMeta(flowState.regime, t), [flowState.regime, t]);

  const estimateCellCount = () => {
    const { w, h } = lastSizeRef.current;
    const plotH = showAxialPlot ? Math.max(96, Math.round(h * 0.28)) : 0;
    const tunnelH = Math.max(120, h - plotH);
    const nozzleSpanTarget = clamp(
      w * (0.31 + Math.min(0.11, (flowState.L_div_mm / Math.max(5, flowState.Dt_mm)) * 0.025)),
      w * 0.31,
      w * 0.43
    );
    const plumeLen = Math.max(100, w - nozzleSpanTarget - Math.max(32, w * 0.05));
    const maxRcNorm = axialProfile[0]?.radiusNorm || 2.1;
    const reNorm = axialProfile[axialProfile.length - 1]?.radiusNorm || 1.7;
    const maxPlumeScale = Math.max(maxRcNorm, reNorm * Math.max(1.3, flowState.jetExpansionRatio * 1.18));
    const throatHalfH = clamp((tunnelH * 0.35) / Math.max(1.4, maxPlumeScale), 9, tunnelH * 0.2);
    const DsPx = throatHalfH * reNorm * 2;
    const cellLenPx = clamp(flowState.diamondSpacing_Ds * DsPx * 0.92, 46, plumeLen * 0.48);
    return plumeLen / cellLenPx;
  };

  const latestRef = useRef({
    flowState,
    axialProfile,
    viewMode,
    showAxialPlot,
    showWaveGuides,
    isPlaying,
    speed,
    t,
  });
  latestRef.current = {
    flowState,
    axialProfile,
    viewMode,
    showAxialPlot,
    showWaveGuides,
    isPlaying,
    speed,
    t,
  };

  const renderFrame = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(250, Math.floor(rect.height));
    lastSizeRef.current = { w, h };
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cur = latestRef.current;
    drawNozzleScene(
      ctx,
      w,
      h,
      cur.flowState,
      cur.axialProfile,
      cur.viewMode,
      cur.showAxialPlot,
      cur.showWaveGuides,
      particlesRef.current,
      cur.t
    );
  };

  // Pre-relax particle density distribution when paused or scrubbing so shock diamonds
  // appear faithfully via particle continuity even in still/paused inspection frames
  useEffect(() => {
    if (!isPlaying && flowState.regime !== 'idle') {
      relaxParticlesContinuity(particlesRef.current, flowState, axialProfile, estimateCellCount(), 22);
    }
    renderFrame();
  }, [flowState, axialProfile, viewMode, showAxialPlot, showWaveGuides, isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let resizeRafId: number | null = null;
    const obs = new ResizeObserver(() => {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        renderFrame();
      });
    });
    obs.observe(container);
    return () => {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      obs.disconnect();
    };
  }, []);

  // Particle advection loop — speed modulates dynamically across shock & expansion zones
  useEffect(() => {
    if (!isPlaying || flowState.regime === 'idle') {
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const cur = latestRef.current;
      // Keep particle motion clearly legible even at ultra-slow-motion speeds
      const visualSpd = Math.max(0.2, Math.min(2.4, cur.speed || 1));
      const parts = particlesRef.current;
      const cells = estimateCellCount();

      for (let i = 0; i < parts.length; i++) {
        const pt = parts[i];
        const field = evaluateLocalField(pt.u, pt.vFrac, cur.flowState, cur.axialProfile, cells);
        pt.u += dt * visualSpd * field.speedNorm;
        if (pt.u > 3.8) {
          pt.u = -0.45 + ((pt.u - 3.8) % 0.22);
        }
      }

      renderFrame();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, flowState.regime]);

  return (
    <div className="flex flex-col w-full h-full min-h-[395px] bg-slate-950 text-slate-100 rounded-lg overflow-hidden border border-slate-800 select-none">
      {/* Top Aerospace HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[10px] font-bold ${regimeMeta.badgeClass}`}>
            <span className={`w-2 h-2 rounded-full ${regimeMeta.dotClass}`} />
            <span>{regimeMeta.label}</span>
          </div>

          {flowState.regime === 'normal_shock' && flowState.shockPosNorm !== null && (
            <span className="font-mono text-[10px] text-rose-300 bg-rose-950/60 border border-rose-700/50 rounded px-2 py-0.5 tabular-nums">
              {t?.shock_position_label || 'Choque'}: {(flowState.shockPosNorm * 100).toFixed(1)}% · M₁={flowState.M1_shock?.toFixed(2)}→M₂={flowState.M2_shock?.toFixed(2)}
            </span>
          )}
          {flowState.regime === 'overexpanded' && flowState.betaObliqueDeg !== null && (
            <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded px-2 py-0.5 tabular-nums">
              {t?.oblique_shock_angle || 'β Choque Oblicuo'}: {flowState.betaObliqueDeg.toFixed(1)}°
            </span>
          )}
          {flowState.regime === 'underexpanded' && flowState.thetaPMDeg !== null && (
            <span className="font-mono text-[10px] text-orange-300 bg-orange-950/60 border border-orange-700/50 rounded px-2 py-0.5 tabular-nums">
              {t?.pm_expansion_angle || 'Prandtl-Meyer θ'}: {flowState.thetaPMDeg.toFixed(1)}°
            </span>
          )}
        </div>

        {/* Quick OCN Transient Inspector + CFD Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onJumpToTimeSec && (
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => onJumpToTimeSec(ocnWindows.ignitionFocusSec, 0.05)}
                className="flex items-center gap-1 px-2 py-1 rounded text-rose-300 hover:bg-rose-950/60 transition-colors"
                title={t?.ocn_ignition_btn || 'Ir al choque inicial (OCN encendido) a 0.05x'}
              >
                <Zap size={11} />
                <span>{t?.ocn_ignition_btn || 'Encendido (OCN)'}</span>
              </button>
              {onToggleIgnitionZoom && (
                <button
                  type="button"
                  onClick={() =>
                    onToggleIgnitionZoom(ocnWindows.ignitionStartSec, ocnWindows.ignitionEndSec)
                  }
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    isIgnitionZoom
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Search size={11} />
                  <span>{isIgnitionZoom ? (t?.zoom_full_burn_btn || 'Vista Completa') : (t?.zoom_ignition_btn || 'Zoom T₀')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onJumpToTimeSec(ocnWindows.tailoffFocusSec, 0.05)}
                className="flex items-center gap-1 px-2 py-1 rounded text-amber-300 hover:bg-amber-950/60 transition-colors"
                title={t?.ocn_tailoff_btn || 'Ir al choque final (Tail-off) a 0.05x'}
              >
                <span>{t?.ocn_tailoff_btn || 'Tail-off (OCN)'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('mach')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === 'mach'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gauge size={11} />
              <span>{t?.flow_mode_mach || 'Mach'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pressure')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === 'pressure'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame size={11} />
              <span>{t?.flow_mode_pressure || 'P(x)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('thermal')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === 'thermal'
                  ? 'bg-orange-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer size={11} />
              <span>{t?.flow_mode_temp || 'Temp'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('schlieren')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === 'schlieren'
                  ? 'bg-slate-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={11} />
              <span>{t?.flow_mode_schlieren || 'Schlieren'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowWaveGuides((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border font-mono text-[10px] transition-colors ${
              showWaveGuides
                ? 'bg-amber-950/80 border-amber-700/70 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={t?.wave_guides_label || 'Mostrar/ocultar guías de ondas de choque y expansión'}
          >
            <Waves size={11} />
            <span className="hidden xl:inline">{t?.wave_guides_label || 'Ondas'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAxialPlot((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border font-mono text-[10px] transition-colors ${
              showAxialPlot
                ? 'bg-cyan-950/80 border-cyan-700/70 text-cyan-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={t?.axial_profile_label || 'Perfil Axial M(x) / P(x)'}
          >
            <LineChart size={11} />
            <span className="hidden xl:inline">M(x)/P(x)</span>
          </button>
        </div>
      </div>

      {/* Live TTI Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 font-mono text-[10px] tabular-nums shrink-0">
        <div className="flex flex-wrap items-center gap-3.5">
          <div>
            <span className="text-slate-500 mr-1">P₀:</span>
            <strong className="text-sky-300">{flowState.P0_MPa.toFixed(3)}</strong>
            <span className="text-slate-500 ml-0.5">MPa</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">Dt:</span>
            <strong className="text-slate-200">{flowState.Dt_mm.toFixed(2)}</strong>
            <span className="text-slate-500 ml-0.5">mm</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">{t?.mass_flow_label || 'ṁ'}:</span>
            <strong className="text-teal-300">{flowState.mDot_kg_s.toFixed(3)}</strong>
            <span className="text-slate-500 ml-0.5">kg/s</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">{t?.exit_mach_label || 'Mach'}:</span>
            <strong className="text-emerald-300">{flowState.Me_actual.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-slate-500 mr-1">Pe/Pa:</span>
            <strong className={
              flowState.Pe_over_Pa > 1.05
                ? 'text-orange-300'
                : flowState.Pe_over_Pa < 0.95
                  ? 'text-amber-300'
                  : 'text-emerald-300'
            }>
              {flowState.Pe_over_Pa.toFixed(2)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 mr-1">{t?.exit_temp_label || 'Te'}:</span>
            <strong className="text-yellow-300">{flowState.Te_K.toFixed(0)}</strong>
            <span className="text-slate-500 ml-0.5">K</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">vₑ:</span>
            <strong className="text-cyan-300">{flowState.ve_ms.toFixed(0)}</strong>
            <span className="text-slate-500 ml-0.5">m/s</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1">{t?.flow_factor_label || 'η_flujo'}:</span>
            <strong className="text-indigo-300">{(flowState.MachFactor * 100).toFixed(1)}%</strong>
          </div>
          <div>
            <span className="text-slate-500 mr-1">E_TTI:</span>
            <strong className="text-orange-400">{flowState.TTI_Thrust_N.toFixed(1)}</strong>
            <span className="text-slate-500 ml-0.5">N</span>
          </div>
        </div>

        {flowState.machDiskRatio > 0 && (
          <div className="flex items-center gap-1 text-rose-300">
            <Waves size={11} />
            <span>{t?.mach_disk_label || 'Disco de Mach'}: {(flowState.machDiskRatio * 100).toFixed(0)}% Ds</span>
          </div>
        )}
      </div>

      {/* Responsive Wind Tunnel Canvas */}
      <div ref={containerRef} className="flex-1 min-h-[275px] relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </div>
    </div>
  );
};
