import { jsPDF } from 'jspdf';
import coheterosLogoUrl from '../assets/coheteros_logo.png';
import {
  CustomPropellant,
  GrainInput,
  MotorInput,
  NozzleInput,
  SimulationResults,
  getPropellantData,
} from './types';
import { MotorStructureResult, getMaxGrainOuterDiameter } from './motorStructure';
import { ApogeeResult } from './apogee';
import { MissionControlSnapshot } from './missionControlStorage';
import { GrainContourLoop, getGrainModule, hasCrossSectionContours } from './grains';
import { getGrainShapeLabel } from './grains/labels';
import { Language } from './i18n';

export interface PdfReportOptions {
  reportTitle?: string;
  filename: string;
  results: SimulationResults;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  motorStruct: MotorStructureResult;
  simApogee?: ApogeeResult | null;
  mcSnapshot?: MissionControlSnapshot | null;
  includeMissionControl?: boolean;
  lang?: Language;
}

export interface LoadedImageAsset {
  dataUrl: string;
  width: number;
  height: number;
}

interface PdfLabels {
  reportHeader: string;
  defaultTitlePrefix: string;
  classWord: string;
  docControlPrefix: string;
  exportedLabel: string;
  pageWord: string;
  ofWord: string;
  footerDept: string;
  execSummaryTitle: string;
  inputsSectionTitle: string;
  chamberInputsTitle: string;
  nozzleInputsTitle: string;
  schematicSectionTitle: string;
  chamberSchematicCaption: string;
  grainsSectionTitle: string;
  contSuffix: string;
  chartsSectionTitle: string;
  flightSectionTitle: string;
  // KPI cards
  motorClass: string;
  totalImpulse: string;
  specImpulse: string;
  burnActionTime: string;
  maxPressure: string;
  avgPressure: string;
  maxThrustTti: string;
  avgThrustTti: string;
  maxThrustRn: string;
  propellantMass: string;
  maxMassFlow: string;
  maxKnBurnRate: string;
  // Chamber & Nozzle input table keys
  rowDc: string;
  rowLc: string;
  rowEtac: string;
  rowGstar: string;
  rowKv: string;
  rowDt: string;
  rowPamb: string;
  rowLiner: string;
  rowInhibitor: string;
  rowDt0: string;
  rowDs: string;
  rowExpRatio: string;
  rowAlpha: string;
  rowEtanoz: string;
  rowThroatVar: string;
  rowErosionModel: string;
  enabledWord: string;
  disabledWord: string;
  noAblationWord: string;
  modelWord: string;
  // Schematic legend
  legCasing: string;
  legLiner: string;
  legInhibitor: string;
  legPropellant: string;
  // Grain cards
  grainWord: string;
  propellantWord: string;
  shapeParamsRow: string;
  webRhoratRow: string;
  burnFacesRow: string;
  propThermoRow: string;
  stRobertRow: string;
  zonesWord: string;
  burnLegend: string;
  inhibLegend: string;
  onWord: string;
  inhibShort: string;
  // Charts & axes
  pressureChartTitle: string;
  thrustChartTitle: string;
  massFlowChartTitle: string;
  altitudeChartTitleFull: string;
  altitudeChartTitleAscent: string;
  xAxisTime: string;
  xAxisMissionTime: string;
  yAxisPressure: string;
  yAxisThrust: string;
  yAxisMass: string;
  yAxisMassFlow: string;
  yAxisAltitude: string;
  seriesP0Gage: string;
  seriesThrustTti: string;
  seriesThrustRn: string;
  seriesMprop: string;
  seriesMdotGen: string;
  seriesMdotNoz: string;
  seriesAltitude: string;
  apogeeAnnotationWord: string;
  // Mission control section
  mcTableLeft: string;
  mcTableRight: string;
  mcApogeeAgl: string;
  mcApogeeAsl: string;
  mcTimeToApogee: string;
  mcMaxVel: string;
  mcMaxMach: string;
  mcMaxAccel: string;
  mcRailAngle: string;
  mcRailExitVel: string;
  mcWindAoa: string;
  mcRecoveryMode: string;
  mcChutesConfig: string;
  mcTouchdownTime: string;
  mcModeNone: string;
  mcModeSingle: string;
  mcModeDual: string;
  mcBallisticDesc: string;
  mcMainDescPrefix: string;
  mcDrogueDescPrefix: string;
}

function getPdfLabels(lang: Language): PdfLabels {
  if (lang === 'es') {
    return {
      reportHeader: 'INFORME TÉCNICO DE SIMULACIÓN DE MOTOR COHETE',
      defaultTitlePrefix: 'Motor',
      classWord: 'Clase',
      docControlPrefix: 'REF DOC',
      exportedLabel: 'Fecha exportación',
      pageWord: 'Página',
      ofWord: 'de',
      footerDept: 'Departamento de Propulsión COHETEROS',
      execSummaryTitle: '1. RESUMEN EJECUTIVO Y RESULTADOS PRINCIPALES',
      inputsSectionTitle: '2. PARÁMETROS DE ENTRADA DE DISEÑO',
      chamberInputsTitle: 'Cámara de Combustión y Protección Térmica',
      nozzleInputsTitle: 'Tobera de Laval y Variación de Garganta',
      schematicSectionTitle: '3. ESQUEMA LONGITUDINAL 2D DE CÁMARA Y GRANOS',
      chamberSchematicCaption: 'Corte longitudinal 2D de conjunto (cámara, cierres, liner térmico, inhibidor, granos y tobera)',
      grainsSectionTitle: 'Geometría y Propelente de Granos Seleccionados',
      contSuffix: 'cont.',
      chartsSectionTitle: '4. CURVAS BALÍSTICAS Y CONSUMO DE PROPELENTE',
      flightSectionTitle: '5. CONTROL DE MISIÓN: TRAYECTORIA, RAMPA Y RECUPERACIÓN',
      motorClass: 'Clase de Motor',
      totalImpulse: 'Impulso Total (It)',
      specImpulse: 'Impulso Específico (Isp)',
      burnActionTime: 'T. Quemado / Acción',
      maxPressure: 'Presión Máx. (Pmax)',
      avgPressure: 'Presión Media (Pmed)',
      maxThrustTti: 'Empuje Máx. (TTI)',
      avgThrustTti: 'Empuje Medio (TTI)',
      maxThrustRn: 'Empuje Máx. (Nakka)',
      propellantMass: 'Masa Propelente',
      maxMassFlow: 'Gasto Másico Máx.',
      maxKnBurnRate: 'Kn Máx / Vel. Quemado',
      rowDc: 'Diámetro Interno Cámara (Dc)',
      rowLc: 'Longitud de Cámara (Lc)',
      rowEtac: 'Eficiencia de Combustión (etac)',
      rowGstar: 'Umbral Erosivo G*',
      rowKv: 'Coeficiente Erosivo (kv)',
      rowDt: 'Paso de Tiempo (dt)',
      rowPamb: 'Presión Ambiental (Pamb)',
      rowLiner: 'Liner Térmico Interior',
      rowInhibitor: 'Inhibidor Exterior de Grano',
      rowDt0: 'Diámetro Garganta Inicial (Dt0)',
      rowDs: 'Diámetro de Salida (Ds)',
      rowExpRatio: 'Relación de Expansión (Ae / At)',
      rowAlpha: 'Semi-ángulo Divergente (alpha)',
      rowEtanoz: 'Eficiencia de Tobera (etanoz)',
      rowThroatVar: 'Variación de Garganta (e)',
      rowErosionModel: 'Modelo de Ablación / Escoria',
      enabledWord: 'Activado',
      disabledWord: 'Desactivado',
      noAblationWord: 'Ideal / Sin ablación',
      modelWord: 'Modelo',
      legCasing: 'Cámara',
      legLiner: 'Liner',
      legInhibitor: 'Inhibidor',
      legPropellant: 'Propelente',
      grainWord: 'Grano',
      propellantWord: 'Propelente',
      shapeParamsRow: 'Parámetros Forma',
      webRhoratRow: 'Espesor Web / rhorat',
      burnFacesRow: 'Caras (EXT / INT / EXT.)',
      propThermoRow: 'Termo. (rho / T0 / k / M)',
      stRobertRow: 'Ley St. Robert (a, n)',
      zonesWord: 'zonas',
      burnLegend: 'Quema',
      inhibLegend: 'Inhibido',
      onWord: 'SÍ',
      inhibShort: 'INHIB',
      pressureChartTitle: 'Presión Manométrica en Cámara vs Tiempo',
      thrustChartTitle: 'Empuje vs Tiempo (Ideal TTI vs Richard Nakka)',
      massFlowChartTitle: 'Masa de Propelente (mprop) y Gasto Másico vs Tiempo',
      altitudeChartTitleFull: 'Perfil de Altitud AGL vs Tiempo (Ascenso y Recuperación)',
      altitudeChartTitleAscent: 'Perfil de Altitud AGL vs Tiempo (Ascenso hasta Apogeo)',
      xAxisTime: 'Tiempo [s]',
      xAxisMissionTime: 'Tiempo de Vuelo [s]',
      yAxisPressure: 'Presión Manométrica [MPa]',
      yAxisThrust: 'Empuje [N]',
      yAxisMass: 'Masa de Propelente mprop [kg]',
      yAxisMassFlow: 'Gasto Másico mdot [kg/s]',
      yAxisAltitude: 'Altitud AGL [m]',
      seriesP0Gage: 'P0_man (MPa)',
      seriesThrustTti: 'Empuje TTI (N)',
      seriesThrustRn: 'Empuje R. Nakka (N)',
      seriesMprop: 'mprop (kg)',
      seriesMdotGen: 'mdot_gen (kg/s)',
      seriesMdotNoz: 'mdot_noz (kg/s)',
      seriesAltitude: 'Altitud AGL (m)',
      apogeeAnnotationWord: 'Apogeo',
      mcTableLeft: 'Rendimiento de Vuelo y Cinemática',
      mcTableRight: 'Rampa de Lanzamiento y Recuperación',
      mcApogeeAgl: 'Apogeo Previsto (AGL)',
      mcApogeeAsl: 'Apogeo Previsto (ASL)',
      mcTimeToApogee: 'Tiempo hasta el Apogeo',
      mcMaxVel: 'Velocidad Máxima',
      mcMaxMach: 'Número de Mach Máximo',
      mcMaxAccel: 'Aceleración Máxima',
      mcRailAngle: 'Longitud Rampa / Ángulo',
      mcRailExitVel: 'Vel. Salida Rampa (Mín. Seg.)',
      mcWindAoa: 'Viento en Rampa / AoA Salida',
      mcRecoveryMode: 'Modo de Recuperación',
      mcChutesConfig: 'Configuración Paracaídas',
      mcTouchdownTime: 'Tasa Descenso / Tiempo Total',
      mcModeNone: 'SOLO ASCENSO (SIN PARACAÍDAS)',
      mcModeSingle: 'PRINCIPAL EN APOGEO',
      mcModeDual: 'DROGUE + PRINCIPAL',
      mcBallisticDesc: 'Sin paracaídas (hasta apogeo)',
      mcMainDescPrefix: 'Principal',
      mcDrogueDescPrefix: 'Drogue',
    };
  }
  if (lang === 'fr') {
    return {
      reportHeader: 'RAPPORT TECHNIQUE DE SIMULATION PROPULSEUR SOLIDE',
      defaultTitlePrefix: 'Moteur',
      classWord: 'Classe',
      docControlPrefix: 'RÉF DOC',
      exportedLabel: "Date d'exportation",
      pageWord: 'Page',
      ofWord: 'sur',
      footerDept: 'Département Propulsion COHETEROS',
      execSummaryTitle: '1. SYNTHÈSE EXÉCUTIVE ET PERFORMANCES PRINCIPALES',
      inputsSectionTitle: "2. PARAMÈTRES D'ENTRÉE DE CONCEPTION",
      chamberInputsTitle: 'Chambre de Combustion & Protection Thermique',
      nozzleInputsTitle: 'Tuyère de Laval & Variation du Col',
      schematicSectionTitle: '3. SCHÉMA LONGITUDINAL 2D DE CHAMBRE ET GRAINS',
      chamberSchematicCaption: 'Coupe longitudinale 2D (chambre, fonds, liner thermique, inhibiteur, blocs et tuyère)',
      grainsSectionTitle: 'Géométrie & Propergol des Grains Sélectionnés',
      contSuffix: 'suite',
      chartsSectionTitle: '4. COURBES BALISTIQUES ET CONSOMMATION PROPERGOL',
      flightSectionTitle: '5. CONTRÔLE DE MISSION : TRAJECTOIRE, RAMPE & RÉCUPÉRATION',
      motorClass: 'Classe Moteur',
      totalImpulse: 'Impulsion Totale (It)',
      specImpulse: 'Impulsion Spéc. (Isp)',
      burnActionTime: 'Temps Comb. / Action',
      maxPressure: 'Pression Max (Pmax)',
      avgPressure: 'Pression Moy. (Pmoy)',
      maxThrustTti: 'Poussée Max (TTI)',
      avgThrustTti: 'Poussée Moy. (TTI)',
      maxThrustRn: 'Poussée Max (Nakka)',
      propellantMass: 'Masse Propergol',
      maxMassFlow: 'Débit Massique Max',
      maxKnBurnRate: 'Kn Max / Vitesse Comb.',
      rowDc: 'Diamètre Interne Chambre (Dc)',
      rowLc: 'Longueur Chambre (Lc)',
      rowEtac: 'Rendement Combustion (etac)',
      rowGstar: 'Seuil Érosif G*',
      rowKv: 'Coefficient Érosif (kv)',
      rowDt: 'Pas de Temps (dt)',
      rowPamb: 'Pression Ambiante (Pamb)',
      rowLiner: 'Liner Thermique Interne',
      rowInhibitor: 'Inhibiteur Externe de Grain',
      rowDt0: 'Diamètre Col Initial (Dt0)',
      rowDs: 'Diamètre de Sortie (Ds)',
      rowExpRatio: "Rapport d'Expansion (Ae / At)",
      rowAlpha: 'Demi-angle Divergent (alpha)',
      rowEtanoz: 'Rendement Tuyère (etanoz)',
      rowThroatVar: 'Variation du Col (e)',
      rowErosionModel: 'Modèle Ablation / Scorie',
      enabledWord: 'Activé',
      disabledWord: 'Désactivé',
      noAblationWord: 'Idéal / Sans ablation',
      modelWord: 'Modèle',
      legCasing: 'Chambre',
      legLiner: 'Liner',
      legInhibitor: 'Inhibiteur',
      legPropellant: 'Propergol',
      grainWord: 'Grain',
      propellantWord: 'Propergol',
      shapeParamsRow: 'Paramètres Forme',
      webRhoratRow: 'Épaisseur Web / rhorat',
      burnFacesRow: 'Faces (EXT / INT / BOUTS)',
      propThermoRow: 'Thermo. (rho / T0 / k / M)',
      stRobertRow: 'Loi St. Robert (a, n)',
      zonesWord: 'zones',
      burnLegend: 'Combustion',
      inhibLegend: 'Inhibé',
      onWord: 'OUI',
      inhibShort: 'INHIB',
      pressureChartTitle: 'Pression Relative Chambre vs Temps',
      thrustChartTitle: 'Poussée vs Temps (TTI Idéal vs Richard Nakka)',
      massFlowChartTitle: 'Masse Propergol (mprop) & Débits Massiques vs Temps',
      altitudeChartTitleFull: "Profil d'Altitude AGL vs Temps (Vol & Récupération)",
      altitudeChartTitleAscent: "Profil d'Altitude AGL vs Temps (Montée jusqu'à l'Apogée)",
      xAxisTime: 'Temps [s]',
      xAxisMissionTime: 'Temps de Vol [s]',
      yAxisPressure: 'Pression Relative [MPa]',
      yAxisThrust: 'Poussée [N]',
      yAxisMass: 'Masse Propergol mprop [kg]',
      yAxisMassFlow: 'Débit Massique mdot [kg/s]',
      yAxisAltitude: 'Altitude AGL [m]',
      seriesP0Gage: 'P0_rel (MPa)',
      seriesThrustTti: 'Poussée TTI (N)',
      seriesThrustRn: 'Poussée R. Nakka (N)',
      seriesMprop: 'mprop (kg)',
      seriesMdotGen: 'mdot_gen (kg/s)',
      seriesMdotNoz: 'mdot_noz (kg/s)',
      seriesAltitude: 'Altitude AGL (m)',
      apogeeAnnotationWord: 'Apogée',
      mcTableLeft: 'Performance de Vol & Cinématique',
      mcTableRight: 'Rampe de Lancement & Récupération',
      mcApogeeAgl: 'Apogée Prévu (AGL)',
      mcApogeeAsl: 'Apogée Prévu (ASL)',
      mcTimeToApogee: "Temps à l'Apogée",
      mcMaxVel: 'Vitesse Maximale',
      mcMaxMach: 'Nombre de Mach Max',
      mcMaxAccel: 'Accélération Maximale',
      mcRailAngle: 'Longueur Rampe / Angle',
      mcRailExitVel: 'Vit. Sortie Rampe (Min Sûr)',
      mcWindAoa: 'Vent Rampe / AoA Sortie',
      mcRecoveryMode: 'Mode Récupération',
      mcChutesConfig: 'Config. Parachutes',
      mcTouchdownTime: 'Vitesse Descente / Temps Total',
      mcModeNone: 'MONTÉE SEULE (SANS PARACHUTE)',
      mcModeSingle: 'PRINCIPAL À L’APOGÉE',
      mcModeDual: 'DROGUE + PRINCIPAL',
      mcBallisticDesc: "Sans parachute (jusqu'à apogée)",
      mcMainDescPrefix: 'Principal',
      mcDrogueDescPrefix: 'Drogue',
    };
  }
  if (lang === 'it') {
    return {
      reportHeader: 'RAPPORTO TECNICO DI SIMULAZIONE ENDOREATTORE SOLIDO',
      defaultTitlePrefix: 'Motore',
      classWord: 'Classe',
      docControlPrefix: 'RIF DOC',
      exportedLabel: 'Data esportazione',
      pageWord: 'Pagina',
      ofWord: 'di',
      footerDept: 'Dipartimento Propulsione COHETEROS',
      execSummaryTitle: '1. SINTESI ESECUTIVA E RISULTATI PRINCIPALI',
      inputsSectionTitle: '2. PARAMETRI DI INGRESSO DI PROGETTO',
      chamberInputsTitle: 'Camera di Combustione e Protezione Termica',
      nozzleInputsTitle: 'Ugello de Laval e Variazione Gola',
      schematicSectionTitle: '3. SCHEMA LONGITUDINALE 2D DI CAMERA E GRANI',
      chamberSchematicCaption: 'Sezione longitudinale 2D (camera, chiusure, liner termico, inibitore, grani e ugello)',
      grainsSectionTitle: 'Geometria e Propellente dei Grani Selezionati',
      contSuffix: 'cont.',
      chartsSectionTitle: '4. CURVE BALISTICHE E CONSUMO PROPELLENTE',
      flightSectionTitle: '5. CONTROLLO MISSIONE: TRAIETTORIA, RAMPA E RECUPERO',
      motorClass: 'Classe Motore',
      totalImpulse: 'Impulso Totale (It)',
      specImpulse: 'Impulso Spec. (Isp)',
      burnActionTime: 'Tempo Comb. / Azione',
      maxPressure: 'Pressione Max (Pmax)',
      avgPressure: 'Pressione Media (Pmed)',
      maxThrustTti: 'Spinta Max (TTI)',
      avgThrustTti: 'Spinta Media (TTI)',
      maxThrustRn: 'Spinta Max (Nakka)',
      propellantMass: 'Massa Propellente',
      maxMassFlow: 'Flusso di Massa Max',
      maxKnBurnRate: 'Kn Max / Vel. Comb.',
      rowDc: 'Diametro Interno Camera (Dc)',
      rowLc: 'Lunghezza Camera (Lc)',
      rowEtac: 'Efficienza Combustione (etac)',
      rowGstar: 'Soglia Erosiva G*',
      rowKv: 'Coefficiente Erosivo (kv)',
      rowDt: 'Passo Temporale (dt)',
      rowPamb: 'Pressione Ambientale (Pamb)',
      rowLiner: 'Liner Termico Interno',
      rowInhibitor: 'Inibitore Esterno Grano',
      rowDt0: 'Diametro Gola Iniziale (Dt0)',
      rowDs: 'Diametro Uscita (Ds)',
      rowExpRatio: 'Rapporto Espansione (Ae / At)',
      rowAlpha: 'Semi-angolo Divergente (alpha)',
      rowEtanoz: 'Efficienza Ugello (etanoz)',
      rowThroatVar: 'Variazione Gola (e)',
      rowErosionModel: 'Modello Ablazione / Scoria',
      enabledWord: 'Attivo',
      disabledWord: 'Disattivo',
      noAblationWord: 'Ideale / Senza ablazione',
      modelWord: 'Modello',
      legCasing: 'Camera',
      legLiner: 'Liner',
      legInhibitor: 'Inibitore',
      legPropellant: 'Propellente',
      grainWord: 'Grano',
      propellantWord: 'Propellente',
      shapeParamsRow: 'Parametri Forma',
      webRhoratRow: 'Spessore Web / rhorat',
      burnFacesRow: 'Facce (EST / INT / EST.)',
      propThermoRow: 'Termo. (rho / T0 / k / M)',
      stRobertRow: 'Legge St. Robert (a, n)',
      zonesWord: 'zone',
      burnLegend: 'Comb.',
      inhibLegend: 'Inibito',
      onWord: 'SÌ',
      inhibShort: 'INIB',
      pressureChartTitle: 'Pressione Relativa Camera vs Tempo',
      thrustChartTitle: 'Spinta vs Tempo (TTI Ideale vs Richard Nakka)',
      massFlowChartTitle: 'Massa Propellente (mprop) e Flussi di Massa vs Tempo',
      altitudeChartTitleFull: 'Profilo Altitudine AGL vs Tempo (Volo e Recupero)',
      altitudeChartTitleAscent: 'Profilo Altitudine AGL vs Tempo (Salita fino ad Apogeo)',
      xAxisTime: 'Tempo [s]',
      xAxisMissionTime: 'Tempo di Volo [s]',
      yAxisPressure: 'Pressione Relativa [MPa]',
      yAxisThrust: 'Spinta [N]',
      yAxisMass: 'Massa Propellente mprop [kg]',
      yAxisMassFlow: 'Flusso di Massa mdot [kg/s]',
      yAxisAltitude: 'Altitudine AGL [m]',
      seriesP0Gage: 'P0_rel (MPa)',
      seriesThrustTti: 'Spinta TTI (N)',
      seriesThrustRn: 'Spinta R. Nakka (N)',
      seriesMprop: 'mprop (kg)',
      seriesMdotGen: 'mdot_gen (kg/s)',
      seriesMdotNoz: 'mdot_noz (kg/s)',
      seriesAltitude: 'Altitudine AGL (m)',
      apogeeAnnotationWord: 'Apogeo',
      mcTableLeft: 'Prestazioni di Volo e Cinematica',
      mcTableRight: 'Rampa di Lancio e Recupero',
      mcApogeeAgl: 'Apogeo Previsto (AGL)',
      mcApogeeAsl: 'Apogeo Previsto (ASL)',
      mcTimeToApogee: "Tempo all'Apogeo",
      mcMaxVel: 'Velocità Massima',
      mcMaxMach: 'Numero di Mach Max',
      mcMaxAccel: 'Accelerazione Massima',
      mcRailAngle: 'Lunghezza Rampa / Angolo',
      mcRailExitVel: 'Vel. Uscita Rampa (Min Sic.)',
      mcWindAoa: 'Vento Rampa / AoA Uscita',
      mcRecoveryMode: 'Modalità Recupero',
      mcChutesConfig: 'Config. Paracadute',
      mcTouchdownTime: 'Velocità Discesa / Tempo Tot.',
      mcModeNone: 'SOLO SALITA (SENZA PARACADUTE)',
      mcModeSingle: 'PRINCIPALE ALL’APOGEO',
      mcModeDual: 'DROGUE + PRINCIPALE',
      mcBallisticDesc: "Senza paracadute (fino ad apogeo)",
      mcMainDescPrefix: 'Principale',
      mcDrogueDescPrefix: 'Drogue',
    };
  }
  return {
    reportHeader: 'SOLID ROCKET MOTOR TECHNICAL SIMULATION REPORT',
    defaultTitlePrefix: 'Motor',
    classWord: 'Class',
    docControlPrefix: 'DOC REF',
    exportedLabel: 'Export Date',
    pageWord: 'Page',
    ofWord: 'of',
    footerDept: 'COHETEROS Propulsion Department',
    execSummaryTitle: '1. EXECUTIVE SUMMARY & KEY PERFORMANCE RESULTS',
    inputsSectionTitle: '2. DESIGN INPUT CONFIGURATION',
    chamberInputsTitle: 'Combustion Chamber & Thermal Protection',
    nozzleInputsTitle: 'De Laval Nozzle & Throat Variation',
    schematicSectionTitle: '3. 2D CHAMBER LONGITUDINAL SCHEMATIC & PROPELLANT GRAINS',
    chamberSchematicCaption: '2D Longitudinal Assembly (chamber, closures/O-rings, liner, outer inhibitor, grain blocks, nozzle)',
    grainsSectionTitle: 'Selected Propellant Grain Geometries & Specifications',
    contSuffix: 'cont.',
    chartsSectionTitle: '4. BALLISTIC PERFORMANCE & PROPELLANT CONSUMPTION CURVES',
    flightSectionTitle: '5. MISSION CONTROL: TRAJECTORY, LAUNCH RAIL & RECOVERY',
    motorClass: 'Motor Class',
    totalImpulse: 'Total Impulse (It)',
    specImpulse: 'Specific Impulse (Isp)',
    burnActionTime: 'Burn / Action Time',
    maxPressure: 'Peak Pressure (Pmax)',
    avgPressure: 'Avg Pressure (Pavg)',
    maxThrustTti: 'Peak Thrust (TTI)',
    avgThrustTti: 'Avg Thrust (TTI)',
    maxThrustRn: 'Peak Thrust (Nakka)',
    propellantMass: 'Propellant Mass',
    maxMassFlow: 'Peak Mass Flow',
    maxKnBurnRate: 'Max Kn / Burn Rate',
    rowDc: 'Chamber Inner Diameter (Dc)',
    rowLc: 'Chamber Length (Lc)',
    rowEtac: 'Combustion Efficiency (etac)',
    rowGstar: 'Erosive Threshold G*',
    rowKv: 'Erosive Factor (kv)',
    rowDt: 'Time Step (dt)',
    rowPamb: 'Ambient Pressure (Pamb)',
    rowLiner: 'Internal Thermal Liner',
    rowInhibitor: 'Outer Grain Inhibitor',
    rowDt0: 'Initial Throat Diameter (Dt0)',
    rowDs: 'Exit Diameter (Ds)',
    rowExpRatio: 'Expansion Ratio (Ae / At)',
    rowAlpha: 'Divergence Half-Angle (alpha)',
    rowEtanoz: 'Nozzle Efficiency (etanoz)',
    rowThroatVar: 'Throat Variation (e)',
    rowErosionModel: 'Ablation / Slag Model',
    enabledWord: 'Enabled',
    disabledWord: 'Disabled',
    noAblationWord: 'Ideal / No Ablation',
    modelWord: 'Model',
    legCasing: 'Chamber',
    legLiner: 'Liner',
    legInhibitor: 'Inhibitor',
    legPropellant: 'Propellant',
    grainWord: 'Grain',
    propellantWord: 'Propellant',
    shapeParamsRow: 'Shape Params',
    webRhoratRow: 'Web (tweb0) / rhorat',
    burnFacesRow: 'Burn Faces (EXT/INT/END)',
    propThermoRow: 'Prop. Thermo (rho/T0/k/M)',
    stRobertRow: 'St. Robert (a, n)',
    zonesWord: 'zones',
    burnLegend: 'Burn',
    inhibLegend: 'Inhib',
    onWord: 'ON',
    inhibShort: 'INHIB',
    pressureChartTitle: 'Chamber Gauge Pressure vs Time',
    thrustChartTitle: 'Thrust vs Time (Ideal TTI vs Richard Nakka)',
    massFlowChartTitle: 'Propellant Mass (mprop) & Mass Flow Rates vs Time',
    altitudeChartTitleFull: 'Altitude AGL vs Time (Ascent & Recovery Profile)',
    altitudeChartTitleAscent: 'Altitude AGL vs Time (Ascent to Apogee)',
    xAxisTime: 'Time [s]',
    xAxisMissionTime: 'Mission Elapsed Time [s]',
    yAxisPressure: 'Gauge Pressure [MPa]',
    yAxisThrust: 'Thrust [N]',
    yAxisMass: 'Propellant Mass mprop [kg]',
    yAxisMassFlow: 'Mass Flow mdot [kg/s]',
    yAxisAltitude: 'Altitude AGL [m]',
    seriesP0Gage: 'P0_gage (MPa)',
    seriesThrustTti: 'Thrust TTI (N)',
    seriesThrustRn: 'Thrust R. Nakka (N)',
    seriesMprop: 'mprop (kg)',
    seriesMdotGen: 'mdot_gen (kg/s)',
    seriesMdotNoz: 'mdot_noz (kg/s)',
    seriesAltitude: 'Altitude AGL (m)',
    apogeeAnnotationWord: 'Apogee',
    mcTableLeft: 'Flight Performance & Kinematics',
    mcTableRight: 'Launch Rail & Recovery System',
    mcApogeeAgl: 'Predicted Apogee (AGL)',
    mcApogeeAsl: 'Predicted Apogee (ASL)',
    mcTimeToApogee: 'Time to Apogee',
    mcMaxVel: 'Max Velocity',
    mcMaxMach: 'Max Mach Number',
    mcMaxAccel: 'Max Acceleration',
    mcRailAngle: 'Rail Length / Launch Angle',
    mcRailExitVel: 'Rail Exit Vel. (Min Safe)',
    mcWindAoa: 'Wind @ Rail / Exit AoA',
    mcRecoveryMode: 'Recovery Mode',
    mcChutesConfig: 'Chutes Config',
    mcTouchdownTime: 'Touchdown Rate / Total Time',
    mcModeNone: 'ASCENT ONLY (NO PARACHUTE)',
    mcModeSingle: 'MAIN AT APOGEE',
    mcModeDual: 'DROGUE + MAIN',
    mcBallisticDesc: 'No parachute (stops at apogee)',
    mcMainDescPrefix: 'Main',
    mcDrogueDescPrefix: 'Drogue',
  };
}

/**
 * Keeps text WinAnsi-compatible for jsPDF built-in fonts while preserving
 * accented Latin characters (á, é, í, ó, ú, ñ, à, è, ù, ç, °).
 */
export function sanitizePdfText(text: string): string {
  return String(text ?? '')
    .replace(/σ_?y/g, 'Sy')
    .replace(/σ/g, 'S')
    .replace(/ρ/g, 'rho')
    .replace(/η_?c/g, 'eta_c')
    .replace(/η_?noz/g, 'eta_noz')
    .replace(/η/g, 'eta')
    .replace(/α/g, 'alpha')
    .replace(/Δ/g, 'd')
    .replace(/Σ/g, 'Sum ')
    .replace(/ṁ/g, 'm_dot')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/∅|Ø/g, 'D ')
    .replace(/≈/g, '~')
    .replace(/•/g, '·');
}

export function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * Loads the official COHETEROS logo PNG cleanly onto an offscreen canvas
 * and returns its crisp data URL plus natural aspect ratio.
 */
export async function loadCoheterosLogoAsset(): Promise<LoadedImageAsset | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w <= 0 || h <= 0) {
        resolve(null);
        return;
      }
      const c = createCanvas(w, h);
      if (!c) {
        resolve(null);
        return;
      }
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve({
        dataUrl: c.toDataURL('image/png'),
        width: w,
        height: h,
      });
    };
    img.onerror = () => resolve(null);
    img.src = coheterosLogoUrl;
  });
}

function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#475569',
  lineWidth = 2.2
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 9;
  const drawHead = (px: number, py: number, ang: number) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - head * Math.cos(ang - 0.42), py - head * Math.sin(ang - 0.42));
    ctx.lineTo(px - head * Math.cos(ang + 0.42), py - head * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
  };
  drawHead(x2, y2, angle);
  drawHead(x1, y1, angle + Math.PI);
  ctx.restore();
}

/** Renders crisp light-mode 2D chamber longitudinal CAD schematic without material/Padm labels */
function renderChamberSchematicDataUrl(
  motor: MotorInput,
  grains: GrainInput[],
  nozzle: NozzleInput,
  motorStruct: MotorStructureResult,
  labels: PdfLabels
): string | null {
  const W = 2100;
  const H = 560;
  const c = createCanvas(W, H);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < W; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 8);
    ctx.lineTo(gx, H - 8);
    ctx.stroke();
  }
  for (let gy = 40; gy < H; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(8, gy);
    ctx.lineTo(W - 8, gy);
    ctx.stroke();
  }

  const centerY = 272;
  const maxGrainD0 = getMaxGrainOuterDiameter(grains);

  const rChamber = Math.max(1, motor.Dc / 2);
  const rThroat = Math.max(0.5, (nozzle.Dt0 || motor.Dc * 0.3) / 2);
  const rExit = Math.max(rThroat + 0.5, (nozzle.Ds || motor.Dc * 0.65) / 2);
  const alphaRad = ((nozzle.alpha || 12) * Math.PI) / 180;
  const lConv = Math.max(8, Math.abs(rChamber - rThroat) / Math.tan((35 * Math.PI) / 180));
  const lDiv = Math.max(12, Math.abs(rExit - rThroat) / Math.max(0.08, Math.tan(alphaRad)));
  const frontClosureMm = Math.max(10, motor.Dc * 0.18);
  const visualWallMm = Math.max(3, motor.Dc * 0.06);

  const totalAssemblyMm = frontClosureMm + Math.max(motor.Lc, 10) + lConv + lDiv;
  const maxRadialMm = Math.max(
    motor.Dc + 2 * visualWallMm,
    (nozzle.Ds || 0) + 6,
    maxGrainD0 + 2 * motorStruct.inhibitorThicknessMm
  );

  const scaleX = (W - 420) / Math.max(totalAssemblyMm, 20);
  const scaleY = (H - 180) / Math.max(maxRadialMm, 10);
  const scale = Math.min(scaleX, scaleY);

  const chamberStartX = 220 + frontClosureMm * scale;
  const chamberWidthPx = Math.max(20, motor.Lc * scale);
  const dcHalfPx = (motor.Dc / 2) * scale;
  const wallPx = Math.max(5, visualWallMm * scale);
  const linerPx = motor.hasLiner ? Math.max(0, motorStruct.linerThicknessMm * scale) : 0;
  const inhibPx = motor.hasInhibitor ? Math.max(0, motorStruct.inhibitorThicknessMm * scale) : 0;
  const closureWidthPx = frontClosureMm * scale;

  // Chamber cavity
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(chamberStartX, centerY - dcHalfPx, chamberWidthPx, dcHalfPx * 2);

  // Thermal liner
  if (motor.hasLiner && linerPx > 0) {
    const lp = Math.min(dcHalfPx, linerPx);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.5;
    ctx.fillRect(chamberStartX, centerY - dcHalfPx, chamberWidthPx, lp);
    ctx.strokeRect(chamberStartX, centerY - dcHalfPx, chamberWidthPx, lp);
    ctx.fillRect(chamberStartX, centerY + dcHalfPx - lp, chamberWidthPx, lp);
    ctx.strokeRect(chamberStartX, centerY + dcHalfPx - lp, chamberWidthPx, lp);
  }

  // Grains & inhibitor
  let cursorX = chamberStartX;
  grains.forEach((g, gIdx) => {
    const nBlocks = Math.max(1, Number(g.N) || 1);
    const lBlockPx = Math.max(2, (Number(g.L0) || 10) * scale);
    const gapPx = nBlocks > 1 ? Math.min(5, lBlockPx * 0.05) : 0;
    const grainHalfPx = Math.max(2, ((Number(g.D0) || 10) / 2) * scale);
    const propTop = centerY - grainHalfPx;
    const propH = grainHalfPx * 2;
    const grainOverlap = g.D0 > motorStruct.availableGrainDiameterMm + 1e-6;

    let fillColor = '#93C5FD';
    if (g.propellantType === 4 || g.propellantType === 5) fillColor = '#FCA5A5';
    else if (g.propellantType === 6 || g.propellantType === 7) fillColor = '#CBD5E1';
    else if (g.propellantType > 7) fillColor = '#C4B5FD';

    for (let j = 0; j < nBlocks; j++) {
      const segX = cursorX + j * lBlockPx + gapPx * 0.5;
      const segW = Math.max(2, lBlockPx - gapPx);

      if (motor.hasInhibitor && inhibPx > 0) {
        ctx.fillStyle = grainOverlap ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)';
        ctx.strokeStyle = grainOverlap ? '#DC2626' : '#059669';
        ctx.lineWidth = 1.2;
        ctx.fillRect(segX, propTop - inhibPx, segW, inhibPx);
        ctx.strokeRect(segX, propTop - inhibPx, segW, inhibPx);
        ctx.fillRect(segX, propTop + propH, segW, inhibPx);
        ctx.strokeRect(segX, propTop + propH, segW, inhibPx);
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = grainOverlap ? '#DC2626' : '#334155';
      ctx.lineWidth = grainOverlap ? 2.5 : 1.6;
      ctx.fillRect(segX, propTop, segW, propH);
      ctx.strokeRect(segX, propTop, segW, propH);

      const coreH =
        g.shape === 1 || g.shape === 5 || g.shape === 8
          ? (g.d0 || 0) * scale
          : g.shape === 2 || g.shape === 4 || g.shape === 9
            ? Math.max(g.d0 || 0, g.d0mayor || 0) * scale
            : 0;
      const coreTop =
        g.shape === 5
          ? centerY - ((Number(g.coreOffset) || 0) + (g.d0 || 0) / 2) * scale
          : centerY - coreH / 2;

      if ((g.shape === 1 || g.shape === 5) && coreH > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(segX, Math.max(propTop + 1, coreTop), segW, Math.min(propH - 2, coreH));
        ctx.strokeStyle = '#64748B';
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(segX, Math.max(propTop + 1, coreTop), segW, Math.min(propH - 2, coreH));
        ctx.setLineDash([]);
      } else if ((g.shape === 2 || g.shape === 4 || g.shape === 9) && coreH > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(segX, Math.max(propTop + 1, coreTop), segW, Math.min(propH - 2, coreH));
        const innerH = Math.max(0, (g.d0 || 0) * scale);
        if (innerH > 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(
            segX,
            Math.max(propTop + 1, centerY - innerH / 2),
            segW,
            Math.min(propH - 2, innerH)
          );
        }
      } else if ((g.shape === 6 || g.shape === 7) && (g.slotDepth || 0) > 0) {
        const cutH = Math.min(propH - 2, Math.max(2, (Number(g.slotDepth) || g.D0 * 0.45) * scale));
        ctx.fillStyle = g.shape === 7 ? '#FFFFFF' : 'rgba(255,255,255,0.75)';
        ctx.fillRect(segX, propTop, segW, cutH);
      } else if (g.shape === 8 && coreH > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(segX, Math.max(propTop + 1, centerY - coreH / 2), segW, Math.min(propH - 2, coreH));
        const rodH = Math.max(2, (Number(g.rodDiameter) || 0) * scale);
        if (rodH > 0) {
          ctx.fillStyle = fillColor;
          ctx.fillRect(segX, centerY - rodH / 2, segW, rodH);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(segX, centerY - rodH / 2, segW, rodH);
        }
      }

      if (segW > 38 && propH > 26) {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${gIdx + 1}.${j + 1}`, segX + segW / 2, centerY);
      }
    }
    cursorX += nBlocks * lBlockPx;
  });

  // Neutral Chamber Walls
  ctx.fillStyle = '#94A3B8';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.fillRect(chamberStartX, centerY - dcHalfPx - wallPx, chamberWidthPx, wallPx);
  ctx.strokeRect(chamberStartX, centerY - dcHalfPx - wallPx, chamberWidthPx, wallPx);
  ctx.fillRect(chamberStartX, centerY + dcHalfPx, chamberWidthPx, wallPx);
  ctx.strokeRect(chamberStartX, centerY + dcHalfPx, chamberWidthPx, wallPx);

  // Front Bulkhead + O-rings
  ctx.fillStyle = '#64748B';
  ctx.strokeStyle = '#1E293B';
  ctx.fillRect(chamberStartX - closureWidthPx, centerY - dcHalfPx - wallPx, closureWidthPx, (dcHalfPx + wallPx) * 2);
  ctx.strokeRect(chamberStartX - closureWidthPx, centerY - dcHalfPx - wallPx, closureWidthPx, (dcHalfPx + wallPx) * 2);
  ctx.fillStyle = '#475569';
  ctx.fillRect(chamberStartX - closureWidthPx - 10, centerY - dcHalfPx - wallPx - 6, 10, (dcHalfPx + wallPx + 6) * 2);

  const oRingR = Math.max(3.5, Math.min(8, wallPx * 0.45));
  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.arc(chamberStartX - closureWidthPx * 0.35, centerY - dcHalfPx, oRingR, 0, Math.PI * 2);
  ctx.arc(chamberStartX - closureWidthPx * 0.35, centerY + dcHalfPx, oRingR, 0, Math.PI * 2);
  ctx.fill();

  // Convergent-Divergent Nozzle
  const nozzleX0 = chamberStartX + chamberWidthPx;
  const nozzleXThroat = nozzleX0 + lConv * scale;
  const nozzleXExit = nozzleXThroat + lDiv * scale;
  const rThroatPx = rThroat * scale;
  const rExitPx = rExit * scale;
  const nozzleWallPx = Math.max(4, wallPx * 0.85);

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(nozzleX0, centerY - dcHalfPx);
  ctx.lineTo(nozzleXThroat, centerY - rThroatPx);
  ctx.lineTo(nozzleXExit, centerY - rExitPx);
  ctx.lineTo(nozzleXExit, centerY + rExitPx);
  ctx.lineTo(nozzleXThroat, centerY + rThroatPx);
  ctx.lineTo(nozzleX0, centerY + dcHalfPx);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nozzleX0, centerY - dcHalfPx - wallPx);
  ctx.lineTo(nozzleXThroat, centerY - rThroatPx - nozzleWallPx);
  ctx.lineTo(nozzleXExit, centerY - rExitPx - nozzleWallPx * 0.7);
  ctx.lineTo(nozzleXExit, centerY - rExitPx);
  ctx.lineTo(nozzleXThroat, centerY - rThroatPx);
  ctx.lineTo(nozzleX0, centerY - dcHalfPx);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(nozzleX0, centerY + dcHalfPx + wallPx);
  ctx.lineTo(nozzleXThroat, centerY + rThroatPx + nozzleWallPx);
  ctx.lineTo(nozzleXExit, centerY + rExitPx + nozzleWallPx * 0.7);
  ctx.lineTo(nozzleXExit, centerY + rExitPx);
  ctx.lineTo(nozzleXThroat, centerY + rThroatPx);
  ctx.lineTo(nozzleX0, centerY + dcHalfPx);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.arc(nozzleX0 + 8, centerY - dcHalfPx, oRingR, 0, Math.PI * 2);
  ctx.arc(nozzleX0 + 8, centerY + dcHalfPx, oRingR, 0, Math.PI * 2);
  ctx.fill();

  // Centerline
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([22, 8, 5, 8]);
  ctx.beginPath();
  ctx.moveTo(28, centerY);
  ctx.lineTo(W - 28, centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dimension Callouts (Lc, Dc, Dt0, Ds)
  const dimY = centerY + dcHalfPx + wallPx + 42;
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(chamberStartX, centerY + dcHalfPx + wallPx + 8);
  ctx.lineTo(chamberStartX, dimY + 12);
  ctx.moveTo(chamberStartX + chamberWidthPx, centerY + dcHalfPx + wallPx + 8);
  ctx.lineTo(chamberStartX + chamberWidthPx, dimY + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  drawArrowLine(ctx, chamberStartX + 4, dimY, chamberStartX + chamberWidthPx - 4, dimY, '#334155');
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`Lc = ${motor.Lc} mm`, chamberStartX + chamberWidthPx / 2, dimY + 12);

  // Left inner diameter callout
  const leftDimX = chamberStartX - closureWidthPx - 32;
  drawArrowLine(ctx, leftDimX, centerY - dcHalfPx, leftDimX, centerY + dcHalfPx, '#334155');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 23px monospace';
  ctx.fillText(`Dc = ${motor.Dc.toFixed(1)} mm`, leftDimX - 12, centerY);

  // Right nozzle callouts
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Dt0 ${nozzle.Dt0} mm`, nozzleXExit + 18, centerY - 16);
  ctx.fillText(`Ds  ${nozzle.Ds} mm`, nozzleXExit + 18, centerY + 16);

  // Localized legend strip at top
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const items: Array<{ color: string; label: string }> = [
    { color: '#64748B', label: labels.legCasing },
    ...(motor.hasLiner
      ? [{ color: '#D97706', label: `${labels.legLiner} (${motorStruct.linerThicknessMm.toFixed(1)} mm)` }]
      : []),
    ...(motor.hasInhibitor
      ? [{ color: '#059669', label: `${labels.legInhibitor} (${motorStruct.inhibitorThicknessMm.toFixed(1)} mm)` }]
      : []),
    { color: '#60A5FA', label: labels.legPropellant },
  ];
  let lx = 30;
  items.forEach((it) => {
    ctx.fillStyle = it.color;
    ctx.fillRect(lx, 24, 20, 20);
    ctx.fillStyle = '#334155';
    ctx.fillText(it.label, lx + 28, 34);
    lx += 36 + ctx.measureText(it.label).width + 24;
  });

  return c.toDataURL('image/png');
}

function drawContourLoopsToCanvas(
  ctx: CanvasRenderingContext2D,
  loops: GrainContourLoop[],
  cx: number,
  cy: number,
  scale: number
) {
  ctx.beginPath();
  for (const loop of loops) {
    if (loop.length < 3) continue;
    ctx.moveTo(cx + loop[0].x * scale, cy + loop[0].y * scale);
    for (let i = 1; i < loop.length; i++) {
      ctx.lineTo(cx + loop[i].x * scale, cy + loop[i].y * scale);
    }
    ctx.closePath();
  }
}

/** Renders crisp Cross-Section + Longitudinal CAD pair for a grain onto canvas */
function renderGrainViewsDataUrl(grain: GrainInput, burnLabel: string, inhibLabel: string): string | null {
  const W = 760;
  const H = 310;
  const c = createCanvas(W, H);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.beginPath();
  ctx.moveTo(350, 12);
  ctx.lineTo(350, H - 12);
  ctx.stroke();

  const BURN_COLOR = '#DC2626';
  const INHIB_COLOR = '#059669';
  const extStroke = grain.osi === 1 ? BURN_COLOR : INHIB_COLOR;
  const intStroke = grain.ci === 1 ? BURN_COLOR : INHIB_COLOR;
  const endStroke = grain.ei === 1 ? BURN_COLOR : INHIB_COLOR;

  // --- LEFT: CROSS-SECTION ---
  const cx = 175;
  const cy = 152;
  const scale = 230 / Math.max(1, grain.D0 || 50);
  const rOutPx = Math.max(2, (grain.D0 / 2) * scale);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([12, 6, 3, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, 18);
  ctx.lineTo(cx, H - 30);
  ctx.moveTo(22, cy);
  ctx.lineTo(328, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  const mod = getGrainModule(grain.shape);
  const complex = hasCrossSectionContours(grain.shape);

  if (complex) {
    let loops: GrainContourLoop[] | null = null;
    try {
      loops = mod.getCrossSectionContoursMm?.(grain, 0) ?? null;
    } catch {
      loops = null;
    }
    if (loops && loops.length > 0) {
      drawContourLoopsToCanvas(ctx, loops, cx, cy, scale);
      ctx.fillStyle = '#CBD5E1';
      ctx.fill('evenodd');

      const rOuter = Math.max(0.25, grain.D0 / 2);
      const rTol = Math.max(0.2, rOuter * 0.015);
      for (const loop of loops) {
        const m = loop.length;
        if (m < 3) continue;
        for (let i = 0; i < m; i++) {
          const a = loop[i];
          const b = loop[(i + 1) % m];
          const mx = 0.5 * (a.x + b.x);
          const my = 0.5 * (a.y + b.y);
          const rA = Math.hypot(a.x, a.y);
          const rB = Math.hypot(b.x, b.y);
          const rM = Math.hypot(mx, my);
          const cross = a.x * b.y - a.y * b.x;
          const isOuter =
            cross > 0 &&
            rA >= rOuter - rTol &&
            rA <= rOuter + rTol &&
            rB >= rOuter - rTol &&
            rB <= rOuter + rTol &&
            rM >= rOuter - rTol &&
            rM <= rOuter + rTol;

          ctx.strokeStyle = isOuter ? extStroke : intStroke;
          ctx.lineWidth = isOuter ? (grain.osi === 1 ? 3.5 : 5) : grain.ci === 1 ? 3.5 : 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx + a.x * scale, cy + a.y * scale);
          ctx.lineTo(cx + b.x * scale, cy + b.y * scale);
          ctx.stroke();
        }
      }
    }
  } else if (grain.shape === 1 && grain.d0 > 0 && grain.D0 > grain.d0) {
    const rInPx = (grain.d0 / 2) * scale;
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(cx, cy, rOutPx, 0, Math.PI * 2, false);
    ctx.arc(cx, cy, rInPx, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    ctx.strokeStyle = extStroke;
    ctx.lineWidth = grain.osi === 1 ? 3.5 : 5;
    ctx.beginPath();
    ctx.arc(cx, cy, rOutPx, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = intStroke;
    ctx.lineWidth = grain.ci === 1 ? 3.5 : 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rInPx, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(cx, cy, rOutPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = extStroke;
    ctx.lineWidth = grain.osi === 1 ? 3.5 : 5;
    ctx.stroke();
  }

  ctx.font = 'bold 16px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BURN_COLOR;
  ctx.fillRect(18, H - 24, 12, 12);
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.fillText(burnLabel, 36, H - 18);

  ctx.fillStyle = INHIB_COLOR;
  ctx.fillRect(142, H - 24, 12, 12);
  ctx.fillStyle = '#334155';
  ctx.fillText(inhibLabel, 160, H - 18);

  // --- RIGHT: LONGITUDINAL VIEW ---
  const rightCenterX = 555;
  const totalL = Math.max(1, (grain.L0 || 1) * Math.max(1, grain.N || 1));
  const safeD0 = Math.max(1, grain.D0 || 10);
  const aspect = totalL / safeD0;
  const maxDrawW = 340;
  const maxDrawH = 148;
  const scaledD = Math.min(maxDrawH, Math.max(58, maxDrawW / Math.max(0.6, aspect)));
  const scaledL = Math.min(maxDrawW, Math.max(96, scaledD * aspect));
  const yC = 148;
  const topY = yC - scaledD / 2;
  const botY = yC + scaledD / 2;
  const startX = rightCenterX - scaledL / 2;
  const pxPerMmY = scaledD / safeD0;
  const d0Px = Math.min(scaledD - 4, Math.max(0, (grain.d0 || 0) * pxPerMmY));
  const d0MayorPx = Math.min(scaledD - 2, Math.max(d0Px, (grain.d0mayor || 0) * pxPerMmY));

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([12, 6, 3, 6]);
  ctx.beginPath();
  ctx.moveTo(368, yC);
  ctx.lineTo(W - 18, yC);
  ctx.stroke();
  ctx.setLineDash([]);

  if (grain.shape === 3) {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(startX, topY, scaledL, scaledD);
  } else if (grain.shape === 5) {
    const offPx = Math.max(0, (Number(grain.coreOffset) || 0) * pxPerMmY);
    const boreTop = Math.max(topY + 2, yC - offPx - d0Px / 2);
    const boreBot = Math.min(botY - 2, yC - offPx + d0Px / 2);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(startX, topY, scaledL, Math.max(0, boreTop - topY));
    ctx.fillRect(startX, boreBot, scaledL, Math.max(0, botY - boreBot));
    ctx.strokeStyle = intStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, boreTop);
    ctx.lineTo(startX + scaledL, boreTop);
    ctx.moveTo(startX, boreBot);
    ctx.lineTo(startX + scaledL, boreBot);
    ctx.stroke();
  } else if (grain.shape === 6 || grain.shape === 7) {
    const cutPx = Math.min(scaledD - 4, Math.max(4, (Number(grain.slotDepth) || safeD0 * 0.45) * pxPerMmY));
    const webTop = topY + cutPx;
    if (grain.shape === 6) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(startX, topY, scaledL, cutPx);
    }
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(startX, webTop, scaledL, Math.max(0, botY - webTop));
    ctx.strokeStyle = intStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, webTop);
    ctx.lineTo(startX + scaledL, webTop);
    ctx.stroke();
  } else if (grain.shape === 8) {
    const rodPx = Math.min(d0Px - 4, Math.max(4, (Number(grain.rodDiameter) || safeD0 * 0.25) * pxPerMmY));
    const tubeTop = yC - d0Px / 2;
    const tubeBot = yC + d0Px / 2;
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(startX, topY, scaledL, Math.max(0, tubeTop - topY));
    ctx.fillRect(startX, tubeBot, scaledL, Math.max(0, botY - tubeBot));
    ctx.fillRect(startX, yC - rodPx / 2, scaledL, rodPx);
    ctx.strokeStyle = intStroke;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(startX, tubeTop);
    ctx.lineTo(startX + scaledL, tubeTop);
    ctx.moveTo(startX, tubeBot);
    ctx.lineTo(startX + scaledL, tubeBot);
    ctx.moveTo(startX, yC - rodPx / 2);
    ctx.lineTo(startX + scaledL, yC - rodPx / 2);
    ctx.moveTo(startX, yC + rodPx / 2);
    ctx.lineTo(startX + scaledL, yC + rodPx / 2);
    ctx.stroke();
  } else {
    const hasFeat = (grain.shape === 2 || grain.shape === 4 || grain.shape === 9) && d0MayorPx > d0Px;
    const coreTop = yC - d0Px / 2;
    const coreBot = yC + d0Px / 2;
    const featTop = yC - d0MayorPx / 2;
    const featBot = yC + d0MayorPx / 2;
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(startX, topY, scaledL, Math.max(0, (hasFeat ? featTop : coreTop) - topY));
    ctx.fillRect(startX, hasFeat ? featBot : coreBot, scaledL, Math.max(0, botY - (hasFeat ? featBot : coreBot)));
    if (hasFeat) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(startX, featTop, scaledL, Math.max(0, coreTop - featTop));
      ctx.fillRect(startX, coreBot, scaledL, Math.max(0, featBot - coreBot));
    }
    ctx.strokeStyle = intStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, coreTop);
    ctx.lineTo(startX + scaledL, coreTop);
    ctx.moveTo(startX, coreBot);
    ctx.lineTo(startX + scaledL, coreBot);
    ctx.stroke();
  }

  ctx.strokeStyle = extStroke;
  ctx.lineWidth = grain.osi === 1 ? 3.2 : 4.5;
  ctx.beginPath();
  if (grain.shape !== 7) {
    ctx.moveTo(startX, topY);
    ctx.lineTo(startX + scaledL, topY);
  }
  ctx.moveTo(startX, botY);
  ctx.lineTo(startX + scaledL, botY);
  ctx.stroke();

  const endTopY =
    grain.shape === 7
      ? topY + Math.min(scaledD - 4, Math.max(4, (Number(grain.slotDepth) || safeD0 * 0.45) * pxPerMmY))
      : topY;
  ctx.strokeStyle = endStroke;
  ctx.lineWidth = grain.ei === 1 ? 3.2 : 4.5;
  ctx.beginPath();
  ctx.moveTo(startX, endTopY);
  ctx.lineTo(startX, botY);
  ctx.moveTo(startX + scaledL, endTopY);
  ctx.lineTo(startX + scaledL, botY);
  ctx.stroke();

  if (grain.N > 1) {
    const segPxL = scaledL / grain.N;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    for (let j = 1; j < grain.N; j++) {
      const dx = startX + j * segPxL;
      ctx.beginPath();
      ctx.moveTo(dx, topY + 2);
      ctx.lineTo(dx, botY - 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${grain.N} x ${Number(grain.L0 || 0).toFixed(0)} mm  (L=${totalL.toFixed(0)} mm)`,
    rightCenterX,
    H - 22
  );

  return c.toDataURL('image/png');
}

export interface ChartSeries {
  label: string;
  color: string;
  x: number[];
  y: number[];
  dashed?: boolean;
  yAxis?: 'left' | 'right';
}

function computeNiceTicks(minVal: number, maxVal: number, count = 5): number[] {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || maxVal <= minVal) {
    return [0, 1];
  }
  const range = maxVal - minVal;
  const roughStep = range / Math.max(1, count - 1);
  const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const rel = roughStep / pow10;
  const niceRel = rel <= 1 ? 1 : rel <= 2 ? 2 : rel <= 5 ? 5 : 10;
  const step = niceRel * pow10;
  const start = Math.floor(minVal / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= maxVal + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(8)));
  }
  return ticks;
}

function formatTickValue(val: number, maxDomain: number): string {
  if (Math.abs(val) < 1e-9) return '0';
  if (maxDomain >= 1000) return val.toFixed(0);
  if (maxDomain >= 100) return val.toFixed(0);
  if (maxDomain >= 10) return val.toFixed(1);
  if (maxDomain >= 1) return val.toFixed(2);
  return val.toFixed(3);
}

export function renderEngineeringChartDataUrl(opts: {
  title: string;
  xLabel: string;
  yLeftLabel: string;
  yRightLabel?: string;
  series: ChartSeries[];
  peakAnnotation?: { text: string; x: number; y: number; color: string };
}): string | null {
  const W = 1900;
  const H = 720;
  const c = createCanvas(W, H);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  const hasRight = opts.series.some((s) => s.yAxis === 'right');
  const multiLegend = opts.series.length > 3;
  const padL = 182;
  const padR = hasRight ? 182 : 70;

  // Measure wrapped legend rows upfront so top padding adapts cleanly
  ctx.font = 'bold 22px monospace';
  let legendRows = 1;
  if (multiLegend) {
    let lxMeasure = padL;
    for (let i = 0; i < opts.series.length; i++) {
      const tw = ctx.measureText(opts.series[i].label).width;
      const itemW = 40 + tw + 26;
      if (lxMeasure + itemW > W - padR && lxMeasure > padL) {
        lxMeasure = padL;
        legendRows += 1;
      }
      lxMeasure += itemW;
    }
  }

  const padT = multiLegend ? 74 + legendRows * 28 : 92;
  const padB = 116;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 29px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title, 34, multiLegend ? 38 : 42);

  // Ranges
  let xMin = Infinity;
  let xMax = -Infinity;
  let yLMax = 0.01;
  let yRMax = 0.01;
  opts.series.forEach((s) => {
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i];
      if (Number.isFinite(xv)) {
        if (xv < xMin) xMin = xv;
        if (xv > xMax) xMax = xv;
      }
      const yv = s.y[i];
      if (Number.isFinite(yv)) {
        if (s.yAxis === 'right') {
          if (yv > yRMax) yRMax = yv;
        } else if (yv > yLMax) {
          yLMax = yv;
        }
      }
    }
  });
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
    xMin = 0;
    xMax = 0.1;
  }
  if (xMin >= 0 && xMin <= Math.max(0.05, xMax * 0.05)) {
    xMin = 0;
  }
  if (xMax <= xMin) {
    xMax = xMin + 0.1;
  }
  yLMax *= 1.12;
  yRMax *= 1.12;

  const xTicks = computeNiceTicks(xMin, xMax, 6);
  const xDomainMin = Math.min(xMin, xTicks[0] ?? xMin);
  const xDomainMax = Math.max(xMax, xTicks[xTicks.length - 1] ?? xMax);
  const xDomainSpan = Math.max(1e-9, xDomainMax - xDomainMin);
  const yLTicks = computeNiceTicks(0, yLMax, 5);
  const yLDomainMax = Math.max(yLMax, yLTicks[yLTicks.length - 1] || yLMax);
  const yRTicks = hasRight ? computeNiceTicks(0, yRMax, 5) : [];
  const yRDomainMax = hasRight ? Math.max(yRMax, yRTicks[yRTicks.length - 1] || yRMax) : 1;

  const mapX = (xv: number) => padL + ((xv - xDomainMin) / xDomainSpan) * plotW;
  const mapYL = (yv: number) => padT + plotH - (yv / Math.max(1e-9, yLDomainMax)) * plotH;
  const mapYR = (yv: number) => padT + plotH - (yv / Math.max(1e-9, yRDomainMax)) * plotH;

  // Grid & Left Y ticks (large & crisp)
  ctx.font = 'bold 25px monospace';
  ctx.textBaseline = 'middle';
  yLTicks.forEach((tv) => {
    const py = mapYL(tv);
    if (py < padT - 4 || py > padT + plotH + 4) return;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + plotW, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tick mark
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(padL - 8, py);
    ctx.lineTo(padL, py);
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'right';
    ctx.fillText(formatTickValue(tv, yLDomainMax), padL - 16, py);
  });

  // Right Y ticks
  if (hasRight) {
    yRTicks.forEach((tv) => {
      const py = mapYR(tv);
      if (py < padT - 4 || py > padT + plotH + 4) return;
      ctx.strokeStyle = '#0369A1';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(padL + plotW, py);
      ctx.lineTo(padL + plotW + 8, py);
      ctx.stroke();

      ctx.fillStyle = '#0369A1';
      ctx.textAlign = 'left';
      ctx.fillText(formatTickValue(tv, yRDomainMax), padL + plotW + 16, py);
    });
  }

  // X ticks
  xTicks.forEach((tv) => {
    const px = mapX(tv);
    if (px < padL - 4 || px > padL + plotW + 4) return;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, padT + plotH);
    ctx.stroke();

    // Tick mark
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(px, padT + plotH);
    ctx.lineTo(px, padT + plotH + 9);
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xDomainSpan >= 20 ? tv.toFixed(1) : tv.toFixed(2), px, padT + plotH + 16);
  });

  // High-contrast Axis Box
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Plot curves clipped strictly inside the plot box
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();
  opts.series.forEach((s) => {
    const n = Math.min(s.x.length, s.y.length);
    if (n < 2) return;
    const stride = n > 1400 ? Math.ceil(n / 1200) : 1;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4.2;
    if (s.dashed) ctx.setLineDash([14, 8]);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i += stride) {
      const px = mapX(s.x[i]);
      const py = s.yAxis === 'right' ? mapYR(s.y[i]) : mapYL(s.y[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if ((n - 1) % stride !== 0) {
      const px = mapX(s.x[n - 1]);
      const py = s.yAxis === 'right' ? mapYR(s.y[n - 1]) : mapYL(s.y[n - 1]);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();

  // Peak annotation
  if (opts.peakAnnotation) {
    const px = Math.max(padL, Math.min(padL + plotW, mapX(opts.peakAnnotation.x)));
    const py = Math.max(padT, Math.min(padT + plotH, mapYL(opts.peakAnnotation.y)));
    ctx.fillStyle = opts.peakAnnotation.color;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 23px monospace';
    ctx.textAlign = px > padL + plotW * 0.68 ? 'right' : 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      opts.peakAnnotation.text,
      px + (px > padL + plotW * 0.68 ? -14 : 14),
      Math.max(padT + 30, py - 12)
    );
  }

  // Axis Titles (larger & bold)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.xLabel, padL + plotW / 2, H - 44);

  ctx.save();
  ctx.translate(42, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.yLeftLabel, 0, 0);
  ctx.restore();

  if (hasRight && opts.yRightLabel) {
    ctx.save();
    ctx.translate(W - 42, padT + plotH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#0369A1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.yRightLabel, 0, 0);
    ctx.restore();
  }

  // Legend (wrapped row below title when >3 series, top-right for 1-3 series)
  ctx.font = 'bold 22px monospace';
  if (multiLegend) {
    let lx = padL;
    let ly = 84;
    for (let i = 0; i < opts.series.length; i++) {
      const s = opts.series[i];
      const tw = ctx.measureText(s.label).width;
      const itemW = 40 + tw + 26;
      if (lx + itemW > W - padR && lx > padL) {
        lx = padL;
        ly += 28;
      }
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4.5;
      if (s.dashed) ctx.setLineDash([9, 5]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 30, ly);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, lx + 36, ly);
      lx += itemW;
    }
  } else {
    let legX = W - padR;
    for (let i = opts.series.length - 1; i >= 0; i--) {
      const s = opts.series[i];
      const tw = ctx.measureText(s.label).width;
      legX -= tw + 48;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4.5;
      if (s.dashed) ctx.setLineDash([9, 5]);
      ctx.beginPath();
      ctx.moveTo(legX, 42);
      ctx.lineTo(legX + 32, 42);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, legX + 40, 42);
      legX -= 24;
    }
  }

  return c.toDataURL('image/png');
}

export function drawSectionHeading(doc: jsPDF, title: string, y: number): number {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(14, y + 6.5, 196, y + 6.5);
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y + 1.1, 1.8, 4.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(title), 18, y + 4.8);
  return y + 9.8;
}

export function drawKeyValueTable(
  doc: jsPDF,
  title: string,
  rows: Array<[string, string]>,
  x: number,
  y: number,
  w: number
): number {
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, 6.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(title), x + 2.8, y + 4.4);

  let cy = y + 6.4;
  const rowH = 5.4;
  rows.forEach(([k, v], idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, cy, w, rowH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k), x + 2.8, cy + 3.8);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(v), x + w - 2.8, cy + 3.8, { align: 'right' });
    cy += rowH;
  });

  return cy;
}

export interface PdfChromeLabels {
  reportHeader: string;
  docControlPrefix: string;
  exportedLabel: string;
  pageWord: string;
  ofWord: string;
  footerDept: string;
}

export function decorateAllPagesWithChromeAndWatermark(
  doc: jsPDF,
  labels: PdfChromeLabels,
  reportTitle: string,
  docRef: string,
  exportedStr: string,
  logoAsset: LoadedImageAsset | null
) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Formal diagonal HERMES watermark with full system expansion underneath
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.055 }));
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(64);
    doc.text('HERMES', 105, 146, { align: 'center', angle: 36 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('High Efficiency Rocket Motor Emulation System', 112.5, 156.5, {
      align: 'center',
      angle: 36,
    });
    doc.restoreGraphicsState();

    // Clean formal white institutional header with COHETEROS official logo
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.6);
    doc.line(14, 21.8, 196, 21.8);

    let textStartX = 14;
    if (logoAsset && logoAsset.width > 0 && logoAsset.height > 0) {
      const targetH = 14.5;
      const targetW = Math.min(44, targetH * (logoAsset.width / logoAsset.height));
      doc.addImage(logoAsset.dataUrl, 'PNG', 14, 3.8, targetW, targetH);
      textStartX = 14 + targetW + 5;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HERMES v2.1.0', textStartX, 8.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(labels.reportHeader), textStartX, 13.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(sanitizePdfText(reportTitle), textStartX, 18.2);

    // Right metadata block
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(sanitizePdfText(`${labels.docControlPrefix}: ${docRef}`), 196, 8.6, { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(`${labels.exportedLabel}: ${exportedStr}`), 196, 13.6, { align: 'right' });
    doc.text(
      sanitizePdfText(`${labels.pageWord} ${p} ${labels.ofWord} ${totalPages}`),
      196,
      18.2,
      { align: 'right' }
    );

    // Formal Footer: COHETEROS Propulsion Department
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(14, 284.5, 196, 284.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(labels.footerDept), 14, 289.2);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(`${exportedStr}  ·  ${labels.pageWord} ${p}/${totalPages}`), 196, 289.2, {
      align: 'right',
    });
  }
}

export function buildPdfReportDocument(
  opts: PdfReportOptions,
  logoAsset: LoadedImageAsset | null = null
): jsPDF {
  const lang = opts.lang || 'en';
  const labels = getPdfLabels(lang);
  const { results, motor, nozzle, grains, customPropellants, motorStruct } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const exportedStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const docRef = `HRM-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  const reportTitle =
    opts.reportTitle?.trim() ||
    `${labels.defaultTitlePrefix} ${motor.Dc}mm x ${motor.Lc}mm · ${labels.classWord} ${results.summary.motorClass}`;

  const fNakkaMax = results.F_N.length > 0 ? Math.max(...results.F_N) : 0;
  const initMassKg = (results.summary.initial_mass_g ?? (results.mgra_total[0] || 0) * 1000) / 1000;

  // =========================================================================
  // PAGE 1: EXECUTIVE SUMMARY, KPIs & DESIGN INPUTS (NO Padm / NO MATERIAL)
  // =========================================================================
  let y = 28;
  y = drawSectionHeading(doc, labels.execSummaryTitle, y);

  const kpis: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: labels.motorClass, value: results.summary.motorClass, accent: true },
    { label: labels.totalImpulse, value: `${results.summary.It_total_N_s.toFixed(1)} N·s` },
    { label: labels.specImpulse, value: `${results.summary.Isp_total_s.toFixed(1)} s` },
    {
      label: labels.burnActionTime,
      value: `${results.summary.t_quemado.toFixed(3)} / ${results.summary.t_fin.toFixed(3)} s`,
    },
    {
      label: labels.maxPressure,
      value: `${results.summary.Pmax_MPa.toFixed(3)} MPa (${(results.summary.Pmax_MPa * 10).toFixed(1)} bar)`,
    },
    {
      label: labels.avgPressure,
      value: `${results.summary.Pmed_MPa.toFixed(3)} MPa (${(results.summary.Pmed_MPa * 10).toFixed(1)} bar)`,
    },
    { label: labels.maxThrustTti, value: `${results.summary.Fmax_N.toFixed(1)} N` },
    { label: labels.avgThrustTti, value: `${results.summary.Fmed_N.toFixed(1)} N` },
    { label: labels.maxThrustRn, value: `${fNakkaMax.toFixed(1)} N` },
    { label: labels.propellantMass, value: `${initMassKg.toFixed(3)} kg` },
    { label: labels.maxMassFlow, value: `${(results.summary.mdot_max ?? 0).toFixed(3)} kg/s` },
    {
      label: labels.maxKnBurnRate,
      value: `${(results.summary.Kn_max ?? 0).toFixed(0)} / ${(results.summary.r_max ?? 0).toFixed(1)} mm/s`,
    },
  ];

  const cardW = 44;
  const cardH = 15;
  const gapX = 2;
  const gapY = 2.4;

  kpis.forEach((k, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cx = 14 + col * (cardW + gapX);
    const cy = y + row * (cardH + gapY);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, cy, cardW, cardH, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k.label), cx + 2.6, cy + 4.9);

    doc.setFont('courier', 'bold');
    doc.setFontSize(k.accent ? 12 : 8.5);
    if (k.accent) doc.setTextColor(29, 78, 216);
    else doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(k.value), cx + 2.6, cy + 11.4);
  });

  y += 3 * (cardH + gapY) + 6;

  // 2. Inputs Tables (Chamber & Protection | De Laval Nozzle)
  y = drawSectionHeading(doc, labels.inputsSectionTitle, y);

  const chamberRows: Array<[string, string]> = [
    [labels.rowDc, `${motor.Dc.toFixed(2)} mm`],
    [labels.rowLc, `${motor.Lc.toFixed(1)} mm`],
    [labels.rowEtac, `${motor.etac.toFixed(3)}`],
    [labels.rowGstar, `${motor.Gstar}`],
    [labels.rowKv, `${motor.kv}`],
    [labels.rowDt, `${motor.paso_de_tiempo} s`],
    [labels.rowPamb, `${motor.Pamb.toFixed(4)} MPa`],
    [
      labels.rowLiner,
      motor.hasLiner ? `${labels.enabledWord} (${motorStruct.linerThicknessMm.toFixed(1)} mm)` : labels.disabledWord,
    ],
    [
      labels.rowInhibitor,
      motor.hasInhibitor
        ? `${labels.enabledWord} (${motorStruct.inhibitorThicknessMm.toFixed(1)} mm)`
        : labels.disabledWord,
    ],
  ];

  const expRatio = Math.pow(nozzle.Ds / Math.max(1e-6, nozzle.Dt0), 2);
  const nozzleRows: Array<[string, string]> = [
    [labels.rowDt0, `${nozzle.Dt0.toFixed(2)} mm`],
    [labels.rowDs, `${nozzle.Ds.toFixed(2)} mm`],
    [labels.rowExpRatio, `${expRatio.toFixed(2)}`],
    [labels.rowAlpha, `${nozzle.alpha.toFixed(1)} deg`],
    [labels.rowEtanoz, `${nozzle.etanoz.toFixed(3)}`],
    [
      labels.rowThroatVar,
      nozzle.e === 0
        ? `0.00 mm (${labels.noAblationWord})`
        : `${nozzle.e > 0 ? '+' : ''}${nozzle.e.toFixed(2)} mm`,
    ],
    [labels.rowErosionModel, `${labels.modelWord} ${nozzle.ero_model ?? 1}`],
  ];

  const yLeftEnd = drawKeyValueTable(doc, labels.chamberInputsTitle, chamberRows, 14, y, 89);
  const yRightEnd = drawKeyValueTable(doc, labels.nozzleInputsTitle, nozzleRows, 107, y, 89);
  y = Math.max(yLeftEnd, yRightEnd) + 6;

  // =========================================================================
  // PAGE 2: 2D CHAMBER SCHEMATIC & SELECTED GRAINS
  // =========================================================================
  doc.addPage();
  y = 28;
  y = drawSectionHeading(doc, labels.schematicSectionTitle, y);

  const chamberImg = renderChamberSchematicDataUrl(motor, grains, nozzle, motorStruct, labels);
  if (chamberImg) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(14, y, 182, 49);
    doc.addImage(chamberImg, 'PNG', 14.5, y + 0.5, 181, 48);
    y += 51.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(labels.chamberSchematicCaption), 105, y + 2.5, { align: 'center' });
    y += 7.5;
  }

  y = drawSectionHeading(doc, `${labels.grainsSectionTitle} (${grains.length})`, y);

  grains.forEach((g, idx) => {
    const prop = getPropellantData(g.propellantType, customPropellants);
    const shapeName = getGrainShapeLabel(g.shape, lang);
    let initGeom = { tweb0: 0, totalVolumeMm3: 0, crossSectionAreaMm2: 0 };
    try {
      initGeom = getGrainModule(g.shape).getInitialGeometry(g);
    } catch {
      // keep defaults
    }
    const blockMassKg = ((initGeom.totalVolumeMm3 / 1000) * prop.rho * (g.rhorat || 1)) / 1000;

    if (y + 56 > 280) {
      doc.addPage();
      y = 28;
      y = drawSectionHeading(doc, `${labels.grainsSectionTitle} (${labels.contSuffix})`, y);
    }

    const boxH = 52;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, y, 182, boxH, 0.8, 0.8, 'FD');

    doc.setFillColor(226, 232, 240);
    doc.rect(14, y, 182, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      sanitizePdfText(`${labels.grainWord} #${idx + 1}: ${shapeName}  |  ${labels.propellantWord}: ${prop.name}`),
      17,
      y + 4.3
    );
    doc.setFont('courier', 'bold');
    doc.text(sanitizePdfText(`${g.N} x L0=${g.L0}mm  ·  m=${blockMassKg.toFixed(3)} kg`), 193, y + 4.3, {
      align: 'right',
    });

    const grainImg = renderGrainViewsDataUrl(g, labels.burnLegend, labels.inhibLegend);
    if (grainImg) {
      doc.addImage(grainImg, 'PNG', 16, y + 8, 92, 37.5);
    }

    const extraDims: string[] = [];
    if (g.shape === 2) extraDims.push(`Np=${g.Np}, Dp=${g.d0mayor}mm`);
    if (g.shape === 4) extraDims.push(`Np=${g.Np}, Dp=${g.d0mayor}mm, W=${g.finWidth ?? 4}mm`);
    if (g.shape === 5) extraDims.push(`Offset=${g.coreOffset ?? 0}mm`);
    if (g.shape === 6) extraDims.push(`Slot=${g.slotWidth ?? 6}x${g.slotDepth ?? 18}mm`);
    if (g.shape === 7) extraDims.push(`Cut=${g.slotDepth ?? 15}mm`);
    if (g.shape === 8) extraDims.push(`ID=${g.d0}mm, Rod=${g.rodDiameter ?? 12}mm`);
    if (g.shape === 9) extraDims.push(`Np=${g.Np}, OutD=${g.d0mayor}mm, W=${g.spokeWidth ?? 5}mm`);

    const detailRows: Array<[string, string]> = [
      ['D0 / d0 / L0 / N', `${g.D0} / ${g.d0} / ${g.L0} mm  (N=${g.N})`],
      ...(extraDims.length > 0 ? ([[labels.shapeParamsRow, extraDims.join(', ')]] as Array<[string, string]>) : []),
      [labels.webRhoratRow, `${initGeom.tweb0.toFixed(2)} mm / ${(g.rhorat || 1).toFixed(2)}`],
      [
        labels.burnFacesRow,
        `${g.osi ? labels.onWord : labels.inhibShort} / ${g.ci ? labels.onWord : labels.inhibShort} / ${g.ei ? labels.onWord : labels.inhibShort}`,
      ],
      [labels.propThermoRow, `${prop.rho.toFixed(3)} / ${prop.T0}K / ${prop.k.toFixed(2)} / ${prop.M.toFixed(1)}`],
      [
        labels.stRobertRow,
        `a=${prop.a.toFixed(3)}, n=${prop.n.toFixed(3)}${prop.pressureRanges?.length ? ` (${prop.pressureRanges.length} ${labels.zonesWord})` : ''}`,
      ],
    ];

    let dy = y + 9.5;
    detailRows.forEach(([dk, dv]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text(sanitizePdfText(dk), 112, dy);
      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(dv), 193, dy, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(112, dy + 1.5, 193, dy + 1.5);
      dy += 6.2;
    });

    y += boxH + 4;
  });

  // =========================================================================
  // PAGE 3: BALLISTIC CURVES (P-t, F-t, mprop & mdot) — NO GNC / NO Padm
  // =========================================================================
  doc.addPage();
  y = 28;
  y = drawSectionHeading(doc, labels.chartsSectionTitle, y);

  let pMaxIdx = 0;
  for (let i = 1; i < results.P0_gage.length; i++) {
    if (results.P0_gage[i] > results.P0_gage[pMaxIdx]) pMaxIdx = i;
  }
  const fTtiMax = results.E_N.length > 0 ? Math.max(...results.E_N) : 0;
  let fMaxIdx = 0;
  for (let i = 1; i < results.E_N.length; i++) {
    if (results.E_N[i] > results.E_N[fMaxIdx]) fMaxIdx = i;
  }

  const pChartImg = renderEngineeringChartDataUrl({
    title: labels.pressureChartTitle,
    xLabel: labels.xAxisTime,
    yLeftLabel: labels.yAxisPressure,
    series: [
      {
        label: labels.seriesP0Gage,
        color: '#DC2626',
        x: results.t,
        y: results.P0_gage.map((v) => Math.max(0, v)),
      },
    ],
    peakAnnotation: {
      text: `Pmax ${(results.P0_gage[pMaxIdx] || 0).toFixed(2)} MPa @ ${(results.t[pMaxIdx] || 0).toFixed(2)}s`,
      x: results.t[pMaxIdx] || 0,
      y: Math.max(0, results.P0_gage[pMaxIdx] || 0),
      color: '#DC2626',
    },
  });

  if (pChartImg) {
    doc.addImage(pChartImg, 'PNG', 14, y, 182, 68);
    y += 72;
  }

  const fChartImg = renderEngineeringChartDataUrl({
    title: labels.thrustChartTitle,
    xLabel: labels.xAxisTime,
    yLeftLabel: labels.yAxisThrust,
    series: [
      {
        label: labels.seriesThrustTti,
        color: '#1D4ED8',
        x: results.t,
        y: results.E_N.map((v) => Math.max(0, v)),
      },
      {
        label: labels.seriesThrustRn,
        color: '#EA580C',
        x: results.t,
        y: results.F_N.map((v) => Math.max(0, v)),
        dashed: true,
      },
    ],
    peakAnnotation: {
      text: `Fmax ${fTtiMax.toFixed(0)} N  |  It ${results.summary.It_total_N_s.toFixed(0)} N·s`,
      x: results.t[fMaxIdx] || 0,
      y: Math.max(0, results.E_N[fMaxIdx] || 0),
      color: '#1D4ED8',
    },
  });

  if (fChartImg) {
    doc.addImage(fChartImg, 'PNG', 14, y, 182, 68);
    y += 72;
  }

  const massFlowChartImg = renderEngineeringChartDataUrl({
    title: labels.massFlowChartTitle,
    xLabel: labels.xAxisTime,
    yLeftLabel: labels.yAxisMass,
    yRightLabel: labels.yAxisMassFlow,
    series: [
      {
        label: labels.seriesMprop,
        color: '#0F172A',
        x: results.t,
        y: results.mgra_total.map((v) => Math.max(0, v)),
        yAxis: 'left',
      },
      {
        label: labels.seriesMdotGen,
        color: '#0284C7',
        x: results.t,
        y: (results.mdot_gen || []).map((v) => Math.max(0, v)),
        yAxis: 'right',
      },
      {
        label: labels.seriesMdotNoz,
        color: '#059669',
        x: results.t,
        y: (results.mdot_noz || []).map((v) => Math.max(0, v)),
        dashed: true,
        yAxis: 'right',
      },
    ],
  });

  if (massFlowChartImg) {
    doc.addImage(massFlowChartImg, 'PNG', 14, y, 182, 68);
  }

  // =========================================================================
  // PAGE 4 (OPTIONAL): MISSION CONTROL FLIGHT & RECOVERY SUMMARY
  // =========================================================================
  if (opts.includeMissionControl && opts.simApogee && opts.simApogee.t.length > 0) {
    const ap = opts.simApogee;
    const mc = opts.mcSnapshot?.params;

    doc.addPage();
    y = 28;
    y = drawSectionHeading(doc, labels.flightSectionTitle, y);

    const modeLabel =
      ap.recoveryMode === 'dual'
        ? labels.mcModeDual
        : ap.recoveryMode === 'single'
          ? labels.mcModeSingle
          : labels.mcModeNone;

    const chuteDesc =
      ap.recoveryMode === 'dual'
        ? mc
          ? `${labels.mcDrogueDescPrefix} ${mc.drogueDiameterM}m + ${labels.mcMainDescPrefix} ${mc.chuteDiameterM}m @ ${mc.mainDeployAltM}m`
          : labels.mcModeDual
        : ap.recoveryMode === 'single'
          ? mc
            ? `${labels.mcMainDescPrefix} ${mc.chuteDiameterM}m (Cd ${mc.chuteCd})`
            : labels.mcModeSingle
          : labels.mcBallisticDesc;

    const flightRowsLeft: Array<[string, string]> = [
      [labels.mcApogeeAgl, `${ap.maxApogee.toFixed(1)} m`],
      [labels.mcApogeeAsl, `${(ap.maxApogee + ap.launchAltitudeM).toFixed(1)} m`],
      [labels.mcTimeToApogee, `${ap.apogeeTime.toFixed(2)} s`],
      [labels.mcMaxVel, `${ap.maxVelocity.toFixed(1)} m/s`],
      [labels.mcMaxMach, `${(ap.mach.length ? Math.max(...ap.mach) : 0).toFixed(3)} M`],
      [labels.mcMaxAccel, `${ap.maxAcceleration.toFixed(1)} m/s2`],
    ];

    const flightRowsRight: Array<[string, string]> = [
      [labels.mcRailAngle, `${ap.railLengthM.toFixed(2)} m / ${ap.flightPathAngleDeg.toFixed(1)} deg`],
      [labels.mcRailExitVel, `${ap.railExitVelocity.toFixed(1)} m/s (${ap.minRecommendedRailVel.toFixed(1)})`],
      [labels.mcWindAoa, `${ap.windSpeedMs.toFixed(1)} m/s / ${ap.railExitAngleOfAttackDeg.toFixed(1)} deg`],
      [labels.mcRecoveryMode, modeLabel],
      [labels.mcChutesConfig, chuteDesc],
      [
        labels.mcTouchdownTime,
        ap.recoveryMode !== 'none' && ap.descentRateMs !== undefined && ap.landingTime !== undefined
          ? `${ap.descentRateMs.toFixed(2)} m/s · ${ap.landingTime.toFixed(1)} s`
          : '-',
      ],
    ];

    const yF1 = drawKeyValueTable(doc, labels.mcTableLeft, flightRowsLeft, 14, y, 89);
    const yF2 = drawKeyValueTable(doc, labels.mcTableRight, flightRowsRight, 107, y, 89);
    y = Math.max(yF1, yF2) + 8;

    const { t: plotT, h: plotH, apIdx, isAscentOnly } = sliceAltitudeSeriesForPdf(ap);

    const altImg = renderEngineeringChartDataUrl({
      title: isAscentOnly ? labels.altitudeChartTitleAscent : labels.altitudeChartTitleFull,
      xLabel: labels.xAxisMissionTime,
      yLeftLabel: labels.yAxisAltitude,
      series: [
        {
          label: labels.seriesAltitude,
          color: '#1D4ED8',
          x: plotT,
          y: plotH,
        },
      ],
      peakAnnotation: {
        text: `${labels.apogeeAnnotationWord} ${ap.maxApogee.toFixed(1)} m @ ${ap.apogeeTime.toFixed(1)} s`,
        x: ap.t[apIdx] || ap.apogeeTime,
        y: ap.h[apIdx] || ap.maxApogee,
        color: '#1D4ED8',
      },
    });
    if (altImg) {
      doc.addImage(altImg, 'PNG', 14, y, 182, 84);
    }
  }

  decorateAllPagesWithChromeAndWatermark(doc, labels, reportTitle, docRef, exportedStr, logoAsset);

  return doc;
}

export function sliceAltitudeSeriesForPdf(ap: ApogeeResult): {
  t: number[];
  h: number[];
  apIdx: number;
  isAscentOnly: boolean;
} {
  let apIdx = 0;
  for (let i = 1; i < ap.h.length; i++) {
    if (ap.h[i] > ap.h[apIdx]) apIdx = i;
  }
  const isAscentOnly = ap.recoveryMode === 'none';
  const t = isAscentOnly ? ap.t.slice(0, apIdx + 1) : ap.t;
  const h = (isAscentOnly ? ap.h.slice(0, apIdx + 1) : ap.h).map((v) => Math.max(0, v));
  return { t, h, apIdx, isAscentOnly };
}

export async function exportSimulationPdf(opts: PdfReportOptions): Promise<void> {
  const logoAsset = await loadCoheterosLogoAsset();
  const doc = buildPdfReportDocument(opts, logoAsset);
  const cleaned = opts.filename
    .trim()
    .replace(/\.(pdf|csv|xlsx)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.+$/, '')
    .trim();
  const safeName = `${cleaned || 'HERMES_Report'}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
