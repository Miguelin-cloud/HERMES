import { GrainInput, MotorInput, NozzleInput, SimulationInputs, SimulationResults, getPropellantData, getBurnRate, classifyMotor } from './types';
import { fzeroSearch } from './math';

export function runSimulation({ motor, grains, nozzle }: SimulationInputs): SimulationResults {
  const t: number[] = [];
  const P0_MPa: number[] = [];
  const P0_gage: number[] = [];
  const mgra_total: number[] = [];
  const F_N: number[] = [];
  const F_kg: number[] = [];
  const E_N: number[] = [];
  const E_kg: number[] = [];

  const Ntipos = grains.length;
  const Patm = motor.Pamb || 0.101325; // MPa
  const Runiv = 8314; // J/(mol K) 
  
  if (Ntipos === 0) throw new Error("No grains defined");

  // Initial State Struct per grain
  let state = grains.map(g => {
    // Initial geometry calculation
    let Vg = 0;
    let d0_mayor = g.shape === 2 ? g.d0mayor : 0;
    let tweb0 = 0;
    let Aduct = 0;

    let pablo = 1;
    let miguel = 1;
    let alpha_deg = nozzle.alpha || 12;

    if (g.shape === 1) { // Cylinder
      Vg = (Math.PI / 4) * (Math.pow(g.D0, 2) - Math.pow(g.d0, 2)) * g.L0;
      tweb0 = (g.D0 - g.d0) / 2;
      Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * (Math.pow(g.D0, 2) - Math.pow(g.d0, 2));
    } else if (g.shape === 2) { // Star
      const Np = g.Np || 5;
      const Mx = g.d0mayor / 2;
      
      const term_pablo_atan = Math.atan( (Mx - (g.d0/2) * Math.cos(Math.PI / Np)) / ((g.d0/2) * Math.sin(Math.PI / Np)) );
      pablo = Math.cos(-Math.PI / Np + term_pablo_atan);
      
      const term_miguel_atan = Math.atan( ((g.d0/2) * Math.sin(Math.PI / Np)) / (Mx - (g.d0/2) * Math.cos(Math.PI / Np)) );
      miguel = Math.cos(Math.PI/2 - term_miguel_atan);

      const star_hole_area = Np * 0.5 * (g.d0mayor / 2 - g.d0 / 2 * Math.cos(Math.PI / Np)) * g.d0 * Math.sin(Math.PI / Np) + 
                            Np * 0.5 * Math.pow(g.d0 / 2, 2) * Math.sin(2 * Math.PI / Np);
      
      Vg = ( (Math.PI / 4) * Math.pow(g.D0, 2) - star_hole_area ) * g.L0;
      tweb0 = (g.D0 - g.d0) / 2; 
      Aduct = (Math.PI/4) * Math.pow(motor.Dc, 2) - ( (Math.PI/4)*Math.pow(g.D0, 2) - star_hole_area );
    } else { // Solid
      Vg = (Math.PI / 4) * Math.pow(g.D0, 2) * g.L0;
      tweb0 = g.D0 / 2;
      Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * Math.pow(g.D0, 2);
    }
    
    // total length = N blocks
    let Lg0 = g.L0 * g.N;
    let Vg0 = Vg * g.N;
    
    const prop = getPropellantData(g.propellantType);
    const rhoreal = prop.rho * g.rhorat; // g/cm3 
    const mg0 = rhoreal * Vg0 / 1e6; // kg
    
    return {
      ...g,
      tweb0,
      d: g.d0,
      D: g.D0,
      L: Lg0,
      tweb: tweb0,
      Vg: Vg0,
      mg: mg0,
      dmayor: d0_mayor,
      dmenor: g.d0,
      Abe: 0,
      Abc: 0,
      Abs: 0,
      Ab: 0,
      prop,
      rhoreal,
      Aduct,
      xincp: 0,
      x: 0,
      betha: g.shape === 2 ? 2 * Math.PI / g.Np : 0,
      pablo,
      miguel,
      alpha_deg,
      At: (Math.PI / 4) * Math.pow(nozzle.Dt0, 2),
    };
  });

  const At0 = (Math.PI / 4) * Math.pow(nozzle.Dt0, 2); // mm2
  const Ae = (Math.PI / 4) * Math.pow(nozzle.Ds, 2); // mm2
  const exprat2 = Ae / At0;

  let current_t = 0;
  let mgra_total_val = state.reduce((sum, s) => sum + s.mg, 0);
  const initialMassTotal = mgra_total_val;
  let P0 = Patm; // initial pressure MPa

  const Vc_m3 = (Math.PI / 4) * Math.pow(motor.Dc, 2) * motor.Lc / 1e9; 
  let msto_total_acc = 0;
  let P0_prod_Pa = 0; // absolute pressure of product gas (Pa), starts at 0
  let Vfree_total = Vc_m3;
  let R_total = state[0] ? 8314 / state[0].prop.M : 287; // default R if state empty
  let T0real_total = state[0] ? state[0].prop.T0 * motor.etac : 1710 * motor.etac;
  let k_total = state[0]?.prop.k || 1.13;

  let step = 0;
  const hist: any[] = [];
  let k_sum_steps = 0;
  let k_active_count = 0;
  
  // Push initial state at t=0
  hist.push({
    t: 0,
    P0_MPa: Patm,
    P0_gage: 0,
    mgra_total: mgra_total_val,
    T0real_total: (state[0]?.prop.T0 || 1710) * motor.etac,
    R_total: R_total,
    k_total: state[0]?.prop.k || 1.13,
    At_total_val: At0,
    grains_x: state.map(s => 0),
    grains_Abc: state.map(s => s.Abc || 0),
    grains_Abe: state.map(s => s.Abe || 0),
    grains_Abs: state.map(s => s.Abs || 0),
    grains_Ab: state.map(s => s.Ab || 0)
  });

  while (mgra_total_val >= 0.00001 && step < 10000) {
    step++;
    const dt = motor.paso_de_tiempo;
    current_t += dt;

    let sum_mg = 0;
    let sum_k_moles = 0;
    let sum_M_moles = 0;
    let sum_T0_moles = 0;
    let total_mgen = 0;
    let total_molesb = 0;
    let min_Aduct = Infinity;

    for (let s of state) {
      if (s.D === 0 && s.L === 0) continue;

      const { a, n } = getBurnRate(P0, s.propellantType);
      const Aduct_At = Math.max(0, s.Aduct / At0);
      let Gg = Math.max(0, motor.Gstar - Aduct_At);
      
      const r = (1 + motor.kv * Gg) * a * Math.pow(P0, n);
      const dx = r * dt;
      s.xincp = dx;
      s.x += dx;

      let prev_mg = s.mg;

      let prev_Ab = s.Ab;

      // GEOMETRY
      if (s.shape === 1) { // Cilindro
        s.d = s.d0 + s.ci * 2 * s.x;
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        
        s.tweb = (s.D - s.d) / 2;

        if (s.d >= s.D || s.L <= 0) { 
          s.D = 0; s.d = 0; s.L = 0; s.tweb = 0; 
          s.Vg = 0; s.Abe = 0; s.Abc = 0; s.Abs = 0; s.Ab = 1e-4;
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2);
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e, 2);
        } else {
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2));
          s.Abe = s.ei * 2 * s.N * (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2));
          s.Abc = s.ci * Math.PI * s.d * s.L;
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Ab = Math.max(0, s.Abe + s.Abc + s.Abs);
          s.Vg = (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2)) * s.L;
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e * (s.tweb0 - s.tweb)/s.tweb0, 2);
        }
      } else if (s.shape === 3) {
        // Solid generic
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        
        s.tweb = s.D / 2;

        if (s.D <= 0 || s.L <= 0) {
          s.D = 0; s.L = 0; s.tweb = 0;
          s.Vg = 0; s.Abe = 0; s.Abc = 0; s.Abs = 0; s.Ab = 1e-4;
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2);
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e, 2);
        } else {
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * Math.pow(s.D, 2);
          s.Abe = s.ei * 2 * s.N * (Math.PI / 4) * Math.pow(s.D, 2);
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Abc = 0;
          s.Ab = Math.max(0, s.Abe + s.Abs);
          s.Vg = (Math.PI / 4) * Math.pow(s.D, 2) * s.L;
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e * (s.tweb0 - s.tweb)/s.tweb0, 2);
        }
      } else {
        // Estrella shape (2)
        const Np = s.Np || 5;
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        
        s.dmenor = s.d0 + s.ci * (2 * s.x / s.pablo);
        s.dmayor = s.d0mayor + s.ci * (2 * s.x / s.miguel);
        s.d = s.dmenor; // d is dmenor in star representation

        let stopFlag = false;
        if (s.D <= 0 || s.L <= 0 || s.dmenor >= s.D) stopFlag = true;

        if (stopFlag) {
          s.dmenor = 0; s.dmayor = 0; s.D = 0; s.L = 0; s.tweb = 0;
          s.Vg = 0; s.Abe = 0; s.Abc = 0; s.Abs = 0; s.Ab = 1e-4;
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2);
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e, 2);
        } else if (s.dmayor < s.D) {
          // Phase 1: Both dmenor and dmayor are inside the grain boundary D
          s.tweb = (s.D - s.dmenor) / 2;
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e * (s.tweb0 - s.tweb)/s.tweb0, 2);
          
          const area_hole = Np * 0.5 * (s.dmayor/2 - s.dmenor/2 * Math.cos(Math.PI/Np)) * s.dmenor * Math.sin(Math.PI/Np) + 
                            Np * 0.5 * Math.pow(s.dmenor/2, 2) * Math.sin(2 * Math.PI/Np);
          const arm_length = Math.sqrt(Math.pow(s.dmayor/2 - s.dmenor/2 * Math.cos(Math.PI/Np), 2) + Math.pow(s.dmenor/2 * Math.sin(Math.PI/Np), 2));
          
          s.Vg = ((Math.PI/4) * Math.pow(s.D, 2) - area_hole) * s.L;
          s.Abe = s.ei * 2 * s.N * ((Math.PI/4) * Math.pow(s.D, 2) - area_hole);
          s.Abc = s.ci * 2 * Np * s.N * arm_length * s.L;
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Ab = Math.max(0, s.Abe + s.Abc + s.Abs);
          if (s.Ab <= 0) s.Ab = 1e-4;
          
          s.Aduct = Math.max(1e-6, (Math.PI / 4) * Math.pow(motor.Dc, 2) - ((Math.PI/4)*Math.pow(s.D,2) - area_hole));
        } else {
          // Phase 2: Tips of the star reached boundary D, but dmenor is still inside.
          s.tweb = (s.D - s.dmenor) / 2;
          s.At = (Math.PI / 4) * Math.pow(nozzle.Dt0 + nozzle.e * (s.tweb0 - s.tweb)/s.tweb0, 2);
          
          const alpha_rad = s.alpha_deg * Math.PI / 180;
          const target_fun = (beta: number) => {
            return (s.D - s.dmenor)/2 - (s.D/2)*(1 - Math.cos(beta/2)) - (s.D/4)*Math.sqrt(Math.max(1e-12, 2*(1 - Math.cos(beta)))) / Math.tan(alpha_rad/2);
          };
          
          let betha = s.betha || (2 * Math.PI / Np);
          try {
            betha = fzeroSearch(target_fun, [1e-6, 2 * Math.PI / Np], 50);
            if (isNaN(betha) || betha <= 0) betha = s.betha || (2 * Math.PI / Np);
          } catch (err) {
            betha = s.betha || (2 * Math.PI / Np);
          }
          s.betha = betha;
          
          const clip_dmayor = s.D;
          const ae_val = (s.D / 2) * Math.sin(betha / 2) / Math.tan(alpha_rad / 2);
          const c_val = 2 * (clip_dmayor / 2) * Math.sin(betha / 2);
          const lado_val = ae_val / Math.cos(alpha_rad / 2);
          
          const term_segment = (s.D*s.D/8) * (betha - Math.sin(betha)) + (c_val * ae_val / 2);
          s.Vg = Np * term_segment * s.L;
          
          s.Abe = s.N * 2 * s.ei * Np * term_segment;
          s.Abc = s.N * s.ci * Np * 2 * lado_val * s.L;
          s.Abs = s.N * s.osi * Np * betha * (s.D / 2) * s.L;
          s.Ab = Math.max(0, s.Abe + s.Abc + s.Abs);
          if (s.Ab <= 0) s.Ab = 1e-4;
          
          s.Aduct = Math.max(1e-6, (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Np * term_segment));
        }
      }

      s.mg = s.rhoreal * s.Vg / 1e6; // kg
      let mgen = (prev_mg - s.mg) / dt; // kg/s
      if (mgen < 0) mgen = 0;

      let molesb_s = s.prop.M > 0 ? (mgen * 1000) / s.prop.M : 0; // mol/s
      total_mgen += mgen;
      total_molesb += molesb_s;
      
      sum_mg += s.mg;
      sum_k_moles += molesb_s * s.prop.k;
      sum_M_moles += molesb_s * s.prop.M;
      sum_T0_moles += molesb_s * s.prop.T0;
      if (s.Aduct < min_Aduct) min_Aduct = s.Aduct;
    }

    mgra_total_val = sum_mg;

    // Averages
    let M_total = total_molesb > 0 ? sum_M_moles / total_molesb : state[0].prop.M;
    k_total = total_molesb > 0 ? sum_k_moles / total_molesb : state[0].prop.k;
    let T0_total = total_molesb > 0 ? sum_T0_moles / total_molesb : state[0].prop.T0;

    R_total = M_total > 0 ? 8314 / M_total : 8314 / state[0].prop.M;
    T0real_total = T0_total * motor.etac;

    if (total_molesb > 0) {
      k_sum_steps += k_total;
      k_active_count++;
    }

    // Average dynamic throat area At across all grain blocks
    const At_total_val = state.reduce((sum, s) => sum + (s.At || At0), 0) / Ntipos;
    const current_exprat2 = Ae / At_total_val;

    // mnoz_total is the mass flow of gas escaping the chamber, driven by the absolute product gas pressure
    const mnoz_total = P0_prod_Pa * (At_total_val / 1e6) * Math.sqrt(k_total / (R_total * T0real_total)) * Math.pow(2 / (k_total + 1), (k_total + 1) / (2 * (k_total - 1)));
    
    const msto_total = total_mgen - mnoz_total;
    msto_total_acc += msto_total * dt;

    const Vgra_total = state.reduce((a,b) => a + b.Vg, 0) / 1e9;
    Vfree_total = Math.max(1e-9, Vc_m3 - Vgra_total);
    const rhoprod = Math.max(0, msto_total_acc / Vfree_total);

    // The pressure from the accumulated gas density is already an absolute pressure by the Ideal Gas Law (P = rho*R*T).
    // Adding Patm on top of this was a redundant double addition that shifted the pressure upward by Patm.
    P0_prod_Pa = rhoprod * R_total * T0real_total;
    P0 = Math.max(Patm, P0_prod_Pa / 1e6); // Chamber absolute pressure (never below Patm)

    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: mgra_total_val,
      T0real_total: T0real_total,
      R_total: R_total,
      k_total: k_total,
      At_total_val: At_total_val,
      grains_x: state.map(s => s.x),
      grains_Abc: state.map(s => s.Abc),
      grains_Abe: state.map(s => s.Abe),
      grains_Abs: state.map(s => s.Abs),
      grains_Ab: state.map(s => s.Ab)
    });
  }

  // Post combustion
  let tbout = current_t;
  let pbout = P0;
  let gauge_bout = pbout - Patm;
  let k_enfriamiento = 0.02;
  
  // Use final active burn temperature as starting point for exponential cooling
  let T02real_total = T0real_total; 
  let Cstar_total = Math.sqrt(R_total * T02real_total) / 1.1; // Approx
  
  // Get the final dynamic throat area at burnout
  const final_At_total_val = state.reduce((sum, s) => sum + (s.At || At0), 0) / Ntipos;

  while ((P0 - Patm) > 0.01 && step < 12000) {
    step++;
    const dt = motor.paso_de_tiempo;
    current_t += dt;
    T02real_total = T02real_total * Math.exp(-k_enfriamiento * dt);
    
    let gauge_current = gauge_bout * Math.exp(- (R_total * T02real_total * (final_At_total_val / 1e6) * (current_t - tbout) / Vfree_total) / Cstar_total );
    P0 = gauge_current + Patm;
    
    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: 0,
      T0real_total: T02real_total,
      R_total: R_total,
      k_total: k_total,
      At_total_val: final_At_total_val,
      grains_x: hist[hist.length-1]?.grains_x || grains.map(() => 0),
      grains_Abc: hist[hist.length-1]?.grains_Abc || grains.map(() => 0),
      grains_Abe: hist[hist.length-1]?.grains_Abe || grains.map(() => 0),
      grains_Abs: hist[hist.length-1]?.grains_Abs || grains.map(() => 0),
      grains_Ab: hist[hist.length-1]?.grains_Ab || grains.map(() => 0)
    });
  }

  // TTI performance calculator for each step
  // TTI = Teoria de Toberas Ideales
  let Pmax_MPa = 0;
  let P_sum = 0;
  let Fmax_N = 0;
  let F_sum = 0;
  let It_total_N_s = 0;
  let active_burn_steps = 0;
  let t_quemado = 0;
  let t_fin = 0;

  const grains_x: number[][] = grains.map(() => []);
  const grains_Abc: number[][] = grains.map(() => []);
  const grains_Abe: number[][] = grains.map(() => []);
  const grains_Abs: number[][] = grains.map(() => []);
  const grains_Ab: number[][] = grains.map(() => []);

  for (let i = 0; i < hist.length; i++) {
    const step = hist[i];
    
    let P0 = step.P0_MPa;
    let T0real_total = step.T0real_total;
    let R_total = step.R_total;
    let k_total = step.k_total;
    let At_total_val = step.At_total_val;
    let current_exprat2 = Ae / At_total_val;

    // --- TTI Thrust ---
    let Gamma_total = k_total;
    const funMs_scalar = (Ms: number) => (1/Math.max(1e-5, Ms)) * Math.pow((1 + (Gamma_total - 1)/2 * Math.pow(Ms, 2)) / ((Gamma_total + 1)/2), (Gamma_total + 1)/(2*(Gamma_total - 1))) - current_exprat2;
    let Ms1 = fzeroSearch(funMs_scalar, [0.01, 1], 100);
    let Ms2 = fzeroSearch(funMs_scalar, [1, 20], 100);
    if (isNaN(Ms1) || Ms1 < 0) Ms1 = 0.5;
    if (isNaN(Ms2) || Ms2 < 1) Ms2 = 2.0;

    let pis1 = Math.pow(1 + ((Gamma_total - 1)/2)*Math.pow(Ms1, 2), -Gamma_total/(Gamma_total - 1));
    let pich = (2*Gamma_total*Math.pow(Ms2, 2) - (Gamma_total - 1))/(Gamma_total + 1);
    let pis2 = Math.pow(1 + ((Gamma_total - 1)/2)*Math.pow(Ms2, 2), -Gamma_total/(Gamma_total - 1));

    let Pp = Patm / P0;

    let PsOutput = Patm;
    let GastoOutput = 0;
    let vsOutput = 0;
    let MachFactor = 1;

    if (P0 <= Patm + 0.0001) {
      PsOutput = Patm;
      GastoOutput = 0;
      vsOutput = 0;
      MachFactor = 1;
    } else if (Pp >= pis1) { // Tobera subsonica
      PsOutput = Patm;
      let baseMsSub = Math.max(0, Math.pow(Patm / P0, -(Gamma_total - 1) / Gamma_total) - 1);
      let ms_sub = Math.sqrt((baseMsSub * 2) / (Gamma_total - 1));
      let Ts_sub = T0real_total * Math.pow(PsOutput / P0, (Gamma_total - 1)/Gamma_total);
      let gastoCore = Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(ms_sub, 2), -(Gamma_total+1)/(2*(Gamma_total-1)));
      GastoOutput = P0 * 1e6 * Math.sqrt(Gamma_total / (R_total * T0real_total)) * (Math.PI * Math.pow(nozzle.Ds / 2000, 2)) * gastoCore;
      vsOutput = Math.sqrt(Gamma_total * R_total * Ts_sub) * ms_sub;
    } else if (Pp < pis1 && Pp >= pich) { // OC Normal dentro
      PsOutput = Patm;
      const funMs_OCN = (Ms: number) => current_exprat2 * (Patm / P0) * Math.pow(1 + (Gamma_total - 1)/2, (Gamma_total + 1)/(2*(Gamma_total - 1))) * Ms * Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(Ms, 2), 0.5) - 1;
      let ms_out = fzeroSearch(funMs_OCN, [0.01, 1], 100);
      GastoOutput = P0 * 1e6 * (At_total_val / 1e6) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
      let TsOutput = T0real_total / (1 + (Gamma_total - 1)/2 * Math.pow(ms_out, 2));
      vsOutput = Math.sqrt(Gamma_total * R_total * TsOutput) * ms_out;
    } else if (Pp < pich && Pp > pis2) { // OC Oblicua a la salida
      PsOutput = P0 / Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(Ms2, 2), Gamma_total/(Gamma_total - 1));
      let TsOut = T0real_total * Math.pow(P0 / PsOutput, (1 - Gamma_total)/Gamma_total);
      let Mn_s2 = Math.sqrt(Math.max(1, (Patm / (P0 * pis2) * (Gamma_total + 1) + (Gamma_total - 1)) / (2 * Gamma_total)));
      let BetaOut = Math.asin(Math.min(1, Mn_s2 / Ms2)) * 180 / Math.PI;
      let extCore = ((Gamma_total - 1) * Math.pow(Mn_s2, 2) + 2) / Math.max(1e-5, (2 * Gamma_total * Math.pow(Mn_s2, 2) - (Gamma_total - 1)));
      let Mn_ext = Math.sqrt(Math.max(0, extCore));
      let Alfa_OCO = BetaOut - Math.atan(Mn_ext / Ms2 / Math.cos(BetaOut * Math.PI / 180)) * 180 / Math.PI;
      
      GastoOutput = P0 * 1e6 * (At_total_val / 1e6) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
      vsOutput = Math.sqrt(Gamma_total * R_total * TsOut) * Ms2;
      MachFactor = Math.cos(Alfa_OCO * Math.PI / 180);
    } else if (Pp === pis2) { // Tobera Adaptada
      PsOutput = Patm;
      let TsOut = T0real_total * Math.pow(P0 / PsOutput, (1 - Gamma_total)/Gamma_total);
      GastoOutput = P0 * 1e6 * (At_total_val / 1e6) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
      vsOutput = Math.sqrt(Gamma_total * R_total * TsOut) * Ms2;
    } else { // Onda Expansion Salida
      PsOutput = P0 / Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(Ms2, 2), Gamma_total/(Gamma_total - 1));
      let TsOut = T0real_total * Math.pow(P0 / PsOutput, (1 - Gamma_total)/Gamma_total);
      
      let coreMext = Math.max(0, Math.pow(Patm / P0, (1 - Gamma_total)/Gamma_total) - 1);
      let MextOut = Math.sqrt(coreMext * 2 / (Gamma_total - 1));
      let part1 = Math.sqrt((Gamma_total-1)/(Gamma_total+1)*Math.max(0, Math.pow(MextOut,2)-1));
      let Nu_Mext = Math.sqrt((Gamma_total+1)/(Gamma_total-1)) * Math.atan(part1) - Math.atan(Math.sqrt(Math.max(0, Math.pow(MextOut,2)-1)));
      let part2 = Math.sqrt((Gamma_total-1)/(Gamma_total+1)*Math.max(0, Math.pow(Ms2,2)-1));
      let Nu_Ms2 = Math.sqrt((Gamma_total+1)/(Gamma_total-1)) * Math.atan(part2) - Math.atan(Math.sqrt(Math.max(0, Math.pow(Ms2,2)-1)));
      let TetaOut = (Nu_Mext - Nu_Ms2) * 180 / Math.PI;
      
      GastoOutput = P0 * 1e6 * (At_total_val / 1e6) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
      vsOutput = Math.sqrt(Gamma_total * R_total * TsOut) * Ms2;
      MachFactor = Math.cos(TetaOut * Math.PI / 180);
    }

    if (isNaN(GastoOutput) || GastoOutput < 0) GastoOutput = 0;
    if (isNaN(vsOutput) || vsOutput < 0) vsOutput = 0;
    if (isNaN(MachFactor)) MachFactor = 1;

    let momentumThrust_TTI = GastoOutput * vsOutput;
    let pressureThrust_TTI = (PsOutput - Patm) * 1e6 * (Math.PI * Math.pow(nozzle.Ds / 2000, 2));

    let TTI_Thrust_N = nozzle.etanoz * (momentumThrust_TTI * MachFactor + pressureThrust_TTI);
    if (i === 0 || P0 <= Patm + 0.0001) TTI_Thrust_N = 0;
    
    // Debug
    if (i % 100 === 0) {
      console.log(`Step ${i}: P0_MPa=${P0.toFixed(4)}, TTI_Thrust_N=${TTI_Thrust_N.toFixed(2)}, PsOutput=${PsOutput.toFixed(4)}, MachFactor=${MachFactor.toFixed(2)}`);
    }

    let finalE = TTI_Thrust_N / 9.81;
    if (isNaN(finalE) || finalE < 0) finalE = 0;

    // --- Richard Nakka Thrust ---
    let Pe_RN = P0 / Math.pow((1 + (Gamma_total - 1)/2 * Math.pow(Ms2, 2)), Gamma_total/(Gamma_total - 1));
    let Pe_P0_ratio = Math.max(0, Math.min(1, Pe_RN / P0));
    
    let alpha_rad = ((nozzle.alpha || 12) * Math.PI) / 180;
    let lambda_RN = (1 + Math.cos(alpha_rad)) / 2;
    
    let momentum_CF_RN = Math.sqrt( (2*Math.pow(Gamma_total,2)/(Gamma_total-1)) * Math.pow(2/(Gamma_total+1), (Gamma_total+1)/(Gamma_total-1)) * (1 - Math.pow(Pe_P0_ratio, (Gamma_total-1)/Gamma_total)) );
    let pressure_CF_RN = ((Pe_RN - Patm)/P0)*current_exprat2;
    
    let CF_RN = nozzle.etanoz * (lambda_RN * momentum_CF_RN + pressure_CF_RN);
    if (isNaN(CF_RN)) CF_RN = 0;
    let F_RN_N = CF_RN * (At_total_val / 1e6) * (P0 * 1e6);
    if (i === 0 || P0 <= Patm + 0.0001) F_RN_N = 0;
    if (isNaN(F_RN_N) || F_RN_N < 0) F_RN_N = 0;

    t.push(step.t);
    P0_MPa.push(step.P0_MPa);
    P0_gage.push(step.P0_gage);
    mgra_total.push(step.mgra_total);
    F_N.push(F_RN_N); // Richard Nakka
    F_kg.push(F_RN_N / 9.81);
    E_N.push(TTI_Thrust_N);    // TTI
    E_kg.push(finalE);

    for (let g = 0; g < grains.length; g++) {
      grains_x[g].push(step.grains_x?.[g] || 0);
      grains_Abc[g].push(step.grains_Abc?.[g] || 0);
      grains_Abe[g].push(step.grains_Abe?.[g] || 0);
      grains_Abs[g].push(step.grains_Abs?.[g] || 0);
      grains_Ab[g].push(step.grains_Ab?.[g] || 0);
    }

    if (step.P0_MPa > Pmax_MPa) Pmax_MPa = step.P0_MPa;
    if (TTI_Thrust_N > Fmax_N) Fmax_N = TTI_Thrust_N;

    if (step.mgra_total > 0) {
      P_sum += step.P0_gage;
      active_burn_steps++;
      t_quemado = step.t;
    }
    
    if (TTI_Thrust_N > 1) t_fin = step.t;

    if (i > 0) {
      const dt = step.t - hist[i-1].t;
      It_total_N_s += ((TTI_Thrust_N + E_N[i-1]) / 2) * dt;
    }
  }

  const Pmed_MPa = active_burn_steps > 0 ? P_sum / active_burn_steps : 0;
  const Fmed_N = active_burn_steps > 0 ? It_total_N_s / t_quemado : 0;
  
  const Isp_total_s = initialMassTotal > 0 ? It_total_N_s / (9.806 * initialMassTotal) : 0;
  const motorClass = classifyMotor(It_total_N_s);
  const k_avg = k_active_count > 0 ? k_sum_steps / k_active_count : (state[0]?.prop.k || 1.13);

  // Find dominant propellant type
  const propTypes = grains.map(g => g.propellantType);
  const dominantPropellantType = propTypes.sort((a,b) =>
      propTypes.filter(v => v===a).length - propTypes.filter(v => v===b).length
  ).pop() || 1;

  return {
    t, P0_MPa, P0_gage, mgra_total, F_N, F_kg, E_N, E_kg,
    grains, grains_x, 
    grains_Abc, grains_Abe, grains_Abs, grains_Ab,
    propellantType: dominantPropellantType,
    summary: { Pmax_MPa, Pmed_MPa, t_quemado, t_fin, Fmax_N, Fmed_N, It_total_N_s, Isp_total_s, motorClass, k_avg }
  };
}
