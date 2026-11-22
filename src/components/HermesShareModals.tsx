import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FolderPlus,
  Package,
  UploadCloud,
  X,
} from 'lucide-react';
import { CustomPropellant, GrainInput, MotorInput, NozzleInput } from '../lib/types';
import {
  MissionControlSnapshot,
  getCompleteMissionControlSnapshot,
} from '../lib/missionControlStorage';
import {
  HermesProjectFileV1,
  HermesProjectScope,
  buildHermesProjectFile,
  downloadHermesFile,
  getReferencedCustomPropellants,
  parseAndValidateHermesFile,
  resolveImportedPropellants,
} from '../lib/hermesFile';
import { SavedSimulationEntry } from '../hooks/useSimulationStorage';
import { trackEvent } from '../lib/telemetry';

export interface HermesApplyPayload {
  motor?: MotorInput;
  nozzle?: NozzleInput;
  grains?: GrainInput[];
  nextCustomPropellants?: CustomPropellant[];
  missionControl?: MissionControlSnapshot;
}

interface HermesShareModalsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import';
  t: any;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  motorClassHint?: string;
  onApplyImportedWorkspace: (payload: HermesApplyPayload) => void;
  onSaveImportedToLibrary: (entry: SavedSimulationEntry) => void;
  onPersistCustomPropellants?: (nextProps: CustomPropellant[]) => void;
}

export const HermesShareModals: React.FC<HermesShareModalsProps> = ({
  isOpen,
  onClose,
  initialTab = 'export',
  t,
  motor,
  nozzle,
  grains,
  customPropellants,
  motorClassHint,
  onApplyImportedWorkspace,
  onSaveImportedToLibrary,
  onPersistCustomPropellants,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [projectName, setProjectName] = useState('');
  const [scope, setScope] = useState<HermesProjectScope>('both');
  const [includeExp, setIncludeExp] = useState(true);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedPkg, setParsedPkg] = useState<HermesProjectFileV1 | null>(null);
  const [applyInputs, setApplyInputs] = useState(true);
  const [applyMc, setApplyMc] = useState(true);
  const [libName, setLibName] = useState('');
  const [libFolder, setLibFolder] = useState('Imported');
  const [importStatus, setImportStatus] = useState<{
    message: string;
    addedProps: string[];
    reusedProps: string[];
  } | null>(null);

  const [mcSnapshot, setMcSnapshot] = useState<MissionControlSnapshot>(() =>
    getCompleteMissionControlSnapshot(true)
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setMcSnapshot(getCompleteMissionControlSnapshot(true));
    setProjectName(`HERMES_${motor.Dc}mm${motorClassHint ? `_${motorClassHint}` : ''}`);
    setExportFeedback(null);
    setImportError(null);
    setImportStatus(null);
  }, [isOpen, initialTab, motor.Dc, motorClassHint]);

  const referencedProps = useMemo(
    () => getReferencedCustomPropellants(grains, customPropellants),
    [grains, customPropellants]
  );

  const aeroPointCount = useMemo(() => {
    if (!mcSnapshot.aerodynamics.useAeroData || !mcSnapshot.aerodynamics.aeroDataRaw.trim()) return 0;
    return mcSnapshot.aerodynamics.aeroDataRaw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0).length;
  }, [mcSnapshot]);

  const expRowCount = mcSnapshot.experimental?.expDataRaw.length ?? 0;

  if (!isOpen) return null;

  const handleExportDownload = () => {
    const freshMc = getCompleteMissionControlSnapshot(includeExp);
    const pkg = buildHermesProjectFile({
      projectName: projectName.trim() || `HERMES_${motor.Dc}mm`,
      scope,
      motor,
      nozzle,
      grains,
      customPropellants,
      missionControl: freshMc,
      includeExperimental: includeExp,
      motorClassHint,
    });
    downloadHermesFile(pkg, projectName || pkg.projectName);
    trackEvent('export_data');
    setExportFeedback(t.hermes_exported_ok);
  };

  const handleReadFile = async (file: File | undefined | null) => {
    if (!file) return;
    setImportError(null);
    setImportStatus(null);
    try {
      const text = await file.text();
      const res = parseAndValidateHermesFile(
        text,
        file.name.replace(/\.(hrms|hermes|json)$/i, '')
      );
      if (!res.ok) {
        if ('errorCode' in res) {
          const map: Record<string, string> = {
            invalid_json: t.hermes_err_invalid_json,
            invalid_format: t.hermes_err_invalid_format,
            unsupported_version: t.hermes_err_unsupported_version,
            missing_sections: t.hermes_err_missing_sections,
          };
          setImportError(map[res.errorCode] || t.hermes_err_invalid_format);
        }
        setParsedPkg(null);
        return;
      }
      setParsedPkg(res.data);
      setApplyInputs(Boolean(res.data.inputs));
      setApplyMc(Boolean(res.data.missionControl));
      setLibName(res.data.projectName);
      setLibFolder('Imported');
    } catch {
      setImportError(t.hermes_err_invalid_json);
      setParsedPkg(null);
    }
  };

  const executeImport = (mode: 'active' | 'library' | 'both') => {
    if (!parsedPkg) return;
    const willApplyInputs = Boolean(parsedPkg.inputs && applyInputs);
    const willApplyMc = Boolean(parsedPkg.missionControl && applyMc);
    if (!willApplyInputs && !willApplyMc) return;

    let addedProps: string[] = [];
    let reusedProps: string[] = [];
    let resolvedGrains = parsedPkg.inputs?.grains;
    let nextCustomPropellants: CustomPropellant[] | undefined;

    if (willApplyInputs && parsedPkg.inputs) {
      const resolved = resolveImportedPropellants(
        parsedPkg.inputs.bundledPropellants || [],
        parsedPkg.inputs.grains,
        customPropellants
      );
      addedProps = resolved.addedNames;
      reusedProps = resolved.reusedNames;
      resolvedGrains = resolved.remappedGrains;
      if (addedProps.length > 0) {
        nextCustomPropellants = resolved.nextCustomPropellants;
      }
    }

    if ((mode === 'library' || mode === 'both') && willApplyInputs && parsedPkg.inputs) {
      const libraryGrains = resolvedGrains || parsedPkg.inputs.grains;
      const libraryPropCatalog = nextCustomPropellants || customPropellants;
      const libraryBundledProps = getReferencedCustomPropellants(libraryGrains, libraryPropCatalog);

      if (mode === 'library' && nextCustomPropellants) {
        onPersistCustomPropellants?.(nextCustomPropellants);
      }

      const entry: SavedSimulationEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: libName.trim() || parsedPkg.projectName,
        folder: libFolder.trim() || 'Imported',
        timestamp: Date.now(),
        motor: parsedPkg.inputs.motor,
        nozzle: parsedPkg.inputs.nozzle,
        grains: libraryGrains,
        ...(libraryBundledProps.length > 0
          ? { bundledPropellants: libraryBundledProps }
          : {}),
        ...(willApplyMc && parsedPkg.missionControl
          ? { missionControl: parsedPkg.missionControl }
          : {}),
      };
      onSaveImportedToLibrary(entry);
    }

    if (mode === 'active' || mode === 'both') {
      onApplyImportedWorkspace({
        ...(willApplyInputs && parsedPkg.inputs
          ? {
              motor: parsedPkg.inputs.motor,
              nozzle: parsedPkg.inputs.nozzle,
              grains: resolvedGrains || parsedPkg.inputs.grains,
              ...(nextCustomPropellants ? { nextCustomPropellants } : {}),
            }
          : {}),
        ...(willApplyMc && parsedPkg.missionControl
          ? { missionControl: parsedPkg.missionControl }
          : {}),
      });
    }

    setImportStatus({
      message: t.hermes_imported_ok,
      addedProps,
      reusedProps,
    });
  };

  const canActOnImport = Boolean(
    parsedPkg && ((parsedPkg.inputs && applyInputs) || (parsedPkg.missionControl && applyMc))
  );
  const canSaveLibrary = Boolean(parsedPkg?.inputs && applyInputs);

  const scopeLabelText = (s: HermesProjectScope) =>
    s === 'both' ? t.hermes_scope_both : s === 'inputs' ? t.hermes_scope_inputs : t.hermes_scope_mc;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card text-foreground w-full max-w-xl rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-border bg-muted/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">{t.hermes_modal_title}</h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 rounded-full cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-border/60 bg-background/40 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-lg border border-border">
            <button
              type="button"
              onClick={() => {
                setActiveTab('export');
                setExportFeedback(null);
              }}
              className={`h-8 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-card text-primary shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{t.hermes_export_tab}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('import');
                setImportStatus(null);
              }}
              className={`h-8 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-card text-primary shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 shrink-0" />
              <span>{t.hermes_import_tab}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {activeTab === 'export' ? (
            <>
              <div>
                <UiLabel className="text-xs font-semibold">{t.hermes_project_name}</UiLabel>
                <Input
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setExportFeedback(null);
                  }}
                  placeholder={t.hermes_project_name_placeholder}
                  className="mt-1 h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <UiLabel className="text-xs font-semibold">{t.hermes_scope_label}</UiLabel>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['both', 'inputs', 'mission_control'] as HermesProjectScope[]).map((opt) => {
                    const selected = scope === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setScope(opt);
                          setExportFeedback(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-center gap-2.5 cursor-pointer ${
                          selected
                            ? 'bg-primary/10 border-primary text-foreground font-semibold'
                            : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selected ? 'border-primary' : 'border-muted-foreground/50'
                          }`}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </span>
                        <span className="flex-1">{scopeLabelText(opt)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(scope === 'both' || scope === 'mission_control') && expRowCount > 0 && (
                <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/30 cursor-pointer select-none">
                  <Checkbox
                    checked={includeExp}
                    onCheckedChange={(v) => setIncludeExp(Boolean(v))}
                  />
                  <span className="text-xs text-foreground flex-1">{t.hermes_include_exp}</span>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    {expRowCount} pts
                  </span>
                </label>
              )}

              {/* Concise Package Summary */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <div className="text-[10.5px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  {t.hermes_package_preview}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
                  {(scope === 'both' || scope === 'inputs') && (
                    <>
                      <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">{t.hermes_preview_chamber}:</span>
                        <span className="font-semibold">
                          {motor.Dc}×{motor.Lc} / Dt{nozzle.Dt0}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">{t.hermes_preview_grains}:</span>
                        <span className="font-semibold">
                          {grains.length} ({grains.reduce((s, g) => s + (g.N || 1), 0)} seg)
                        </span>
                      </div>
                      {referencedProps.length > 0 && (
                        <div className="flex justify-between gap-2 border-b border-border/50 pb-1 sm:col-span-2">
                          <span className="text-muted-foreground">{t.hermes_preview_props}:</span>
                          <span className="font-semibold truncate">
                            {referencedProps.map((p) => p.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {(scope === 'both' || scope === 'mission_control') && (
                    <>
                      <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">{t.hermes_preview_flight}:</span>
                        <span className="font-semibold">
                          {mcSnapshot.params.emptyRocketMass} kg · {mcSnapshot.params.recoveryMode.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">{t.hermes_preview_aero}:</span>
                        <span className="font-semibold">
                          {aeroPointCount > 0 ? `${aeroPointCount} pts` : t.mc_std_cd}
                        </span>
                      </div>
                      {includeExp && expRowCount > 0 && (
                        <div className="flex justify-between gap-2 border-b border-border/50 pb-1 sm:col-span-2">
                          <span className="text-muted-foreground">{t.hermes_preview_exp}:</span>
                          <span className="font-semibold">{expRowCount} pts</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {exportFeedback && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportFeedback}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
                  {t.close_btn}
                </Button>
                <Button size="sm" onClick={handleExportDownload} className="gap-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.hermes_export_btn}</span>
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleReadFile(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-muted/25 hover:border-primary/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".hrms,.hermes,.json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    handleReadFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <FileCode2 className="w-7 h-7 mx-auto text-primary mb-1.5" />
                <p className="text-xs sm:text-sm font-semibold text-foreground">{t.hermes_drop_title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md mx-auto">
                  {t.hermes_drop_sub}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2.5 gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{t.hermes_select_file_btn}</span>
                </Button>
              </div>

              {importError && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {parsedPkg && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/25 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {t.hermes_preview_title}
                      </div>
                      <div className="text-sm font-bold text-foreground">{parsedPkg.projectName}</div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-muted-foreground">
                      <div>{new Date(parsedPkg.exportedAt).toLocaleString()}</div>
                      <div>{scopeLabelText(parsedPkg.scope)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
                    {parsedPkg.inputs && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t.hermes_preview_chamber}:</span>
                          <span className="font-semibold">
                            {parsedPkg.inputs.motor.Dc}×{parsedPkg.inputs.motor.Lc} / Dt{parsedPkg.inputs.nozzle.Dt0}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t.hermes_preview_grains}:</span>
                          <span className="font-semibold">
                            {parsedPkg.preview?.grainCount ?? parsedPkg.inputs.grains.length} ({parsedPkg.preview?.grainSegments ?? parsedPkg.inputs.grains.reduce((s, g) => s + (g.N || 1), 0)} seg)
                          </span>
                        </div>
                        {parsedPkg.inputs.bundledPropellants.length > 0 && (
                          <div className="flex justify-between gap-2 sm:col-span-2">
                            <span className="text-muted-foreground">{t.hermes_preview_props}:</span>
                            <span className="font-semibold truncate">
                              {parsedPkg.inputs.bundledPropellants.map((p) => p.name).join(', ')}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {parsedPkg.missionControl && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t.hermes_preview_flight}:</span>
                          <span className="font-semibold">
                            {parsedPkg.missionControl.params.emptyRocketMass} kg · {parsedPkg.missionControl.params.recoveryMode.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t.hermes_preview_aero}:</span>
                          <span className="font-semibold">
                            {parsedPkg.preview?.hasCustomAero
                              ? `${parsedPkg.preview.aeroPointsCount} pts`
                              : t.mc_std_cd}
                          </span>
                        </div>
                        {(parsedPkg.preview?.expRowsCount ?? 0) > 0 && (
                          <div className="flex justify-between gap-2 sm:col-span-2">
                            <span className="text-muted-foreground">{t.hermes_preview_exp}:</span>
                            <span className="font-semibold">{parsedPkg.preview?.expRowsCount} pts</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Selective section toggles when file has both */}
                  {parsedPkg.inputs && parsedPkg.missionControl && (
                    <div className="space-y-1.5 pt-1.5 border-t border-border/60">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        {t.hermes_import_sections_label}
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={applyInputs}
                          onCheckedChange={(v) => setApplyInputs(Boolean(v))}
                        />
                        <span>{t.hermes_import_sec_inputs}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={applyMc}
                          onCheckedChange={(v) => setApplyMc(Boolean(v))}
                        />
                        <span>{t.hermes_import_sec_mc}</span>
                      </label>
                    </div>
                  )}

                  {canSaveLibrary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-border/60">
                      <div>
                        <UiLabel className="text-[11px] text-muted-foreground">
                          {t.sim_name_label}
                        </UiLabel>
                        <Input
                          value={libName}
                          onChange={(e) => setLibName(e.target.value)}
                          className="mt-1 h-7 text-xs"
                        />
                      </div>
                      <div>
                        <UiLabel className="text-[11px] text-muted-foreground">
                          {t.folder_group_label}
                        </UiLabel>
                        <Input
                          value={libFolder}
                          onChange={(e) => setLibFolder(e.target.value)}
                          className="mt-1 h-7 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {importStatus && (
                    <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{importStatus.message}</span>
                      </div>
                      {importStatus.addedProps.length > 0 && (
                        <div className="text-[11px] font-mono pl-6">
                          {t.hermes_propellants_added}: {importStatus.addedProps.join(', ')}
                        </div>
                      )}
                      {importStatus.reusedProps.length > 0 && (
                        <div className="text-[11px] font-mono pl-6">
                          {t.hermes_propellants_reused}: {importStatus.reusedProps.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
                      {t.close_btn}
                    </Button>
                    {canSaveLibrary && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canActOnImport}
                        onClick={() => executeImport('library')}
                        className="gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>{t.hermes_save_library_btn}</span>
                      </Button>
                    )}
                    <Button
                      variant={canSaveLibrary ? 'outline' : 'default'}
                      size="sm"
                      disabled={!canActOnImport}
                      onClick={() => executeImport('active')}
                      className="whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.hermes_load_active_btn}
                    </Button>
                    {canSaveLibrary && (
                      <Button
                        size="sm"
                        disabled={!canActOnImport}
                        onClick={() => executeImport('both')}
                        className="whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t.hermes_save_and_load_btn}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
