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
    let r_ext = g.D0 / 2;
    let tweb0 = 0;
    let Aduct = 0;

    if (g.shape === 1) { // Cylinder
      Vg = (Math.PI / 4) * (Math.pow(g.D0, 2) - Math.pow(g.d0, 2)) * g.L0;
      tweb0 = (g.D0 - g.d0) / 2;
      Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * (Math.pow(g.D0, 2) - Math.pow(g.d0, 2));
    } else if (g.shape === 2) { // Star
      const ae = (g.d0mayor / 2) * Math.cos(Math.PI / g.Np) - g.d0 / 2;
      const b = (g.d0mayor / 2) * Math.cos(Math.PI / g.Np);
      Vg = ( (Math.PI / 4) * Math.pow(g.D0, 2) - 
           (g.Np * 0.5 * ae * g.d0 * Math.sin(Math.PI / g.Np) + 
            g.Np * 0.5 * Math.pow(g.d0 / 2, 2) * Math.sin(2 * Math.PI / g.Np)) ) * g.L0;
      tweb0 = (g.D0 - g.d0mayor) / 2;
      Aduct = (Math.PI/4) * Math.pow(motor.Dc, 2) - 
        ( (Math.PI/4)*Math.pow(g.D0, 2) - (g.Np*0.5*ae*g.d0*Math.sin(Math.PI/g.Np) + g.Np*0.5*Math.pow(g.d0/2, 2)*Math.sin(2*Math.PI/g.Np)) );
    } else { // Solid
      Vg = (Math.PI / 4) * Math.pow(g.D0, 2) * g.L0;
      tweb0 = g.D0 / 2;
      Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * Math.pow(g.D0, 2);
    }
    
    // total length = N blocks
    let Lg0 = g.L0 * g.N;
    let Vg0 = Vg * g.N;
    
    const prop = getPropellantData(g.propellantType);
    const rhoreal = prop.rho * g.rhorat; // g/cm3 (same as kg/L?? no, 1 g/cm3 = 1000 kg/m3. Wait, in MATLAB: rhoreal .* Vg ./ 1000^2 -> rhoreal (g/cm3) * Vg (mm3) / 1e6
    // If rhoreal is g/cm3 = mg/mm3. So rhoreal * Vg gives mg. mg / 1000000 = kg. Correct.
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
    };
  });

  const At0 = (Math.PI / 4) * Math.pow(nozzle.Dt0, 2); // mm2
  const Ae = (Math.PI / 4) * Math.pow(nozzle.Ds, 2); // mm2
  const exprat2 = Ae / At0;

  let current_t = 0;
  let mgra_total_val = state.reduce((sum, s) => sum + s.mg, 0);
  let P0 = Patm; // initial pressure MPa

  const Vc_m3 = (Math.PI / 4) * Math.pow(motor.Dc, 2) * motor.Lc / 1e9; 
  let msto_total_acc = 0;
  let Vfree_total = Vc_m3;
  let R_total = state[0] ? 8314 / state[0].prop.M : 287; // default R if state empty

  let step = 0;
  const hist: any[] = [];
  
  // Push initial state at t=0
  hist.push({
    t: 0,
    P0_MPa: Patm,
    P0_gage: 0,
    mgra_total: mgra_total_val,
    E_kg: 0,
    E_N: 0,
    F_RN_N: 0,
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

      // GEOMETRY
      if (s.shape === 1) { // Cilindro
        s.d = s.d0 + s.ci * 2 * s.x;
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        
        if (s.d >= s.D || s.L <= 0) { s.D = 0; s.d = 0; s.L = 0; s.tweb = 0; }
        else s.tweb = (s.D - s.d) / 2;

        if (s.D > 0) {
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2));
          s.Abe = s.ei * 2 * s.N * (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2));
          s.Abc = s.ci * Math.PI * s.d * s.L;
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Ab = s.Abe + s.Abc + s.Abs;
          s.Vg = (Math.PI / 4) * (Math.pow(s.D, 2) - Math.pow(s.d, 2)) * s.L;
        } else {
          s.Ab = s.Ab * 0.75;
          s.Vg = 0;
        }
      } else if (s.shape === 3) {
        // Solid generic
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        if (s.D <= 0 || s.L <= 0) { s.D = 0; s.L = 0; s.tweb = 0; }
        else s.tweb = s.D / 2;
        if (s.D > 0) {
          s.Aduct = (Math.PI / 4) * Math.pow(motor.Dc, 2) - (Math.PI / 4) * Math.pow(s.D, 2);
          s.Abe = s.ei * 2 * s.N * (Math.PI / 4) * Math.pow(s.D, 2);
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Abc = 0;
          s.Ab = s.Abe + s.Abs;
          s.Vg = (Math.PI / 4) * Math.pow(s.D, 2) * s.L;
        } else {
          s.Ab = s.Ab * 0.75;
          s.Vg = 0;
        }
      } else {
        // Estrella shape (2)
        // Simplified burn logic keeping Aduct matching geometry
        s.D = s.D0 - s.osi * 2 * s.x;
        s.L = s.L0 * s.N - s.ei * 2 * s.N * s.x;
        s.d = s.d0 + s.ci * 2 * s.x;
        s.dmayor = (s.d0mayor || s.d0) + s.ci * 2 * s.x;

        if (s.D <= 0 || s.L <= 0 || s.d >= s.D) { s.D = 0; s.d = 0; s.L = 0; s.tweb = 0; }
        else s.tweb = (s.D - s.dmayor) / 2;
        
        if (s.D > 0) {
          const Np = s.Np || 5;
          const r_tip = s.d / 2;
          const r_val = s.dmayor / 2;
          // Approximate burning area using a star perimeter equivalent
          // For each point, roughly length is tip to valley
          const arm_length = Math.sqrt(Math.pow(r_val * Math.cos(Math.PI/Np) - r_tip, 2) + Math.pow(r_val * Math.sin(Math.PI/Np), 2));
          const peri = Np * 2 * arm_length;
          const area_hole = (Math.PI/4) * Math.pow(s.d, 2); // very rough approx for Aduct
          
          s.Aduct = Math.max(0, (Math.PI / 4) * Math.pow(motor.Dc, 2) - ((Math.PI/4)*Math.pow(s.D,2) - area_hole));
          s.Abe = s.ei * 2 * s.N * ((Math.PI/4)*Math.pow(s.D,2) - area_hole);
          s.Abc = s.ci * peri * s.L;
          s.Abs = s.osi * Math.PI * s.D * s.L;
          s.Ab = Math.max(0, s.Abe + s.Abc + s.Abs);
          s.Vg = Math.max(0, ((Math.PI/4)*Math.pow(s.D,2) - area_hole) * s.L);
        } else {
          s.Ab = s.Ab * 0.75;
          s.Vg = 0;
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
    let k_total = total_molesb > 0 ? sum_k_moles / total_molesb : state[0].prop.k;
    let T0_total = total_molesb > 0 ? sum_T0_moles / total_molesb : state[0].prop.T0;

    R_total = M_total > 0 ? 8314 / M_total : 8314 / state[0].prop.M;
    const T0real_total = T0_total * motor.etac;

    const mnoz_total = (P0 - Patm) * 1e6 * (At0 / 1e6) * Math.sqrt(k_total / (R_total * T0real_total)) * Math.pow(2 / (k_total + 1), (k_total + 1) / (2 * (k_total - 1)));
    
    const msto_total = total_mgen - mnoz_total;
    msto_total_acc += msto_total * dt;

    const Vgra_total = state.reduce((a,b) => a + b.Vg, 0) / 1e9;
    Vfree_total = Math.max(1e-9, Vc_m3 - Vgra_total);
    const rhoprod = Math.max(0, msto_total_acc / Vfree_total);

    const P0_Pa = rhoprod * R_total * T0real_total + Patm * 1e6;
    P0 = Math.max(Patm, P0_Pa / 1e6); // Never below Patm

    // performance (Teoria de Toberas Ideales)
    let Gamma_total = k_total;
    const funMs_scalar = (Ms: number) => (1/Math.max(1e-5, Ms)) * Math.pow((1 + (Gamma_total - 1)/2 * Math.pow(Ms, 2)) / ((Gamma_total + 1)/2), (Gamma_total + 1)/(2*(Gamma_total - 1))) - exprat2;
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

    if (Pp >= pis1) { // Tobera subsonica
        PsOutput = Patm;
        let baseMsSub = Math.max(0, Math.pow(Patm / P0, -(Gamma_total - 1) / Gamma_total) - 1);
        let ms_sub = Math.sqrt((baseMsSub * 2) / (Gamma_total - 1));
        let Ts_sub = T0real_total * Math.pow(PsOutput / P0, (Gamma_total - 1)/Gamma_total);
        let gastoCore = Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(ms_sub, 2), -(Gamma_total+1)/(2*(Gamma_total-1)));
        GastoOutput = P0 * 1e6 * Math.sqrt(Gamma_total / (R_total * T0real_total)) * (Math.PI * Math.pow(nozzle.Ds / 2000, 2)) * gastoCore;
        vsOutput = Math.sqrt(Gamma_total * R_total * Ts_sub) * ms_sub;
    } else if (Pp < pis1 && Pp >= pich) { // OC Normal dentro
        PsOutput = Patm;
        GastoOutput = P0 * 1e6 * (Math.PI * Math.pow(nozzle.Dt0 / 2000, 2)) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
        let Ts_sub = T0real_total * Math.pow(PsOutput / P0, (Gamma_total - 1)/Gamma_total); // approx
        vsOutput = Math.sqrt(Gamma_total * R_total * Ts_sub) * Ms1;
    } else if (Pp < pich && Pp > pis2) { // OC Oblicua a la salida
        PsOutput = P0 / Math.pow(1 + (Gamma_total - 1)/2 * Math.pow(Ms2, 2), Gamma_total/(Gamma_total - 1));
        let TsOut = T0real_total * Math.pow(P0 / PsOutput, (1 - Gamma_total)/Gamma_total);
        let Mn_s2 = Math.sqrt(Math.max(1, (Patm / (P0 * pis2) * (Gamma_total + 1) + (Gamma_total - 1)) / (2 * Gamma_total)));
        let BetaOut = Math.asin(Math.min(1, Mn_s2 / Ms2)) * 180 / Math.PI;
        let extCore = ((Gamma_total - 1) * Math.pow(Mn_s2, 2) + 2) / Math.max(1e-5, (2 * Gamma_total * Math.pow(Mn_s2, 2) - (Gamma_total - 1)));
        let Mn_ext = Math.sqrt(Math.max(0, extCore));
        let Alfa_OCO = BetaOut - Math.atan(Mn_ext / Ms2 / Math.cos(BetaOut * Math.PI / 180)) * 180 / Math.PI;
        
        GastoOutput = P0 * 1e6 * (Math.PI * Math.pow(nozzle.Dt0 / 2000, 2)) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
        vsOutput = Math.sqrt(Gamma_total * R_total * TsOut) * Ms2;
        MachFactor = Math.cos(Alfa_OCO * Math.PI / 180);
    } else if (Pp === pis2) { // Tobera Adaptada
        PsOutput = Patm;
        let TsOut = T0real_total * Math.pow(P0 / PsOutput, (1 - Gamma_total)/Gamma_total);
        GastoOutput = P0 * 1e6 * (Math.PI * Math.pow(nozzle.Dt0 / 2000, 2)) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
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

        GastoOutput = P0 * 1e6 * (Math.PI * Math.pow(nozzle.Dt0 / 2000, 2)) * Math.sqrt(Gamma_total / (R_total * T0real_total)) * Math.pow(2 / (Gamma_total + 1), (Gamma_total + 1)/(2*(Gamma_total - 1)));
        vsOutput = Math.sqrt(Gamma_total * R_total * TsOut) * Ms2;
        MachFactor = Math.cos(TetaOut * Math.PI / 180);
    }

    if (isNaN(GastoOutput) || GastoOutput < 0) GastoOutput = 0;
    if (isNaN(vsOutput) || vsOutput < 0) vsOutput = 0;
    if (isNaN(MachFactor)) MachFactor = 1;

    let baseE = nozzle.etanoz * (GastoOutput * vsOutput + (PsOutput - Patm) * 1e6 * (Math.PI * Math.pow(nozzle.Ds / 2000, 2))) / 9.81;
    let finalE = baseE * MachFactor;
    if (isNaN(finalE) || finalE < 0) finalE = 0;

    // Richard Nakka Thrust
    // Calculates Pe based on adapted assumption (Ms2)
    let Pe_RN = P0 / Math.pow((1 + (Gamma_total - 1)/2 * Math.pow(Ms2, 2)), Gamma_total/(Gamma_total - 1));
    if (Pe_RN < Patm) Pe_RN = Patm; // Under-expanded correction (approx)
    let Pe_P0_ratio = Math.max(0, Math.min(1, Pe_RN / P0));
    let CF_RN = nozzle.etanoz * Math.sqrt( (2*Math.pow(Gamma_total,2)/(Gamma_total-1)) * Math.pow(2/(Gamma_total+1), (Gamma_total+1)/(Gamma_total-1)) * (1 - Math.pow(Pe_P0_ratio, (Gamma_total-1)/Gamma_total)) ) + ((Pe_RN - Patm)/P0)*(Ae/At0);
    if (isNaN(CF_RN)) CF_RN = 0;
    let F_RN_N = CF_RN * (At0 / 1e6) * (P0 * 1e6); // strictly N because P0 is MPa, so P0*1e6 is Pa, At0 is mm2 so At0/1e6 is m2
    if (isNaN(F_RN_N) || F_RN_N < 0) F_RN_N = 0;

    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: mgra_total_val,
      E_kg: finalE,
      E_N: finalE * 9.81,
      F_RN_N: F_RN_N,
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
  let k_enfriamiento = 0.02;
  let Cstar_total = Math.sqrt(R_total * hist[hist.length-1]?.T0real_total || state[0].prop.T0 * motor.etac) / 1.1; // Approx
  
  // Actually, we can get T0real_total from last step
  let T02real_total = state[0].prop.T0 * motor.etac; 

  while ((P0 - Patm) > 0.01 && step < 12000) {
    step++;
    const dt = motor.paso_de_tiempo;
    current_t += dt;
    T02real_total = T02real_total * Math.exp(-k_enfriamiento * dt);
    
    // P02_MPa(j,:) = pbout*exp(-(sum(R,'all')/Ntipos)*sum(T0real,'all')/Ntipos*Astarf*(t2(j,:)-tbout)/Vc*1000000000/Cstar_total);
    // Vc in MATLAB was in mm3, here Vfree_total is m3
    P0 = pbout * Math.exp(- (R_total * T02real_total * (At0 / 1e6) * (current_t - tbout) / Vfree_total) / Cstar_total );
    
    hist.push({
      t: current_t,
      P0_MPa: P0,
      P0_gage: P0 - Patm,
      mgra_total: 0,
      E_kg: 0,
      E_N: 0,
      F_RN_N: 0,
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
    t.push(step.t);
    P0_MPa.push(step.P0_MPa);
    P0_gage.push(step.P0_gage);
    mgra_total.push(step.mgra_total);
    F_N.push(step.F_RN_N); // Richard Nakka
    F_kg.push(step.F_RN_N / 9.81);
    E_N.push(step.E_N);    // TTI
    E_kg.push(step.E_kg);

    for (let g = 0; g < grains.length; g++) {
      grains_x[g].push(step.grains_x?.[g] || 0);
      grains_Abc[g].push(step.grains_Abc?.[g] || 0);
      grains_Abe[g].push(step.grains_Abe?.[g] || 0);
      grains_Abs[g].push(step.grains_Abs?.[g] || 0);
      grains_Ab[g].push(step.grains_Ab?.[g] || 0);
    }

    if (step.P0_gage > Pmax_MPa) Pmax_MPa = step.P0_gage;
    if (step.E_N > Fmax_N) Fmax_N = step.E_N;

    if (step.mgra_total > 0) {
      P_sum += step.P0_gage;
      active_burn_steps++;
      t_quemado = step.t;
    }
    
    if (step.E_N > 1) t_fin = step.t;

    if (i > 0) {
      const dt = step.t - hist[i-1].t;
      It_total_N_s += ((step.E_N + hist[i-1].E_N) / 2) * dt;
    }
  }

  const Pmed_MPa = active_burn_steps > 0 ? P_sum / active_burn_steps : 0;
  const Fmed_N = active_burn_steps > 0 ? It_total_N_s / t_quemado : 0;
  
  const initialMassTotal = grains.reduce((sum, g) => {
    const Vg = g.shape === 1 ? (Math.PI/4)*(Math.pow(g.D0,2)-Math.pow(g.d0,2))*g.L0 : g.shape === 3 ? (Math.PI/4)*Math.pow(g.D0,2)*g.L0 : 0; // rough approx for this summary metric if star
    const rhoreal = getPropellantData(g.propellantType).rho * g.rhorat;
    return sum + (rhoreal * (Vg*g.N) / 1e6);
  }, 0);

  const Isp_total_s = initialMassTotal > 0 ? It_total_N_s / (9.806 * initialMassTotal) : 0;
  const motorClass = classifyMotor(It_total_N_s);

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
    summary: { Pmax_MPa, Pmed_MPa, t_quemado, t_fin, Fmax_N, Fmed_N, It_total_N_s, Isp_total_s, motorClass }
  };
}
