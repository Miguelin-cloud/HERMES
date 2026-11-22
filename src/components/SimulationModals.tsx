import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, FileText, Folder, FolderOpen, Info, Trash2, UploadCloud } from 'lucide-react';
import { CustomPropellant, GrainInput, MotorInput, NozzleInput, SimulationResults } from '../lib/types';
import { MotorStructureResult, PadmGoverningLimit } from '../lib/motorStructure';
import { SavedSimulationEntry } from '../hooks/useSimulationStorage';
import { trackEvent } from '../lib/telemetry';
import { ApogeeResult } from '../lib/apogee';
import { Language } from '../lib/i18n';
import {
  CsvDecimalSeparator,
  ExcelOrientation,
  exportSimulationCsv,
  exportSimulationXlsx,
} from '../lib/exportResults';
import { exportSimulationPdf } from '../lib/pdfReport';
import { getCompleteMissionControlSnapshot } from '../lib/missionControlStorage';
import { getReferencedCustomPropellants } from '../lib/hermesFile';

interface SimulationModalsProps {
  t: any;
  lang: Language;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  exportFilename: string;
  setExportFilename: (v: string) => void;
  exportFormat: 'csv' | 'xlsx' | 'pdf';
  setExportFormat: (v: 'csv' | 'xlsx' | 'pdf') => void;
  results: SimulationResults | null;
  customPropellants: CustomPropellant[];
  simApogee: ApogeeResult | null;

  showFeedbackModal: boolean;
  setShowFeedbackModal: (v: boolean) => void;
  feedbackMessage: string;
  setFeedbackMessage: (v: string) => void;

  showSaveModal: boolean;
  setShowSaveModal: (v: boolean) => void;
  saveName: string;
  setSaveName: (v: string) => void;
  saveFolder: string;
  setSaveFolder: (v: string) => void;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  savedSimulations: SavedSimulationEntry[];
  setSavedSimulations: React.Dispatch<React.SetStateAction<SavedSimulationEntry[]>>;

  showLibraryModal: boolean;
  setShowLibraryModal: (v: boolean) => void;
  onLoadSimulation: (entry: SavedSimulationEntry) => void;
  onOpenHermesImport?: () => void;

  showPadmInfo: boolean;
  setShowPadmInfo: (v: boolean) => void;
  motorStruct: MotorStructureResult;

  simToDelete: string | null;
  setSimToDelete: (v: string | null) => void;
}

export const SimulationModals: React.FC<SimulationModalsProps> = ({
  t,
  lang,
  showExportModal,
  setShowExportModal,
  exportFilename,
  setExportFilename,
  exportFormat,
  setExportFormat,
  results,
  customPropellants,
  simApogee,
  showFeedbackModal,
  setShowFeedbackModal,
  feedbackMessage,
  setFeedbackMessage,
  showSaveModal,
  setShowSaveModal,
  saveName,
  setSaveName,
  saveFolder,
  setSaveFolder,
  motor,
  nozzle,
  grains,
  savedSimulations,
  setSavedSimulations,
  showLibraryModal,
  setShowLibraryModal,
  onLoadSimulation,
  onOpenHermesImport,
  showPadmInfo,
  setShowPadmInfo,
  motorStruct,
  simToDelete,
  setSimToDelete,
}) => {
  const [pdfReportTitle, setPdfReportTitle] = useState('');
  const [includeMcInPdf, setIncludeMcInPdf] = useState(true);
  const [saveIncludeMc, setSaveIncludeMc] = useState(true);
  const [csvDecimalSeparator, setCsvDecimalSeparator] = useState<CsvDecimalSeparator>(
    lang === 'en' ? 'dot' : 'comma'
  );
  const [xlsxOrientation, setXlsxOrientation] = useState<ExcelOrientation>('columns');
  const [isExporting, setIsExporting] = useState(false);
  const defaultFilenameRef = useRef<string>('');
  const hasManualFilenameEditRef = useRef<boolean>(false);

  useEffect(() => {
    setCsvDecimalSeparator(lang === 'en' ? 'dot' : 'comma');
  }, [lang]);

  useEffect(() => {
    if (showExportModal) {
      defaultFilenameRef.current = exportFilename || `HERMES_Results_${motor.Dc}mm`;
      hasManualFilenameEditRef.current = false;
      setPdfReportTitle('');
    }
  }, [showExportModal]);

  const hasFlightData = Boolean(simApogee && simApogee.t && simApogee.t.length > 0);

  return (
    <>
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false);
          }}
        >
          <div className="bg-card w-full max-w-md rounded-xl p-6 shadow-xl border border-border space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>{t.export_modal_title}</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowExportModal(false)} className="h-7 w-7 p-0 rounded-full cursor-pointer">
                ✕
              </Button>
            </div>

            <div>
              <UiLabel className="text-xs font-semibold">{t.export_filename}</UiLabel>
              <Input
                value={exportFilename}
                placeholder={defaultFilenameRef.current || `HERMES_Results_${motor.Dc}mm`}
                onChange={(e) => {
                  hasManualFilenameEditRef.current = true;
                  setExportFilename(e.target.value);
                }}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <UiLabel className="text-xs font-semibold">{t.export_format}</UiLabel>
              <Select
                value={exportFormat}
                onValueChange={(v) => {
                  if (v) setExportFormat(v as 'csv' | 'xlsx' | 'pdf');
                }}
              >
                <SelectTrigger className="mt-1 w-full text-xs bg-background cursor-pointer">
                  <SelectValue>
                    <span className="truncate">
                      {exportFormat === 'csv'
                        ? t.export_csv_opt
                        : exportFormat === 'xlsx'
                          ? t.export_xlsx_opt
                          : t.export_pdf_opt}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="csv" className="text-xs cursor-pointer">{t.export_csv_opt}</SelectItem>
                  <SelectItem value="xlsx" className="text-xs cursor-pointer">{t.export_xlsx_opt}</SelectItem>
                  <SelectItem value="pdf" className="text-xs cursor-pointer">{t.export_pdf_opt}</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                {exportFormat === 'csv'
                  ? t.export_csv_hint
                  : exportFormat === 'xlsx'
                    ? t.export_xlsx_hint
                    : t.export_pdf_hint}
              </p>
            </div>

            {exportFormat === 'csv' && (
              <div className="space-y-1.5 pt-1 border-t border-border/70">
                <UiLabel className="text-xs font-semibold">{t.export_csv_decimal_label}</UiLabel>
                <div className="space-y-1.5">
                  <label
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      csvDecimalSeparator === 'dot'
                        ? 'border-primary bg-primary/8 font-medium'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="csv-decimal"
                      checked={csvDecimalSeparator === 'dot'}
                      onChange={() => setCsvDecimalSeparator('dot')}
                      className="accent-primary"
                    />
                    <span>{t.export_csv_dec_dot}</span>
                  </label>
                  <label
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      csvDecimalSeparator === 'comma'
                        ? 'border-primary bg-primary/8 font-medium'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="csv-decimal"
                      checked={csvDecimalSeparator === 'comma'}
                      onChange={() => setCsvDecimalSeparator('comma')}
                      className="accent-primary"
                    />
                    <span>{t.export_csv_dec_comma}</span>
                  </label>
                </div>
              </div>
            )}

            {exportFormat === 'xlsx' && (
              <div className="space-y-1.5 pt-1 border-t border-border/70">
                <UiLabel className="text-xs font-semibold">{t.export_xlsx_layout_label}</UiLabel>
                <div className="space-y-1.5">
                  <label
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      xlsxOrientation === 'columns'
                        ? 'border-primary bg-primary/8 font-medium'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="xlsx-layout"
                      checked={xlsxOrientation === 'columns'}
                      onChange={() => setXlsxOrientation('columns')}
                      className="accent-primary"
                    />
                    <span>{t.export_xlsx_by_cols}</span>
                  </label>
                  <label
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      xlsxOrientation === 'rows'
                        ? 'border-primary bg-primary/8 font-medium'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="xlsx-layout"
                      checked={xlsxOrientation === 'rows'}
                      onChange={() => setXlsxOrientation('rows')}
                      className="accent-primary"
                    />
                    <span>{t.export_xlsx_by_rows}</span>
                  </label>
                </div>
              </div>
            )}

            {exportFormat === 'pdf' && (
              <div className="space-y-3 pt-1 border-t border-border/70">
                <div>
                  <UiLabel className="text-xs font-semibold">{t.export_pdf_title_label}</UiLabel>
                  <Input
                    value={pdfReportTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPdfReportTitle(val);
                      if (!hasManualFilenameEditRef.current) {
                        setExportFilename(val.trim() ? val : defaultFilenameRef.current);
                      }
                    }}
                    placeholder={t.export_pdf_title_placeholder}
                    className="mt-1 text-xs"
                  />
                </div>
                {hasFlightData ? (
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/30 cursor-pointer select-none">
                    <Checkbox
                      checked={includeMcInPdf}
                      onCheckedChange={(v) => setIncludeMcInPdf(Boolean(v))}
                    />
                    <span className="text-xs text-foreground">{t.export_pdf_include_mc}</span>
                  </label>
                ) : (
                  <div className="p-2.5 rounded-lg border border-border bg-muted/25 text-[11px] text-muted-foreground">
                    {t.export_pdf_no_mc_hint}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowExportModal(false)} className="cursor-pointer">
                {t.cancel_btn}
              </Button>
              <Button
                disabled={!results || isExporting}
                className="cursor-pointer"
                onClick={async () => {
                  if (!results || isExporting) return;
                  const mcSnap = getCompleteMissionControlSnapshot(false);
                  const effectiveFilename =
                    exportFilename.trim() ||
                    (exportFormat === 'pdf' ? pdfReportTitle.trim() : '') ||
                    defaultFilenameRef.current ||
                    `HERMES_Results_${motor.Dc}mm`;
                  if (exportFormat === 'csv') {
                    exportSimulationCsv(results, effectiveFilename, csvDecimalSeparator);
                  } else if (exportFormat === 'xlsx') {
                    exportSimulationXlsx({
                      filename: effectiveFilename,
                      results,
                      motor,
                      nozzle,
                      grains,
                      customPropellants,
                      motorStruct,
                      simApogee,
                      mcSnapshot: mcSnap,
                      lang,
                      orientation: xlsxOrientation,
                    });
                  } else {
                    setIsExporting(true);
                    try {
                      await exportSimulationPdf({
                        reportTitle: pdfReportTitle.trim() || undefined,
                        filename: effectiveFilename,
                        results,
                        motor,
                        nozzle,
                        grains,
                        customPropellants,
                        motorStruct,
                        simApogee,
                        mcSnapshot: mcSnap,
                        includeMissionControl: Boolean(hasFlightData && includeMcInPdf),
                        lang,
                      });
                    } finally {
                      setIsExporting(false);
                    }
                  }
                  trackEvent('export_data');
                  setShowExportModal(false);
                }}
              >
                {t.download_btn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border">
            <h2 className="text-lg font-bold mb-4">{t.feedback_modal_title}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t.feedback_modal_desc}</p>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              className="w-full h-32 p-2 text-sm border rounded bg-input text-foreground mb-4 resize-none"
              placeholder={t.feedback_placeholder}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFeedbackModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                onClick={() => {
                  window.location.href = `mailto:info@coheteros.com?subject=Hermes%20App%20Feedback&body=${encodeURIComponent(feedbackMessage)}`;
                  setShowFeedbackModal(false);
                  setFeedbackMessage('');
                }}
              >
                {t.send_btn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSaveModal(false);
          }}
        >
          <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{t.save_modal_title}</h2>
            <div className="space-y-4 mb-4">
              <div>
                <UiLabel>{t.sim_name_label}</UiLabel>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="mt-1"
                  placeholder={t.sim_name_placeholder}
                />
              </div>
              <div>
                <UiLabel>{t.folder_group_label}</UiLabel>
                <Input
                  value={saveFolder}
                  onChange={(e) => setSaveFolder(e.target.value)}
                  className="mt-1"
                  placeholder={t.folder_group_placeholder}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={saveIncludeMc}
                  onCheckedChange={(v) => setSaveIncludeMc(Boolean(v))}
                />
                <span>{t.hermes_save_include_mc}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                onClick={() => {
                  if (!saveName.trim()) return;
                  const bundled = getReferencedCustomPropellants(grains, customPropellants);
                  const newSim: SavedSimulationEntry = {
                    id: Date.now().toString(),
                    name: saveName.trim(),
                    folder: saveFolder.trim() || 'General',
                    timestamp: Date.now(),
                    motor,
                    nozzle,
                    grains,
                    ...(bundled.length > 0 ? { bundledPropellants: bundled } : {}),
                    ...(saveIncludeMc ? { missionControl: getCompleteMissionControlSnapshot(true) } : {}),
                  };
                  setSavedSimulations([...savedSimulations, newSim]);
                  setSaveName('');
                  setShowSaveModal(false);
                }}
              >
                {t.save_btn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLibraryModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLibraryModal(false);
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-lg p-0 shadow-xl border border-border overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border bg-muted flex justify-between items-center gap-2 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderOpen size={20} />
                {t.library_modal_title}
              </h2>
              <div className="flex items-center gap-2">
                {onOpenHermesImport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowLibraryModal(false);
                      onOpenHermesImport();
                    }}
                    className="h-7 text-xs gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UploadCloud size={14} />
                    <span>{t.hermes_library_import_btn}</span>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowLibraryModal(false)} className="h-8 w-8 p-0 cursor-pointer">
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-background">
              {savedSimulations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">{t.no_saved_sims}</div>
              ) : (
                <div className="space-y-6">
                  {Array.from(new Set(savedSimulations.map((s) => s.folder || 'General')))
                    .sort()
                    .map((folder) => {
                      const simsInFolder = savedSimulations.filter((s) => (s.folder || 'General') === folder);
                      return (
                        <div key={folder} className="space-y-2">
                          <h3 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border pb-1">
                            <Folder size={14} className="text-muted-foreground" />
                            {folder}
                            <span className="text-xs font-normal text-muted-foreground ml-auto">{simsInFolder.length}</span>
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {simsInFolder.map((sim) => (
                              <div
                                key={sim.id}
                                className="group flex items-center justify-between p-3 rounded-md border border-border bg-card hover:border-primary/50 transition-colors"
                              >
                                <div
                                  className="flex-1 cursor-pointer overflow-hidden"
                                  onClick={() => {
                                    onLoadSimulation(sim);
                                    setShowLibraryModal(false);
                                  }}
                                >
                                  <div className="font-semibold text-sm truncate">{sim.name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                    <span>{new Date(sim.timestamp).toLocaleString()}</span>
                                    {sim.missionControl && (
                                      <span className="font-mono text-primary">{t.hermes_has_mc_tag}</span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSimToDelete(sim.id);
                                  }}
                                  title={t.delete_sim_tooltip}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPadmInfo && (() => {
        const ri = Math.max(0, (motor.Dc || 0) / 2);
        const ro = ri + Math.max(0, motorStruct.wallThicknessMm);
        const limitLabelMap: Record<PadmGoverningLimit, string> = {
          cylinder: t.padm_limit_cylinder,
          bolt_shear: t.padm_limit_bolt_shear,
          wall_bearing: t.padm_limit_wall_bearing,
          net_section: t.padm_limit_net_section,
        };
        const governingLabel = limitLabelMap[motorStruct.governingLimit];
        const allowTubeMPa = motorStruct.yieldStrengthMPa / motorStruct.safetyFactor;
        const allowBoltShearMPa = (motorStruct.boltYieldStrengthMPa / Math.sqrt(3)) / motorStruct.safetyFactor;
        const allowBearingMPa = 1.5 * allowTubeMPa;
        const grossWallAreaMm2 = Math.PI * Math.max(0, ro * ro - ri * ri);
        const holesAreaMm2 = motorStruct.boltCount * motorStruct.boltDiameterMm * motorStruct.wallThicknessMm;
        const netWallAreaMm2 = Math.max(0, grossWallAreaMm2 - holesAreaMm2);

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPadmInfo(false);
            }}
          >
            <div
              className="bg-card text-foreground w-full max-w-2xl rounded-xl p-5 shadow-2xl border border-border space-y-3.5 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide">{t.padm_modal_title}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPadmInfo(false)} className="h-7 w-7 p-0 rounded-full">
                  ✕
                </Button>
              </div>

              {/* Global Padm & Governing Summary */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-semibold">
                    {t.padm_modal_governing_summary}: <span className="underline">{governingLabel}</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {t.padm_modal_axial_force_note}:{' '}
                    <strong className="text-foreground">
                      {motorStruct.axialForceAtPadmKN.toFixed(2)} kN
                    </strong>{' '}
                    <span className="opacity-80">({(motorStruct.axialForceAtPadmKN * 1000).toFixed(0)} N)</span>
                  </div>
                </div>
                <div className="text-right font-mono shrink-0">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">
                    {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ({motorStruct.maxAdmissiblePressureBar.toFixed(1)} bar)
                  </div>
                </div>
              </div>

              {/* Section 1: Lamé Cylinder Wall */}
              <div className={`p-3 rounded-lg border space-y-2 ${
                motorStruct.governingLimit === 'cylinder'
                  ? 'bg-sky-500/10 border-sky-500/50'
                  : 'bg-muted/45 border-border'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t.padm_modal_formula_title}
                  </h3>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {motorStruct.cylinderPressureMPa.toFixed(2)} MPa
                    {motorStruct.governingLimit === 'cylinder' && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9.5px] uppercase">MIN</span>
                    )}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">{t.padm_modal_formula_desc}</p>
                <div className="p-2 rounded bg-background border border-border font-mono text-[11px] text-center font-bold text-foreground">
                  P_adm,cil = (σy,tubo / FS) · (rₒ² − rᵢ²) / (rₒ² + rᵢ²)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] font-mono pt-0.5 text-muted-foreground">
                  <span>rᵢ = <strong className="text-foreground">{ri.toFixed(2)} mm</strong></span>
                  <span>rₒ = <strong className="text-foreground">{ro.toFixed(2)} mm</strong></span>
                  <span>σy = <strong className="text-foreground">{motorStruct.yieldStrengthMPa} MPa</strong></span>
                  <span>FS = <strong className="text-foreground">{motorStruct.safetyFactor.toFixed(2)}</strong></span>
                </div>
              </div>

              {/* Section 2: Radial Bolted Closure */}
              {motorStruct.hasBoltedClosure ? (
                <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2.5">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      {t.padm_modal_radial_title}
                    </h3>
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed">{t.padm_modal_radial_desc}</p>
                    <div className="p-2 rounded bg-background border border-border font-mono text-[11px] text-center font-bold text-foreground">
                      F_axial = P · A_bore = P · π·rᵢ² &nbsp;|&nbsp; A_bore = {motorStruct.boreAreaMm2.toFixed(1)} mm² &nbsp;|&nbsp; {motorStruct.boltCount}× {motorStruct.boltMetric} (σy={motorStruct.boltYieldStrengthMPa} MPa)
                    </div>
                  </div>

                  {/* 2A: Radial Bolt Single Shear */}
                  <div className={`p-2.5 rounded-md border space-y-1 ${
                    motorStruct.governingLimit === 'bolt_shear'
                      ? 'bg-sky-500/12 border-sky-500/55'
                      : 'bg-background/70 border-border/80'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-foreground">{t.padm_modal_shear_title}</h4>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {(motorStruct.boltShearPressureMPa ?? 0).toFixed(2)} MPa
                        {motorStruct.governingLimit === 'bolt_shear' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] uppercase">MIN</span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.padm_modal_shear_desc}</p>
                    <div className="font-mono text-[10.5px] text-foreground/90 bg-muted/40 px-2 py-1 rounded">
                      P_adm,torn = [Nb · As · (σy,torn / (√3 · FS))] / A_bore = ({motorStruct.boltCount} · {motorStruct.boltStressAreaMm2} · {allowBoltShearMPa.toFixed(1)}) / {motorStruct.boreAreaMm2.toFixed(1)}
                    </div>
                  </div>

                  {/* 2B: Tube Wall Bearing */}
                  <div className={`p-2.5 rounded-md border space-y-1 ${
                    motorStruct.governingLimit === 'wall_bearing'
                      ? 'bg-sky-500/12 border-sky-500/55'
                      : 'bg-background/70 border-border/80'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-foreground">{t.padm_modal_bearing_title}</h4>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {(motorStruct.wallBearingPressureMPa ?? 0).toFixed(2)} MPa
                        {motorStruct.governingLimit === 'wall_bearing' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] uppercase">MIN</span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.padm_modal_bearing_desc}</p>
                    <div className="font-mono text-[10.5px] text-foreground/90 bg-muted/40 px-2 py-1 rounded">
                      P_adm,aplast = [Nb · d · t · (1.5·σy,tubo / FS)] / A_bore = ({motorStruct.boltCount} · {motorStruct.boltDiameterMm} · {motorStruct.wallThicknessMm.toFixed(1)} · {allowBearingMPa.toFixed(1)}) / {motorStruct.boreAreaMm2.toFixed(1)}
                    </div>
                  </div>

                  {/* 2C: Perforated Tube Net Section */}
                  <div className={`p-2.5 rounded-md border space-y-1 ${
                    motorStruct.governingLimit === 'net_section'
                      ? 'bg-sky-500/12 border-sky-500/55'
                      : 'bg-background/70 border-border/80'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-foreground">{t.padm_modal_net_title}</h4>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {(motorStruct.netSectionPressureMPa ?? 0).toFixed(2)} MPa
                        {motorStruct.governingLimit === 'net_section' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] uppercase">MIN</span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.padm_modal_net_desc}</p>
                    <div className="font-mono text-[10.5px] text-foreground/90 bg-muted/40 px-2 py-1 rounded">
                      P_adm,neta = [(π·(rₒ²−rᵢ²) − Nb·d·t) · (σy,tubo / FS)] / A_bore = ({netWallAreaMm2.toFixed(1)} · {allowTubeMPa.toFixed(1)}) / {motorStruct.boreAreaMm2.toFixed(1)}
                    </div>
                  </div>

                  {/* Practical geometry check */}
                  <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/35 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="font-bold text-amber-800 dark:text-amber-300">{t.padm_modal_practice_title}</span>
                      <span className="text-foreground">
                        p = {(motorStruct.boltPitchMm ?? 0).toFixed(1)} mm (min {(2.2 * motorStruct.boltDiameterMm).toFixed(1)}) · e ≥ {(motorStruct.minEdgeDistanceMm ?? 0).toFixed(1)} mm
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{t.padm_modal_practice_desc}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 space-y-1.5">
                  <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t.padm_modal_bolt_title}</span>
                  </h3>
                  <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">{t.padm_modal_bolt_desc}</p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5">
                <h3 className="text-xs font-bold text-foreground">{t.padm_modal_materials_title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{t.padm_modal_materials_desc}</p>
              </div>

              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={() => setShowPadmInfo(false)} className="text-xs font-bold">
                  {t.close_btn}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {simToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-destructive">
              <Trash2 size={20} />
              {t.confirm_delete_title}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{t.confirm_delete_desc}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSimToDelete(null)}>
                {t.cancel_btn}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setSavedSimulations(savedSimulations.filter((s) => s.id !== simToDelete));
                  setSimToDelete(null);
                }}
              >
                {t.delete_btn}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
