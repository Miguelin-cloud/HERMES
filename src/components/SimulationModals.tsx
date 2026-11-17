import React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Folder, FolderOpen, Info, Trash2 } from 'lucide-react';
import { GrainInput, MotorInput, NozzleInput } from '../lib/types';
import { MotorStructureResult, normalizeMotorWithStructure } from '../lib/motorStructure';
import { SavedSimulationEntry } from '../hooks/useSimulationStorage';
import { trackEvent } from '../lib/telemetry';

interface SimulationModalsProps {
  t: any;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  exportFilename: string;
  setExportFilename: (v: string) => void;
  exportFormat: 'csv' | 'xlsx';
  setExportFormat: (v: 'csv' | 'xlsx') => void;
  exportData: any[] | null;

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
  onLoadSimulation: (motor: MotorInput, nozzle: NozzleInput, grains: GrainInput[]) => void;

  showPadmInfo: boolean;
  setShowPadmInfo: (v: boolean) => void;
  motorStruct: MotorStructureResult;

  simToDelete: string | null;
  setSimToDelete: (v: string | null) => void;
}

export const SimulationModals: React.FC<SimulationModalsProps> = ({
  t,
  showExportModal,
  setShowExportModal,
  exportFilename,
  setExportFilename,
  exportFormat,
  setExportFormat,
  exportData,
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
  showPadmInfo,
  setShowPadmInfo,
  motorStruct,
  simToDelete,
  setSimToDelete,
}) => {
  return (
    <>
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border">
            <h2 className="text-lg font-bold mb-4">{t.export_modal_title}</h2>
            <div className="mb-4">
              <UiLabel>{t.export_filename}</UiLabel>
              <Input value={exportFilename} onChange={(e) => setExportFilename(e.target.value)} className="mt-1" />
            </div>
            <div className="mb-6">
              <UiLabel>{t.export_format}</UiLabel>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">{t.export_csv_opt}</SelectItem>
                  <SelectItem value="xlsx">{t.export_xlsx_opt}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExportModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                onClick={() => {
                  if (exportData) {
                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Results');

                    if (exportFormat === 'csv') {
                      XLSX.writeFile(wb, `${exportFilename}.csv`, { bookType: 'csv' });
                    } else {
                      XLSX.writeFile(wb, `${exportFilename}.xlsx`, { bookType: 'xlsx' });
                    }
                    trackEvent('export_data');
                    setShowExportModal(false);
                  }
                }}
              >
                {t.download_btn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border">
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
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                onClick={() => {
                  if (!saveName.trim()) return;
                  const newSim: SavedSimulationEntry = {
                    id: Date.now().toString(),
                    name: saveName.trim(),
                    folder: saveFolder.trim() || 'General',
                    timestamp: Date.now(),
                    motor,
                    nozzle,
                    grains,
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-lg p-0 shadow-xl border border-border overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-border bg-muted flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderOpen size={20} />
                {t.library_modal_title}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowLibraryModal(false)} className="h-8 w-8 p-0">
                ✕
              </Button>
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
                                    onLoadSimulation(normalizeMotorWithStructure(sim.motor), sim.nozzle, sim.grains);
                                    setShowLibraryModal(false);
                                  }}
                                >
                                  <div className="font-semibold text-sm truncate">{sim.name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(sim.timestamp).toLocaleString()}</div>
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
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowPadmInfo(false)}>
            <div
              className="bg-card text-foreground w-full max-w-lg rounded-xl p-5 shadow-2xl border border-border space-y-3.5 max-h-[90vh] overflow-y-auto"
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

              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t.padm_modal_formula_title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.padm_modal_formula_desc}</p>
                <div className="p-2.5 rounded bg-background border border-border font-mono text-xs text-center font-bold text-foreground">
                  Padm = (σy / FS) · (rₒ² − rᵢ²) / (rₒ² + rᵢ²)
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono pt-1 text-muted-foreground">
                  <span>
                    rᵢ = Dc / 2 = <strong className="text-foreground">{ri.toFixed(2)} mm</strong>
                  </span>
                  <span>
                    rₒ = rᵢ + e = <strong className="text-foreground">{ro.toFixed(2)} mm</strong>
                  </span>
                  <span>
                    σy = <strong className="text-foreground">{motorStruct.yieldStrengthMPa} MPa</strong>
                  </span>
                  <span>
                    FS = <strong className="text-foreground">{motorStruct.safetyFactor.toFixed(2)}</strong>
                  </span>
                </div>
                <div className="pt-1.5 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-muted-foreground">{t.max_admissible_p}:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa ({motorStruct.maxAdmissiblePressureBar.toFixed(1)} bar)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 space-y-1.5">
                <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t.padm_modal_bolt_title}</span>
                </h3>
                <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">{t.padm_modal_bolt_desc}</p>
              </div>

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
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
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
