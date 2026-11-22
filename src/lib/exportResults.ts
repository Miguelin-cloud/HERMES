import * as XLSX from 'xlsx';
import {
  CustomPropellant,
  GrainInput,
  MotorInput,
  NozzleInput,
  SimulationResults,
  getPropellantData,
} from './types';
import { MotorStructureResult } from './motorStructure';
import { ApogeeResult } from './apogee';
import { MissionControlSnapshot } from './missionControlStorage';
import { getGrainShapeLabel } from './grains/labels';
import { Language } from './i18n';

export type CsvDecimalSeparator = 'dot' | 'comma';
export type ExcelOrientation = 'columns' | 'rows';

export interface GncTimeSeriesRow {
  'Time (s)': number;
  'P0_abs (MPa)': number;
  'P0_gage (MPa)': number;
  'P0_gage (bar)': number;
  'P0_gage (atm)': number;
  'Thrust_RN (N)': number;
  'Thrust_RN (kgf)': number;
  'Thrust_TTI (N)': number;
  'Thrust_TTI (kgf)': number;
  'mprop (kg)': number;
  'dmprop/dt (kg/s)': number;
  'mdot_gen (kg/s)': number;
  'mdot_noz (kg/s)': number;
  'Kn (-)': number;
  'r_burn (mm/s)': number;
  'At (mm2)': number;
  'Ab_total (mm2)': number;
}

export interface ExportSimulationPackageArgs {
  filename: string;
  results: SimulationResults;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  motorStruct: MotorStructureResult;
  simApogee?: ApogeeResult | null;
  mcSnapshot?: MissionControlSnapshot | null;
  lang?: Language;
  orientation?: ExcelOrientation;
}

function roundNum(val: number, decimals: number): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function computeDmpropDt(res: SimulationResults, index: number): number {
  if (index <= 0 || !res.mgra_total || !res.t) return 0;
  const dt = (res.t[index] || 0) - (res.t[index - 1] || 0);
  if (dt <= 1e-9) return 0;
  const prev = res.mgra_total[index - 1] ?? 0;
  const curr = res.mgra_total[index] ?? 0;
  return Math.max(0, (prev - curr) / dt);
}

export function buildGncTimeSeriesRows(res: SimulationResults): GncTimeSeriesRow[] {
  const rows: GncTimeSeriesRow[] = [];
  const len = res.t.length;

  for (let i = 0; i < len; i++) {
    const pAbs = Math.max(0, res.P0_MPa[i] || 0);
    const pGage = Math.max(0, res.P0_gage[i] || 0);
    const fRn = Math.max(0, res.F_N[i] || 0);
    const fTti = Math.max(0, res.E_N[i] || 0);
    const mprop = Math.max(0, res.mgra_total[i] || 0);
    const dmpropDt = computeDmpropDt(res, i);
    const mdotGen = Math.max(0, res.mdot_gen?.[i] ?? 0);
    const mdotNoz = Math.max(0, res.mdot_noz?.[i] ?? 0);

    rows.push({
      'Time (s)': roundNum(res.t[i] || 0, 5),
      'P0_abs (MPa)': roundNum(pAbs, 5),
      'P0_gage (MPa)': roundNum(pGage, 5),
      'P0_gage (bar)': roundNum(pGage * 10, 4),
      'P0_gage (atm)': roundNum(pGage * 9.86923, 4),
      'Thrust_RN (N)': roundNum(fRn, 3),
      'Thrust_RN (kgf)': roundNum(fRn / 9.80665, 3),
      'Thrust_TTI (N)': roundNum(fTti, 3),
      'Thrust_TTI (kgf)': roundNum(fTti / 9.80665, 3),
      'mprop (kg)': roundNum(mprop, 5),
      'dmprop/dt (kg/s)': roundNum(dmpropDt, 5),
      'mdot_gen (kg/s)': roundNum(mdotGen, 5),
      'mdot_noz (kg/s)': roundNum(mdotNoz, 5),
      'Kn (-)': roundNum(res.Kn?.[i] ?? 0, 2),
      'r_burn (mm/s)': roundNum(res.r_burn?.[i] ?? 0, 3),
      'At (mm2)': roundNum(res.At_mm2?.[i] ?? 0, 3),
      'Ab_total (mm2)': roundNum(res.Ab_total?.[i] ?? 0, 2),
    });
  }

  return rows;
}

interface LocalizedExportLabels {
  sheetTime: string;
  sheetSummary: string;
  sheetInputs: string;
  sheetFlight: string;
  colSection: string;
  colMetric: string;
  colValue: string;
  colUnit: string;
  colGroup: string;
  colParameter: string;
  secMotor: string;
  secFlight: string;
  grpChamber: string;
  grpNozzle: string;
  grpGrainPrefix: string;
  grpMc: string;
  yes: string;
  no: string;
  exportTimestamp: string;
  motorClass: string;
  totalImpulse: string;
  specImpulse: string;
  burnTime: string;
  actionTime: string;
  maxPressure: string;
  avgPressure: string;
  maxThrustTti: string;
  avgThrustTti: string;
  maxThrustRn: string;
  avgThrustRn: string;
  initPropMass: string;
  maxMassFlow: string;
  avgMassFlow: string;
  maxKn: string;
  avgKn: string;
  maxBurnRate: string;
  avgBurnRate: string;
  predApogeeAgl: string;
  predApogeeAsl: string;
  timeToApogee: string;
  maxVelocity: string;
  maxAccel: string;
  railExitVel: string;
  minSafeRailVel: string;
  railExitAoa: string;
  recoveryMode: string;
  touchdownRate: string;
  totalFlightTime: string;
  landingRange: string;
  dcLabel: string;
  lcLabel: string;
  etacLabel: string;
  gstarLabel: string;
  kvLabel: string;
  dtLabel: string;
  pambLabel: string;
  linerLabel: string;
  inhibitorLabel: string;
  dt0Label: string;
  dsLabel: string;
  expRatioLabel: string;
  alphaLabel: string;
  etanozLabel: string;
  throatVarLabel: string;
  eroModelLabel: string;
  grainShape: string;
  grainPropellant: string;
  grainD0: string;
  graind0: string;
  graind0mayor: string;
  grainL0: string;
  grainN: string;
  grainNp: string;
  grainRhorat: string;
  grainFaces: string;
  grainFinW: string;
  grainSpokeW: string;
  grainOffset: string;
  grainSlotW: string;
  grainSlotD: string;
  grainRodD: string;
  mcEmptyMass: string;
  mcOuterDiam: string;
  mcLaunchAlt: string;
  mcAmbientTemp: string;
  mcRailAngle: string;
  mcRailLen: string;
  mcWindSpeed: string;
  mcMainChute: string;
  mcDrogueChute: string;
  mcMainDeployAlt: string;
  mcAeroCurve: string;
  mcStdCurve: string;
  mcCustomCurve: string;
}

function getLocalizedExportLabels(lang: Language): LocalizedExportLabels {
  if (lang === 'es') {
    return {
      sheetTime: 'Serie_Temporal',
      sheetSummary: 'Resumen',
      sheetInputs: 'Entradas',
      sheetFlight: 'Trayectoria_Vuelo',
      colSection: 'Sección',
      colMetric: 'Métrica',
      colValue: 'Valor',
      colUnit: 'Unidad',
      colGroup: 'Grupo',
      colParameter: 'Parámetro',
      secMotor: 'RENDIMIENTO DEL MOTOR',
      secFlight: 'VUELO Y RECUPERACIÓN',
      grpChamber: 'CÁMARA',
      grpNozzle: 'TOBERA',
      grpGrainPrefix: 'GRANO_',
      grpMc: 'CONTROL_MISION',
      yes: 'SÍ',
      no: 'NO',
      exportTimestamp: 'Fecha de exportación',
      motorClass: 'Clase del Motor',
      totalImpulse: 'Impulso Total (It)',
      specImpulse: 'Impulso Específico (Isp)',
      burnTime: 'Tiempo de Quemado',
      actionTime: 'Tiempo de Acción',
      maxPressure: 'Presión Máxima (abs)',
      avgPressure: 'Presión Media (manométrica)',
      maxThrustTti: 'Empuje Máximo (TTI)',
      avgThrustTti: 'Empuje Medio (TTI)',
      maxThrustRn: 'Empuje Máximo (Richard Nakka)',
      avgThrustRn: 'Empuje Medio (Richard Nakka)',
      initPropMass: 'Masa Inicial Propelente (mprop_0)',
      maxMassFlow: 'Gasto Másico Máximo (mdot_gen)',
      avgMassFlow: 'Gasto Másico Medio (mdot_gen)',
      maxKn: 'Kn Máximo',
      avgKn: 'Kn Medio',
      maxBurnRate: 'Velocidad de Quemado Máx. (r)',
      avgBurnRate: 'Velocidad de Quemado Media (r)',
      predApogeeAgl: 'Apogeo Previsto (AGL)',
      predApogeeAsl: 'Apogeo Previsto (ASL)',
      timeToApogee: 'Tiempo al Apogeo',
      maxVelocity: 'Velocidad Máxima',
      maxAccel: 'Aceleración Máxima',
      railExitVel: 'Velocidad Salida Rampa',
      minSafeRailVel: 'Velocidad Mín. Recomendada Rampa',
      railExitAoa: 'Ángulo de Ataque Salida Rampa (AoA)',
      recoveryMode: 'Modo de Recuperación',
      touchdownRate: 'Velocidad Descenso Aterrizaje',
      totalFlightTime: 'Tiempo Total de Vuelo',
      landingRange: 'Deriva Horizontal',
      dcLabel: 'Diámetro Interno Cámara (Dc)',
      lcLabel: 'Longitud de Cámara (Lc)',
      etacLabel: 'Eficiencia Combustión (etac)',
      gstarLabel: 'Umbral Erosivo G*',
      kvLabel: 'Coeficiente Erosivo (kv)',
      dtLabel: 'Paso de Tiempo (dt)',
      pambLabel: 'Presión Ambiental (Pamb)',
      linerLabel: 'Liner Térmico',
      inhibitorLabel: 'Inhibidor Exterior Grano',
      dt0Label: 'Diámetro Garganta Inicial (Dt0)',
      dsLabel: 'Diámetro de Salida (Ds)',
      expRatioLabel: 'Relación de Expansión (Ae/At)',
      alphaLabel: 'Semi-ángulo Divergente (alpha)',
      etanozLabel: 'Eficiencia de Tobera (etanoz)',
      throatVarLabel: 'Variación Garganta (e)',
      eroModelLabel: 'Modelo Erosión / Escoria',
      grainShape: 'Forma',
      grainPropellant: 'Propelente',
      grainD0: 'Diámetro Exterior (D0)',
      graind0: 'Diámetro Port / Núcleo (d0)',
      graind0mayor: 'Diámetro Secundario (d0mayor)',
      grainL0: 'Longitud Segmento (L0)',
      grainN: 'Número de Segmentos (N)',
      grainNp: 'Puntas / Aletas / Radios (Np)',
      grainRhorat: 'Relación Densidad (rhorat)',
      grainFaces: 'Caras Combustión (EXT / INT / EXTREMOS)',
      grainFinW: 'Ancho Aleta',
      grainSpokeW: 'Ancho Radio',
      grainOffset: 'Excentricidad Núcleo',
      grainSlotW: 'Ancho Ranura',
      grainSlotD: 'Profundidad Ranura / Corte',
      grainRodD: 'Diámetro Varilla',
      mcEmptyMass: 'Masa Cohete Vacío (sin motor)',
      mcOuterDiam: 'Diámetro Exterior Cohete',
      mcLaunchAlt: 'Altitud Lanzamiento (ASL)',
      mcAmbientTemp: 'Temperatura Ambiental Rampa',
      mcRailAngle: 'Ángulo Rampa (FPA)',
      mcRailLen: 'Longitud Rampa',
      mcWindSpeed: 'Viento a Altura de Rampa',
      mcMainChute: 'Paracaídas Principal (Diám / Cd)',
      mcDrogueChute: 'Paracaídas Drogue (Diám / Cd)',
      mcMainDeployAlt: 'Altitud Apertura Principal (AGL)',
      mcAeroCurve: 'Curva Mach vs Cd',
      mcStdCurve: 'Curva Estándar',
      mcCustomCurve: 'Personalizada Activa',
    };
  }
  if (lang === 'fr') {
    return {
      sheetTime: 'Serie_Temporelle',
      sheetSummary: 'Resume',
      sheetInputs: 'Entrees',
      sheetFlight: 'Trajectoire_Vol',
      colSection: 'Section',
      colMetric: 'Métrique',
      colValue: 'Valeur',
      colUnit: 'Unité',
      colGroup: 'Groupe',
      colParameter: 'Paramètre',
      secMotor: 'PERFORMANCE MOTEUR',
      secFlight: 'VOL ET RÉCUPÉRATION',
      grpChamber: 'CHAMBRE',
      grpNozzle: 'TUYÈRE',
      grpGrainPrefix: 'GRAIN_',
      grpMc: 'CONTROLE_MISSION',
      yes: 'OUI',
      no: 'NON',
      exportTimestamp: 'Date exportation',
      motorClass: 'Classe Moteur',
      totalImpulse: 'Impulsion Totale (It)',
      specImpulse: 'Impulsion Spécifique (Isp)',
      burnTime: 'Temps Combustion',
      actionTime: 'Temps Action',
      maxPressure: 'Pression Max (abs)',
      avgPressure: 'Pression Moyenne (rel)',
      maxThrustTti: 'Poussée Max (TTI)',
      avgThrustTti: 'Poussée Moyenne (TTI)',
      maxThrustRn: 'Poussée Max (Richard Nakka)',
      avgThrustRn: 'Poussée Moyenne (Richard Nakka)',
      initPropMass: 'Masse Initiale Propergol (mprop_0)',
      maxMassFlow: 'Débit Massique Max (mdot_gen)',
      avgMassFlow: 'Débit Massique Moyen (mdot_gen)',
      maxKn: 'Kn Max',
      avgKn: 'Kn Moyen',
      maxBurnRate: 'Vitesse Combustion Max (r)',
      avgBurnRate: 'Vitesse Combustion Moyenne (r)',
      predApogeeAgl: 'Apogée Prévu (AGL)',
      predApogeeAsl: 'Apogée Prévu (ASL)',
      timeToApogee: 'Temps à l\'Apogée',
      maxVelocity: 'Vitesse Max',
      maxAccel: 'Accélération Max',
      railExitVel: 'Vitesse Sortie Rampe',
      minSafeRailVel: 'Vitesse Min Recommandée Rampe',
      railExitAoa: 'Angle d\'Attaque Sortie Rampe (AoA)',
      recoveryMode: 'Mode Récupération',
      touchdownRate: 'Vitesse Descente Atterrissage',
      totalFlightTime: 'Temps Total Vol',
      landingRange: 'Portée Horizontale',
      dcLabel: 'Diamètre Interne Chambre (Dc)',
      lcLabel: 'Longueur Chambre (Lc)',
      etacLabel: 'Rendement Combustion (etac)',
      gstarLabel: 'Seuil Érosif G*',
      kvLabel: 'Coefficient Érosif (kv)',
      dtLabel: 'Pas de Temps (dt)',
      pambLabel: 'Pression Ambiante (Pamb)',
      linerLabel: 'Liner Thermique',
      inhibitorLabel: 'Inhibiteur Externe Grain',
      dt0Label: 'Diamètre Col Initial (Dt0)',
      dsLabel: 'Diamètre Sortie (Ds)',
      expRatioLabel: 'Rapport Expansion (Ae/At)',
      alphaLabel: 'Demi-angle Divergent (alpha)',
      etanozLabel: 'Rendement Tuyère (etanoz)',
      throatVarLabel: 'Variation Col (e)',
      eroModelLabel: 'Modèle Érosion / Scorie',
      grainShape: 'Forme',
      grainPropellant: 'Propergol',
      grainD0: 'Diamètre Externe (D0)',
      graind0: 'Diamètre Port (d0)',
      graind0mayor: 'Diamètre Secondaire (d0mayor)',
      grainL0: 'Longueur Segment (L0)',
      grainN: 'Nombre Segments (N)',
      grainNp: 'Pointes / Ailettes / Rayons (Np)',
      grainRhorat: 'Rapport Densité (rhorat)',
      grainFaces: 'Faces Combustion (EXT / INT / BOUTS)',
      grainFinW: 'Largeur Ailette',
      grainSpokeW: 'Largeur Rayon',
      grainOffset: 'Excentricité Canal',
      grainSlotW: 'Largeur Fente',
      grainSlotD: 'Profondeur Fente / Coupe',
      grainRodD: 'Diamètre Tige',
      mcEmptyMass: 'Masse Fusée Vide (sans moteur)',
      mcOuterDiam: 'Diamètre Externe Fusée',
      mcLaunchAlt: 'Altitude Lancement (ASL)',
      mcAmbientTemp: 'Température Ambiante Rampe',
      mcRailAngle: 'Angle Rampe (FPA)',
      mcRailLen: 'Longueur Rampe',
      mcWindSpeed: 'Vent à Hauteur Rampe',
      mcMainChute: 'Parachute Principal (Diam / Cd)',
      mcDrogueChute: 'Parachute Drogue (Diam / Cd)',
      mcMainDeployAlt: 'Altitude Ouverture Principal (AGL)',
      mcAeroCurve: 'Courbe Mach vs Cd',
      mcStdCurve: 'Courbe Standard',
      mcCustomCurve: 'Personnalisée Active',
    };
  }
  if (lang === 'it') {
    return {
      sheetTime: 'Serie_Temporale',
      sheetSummary: 'Riepilogo',
      sheetInputs: 'Parametri',
      sheetFlight: 'Traiettoria_Volo',
      colSection: 'Sezione',
      colMetric: 'Metrica',
      colValue: 'Valore',
      colUnit: 'Unità',
      colGroup: 'Gruppo',
      colParameter: 'Parametro',
      secMotor: 'PRESTAZIONI MOTORE',
      secFlight: 'VOLO E RECUPERO',
      grpChamber: 'CAMERA',
      grpNozzle: 'UGELLO',
      grpGrainPrefix: 'GRANO_',
      grpMc: 'MISSION_CONTROL',
      yes: 'SÌ',
      no: 'NO',
      exportTimestamp: 'Data esportazione',
      motorClass: 'Classe Motore',
      totalImpulse: 'Impulso Totale (It)',
      specImpulse: 'Impulso Specifico (Isp)',
      burnTime: 'Tempo Combustione',
      actionTime: 'Tempo Azione',
      maxPressure: 'Pressione Max (abs)',
      avgPressure: 'Pressione Media (rel)',
      maxThrustTti: 'Spinta Max (TTI)',
      avgThrustTti: 'Spinta Media (TTI)',
      maxThrustRn: 'Spinta Max (Richard Nakka)',
      avgThrustRn: 'Spinta Media (Richard Nakka)',
      initPropMass: 'Massa Iniziale Propellente (mprop_0)',
      maxMassFlow: 'Flusso di Massa Max (mdot_gen)',
      avgMassFlow: 'Flusso di Massa Medio (mdot_gen)',
      maxKn: 'Kn Max',
      avgKn: 'Kn Medio',
      maxBurnRate: 'Velocità Combustione Max (r)',
      avgBurnRate: 'Velocità Combustione Media (r)',
      predApogeeAgl: 'Apogeo Previsto (AGL)',
      predApogeeAsl: 'Apogeo Previsto (ASL)',
      timeToApogee: 'Tempo all\'Apogeo',
      maxVelocity: 'Velocità Max',
      maxAccel: 'Accelerazione Max',
      railExitVel: 'Velocità Uscita Rampa',
      minSafeRailVel: 'Velocità Min Consigliata Rampa',
      railExitAoa: 'Angolo Attacco Uscita Rampa (AoA)',
      recoveryMode: 'Modalità Recupero',
      touchdownRate: 'Velocità Discesa Atterraggio',
      totalFlightTime: 'Tempo Totale Volo',
      landingRange: 'Deriva Orizzontale',
      dcLabel: 'Diametro Interno Camera (Dc)',
      lcLabel: 'Lunghezza Camera (Lc)',
      etacLabel: 'Efficienza Combustione (etac)',
      gstarLabel: 'Soglia Erosiva G*',
      kvLabel: 'Coefficiente Erosivo (kv)',
      dtLabel: 'Passo Temporale (dt)',
      pambLabel: 'Pressione Ambientale (Pamb)',
      linerLabel: 'Liner Termico',
      inhibitorLabel: 'Inibitore Esterno Grano',
      dt0Label: 'Diametro Gola Iniziale (Dt0)',
      dsLabel: 'Diametro Uscita (Ds)',
      expRatioLabel: 'Rapporto Espansione (Ae/At)',
      alphaLabel: 'Semi-angolo Divergente (alpha)',
      etanozLabel: 'Efficienza Ugello (etanoz)',
      throatVarLabel: 'Variazione Gola (e)',
      eroModelLabel: 'Modello Erosione / Scoria',
      grainShape: 'Forma',
      grainPropellant: 'Propellente',
      grainD0: 'Diametro Esterno (D0)',
      graind0: 'Diametro Foro (d0)',
      graind0mayor: 'Diametro Secondario (d0mayor)',
      grainL0: 'Lunghezza Segmento (L0)',
      grainN: 'Numero Segmenti (N)',
      grainNp: 'Punte / Alette / Raggi (Np)',
      grainRhorat: 'Rapporto Densità (rhorat)',
      grainFaces: 'Faccie Combustione (EST / INT / ESTREMI)',
      grainFinW: 'Larghezza Aletta',
      grainSpokeW: 'Larghezza Raggio',
      grainOffset: 'Eccentricità Foro',
      grainSlotW: 'Larghezza Fessura',
      grainSlotD: 'Profondità Taglio / Fessura',
      grainRodD: 'Diametro Asta',
      mcEmptyMass: 'Massa Razzo Vuoto (senza motore)',
      mcOuterDiam: 'Diametro Esterno Razzo',
      mcLaunchAlt: 'Altitudine Lancio (ASL)',
      mcAmbientTemp: 'Temperatura Ambientale Rampa',
      mcRailAngle: 'Angolo Rampa (FPA)',
      mcRailLen: 'Lunghezza Rampa',
      mcWindSpeed: 'Vento ad Altezza Rampa',
      mcMainChute: 'Paracadute Principale (Diam / Cd)',
      mcDrogueChute: 'Paracadute Drogue (Diam / Cd)',
      mcMainDeployAlt: 'Altitudine Apertura Principale (AGL)',
      mcAeroCurve: 'Curva Mach vs Cd',
      mcStdCurve: 'Curva Standard',
      mcCustomCurve: 'Personalizzata Attiva',
    };
  }
  return {
    sheetTime: 'Time_Series',
    sheetSummary: 'Summary',
    sheetInputs: 'Inputs',
    sheetFlight: 'Flight_Trajectory',
    colSection: 'Section',
    colMetric: 'Metric',
    colValue: 'Value',
    colUnit: 'Unit',
    colGroup: 'Group',
    colParameter: 'Parameter',
    secMotor: 'MOTOR PERFORMANCE',
    secFlight: 'MISSION CONTROL FLIGHT',
    grpChamber: 'CHAMBER',
    grpNozzle: 'NOZZLE',
    grpGrainPrefix: 'GRAIN_',
    grpMc: 'MISSION_CONTROL',
    yes: 'YES',
    no: 'NO',
    exportTimestamp: 'Export Timestamp',
    motorClass: 'Motor Class',
    totalImpulse: 'Total Impulse (It)',
    specImpulse: 'Specific Impulse (Isp)',
    burnTime: 'Burn Time',
    actionTime: 'Action Time',
    maxPressure: 'Max Chamber Pressure (abs)',
    avgPressure: 'Avg Chamber Pressure (gage)',
    maxThrustTti: 'Max Thrust (TTI)',
    avgThrustTti: 'Avg Thrust (TTI)',
    maxThrustRn: 'Max Thrust (Richard Nakka)',
    avgThrustRn: 'Avg Thrust (Richard Nakka)',
    initPropMass: 'Initial Propellant Mass (mprop_0)',
    maxMassFlow: 'Max Mass Flow (mdot_gen)',
    avgMassFlow: 'Avg Mass Flow (mdot_gen)',
    maxKn: 'Max Kn',
    avgKn: 'Avg Kn',
    maxBurnRate: 'Max Burn Rate (r)',
    avgBurnRate: 'Avg Burn Rate (r)',
    predApogeeAgl: 'Predicted Apogee (AGL)',
    predApogeeAsl: 'Predicted Apogee (ASL)',
    timeToApogee: 'Time to Apogee',
    maxVelocity: 'Max Velocity',
    maxAccel: 'Max Acceleration',
    railExitVel: 'Rail Exit Velocity',
    minSafeRailVel: 'Min Recommended Rail Exit Velocity',
    railExitAoa: 'Rail Exit Angle of Attack (AoA)',
    recoveryMode: 'Recovery Mode',
    touchdownRate: 'Touchdown Descent Rate',
    totalFlightTime: 'Total Flight Time',
    landingRange: 'Landing Horizontal Range',
    dcLabel: 'Inner Diameter (Dc)',
    lcLabel: 'Chamber Length (Lc)',
    etacLabel: 'Combustion Efficiency (etac)',
    gstarLabel: 'Erosive Burning G*',
    kvLabel: 'Erosive Coefficient (kv)',
    dtLabel: 'Time Step (dt)',
    pambLabel: 'Ambient Pressure (Pamb)',
    linerLabel: 'Thermal Liner',
    inhibitorLabel: 'Outer Grain Inhibitor',
    dt0Label: 'Initial Throat Diameter (Dt0)',
    dsLabel: 'Exit Diameter (Ds)',
    expRatioLabel: 'Expansion Ratio (Ae/At)',
    alphaLabel: 'Divergence Half-Angle (alpha)',
    etanozLabel: 'Nozzle Efficiency (etanoz)',
    throatVarLabel: 'Throat Variation (e)',
    eroModelLabel: 'Erosion / Slag Model',
    grainShape: 'Shape',
    grainPropellant: 'Propellant',
    grainD0: 'Outer Diameter (D0)',
    graind0: 'Inner Port / Bore (d0)',
    graind0mayor: 'Secondary Diameter (d0mayor)',
    grainL0: 'Segment Length (L0)',
    grainN: 'Segment Count (N)',
    grainNp: 'Features Count (Np)',
    grainRhorat: 'Density Ratio (rhorat)',
    grainFaces: 'Burning Faces (EXT / INT / END)',
    grainFinW: 'Fin Width',
    grainSpokeW: 'Spoke Width',
    grainOffset: 'Core Offset',
    grainSlotW: 'Slot Width',
    grainSlotD: 'Slot / Cut Depth',
    grainRodD: 'Rod Diameter',
    mcEmptyMass: 'Empty Rocket Mass (no motor)',
    mcOuterDiam: 'Rocket Outer Diameter',
    mcLaunchAlt: 'Launch Site Altitude (ASL)',
    mcAmbientTemp: 'Ambient Temperature at Pad',
    mcRailAngle: 'Launch Rail Angle (FPA)',
    mcRailLen: 'Launch Rail Length',
    mcWindSpeed: 'Wind Speed at Rail Height',
    mcMainChute: 'Main Chute Diameter / Cd',
    mcDrogueChute: 'Drogue Chute Diameter / Cd',
    mcMainDeployAlt: 'Main Deploy Altitude (AGL)',
    mcAeroCurve: 'Custom Mach vs Cd Curve',
    mcStdCurve: 'Standard Curve',
    mcCustomCurve: 'Active Custom',
  };
}

function buildSummarySheetRows(
  res: SimulationResults,
  L: LocalizedExportLabels,
  simApogee?: ApogeeResult | null
): Record<string, string | number>[] {
  const fNakkaMax = res.F_N.length > 0 ? Math.max(...res.F_N) : 0;
  const activeNakka = res.F_N.filter((_, idx) => (res.mgra_total[idx] ?? 0) > 0);
  const fNakkaAvg =
    activeNakka.length > 0 ? activeNakka.reduce((acc, v) => acc + v, 0) / activeNakka.length : 0;
  const initialMassKg = (res.summary.initial_mass_g ?? (res.mgra_total[0] || 0) * 1000) / 1000;

  const mkRow = (sec: string, metric: string, value: string | number, unit: string) => ({
    [L.colSection]: sec,
    [L.colMetric]: metric,
    [L.colValue]: value,
    [L.colUnit]: unit,
  });

  const rows: Record<string, string | number>[] = [
    mkRow(L.secMotor, L.exportTimestamp, new Date().toISOString(), 'ISO-8601'),
    mkRow(L.secMotor, L.motorClass, res.summary.motorClass, '-'),
    mkRow(L.secMotor, L.totalImpulse, roundNum(res.summary.It_total_N_s, 2), 'N*s'),
    mkRow(L.secMotor, L.specImpulse, roundNum(res.summary.Isp_total_s, 2), 's'),
    mkRow(L.secMotor, L.burnTime, roundNum(res.summary.t_quemado, 4), 's'),
    mkRow(L.secMotor, L.actionTime, roundNum(res.summary.t_fin, 4), 's'),
    mkRow(L.secMotor, L.maxPressure, roundNum(res.summary.Pmax_MPa, 4), 'MPa'),
    mkRow(L.secMotor, L.avgPressure, roundNum(res.summary.Pmed_MPa, 4), 'MPa'),
    mkRow(L.secMotor, L.maxThrustTti, roundNum(res.summary.Fmax_N, 2), 'N'),
    mkRow(L.secMotor, L.avgThrustTti, roundNum(res.summary.Fmed_N, 2), 'N'),
    mkRow(L.secMotor, L.maxThrustRn, roundNum(fNakkaMax, 2), 'N'),
    mkRow(L.secMotor, L.avgThrustRn, roundNum(fNakkaAvg, 2), 'N'),
    mkRow(L.secMotor, L.initPropMass, roundNum(initialMassKg, 4), 'kg'),
    mkRow(L.secMotor, L.maxMassFlow, roundNum(res.summary.mdot_max ?? 0, 5), 'kg/s'),
    mkRow(L.secMotor, L.avgMassFlow, roundNum(res.summary.mdot_avg ?? 0, 5), 'kg/s'),
    mkRow(L.secMotor, L.maxKn, roundNum(res.summary.Kn_max ?? 0, 2), '-'),
    mkRow(L.secMotor, L.avgKn, roundNum(res.summary.Kn_avg ?? 0, 2), '-'),
    mkRow(L.secMotor, L.maxBurnRate, roundNum(res.summary.r_max ?? 0, 3), 'mm/s'),
    mkRow(L.secMotor, L.avgBurnRate, roundNum(res.summary.r_avg ?? 0, 3), 'mm/s'),
  ];

  if (simApogee) {
    rows.push(
      mkRow(L.secFlight, L.predApogeeAgl, roundNum(simApogee.maxApogee, 2), 'm'),
      mkRow(L.secFlight, L.predApogeeAsl, roundNum(simApogee.maxApogee + simApogee.launchAltitudeM, 2), 'm'),
      mkRow(L.secFlight, L.timeToApogee, roundNum(simApogee.apogeeTime, 2), 's'),
      mkRow(L.secFlight, L.maxVelocity, roundNum(simApogee.maxVelocity, 2), 'm/s'),
      mkRow(L.secFlight, L.maxAccel, roundNum(simApogee.maxAcceleration, 2), 'm/s2'),
      mkRow(L.secFlight, L.railExitVel, roundNum(simApogee.railExitVelocity, 2), 'm/s'),
      mkRow(L.secFlight, L.minSafeRailVel, roundNum(simApogee.minRecommendedRailVel, 2), 'm/s'),
      mkRow(L.secFlight, L.railExitAoa, roundNum(simApogee.railExitAngleOfAttackDeg, 2), 'deg'),
      mkRow(L.secFlight, L.recoveryMode, simApogee.recoveryMode, '-'),
      ...(simApogee.descentRateMs !== undefined
        ? [mkRow(L.secFlight, L.touchdownRate, roundNum(simApogee.descentRateMs, 2), 'm/s')]
        : []),
      ...(simApogee.landingTime !== undefined
        ? [mkRow(L.secFlight, L.totalFlightTime, roundNum(simApogee.landingTime, 2), 's')]
        : []),
      ...(simApogee.landingRange !== undefined
        ? [mkRow(L.secFlight, L.landingRange, roundNum(simApogee.landingRange, 1), 'm')]
        : []),
    );
  }

  return rows;
}

function buildInputsSheetRows(
  motor: MotorInput,
  nozzle: NozzleInput,
  grains: GrainInput[],
  customPropellants: CustomPropellant[],
  motorStruct: MotorStructureResult,
  L: LocalizedExportLabels,
  mcSnapshot?: MissionControlSnapshot | null,
  lang: Language = 'en'
): Record<string, string | number>[] {
  const mkRow = (grp: string, param: string, value: string | number, unit: string) => ({
    [L.colGroup]: grp,
    [L.colParameter]: param,
    [L.colValue]: value,
    [L.colUnit]: unit,
  });

  const rows: Record<string, string | number>[] = [
    mkRow(L.grpChamber, L.dcLabel, motor.Dc, 'mm'),
    mkRow(L.grpChamber, L.lcLabel, motor.Lc, 'mm'),
    mkRow(L.grpChamber, L.etacLabel, motor.etac, '-'),
    mkRow(L.grpChamber, L.gstarLabel, motor.Gstar, '-'),
    mkRow(L.grpChamber, L.kvLabel, motor.kv, '-'),
    mkRow(L.grpChamber, L.dtLabel, motor.paso_de_tiempo, 's'),
    mkRow(L.grpChamber, L.pambLabel, motor.Pamb, 'MPa'),
    mkRow(
      L.grpChamber,
      L.linerLabel,
      motor.hasLiner ? `${L.yes} (${motorStruct.linerThicknessMm} mm)` : L.no,
      '-'
    ),
    mkRow(
      L.grpChamber,
      L.inhibitorLabel,
      motor.hasInhibitor ? `${L.yes} (${motorStruct.inhibitorThicknessMm} mm)` : L.no,
      '-'
    ),
    mkRow(L.grpNozzle, L.dt0Label, nozzle.Dt0, 'mm'),
    mkRow(L.grpNozzle, L.dsLabel, nozzle.Ds, 'mm'),
    mkRow(L.grpNozzle, L.expRatioLabel, roundNum(Math.pow(nozzle.Ds / Math.max(1e-6, nozzle.Dt0), 2), 3), '-'),
    mkRow(L.grpNozzle, L.alphaLabel, nozzle.alpha, 'deg'),
    mkRow(L.grpNozzle, L.etanozLabel, nozzle.etanoz, '-'),
    mkRow(L.grpNozzle, L.throatVarLabel, nozzle.e, 'mm'),
    mkRow(L.grpNozzle, L.eroModelLabel, nozzle.ero_model ?? 1, 'ID'),
  ];

  grains.forEach((g, idx) => {
    const prop = getPropellantData(g.propellantType, customPropellants);
    const grp = `${L.grpGrainPrefix}${idx + 1}`;
    rows.push(
      mkRow(grp, L.grainShape, getGrainShapeLabel(g.shape, lang), `ID ${g.shape}`),
      mkRow(grp, L.grainPropellant, prop.name, `ID ${g.propellantType}`),
      mkRow(grp, L.grainD0, g.D0, 'mm'),
      mkRow(grp, L.graind0, g.d0, 'mm'),
      mkRow(grp, L.graind0mayor, g.d0mayor, 'mm'),
      mkRow(grp, L.grainL0, g.L0, 'mm'),
      mkRow(grp, L.grainN, g.N, '-'),
      mkRow(grp, L.grainNp, g.Np, '-'),
      mkRow(grp, L.grainRhorat, g.rhorat, '-'),
      mkRow(grp, L.grainFaces, `${g.osi ? 'ON' : 'INHIB'} / ${g.ci ? 'ON' : 'INHIB'} / ${g.ei ? 'ON' : 'INHIB'}`, '-'),
    );
    if (g.finWidth !== undefined) rows.push(mkRow(grp, L.grainFinW, g.finWidth, 'mm'));
    if (g.spokeWidth !== undefined) rows.push(mkRow(grp, L.grainSpokeW, g.spokeWidth, 'mm'));
    if (g.coreOffset !== undefined) rows.push(mkRow(grp, L.grainOffset, g.coreOffset, 'mm'));
    if (g.slotWidth !== undefined) rows.push(mkRow(grp, L.grainSlotW, g.slotWidth, 'mm'));
    if (g.slotDepth !== undefined) rows.push(mkRow(grp, L.grainSlotD, g.slotDepth, 'mm'));
    if (g.rodDiameter !== undefined) rows.push(mkRow(grp, L.grainRodD, g.rodDiameter, 'mm'));
  });

  if (mcSnapshot?.params) {
    const p = mcSnapshot.params;
    rows.push(
      mkRow(L.grpMc, L.mcEmptyMass, p.emptyRocketMass, 'kg'),
      mkRow(L.grpMc, L.mcOuterDiam, p.rocketDiameter, 'mm'),
      mkRow(L.grpMc, L.mcLaunchAlt, p.launchAltitude, 'm'),
      mkRow(L.grpMc, L.mcAmbientTemp, p.launchTemp, 'C'),
      mkRow(L.grpMc, L.mcRailAngle, p.flightPathAngle, 'deg'),
      mkRow(L.grpMc, L.mcRailLen, p.railLengthM, 'm'),
      mkRow(L.grpMc, L.mcWindSpeed, p.windSpeedMs, 'm/s'),
      mkRow(L.grpMc, L.recoveryMode, p.recoveryMode, '-'),
      mkRow(L.grpMc, L.mcMainChute, `${p.chuteDiameterM} m / ${p.chuteCd}`, '-'),
      ...(p.recoveryMode === 'dual'
        ? [
            mkRow(L.grpMc, L.mcDrogueChute, `${p.drogueDiameterM} m / ${p.drogueCd}`, '-'),
            mkRow(L.grpMc, L.mcMainDeployAlt, p.mainDeployAltM, 'm'),
          ]
        : []),
      mkRow(
        L.grpMc,
        L.mcAeroCurve,
        mcSnapshot.aerodynamics?.useAeroData ? mcSnapshot.aerodynamics.aeroFileName || L.mcCustomCurve : L.mcStdCurve,
        '-'
      ),
    );
  }

  return rows;
}

function buildFlightTrajectoryRows(simApogee: ApogeeResult): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < simApogee.t.length; i++) {
    rows.push({
      'Time (s)': roundNum(simApogee.t[i] || 0, 4),
      'Range_X (m)': roundNum(simApogee.x[i] || 0, 2),
      'Altitude_AGL (m)': roundNum(simApogee.h[i] || 0, 2),
      'Speed (m/s)': roundNum(simApogee.v[i] || 0, 2),
      'Vx (m/s)': roundNum(simApogee.vx[i] || 0, 2),
      'Vy (m/s)': roundNum(simApogee.vy[i] || 0, 2),
      'Accel (m/s2)': roundNum(simApogee.a[i] || 0, 2),
      'Mach (-)': roundNum(simApogee.mach[i] || 0, 4),
      'Pitch (deg)': roundNum(simApogee.gammaDeg[i] || 0, 2),
      Flight_Phase: simApogee.phase?.[i] || 'unknown',
    });
  }
  return rows;
}

function applyColumnWidths(ws: XLSX.WorkSheet, rows: Record<string, any>[]): void {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const sampleLimit = Math.min(rows.length, 40);
  ws['!cols'] = keys.map((key) => {
    let maxLen = key.length;
    for (let i = 0; i < sampleLimit; i++) {
      const val = rows[i][key];
      const str = val === null || val === undefined ? '' : String(val);
      if (str.length > maxLen) maxLen = str.length;
    }
    return { wch: Math.min(44, Math.max(11, maxLen + 3)) };
  });
}

/**
 * Builds an Excel worksheet either vertically ("columns": variables as columns, time steps as rows)
 * or horizontally ("rows": variables in column A, values across columns).
 * Respects Excel's hard 16,384-column limit when orientation is 'rows'.
 */
function buildOrientedSheet<T extends object>(
  rows: T[],
  orientation: ExcelOrientation
): XLSX.WorkSheet {
  if (!rows || rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([]);
  }

  if (orientation === 'columns') {
    const ws = XLSX.utils.json_to_sheet(rows);
    applyColumnWidths(ws, rows as Record<string, any>[]);
    return ws;
  }

  const maxExcelCols = 16380;
  let sampled = rows;
  if (rows.length > maxExcelCols) {
    const stride = Math.ceil(rows.length / maxExcelCols);
    sampled = rows.filter((_, idx) => idx % stride === 0 || idx === rows.length - 1);
  }

  const keys = Object.keys(sampled[0]);
  const aoa: (string | number)[][] = keys.map((key) => [
    key,
    ...sampled.map((r) => {
      const val = (r as Record<string, any>)[key];
      return val === undefined || val === null ? '' : val;
    }),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const firstColMax = Math.max(16, ...keys.map((k) => k.length + 3));
  ws['!cols'] = [{ wch: Math.min(40, firstColMax) }];
  return ws;
}

function sanitizeExportName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\.(csv|xlsx|pdf)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.+$/, '')
    .trim();
  return cleaned || 'HERMES_Results';
}

export function serializeRowsToCsv<T extends object>(
  rows: T[],
  decimalSeparator: CsvDecimalSeparator = 'dot'
): string {
  if (!rows || rows.length === 0) return '';
  const colDelim = decimalSeparator === 'comma' ? ';' : ',';
  const keys = Object.keys(rows[0]);

  const formatCell = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'number') {
      const str = Number.isFinite(val) ? String(val) : '0';
      return decimalSeparator === 'comma' ? str.replace('.', ',') : str;
    }
    const text = String(val);
    if (text.includes(colDelim) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines: string[] = [keys.map((k) => formatCell(k)).join(colDelim)];
  for (const row of rows) {
    lines.push(keys.map((k) => formatCell((row as Record<string, any>)[k])).join(colDelim));
  }
  return lines.join('\n');
}

function appendOrientedSheets<T extends object>(
  wb: XLSX.WorkBook,
  baseSheetName: string,
  rows: T[],
  orientation: ExcelOrientation
): void {
  if (!rows || rows.length === 0 || orientation === 'columns') {
    const ws = buildOrientedSheet(rows, orientation);
    XLSX.utils.book_append_sheet(wb, ws, baseSheetName.slice(0, 31));
    return;
  }

  const maxExcelCols = 16380;
  if (rows.length <= maxExcelCols) {
    const ws = buildOrientedSheet(rows, 'rows');
    XLSX.utils.book_append_sheet(wb, ws, baseSheetName.slice(0, 31));
    return;
  }

  const keys = Object.keys(rows[0] as Record<string, any>);
  const firstColMax = Math.max(16, ...keys.map((k) => k.length + 3));
  let part = 1;
  for (let start = 0; start < rows.length; start += maxExcelCols) {
    const chunk = rows.slice(start, start + maxExcelCols);
    const aoa: (string | number)[][] = keys.map((key) => [
      key,
      ...chunk.map((r) => {
        const val = (r as Record<string, any>)[key];
        return val === undefined || val === null ? '' : val;
      }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: Math.min(40, firstColMax) }];
    const suffix = part === 1 ? '' : `_${part}`;
    const sheetTitle = `${baseSheetName.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    part++;
  }
}

export function buildSimulationWorkbook(args: ExportSimulationPackageArgs): XLSX.WorkBook {
  const lang = args.lang || 'en';
  const orientation = args.orientation || 'columns';
  const L = getLocalizedExportLabels(lang);
  const wb = XLSX.utils.book_new();

  // 1. Time_Series
  const timeRows = buildGncTimeSeriesRows(args.results);
  appendOrientedSheets(wb, L.sheetTime, timeRows, orientation);

  // 2. Summary
  const summaryRows = buildSummarySheetRows(args.results, L, args.simApogee);
  appendOrientedSheets(wb, L.sheetSummary, summaryRows, orientation);

  // 3. Inputs
  const inputRows = buildInputsSheetRows(
    args.motor,
    args.nozzle,
    args.grains,
    args.customPropellants,
    args.motorStruct,
    L,
    args.mcSnapshot,
    lang
  );
  appendOrientedSheets(wb, L.sheetInputs, inputRows, orientation);

  // 4. Flight_Trajectory (conditional)
  if (args.simApogee && args.simApogee.t.length > 0) {
    const flightRows = buildFlightTrajectoryRows(args.simApogee);
    appendOrientedSheets(wb, L.sheetFlight, flightRows, orientation);
  }

  return wb;
}

function triggerBlobDownload(blob: Blob, downloadFilename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportSimulationCsv(
  results: SimulationResults,
  filename: string,
  decimalSeparator: CsvDecimalSeparator = 'dot'
): void {
  const rows = buildGncTimeSeriesRows(results);
  const csv = serializeRowsToCsv(rows, decimalSeparator);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `${sanitizeExportName(filename)}.csv`);
}

export function exportSimulationXlsx(args: ExportSimulationPackageArgs): void {
  const wb = buildSimulationWorkbook(args);
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, `${sanitizeExportName(args.filename)}.xlsx`);
}
