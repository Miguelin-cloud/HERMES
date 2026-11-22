import { RecoveryMode } from './apogee';

export const MC_STORAGE_KEY = 'hermes_mc_params';
export const MC_DRAFT_STORAGE_KEY = 'hermes_mc_draft_params';
export const MC_AERO_STORAGE_KEY = 'hermes_mc_aero_data';
export const MC_EXP_STORAGE_KEY = 'hermes_mc_exp_data';
export const HERMES_MC_IMPORTED_EVENT = 'hermes-mc-imported';

export type ExpDataType = 'time_thrust' | 'time_pressure' | 'time_both' | 'time_p_time_f';

export interface MissionControlFlightParams {
  emptyRocketMass: number;
  rocketDiameter: number;
  launchAltitude: number;
  launchTemp: number;
  flightPathAngle: number;
  railLengthM: number;
  windSpeedMs: number;
  recoveryMode: RecoveryMode;
  chuteDiameterM: number;
  chuteCd: number;
  drogueDiameterM: number;
  drogueCd: number;
  mainDeployAltM: number;
}

export interface MissionControlAeroData {
  useAeroData: boolean;
  aeroFileName: string;
  aeroDataRaw: string;
}

export interface ExperimentalDataPoint {
  t: number;
  p: number;
  f: number;
}

export interface MissionControlExpData {
  expDataRaw: ExperimentalDataPoint[];
  presUnit: string;
  forceUnit: string;
  expDataType: ExpDataType;
}

export interface MissionControlSnapshot {
  params: MissionControlFlightParams;
  aerodynamics: MissionControlAeroData;
  experimental?: MissionControlExpData;
}

export const DEFAULT_MC_FLIGHT_PARAMS: MissionControlFlightParams = {
  emptyRocketMass: 6.5,
  rocketDiameter: 80,
  launchAltitude: 169,
  launchTemp: 28,
  flightPathAngle: 90,
  railLengthM: 2.0,
  windSpeedMs: 0,
  recoveryMode: 'single',
  chuteDiameterM: 1.5,
  chuteCd: 1.5,
  drogueDiameterM: 0.45,
  drogueCd: 1.5,
  mainDeployAltM: 300,
};

export const DEFAULT_MC_AERO_DATA: MissionControlAeroData = {
  useAeroData: false,
  aeroFileName: '',
  aeroDataRaw: '',
};

export const DEFAULT_MC_EXP_DATA: MissionControlExpData = {
  expDataRaw: [],
  presUnit: 'MPa',
  forceUnit: 'N',
  expDataType: 'time_thrust',
};

export function parseRecoveryMode(raw: unknown): RecoveryMode {
  if (raw === 'none' || raw === 'single' || raw === 'dual') return raw;
  return 'single';
}

export function normalizeMcFlightParams(raw: any): MissionControlFlightParams {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    emptyRocketMass:
      typeof p.emptyRocketMass === 'number' && Number.isFinite(p.emptyRocketMass)
        ? Math.max(0, p.emptyRocketMass)
        : DEFAULT_MC_FLIGHT_PARAMS.emptyRocketMass,
    rocketDiameter:
      typeof p.rocketDiameter === 'number' && Number.isFinite(p.rocketDiameter)
        ? Math.max(1, p.rocketDiameter)
        : DEFAULT_MC_FLIGHT_PARAMS.rocketDiameter,
    launchAltitude:
      typeof p.launchAltitude === 'number' && Number.isFinite(p.launchAltitude)
        ? p.launchAltitude
        : DEFAULT_MC_FLIGHT_PARAMS.launchAltitude,
    launchTemp:
      typeof p.launchTemp === 'number' && Number.isFinite(p.launchTemp)
        ? p.launchTemp
        : DEFAULT_MC_FLIGHT_PARAMS.launchTemp,
    flightPathAngle:
      typeof p.flightPathAngle === 'number' && Number.isFinite(p.flightPathAngle)
        ? Math.max(0, Math.min(90, p.flightPathAngle))
        : DEFAULT_MC_FLIGHT_PARAMS.flightPathAngle,
    railLengthM:
      typeof p.railLengthM === 'number' && Number.isFinite(p.railLengthM)
        ? Math.max(0.2, p.railLengthM)
        : DEFAULT_MC_FLIGHT_PARAMS.railLengthM,
    windSpeedMs:
      typeof p.windSpeedMs === 'number' && Number.isFinite(p.windSpeedMs)
        ? p.windSpeedMs
        : DEFAULT_MC_FLIGHT_PARAMS.windSpeedMs,
    recoveryMode: parseRecoveryMode(p.recoveryMode),
    chuteDiameterM:
      typeof p.chuteDiameterM === 'number' && Number.isFinite(p.chuteDiameterM)
        ? Math.max(0.1, p.chuteDiameterM)
        : DEFAULT_MC_FLIGHT_PARAMS.chuteDiameterM,
    chuteCd:
      typeof p.chuteCd === 'number' && Number.isFinite(p.chuteCd)
        ? Math.max(0.1, p.chuteCd)
        : DEFAULT_MC_FLIGHT_PARAMS.chuteCd,
    drogueDiameterM:
      typeof p.drogueDiameterM === 'number' && Number.isFinite(p.drogueDiameterM)
        ? Math.max(0.1, p.drogueDiameterM)
        : DEFAULT_MC_FLIGHT_PARAMS.drogueDiameterM,
    drogueCd:
      typeof p.drogueCd === 'number' && Number.isFinite(p.drogueCd)
        ? Math.max(0.1, p.drogueCd)
        : DEFAULT_MC_FLIGHT_PARAMS.drogueCd,
    mainDeployAltM:
      typeof p.mainDeployAltM === 'number' && Number.isFinite(p.mainDeployAltM)
        ? Math.max(10, p.mainDeployAltM)
        : DEFAULT_MC_FLIGHT_PARAMS.mainDeployAltM,
  };
}

export function parseAeroDataRaw(
  useAeroData: boolean,
  aeroDataRaw: string
): { mach: number[]; cd: number[] } | null {
  if (!useAeroData || !aeroDataRaw || aeroDataRaw.trim() === '') {
    return null;
  }
  const lines = aeroDataRaw.split(/\r?\n/);
  const mach: number[] = [];
  const cd: number[] = [];
  for (const line of lines) {
    const parts = line.split(/[\t,;]+/);
    if (parts.length >= 2) {
      const valM = parseFloat(parts[0].replace(',', '.'));
      const valC = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(valM) && !isNaN(valC)) {
        mach.push(valM);
        cd.push(valC);
      }
    }
  }
  return mach.length > 0 ? { mach, cd } : null;
}

function parseStoredMcParams(storageKey: string): MissionControlFlightParams | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') {
      return normalizeMcFlightParams(p);
    }
  } catch {
    // ignore storage parse errors
  }
  return null;
}

export function loadSavedMissionControlParams(): MissionControlFlightParams {
  return parseStoredMcParams(MC_STORAGE_KEY) ?? { ...DEFAULT_MC_FLIGHT_PARAMS };
}

export function loadDraftMissionControlParams(): MissionControlFlightParams {
  return parseStoredMcParams(MC_DRAFT_STORAGE_KEY) ?? loadSavedMissionControlParams();
}

export function saveMissionControlParams(
  params: MissionControlFlightParams,
  alsoDraft: boolean = true
): void {
  const normalized = normalizeMcFlightParams(params);
  try {
    localStorage.setItem(MC_STORAGE_KEY, JSON.stringify(normalized));
    if (alsoDraft) {
      localStorage.setItem(MC_DRAFT_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function saveMissionControlDraft(params: MissionControlFlightParams): void {
  const normalized = normalizeMcFlightParams(params);
  try {
    localStorage.setItem(MC_DRAFT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage quota errors
  }
}

export function normalizeMcAeroData(raw: any): MissionControlAeroData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MC_AERO_DATA };
  return {
    useAeroData: Boolean(raw.useAeroData),
    aeroFileName: typeof raw.aeroFileName === 'string' ? raw.aeroFileName : '',
    aeroDataRaw: typeof raw.aeroDataRaw === 'string' ? raw.aeroDataRaw : '',
  };
}

export function loadMissionControlAero(): MissionControlAeroData {
  try {
    const raw = localStorage.getItem(MC_AERO_STORAGE_KEY);
    if (raw) {
      return normalizeMcAeroData(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_MC_AERO_DATA };
}

export function saveMissionControlAero(aero: MissionControlAeroData): void {
  const normalized = normalizeMcAeroData(aero);
  try {
    localStorage.setItem(MC_AERO_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function normalizeMcExpData(raw: any): MissionControlExpData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MC_EXP_DATA };
  const validTypes: ExpDataType[] = ['time_thrust', 'time_pressure', 'time_both', 'time_p_time_f'];
  const expDataType: ExpDataType = validTypes.includes(raw.expDataType)
    ? raw.expDataType
    : 'time_thrust';
  const expDataRaw: ExperimentalDataPoint[] = Array.isArray(raw.expDataRaw)
    ? raw.expDataRaw
        .filter((d: any) => d && typeof d === 'object' && Number.isFinite(Number(d.t)))
        .map((d: any) => ({
          t: Number(d.t),
          p: Number.isFinite(Number(d.p)) ? Number(d.p) : 0,
          f: Number.isFinite(Number(d.f)) ? Number(d.f) : 0,
        }))
    : [];
  return {
    expDataRaw,
    presUnit: typeof raw.presUnit === 'string' && raw.presUnit ? raw.presUnit : 'MPa',
    forceUnit: typeof raw.forceUnit === 'string' && raw.forceUnit ? raw.forceUnit : 'N',
    expDataType,
  };
}

export function loadMissionControlExp(): MissionControlExpData {
  try {
    const raw = localStorage.getItem(MC_EXP_STORAGE_KEY);
    if (raw) {
      return normalizeMcExpData(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_MC_EXP_DATA };
}

export function saveMissionControlExp(exp: MissionControlExpData): void {
  const normalized = normalizeMcExpData(exp);
  try {
    localStorage.setItem(MC_EXP_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function getCompleteMissionControlSnapshot(
  includeExperimental: boolean = true
): MissionControlSnapshot {
  const params = loadDraftMissionControlParams();
  const aerodynamics = loadMissionControlAero();
  const experimental = loadMissionControlExp();
  const snapshot: MissionControlSnapshot = {
    params,
    aerodynamics,
  };
  if (includeExperimental && experimental.expDataRaw.length > 0) {
    snapshot.experimental = experimental;
  }
  return snapshot;
}

export function applyImportedMissionControlSnapshot(
  snapshot: MissionControlSnapshot
): MissionControlSnapshot {
  const normalizedParams = normalizeMcFlightParams(snapshot.params);
  const normalizedAero = normalizeMcAeroData(snapshot.aerodynamics);
  saveMissionControlParams(normalizedParams, true);
  saveMissionControlAero(normalizedAero);

  const hasIncomingExp =
    snapshot.experimental &&
    Array.isArray(snapshot.experimental.expDataRaw) &&
    snapshot.experimental.expDataRaw.length > 0;

  const normalizedExp = hasIncomingExp
    ? normalizeMcExpData(snapshot.experimental)
    : { ...DEFAULT_MC_EXP_DATA };
  saveMissionControlExp(normalizedExp);

  const out: MissionControlSnapshot = {
    params: normalizedParams,
    aerodynamics: normalizedAero,
    ...(hasIncomingExp ? { experimental: normalizedExp } : {}),
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HERMES_MC_IMPORTED_EVENT, { detail: out }));
  }
  return out;
}
