import { jsPDF } from 'jspdf';
import { Language } from './i18n';
import { StudySeries, StudyState } from './studyStorage';
import {
  StudyComparisonDelta,
  StudySeriesMetrics,
  computeComparisonDelta,
  computeStudyMetrics,
  getSeriesPressureArray,
  getSeriesThrustArray,
} from './studyEngine';
import {
  ChartSeries,
  LoadedImageAsset,
  PdfChromeLabels,
  createCanvas,
  decorateAllPagesWithChromeAndWatermark,
  drawSectionHeading,
  loadCoheterosLogoAsset,
  renderEngineeringChartDataUrl,
  sanitizePdfText,
} from './pdfReport';

export interface StudyPdfReportOptions {
  studyState: StudyState;
  filename?: string;
  lang?: Language;
}

interface StudyPdfLabels extends PdfChromeLabels {
  defaultStudyTitle: string;
  summarySection: string;
  impulseBarTitle: string;
  comparisonTableTitle: string;
  provenanceSection: string;
  chartsSection: string;
  referenceBadge: string;
  thrustModelNotePrefix: string;
  noReferenceWord: string;
  colSeries: string;
  colSource: string;
  colIt: string;
  colDeltaIt: string;
  colPmax: string;
  colDeltaPmax: string;
  colPavg: string;
  colFmax: string;
  colFavg: string;
  colTb: string;
  colIsp: string;
  colProvenanceMeta: string;
  colTimeShift: string;
  colChannels: string;
  pChartTitle: string;
  fChartTitle: string;
  xAxisTime: string;
  yAxisPressureBar: string;
  yAxisPressureMPa: string;
  yAxisThrust: string;
  noPressureCurves: string;
  noThrustCurves: string;
  srcActive: string;
  srcLibrary: string;
  srcHermes: string;
  srcExperimental: string;
}

function getStudyPdfLabels(lang: Language): StudyPdfLabels {
  if (lang === 'es') {
    return {
      reportHeader: 'INFORME COMPARATIVO DE ESTUDIO DE PROPULSIÓN',
      docControlPrefix: 'REF EST',
      exportedLabel: 'Fecha exportación',
      pageWord: 'Página',
      ofWord: 'de',
      footerDept: 'Departamento de Propulsión COHETEROS',
      defaultStudyTitle: 'Estudio Comparativo de Motores y Ensayos',
      summarySection: '1. COMPARATIVA DE IMPULSO TOTAL, PRESIONES Y MÉTRICAS CLAVE',
      impulseBarTitle: 'Comparativa Visual de Impulso Total It [N·s]',
      comparisonTableTitle: 'Tabla Comparativa de Rendimiento y Desviaciones respecto a Referencia',
      provenanceSection: '2. CONFIGURACIÓN Y ORIGEN DE LAS SERIES INCLUIDAS',
      chartsSection: '3. CURVAS SUPERPUESTAS DE PRESIÓN Y EMPUJE',
      referenceBadge: 'Referencia Base',
      thrustModelNotePrefix: 'Modelo empuje simulaciones',
      noReferenceWord: 'Sin referencia fija',
      colSeries: 'Serie',
      colSource: 'Origen',
      colIt: 'It [N·s]',
      colDeltaIt: 'dIt (%)',
      colPmax: 'Pmax',
      colDeltaPmax: 'dPmax (%)',
      colPavg: 'Pmed',
      colFmax: 'Fmax [N]',
      colFavg: 'Fmed [N]',
      colTb: 'tb [s]',
      colIsp: 'Isp [s]',
      colProvenanceMeta: 'Especificación / Archivo',
      colTimeShift: 'Desplaz. dt',
      colChannels: 'Canales',
      pChartTitle: 'Presión Manométrica en Cámara vs Tiempo (Comparativa)',
      fChartTitle: 'Empuje vs Tiempo (Comparativa)',
      xAxisTime: 'Tiempo [s]',
      yAxisPressureBar: 'Presión Manométrica [bar]',
      yAxisPressureMPa: 'Presión Manométrica [MPa]',
      yAxisThrust: 'Empuje [N]',
      noPressureCurves: 'Ninguna de las series visibles contiene datos de presión.',
      noThrustCurves: 'Ninguna de las series visibles contiene datos de empuje.',
      srcActive: 'Sim. Activa',
      srcLibrary: 'Biblioteca',
      srcHermes: '.hrms',
      srcExperimental: 'Ensayo',
    };
  }
  if (lang === 'fr') {
    return {
      reportHeader: "RAPPORT COMPARATIF D'ÉTUDE DE PROPULSION",
      docControlPrefix: 'REF ÉTD',
      exportedLabel: "Date d'exportation",
      pageWord: 'Page',
      ofWord: 'sur',
      footerDept: 'Département Propulsion COHETEROS',
      defaultStudyTitle: 'Étude Comparative Moteurs & Essais',
      summarySection: '1. COMPARATIF IMPULSION TOTALE, PRESSIONS & MÉTRIQUES CLÉS',
      impulseBarTitle: "Comparatif Visuel d'Impulsion Totale It [N·s]",
      comparisonTableTitle: 'Tableau Comparatif des Performances et Écarts vs Référence',
      provenanceSection: '2. CONFIGURATION ET ORIGINE DES SÉRIES',
      chartsSection: '3. COURBES SUPERPOSÉES DE PRESSION ET POUSSÉE',
      referenceBadge: 'Référence',
      thrustModelNotePrefix: 'Modèle poussée simulations',
      noReferenceWord: 'Aucune référence',
      colSeries: 'Série',
      colSource: 'Source',
      colIt: 'It [N·s]',
      colDeltaIt: 'dIt (%)',
      colPmax: 'Pmax',
      colDeltaPmax: 'dPmax (%)',
      colPavg: 'Pmoy',
      colFmax: 'Fmax [N]',
      colFavg: 'Fmoy [N]',
      colTb: 'tb [s]',
      colIsp: 'Isp [s]',
      colProvenanceMeta: 'Spécification / Fichier',
      colTimeShift: 'Décalage dt',
      colChannels: 'Canaux',
      pChartTitle: 'Pression Manométrique Chambre vs Temps (Comparatif)',
      fChartTitle: 'Poussée vs Temps (Comparatif)',
      xAxisTime: 'Temps [s]',
      yAxisPressureBar: 'Pression Manométrique [bar]',
      yAxisPressureMPa: 'Pression Manométrique [MPa]',
      yAxisThrust: 'Poussée [N]',
      noPressureCurves: 'Aucune série visible ne contient de données de pression.',
      noThrustCurves: 'Aucune série visible ne contient de données de poussée.',
      srcActive: 'Sim. Active',
      srcLibrary: 'Bibliothèque',
      srcHermes: '.hrms',
      srcExperimental: 'Essai',
    };
  }
  if (lang === 'it') {
    return {
      reportHeader: 'RAPPORTO COMPARATIVO STUDIO DI PROPULSIONE',
      docControlPrefix: 'RIF STD',
      exportedLabel: 'Data esportazione',
      pageWord: 'Pagina',
      ofWord: 'di',
      footerDept: 'Dipartimento Propulsione COHETEROS',
      defaultStudyTitle: 'Studio Comparativo Motori e Prove',
      summarySection: '1. CONFRONTO IMPULSO TOTALE, PRESSIONI E METRICHE CHIAVE',
      impulseBarTitle: 'Confronto Visivo Impulso Totale It [N·s]',
      comparisonTableTitle: 'Tabella Comparativa Prestazioni e Scostamenti vs Riferimento',
      provenanceSection: '2. CONFIGURAZIONE E ORIGINE DELLE SERIE',
      chartsSection: '3. CURVE SOVRAPPOSTE DI PRESSIONE E SPINTA',
      referenceBadge: 'Riferimento',
      thrustModelNotePrefix: 'Modello spinta simulazioni',
      noReferenceWord: 'Nessun riferimento',
      colSeries: 'Serie',
      colSource: 'Origine',
      colIt: 'It [N·s]',
      colDeltaIt: 'dIt (%)',
      colPmax: 'Pmax',
      colDeltaPmax: 'dPmax (%)',
      colPavg: 'Pmed',
      colFmax: 'Fmax [N]',
      colFavg: 'Fmed [N]',
      colTb: 'tb [s]',
      colIsp: 'Isp [s]',
      colProvenanceMeta: 'Specifica / File',
      colTimeShift: 'Offset dt',
      colChannels: 'Canali',
      pChartTitle: 'Pressione Relativa Camera vs Tempo (Confronto)',
      fChartTitle: 'Spinta vs Tempo (Confronto)',
      xAxisTime: 'Tempo [s]',
      yAxisPressureBar: 'Pressione Relativa [bar]',
      yAxisPressureMPa: 'Pressione Relativa [MPa]',
      yAxisThrust: 'Spinta [N]',
      noPressureCurves: 'Nessuna serie visibile contiene dati di pressione.',
      noThrustCurves: 'Nessuna serie visibile contiene dati di spinta.',
      srcActive: 'Sim. Attiva',
      srcLibrary: 'Libreria',
      srcHermes: '.hrms',
      srcExperimental: 'Prova',
    };
  }
  return {
    reportHeader: 'PROPULSION COMPARATIVE STUDY REPORT',
    docControlPrefix: 'STD REF',
    exportedLabel: 'Export Date',
    pageWord: 'Page',
    ofWord: 'of',
    footerDept: 'COHETEROS Propulsion Department',
    defaultStudyTitle: 'Motor & Test Stand Comparative Study',
    summarySection: '1. TOTAL IMPULSE, PRESSURE & KEY METRICS COMPARISON',
    impulseBarTitle: 'Visual Comparison of Total Impulse It [N·s]',
    comparisonTableTitle: 'Comparative Performance & Deviation vs Reference Table',
    provenanceSection: '2. SERIES SPECIFICATIONS & DATA PROVENANCE',
    chartsSection: '3. OVERLAID PRESSURE & THRUST CURVES',
    referenceBadge: 'Baseline Ref',
    thrustModelNotePrefix: 'Sim thrust model',
    noReferenceWord: 'No baseline selected',
    colSeries: 'Series',
    colSource: 'Source',
    colIt: 'It [N·s]',
    colDeltaIt: 'dIt (%)',
    colPmax: 'Pmax',
    colDeltaPmax: 'dPmax (%)',
    colPavg: 'Pavg',
    colFmax: 'Fmax [N]',
    colFavg: 'Favg [N]',
    colTb: 'tb [s]',
    colIsp: 'Isp [s]',
    colProvenanceMeta: 'Specification / File',
    colTimeShift: 'Shift dt',
    colChannels: 'Channels',
    pChartTitle: 'Chamber Gauge Pressure vs Time (Overlaid)',
    fChartTitle: 'Thrust vs Time (Overlaid)',
    xAxisTime: 'Time [s]',
    yAxisPressureBar: 'Gauge Pressure [bar]',
    yAxisPressureMPa: 'Gauge Pressure [MPa]',
    yAxisThrust: 'Thrust [N]',
    noPressureCurves: 'None of the visible series contain pressure data.',
    noThrustCurves: 'None of the visible series contain thrust data.',
    srcActive: 'Active Sim',
    srcLibrary: 'Library',
    srcHermes: '.hrms',
    srcExperimental: 'Test Stand',
  };
}

function sourceLabel(src: StudySeries['source'], labels: StudyPdfLabels): string {
  switch (src) {
    case 'active':
      return labels.srcActive;
    case 'library':
      return labels.srcLibrary;
    case 'hermes':
      return labels.srcHermes;
    case 'experimental':
    default:
      return labels.srcExperimental;
  }
}

function renderImpulseComparisonChart(
  items: Array<{
    series: StudySeries;
    metrics: StudySeriesMetrics;
    delta: StudyComparisonDelta;
    isRef: boolean;
  }>,
  title: string
): string | null {
  const valid = items.filter((it) => it.metrics.totalImpulseNs !== null);
  if (valid.length === 0) return null;

  const rowH = 68;
  const padT = 80;
  const padB = 34;
  const W = 1860;
  const H = Math.max(240, padT + padB + valid.length * rowH);
  const c = createCanvas(W, H);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 34, 42);

  const labelW = 430;
  const valueW = 350;
  const barAreaW = W - labelW - valueW - 60;
  const maxIt = Math.max(1, ...valid.map((v) => v.metrics.totalImpulseNs || 0));

  valid.forEach((item, idx) => {
    const cy = padT + idx * rowH + rowH * 0.5;
    const itVal = item.metrics.totalImpulseNs || 0;
    const barW = Math.max(4, (itVal / maxIt) * barAreaW);

    // Row alternating shading
    if (idx % 2 === 0) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(14, padT + idx * rowH + 4, W - 28, rowH - 8);
    }

    // Color swatch + Name
    ctx.fillStyle = item.series.color;
    ctx.fillRect(32, cy - 11, 14, 22);

    ctx.fillStyle = '#0F172A';
    ctx.font = item.isRef ? 'bold 24px sans-serif' : '24px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const rawName = item.isRef ? `${item.series.name} ★` : item.series.name;
    const truncated = rawName.length > 26 ? `${rawName.slice(0, 24)}...` : rawName;
    ctx.fillText(truncated, 58, cy);

    // Bar track
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(labelW, cy - 15, barAreaW, 30);

    // Bar fill
    ctx.fillStyle = item.series.color;
    ctx.fillRect(labelW, cy - 15, barW, 30);

    // Value + delta
    const pctStr =
      item.isRef
        ? 'REF'
        : item.delta.dItPct !== null
          ? `${item.delta.dItPct >= 0 ? '+' : ''}${item.delta.dItPct.toFixed(1)}%`
          : '';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 23px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${itVal.toFixed(1)} N·s${pctStr ? ` (${pctStr})` : ''}`,
      W - 34,
      cy
    );
  });

  return c.toDataURL('image/png');
}

export function buildStudyPdfDocument(
  opts: StudyPdfReportOptions,
  logoAsset: LoadedImageAsset | null = null
): jsPDF {
  const lang = opts.lang || 'en';
  const labels = getStudyPdfLabels(lang);
  const { studyState } = opts;
  const visibleSeries = studyState.series.filter((s) => s.visible);
  const effectiveSeries = visibleSeries.length > 0 ? visibleSeries : studyState.series;

  const refSeries =
    effectiveSeries.find((s) => s.id === studyState.referenceId) || effectiveSeries[0] || null;

  const computed = effectiveSeries.map((s) => ({
    series: s,
    metrics: computeStudyMetrics(s, studyState.thrustModel),
  }));
  const refMetrics = refSeries
    ? computed.find((c) => c.series.id === refSeries.id)?.metrics || null
    : null;

  const rows = computed.map((c) => ({
    series: c.series,
    metrics: c.metrics,
    delta: computeComparisonDelta(c.metrics, refMetrics),
    isRef: Boolean(refSeries && c.series.id === refSeries.id),
  }));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const exportedStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const docRef = `STD-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  const reportTitle = studyState.studyTitle.trim() || labels.defaultStudyTitle;

  const pMult = studyState.pressureUnit === 'bar' ? 10 : 1;
  const pUnitStr = studyState.pressureUnit;
  const pDec = studyState.pressureUnit === 'bar' ? 1 : 2;

  // =========================================================================
  // PAGE 1: SUMMARY, IMPULSE BAR COMPARISON, METRICS TABLE & PROVENANCE
  // =========================================================================
  let y = 28;
  y = drawSectionHeading(doc, labels.summarySection, y);

  // Reference & model header banner
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(14, y, 182, 10, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const refLine = `${labels.referenceBadge}: ${refSeries ? refSeries.name : labels.noReferenceWord}`;
  doc.text(sanitizePdfText(refLine), 18, y + 6.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  const modelLine = `${labels.thrustModelNotePrefix}: ${studyState.thrustModel === 'rn' ? 'Richard Nakka' : 'Ideal TTI'} · P: ${pUnitStr}`;
  doc.text(sanitizePdfText(modelLine), 192, y + 6.2, { align: 'right' });
  y += 13;

  // Visual Total Impulse Bar Chart
  const itBarImg = renderImpulseComparisonChart(rows, labels.impulseBarTitle);
  if (itBarImg) {
    const barImgH = Math.min(68, Math.max(28, 12 + rows.length * 8.2));
    doc.addImage(itBarImg, 'PNG', 14, y, 182, barImgH);
    y += barImgH + 6;
  }

  // Comparative Metrics Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(labels.comparisonTableTitle), 14, y);
  y += 3;

  const cols = [
    { label: labels.colSeries, x: 14, w: 38, align: 'left' as const },
    { label: labels.colSource, x: 52, w: 18, align: 'left' as const },
    { label: labels.colIt, x: 70, w: 20, align: 'right' as const },
    { label: labels.colDeltaIt, x: 90, w: 17, align: 'right' as const },
    { label: `${labels.colPmax} (${pUnitStr})`, x: 107, w: 19, align: 'right' as const },
    { label: labels.colDeltaPmax, x: 126, w: 16, align: 'right' as const },
    { label: labels.colFmax, x: 142, w: 18, align: 'right' as const },
    { label: labels.colTb, x: 160, w: 14, align: 'right' as const },
    { label: labels.colIsp, x: 174, w: 22, align: 'right' as const },
  ];

  // Header row
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.rect(14, y, 182, 6.8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(15, 23, 42);
  cols.forEach((c) => {
    const tx = c.align === 'right' ? c.x + c.w - 1.5 : c.x + 1.8;
    doc.text(sanitizePdfText(c.label), tx, y + 4.6, { align: c.align });
  });
  y += 6.8;

  rows.forEach((row, idx) => {
    if (y > 265) {
      doc.addPage();
      y = 28;
    }
    const rowH = 6.2;
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, rowH, 'FD');

    // Color swatch
    doc.setFillColor(row.series.color);
    doc.rect(15.2, y + 1.6, 2, 3, 'F');

    const m = row.metrics;
    const d = row.delta;
    const nameTxt = `${row.series.name}${row.isRef ? ' *' : ''}`;
    const trimmedName = nameTxt.length > 20 ? `${nameTxt.slice(0, 18)}..` : nameTxt;

    const cells: Array<{ val: string; bold?: boolean }> = [
      { val: trimmedName, bold: row.isRef },
      { val: sourceLabel(row.series.source, labels) },
      { val: m.totalImpulseNs !== null ? m.totalImpulseNs.toFixed(1) : '-', bold: true },
      {
        val: row.isRef
          ? 'REF'
          : d.dItPct !== null
            ? `${d.dItPct >= 0 ? '+' : ''}${d.dItPct.toFixed(1)}%`
            : '-',
        bold: !row.isRef && d.dItPct !== null,
      },
      { val: m.pMaxMPa !== null ? (m.pMaxMPa * pMult).toFixed(pDec) : '-' },
      {
        val: row.isRef
          ? 'REF'
          : d.dPmaxPct !== null
            ? `${d.dPmaxPct >= 0 ? '+' : ''}${d.dPmaxPct.toFixed(1)}%`
            : '-',
      },
      { val: m.fMaxN !== null ? m.fMaxN.toFixed(0) : '-' },
      { val: m.burnTimeS !== null ? m.burnTimeS.toFixed(2) : '-' },
      { val: m.ispS !== null ? m.ispS.toFixed(1) : '-' },
    ];

    cols.forEach((c, ci) => {
      const cell = cells[ci];
      doc.setFont(ci <= 1 ? 'helvetica' : 'courier', cell.bold ? 'bold' : 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(15, 23, 42);
      const tx = c.align === 'right' ? c.x + c.w - 1.5 : ci === 0 ? c.x + 4.4 : c.x + 1.8;
      doc.text(sanitizePdfText(cell.val), tx, y + 4.3, { align: c.align });
    });

    y += rowH;
  });

  y += 8;
  if (y > 225) {
    doc.addPage();
    y = 28;
  }

  // Provenance Table
  y = drawSectionHeading(doc, labels.provenanceSection, y);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.rect(14, y, 182, 6.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(labels.colSeries), 16, y + 4.4);
  doc.text(sanitizePdfText(labels.colProvenanceMeta), 60, y + 4.4);
  doc.text(sanitizePdfText(labels.colChannels), 156, y + 4.4);
  doc.text(sanitizePdfText(labels.colTimeShift), 194, y + 4.4, { align: 'right' });
  y += 6.4;

  rows.forEach((row, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 28;
    }
    const rowH = 5.8;
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, rowH, 'FD');

    const s = row.series;
    const specText =
      s.source === 'experimental'
        ? s.sourceDetail || 'Test stand CSV/XLSX'
        : [s.motorClass ? `Class ${s.motorClass}` : '', s.propellantSummary, s.chamberSummary, s.nozzleSummary]
            .filter(Boolean)
            .join(' · ');
    const channels = [
      row.metrics.hasPressure ? 'P' : null,
      row.metrics.hasThrust ? 'F' : null,
    ]
      .filter(Boolean)
      .join(' + ');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(15, 23, 42);
    doc.text(
      sanitizePdfText(s.name.length > 22 ? `${s.name.slice(0, 20)}..` : s.name),
      16,
      y + 4.0
    );

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      sanitizePdfText(specText.length > 52 ? `${specText.slice(0, 50)}..` : specText),
      60,
      y + 4.0
    );

    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(channels || '-'), 156, y + 4.0);
    doc.text(sanitizePdfText(`${s.timeOffsetSec >= 0 ? '+' : ''}${s.timeOffsetSec.toFixed(3)} s`), 194, y + 4.0, {
      align: 'right',
    });

    y += rowH;
  });

  // =========================================================================
  // PAGE 2: OVERLAID PRESSURE & THRUST CHARTS
  // =========================================================================
  doc.addPage();
  y = 28;
  y = drawSectionHeading(doc, labels.chartsSection, y);

  const pChartSeries: ChartSeries[] = [];
  const fChartSeries: ChartSeries[] = [];

  effectiveSeries.forEach((s) => {
    const shift = Number(s.timeOffsetSec) || 0;
    const pPair = getSeriesPressureArray(s);
    if (pPair) {
      pChartSeries.push({
        label: s.name,
        color: s.color,
        x: pPair.t.map((tv) => tv + shift),
        y: pPair.yMPa.map((yv) => yv * pMult),
        dashed: s.source === 'experimental',
      });
    }
    const fPair = getSeriesThrustArray(s, studyState.thrustModel);
    if (fPair) {
      fChartSeries.push({
        label: s.name,
        color: s.color,
        x: fPair.t.map((tv) => tv + shift),
        y: fPair.y,
        dashed: s.source === 'experimental',
      });
    }
  });

  if (pChartSeries.length > 0) {
    const pImg = renderEngineeringChartDataUrl({
      title: labels.pChartTitle,
      xLabel: labels.xAxisTime,
      yLeftLabel: pUnitStr === 'bar' ? labels.yAxisPressureBar : labels.yAxisPressureMPa,
      series: pChartSeries,
    });
    if (pImg) {
      doc.addImage(pImg, 'PNG', 14, y, 182, 86);
      y += 92;
    }
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 16, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(labels.noPressureCurves), 105, y + 9.5, { align: 'center' });
    y += 22;
  }

  if (fChartSeries.length > 0) {
    const fImg = renderEngineeringChartDataUrl({
      title: labels.fChartTitle,
      xLabel: labels.xAxisTime,
      yLeftLabel: labels.yAxisThrust,
      series: fChartSeries,
    });
    if (fImg) {
      doc.addImage(fImg, 'PNG', 14, y, 182, 86);
    }
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 16, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(labels.noThrustCurves), 105, y + 9.5, { align: 'center' });
  }

  decorateAllPagesWithChromeAndWatermark(doc, labels, reportTitle, docRef, exportedStr, logoAsset);
  return doc;
}

export async function exportStudyPdf(opts: StudyPdfReportOptions): Promise<void> {
  const logoAsset = await loadCoheterosLogoAsset();
  const doc = buildStudyPdfDocument(opts, logoAsset);
  const rawName = (opts.filename || opts.studyState.studyTitle || 'HERMES_Study').trim();
  const cleaned = rawName
    .replace(/\.(pdf)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.+$/, '')
    .trim();
  const safeName = `${cleaned || 'HERMES_Study'}.pdf`;

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
