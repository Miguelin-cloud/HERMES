export interface GrainInput {
  id: string;
  shape: 1 | 2 | 3;
  propellantType: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  D0: number; // mm
  d0: number; // mm
  d0mayor: number; // mm
  L0: number; // mm
  N: number;
  Np: number;
  osi: number; // 0 or 1
  ci: number; // 0 or 1
  ei: number; // 0 or 1
  rhorat: number;
}

export interface MotorInput {
  Dc: number; // mm
  Lc: number; // mm
  Gstar: number;
  kv: number;
  etac: number;
  paso_de_tiempo: number;
  Pamb: number; // MPa
}

export interface NozzleInput {
  Dt0: number; // mm (Initial throat diameter)
  Ds: number; // mm (Exit diameter)
  e: number; // mm (Throat diameter variation: >0 erosion, <0 slag deposition / constriction)
  ero_model?: 1 | 2 | 3 | 4 | 5 | 6; // 1: Lineal, 2: Exponencial, 3: Cuadrática, 4: Raíz, 5: Parábola, 6: Senoidal
  alpha: number; // deg (divergence)
  etanoz: number;
}

export interface SimulationInputs {
  motor: MotorInput;
  grains: GrainInput[];
  nozzle: NozzleInput;
}

export interface SimulationResults {
  t: number[];
  P0_MPa: number[];
  P0_gage: number[];
  F_N: number[];
  F_kg: number[];
  E_N: number[]; // Ideal Nozzle
  E_kg: number[]; // Ideal Nozzle
  mgra_total: number[];
  grains: GrainInput[];
  grains_x: number[][]; // [grainIndex][timeStep] array of burn depth over time
  grains_Abc: number[][]; // [grainIndex][timeStep] array of internal burn area
  grains_Abe: number[][]; // [grainIndex][timeStep] array of end burn area
  grains_Abs: number[][]; // [grainIndex][timeStep] array of external burn area
  grains_Ab: number[][];  // [grainIndex][timeStep] array of total burn area
  propellantType: number; // Dominant propellant type for visual rendering
  
  // Advanced Telemetry & Detailed Analysis Arrays
  Kn?: number[];
  At_mm2?: number[];
  r_burn?: number[]; // mm/s
  mdot_gen?: number[]; // kg/s
  mdot_noz?: number[]; // kg/s
  Ab_total?: number[]; // mm²

  summary: {
    Pmax_MPa: number;
    Pmed_MPa: number;
    t_quemado: number;
    t_fin: number;
    Fmax_N: number;
    Fmed_N: number;
    It_total_N_s: number;
    Isp_total_s: number;
    motorClass: string;
    k_avg: number;
    Kn_max?: number;
    Kn_avg?: number;
    Kn_initial?: number;
    Kn_final?: number;
    r_max?: number;
    r_avg?: number;
    r_initial?: number;
    mdot_max?: number;
    mdot_avg?: number;
    initial_mass_g?: number;
  };
}

export const PROPELLANTS = [
  { id: 1, name: "KNDX-65/35", rho: 1.879, k2ph: 1.043, k: 1.1308, M: 42.39, T0: 1710 },
  { id: 2, name: "KNSO-65/35", rho: 1.841, k2ph: 1.042, k: 1.1361, M: 39.9, T0: 1600 },
  { id: 3, name: "KNSU-65/35", rho: 1.889, k2ph: 1.044, k: 1.133, M: 42.02, T0: 1720 },
  { id: 4, name: "RNX-71V", rho: 1.8161, k2ph: 1.027, k: 1.18, M: 41.83, T0: 1492 },
  { id: 5, name: "RNX-57", rho: 1.869, k2ph: 1.026, k: 1.159, M: 45.54, T0: 1644 },
  { id: 6, name: "AP+HTPB (Reliant Robin)", rho: 1.682, k2ph: 1.198, k: 1.198, M: 24.98, T0: 2977 },
  { id: 7, name: "AP+HTPB (Risky Batman)", rho: 1.682, k2ph: 1.199, k: 1.198, M: 23.78, T0: 2884 }
];

export function getPropellantData(type: number) {
  return PROPELLANTS.find(p => p.id === type) || PROPELLANTS[0];
}

export interface PropellantVisualProfile {
  id: number;
  name: string;
  category: 'candy' | 'rnx' | 'apcp';
  displayName: string;
  hasFlame: boolean;
  hasDiamonds: boolean;
  isSmoky: boolean;
  smokeColorHex: string;
  smokeColorThree: number;
  grainColorThree: number;
  grainColor2D: string;
  flameColorThree: number;
  description: string;
}

export function getPropellantVisualProfile(type: number, lang: string = 'es'): PropellantVisualProfile {
  switch (type) {
    case 1:
      return {
        id: 1,
        name: "KNDX-65/35",
        category: 'candy',
        displayName: lang === 'es' ? "Candy Dextrosa (KNDX)" : "Candy Dextrose (KNDX)",
        hasFlame: false,
        hasDiamonds: false,
        isSmoky: true,
        smokeColorHex: "#e2e8f0",
        smokeColorThree: 0xf1f5f9,
        grainColorThree: 0xd97706,
        grainColor2D: "#d97706",
        flameColorThree: 0xf59e0b,
        description: lang === 'es' ? "Candy Dextrosa: Emisión de humo blanco denso sin llama visible" : "Candy Dextrose: Dense white smoke emission without visible flame"
      };
    case 2:
      return {
        id: 2,
        name: "KNSO-65/35",
        category: 'candy',
        displayName: lang === 'es' ? "Candy Sorbitol (KNSO)" : "Candy Sorbitol (KNSO)",
        hasFlame: false,
        hasDiamonds: false,
        isSmoky: true,
        smokeColorHex: "#e2e8f0",
        smokeColorThree: 0xf1f5f9,
        grainColorThree: 0xd97706,
        grainColor2D: "#d97706",
        flameColorThree: 0xf59e0b,
        description: lang === 'es' ? "Candy Sorbitol: Emisión de humo blanco denso sin llama visible" : "Candy Sorbitol: Dense white smoke emission without visible flame"
      };
    case 3:
      return {
        id: 3,
        name: "KNSU-65/35",
        category: 'candy',
        displayName: lang === 'es' ? "Candy Sacarosa (KNSU)" : "Candy Sucrose (KNSU)",
        hasFlame: false,
        hasDiamonds: false,
        isSmoky: true,
        smokeColorHex: "#e2e8f0",
        smokeColorThree: 0xf1f5f9,
        grainColorThree: 0xd97706,
        grainColor2D: "#d97706",
        flameColorThree: 0xf59e0b,
        description: lang === 'es' ? "Candy Sacarosa: Emisión de humo blanco denso sin llama visible" : "Candy Sucrose: Dense white smoke emission without visible flame"
      };
    case 4:
      return {
        id: 4,
        name: "RNX-71V",
        category: 'rnx',
        displayName: lang === 'es' ? "Resina Epoxi (RNX-71V)" : "Epoxy Resin (RNX-71V)",
        hasFlame: false,
        hasDiamonds: false,
        isSmoky: true,
        smokeColorHex: "#111827",
        smokeColorThree: 0x111827,
        grainColorThree: 0x1e293b,
        grainColor2D: "#1e293b",
        flameColorThree: 0xea580c,
        description: lang === 'es' ? "Resina Epoxi RNX-71V: Emisión de humo negro denso por combustión de resina" : "Epoxy Resin RNX-71V: Dense black smoke emission from resin combustion"
      };
    case 5:
      return {
        id: 5,
        name: "RNX-57",
        category: 'rnx',
        displayName: lang === 'es' ? "Resina Epoxi (RNX-57)" : "Epoxy Resin (RNX-57)",
        hasFlame: false,
        hasDiamonds: false,
        isSmoky: true,
        smokeColorHex: "#111827",
        smokeColorThree: 0x111827,
        grainColorThree: 0x1e293b,
        grainColor2D: "#1e293b",
        flameColorThree: 0xea580c,
        description: lang === 'es' ? "Resina Epoxi RNX-57: Emisión de humo negro denso por combustión de resina" : "Epoxy Resin RNX-57: Dense black smoke emission from resin combustion"
      };
    case 6:
      return {
        id: 6,
        name: "AP+HTPB (Reliant Robin)",
        category: 'apcp',
        displayName: lang === 'es' ? "Perclorato Amónico (APCP Robin)" : "Ammonium Perchlorate (APCP Robin)",
        hasFlame: true,
        hasDiamonds: true,
        isSmoky: false,
        smokeColorHex: "#94a3b8",
        smokeColorThree: 0x64748b,
        grainColorThree: 0x94a3b8,
        grainColor2D: "#94a3b8",
        flameColorThree: 0x38bdf8,
        description: lang === 'es' ? "Perclorato Amónico: Llama supersónica de alta energía con diamantes de choque" : "Ammonium Perchlorate: High-energy supersonic flame with shock diamonds"
      };
    case 7:
    default:
      return {
        id: 7,
        name: "AP+HTPB (Risky Batman)",
        category: 'apcp',
        displayName: lang === 'es' ? "Perclorato Amónico (APCP Batman)" : "Ammonium Perchlorate (APCP Batman)",
        hasFlame: true,
        hasDiamonds: true,
        isSmoky: false,
        smokeColorHex: "#94a3b8",
        smokeColorThree: 0x94a3b8,
        grainColorThree: 0x94a3b8,
        grainColor2D: "#94a3b8",
        flameColorThree: 0x38bdf8,
        description: lang === 'es' ? "Perclorato Amónico: Llama supersónica de alta energía con diamantes de choque" : "Ammonium Perchlorate: High-energy supersonic flame with shock diamonds"
      };
  }
}

export function getBurnRate(P: number, type: number): { a: number; n: number } {
  let a = 0, n = 0;
  if (type === 1) { // KNDX
    if (P < 0.779) { a = 8.875; n = 0.619; }
    else if (P >= 0.779 && P < 2.572) { a = 7.553; n = -0.009; }
    else if (P >= 2.572 && P < 5.930) { a = 3.841; n = 0.688; }
    else if (P >= 5.930 && P < 8.502) { a = 17.20; n = -0.148; }
    else if (P >= 8.502 && P < 11.20) { a = 4.775; n = 0.442; }
    else { a = 4.775; n = 0.442; }
  } else if (type === 2) { // KNSO
    if (P < 0.807) { a = 10.708; n = 0.625; }
    else if (P >= 0.807 && P < 1.503) { a = 8.763; n = -0.314; }
    else if (P >= 1.503 && P < 3.792) { a = 7.852; n = -0.013; }
    else if (P >= 3.792 && P < 7.033) { a = 3.907; n = 0.535; }
    else if (P >= 7.033 && P < 10.67) { a = 9.653; n = 0.064; }
    else { a = 9.653; n = 0.064; }
  } else if (type === 3) { // KNSU
    a = 8.3; n = 0.320;
  } else if (type === 4 || type === 5) { // RNX
    a = 2.570; n = 0.371;
  } else if (type === 6) { // AP+HTPB (Reliant Robin)
    a = 2.6650; n = 0.412;
  } else if (type === 7) { // AP+HTPB (Risky Batman)
    a = 2.7522; n = 0.456;
  } else {
    a = 1; n = 0.5; // fallback
  }
  return { a, n };
}

export function classifyMotor(It: number): string {
  if (It < 1.26) return '0';
  if (It < 2.5) return 'A';
  if (It < 5) return 'B';
  if (It < 10) return 'C';
  if (It < 20) return 'D';
  if (It < 40) return 'E';
  if (It < 80) return 'F';
  if (It < 160) return 'G';
  if (It < 320) return 'H';
  if (It < 640) return 'I';
  if (It < 1280) return 'J';
  if (It < 2560) return 'K';
  if (It < 5120) return 'L';
  if (It < 10240) return 'M';
  if (It < 20480) return 'N';
  if (It < 40960) return 'O';
  if (It < 81920) return 'P';
  return 'Q';
}
