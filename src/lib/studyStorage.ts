export type StudySeriesSource = 'active' | 'library' | 'hermes' | 'experimental';
export type StudyPressureUnit = 'bar' | 'MPa';
export type StudyThrustModel = 'tti' | 'rn';

export interface StudySeries {
  id: string;
  name: string;
  source: StudySeriesSource;
  sourceDetail?: string;
  color: string;
  visible: boolean;
  /** Time shift applied when plotting and aligning curves [s] */
  timeOffsetSec: number;
  /** Pressure time array [s] (falls back to `t` if omitted) */
  tPressure?: number[];
  /** Thrust time array [s] (falls back to `t` if omitted) */
  tThrust?: number[];
  /** Primary unified time array [s] */
  t: number[];
  /** Chamber gauge pressure [MPa] — undefined if not present */
  pGageMPa?: number[];
  /** Simulated TTI thrust [N] */
  fTtiN?: number[];
  /** Simulated Richard Nakka thrust [N] */
  fRnN?: number[];
  /** Experimental load-cell thrust [N] — strictly imported, never synthesized from pressure */
  fExpN?: number[];
  /** Preserved raw imported pressure [MPa] prior to manual tare */
  rawPGageMPa?: number[];
  /** Preserved raw imported thrust [N] prior to manual tare */
  rawFExpN?: number[];
  /** Whether a manual reversible baseline tare is currently applied */
  isTared?: boolean;
  /** Applied pressure tare baseline [MPa] */
  pTareOffsetMPa?: number;
  /** Applied thrust tare baseline [N] */
  fTareOffsetN?: number;
  /** Propellant mass [kg] for Isp calculation when available */
  propellantMassKg?: number;
  /** Reference burn time [s] for simulation series */
  burnTimeS?: number;
  /** Exact metrics computed prior to any display decimation (if any) */
  motorClass?: string;
  propellantSummary?: string;
  nozzleSummary?: string;
  chamberSummary?: string;
  addedAt: number;
}

export interface StudyState {
  studyTitle: string;
  pressureUnit: StudyPressureUnit;
  thrustModel: StudyThrustModel;
  referenceId: string | null;
  series: StudySeries[];
}

export interface SavedStudyEntry {
  id: string;
  name: string;
  savedAt: number;
  state: StudyState;
}

export const STUDY_SERIES_COLORS = [
  '#2563EB', // Aerospace Blue
  '#DC2626', // Crimson
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Indigo Violet
  '#0891B2', // Teal
  '#BE185D', // Magenta Slate
  '#475569', // Steel Slate
];

const ACTIVE_STUDY_KEY = 'hermes_active_study_v1';
const SAVED_STUDIES_KEY = 'hermes_saved_studies_v1';

export function createDefaultStudyState(): StudyState {
  return {
    studyTitle: '',
    pressureUnit: 'bar',
    thrustModel: 'tti',
    referenceId: null,
    series: [],
  };
}

export function pickNextStudyColor(existing: StudySeries[]): string {
  const used = new Set(existing.map((s) => s.color.toUpperCase()));
  for (const c of STUDY_SERIES_COLORS) {
    if (!used.has(c.toUpperCase())) return c;
  }
  return STUDY_SERIES_COLORS[existing.length % STUDY_SERIES_COLORS.length];
}

export function loadActiveStudyState(): StudyState {
  const fallback = createDefaultStudyState();
  try {
    const raw = localStorage.getItem(ACTIVE_STUDY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      studyTitle: typeof parsed.studyTitle === 'string' ? parsed.studyTitle : '',
      pressureUnit: parsed.pressureUnit === 'MPa' ? 'MPa' : 'bar',
      thrustModel: parsed.thrustModel === 'rn' ? 'rn' : 'tti',
      referenceId: typeof parsed.referenceId === 'string' ? parsed.referenceId : null,
      series: Array.isArray(parsed.series) ? parsed.series : [],
    };
  } catch {
    return fallback;
  }
}

export function saveActiveStudyState(state: StudyState): void {
  try {
    localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not persist active study to localStorage:', err);
  }
}

export function loadSavedStudies(): SavedStudyEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_STUDIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedStudies(entries: SavedStudyEntry[]): void {
  try {
    localStorage.setItem(SAVED_STUDIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Could not persist saved studies to localStorage:', err);
  }
}
