import { SimulationInputs, SimulationResults, getPropellantData, getBurnRate, classifyMotor } from './types';
import { getGrainModule, GrainRuntimeState } from './grains';
import { computeCanonicalTTI } from './nozzleShock';

const G0_STANDARD = 9.80665;

/**
 * Calcula la variación del diámetro y área de garganta debido a erosión (e > 0)
 * o acumulación de escoria / slag (e < 0) según el modelo de progresión seleccionado.
 *
 * Modelos disponibles (iero):
 * 1: Lineal: y = x
 * 2: Exponencial normalizada: y = (exp(x) - 1) / (exp(1) - 1)
 * 3: Cuadrática: y = x^2
 * 4: Raíz cuadrada: y = sqrt(x)
 * 5: Parábola cóncava (máx en x=1): y = -x^2 + 2x
 * 6: Senoidal: y = sin((pi/2)*x)
 */
export function calculateThroatErosion(
  Dt0: number,
  ero: number = 0,
  xdero: number = 0,
  iero: number = 1
): { Dt: number; At: number; ydero: number } {
  if (!ero || ero === 0) {
    const At = (Math.PI / 4) * Math.pow(Dt0, 2);
    return { Dt: Dt0, At, ydero: 0 };
  }

  // xdero representa la fracción de alma quemada x / eweb (0 a 1)
  const x = Math.min(1, Math.max(0, xdero));
  let ydero = x;

  switch (iero) {
    case 1:
      ydero = x;
      break;
    case 2:
      ydero = (Math.exp(x) - 1) / (Math.E - 1);
      break;
    case 3:
      ydero = Math.pow(x, 2);
      break;
    case 4:
      ydero = Math.sqrt(x);
      break;
    case 5:
      ydero = -Math.pow(x, 2) + 2 * x;
      break;
    case 6:
      ydero = Math.sin((Math.PI / 2) * x);
      break;
    default:
      ydero = x;
      break;
  }

  ydero = Math.min(1, Math.max(0, ydero));
  const minPhysicalDt = Math.max(0.5, Dt0 * 0.05);
  const Dt = Math.max(minPhysicalDt, Dt0 + ero * ydero);
  const At = (Math.PI / 4) * Math.pow(Dt, 2);

  return { Dt, At, ydero };
}

export function runSimulation({ motor, grains, nozzle, customPropellants, customGrainShapes, geometryQuality }: SimulationInputs): SimulationResults {
  const t: number[] = [];
  const P0_MPa: number[] = [];
  const P0_gage: number[] = [];
  const mgra_total: number[] = [];
  const F_N: number[] = [];
  const F_kg: number[] = [];
  const E_N: number[] = [];
  const E_kg: number[] = [];

  const Ntipos = grains.length;
  const Patm = motor.Pamb > 0 ? motor.Pamb : 0.101325;
  const dt = motor.paso_de_tiempo;

  if (Ntipos === 0) throw new Error('No grains defined');
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error('Time step (dt) must be strictly greater than zero');
  }

  const state: GrainRuntimeState[] = grains.map((g) => {
    const prop = getPropellantData(g.propellantType, customPropellants);
    return getGrainModule(g.shape).createRuntimeState(g, {
      motor,
      nozzle,
      prop,
      customPropellants,
      customGrainShapes,
      geometryQuality,
    });
  });

  const initialGrainMasses = state.map((s) => Math.max(0, s.mg));
  const initialMassTotal = initialGrainMasses.reduce((sum, m) => sum + m, 0);

  const At0 = (Math.PI / 4) * Math.pow(nozzle.Dt0, 2);
  const Ae = (Math.PI / 4) * Math.pow(nozzle.Ds, 2);

  let current_t = 0;
  let mgra_total_val = initialMassTotal;
  let P0 = Patm;

  // Volumen neto disponible en cámara descontando liner térmico interior e inhibidor exterior del grano
  const linerThickMm = motor.hasLiner ? Math.max(0, Number(motor.linerThickness ?? 0) || 0) : 0;
  const inhibThickMm = motor.hasInhibitor ? Math.max(0, Number(motor.inhibitorThickness ?? 0) || 0) : 0;
  const Dc_insideLinerMm = Math.max(0, motor.Dc - 2 * linerThickMm);
  const Vc_insideLiner_m3 = ((Math.PI / 4) * Math.pow(Dc_insideLinerMm, 2) * motor.Lc) / 1e9;
  const V_inhibitor_m3 =
    inhibThickMm > 0
      ? grains.reduce((sum, g) => {
          const dIn = Math.max(0, Number(g.D0) || 0);
          const dOutRaw = dIn + 2 * inhibThickMm;
          const dOut = Dc_insideLinerMm > 0 ? Math.min(Dc_insideLinerMm, dOutRaw) : dOutRaw;
          if (dOut <= dIn) return sum;
          const nBlocks = Math.max(1, Number(g.N) || 1);
          const lBlock = Math.max(0, Number(g.L0) || 0);
          return sum + (nBlocks * (Math.PI / 4) * (dOut * dOut - dIn * dIn) * lBlock) / 1e9;
        }, 0)
      : 0;
  const Vc_net_m3 = Math.max(1e-9, Vc_insideLiner_m3 - V_inhibitor_m3);

  const initialVgra_m3 = state.reduce((a, b) => a + b.Vg, 0) / 1e9;
  let msto_total_acc = 0;
  let P0_prod_Pa = 0;
  let Vfree_total = Math.max(1e-9, Vc_net_m3 - initialVgra_m3);
  let R_total = state[0] ? 8314 / state[0].prop.M : 287;
  let T0real_total = state[0] ? state[0].prop.T0 * motor.etac : 1710 * motor.etac;
  let k_total = state[0]?.prop.k || 1.13;

  let step = 0;
  const hist: any[] = [];
  let k_sum_steps = 0;
  let k_active_count = 0;

  const initial_total_Ab = state.reduce((sum, s) => sum + s.Ab, 0);
  const { a: a0, n: n0 } = getBurnRate(Patm, state[0]?.propellantType || 1, customPropellants);
  const initial_r = initial_total_Ab > 1e-9 ? a0 * Math.pow(Patm, n0) : 0;

  hist.push({
    t: 0,
    P0_MPa: Patm,
    P0_gage: 0,
    mgra_total: mgra_total_val,
    T0real_total: (state[0]?.prop.T0 || 1710) * motor.etac,
    R_total,
    k_total: state[0]?.prop.k || 1.13,
    At_total_val: At0,
    mgen_kgs: 0,
    mnoz_kgs: 0,
    r_burn: initial_r,
    Kn: At0 > 0 ? initial_total_Ab / At0 : 0,
    Ab_total: initial_total_Ab,
    grains_x: state.map(() => 0),
    grains_Abc: state.map((s) => s.Abc || 0),
    grains_Abe: state.map((s) => s.Abe || 0),
    grains_Abs: state.map((s) => s.Abs || 0),
    grains_Ab: state.map((s) => s.Ab || 0),
    isBurningStep: false,
  });

  // Avance de quemado mientras exista propelente con caras activas de combustión
  while (
    mgra_total_val >= 0.00001 &&
    current_t < 600.0 &&
    step < 2000000 &&
    state.some((s) => !s.isConsumed && s.Ab > 1e-9)
  ) {
    step++;
    current_t += dt;

    let sum_mg = 0;
    let sum_k_moles = 0;
    let sum_M_moles = 0;
    let sum_T0_moles = 0;
    let total_mgen = 0;
    let total_molesb = 0;
    let burningRateSum = 0;
    let burningGrainsCount = 0;
    let weightedProgressSum = 0;

    for (let gIdx = 0; gIdx < state.length; gIdx++) {
      const s = state[gIdx];
      const massWeight = initialMassTotal > 0 ? initialGrainMasses[gIdx] / initialMassTotal : 1 / Ntipos;

      if (s.isConsumed || (s.D === 0 && s.L === 0) || s.Ab <= 1e-9) {
        s.xincp = 0;
        s.isConsumed = true;
        sum_mg += s.mg;
        weightedProgressSum += massWeight * 1;
        continue;
      }

      const { a, n } = getBurnRate(P0, s.propellantType, customPropellants);
      const Aduct_At = Math.max(0, s.Aduct / At0);
      const Gg = Math.max(0, motor.Gstar - Aduct_At);

      const r = (1 + motor.kv * Gg) * a * Math.pow(P0, n);
      const dx = r * dt;
      s.xincp = dx;
      s.x += dx;

      const prev_mg = s.mg;

      const grainEval = getGrainModule(s.shape).evaluateAtBurnDepth(s, s.x, motor.Dc);
      s.d = grainEval.d;
      s.D = grainEval.D;
      s.L = grainEval.L;
      s.dmenor = grainEval.dmenor;
      s.dmayor = grainEval.dmayor;
      s.tweb = grainEval.tweb;
      s.Vg = grainEval.Vg;
      s.Abe = grainEval.Abe;
      s.Abc = grainEval.Abc;
      s.Abs = grainEval.Abs;
      s.Ab = grainEval.Ab;
      s.Aduct = grainEval.Aduct;
      s.isConsumed = grainEval.isConsumed;
      if (grainEval.betha !== undefined) {
        s.betha = grainEval.betha;
      }

      const xdero_g = grainEval.isConsumed
        ? 1
        : s.tweb0 > 0
          ? Math.min(1, Math.max(0, (s.tweb0 - s.tweb) / s.tweb0))
          : 0;
      weightedProgressSum += massWeight * xdero_g;

      s.mg = (s.rhoreal * s.Vg) / 1e6;
      let mgen = (prev_mg - s.mg) / dt;
      if (mgen < 0) mgen = 0;

      const molesb_s = s.prop.M > 0 ? (mgen * 1000) / s.prop.M : 0;
      total_mgen += mgen;
      total_molesb += molesb_s;

      sum_mg += s.mg;
      sum_k_moles += molesb_s * s.prop.k;
      sum_M_moles += molesb_s * s.prop.M;
      sum_T0_moles += molesb_s * s.prop.T0;

      if (!grainEval.isConsumed || mgen > 0) {
        burningRateSum += r;
        burningGrainsCount++;
      }
    }

    mgra_total_val = sum_mg;

    const M_total = total_molesb > 0 ? sum_M_moles / total_molesb : state[0].prop.M;
    k_total = total_molesb > 0 ? sum_k_moles / total_molesb : state[0].prop.k;
    const T0_total = total_molesb > 0 ? sum_T0_moles / total_molesb : state[0].prop.T0;

    R_total = M_total > 0 ? 8314 / M_total : 8314 / state[0].prop.M;
    T0real_total = T0_total * motor.etac;

    if (total_molesb > 0) {
      k_sum_steps += k_total;
      k_active_count++;
    }

    // Garganta única del motor evaluada con el avance ponderado de quemado (incluye end-burners y multigrano)
    const { At: At_total_val } = calculateThroatErosion(
      nozzle.Dt0,
      nozzle.e,
      weightedProgressSum,
      nozzle.ero_model || 1
    );
    for (const s of state) {
      s.At = At_total_val;
    }

    const Vgra_total = state.reduce((a, b) => a + b.Vg, 0) / 1e9;
    Vfree_total = Math.max(1e-9, Vc_net_m3 - Vgra_total);

    const K_noz =
      (At_total_val / 1e6) *
      Math.sqrt(k_total / (R_total * T0real_total)) *
      Math.pow(2 / (k_total + 1), (k_total + 1) / (2 * (k_total - 1)));

    const lambda = (R_total * T0real_total * K_noz) / Vfree_total;

    if (lambda > 1e-12) {
      const expTerm = Math.exp(-lambda * dt);
      msto_total_acc = msto_total_acc * expTerm + (total_mgen / lambda) * (1 - expTerm);
    } else {
      msto_total_acc = Math.max(0, msto_total_acc + total_mgen * dt);
    }

    const rhoprod = Math.max(0, msto_total_acc / Vfree_total);
    P0_prod_Pa = rhoprod * R_total * T0real_total;
    P0 = P0_prod_Pa / 1e6 + Patm;

    const mnoz_total = P0_prod_Pa * K_noz;
    const step_total_Ab = state.reduce((sum, s) => sum + s.Ab, 0);
    const step_dominant_r = burningGrainsCount > 0 ? burningRateSum / burningGrainsCount : 0;
    const step_Kn = At_total_val > 0 ? step_total_Ab / At_total_val : 0;

    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: mgra_total_val,
      T0real_total,
      R_total,
      k_total,
      At_total_val,
      mgen_kgs: total_mgen,
      mnoz_kgs: mnoz_total,
      r_burn: step_dominant_r,
      Kn: step_Kn,
      Ab_total: step_total_Ab,
      grains_x: state.map((s) => s.x),
      grains_Abc: state.map((s) => s.Abc),
      grains_Abe: state.map((s) => s.Abe),
      grains_Abs: state.map((s) => s.Abs),
      grains_Ab: state.map((s) => s.Ab),
      isBurningStep: total_mgen > 0 || step_total_Ab > 1e-9,
    });
  }

  // Post combustión (Vaciado físico de cámara por conservación diferencial dm_gas/dt = -lambda * m_gas)
  const k_enfriamiento = 0.02;
  let T02real_total = T0real_total;
  let m_gas_blowdown = msto_total_acc;
  const final_At_total_val = state[0]?.At || At0;

  while (P0 - Patm > 0.01 && current_t < 600.0 && step < 2500000) {
    step++;
    current_t += dt;
    T02real_total = Math.max(288.15, T02real_total * Math.exp(-k_enfriamiento * dt));

    const K_noz_blow =
      (final_At_total_val / 1e6) *
      Math.sqrt(k_total / (R_total * T02real_total)) *
      Math.pow(2 / (k_total + 1), (k_total + 1) / (2 * (k_total - 1)));
    const lambda_blow = (R_total * T02real_total * K_noz_blow) / Vfree_total;

    m_gas_blowdown = m_gas_blowdown * Math.exp(-lambda_blow * dt);
    const rhoprod_blow = Math.max(0, m_gas_blowdown / Vfree_total);
    const P0_gage_Pa_blow = rhoprod_blow * R_total * T02real_total;
    P0 = P0_gage_Pa_blow / 1e6 + Patm;
    const post_mnoz = Math.max(0, P0_gage_Pa_blow * K_noz_blow);

    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: mgra_total_val,
      T0real_total: T02real_total,
      R_total,
      k_total,
      At_total_val: final_At_total_val,
      mgen_kgs: 0,
      mnoz_kgs: post_mnoz,
      r_burn: 0,
      Kn: 0,
      Ab_total: 0,
      grains_x: hist[hist.length - 1]?.grains_x || grains.map(() => 0),
      grains_Abc: hist[hist.length - 1]?.grains_Abc || grains.map(() => 0),
      grains_Abe: hist[hist.length - 1]?.grains_Abe || grains.map(() => 0),
      grains_Abs: hist[hist.length - 1]?.grains_Abs || grains.map(() => 0),
      grains_Ab: hist[hist.length - 1]?.grains_Ab || grains.map(() => 0),
      isBurningStep: false,
    });
  }

  // Variables de seguimiento de performance
  let Pmax_MPa = 0;
  let P_sum = 0;
  let Fmax_N = 0;
  let It_total_N_s = 0;
  let active_burn_steps = 0;
  let t_quemado = 0;
  let t_fin = 0;

  let Kn_max = 0;
  let Kn_sum = 0;
  let Kn_final = 0;
  let r_max = 0;
  let r_sum = 0;
  let mdot_max = 0;
  let mdot_sum = 0;

  const Kn_arr: number[] = [];
  const At_mm2_arr: number[] = [];
  const r_burn_arr: number[] = [];
  const mdot_gen_arr: number[] = [];
  const mdot_noz_arr: number[] = [];
  const Ab_total_arr: number[] = [];

  const grains_x: number[][] = grains.map(() => []);
  const grains_Abc: number[][] = grains.map(() => []);
  const grains_Abe: number[][] = grains.map(() => []);
  const grains_Abs: number[][] = grains.map(() => []);
  const grains_Ab: number[][] = grains.map(() => []);

  for (let i = 0; i < hist.length; i++) {
    const h = hist[i];
    const P0_step = h.P0_MPa;
    const T0r = h.T0real_total;
    const R_tot = h.R_total;
    const k = h.k_total;
    const At_val = h.At_total_val;

    if (i === 0 || P0_step <= Patm + 0.0001) {
      t.push(h.t);
      P0_MPa.push(h.P0_MPa);
      P0_gage.push(h.P0_gage);
      mgra_total.push(h.mgra_total);
      F_N.push(0);
      F_kg.push(0);
      E_N.push(0);
      E_kg.push(0);

      Kn_arr.push(h.Kn ?? 0);
      At_mm2_arr.push(h.At_total_val ?? At0);
      r_burn_arr.push(h.r_burn ?? 0);
      mdot_gen_arr.push(h.mgen_kgs ?? 0);
      mdot_noz_arr.push(h.mnoz_kgs ?? 0);
      Ab_total_arr.push(h.Ab_total ?? 0);

      for (let g = 0; g < grains.length; g++) {
        grains_x[g].push(h.grains_x?.[g] ?? 0);
        grains_Abc[g].push(h.grains_Abc?.[g] ?? 0);
        grains_Abe[g].push(h.grains_Abe?.[g] ?? 0);
        grains_Abs[g].push(h.grains_Abs?.[g] ?? 0);
        grains_Ab[g].push(h.grains_Ab?.[g] ?? 0);
      }
      continue;
    }

    // Teoría de Toberas Ideales (TTI) compartida con visor 2D
    const tti = computeCanonicalTTI({
      P0_MPa: P0_step,
      Patm_MPa: Patm,
      At_mm2: At_val,
      Ae_mm2: Ae,
      k,
      R_tot,
      T0r_K: T0r,
      alphaDeg: nozzle.alpha,
      etanoz: nozzle.etanoz,
    });
    const TTI_Thrust_N = tti.TTI_Thrust_N;

    // Modelo clásico Richard Nakka (referencia comparativa)
    const exprat_i = Math.max(1.0, Ae / At_val);
    let Pe_RN = P0_step / Math.pow(1 + ((k - 1) / 2) * tti.Ms2 * tti.Ms2, k / (k - 1));
    if (Pe_RN < Patm) Pe_RN = Patm;

    const Pe_P0 = Math.max(0, Math.min(1, Pe_RN / P0_step));
    const momentum_CF_RN = Math.sqrt(
      ((2 * k * k) / (k - 1)) *
        Math.pow(2 / (k + 1), (k + 1) / (k - 1)) *
        (1 - Math.pow(Pe_P0, (k - 1) / k))
    );
    const pressure_CF_RN = ((Pe_RN - Patm) / P0_step) * exprat_i;
    const CF_RN = nozzle.etanoz * momentum_CF_RN + pressure_CF_RN;
    const F_RN_N = Number.isNaN(CF_RN) ? 0 : Math.max(0, CF_RN * (At_val / 1e6) * (P0_step * 1e6));

    t.push(h.t);
    P0_MPa.push(h.P0_MPa);
    P0_gage.push(h.P0_gage);
    mgra_total.push(h.mgra_total);
    F_N.push(F_RN_N);
    F_kg.push(F_RN_N / G0_STANDARD);
    E_N.push(TTI_Thrust_N);
    E_kg.push(TTI_Thrust_N / G0_STANDARD);

    Kn_arr.push(h.Kn ?? 0);
    At_mm2_arr.push(h.At_total_val ?? At0);
    r_burn_arr.push(h.r_burn ?? 0);
    mdot_gen_arr.push(h.mgen_kgs ?? 0);
    mdot_noz_arr.push(h.mnoz_kgs ?? 0);
    Ab_total_arr.push(h.Ab_total ?? 0);

    for (let g = 0; g < grains.length; g++) {
      grains_x[g].push(h.grains_x?.[g] ?? 0);
      grains_Abc[g].push(h.grains_Abc?.[g] ?? 0);
      grains_Abe[g].push(h.grains_Abe?.[g] ?? 0);
      grains_Abs[g].push(h.grains_Abs?.[g] ?? 0);
      grains_Ab[g].push(h.grains_Ab?.[g] ?? 0);
    }

    if (h.P0_MPa > Pmax_MPa) Pmax_MPa = h.P0_MPa;
    if (TTI_Thrust_N > Fmax_N) Fmax_N = TTI_Thrust_N;

    if (h.isBurningStep) {
      P_sum += h.P0_gage;
      active_burn_steps++;
      t_quemado = h.t;
      if (h.Kn > Kn_max) Kn_max = h.Kn;
      if (h.r_burn > r_max) r_max = h.r_burn;
      if (h.mgen_kgs > mdot_max) mdot_max = h.mgen_kgs;
      Kn_sum += h.Kn;
      r_sum += h.r_burn;
      mdot_sum += h.mgen_kgs;
      Kn_final = h.Kn;
    }
    if (TTI_Thrust_N > 1) t_fin = h.t;

    if (i > 0) {
      const dt_i = h.t - hist[i - 1].t;
      It_total_N_s += ((TTI_Thrust_N + E_N[i - 1]) / 2) * dt_i;
    }
  }

  const Pmed_MPa = active_burn_steps > 0 ? P_sum / active_burn_steps : 0;
  const avgForceDenom = t_quemado > 0 ? t_quemado : t_fin;
  const Fmed_N = avgForceDenom > 0 ? It_total_N_s / avgForceDenom : 0;

  const Kn_avg = active_burn_steps > 0 ? Kn_sum / active_burn_steps : Kn_arr[0] || 0;
  const r_avg = active_burn_steps > 0 ? r_sum / active_burn_steps : r_burn_arr[0] || 0;
  const mdot_avg = active_burn_steps > 0 ? mdot_sum / active_burn_steps : 0;

  const Isp_total_s = initialMassTotal > 0 ? It_total_N_s / (G0_STANDARD * initialMassTotal) : 0;
  const motorClass = classifyMotor(It_total_N_s);
  const k_avg = k_active_count > 0 ? k_sum_steps / k_active_count : state[0]?.prop.k || 1.13;

  const propTypes = grains.map((g) => g.propellantType);
  const dominantPropellantType =
    propTypes
      .sort(
        (a, b) =>
          propTypes.filter((v) => v === a).length - propTypes.filter((v) => v === b).length
      )
      .pop() || 1;

  return {
    t,
    P0_MPa,
    P0_gage,
    mgra_total,
    F_N,
    F_kg,
    E_N,
    E_kg,
    grains: grains.map((g, idx) =>
      state[idx]?.customGrainSnapshot
        ? {
            ...g,
            customGrainId: state[idx].customGrainId ?? g.customGrainId,
            customGrainSnapshot: state[idx].customGrainSnapshot,
          }
        : g
    ),
    grains_x,
    grains_Abc,
    grains_Abe,
    grains_Abs,
    grains_Ab,
    grains_burnback: state.map((s) => s.burnbackTable ?? null),
    propellantType: dominantPropellantType,
    customPropellants,
    customGrainShapes,
    Kn: Kn_arr,
    At_mm2: At_mm2_arr,
    r_burn: r_burn_arr,
    mdot_gen: mdot_gen_arr,
    mdot_noz: mdot_noz_arr,
    Ab_total: Ab_total_arr,
    summary: {
      Pmax_MPa,
      Pmed_MPa,
      t_quemado,
      t_fin,
      Fmax_N,
      Fmed_N,
      It_total_N_s,
      Isp_total_s,
      motorClass,
      k_avg,
      Kn_max,
      Kn_avg,
      Kn_initial: Kn_arr[0] || 0,
      Kn_final,
      r_max,
      r_avg,
      r_initial: r_burn_arr[0] || 0,
      mdot_max,
      mdot_avg,
      initial_mass_g: initialMassTotal * 1000,
    },
  };
}