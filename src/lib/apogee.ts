export type RecoveryMode = 'none' | 'single' | 'dual';
export type FlightPhaseTag = 'pad' | 'powered' | 'coast' | 'drogue' | 'main' | 'landed';

export const MIN_SAFE_RAIL_VELOCITY_MS = 15.0; // Standard rocketry guideline (~50 ft/s)

export function computeMinSafeRailVelocity(windSpeedMs: number = 0): number {
  const windAbs = Math.abs(Number(windSpeedMs) || 0);
  // Classic 4.5x wind-speed rule (keeps rail-exit angle of attack <= ~12.5 deg) with 15 m/s minimum floor
  return Math.max(MIN_SAFE_RAIL_VELOCITY_MS, 4.5 * windAbs);
}

export interface StandardAtmospherePoint {
  tempK: number;
  pressurePa: number;
  rho: number;
  speedOfSound: number;
}

export interface ApogeeOptions {
  railLengthM?: number;
  windSpeedMs?: number;
  recoveryMode?: RecoveryMode;
  chuteDiameterM?: number;
  chuteCd?: number;
  drogueDiameterM?: number;
  drogueCd?: number;
  mainDeployAltM?: number;
}

export interface ApogeeResult {
  t: number[];
  x: number[];
  h: number[];
  v: number[];
  vx: number[];
  vy: number[];
  a: number[];
  mach: number[];
  pitch: number[]; // body/velocity elevation pitch above horizontal [rad]
  gammaDeg: number[];
  phase?: FlightPhaseTag[];
  maxApogee: number;
  maxRange: number;
  maxVelocity: number;
  maxAcceleration: number;
  apogeeTime: number;
  burnoutTime: number;
  flightPathAngleDeg: number;
  rocketDiameterM: number;
  launchAltitudeM: number;
  // Launch rail & recovery telemetry
  railLengthM: number;
  railExitVelocity: number;
  railExitTime: number;
  railExitAngleOfAttackDeg: number;
  railExitAirspeed: number;
  clearedRail: boolean;
  minRecommendedRailVel: number;
  windSpeedMs: number;
  recoveryMode: RecoveryMode;
  descentRateMs?: number;
  landingTime?: number;
  landingRange?: number;
  drogueDeployTime?: number;
  mainDeployTime?: number;
  mainDeployAltM?: number;
}

// Minimal Mach-Cd reference data (used when user has not uploaded a custom Mach vs Cd curve)
const DEFAULT_MACH_REF = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0];
const DEFAULT_CD_REF = [0.45, 0.45, 0.44, 0.44, 0.46, 0.52, 0.61, 0.65, 0.66, 0.61, 0.55, 0.51, 0.48, 0.42, 0.38, 0.35, 0.33];

const ISA_G0 = 9.80665;
const ISA_R_AIR = 287.05287;
const ISA_GAMMA = 1.4;
const ISA_R_EARTH = 6356766.0;

// US Standard Atmosphere 1976 geopotential layers: [hBase_m, TBase_K, lapse_K_per_m, PBase_Pa]
const ISA_LAYERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 288.15, -0.0065, 101325.0],          // Troposphere (0 - 11 km)
  [11000, 216.65, 0.0, 22632.06397],       // Tropopause isothermal (11 - 20 km)
  [20000, 216.65, 0.0010, 5474.88867],     // Lower Stratosphere (20 - 32 km)
  [32000, 228.65, 0.0028, 868.01868],      // Upper Stratosphere (32 - 47 km)
  [47000, 270.65, 0.0, 110.90631],         // Stratopause isothermal (47 - 51 km)
  [51000, 270.65, -0.0028, 66.93887],      // Lower Mesosphere (51 - 71 km)
  [71000, 214.65, -0.0020, 3.95642],       // Upper Mesosphere (71 - 84.852 km)
];

function computeIsaLayerState(altGeometricM: number): { T_isa: number; P_isa: number; H_geop: number } {
  const z = Math.max(-500, Number(altGeometricM) || 0);
  const H = (ISA_R_EARTH * z) / (ISA_R_EARTH + z);

  if (H >= 84852.0) {
    const T_top = 186.946;
    const P_84 = 0.37338;
    const P_top = P_84 * Math.exp((-ISA_G0 * (H - 84852.0)) / (ISA_R_AIR * T_top));
    return { T_isa: T_top, P_isa: Math.max(0, P_top), H_geop: H };
  }

  let layerIdx = 0;
  for (let i = ISA_LAYERS.length - 1; i >= 0; i--) {
    if (H >= ISA_LAYERS[i][0]) {
      layerIdx = i;
      break;
    }
  }

  const [hB, tB, lapse, pB] = ISA_LAYERS[layerIdx];
  const dh = H - hB;
  const T_isa = Math.max(150, tB + lapse * dh);

  let P_isa: number;
  if (Math.abs(lapse) < 1e-12) {
    P_isa = pB * Math.exp((-ISA_G0 * dh) / (ISA_R_AIR * tB));
  } else {
    P_isa = pB * Math.pow(T_isa / tB, -ISA_G0 / (ISA_R_AIR * lapse));
  }

  return { T_isa, P_isa, H_geop: H };
}

/**
 * Multi-layer US Standard Atmosphere 1976 with tropopause & stratosphere/mesosphere layers,
 * smoothly incorporating optional launch-pad ambient temperature offset up to 11 km tropopause.
 */
export function computeStandardAtmosphere(
  altGeometricM: number,
  launchTempC?: number,
  launchAltM: number = 0
): StandardAtmospherePoint {
  const { T_isa, P_isa, H_geop } = computeIsaLayerState(altGeometricM);

  let tempK = T_isa;
  if (launchTempC !== undefined && !isNaN(launchTempC)) {
    const { T_isa: T_isa_pad, H_geop: H_pad } = computeIsaLayerState(launchAltM);
    const deltaT_pad = (273.15 + launchTempC) - T_isa_pad;
    const blendCeiling = H_pad < 11000 ? 11000 : H_pad + 11000;
    const span = Math.max(100, blendCeiling - H_pad);
    const blend = Math.max(0, Math.min(1, (blendCeiling - H_geop) / span));
    tempK = Math.max(150, T_isa + deltaT_pad * blend);
  }

  const rho = Math.max(0, P_isa / (ISA_R_AIR * tempK));
  const speedOfSound = Math.max(1, Math.sqrt(ISA_GAMMA * ISA_R_AIR * tempK));
  return {
    tempK,
    pressurePa: P_isa,
    rho,
    speedOfSound,
  };
}

export function getAtmosphericPressurePa(altGeometricM: number): number {
  return computeIsaLayerState(altGeometricM).P_isa;
}

function interp1(x: number[], y: number[], xi: number): number {
  if (!x || x.length === 0 || !y || y.length === 0) return 0.45;
  if (x.length === 1) return y[0];
  if (xi <= x[0]) return y[0];
  if (xi >= x[x.length - 1]) return y[y.length - 1];

  for (let i = 0; i < x.length - 1; i++) {
    if (xi >= x[i] && xi <= x[i + 1]) {
      const dx = x[i + 1] - x[i];
      if (dx === 0) return y[i];
      const dy = y[i + 1] - y[i];
      return y[i] + (dy * (xi - x[i])) / dx;
    }
  }
  return y[y.length - 1];
}

/**
 * Calculates the exact supersonic exit Mach number from area expansion ratio
 */
export function getExitMach(epsilon: number, k: number): number {
  if (epsilon <= 1) return 1.0;
  let low = 1.0;
  let high = 10.0;
  const f = (M: number) => {
    const term = (2 / (k + 1)) * (1 + ((k - 1) / 2) * M * M);
    return (1 / M) * Math.pow(term, (k + 1) / (2 * (k - 1)));
  };

  if (f(high) < epsilon) {
    high = 20.0;
  }

  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const val = f(mid);
    if (Math.abs(val - epsilon) < 1e-6) return mid;
    if (val > epsilon) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * Calculates the exact TTI thrust coefficient CF
 */
export function getTTIThrustCoefficient(
  P_Pa: number,
  Pa_atm: number,
  k: number,
  epsilon: number,
  alpha_deg: number,
  etanoz: number
): number {
  if (P_Pa <= Pa_atm) return 0;

  const Me = getExitMach(epsilon, k);
  const Pe = P_Pa / Math.pow(1 + ((k - 1) / 2) * Me * Me, k / (k - 1));

  const alpha_rad = (alpha_deg * Math.PI) / 180;
  const lambda = (1 + Math.cos(alpha_rad)) / 2;

  const t1 = (2 * k * k) / (k - 1);
  const t2 = Math.pow(2 / (k + 1), (k + 1) / (k - 1));
  const t3 = 1 - Math.pow(Pe / P_Pa, (k - 1) / k);
  const momentum_CF = Math.sqrt(t1 * t2 * t3);

  const pressure_CF = ((Pe - Pa_atm) / P_Pa) * epsilon;

  const CF = etanoz * (lambda * momentum_CF + pressure_CF);
  return Math.max(0, CF);
}

export function calculateApogee(
  tt: number[],
  vec_thrust_N: number[],
  vec_mass: number[], // m_dry + mgra_total
  m_dry: number,
  d_rocket: number = 0.08,
  h_launch: number = 169,
  T_celcius: number = 28,
  mach_ref_raw: number[] = DEFAULT_MACH_REF,
  cd_ref_raw: number[] = DEFAULT_CD_REF,
  flight_path_angle_deg: number = 90,
  options?: ApogeeOptions
): ApogeeResult {
  // Sanitize and sort Mach-Cd pairs
  let mach_ref = DEFAULT_MACH_REF;
  let cd_ref = DEFAULT_CD_REF;
  if (mach_ref_raw && cd_ref_raw && mach_ref_raw.length > 0 && cd_ref_raw.length > 0) {
    const pairs: { m: number; cd: number }[] = [];
    const len = Math.min(mach_ref_raw.length, cd_ref_raw.length);
    for (let i = 0; i < len; i++) {
      if (!isNaN(mach_ref_raw[i]) && !isNaN(cd_ref_raw[i])) {
        pairs.push({ m: Math.max(0, mach_ref_raw[i]), cd: Math.max(0.01, cd_ref_raw[i]) });
      }
    }
    if (pairs.length > 0) {
      pairs.sort((a, b) => a.m - b.m);
      mach_ref = pairs.map((p) => p.m);
      cd_ref = pairs.map((p) => p.cd);
    }
  }

  const railLengthM = Math.max(0.1, Number(options?.railLengthM ?? 2.0) || 2.0);
  const windSpeedMs = Number.isFinite(Number(options?.windSpeedMs)) ? Number(options?.windSpeedMs) : 0;
  const recoveryMode: RecoveryMode = options?.recoveryMode ?? 'single';
  const chuteDiameterM = Math.max(0.05, Number(options?.chuteDiameterM ?? 1.5) || 1.5);
  const chuteCd = Math.max(0.1, Number(options?.chuteCd ?? 1.5) || 1.5);
  const drogueDiameterM = Math.max(0.05, Number(options?.drogueDiameterM ?? 0.45) || 0.45);
  const drogueCd = Math.max(0.1, Number(options?.drogueCd ?? 1.5) || 1.5);
  const mainDeployAltM = Math.max(10, Number(options?.mainDeployAltM ?? 300) || 300);

  const mainChuteCdA = chuteCd * (Math.PI / 4) * chuteDiameterM * chuteDiameterM;
  const drogueChuteCdA = drogueCd * (Math.PI / 4) * drogueDiameterM * drogueDiameterM;
  const minRecommendedRailVel = computeMinSafeRailVelocity(windSpeedMs);

  const N = tt.length;
  const g0 = ISA_G0;
  const R_earth_mean = 6371000;

  // Flight path angle convention: elevation above horizontal (90° = vertical, 87° = 3° tilt, 0° = horizontal)
  const angle_deg = Math.max(0, Math.min(90, isNaN(flight_path_angle_deg) ? 90 : flight_path_angle_deg));
  const theta_0 = (angle_deg * Math.PI) / 180;
  const cos_theta_0 = Math.cos(theta_0);
  const sin_theta_0 = Math.sin(theta_0);
  const area_ref = (Math.PI * Math.pow(d_rocket, 2)) / 4;

  let t = 0;
  let x = 0;
  let h = 0;
  let vx = 0;
  let vy = 0;
  let v = 0;
  const default_dt = tt.length > 1 ? Math.max(1e-5, tt[1] - tt[0]) : 0.001;

  const hist_t: number[] = [];
  const hist_x: number[] = [];
  const hist_h: number[] = [];
  const hist_v: number[] = [];
  const hist_vx: number[] = [];
  const hist_vy: number[] = [];
  const hist_a: number[] = [];
  const hist_mach: number[] = [];
  const hist_pitch: number[] = [];
  const hist_gamma: number[] = [];
  const hist_phase: FlightPhaseTag[] = [];

  let idx = 0;
  let maxApogee = 0;
  let maxRange = 0;
  let maxVelocity = 0;
  let maxAcceleration = 0;
  let apogeeTime = 0;
  const burnoutTime = N > 0 ? tt[N - 1] || 0 : 0;

  let leftRail = false;
  let clearedRail = false;
  let railExitVelocity = 0;
  let railExitTime = 0;
  let railExitAngleOfAttackDeg = 0;
  let railExitAirspeed = 0;
  let maxRailVelocitySeen = 0;

  let apogeeReached = false;
  let drogueDeployTime: number | undefined = undefined;
  let mainDeployTime: number | undefined = undefined;
  let landingTime: number | undefined = undefined;
  let landingRange: number | undefined = undefined;
  let descentRateMs: number | undefined = undefined;

  const computeRailExitAero = (vRail: number) => {
    const vParallelAir = vRail - windSpeedMs * cos_theta_0;
    const vPerpAir = Math.abs(windSpeedMs * sin_theta_0);
    const airspeed = Math.hypot(vParallelAir, vPerpAir);
    const aoaDeg =
      airspeed > 1e-4
        ? (Math.atan2(vPerpAir, Math.max(0.05, vParallelAir)) * 180) / Math.PI
        : 0;
    return { airspeed, aoaDeg };
  };

  const safeDryMass = Math.max(0.01, Number(m_dry) || 0.01);

  const computeAtmoAndGravity = (altRelM: number) => {
    const hAbs = h_launch + Math.max(0, altRelM);
    const gLocal = g0 * Math.pow(R_earth_mean / (R_earth_mean + hAbs), 2);
    const atmo = computeStandardAtmosphere(hAbs, T_celcius, h_launch);
    return { gLocal, ...atmo };
  };

  const computeAscentDeriv = (
    altRelM: number,
    vxState: number,
    vyState: number,
    thrustN: number,
    massKg: number,
    onRail: boolean
  ) => {
    const { gLocal, rho, speedOfSound } = computeAtmoAndGravity(altRelM);
    const weight = massKg * gLocal;
    const vx_air = vxState - windSpeedMs;
    const vy_air = vyState;
    const v_air = Math.hypot(vx_air, vy_air);
    const machVal = v_air / speedOfSound;
    const cdVal = interp1(mach_ref, cd_ref, machVal);

    if (onRail) {
      const dragAlongRail =
        v_air > 1e-6
          ? 0.5 * rho * v_air * (vx_air * cos_theta_0 + vy_air * sin_theta_0) * cdVal * area_ref
          : 0;
      const F_rail = thrustN - dragAlongRail - weight * sin_theta_0;
      const vAlongRail = vxState * cos_theta_0 + vyState * sin_theta_0;
      if (vAlongRail <= 1e-6 && F_rail <= 0) {
        return { ax: 0, ay: 0, mach: machVal };
      }
      const a_rail = F_rail / massKg;
      return { ax: a_rail * cos_theta_0, ay: a_rail * sin_theta_0, mach: machVal };
    }

    const q_air = 0.5 * rho * v_air * v_air;
    const drag_mag = q_air * cdVal * area_ref;

    const vInertial = Math.hypot(vxState, vyState);
    const aeroPitch = v_air > 0.25 ? Math.atan2(vy_air, vx_air) : theta_0;
    const inertialPitch = vInertial > 0.25 ? Math.atan2(vyState, vxState) : theta_0;
    const aeroBlend = Math.min(1, q_air / 50);
    const angleDiff = Math.atan2(Math.sin(aeroPitch - inertialPitch), Math.cos(aeroPitch - inertialPitch));
    const pitchRad = inertialPitch + aeroBlend * angleDiff;

    const thrust_x = thrustN * Math.cos(pitchRad);
    const thrust_y = thrustN * Math.sin(pitchRad);

    const drag_x = v_air > 1e-6 ? drag_mag * (vx_air / v_air) : 0;
    const drag_y = v_air > 1e-6 ? drag_mag * (vy_air / v_air) : 0;

    return {
      ax: (thrust_x - drag_x) / massKg,
      ay: (thrust_y - drag_y - weight) / massKg,
      mach: machVal,
    };
  };

  // Record exact initial pad state at t = 0 before advancing any step
  const initialT = N > 0 ? Number(tt[0]) || 0 : 0;
  const initialThrust = N > 0 ? Number(vec_thrust_N[0]) || 0 : 0;
  const initialMass = N > 0 ? Math.max(0.01, Number(vec_mass[0]) || safeDryMass) : safeDryMass;
  const initialDeriv = computeAscentDeriv(0, 0, 0, initialThrust, initialMass, true);
  const initialAccel = Math.hypot(initialDeriv.ax, initialDeriv.ay);

  t = initialT;
  hist_t.push(t);
  hist_x.push(0);
  hist_h.push(0);
  hist_v.push(0);
  hist_vx.push(0);
  hist_vy.push(0);
  hist_a.push(initialAccel);
  hist_mach.push(initialDeriv.mach);
  hist_pitch.push(theta_0);
  hist_gamma.push(angle_deg);
  hist_phase.push('pad');
  maxAcceleration = Math.max(maxAcceleration, initialAccel);
  idx = N > 1 ? 1 : N;

  while (true) {
    if (!apogeeReached) {
      let thrustStart = 0;
      let thrustMid = 0;
      let thrustEnd = 0;
      let massStart = safeDryMass;
      let massMid = safeDryMass;
      let current_dt = 0.015;

      if (idx < N) {
        const prevIdx = Math.max(0, idx - 1);
        const f0 = Number(vec_thrust_N[prevIdx] ?? 0) || 0;
        const f1 = Number(vec_thrust_N[idx] ?? 0) || 0;
        const m0 = Math.max(0.01, Number(vec_mass[prevIdx] ?? safeDryMass) || safeDryMass);
        const m1 = Math.max(0.01, Number(vec_mass[idx] ?? safeDryMass) || safeDryMass);
        thrustStart = f0;
        thrustMid = 0.5 * (f0 + f1);
        thrustEnd = f1;
        massStart = m0;
        massMid = 0.5 * (m0 + m1);
        current_dt = Math.max(1e-6, (Number(tt[idx]) || t) - (Number(tt[prevIdx]) || t));
      }

      const prevDist = Math.hypot(x, h);
      const prevV = v;
      const prevT = t;
      const on_launch_rail = !leftRail && prevDist < railLengthM;

      // RK2 (Midpoint method) ascent integration
      const k1 = computeAscentDeriv(h, vx, vy, thrustStart, massStart, on_launch_rail);
      const hMid = Math.max(0, h + 0.5 * current_dt * vy);
      const vxMid = vx + 0.5 * current_dt * k1.ax;
      const vyMid = vy + 0.5 * current_dt * k1.ay;
      const k2 = computeAscentDeriv(hMid, vxMid, vyMid, thrustMid, massMid, on_launch_rail);

      const xNext = x + vxMid * current_dt;
      const hNext = h + vyMid * current_dt;
      let vxNext = vx + k2.ax * current_dt;
      let vyNext = vy + k2.ay * current_dt;

      if (on_launch_rail) {
        const v_rail = vxNext * cos_theta_0 + vyNext * sin_theta_0;
        if (v_rail <= 0) {
          vxNext = 0;
          vyNext = 0;
        } else {
          vxNext = v_rail * cos_theta_0;
          vyNext = v_rail * sin_theta_0;
        }
      }

      x = xNext;
      h = hNext;
      vx = vxNext;
      vy = vyNext;
      v = Math.hypot(vx, vy);

      if (on_launch_rail && v > maxRailVelocitySeen) {
        maxRailVelocitySeen = v;
      }

      if (h < 0) {
        h = 0;
        if (vy < 0) {
          vy = 0;
          v = Math.abs(vx);
        }
      }

      t = idx < N ? tt[idx] : t + current_dt;

      const total_a = Math.hypot(k2.ax, k2.ay);
      const mach = k2.mach;

      const newDist = Math.hypot(x, h);
      if (on_launch_rail && newDist >= railLengthM) {
        const frac = Math.max(0, Math.min(1, (railLengthM - prevDist) / Math.max(1e-9, newDist - prevDist)));
        railExitVelocity = prevV + frac * (v - prevV);
        railExitTime = prevT + frac * (t - prevT);
        const exitAero = computeRailExitAero(railExitVelocity);
        railExitAirspeed = exitAero.airspeed;
        railExitAngleOfAttackDeg = exitAero.aoaDeg;
        clearedRail = true;
        leftRail = true;
      }

      const currentGammaRad = on_launch_rail ? theta_0 : v > 0.1 ? Math.atan2(vy, vx) : theta_0;
      const tag: FlightPhaseTag =
        idx < N && Math.max(thrustStart, thrustEnd) > 1e-3
          ? 'powered'
          : 'coast';

      hist_t.push(t);
      hist_x.push(x);
      hist_h.push(h);
      hist_v.push(v);
      hist_vx.push(vx);
      hist_vy.push(vy);
      hist_a.push(total_a);
      hist_mach.push(mach);
      hist_pitch.push(currentGammaRad);
      hist_gamma.push((currentGammaRad * 180) / Math.PI);
      hist_phase.push(tag);

      if (h >= maxApogee) {
        maxApogee = h;
        apogeeTime = t;
      }
      if (Math.abs(x) > maxRange) maxRange = Math.abs(x);
      if (v > maxVelocity) maxVelocity = v;
      if (total_a > maxAcceleration) maxAcceleration = total_a;

      idx++;

      if (vy <= 0 && idx >= N) {
        apogeeReached = true;
        if (!clearedRail) {
          railExitVelocity = maxRailVelocitySeen;
          railExitTime = apogeeTime;
          const exitAero = computeRailExitAero(railExitVelocity);
          railExitAirspeed = exitAero.airspeed;
          railExitAngleOfAttackDeg = exitAero.aoaDeg;
        }
        if (recoveryMode === 'none' || h <= 0.1) {
          break;
        }
        if (recoveryMode === 'single') {
          mainDeployTime = t;
        } else {
          // dual-deploy: drogue at apogee, or main immediately if apogee <= mainDeployAltM
          if (h <= mainDeployAltM) {
            mainDeployTime = t;
          } else {
            drogueDeployTime = t;
          }
        }
      }

      if (idx > 1000000) break;
    } else {
      // Recovery Descent Phase (RK2 / Midpoint sub-stepping at 10 ms internal dt, recording every 50 ms)
      const recordDt = 0.05;
      const subSteps = 5;
      const subDt = recordDt / subSteps;

      let lastAccel = 0;
      let lastMach = 0;
      let activePhase: FlightPhaseTag = 'main';

      for (let s = 0; s < subSteps; s++) {
        const stepPrevH = h;
        const stepPrevX = x;
        const stepPrevT = t;
        const stepPrevVy = vy;

        if (recoveryMode === 'dual' && mainDeployTime === undefined && h <= mainDeployAltM) {
          mainDeployTime = t;
        }

        const chuteInflationSec = 1.25;
        let chuteCdA = 0;
        if (mainDeployTime !== undefined) {
          const inflate = Math.min(1, Math.max(0.05, (t - mainDeployTime) / chuteInflationSec));
          chuteCdA = mainChuteCdA * inflate;
          activePhase = 'main';
        } else if (drogueDeployTime !== undefined) {
          const inflate = Math.min(1, Math.max(0.05, (t - drogueDeployTime) / chuteInflationSec));
          chuteCdA = drogueChuteCdA * inflate;
          activePhase = 'drogue';
        }

        const evalDeriv = (altM: number, vxState: number, vyState: number) => {
          const { gLocal, rho, speedOfSound } = computeAtmoAndGravity(altM);
          const vxAir = vxState - windSpeedMs;
          const vyAir = vyState;
          const vAir = Math.hypot(vxAir, vyAir);
          const machVal = vAir / speedOfSound;
          const rocketCd = interp1(mach_ref, cd_ref, machVal);
          const totalCdA = rocketCd * area_ref + chuteCdA;
          const dragMag = 0.5 * rho * vAir * vAir * totalCdA;
          const axD = vAir > 1e-6 ? (-dragMag * (vxAir / vAir)) / safeDryMass : 0;
          const ayD = (vAir > 1e-6 ? (-dragMag * (vyAir / vAir)) / safeDryMass : 0) - gLocal;
          return { axD, ayD, machVal };
        };

        // RK2 (Midpoint method) for unconditional parachute numerical smoothness
        const k1 = evalDeriv(h, vx, vy);
        const hMid = Math.max(0, h + 0.5 * subDt * vy);
        const vxMid = vx + 0.5 * subDt * k1.axD;
        const vyMid = vy + 0.5 * subDt * k1.ayD;
        const k2 = evalDeriv(hMid, vxMid, vyMid);

        x += vxMid * subDt;
        h += vyMid * subDt;
        vx += k2.axD * subDt;
        vy += k2.ayD * subDt;
        t += subDt;

        lastAccel = Math.hypot(k2.axD, k2.ayD);
        lastMach = k2.machVal;

        if (h <= 0) {
          // Linear ground intersection within the exact 10 ms sub-step
          const denom = Math.max(1e-9, stepPrevH - h);
          const frac = Math.max(0, Math.min(1, stepPrevH / denom));
          t = stepPrevT + frac * (t - stepPrevT);
          x = stepPrevX + frac * (x - stepPrevX);
          const touchVy = stepPrevVy + frac * (vy - stepPrevVy);
          descentRateMs = Math.abs(touchVy);
          landingTime = t;
          landingRange = x;
          h = 0;
          vy = 0;
          v = Math.abs(vx);
          activePhase = 'landed';
          break;
        }
      }

      v = Math.hypot(vx, vy);
      if (Math.abs(x) > maxRange) maxRange = Math.abs(x);

      const gammaRad = activePhase === 'landed' ? Math.PI / 2 : v > 0.1 ? Math.atan2(vy, vx) : -Math.PI / 2;
      // Under parachute, rocket hangs nose-up / upright around +PI/2 with slight wind swing
      const bodyPitchRad =
        Math.PI / 2 - Math.max(-0.35, Math.min(0.35, ((vx - windSpeedMs) * 0.03)));

      hist_t.push(t);
      hist_x.push(x);
      hist_h.push(h);
      hist_v.push(v);
      hist_vx.push(vx);
      hist_vy.push(vy);
      hist_a.push(lastAccel);
      hist_mach.push(lastMach);
      hist_pitch.push(bodyPitchRad);
      hist_gamma.push((gammaRad * 180) / Math.PI);
      hist_phase.push(activePhase);

      idx++;
      if (h <= 0 || t > 2400 || idx > 150000) {
        if (landingTime === undefined) {
          landingTime = t;
          landingRange = x;
          descentRateMs = Math.abs(vy);
        }
        break;
      }
    }
  }

  return {
    t: hist_t,
    x: hist_x,
    h: hist_h,
    v: hist_v,
    vx: hist_vx,
    vy: hist_vy,
    a: hist_a,
    mach: hist_mach,
    pitch: hist_pitch,
    gammaDeg: hist_gamma,
    phase: hist_phase,
    maxApogee,
    maxRange,
    maxVelocity,
    maxAcceleration,
    apogeeTime,
    burnoutTime,
    flightPathAngleDeg: angle_deg,
    rocketDiameterM: d_rocket,
    launchAltitudeM: h_launch,
    railLengthM,
    railExitVelocity,
    railExitTime,
    railExitAngleOfAttackDeg,
    railExitAirspeed,
    clearedRail,
    minRecommendedRailVel,
    windSpeedMs,
    recoveryMode,
    descentRateMs,
    landingTime,
    landingRange,
    drogueDeployTime,
    mainDeployTime,
    mainDeployAltM: recoveryMode === 'dual' ? mainDeployAltM : undefined,
  };
}
