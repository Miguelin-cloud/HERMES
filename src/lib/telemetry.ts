import {
  CustomPropellant,
  DEFAULT_PROPELLANTS,
  GrainInput,
  GrainShapeId,
  SimulationResults,
} from './types';
import { getInstalledModules } from './modules';

export type TelemetryTabId =
  | 'inputs'
  | 'results'
  | 'analysis'
  | 'mission_control'
  | 'smart_search'
  | 'cfd'
  | 'study'
  | 'propellant_char'
  | 'agente_jesus';

export type ExportFormatType = 'pdf' | 'study_pdf' | 'xlsx' | 'csv' | 'hrms';

export interface MonthlyTelemetryEntry {
  launches: number;
  simulations: number;
  smartSearches: number;
  flights: number;
  exports: number;
  activeSeconds: number;
}

export interface EngineeringRecords {
  maxImpulseNs: { value: number; motorClass: string; date: string } | null;
  maxThrustN: { value: number; date: string } | null;
  maxPressureMPa: { value: number; safe: boolean; date: string } | null;
  maxIspS: { value: number; date: string } | null;
  maxBurnTimeS: { value: number; date: string } | null;
  maxApogeeM: { value: number; maxMach: number; date: string } | null;
  maxMach: { value: number; apogeeM: number; date: string } | null;
}

export interface TelemetryMetrics {
  schemaVersion: number;
  firstLaunchDate: string;
  lastLaunchDate: string;
  totalLaunches: number;
  totalActiveSeconds: number;
  activeDays: string[];
  isElectron: boolean;
  osPlatform: string;
  activeLanguage: string;
  tabVisits: Record<TelemetryTabId, number>;
  totalSimulationsRun: number;
  totalSafeSimulations: number;
  totalOverpressureSimulations: number;
  totalSmartSearchesRun: number;
  totalSmartSearchFeasible: number;
  totalSmartSearchApplied: number;
  totalFlightSimsRun: number;
  totalCustomPropellantsCreated: number;
  totalCustomGrainsCreated: number;
  totalExportsCount: number;
  exportBreakdown: Record<ExportFormatType, number>;
  totalGuidesCompleted: number;
  motorClassCounts: Record<string, number>;
  grainShapeCounts: Record<string, number>;
  propellantUsageCounts: Record<string, number>;
  records: EngineeringRecords;
  monthlyLog: Record<string, MonthlyTelemetryEntry>;
}

const TELEMETRY_STORAGE_KEY = 'hermes_analytics_telemetry_v1';
const CURRENT_SCHEMA_VERSION = 2;

const GRAIN_SHAPE_KEYS: Record<GrainShapeId, string> = {
  1: 'BATES',
  2: 'Star',
  3: 'Solid Cylinder',
  4: 'Finocyl',
  5: 'Moonburner',
  6: 'C-Slot',
  7: 'D-Grain',
  8: 'Rod & Tube',
  9: 'Wagon Wheel',
  10: 'Custom CSG',
};

let sessionLaunchRecorded = false;

function getMonthlyKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function detectIsElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.hermesDesktop?.isDesktop ||
      (window as any).process?.versions?.electron ||
      (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron'))
  );
}

export function detectOsPlatform(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const uaDataPlatform = (navigator as any).userAgentData?.platform as string | undefined;
  const ua = navigator.userAgent || '';
  const raw = uaDataPlatform || navigator.platform || '';
  const combined = `${raw} ${ua}`.toLowerCase();

  if (combined.includes('win')) return 'Windows';
  if (combined.includes('mac') || combined.includes('darwin')) return 'macOS';
  if (combined.includes('linux') || combined.includes('x11')) return 'Linux';
  if (combined.includes('android')) return 'Android';
  if (combined.includes('iphone') || combined.includes('ipad')) return 'iOS';
  return raw || 'Desktop';
}

function createEmptyMonthlyEntry(): MonthlyTelemetryEntry {
  return {
    launches: 0,
    simulations: 0,
    smartSearches: 0,
    flights: 0,
    exports: 0,
    activeSeconds: 0,
  };
}

function createDefaultTelemetryData(lang = 'en'): TelemetryMetrics {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    firstLaunchDate: nowIso,
    lastLaunchDate: nowIso,
    totalLaunches: 0,
    totalActiveSeconds: 0,
    activeDays: [],
    isElectron: detectIsElectron(),
    osPlatform: detectOsPlatform(),
    activeLanguage: lang,
    tabVisits: {
      inputs: 0,
      results: 0,
      analysis: 0,
      mission_control: 0,
      smart_search: 0,
      cfd: 0,
      study: 0,
      propellant_char: 0,
      agente_jesus: 0,
    },
    totalSimulationsRun: 0,
    totalSafeSimulations: 0,
    totalOverpressureSimulations: 0,
    totalSmartSearchesRun: 0,
    totalSmartSearchFeasible: 0,
    totalSmartSearchApplied: 0,
    totalFlightSimsRun: 0,
    totalCustomPropellantsCreated: 0,
    totalCustomGrainsCreated: 0,
    totalExportsCount: 0,
    exportBreakdown: {
      pdf: 0,
      study_pdf: 0,
      xlsx: 0,
      csv: 0,
      hrms: 0,
    },
    totalGuidesCompleted: 0,
    motorClassCounts: {},
    grainShapeCounts: {},
    propellantUsageCounts: {},
    records: {
      maxImpulseNs: null,
      maxThrustN: null,
      maxPressureMPa: null,
      maxIspS: null,
      maxBurnTimeS: null,
      maxApogeeM: null,
      maxMach: null,
    },
    monthlyLog: {
      [getMonthlyKey()]: createEmptyMonthlyEntry(),
    },
  };
}

function normalizeLoadedTelemetry(parsed: any): TelemetryMetrics {
  const base = createDefaultTelemetryData(parsed?.activeLanguage || 'en');
  const mergedMonthly: Record<string, MonthlyTelemetryEntry> = {};

  if (parsed?.monthlyLog && typeof parsed.monthlyLog === 'object') {
    for (const [mKey, val] of Object.entries<any>(parsed.monthlyLog)) {
      if (!val || typeof val !== 'object') continue;
      mergedMonthly[mKey] = {
        launches: Number(val.launches) || 0,
        simulations: Number(val.simulations) || 0,
        smartSearches: Number(val.smartSearches) || 0,
        flights: Number(val.flights) || 0,
        exports: Number(val.exports) || 0,
        activeSeconds: Number(val.activeSeconds) || 0,
      };
    }
  }
  const currentMKey = getMonthlyKey();
  if (!mergedMonthly[currentMKey]) {
    mergedMonthly[currentMKey] = createEmptyMonthlyEntry();
  }

  return {
    ...base,
    ...parsed,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    isElectron: detectIsElectron(),
    osPlatform: detectOsPlatform(),
    totalLaunches: Number(parsed?.totalLaunches) || 0,
    totalActiveSeconds: Number(parsed?.totalActiveSeconds) || 0,
    activeDays: Array.isArray(parsed?.activeDays)
      ? Array.from(new Set(parsed.activeDays.filter((d: unknown) => typeof d === 'string')))
      : [],
    tabVisits: {
      ...base.tabVisits,
      ...(parsed?.tabVisits || {}),
    },
    totalSimulationsRun: Number(parsed?.totalSimulationsRun) || 0,
    totalSafeSimulations: Number(parsed?.totalSafeSimulations) || 0,
    totalOverpressureSimulations: Number(parsed?.totalOverpressureSimulations) || 0,
    totalSmartSearchesRun: Number(parsed?.totalSmartSearchesRun) || 0,
    totalSmartSearchFeasible: Number(parsed?.totalSmartSearchFeasible) || 0,
    totalSmartSearchApplied: Number(parsed?.totalSmartSearchApplied) || 0,
    totalFlightSimsRun: Number(parsed?.totalFlightSimsRun) || 0,
    totalCustomPropellantsCreated: Number(parsed?.totalCustomPropellantsCreated) || 0,
    totalCustomGrainsCreated: Number(parsed?.totalCustomGrainsCreated) || 0,
    totalExportsCount: Number(parsed?.totalExportsCount) || 0,
    exportBreakdown: {
      ...base.exportBreakdown,
      ...(parsed?.exportBreakdown || {}),
    },
    totalGuidesCompleted: Number(parsed?.totalGuidesCompleted) || 0,
    motorClassCounts:
      parsed?.motorClassCounts && typeof parsed.motorClassCounts === 'object'
        ? parsed.motorClassCounts
        : {},
    grainShapeCounts:
      parsed?.grainShapeCounts && typeof parsed.grainShapeCounts === 'object'
        ? parsed.grainShapeCounts
        : {},
    propellantUsageCounts:
      parsed?.propellantUsageCounts && typeof parsed.propellantUsageCounts === 'object'
        ? parsed.propellantUsageCounts
        : {},
    records: {
      ...base.records,
      ...(parsed?.records || {}),
    },
    monthlyLog: mergedMonthly,
  };
}

export function loadTelemetryData(): TelemetryMetrics {
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultTelemetryData();
      saveTelemetryData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return normalizeLoadedTelemetry(parsed);
  } catch {
    return createDefaultTelemetryData();
  }
}

export function saveTelemetryData(data: TelemetryMetrics): void {
  try {
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving telemetry data:', err);
  }
}

function ensureCurrentMonthAndDay(data: TelemetryMetrics): string {
  const mKey = getMonthlyKey();
  if (!data.monthlyLog[mKey]) {
    data.monthlyLog[mKey] = createEmptyMonthlyEntry();
  }
  const dayKey = getDayKey();
  if (!data.activeDays.includes(dayKey)) {
    data.activeDays.push(dayKey);
  }
  return mKey;
}

export function recordAppLaunch(lang: string): void {
  const data = loadTelemetryData();
  data.activeLanguage = lang;
  data.isElectron = detectIsElectron();
  data.osPlatform = detectOsPlatform();

  if (sessionLaunchRecorded) {
    saveTelemetryData(data);
    return;
  }
  sessionLaunchRecorded = true;

  const mKey = ensureCurrentMonthAndDay(data);
  data.totalLaunches += 1;
  data.lastLaunchDate = new Date().toISOString();
  data.monthlyLog[mKey].launches += 1;
  saveTelemetryData(data);
}

export function syncTelemetryLanguage(lang: string): void {
  const data = loadTelemetryData();
  if (data.activeLanguage !== lang) {
    data.activeLanguage = lang;
    saveTelemetryData(data);
  }
}

export function recordActiveTimeDelta(deltaSeconds: number): void {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);
  const rounded = Math.round(deltaSeconds);
  data.totalActiveSeconds += rounded;
  data.monthlyLog[mKey].activeSeconds += rounded;
  saveTelemetryData(data);
}

export function trackTabVisit(tabId: string): void {
  const data = loadTelemetryData();
  ensureCurrentMonthAndDay(data);
  if (Object.prototype.hasOwnProperty.call(data.tabVisits, tabId)) {
    const key = tabId as TelemetryTabId;
    data.tabVisits[key] += 1;
    saveTelemetryData(data);
  }
}

export function recordSimulationTelemetry(opts: {
  results: SimulationResults;
  grains: GrainInput[];
  customPropellants?: CustomPropellant[];
  isSafe: boolean;
}): void {
  const { results, grains, customPropellants = [], isSafe } = opts;
  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);
  const nowIso = new Date().toISOString();

  data.totalSimulationsRun += 1;
  data.monthlyLog[mKey].simulations += 1;

  if (isSafe) {
    data.totalSafeSimulations += 1;
  } else {
    data.totalOverpressureSimulations += 1;
  }

  // Motor class distribution (extract primary letter e.g. 'J', 'K', 'O', '>O')
  const rawClass = (results.summary.motorClass || '').trim();
  const classKey = rawClass ? rawClass.split(' ')[0] : 'Unknown';
  data.motorClassCounts[classKey] = (data.motorClassCounts[classKey] || 0) + 1;

  // Grain shapes & propellants used (count unique types per motor simulation)
  const seenShapes = new Set<string>();
  const seenPropellants = new Set<string>();
  const allPropellants = [...DEFAULT_PROPELLANTS, ...customPropellants];

  for (const grain of grains) {
    const shapeLabel = GRAIN_SHAPE_KEYS[grain.shape] || `Shape ${grain.shape}`;
    if (!seenShapes.has(shapeLabel)) {
      seenShapes.add(shapeLabel);
      data.grainShapeCounts[shapeLabel] = (data.grainShapeCounts[shapeLabel] || 0) + 1;
    }
    const prop = allPropellants.find((p) => Number(p.id) === Number(grain.propellantType));
    const propName = prop?.name || `Propellant #${grain.propellantType}`;
    if (!seenPropellants.has(propName)) {
      seenPropellants.add(propName);
      data.propellantUsageCounts[propName] = (data.propellantUsageCounts[propName] || 0) + 1;
    }
  }

  // Engineering Hall-of-Fame records
  const { It_total_N_s, Fmax_N, Pmax_MPa, Isp_total_s, t_quemado } = results.summary;
  if (
    Number.isFinite(It_total_N_s) &&
    It_total_N_s > 0 &&
    (!data.records.maxImpulseNs || It_total_N_s > data.records.maxImpulseNs.value)
  ) {
    data.records.maxImpulseNs = { value: It_total_N_s, motorClass: classKey, date: nowIso };
  }
  if (
    Number.isFinite(Fmax_N) &&
    Fmax_N > 0 &&
    (!data.records.maxThrustN || Fmax_N > data.records.maxThrustN.value)
  ) {
    data.records.maxThrustN = { value: Fmax_N, date: nowIso };
  }
  if (
    Number.isFinite(Pmax_MPa) &&
    Pmax_MPa > 0 &&
    (!data.records.maxPressureMPa || Pmax_MPa > data.records.maxPressureMPa.value)
  ) {
    data.records.maxPressureMPa = { value: Pmax_MPa, safe: isSafe, date: nowIso };
  }
  if (
    Number.isFinite(Isp_total_s) &&
    Isp_total_s > 0 &&
    (!data.records.maxIspS || Isp_total_s > data.records.maxIspS.value)
  ) {
    data.records.maxIspS = { value: Isp_total_s, date: nowIso };
  }
  if (
    Number.isFinite(t_quemado) &&
    t_quemado > 0 &&
    (!data.records.maxBurnTimeS || t_quemado > data.records.maxBurnTimeS.value)
  ) {
    data.records.maxBurnTimeS = { value: t_quemado, date: nowIso };
  }

  saveTelemetryData(data);
}

export function recordFlightTelemetry(opts: {
  maxApogeeM: number;
  maxVelocityMs: number;
  maxMach: number;
  countAsFlightRun?: boolean;
}): void {
  const { maxApogeeM, maxMach, countAsFlightRun = true } = opts;
  if (!Number.isFinite(maxApogeeM) || maxApogeeM <= 0) return;

  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);
  const nowIso = new Date().toISOString();

  if (countAsFlightRun) {
    data.totalFlightSimsRun += 1;
    data.monthlyLog[mKey].flights += 1;
  }

  if (!data.records.maxApogeeM || maxApogeeM > data.records.maxApogeeM.value) {
    data.records.maxApogeeM = {
      value: maxApogeeM,
      maxMach: Number.isFinite(maxMach) ? maxMach : 0,
      date: nowIso,
    };
  }
  if (
    Number.isFinite(maxMach) &&
    maxMach > 0 &&
    (!data.records.maxMach || maxMach > data.records.maxMach.value)
  ) {
    data.records.maxMach = {
      value: maxMach,
      apogeeM: maxApogeeM,
      date: nowIso,
    };
  }

  saveTelemetryData(data);
}

export function recordSmartSearchRun(foundFeasible: boolean): void {
  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);
  data.totalSmartSearchesRun += 1;
  if (foundFeasible) {
    data.totalSmartSearchFeasible += 1;
  }
  data.monthlyLog[mKey].smartSearches += 1;
  saveTelemetryData(data);
}

export function recordExportTelemetry(format: ExportFormatType): void {
  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);
  data.totalExportsCount += 1;
  data.exportBreakdown[format] = (data.exportBreakdown[format] || 0) + 1;
  data.monthlyLog[mKey].exports += 1;
  saveTelemetryData(data);
}

export function trackEvent(
  eventType:
    | 'simulation'
    | 'smart_search'
    | 'smart_search_applied'
    | 'propellant_created'
    | 'custom_grain_created'
    | 'export_data'
    | 'guide_completed'
): void {
  const data = loadTelemetryData();
  const mKey = ensureCurrentMonthAndDay(data);

  if (eventType === 'simulation') {
    data.totalSimulationsRun += 1;
    data.monthlyLog[mKey].simulations += 1;
  } else if (eventType === 'smart_search') {
    data.totalSmartSearchesRun += 1;
    data.monthlyLog[mKey].smartSearches += 1;
  } else if (eventType === 'smart_search_applied') {
    data.totalSmartSearchApplied += 1;
  } else if (eventType === 'propellant_created') {
    data.totalCustomPropellantsCreated += 1;
  } else if (eventType === 'custom_grain_created') {
    data.totalCustomGrainsCreated += 1;
  } else if (eventType === 'export_data') {
    data.totalExportsCount += 1;
    data.monthlyLog[mKey].exports += 1;
  } else if (eventType === 'guide_completed') {
    data.totalGuidesCompleted += 1;
  }

  saveTelemetryData(data);
}

export function resetTelemetryMetrics(lang = 'en'): TelemetryMetrics {
  localStorage.removeItem(TELEMETRY_STORAGE_KEY);
  const fresh = createDefaultTelemetryData(lang);
  fresh.totalLaunches = 1;
  fresh.activeDays = [getDayKey()];
  fresh.monthlyLog[getMonthlyKey()].launches = 1;
  saveTelemetryData(fresh);
  return fresh;
}

export function formatDurationCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${s}s`;
}

export function generateMonthlyEmailBody(metrics: TelemetryMetrics, lang = 'es'): string {
  const mKey = getMonthlyKey();
  const currentMonthStats = metrics.monthlyLog[mKey] || createEmptyMonthlyEntry();
  const installed = getInstalledModules();
  const mostVisitedTab =
    Object.entries(metrics.tabVisits).sort((a, b) => b[1] - a[1])[0]?.[0] || 'inputs';
  const topClass =
    Object.entries(metrics.motorClassCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '---';
  const topShape =
    Object.entries(metrics.grainShapeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '---';
  const topProp =
    Object.entries(metrics.propellantUsageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '---';

  const safeTotal = metrics.totalSafeSimulations + metrics.totalOverpressureSimulations;
  const safePct = safeTotal > 0 ? Math.round((metrics.totalSafeSimulations / safeTotal) * 100) : 100;

  const activeTimeTotal = formatDurationCompact(metrics.totalActiveSeconds);
  const activeTimeMonth = formatDurationCompact(currentMonthStats.activeSeconds);

  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const isIt = lang === 'it';

  const locale = isEs ? 'es-ES' : isFr ? 'fr-FR' : isIt ? 'it-IT' : 'en-US';
  const dateStr = new Date().toLocaleDateString(locale);
  const firstStr = new Date(metrics.firstLaunchDate).toLocaleDateString(locale);

  const modulesList = [
    'Simulation Core + 3D/CFD',
    installed.postprocess ? 'Post-Process' : 'Post-Process (Locked)',
    installed.agente_jesus ? 'Agent Jesús AI' : 'Agent Jesús AI (Locked)',
  ].join(' | ');

  if (isEs) {
    return `
==================================================
HERMES — INFORME MENSUAL DE USO E INGENIERÍA
==================================================
Mes Reportado: ${mKey}
Fecha del Informe: ${dateStr}
Entorno: ${metrics.isElectron ? 'Electron Desktop App' : 'Navegador Web'} (${metrics.osPlatform})
Módulos: ${modulesList}

RESUMEN DEL MES ACTUAL (${mKey}):
--------------------------------------------------
• Sesiones iniciadas: ${currentMonthStats.launches}
• Tiempo activo de ingeniería: ${activeTimeMonth}
• Simulaciones de motor: ${currentMonthStats.simulations}
• Optimizaciones Smart Search: ${currentMonthStats.smartSearches}
• Vuelos en Mission Control: ${currentMonthStats.flights}
• Exportaciones totales: ${currentMonthStats.exports}

ESTADÍSTICAS ACUMULADAS Y DISEÑO:
--------------------------------------------------
• Sesiones totales: ${metrics.totalLaunches} (${metrics.activeDays.length} días activos)
• Tiempo total de ingeniería: ${activeTimeTotal}
• Simulaciones totales: ${metrics.totalSimulationsRun} (Integridad estructural: ${safePct}%)
• Smart Search (lanzadas / aplicadas): ${metrics.totalSmartSearchesRun} / ${metrics.totalSmartSearchApplied}
• Vuelos Mission Control: ${metrics.totalFlightSimsRun}
• Propulsantes / Granos CSG creados: ${metrics.totalCustomPropellantsCreated} / ${metrics.totalCustomGrainsCreated}
• Exportaciones (PDF / Estudio PDF / XLSX / CSV / .hrms): ${metrics.exportBreakdown.pdf} / ${metrics.exportBreakdown.study_pdf} / ${metrics.exportBreakdown.xlsx} / ${metrics.exportBreakdown.csv} / ${metrics.exportBreakdown.hrms}
• Guías completadas: ${metrics.totalGuidesCompleted}
• Vista más usada: ${mostVisitedTab.toUpperCase()}
• Clase / Geometría / Propulsante favorito: ${topClass} | ${topShape} | ${topProp}
• Idioma activo: ${metrics.activeLanguage.toUpperCase()} | Instalación: ${firstStr}

RÉCORDS PERSONALES DE DISEÑO:
--------------------------------------------------
• Mayor Impulso Total: ${metrics.records.maxImpulseNs ? `${metrics.records.maxImpulseNs.value.toFixed(1)} N·s (Clase ${metrics.records.maxImpulseNs.motorClass})` : '---'}
• Mayor Empuje Máximo: ${metrics.records.maxThrustN ? `${metrics.records.maxThrustN.value.toFixed(1)} N` : '---'}
• Mayor Presión de Cámara: ${metrics.records.maxPressureMPa ? `${metrics.records.maxPressureMPa.value.toFixed(2)} MPa` : '---'}
• Mayor Isp: ${metrics.records.maxIspS ? `${metrics.records.maxIspS.value.toFixed(1)} s` : '---'}
• Mayor Apogeo Simulado: ${metrics.records.maxApogeeM ? `${metrics.records.maxApogeeM.value.toFixed(0)} m (Mach ${metrics.records.maxApogeeM.maxMach.toFixed(2)})` : '---'}
==================================================
Generado localmente por HERMES Usage & Engineering Analytics v2.1.0.
`.trim();
  }

  return `
==================================================
HERMES — MONTHLY USAGE & ENGINEERING REPORT
==================================================
Reported Month: ${mKey}
Report Date: ${dateStr}
Environment: ${metrics.isElectron ? 'Electron Desktop App' : 'Web Browser'} (${metrics.osPlatform})
Modules: ${modulesList}

CURRENT MONTH SUMMARY (${mKey}):
--------------------------------------------------
• Sessions launched: ${currentMonthStats.launches}
• Active engineering time: ${activeTimeMonth}
• Motor simulations: ${currentMonthStats.simulations}
• Smart Search optimizations: ${currentMonthStats.smartSearches}
• Mission Control flights: ${currentMonthStats.flights}
• Total exports: ${currentMonthStats.exports}

LIFETIME TOTALS & ENGINEERING INSIGHTS:
--------------------------------------------------
• Total sessions: ${metrics.totalLaunches} (${metrics.activeDays.length} active days)
• Total engineering time: ${activeTimeTotal}
• Total simulations: ${metrics.totalSimulationsRun} (Structural integrity rate: ${safePct}%)
• Smart Search (runs / applied): ${metrics.totalSmartSearchesRun} / ${metrics.totalSmartSearchApplied}
• Mission Control flights: ${metrics.totalFlightSimsRun}
• Custom propellants / CSG grains created: ${metrics.totalCustomPropellantsCreated} / ${metrics.totalCustomGrainsCreated}
• Exports (PDF / Study PDF / XLSX / CSV / .hrms): ${metrics.exportBreakdown.pdf} / ${metrics.exportBreakdown.study_pdf} / ${metrics.exportBreakdown.xlsx} / ${metrics.exportBreakdown.csv} / ${metrics.exportBreakdown.hrms}
• Interactive guides completed: ${metrics.totalGuidesCompleted}
• Most visited view: ${mostVisitedTab.toUpperCase()}
• Top Class / Geometry / Propellant: ${topClass} | ${topShape} | ${topProp}
• Active language: ${metrics.activeLanguage.toUpperCase()} | Installed: ${firstStr}

PERSONAL DESIGN RECORDS:
--------------------------------------------------
• Peak Total Impulse: ${metrics.records.maxImpulseNs ? `${metrics.records.maxImpulseNs.value.toFixed(1)} N·s (Class ${metrics.records.maxImpulseNs.motorClass})` : '---'}
• Peak Thrust: ${metrics.records.maxThrustN ? `${metrics.records.maxThrustN.value.toFixed(1)} N` : '---'}
• Peak Chamber Pressure: ${metrics.records.maxPressureMPa ? `${metrics.records.maxPressureMPa.value.toFixed(2)} MPa` : '---'}
• Peak Isp: ${metrics.records.maxIspS ? `${metrics.records.maxIspS.value.toFixed(1)} s` : '---'}
• Peak Simulated Apogee: ${metrics.records.maxApogeeM ? `${metrics.records.maxApogeeM.value.toFixed(0)} m (Mach ${metrics.records.maxApogeeM.maxMach.toFixed(2)})` : '---'}
==================================================
Locally generated by HERMES Usage & Engineering Analytics v2.1.0.
`.trim();
}
