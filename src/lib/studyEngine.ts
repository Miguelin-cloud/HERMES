import * as XLSX from 'xlsx';
import { runSimulation } from './simulator';
import { normalizeMotorWithStructure } from './motorStructure';
import { parseAndValidateHermesFile, resolveImportedCustomGrains, resolveImportedPropellants } from './hermesFile';
import { SavedSimulationEntry } from '../hooks/useSimulationStorage';
import {
  CustomGrainShape,
  CustomPropellant,
  GrainInput,
  MotorInput,
  NozzleInput,
  SimulationResults,
  getPropellantData,
} from './types';
import { loadCustomGrainsFromStorage } from '../lib/grains';
import {
  StudySeries,
  StudySeriesSource,
  StudyThrustModel,
  pickNextStudyColor,
} from './studyStorage';
import { ExpDataType } from './missionControlStorage';

export interface StudySeriesMetrics {
  id: string;
  hasPressure: boolean;
  hasThrust: boolean;
  totalImpulseNs: number | null;
  pMaxMPa: number | null;
  pAvgMPa: number | null;
  fMaxN: number | null;
  fAvgN: number | null;
  burnTimeS: number | null;
  ispS: number | null;
}

export interface StudyComparisonDelta {
  dItNs: number | null;
  dItPct: number | null;
  dPmaxMPa: number | null;
  dPmaxPct: number | null;
  dFmaxN: number | null;
  dFmaxPct: number | null;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function convertPresToMPa(val: number, unit: string): number {
  switch (unit) {
    case 'Pa':
      return val * 1e-6;
    case 'bar':
      return val * 0.1;
    case 'atm':
      return val * 0.101325;
    case 'psi':
      return val * 0.00689476;
    case 'MPa':
    default:
      return val;
  }
}

export function convertForceToN(val: number, unit: string): number {
  switch (unit) {
    case 'kN':
      return val * 1000;
    case 'kgf':
      return val * 9.80665;
    case 'lbf':
      return val * 4.44822;
    case 'N':
    default:
      return val;
  }
}

/**
 * Peak-preserving uniform decimation when experimental test-stand logs exceed maxPoints.
 */
function decimateSeriesXY(
  x: number[],
  y: number[],
  maxPoints = 2500
): { x: number[]; y: number[] } {
  const n = Math.min(x.length, y.length);
  if (n <= maxPoints) {
    return { x: x.slice(0, n), y: y.slice(0, n) };
  }
  const bucketCount = Math.floor((maxPoints - 2) / 2);
  const step = (n - 2) / bucketCount;
  const outX: number[] = [x[0]];
  const outY: number[] = [y[0]];

  for (let b = 0; b < bucketCount; b++) {
    const start = 1 + Math.floor(b * step);
    const end = Math.min(n - 1, 1 + Math.floor((b + 1) * step));
    if (start >= end) continue;
    let minIdx = start;
    let maxIdx = start;
    for (let i = start + 1; i < end; i++) {
      if (y[i] < y[minIdx]) minIdx = i;
      if (y[i] > y[maxIdx]) maxIdx = i;
    }
    if (minIdx === maxIdx) {
      outX.push(x[minIdx]);
      outY.push(y[minIdx]);
    } else if (minIdx < maxIdx) {
      outX.push(x[minIdx], x[maxIdx]);
      outY.push(y[minIdx], y[maxIdx]);
    } else {
      outX.push(x[maxIdx], x[minIdx]);
      outY.push(y[maxIdx], y[minIdx]);
    }
  }
  outX.push(x[n - 1]);
  outY.push(y[n - 1]);
  return { x: outX, y: outY };
}

function summarizeMotorConfig(
  motor: MotorInput,
  nozzle: NozzleInput,
  grains: GrainInput[],
  props: CustomPropellant[]
): { propSummary: string; nozzleSummary: string; chamberSummary: string } {
  const names = Array.from(
    new Set(grains.map((g) => getPropellantData(g.propellantType, props).name))
  );
  return {
    propSummary: names.join(' + ') || '-',
    nozzleSummary: `Dt ${nozzle.Dt0} / Ds ${nozzle.Ds} mm`,
    chamberSummary: `${motor.Dc}x${motor.Lc} mm`,
  };
}

export function createStudySeriesFromSimulation(opts: {
  name: string;
  source: Exclude<StudySeriesSource, 'experimental'>;
  sourceDetail?: string;
  results: SimulationResults;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  existingSeries: StudySeries[];
}): StudySeries {
  const { results, motor, nozzle, grains, customPropellants } = opts;
  const meta = summarizeMotorConfig(motor, nozzle, grains, customPropellants);
  const initMassKg =
    (results.summary.initial_mass_g ?? (results.mgra_total[0] || 0) * 1000) / 1000;

  return {
    id: makeUid('study-sim'),
    name: opts.name,
    source: opts.source,
    sourceDetail: opts.sourceDetail,
    color: pickNextStudyColor(opts.existingSeries),
    visible: true,
    timeOffsetSec: 0,
    t: results.t.slice(),
    pGageMPa: results.P0_gage.map((v) => Math.max(0, v)),
    fTtiN: results.E_N.map((v) => Math.max(0, v)),
    fRnN: results.F_N.map((v) => Math.max(0, v)),
    propellantMassKg: initMassKg > 0 ? initMassKg : undefined,
    burnTimeS: results.summary.t_quemado,
    motorClass: results.summary.motorClass,
    propellantSummary: meta.propSummary,
    nozzleSummary: meta.nozzleSummary,
    chamberSummary: meta.chamberSummary,
    addedAt: Date.now(),
  };
}

export function runBackgroundSimulationForStudy(opts: {
  name: string;
  source: 'library' | 'hermes';
  sourceDetail?: string;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  bundledPropellants?: CustomPropellant[];
  bundledCustomGrains?: CustomGrainShape[];
  localCustomPropellants: CustomPropellant[];
  localCustomGrains?: CustomGrainShape[];
  existingSeries: StudySeries[];
}): StudySeries {
  const resolvedProps = resolveImportedPropellants(
    opts.bundledPropellants || [],
    opts.grains,
    opts.localCustomPropellants
  );
  const resolvedGrains = resolveImportedCustomGrains(
    opts.bundledCustomGrains || [],
    resolvedProps.remappedGrains,
    opts.localCustomGrains || loadCustomGrainsFromStorage()
  );
  const normMotor = normalizeMotorWithStructure(opts.motor);
  const res = runSimulation({
    motor: normMotor,
    nozzle: opts.nozzle,
    grains: resolvedGrains.remappedGrains,
    customPropellants: resolvedProps.nextCustomPropellants,
    customGrainShapes: resolvedGrains.nextCustomGrains,
  });

  return createStudySeriesFromSimulation({
    name: opts.name,
    source: opts.source,
    sourceDetail: opts.sourceDetail,
    results: res,
    motor: normMotor,
    nozzle: opts.nozzle,
    grains: resolvedGrains.remappedGrains,
    customPropellants: resolvedProps.nextCustomPropellants,
    existingSeries: opts.existingSeries,
  });
}

export function createStudySeriesFromLibraryEntry(
  entry: SavedSimulationEntry,
  localCustomPropellants: CustomPropellant[],
  existingSeries: StudySeries[]
): StudySeries {
  return runBackgroundSimulationForStudy({
    name: entry.name,
    source: 'library',
    sourceDetail: entry.folder || 'General',
    motor: entry.motor,
    nozzle: entry.nozzle,
    grains: entry.grains,
    bundledPropellants: entry.bundledPropellants,
    bundledCustomGrains: entry.bundledCustomGrains,
    localCustomPropellants,
    existingSeries,
  });
}

export interface HermesStudyImportResult {
  added: StudySeries[];
  warnings: string[];
}

export async function importHermesFilesIntoStudy(
  files: File[],
  localCustomPropellants: CustomPropellant[],
  existingSeries: StudySeries[]
): Promise<HermesStudyImportResult> {
  const added: StudySeries[] = [];
  const warnings: string[] = [];
  let workingList = existingSeries.slice();

  for (const file of files) {
    try {
      const rawText = await file.text();
      const baseName = file.name.replace(/\.(hrms|hermes|json)$/i, '') || 'HERMES';
      const parsed = parseAndValidateHermesFile(rawText, baseName);
      if (!parsed.ok) {
        warnings.push(`${file.name}: invalid`);
        continue;
      }

      const pkg = parsed.data;
      let producedSomething = false;

      if (pkg.inputs) {
        const simSeries = runBackgroundSimulationForStudy({
          name: pkg.projectName || baseName,
          source: 'hermes',
          sourceDetail: file.name,
          motor: pkg.inputs.motor,
          nozzle: pkg.inputs.nozzle,
          grains: pkg.inputs.grains,
          bundledPropellants: pkg.inputs.bundledPropellants,
          bundledCustomGrains: pkg.inputs.bundledCustomGrains,
          localCustomPropellants,
          existingSeries: workingList,
        });
        added.push(simSeries);
        workingList.push(simSeries);
        producedSomething = true;
      }

      // If the .hermes file also contains test-stand experimental curves, import ONLY recorded channels
      const exp = pkg.missionControl?.experimental;
      if (exp && Array.isArray(exp.expDataRaw) && exp.expDataRaw.length >= 2) {
        const expType = exp.expDataType;
        const hasP = expType === 'time_pressure' || expType === 'time_both' || expType === 'time_p_time_f';
        const hasF = expType === 'time_thrust' || expType === 'time_both' || expType === 'time_p_time_f';
        const t0 = Number(exp.expDataRaw[0]?.t) || 0;
        const tArr = exp.expDataRaw.map((r) => Math.max(0, (Number(r.t) || 0) - t0));
        const pArr = hasP
          ? exp.expDataRaw.map((r) => convertPresToMPa(Number(r.p) || 0, exp.presUnit || 'MPa'))
          : undefined;
        const fArr = hasF
          ? exp.expDataRaw.map((r) => convertForceToN(Number(r.f) || 0, exp.forceUnit || 'N'))
          : undefined;

        const expSeries = buildExperimentalStudySeries({
          name: `${pkg.projectName || baseName} (EXP)`,
          sourceDetail: `${file.name} (${expType})`,
          tPressure: pArr ? tArr : undefined,
          pGageMPa: pArr,
          tThrust: fArr ? tArr : undefined,
          fExpN: fArr,
          existingSeries: workingList,
        });
        added.push(expSeries);
        workingList.push(expSeries);
        producedSomething = true;
      }

      if (!producedSomething) {
        warnings.push(`${file.name}: no_curves`);
      }
    } catch {
      warnings.push(`${file.name}: parse_error`);
    }
  }

  return { added, warnings };
}

function parseNumericCell(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim();
  if (!s) return NaN;
  // Handle European decimal comma if no dot is present
  const normalized = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/\s+/g, '');
  return Number(normalized);
}

function parseDelimitedTextToMatrix(text: string): unknown[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Detect separator on first few lines
  const sample = lines.slice(0, 5).join('\n');
  let sep: string | RegExp = ',';
  if (sample.includes('\t')) sep = '\t';
  else if (sample.includes(';')) sep = ';';
  else if (!sample.includes(',') && /\s+/.test(sample)) sep = /\s+/;

  return lines.map((line) => line.split(sep).map((cell) => cell.trim()));
}

export interface ExperimentalParseOptions {
  dataType: ExpDataType;
  presUnit: string;
  forceUnit: string;
  autoAlignZero?: boolean;
  customName?: string;
}

export function buildExperimentalStudySeries(opts: {
  name: string;
  sourceDetail?: string;
  tPressure?: number[];
  pGageMPa?: number[];
  tThrust?: number[];
  fExpN?: number[];
  autoAlignZero?: boolean;
  existingSeries: StudySeries[];
}): StudySeries {
  let tP = opts.tPressure ? opts.tPressure.slice() : undefined;
  let p = opts.pGageMPa ? opts.pGageMPa.slice() : undefined;
  let tF = opts.tThrust ? opts.tThrust.slice() : undefined;
  let f = opts.fExpN ? opts.fExpN.slice() : undefined;

  if (tP && p) {
    const dec = decimateSeriesXY(tP, p);
    tP = dec.x;
    p = dec.y;
  }
  if (tF && f) {
    const dec = decimateSeriesXY(tF, f);
    tF = dec.x;
    f = dec.y;
  }

  const baseT = (tF && tF.length >= 2 ? tF : tP) || [];

  const series: StudySeries = {
    id: makeUid('study-exp'),
    name: opts.name,
    source: 'experimental',
    sourceDetail: opts.sourceDetail,
    color: pickNextStudyColor(opts.existingSeries),
    visible: true,
    timeOffsetSec: 0,
    t: baseT,
    tPressure: tP,
    tThrust: tF,
    pGageMPa: p,
    fExpN: f,
    addedAt: Date.now(),
  };

  if (opts.autoAlignZero) {
    series.timeOffsetSec = computeIgnitionZeroOffset(series);
  }
  return series;
}

export async function parseExperimentalFileForStudy(
  file: File,
  opts: ExperimentalParseOptions,
  existingSeries: StudySeries[]
): Promise<StudySeries> {
  const lower = file.name.toLowerCase();
  let matrix: unknown[][] = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  } else {
    const text = await file.text();
    matrix = parseDelimitedTextToMatrix(text);
  }

  if (matrix.length === 0) {
    throw new Error('empty_file');
  }

  const cleanBaseName = opts.customName?.trim() || file.name.replace(/\.(csv|xlsx|xls|txt|tsv)$/i, '');

  if (opts.dataType === 'time_p_time_f') {
    let timePIdx = 0;
    let pressIdx = 1;
    let timeFIdx = 2;
    let forceIdx = 3;

    const matchesToken = (text: string, words: string[]) => {
      const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
      return words.some((w) => tokens.includes(w));
    };

    for (let r = 0; r < Math.min(5, matrix.length); r++) {
      const row = matrix[r];
      if (!row) continue;
      let foundTP = -1, foundP = -1, foundTF = -1, foundF = -1;
      for (let c = 0; c < row.length; c++) {
        const s = String(row[c] ?? '').toLowerCase().trim();
        if (!s) continue;
        const isTimeCol = matchesToken(s, ['time', 'tiempo', 'temps', 'tempo', 't']);
        const isPresWord = matchesToken(s, ['p', 'pres', 'press', 'pressure', 'presion', 'pression', 'pressione', 'bar', 'mpa', 'psi']);
        const isForceWord = matchesToken(s, ['f', 'force', 'thrust', 'empuje', 'fuerza', 'poussee', 'spinta', 'load']);
        if (isTimeCol && (s.includes('pres') || matchesToken(s, ['p', 'tp', 't_p']))) {
          foundTP = c;
        } else if (isTimeCol && (s.includes('empuje') || s.includes('thrust') || s.includes('force') || matchesToken(s, ['f', 'tf', 't_f']))) {
          foundTF = c;
        } else if (isPresWord) {
          foundP = c;
        } else if (isForceWord) {
          foundF = c;
        }
      }
      if (foundTP !== -1 || foundP !== -1 || foundTF !== -1 || foundF !== -1) {
        if (foundTP !== -1) timePIdx = foundTP;
        if (foundP !== -1) pressIdx = foundP;
        if (foundTF !== -1) timeFIdx = foundTF;
        if (foundF !== -1) forceIdx = foundF;
        break;
      }
    }

    const pRows: Array<{ t: number; v: number }> = [];
    const fRows: Array<{ t: number; v: number }> = [];
    for (const row of matrix) {
      if (!row) continue;
      const tp = parseNumericCell(row[timePIdx]);
      const pVal = parseNumericCell(row[pressIdx]);
      if (Number.isFinite(tp) && Number.isFinite(pVal)) {
        pRows.push({ t: tp, v: convertPresToMPa(pVal, opts.presUnit) });
      }
      const tf = parseNumericCell(row[timeFIdx]);
      const fVal = parseNumericCell(row[forceIdx]);
      if (Number.isFinite(tf) && Number.isFinite(fVal)) {
        fRows.push({ t: tf, v: convertForceToN(fVal, opts.forceUnit) });
      }
    }

    pRows.sort((a, b) => a.t - b.t);
    fRows.sort((a, b) => a.t - b.t);
    if (pRows.length < 2 && fRows.length < 2) {
      throw new Error('no_numeric_rows');
    }

    const t0P = pRows[0]?.t ?? 0;
    const t0F = fRows[0]?.t ?? 0;
    return buildExperimentalStudySeries({
      name: cleanBaseName,
      sourceDetail: `${file.name} (${opts.presUnit} / ${opts.forceUnit})`,
      tPressure: pRows.length >= 2 ? pRows.map((r) => r.t - t0P) : undefined,
      pGageMPa: pRows.length >= 2 ? pRows.map((r) => r.v) : undefined,
      tThrust: fRows.length >= 2 ? fRows.map((r) => r.t - t0F) : undefined,
      fExpN: fRows.length >= 2 ? fRows.map((r) => r.v) : undefined,
      autoAlignZero: opts.autoAlignZero,
      existingSeries,
    });
  }

  // Standard 2-col or 3-col layout
  let timeIdx = 0;
  let val1Idx = 1;
  let val2Idx = 2;

  const hasTokenWord = (text: string, words: string[]) => {
    const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
    return words.some((w) => tokens.includes(w));
  };

  for (let r = 0; r < Math.min(5, matrix.length); r++) {
    const row = matrix[r];
    if (!row) continue;
    let foundT = -1, foundP = -1, foundF = -1;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? '').toLowerCase().trim();
      if (!s) continue;
      if (hasTokenWord(s, ['time', 'tiempo', 'temps', 'tempo', 'timestamp', 't'])) {
        if (foundT === -1) foundT = c;
      } else if (hasTokenWord(s, ['p', 'pres', 'press', 'pressure', 'presion', 'pression', 'pressione', 'mpa', 'bar', 'psi'])) {
        if (foundP === -1) foundP = c;
      } else if (hasTokenWord(s, ['f', 'force', 'thrust', 'empuje', 'fuerza', 'poussee', 'spinta', 'load'])) {
        if (foundF === -1) foundF = c;
      }
    }
    if (foundT !== -1 || foundP !== -1 || foundF !== -1) {
      if (foundT !== -1) timeIdx = foundT;
      if (opts.dataType === 'time_both') {
        if (foundP !== -1) val1Idx = foundP;
        if (foundF !== -1) val2Idx = foundF;
      } else if (opts.dataType === 'time_pressure' && foundP !== -1) {
        val1Idx = foundP;
      } else if (opts.dataType === 'time_thrust' && foundF !== -1) {
        val1Idx = foundF;
      }
      break;
    }
  }

  const rows: Array<{ t: number; p?: number; f?: number }> = [];
  for (const row of matrix) {
    if (!row) continue;
    const tVal = parseNumericCell(row[timeIdx]);
    if (!Number.isFinite(tVal)) continue;

    if (opts.dataType === 'time_pressure') {
      const pVal = parseNumericCell(row[val1Idx]);
      if (Number.isFinite(pVal)) {
        rows.push({ t: tVal, p: convertPresToMPa(pVal, opts.presUnit) });
      }
    } else if (opts.dataType === 'time_thrust') {
      const fVal = parseNumericCell(row[val1Idx]);
      if (Number.isFinite(fVal)) {
        rows.push({ t: tVal, f: convertForceToN(fVal, opts.forceUnit) });
      }
    } else {
      const pVal = parseNumericCell(row[val1Idx]);
      const fVal = parseNumericCell(row[val2Idx]);
      if (Number.isFinite(pVal) && Number.isFinite(fVal)) {
        rows.push({
          t: tVal,
          p: convertPresToMPa(pVal, opts.presUnit),
          f: convertForceToN(fVal, opts.forceUnit),
        });
      }
    }
  }

  rows.sort((a, b) => a.t - b.t);
  if (rows.length < 2) {
    throw new Error('no_numeric_rows');
  }

  const t0 = rows[0].t;
  const tNorm = rows.map((r) => r.t - t0);
  const pArr = opts.dataType === 'time_thrust' ? undefined : rows.map((r) => r.p ?? 0);
  const fArr = opts.dataType === 'time_pressure' ? undefined : rows.map((r) => r.f ?? 0);

  return buildExperimentalStudySeries({
    name: cleanBaseName,
    sourceDetail:
      opts.dataType === 'time_pressure'
        ? `${file.name} (${opts.presUnit})`
        : opts.dataType === 'time_thrust'
          ? `${file.name} (${opts.forceUnit})`
          : `${file.name} (${opts.presUnit} / ${opts.forceUnit})`,
    tPressure: pArr ? tNorm : undefined,
    pGageMPa: pArr,
    tThrust: fArr ? tNorm : undefined,
    fExpN: fArr,
    autoAlignZero: opts.autoAlignZero,
    existingSeries,
  });
}

export function getSeriesThrustArray(
  s: StudySeries,
  thrustModel: StudyThrustModel
): { t: number[]; y: number[] } | null {
  if (s.source === 'experimental') {
    if (!s.fExpN || s.fExpN.length < 2) return null;
    const tArr = s.tThrust && s.tThrust.length === s.fExpN.length ? s.tThrust : s.t;
    return tArr.length >= 2 ? { t: tArr, y: s.fExpN } : null;
  }
  const fArr = thrustModel === 'rn' ? (s.fRnN || s.fTtiN) : (s.fTtiN || s.fRnN);
  if (!fArr || fArr.length < 2) return null;
  const tArr = s.tThrust && s.tThrust.length === fArr.length ? s.tThrust : s.t;
  return tArr.length >= 2 ? { t: tArr, y: fArr } : null;
}

export function getSeriesPressureArray(
  s: StudySeries
): { t: number[]; yMPa: number[] } | null {
  if (!s.pGageMPa || s.pGageMPa.length < 2) return null;
  const tArr = s.tPressure && s.tPressure.length === s.pGageMPa.length ? s.tPressure : s.t;
  return tArr.length >= 2 ? { t: tArr, yMPa: s.pGageMPa } : null;
}

/**
 * Finds the time shift needed to place ignition rise (5% of peak above baseline) at t = 0.
 */
export function computeIgnitionZeroOffset(s: StudySeries): number {
  const fPair = getSeriesThrustArray(s, 'tti');
  const pPair = getSeriesPressureArray(s);
  const tArr = fPair?.t ?? pPair?.t;
  const yArr = fPair?.y ?? pPair?.yMPa;
  if (!tArr || !yArr || tArr.length < 3) return 0;

  let maxVal = -Infinity;
  for (let i = 0; i < yArr.length; i++) {
    if (yArr[i] > maxVal) maxVal = yArr[i];
  }
  const preWindow = Math.max(1, Math.min(20, Math.floor(yArr.length * 0.1)));
  let baseVal = yArr[0];
  for (let i = 1; i < preWindow; i++) {
    if (yArr[i] < baseVal) baseVal = yArr[i];
  }
  if (!(maxVal > baseVal)) return 0;

  const thresh = baseVal + (maxVal - baseVal) * 0.05;
  for (let i = 0; i < yArr.length; i++) {
    if (yArr[i] >= thresh) {
      return Number((-tArr[i]).toFixed(3));
    }
  }
  return 0;
}

/**
 * Computes the median pre-ignition baseline offset for an experimental channel.
 */
export function computePreIgnitionBaseline(yArr: number[]): number {
  const n = yArr.length;
  if (n < 2) return 0;
  let maxVal = -Infinity;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(yArr[i]) && yArr[i] > maxVal) maxVal = yArr[i];
  }
  const probeCount = Math.max(1, Math.min(20, Math.floor(n * 0.1)));
  let baseEst = Number.isFinite(yArr[0]) ? yArr[0] : 0;
  for (let i = 1; i < probeCount; i++) {
    if (Number.isFinite(yArr[i]) && yArr[i] < baseEst) baseEst = yArr[i];
  }
  const span = maxVal - baseEst;
  const thresh = span > 0 ? baseEst + span * 0.05 : Infinity;

  let riseIdx = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(yArr[i]) && yArr[i] >= thresh) {
      riseIdx = i;
      break;
    }
  }

  const baselineCount = riseIdx >= 3
    ? riseIdx
    : Math.max(1, Math.min(10, Math.floor(n * 0.05)));
  const sample = yArr
    .slice(0, baselineCount)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (sample.length === 0) return 0;
  const mid = Math.floor(sample.length / 2);
  return sample.length % 2 === 1 ? sample[mid] : 0.5 * (sample[mid - 1] + sample[mid]);
}

/**
 * Toggles a lossless, manual reversible pre-ignition tare (Zero Y) on an experimental series.
 * Raw imported values are always preserved in `rawPGageMPa` / `rawFExpN`.
 */
export function toggleExperimentalSeriesTare(s: StudySeries): Partial<StudySeries> {
  if (s.source !== 'experimental') return {};

  if (s.isTared) {
    return {
      isTared: false,
      pTareOffsetMPa: undefined,
      fTareOffsetN: undefined,
      ...(s.rawPGageMPa ? { pGageMPa: s.rawPGageMPa.slice() } : {}),
      ...(s.rawFExpN ? { fExpN: s.rawFExpN.slice() } : {}),
    };
  }

  const rawP = (s.rawPGageMPa || s.pGageMPa)?.slice();
  const rawF = (s.rawFExpN || s.fExpN)?.slice();
  const pOff = rawP && rawP.length >= 2 ? computePreIgnitionBaseline(rawP) : undefined;
  const fOff = rawF && rawF.length >= 2 ? computePreIgnitionBaseline(rawF) : undefined;

  return {
    isTared: true,
    rawPGageMPa: rawP,
    rawFExpN: rawF,
    pTareOffsetMPa: pOff,
    fTareOffsetN: fOff,
    ...(rawP && pOff !== undefined ? { pGageMPa: rawP.map((v) => Math.max(0, v - pOff)) } : {}),
    ...(rawF && fOff !== undefined ? { fExpN: rawF.map((v) => Math.max(0, v - fOff)) } : {}),
  };
}

function integrateTrapezoid(t: number[], y: number[]): number {
  const n = Math.min(t.length, y.length);
  if (n < 2) return 0;
  let area = 0;
  for (let i = 1; i < n; i++) {
    const dt = t[i] - t[i - 1];
    if (dt > 0) {
      area += 0.5 * (Math.max(0, y[i - 1]) + Math.max(0, y[i])) * dt;
    }
  }
  return area;
}

function computeActiveStats(
  t: number[],
  y: number[]
): { max: number; avg: number; durationS: number } {
  const n = Math.min(t.length, y.length);
  if (n < 2) return { max: 0, avg: 0, durationS: 0 };

  let max = 0;
  for (let i = 0; i < n; i++) {
    if (y[i] > max) max = y[i];
  }
  if (max <= 0) return { max: 0, avg: 0, durationS: 0 };

  const thresh = max * 0.05;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < n; i++) {
    if (y[i] >= thresh) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  if (firstIdx === -1 || lastIdx <= firstIdx) {
    return { max, avg: max, durationS: 0 };
  }

  const durationS = Math.max(1e-6, t[lastIdx] - t[firstIdx]);
  const activeArea = integrateTrapezoid(
    t.slice(firstIdx, lastIdx + 1),
    y.slice(firstIdx, lastIdx + 1)
  );
  return {
    max,
    avg: activeArea / durationS,
    durationS,
  };
}

export function computeStudyMetrics(
  s: StudySeries,
  thrustModel: StudyThrustModel
): StudySeriesMetrics {
  const pData = getSeriesPressureArray(s);
  const fData = getSeriesThrustArray(s, thrustModel);

  let pMaxMPa: number | null = null;
  let pAvgMPa: number | null = null;
  let pDurationS: number | null = null;

  if (pData) {
    const ps = computeActiveStats(pData.t, pData.yMPa);
    pMaxMPa = ps.max;
    pAvgMPa = ps.avg;
    pDurationS = ps.durationS;
  }

  let totalImpulseNs: number | null = null;
  let fMaxN: number | null = null;
  let fAvgN: number | null = null;
  let fDurationS: number | null = null;

  if (fData) {
    totalImpulseNs = integrateTrapezoid(fData.t, fData.y);
    const fs = computeActiveStats(fData.t, fData.y);
    fMaxN = fs.max;
    fAvgN = fs.avg;
    fDurationS = fs.durationS;
  }

  const burnTimeS =
    s.source !== 'experimental' && typeof s.burnTimeS === 'number' && s.burnTimeS > 0
      ? s.burnTimeS
      : fDurationS ?? pDurationS;

  const ispS =
    totalImpulseNs !== null &&
    typeof s.propellantMassKg === 'number' &&
    s.propellantMassKg > 0
      ? totalImpulseNs / (s.propellantMassKg * 9.80665)
      : null;

  return {
    id: s.id,
    hasPressure: Boolean(pData),
    hasThrust: Boolean(fData),
    totalImpulseNs,
    pMaxMPa,
    pAvgMPa,
    fMaxN,
    fAvgN,
    burnTimeS,
    ispS,
  };
}

export function computeComparisonDelta(
  m: StudySeriesMetrics,
  ref: StudySeriesMetrics | null
): StudyComparisonDelta {
  if (!ref || m.id === ref.id) {
    return {
      dItNs: null,
      dItPct: null,
      dPmaxMPa: null,
      dPmaxPct: null,
      dFmaxN: null,
      dFmaxPct: null,
    };
  }

  const calcDelta = (cur: number | null, base: number | null) => {
    if (cur === null || base === null) return { diff: null, pct: null };
    const diff = cur - base;
    const pct = Math.abs(base) > 1e-9 ? (diff / base) * 100 : null;
    return { diff, pct };
  };

  const itD = calcDelta(m.totalImpulseNs, ref.totalImpulseNs);
  const pD = calcDelta(m.pMaxMPa, ref.pMaxMPa);
  const fD = calcDelta(m.fMaxN, ref.fMaxN);

  return {
    dItNs: itD.diff,
    dItPct: itD.pct,
    dPmaxMPa: pD.diff,
    dPmaxPct: pD.pct,
    dFmaxN: fD.diff,
    dFmaxPct: fD.pct,
  };
}

function interpolateLinearAt(tArr: number[], yArr: number[], targetT: number): number | null {
  const n = Math.min(tArr.length, yArr.length);
  if (n < 2) return null;
  if (targetT < tArr[0] || targetT > tArr[n - 1]) return null;

  // Binary search
  let lo = 0;
  let hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (tArr[mid] <= targetT) lo = mid;
    else hi = mid;
  }
  const dt = tArr[hi] - tArr[lo];
  if (dt <= 0) return yArr[lo];
  const frac = (targetT - tArr[lo]) / dt;
  return yArr[lo] + (yArr[hi] - yArr[lo]) * frac;
}

/**
 * Builds a unified time grid for Recharts overlaid line charts across multiple visible series.
 */
export function buildOverlaidChartData(
  seriesList: StudySeries[],
  channel: 'pressure' | 'thrust',
  opts: { pressureUnit: 'bar' | 'MPa'; thrustModel: StudyThrustModel; maxPoints?: number }
): Array<Record<string, number>> {
  const maxPoints = opts.maxPoints ?? 360;
  const activePairs: Array<{ id: string; t: number[]; y: number[] }> = [];

  for (const s of seriesList) {
    if (!s.visible) continue;
    const shift = Number(s.timeOffsetSec) || 0;
    if (channel === 'pressure') {
      const p = getSeriesPressureArray(s);
      if (!p) continue;
      const mult = opts.pressureUnit === 'bar' ? 10 : 1;
      activePairs.push({
        id: s.id,
        t: p.t.map((tv) => tv + shift),
        y: p.yMPa.map((yv) => yv * mult),
      });
    } else {
      const f = getSeriesThrustArray(s, opts.thrustModel);
      if (!f) continue;
      activePairs.push({
        id: s.id,
        t: f.t.map((tv) => tv + shift),
        y: f.y,
      });
    }
  }

  if (activePairs.length === 0) return [];

  let tMin = Infinity;
  let tMax = -Infinity;
  for (const pair of activePairs) {
    if (pair.t[0] < tMin) tMin = pair.t[0];
    if (pair.t[pair.t.length - 1] > tMax) tMax = pair.t[pair.t.length - 1];
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) return [];

  // Clamp left side at 0 if all series start >= -0.05 to keep charts tidy, otherwise include pre-ignition
  const span = tMax - tMin;
  const step = span / maxPoints;

  const grid: Array<Record<string, number>> = [];
  for (let i = 0; i <= maxPoints; i++) {
    const tv = Number((tMin + i * step).toFixed(4));
    const row: Record<string, number> = { t: tv };
    for (const pair of activePairs) {
      const val = interpolateLinearAt(pair.t, pair.y, tv);
      if (val !== null && Number.isFinite(val)) {
        row[pair.id] = Number(val.toFixed(4));
      }
    }
    grid.push(row);
  }
  return grid;
}
