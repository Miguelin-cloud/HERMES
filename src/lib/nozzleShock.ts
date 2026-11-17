import { MotorInput, NozzleInput, SimulationResults, getPropellantData } from './types';

export type NozzleFlowRegime =
  | 'idle'
  | 'subsonic'
  | 'normal_shock'
  | 'overexpanded'
  | 'adapted'
  | 'underexpanded';

export interface NozzleFlowState {
  timeSec: number;
  regime: NozzleFlowRegime;
  P0_MPa: number;
  Patm_MPa: number;
  Pp: number; // Patm / P0
  Dc_mm: number;
  Dt_mm: number;
  Ds_mm: number;
  alphaDeg: number;
  L_div_mm: number; // Conical divergent length
  k: number;
  R_tot: number;
  T0r_K: number;
  exprat: number; // Ae / At
  Ms1: number; // subsonic choking threshold exit Mach
  Ms2: number; // design supersonic exit Mach
  pis1: number; // Patm/P0 threshold for choking
  pis2: number; // Patm/P0 adapted ratio
  pich_correct: number; // Patm/P0 threshold for normal shock at exit
  P_choke_MPa: number; // P0 needed to choke throat
  P_exit_shock_MPa: number; // P0 needed to push normal shock to exit
  P_adapt_MPa: number; // P0 for ideally adapted flow
  // Inside nozzle
  isChoked: boolean;
  Mt: number; // Throat Mach
  shockPosNorm: number | null; // 0..1 along divergent cone when regime === 'normal_shock'
  shockDiam_mm: number | null;
  M1_shock: number | null;
  M2_shock: number | null;
  shockPressureJump: number | null; // P2/P1 across normal shock
  shockTempJump: number | null; // T2/T1 across normal shock
  separationPosNorm: number | null; // Flow detachment along wall (OCN lambda foot or Summerfield strong overexpansion)
  // Exit plane & TTI performance decomposition
  Me_actual: number;
  Pe_MPa: number;
  Pe_over_Pa: number;
  Te_K: number;
  ve_ms: number;
  mDot_kg_s: number;
  MachFactor: number;
  momentumThrust_N: number;
  pressureThrust_N: number;
  TTI_Thrust_N: number;
  // External plume & waves
  betaObliqueDeg: number | null; // OCO lip shock angle
  alphaDeflectDeg: number | null; // OCO inward deflection
  thetaPMDeg: number | null; // Underexpanded Prandtl-Meyer outward fan angle
  MextJet: number; // Fully expanded / downstream jet Mach
  jetExpansionRatio: number; // Plume radius / exit radius (first cell peak/neck)
  machDiskRatio: number; // 0..0.55 central Mach disk stem ratio relative to Ds
  diamondSpacing_Ds: number; // Axial cell wavelength / Ds
  waveIntensity: number; // 0..1 visual intensity of diamonds/waves
}

export interface NozzleAxialPoint {
  xNorm: number; // -0.45 (chamber) .. 0 (throat) .. 1.0 (exit)
  radiusNorm: number; // r(x) / Rt
  mach: number;
  pOverP0: number;
  tempK: number;
}

export interface OcnWindowInfo {
  ignitionStartSec: number;
  ignitionEndSec: number;
  ignitionFocusSec: number;
  hasIgnitionOcn: boolean;
  tailoffStartSec: number;
  tailoffEndSec: number;
  tailoffFocusSec: number;
  hasTailoffOcn: boolean;
}

function bisectSolve(
  fn: (x: number) => number,
  loInit: number,
  hiInit: number,
  iters = 60
): number {
  let lo = loInit;
  let hi = hiInit;
  let fLo = fn(lo);
  let fHi = fn(hi);
  if (isNaN(fLo) || isNaN(fHi)) return (lo + hi) * 0.5;
  if (fLo * fHi > 0) {
    return Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
  }
  for (let i = 0; i < iters; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = fn(mid);
    if (Math.abs(fMid) < 1e-9 || Math.abs(hi - lo) < 1e-8) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return 0.5 * (lo + hi);
}

function areaMachRatio(M: number, k: number): number {
  const m = Math.max(1e-4, M);
  return (
    (1 / m) *
    Math.pow(
      (1 + ((k - 1) / 2) * m * m) / ((k + 1) / 2),
      (k + 1) / (2 * (k - 1))
    )
  );
}

function rankineHugoniotP0Ratio(M1: number, k: number): number {
  const m2 = M1 * M1;
  const term1 = (((k + 1) / 2) * m2) / (1 + ((k - 1) / 2) * m2);
  const term2 = (2 * k / (k + 1)) * m2 - (k - 1) / (k + 1);
  return (
    Math.pow(Math.max(1e-9, term1), k / (k - 1)) *
    Math.pow(Math.max(1e-9, term2), -1 / (k - 1))
  );
}

function nuPrandtlMeyer(M: number, k: number): number {
  const m = Math.max(1, M);
  const root = Math.sqrt(Math.max(0, m * m - 1));
  const kp = Math.sqrt((k + 1) / (k - 1));
  const km = Math.sqrt((k - 1) / (k + 1));
  return kp * Math.atan(km * root) - Math.atan(root);
}

function interpolateSeries(arr: number[] | undefined, lo: number, hi: number, frac: number, fallback = 0): number {
  if (!arr || arr.length === 0) return fallback;
  const v0 = arr[Math.min(arr.length - 1, Math.max(0, lo))] ?? fallback;
  const v1 = arr[Math.min(arr.length - 1, Math.max(0, hi))] ?? v0;
  return v0 + (v1 - v0) * frac;
}

export function computeNozzleFlowStateFromValues(
  params: {
    timeSec: number;
    P0_MPa: number;
    At_mm2: number;
    E_N?: number;
    mdot_noz?: number;
    propellantType?: number;
    customPropellants?: SimulationResults['customPropellants'];
    k_avg?: number;
    isIdleInstant?: boolean;
  },
  motor?: MotorInput,
  nozzle?: NozzleInput
): NozzleFlowState {
  const Patm_MPa = motor?.Pamb && motor.Pamb > 0 ? motor.Pamb : 0.101325;
  const P0_MPa = Math.max(Patm_MPa, params.P0_MPa);

  const Dt0 = nozzle?.Dt0 && nozzle.Dt0 > 0 ? nozzle.Dt0 : 18.8;
  const At_mm2 = params.At_mm2 > 0 ? params.At_mm2 : (Math.PI / 4) * Dt0 * Dt0;
  const Dt_mm = Math.sqrt(Math.max(1e-6, (4 * At_mm2) / Math.PI));
  const Ds_mm = Math.max(Dt_mm * 1.02, nozzle?.Ds && nozzle.Ds > 0 ? nozzle.Ds : Dt_mm * 2.1);
  const Dc_mm = Math.max(Ds_mm * 1.08, motor?.Dc && motor.Dc > 0 ? motor.Dc : Dt_mm * 3.0);
  const alphaDeg = nozzle?.alpha && nozzle.alpha > 0 ? Math.min(45, Math.max(3, nozzle.alpha)) : 12;
  const L_div_mm = Math.max(2, (Ds_mm - Dt_mm) / (2 * Math.tan((alphaDeg * Math.PI) / 180)));

  const Ae_mm2 = (Math.PI / 4) * Ds_mm * Ds_mm;
  const exprat = Math.max(1.001, Ae_mm2 / Math.max(1e-6, At_mm2));

  const prop = getPropellantData(params.propellantType || 1, params.customPropellants);
  const k = Math.max(1.04, params.k_avg && params.k_avg > 1.02 ? params.k_avg : prop.k || 1.13);
  const R_tot = prop.M > 0 ? 8314 / prop.M : 287;
  const etac = motor?.etac && motor.etac > 0 ? motor.etac : 0.85;
  const etanoz = nozzle?.etanoz && nozzle.etanoz > 0 ? nozzle.etanoz : 0.95;
  const T0r_K = (prop.T0 || 1710) * etac;

  const funMs = (Ms: number) => areaMachRatio(Ms, k) - exprat;
  const Ms1 = bisectSolve(funMs, 0.005, 0.9999);
  const Ms2 = bisectSolve(funMs, 1.0001, 20.0);

  const pis1 = Math.pow(1 + ((k - 1) / 2) * Ms1 * Ms1, -k / (k - 1));
  const pis2 = Math.pow(1 + ((k - 1) / 2) * Ms2 * Ms2, -k / (k - 1));
  const pich = (2 * k * Ms2 * Ms2 - (k - 1)) / (k + 1);
  const pich_correct = pis2 * pich;

  const P_choke_MPa = Patm_MPa / Math.max(1e-6, pis1);
  const P_exit_shock_MPa = Patm_MPa / Math.max(1e-6, pich_correct);
  const P_adapt_MPa = Patm_MPa / Math.max(1e-6, pis2);

  const Pp = Patm_MPa / Math.max(1e-9, P0_MPa);

  const mDot_choked =
    P0_MPa *
    1e6 *
    (At_mm2 / 1e6) *
    Math.sqrt(k / (R_tot * T0r_K)) *
    Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));

  // 1. IDLE
  if (params.isIdleInstant || P0_MPa <= Patm_MPa + 0.00025) {
    return {
      timeSec: params.timeSec,
      regime: 'idle',
      P0_MPa,
      Patm_MPa,
      Pp: 1,
      Dc_mm,
      Dt_mm,
      Ds_mm,
      alphaDeg,
      L_div_mm,
      k,
      R_tot,
      T0r_K,
      exprat,
      Ms1,
      Ms2,
      pis1,
      pis2,
      pich_correct,
      P_choke_MPa,
      P_exit_shock_MPa,
      P_adapt_MPa,
      isChoked: false,
      Mt: 0,
      shockPosNorm: null,
      shockDiam_mm: null,
      M1_shock: null,
      M2_shock: null,
      shockPressureJump: null,
      shockTempJump: null,
      separationPosNorm: null,
      Me_actual: 0,
      Pe_MPa: Patm_MPa,
      Pe_over_Pa: 1,
      Te_K: 288.15,
      ve_ms: 0,
      mDot_kg_s: 0,
      MachFactor: 1,
      momentumThrust_N: 0,
      pressureThrust_N: 0,
      TTI_Thrust_N: 0,
      betaObliqueDeg: null,
      alphaDeflectDeg: null,
      thetaPMDeg: null,
      MextJet: 0,
      jetExpansionRatio: 1,
      machDiskRatio: 0,
      diamondSpacing_Ds: 1.4,
      waveIntensity: 0,
    };
  }

  // 2. SUBSONIC (unchoked Venturi)
  if (Pp >= pis1) {
    const Me_sub = Math.min(
      Ms1 * 0.999,
      Math.sqrt(Math.max(0, ((Math.pow(1 / Pp, (k - 1) / k) - 1) * 2) / (k - 1)))
    );
    const Ae_over_Astar_sub = areaMachRatio(Math.max(0.01, Me_sub), k);
    const At_over_Astar_sub = Math.max(1.0001, Ae_over_Astar_sub / exprat);
    const Mt = bisectSolve((m) => areaMachRatio(m, k) - At_over_Astar_sub, 0.005, 0.999);
    const Te_K = T0r_K / (1 + ((k - 1) / 2) * Me_sub * Me_sub);
    const ve_ms = Math.sqrt(k * R_tot * Te_K) * Me_sub;
    const rhoE = (Patm_MPa * 1e6) / (R_tot * Te_K);
    const mDot_sub = rhoE * (Ae_mm2 / 1e6) * ve_ms;

    return {
      timeSec: params.timeSec,
      regime: 'subsonic',
      P0_MPa,
      Patm_MPa,
      Pp,
      Dc_mm,
      Dt_mm,
      Ds_mm,
      alphaDeg,
      L_div_mm,
      k,
      R_tot,
      T0r_K,
      exprat,
      Ms1,
      Ms2,
      pis1,
      pis2,
      pich_correct,
      P_choke_MPa,
      P_exit_shock_MPa,
      P_adapt_MPa,
      isChoked: false,
      Mt,
      shockPosNorm: null,
      shockDiam_mm: null,
      M1_shock: null,
      M2_shock: null,
      shockPressureJump: null,
      shockTempJump: null,
      separationPosNorm: null,
      Me_actual: Me_sub,
      Pe_MPa: Patm_MPa,
      Pe_over_Pa: 1,
      Te_K,
      ve_ms,
      mDot_kg_s: mDot_sub,
      MachFactor: 1,
      momentumThrust_N: mDot_sub * ve_ms * etanoz,
      pressureThrust_N: 0,
      TTI_Thrust_N: params.E_N !== undefined ? params.E_N : mDot_sub * ve_ms * etanoz,
      betaObliqueDeg: null,
      alphaDeflectDeg: null,
      thetaPMDeg: null,
      MextJet: Me_sub,
      jetExpansionRatio: 1,
      machDiskRatio: 0,
      diamondSpacing_Ds: 1.5,
      waveIntensity: 0,
    };
  }

  // 3. NORMAL SHOCK INSIDE NOZZLE (OCN)
  if (Pp >= pich_correct) {
    const funOCN = (Ms: number) =>
      exprat *
        Pp *
        Math.pow((k + 1) / 2, (k + 1) / (2 * (k - 1))) *
        Ms *
        Math.sqrt(1 + ((k - 1) / 2) * Ms * Ms) -
      1;
    const ms_ocn = bisectSolve(funOCN, 0.005, 0.9999);
    const P02_over_P0 = Math.min(
      0.99999,
      Math.max(1e-6, Pp * Math.pow(1 + ((k - 1) / 2) * ms_ocn * ms_ocn, k / (k - 1)))
    );

    const rhAtExit = rankineHugoniotP0Ratio(Ms2, k);
    let M1_shock: number;
    if (P02_over_P0 <= rhAtExit) {
      M1_shock = Ms2;
    } else if (P02_over_P0 >= 0.99999) {
      M1_shock = 1.0001;
    } else {
      M1_shock = bisectSolve(
        (m1) => rankineHugoniotP0Ratio(m1, k) - P02_over_P0,
        1.0001,
        Ms2
      );
    }

    const M2_shock = Math.sqrt(
      ((k - 1) * M1_shock * M1_shock + 2) /
        Math.max(1e-9, 2 * k * M1_shock * M1_shock - (k - 1))
    );
    const shockPressureJump = (2 * k * M1_shock * M1_shock - (k - 1)) / (k + 1);
    const shockTempJump =
      shockPressureJump *
      (((k - 1) * M1_shock * M1_shock + 2) / ((k + 1) * M1_shock * M1_shock));
    const As_over_At = Math.min(exprat, Math.max(1, areaMachRatio(M1_shock, k)));
    const shockDiam_mm = Dt_mm * Math.sqrt(As_over_At);
    const shockPosNorm = Math.max(
      0,
      Math.min(1, (shockDiam_mm - Dt_mm) / Math.max(1e-6, Ds_mm - Dt_mm))
    );
    const Ts_ocn = T0r_K / (1 + ((k - 1) / 2) * ms_ocn * ms_ocn);
    const ve_ms = Math.sqrt(k * R_tot * Ts_ocn) * ms_ocn;
    const momN = mDot_choked * ve_ms;
    const thrustN = params.E_N !== undefined ? params.E_N : etanoz * momN;

    return {
      timeSec: params.timeSec,
      regime: 'normal_shock',
      P0_MPa,
      Patm_MPa,
      Pp,
      Dc_mm,
      Dt_mm,
      Ds_mm,
      alphaDeg,
      L_div_mm,
      k,
      R_tot,
      T0r_K,
      exprat,
      Ms1,
      Ms2,
      pis1,
      pis2,
      pich_correct,
      P_choke_MPa,
      P_exit_shock_MPa,
      P_adapt_MPa,
      isChoked: true,
      Mt: 1,
      shockPosNorm,
      shockDiam_mm,
      M1_shock,
      M2_shock,
      shockPressureJump,
      shockTempJump,
      separationPosNorm: shockPosNorm,
      Me_actual: ms_ocn,
      Pe_MPa: Patm_MPa,
      Pe_over_Pa: 1,
      Te_K: Ts_ocn,
      ve_ms,
      mDot_kg_s: mDot_choked,
      MachFactor: 1,
      momentumThrust_N: momN,
      pressureThrust_N: 0,
      TTI_Thrust_N: thrustN,
      betaObliqueDeg: null,
      alphaDeflectDeg: null,
      thetaPMDeg: null,
      MextJet: ms_ocn,
      jetExpansionRatio: 1,
      machDiskRatio: 0,
      diamondSpacing_Ds: 1.4,
      waveIntensity: 0,
    };
  }

  // Exit supersonic properties common to Overexpanded, Adapted, Underexpanded
  const Pe_MPa = P0_MPa * pis2;
  const Pe_over_Pa = Pe_MPa / Patm_MPa;
  const Ts_out = T0r_K * Math.pow(pis2, (k - 1) / k);
  const ve_ms = Math.sqrt(k * R_tot * Ts_out) * Ms2;
  const momentumThrust_N = mDot_choked * ve_ms;
  const pressureThrust_N = (Pe_MPa - Patm_MPa) * 1e6 * (Ae_mm2 / 1e6);

  // 4. ADAPTED
  if (Math.abs(Pp - pis2) / Math.max(1e-6, pis2) <= 0.015) {
    const machAngleRad = Math.asin(1 / Ms2);
    const spacing = Math.max(0.8, 1.0 / Math.tan(machAngleRad));
    const thrustN = params.E_N !== undefined ? params.E_N : etanoz * (momentumThrust_N + pressureThrust_N);
    return {
      timeSec: params.timeSec,
      regime: 'adapted',
      P0_MPa,
      Patm_MPa,
      Pp,
      Dc_mm,
      Dt_mm,
      Ds_mm,
      alphaDeg,
      L_div_mm,
      k,
      R_tot,
      T0r_K,
      exprat,
      Ms1,
      Ms2,
      pis1,
      pis2,
      pich_correct,
      P_choke_MPa,
      P_exit_shock_MPa,
      P_adapt_MPa,
      isChoked: true,
      Mt: 1,
      shockPosNorm: null,
      shockDiam_mm: null,
      M1_shock: null,
      M2_shock: null,
      shockPressureJump: null,
      shockTempJump: null,
      separationPosNorm: null,
      Me_actual: Ms2,
      Pe_MPa: Patm_MPa,
      Pe_over_Pa: 1,
      Te_K: Ts_out,
      ve_ms,
      mDot_kg_s: mDot_choked,
      MachFactor: 1,
      momentumThrust_N,
      pressureThrust_N: 0,
      TTI_Thrust_N: thrustN,
      betaObliqueDeg: (machAngleRad * 180) / Math.PI,
      alphaDeflectDeg: 0,
      thetaPMDeg: 0,
      MextJet: Ms2,
      jetExpansionRatio: 1.0,
      machDiskRatio: 0,
      diamondSpacing_Ds: spacing,
      waveIntensity: 0.14,
    };
  }

  // 5. OVEREXPANDED (OCO)
  if (Pp > pis2) {
    const Mn_s2_val = ((Patm_MPa / (P0_MPa * pis2)) * (k + 1) + (k - 1)) / (2 * k);
    const Mn_s2 = Math.sqrt(Math.max(1, Mn_s2_val));
    const sinBeta = Math.min(1, Math.max(1 / Ms2, Mn_s2 / Ms2));
    const betaRad = Math.asin(sinBeta);
    const betaObliqueDeg = (betaRad * 180) / Math.PI;
    const Mn_ext = Math.sqrt(
      Math.max(0, ((k - 1) * Mn_s2 * Mn_s2 + 2) / Math.max(1e-9, 2 * k * Mn_s2 * Mn_s2 - (k - 1)))
    );
    const alphaDeflectDeg = Math.max(
      0.2,
      betaObliqueDeg -
        (Math.atan(Mn_ext / Math.max(1e-6, Ms2 * Math.cos(betaRad))) * 180) / Math.PI
    );
    const MachFactor = Math.min(1, Math.max(0, Math.cos((alphaDeflectDeg * Math.PI) / 180)));

    const pressureMismatch = Math.min(1, Math.max(0.05, (1 - Pe_over_Pa) / Math.max(0.1, 1 - pis2 / pich_correct)));
    const jetExpansionRatio = Math.max(0.56, 1 - 0.36 * Math.tan(Math.min(35, alphaDeflectDeg) * (Math.PI / 180)));
    const machDiskRatio =
      betaObliqueDeg > 50 ? Math.min(0.5, ((betaObliqueDeg - 50) / 40) * 0.5) : 0;
    const tanB = Math.max(0.28, Math.tan(Math.min(76, betaObliqueDeg) * (Math.PI / 180)));
    const diamondSpacing_Ds = Math.max(0.65, Math.min(2.6, 1.05 / tanB + 0.35 * Math.sqrt(Math.max(0.2, Ms2 * Ms2 - 1))));
    const thrustN = params.E_N !== undefined ? params.E_N : etanoz * (momentumThrust_N + pressureThrust_N) * MachFactor;

    return {
      timeSec: params.timeSec,
      regime: 'overexpanded',
      P0_MPa,
      Patm_MPa,
      Pp,
      Dc_mm,
      Dt_mm,
      Ds_mm,
      alphaDeg,
      L_div_mm,
      k,
      R_tot,
      T0r_K,
      exprat,
      Ms1,
      Ms2,
      pis1,
      pis2,
      pich_correct,
      P_choke_MPa,
      P_exit_shock_MPa,
      P_adapt_MPa,
      isChoked: true,
      Mt: 1,
      shockPosNorm: null,
      shockDiam_mm: null,
      M1_shock: null,
      M2_shock: null,
      shockPressureJump: null,
      shockTempJump: null,
      separationPosNorm: Pe_over_Pa < 0.38 ? Math.max(0.72, 1 - (0.38 - Pe_over_Pa) * 0.65) : null,
      Me_actual: Ms2,
      Pe_MPa,
      Pe_over_Pa,
      Te_K: Ts_out,
      ve_ms,
      mDot_kg_s: mDot_choked,
      MachFactor,
      momentumThrust_N,
      pressureThrust_N,
      TTI_Thrust_N: thrustN,
      betaObliqueDeg,
      alphaDeflectDeg,
      thetaPMDeg: null,
      MextJet: Math.max(1.05, Ms2 * (1 - 0.22 * pressureMismatch)),
      jetExpansionRatio,
      machDiskRatio,
      diamondSpacing_Ds,
      waveIntensity: Math.min(1, 0.28 + 0.72 * Math.min(1, (1 - Pe_over_Pa) * 1.65)),
    };
  }

  // 6. UNDEREXPANDED (Prandtl-Meyer)
  const MextOut = Math.sqrt(
    Math.max(Ms2 * Ms2, ((Math.pow(Pp, (1 - k) / k) - 1) * 2) / (k - 1))
  );
  const Nu_Mext = nuPrandtlMeyer(MextOut, k);
  const Nu_Ms2 = nuPrandtlMeyer(Ms2, k);
  const thetaPMDeg = Math.max(0.5, ((Nu_Mext - Nu_Ms2) * 180) / Math.PI);
  const Nu_max = (Math.PI / 2) * (Math.sqrt((k + 1) / (k - 1)) - 1);
  const Teta_max_rad = Nu_max - Nu_Ms2;
  const TetaLimited_deg = thetaPMDeg > Teta_max_rad ? Teta_max_rad : thetaPMDeg;
  const MachFactor = Math.min(1, Math.max(0, Math.cos((TetaLimited_deg * Math.PI) / 180)));

  const jetExpansionRatio = Math.min(
    1.76,
    1 + 0.56 * Math.tan((Math.min(38, thetaPMDeg) * Math.PI) / 180)
  );
  const machDiskRatio =
    Pe_over_Pa > 1.65 ? Math.min(0.56, ((Pe_over_Pa - 1.65) / 6.0) * 0.56) : 0;
  const effectiveM = 0.5 * (Ms2 + Math.min(6, MextOut));
  const diamondSpacing_Ds = Math.max(
    0.9,
    Math.min(3.4, (Math.PI / 2.4048) * jetExpansionRatio * Math.sqrt(Math.max(0.3, effectiveM * effectiveM - 1)) * 0.65)
  );
  const waveIntensity = Math.min(1, 0.28 + 0.72 * Math.min(1, (Pe_over_Pa - 1) / 2.8));
  const thrustN = params.E_N !== undefined ? params.E_N : etanoz * (momentumThrust_N + pressureThrust_N) * MachFactor;

  return {
    timeSec: params.timeSec,
    regime: 'underexpanded',
    P0_MPa,
    Patm_MPa,
    Pp,
    Dc_mm,
    Dt_mm,
    Ds_mm,
    alphaDeg,
    L_div_mm,
    k,
    R_tot,
    T0r_K,
    exprat,
    Ms1,
    Ms2,
    pis1,
    pis2,
    pich_correct,
    P_choke_MPa,
    P_exit_shock_MPa,
    P_adapt_MPa,
    isChoked: true,
    Mt: 1,
    shockPosNorm: null,
    shockDiam_mm: null,
    M1_shock: null,
    M2_shock: null,
    shockPressureJump: null,
    shockTempJump: null,
    separationPosNorm: null,
    Me_actual: Ms2,
    Pe_MPa,
    Pe_over_Pa,
    Te_K: Ts_out,
    ve_ms,
    mDot_kg_s: mDot_choked,
    MachFactor,
    momentumThrust_N,
    pressureThrust_N,
    TTI_Thrust_N: thrustN,
    betaObliqueDeg: null,
    alphaDeflectDeg: null,
    thetaPMDeg,
    MextJet: MextOut,
    jetExpansionRatio,
    machDiskRatio,
    diamondSpacing_Ds,
    waveIntensity,
  };
}

export function computeNozzleFlowState(
  results: SimulationResults,
  timeIndex: number,
  motor?: MotorInput,
  nozzle?: NozzleInput
): NozzleFlowState {
  const idx = Math.max(0, Math.min((results.t?.length || 1) - 1, timeIndex));
  const tSec = results.t?.[idx] ?? 0;
  const Dt0 = nozzle?.Dt0 && nozzle.Dt0 > 0 ? nozzle.Dt0 : 18.8;
  const fallbackAt = (Math.PI / 4) * Dt0 * Dt0;

  return computeNozzleFlowStateFromValues(
    {
      timeSec: tSec,
      P0_MPa: results.P0_MPa?.[idx] ?? 0.101325,
      At_mm2: results.At_mm2?.[idx] ?? fallbackAt,
      E_N: results.E_N?.[idx],
      mdot_noz: results.mdot_noz?.[idx],
      propellantType: results.propellantType,
      customPropellants: results.customPropellants,
      k_avg: results.summary?.k_avg,
      isIdleInstant: idx === 0,
    },
    motor,
    nozzle
  );
}

/**
 * Smooth sub-step time interpolation between discrete solver frames so slow-motion
 * playback glides the normal shock wave smoothly through the divergent nozzle.
 */
export function computeNozzleFlowStateAtTime(
  results: SimulationResults,
  timeSec: number,
  motor?: MotorInput,
  nozzle?: NozzleInput
): NozzleFlowState {
  const tArr = results.t;
  if (!tArr || tArr.length === 0) {
    return computeNozzleFlowState(results, 0, motor, nozzle);
  }
  const tMin = tArr[0];
  const tMax = tArr[tArr.length - 1];
  const clampedT = Math.max(tMin, Math.min(tMax, timeSec));

  // Binary search lo such that tArr[lo] <= clampedT <= tArr[lo + 1]
  let lo = 0;
  let hi = tArr.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (tArr[mid] <= clampedT) lo = mid;
    else hi = mid;
  }
  const dtSpan = tArr[hi] - tArr[lo];
  const frac = dtSpan > 1e-9 ? Math.max(0, Math.min(1, (clampedT - tArr[lo]) / dtSpan)) : 0;

  const Dt0 = nozzle?.Dt0 && nozzle.Dt0 > 0 ? nozzle.Dt0 : 18.8;
  const fallbackAt = (Math.PI / 4) * Dt0 * Dt0;
  const Patm = motor?.Pamb && motor.Pamb > 0 ? motor.Pamb : 0.101325;

  const P0 = interpolateSeries(results.P0_MPa, lo, hi, frac, Patm);
  const At = interpolateSeries(results.At_mm2, lo, hi, frac, fallbackAt);
  const E_interp = results.E_N ? interpolateSeries(results.E_N, lo, hi, frac, 0) : undefined;
  const mdot_interp = results.mdot_noz ? interpolateSeries(results.mdot_noz, lo, hi, frac, 0) : undefined;

  return computeNozzleFlowStateFromValues(
    {
      timeSec: clampedT,
      P0_MPa: P0,
      At_mm2: At,
      // Recompute E_N dynamically when strictly between discrete steps if shock regime might cross threshold
      E_N: frac < 1e-4 || frac > 1 - 1e-4 ? E_interp : undefined,
      mdot_noz: mdot_interp,
      propellantType: results.propellantType,
      customPropellants: results.customPropellants,
      k_avg: results.summary?.k_avg,
      isIdleInstant: clampedT <= tMin + 1e-7,
    },
    motor,
    nozzle
  );
}

/**
 * Finds the exact time windows during ignition and tail-off where the normal shock
 * traverses the divergent cone so users can zoom or jump right into them.
 */
export function findOcnWindows(
  results: SimulationResults,
  motor?: MotorInput,
  nozzle?: NozzleInput
): OcnWindowInfo {
  const tArr = results.t || [0];
  const t0 = tArr[0] || 0;
  const tEnd = tArr[tArr.length - 1] || 0;
  const totalSpan = Math.max(0.01, tEnd - t0);

  const probe = computeNozzleFlowState(results, Math.min(1, tArr.length - 1), motor, nozzle);
  const pExitShock = probe.P_exit_shock_MPa;
  const pChoke = probe.P_choke_MPa;

  // Locate peak pressure index to split ignition vs tail-off
  let peakIdx = 0;
  let peakP = -Infinity;
  for (let i = 0; i < (results.P0_MPa?.length || 0); i++) {
    if (results.P0_MPa[i] > peakP) {
      peakP = results.P0_MPa[i];
      peakIdx = i;
    }
  }

  // Ignition side: scan from 0 to peakIdx for P_choke and P_exit_shock crossings
  let ignStart = t0;
  let ignEnd = Math.min(tEnd, t0 + totalSpan * 0.15);
  let hasIgnOcn = false;

  for (let i = 0; i < peakIdx; i++) {
    const pA = results.P0_MPa[i];
    const pB = results.P0_MPa[i + 1];
    const tA = tArr[i];
    const tB = tArr[i + 1];
    if (pA <= pChoke && pB >= pChoke) {
      const f = (pChoke - pA) / Math.max(1e-9, pB - pA);
      ignStart = tA + f * (tB - tA);
      hasIgnOcn = true;
    }
    if (pA <= pExitShock && pB >= pExitShock) {
      const f = (pExitShock - pA) / Math.max(1e-9, pB - pA);
      ignEnd = tA + f * (tB - tA);
      hasIgnOcn = true;
      break;
    }
  }

  const ignMid = hasIgnOcn ? 0.5 * (ignStart + ignEnd) : Math.min(tEnd, t0 + totalSpan * 0.03);
  const ignDur = Math.max(1e-5, ignEnd - ignStart);
  const ignWinStart = Math.max(t0, ignStart - ignDur * 0.45);
  const ignWinEnd = Math.min(
    tEnd,
    hasIgnOcn
      ? Math.max(ignEnd + Math.max(ignDur * 2.5, ignEnd * 2.5), ignStart + 0.0006)
      : t0 + Math.min(0.08, totalSpan * 0.1)
  );

  // Tail-off side: scan from peakIdx to end for P_exit_shock down to P_choke
  let tailStart = Math.max(t0, tEnd - totalSpan * 0.15);
  let tailEnd = tEnd;
  let hasTailOcn = false;

  for (let i = peakIdx; i < tArr.length - 1; i++) {
    const pA = results.P0_MPa[i];
    const pB = results.P0_MPa[i + 1];
    const tA = tArr[i];
    const tB = tArr[i + 1];
    if (pA >= pExitShock && pB <= pExitShock) {
      const f = (pExitShock - pA) / (pB - pA || -1e-9);
      tailStart = tA + f * (tB - tA);
      hasTailOcn = true;
    }
    if (pA >= pChoke && pB <= pChoke) {
      const f = (pChoke - pA) / (pB - pA || -1e-9);
      tailEnd = tA + f * (tB - tA);
      hasTailOcn = true;
    }
  }

  const tailFocus = hasTailOcn ? 0.5 * (tailStart + tailEnd) : Math.max(t0, tEnd * 0.92);

  return {
    ignitionStartSec: ignWinStart,
    ignitionEndSec: Math.max(ignWinStart + 0.005, ignWinEnd),
    ignitionFocusSec: ignMid,
    hasIgnitionOcn: hasIgnOcn,
    tailoffStartSec: Math.max(t0, tailStart - 0.01),
    tailoffEndSec: tEnd,
    tailoffFocusSec: tailFocus,
    hasTailoffOcn: hasTailOcn,
  };
}

/**
 * Generates an axial profile of radius, local Mach M(x), P(x)/P0, and static T(x)
 * (-0.45 chamber/convergent -> 0.0 throat -> 1.0 exit) matching TTI physics.
 */
export function buildNozzleAxialProfile(
  state: NozzleFlowState,
  samples = 96
): NozzleAxialPoint[] {
  const {
    regime,
    Dt_mm,
    Ds_mm,
    Dc_mm,
    k,
    T0r_K,
    shockPosNorm,
    M1_shock,
    M2_shock,
    Me_actual,
    Mt,
  } = state;

  const Rt = Math.max(0.5, Dt_mm / 2);
  const Re = Math.max(Rt * 1.01, Ds_mm / 2);
  const Rc = Math.min(Re * 2.25, Math.max(Re * 1.15, Dc_mm / 2));

  const P02_over_P0 =
    regime === 'normal_shock' && M1_shock
      ? rankineHugoniotP0Ratio(M1_shock, k)
      : 1;
  const Astar2_over_At = 1 / Math.max(1e-6, P02_over_P0);

  const points: NozzleAxialPoint[] = [];
  const xMin = -0.45;
  const xMax = 1.0;

  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1);
    const xNorm = xMin + f * (xMax - xMin);

    let rNorm = 1;
    if (xNorm < 0) {
      const convU = Math.min(1, Math.max(0, -xNorm / 0.45));
      const s = 0.5 * (1 - Math.cos(Math.PI * convU));
      rNorm = 1 + ((Rc / Rt) - 1) * Math.pow(s, 0.85);
    } else {
      rNorm = 1 + ((Re / Rt) - 1) * xNorm;
    }

    const areaRatio = Math.max(1.0, rNorm * rNorm);
    let mach = 0;
    let pOverP0 = 1;

    if (regime === 'idle') {
      mach = 0;
      pOverP0 = 1;
    } else if (regime === 'subsonic') {
      const targetAtRatio = Math.max(1.0001, areaMachRatio(Math.max(0.01, Mt), k));
      const localAstarRatio = areaRatio * targetAtRatio;
      mach = bisectSolve((m) => areaMachRatio(m, k) - localAstarRatio, 0.005, 0.998, 28);
      pOverP0 = Math.pow(1 + ((k - 1) / 2) * mach * mach, -k / (k - 1));
    } else if (xNorm < 0) {
      mach = bisectSolve((m) => areaMachRatio(m, k) - areaRatio, 0.005, 0.999, 28);
      pOverP0 = Math.pow(1 + ((k - 1) / 2) * mach * mach, -k / (k - 1));
    } else if (regime === 'normal_shock' && shockPosNorm !== null) {
      if (xNorm <= shockPosNorm) {
        mach = areaRatio <= 1.0005 ? 1.0 : bisectSolve((m) => areaMachRatio(m, k) - areaRatio, 1.0001, Math.max(1.2, state.Ms2 + 0.5), 28);
        pOverP0 = Math.pow(1 + ((k - 1) / 2) * mach * mach, -k / (k - 1));
      } else {
        const localRatioPost = Math.max(1.0001, areaRatio / Math.max(1e-6, Astar2_over_At));
        mach = bisectSolve((m) => areaMachRatio(m, k) - localRatioPost, 0.005, 0.998, 28);
        if (xNorm > 0.98 && Me_actual > 0) {
          mach = Me_actual;
        }
        pOverP0 = P02_over_P0 * Math.pow(1 + ((k - 1) / 2) * mach * mach, -k / (k - 1));
      }
    } else {
      mach = areaRatio <= 1.0005 ? 1.0 : bisectSolve((m) => areaMachRatio(m, k) - areaRatio, 1.0001, Math.max(1.2, state.Ms2 + 0.5), 28);
      pOverP0 = Math.pow(1 + ((k - 1) / 2) * mach * mach, -k / (k - 1));
    }

    if (regime === 'normal_shock' && shockPosNorm !== null && M2_shock && Math.abs(xNorm - shockPosNorm) < 0.012 && xNorm > shockPosNorm) {
      mach = M2_shock;
    }

    const tempK = regime === 'idle' ? 288.15 : T0r_K / (1 + ((k - 1) / 2) * mach * mach);

    points.push({
      xNorm,
      radiusNorm: rNorm,
      mach,
      pOverP0: Math.min(1, Math.max(0.001, pOverP0)),
      tempK,
    });
  }

  return points;
}
