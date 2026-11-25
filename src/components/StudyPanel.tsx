import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { CustomPropellant, GrainInput, MotorInput, NozzleInput, SimulationResults } from '../lib/types';
import { SavedSimulationEntry } from '../hooks/useSimulationStorage';
import { ExpDataType } from '../lib/missionControlStorage';
import {
  SavedStudyEntry,
  StudyPressureUnit,
  StudySeries,
  StudyState,
  StudyThrustModel,
  createDefaultStudyState,
  loadActiveStudyState,
  loadSavedStudies,
  saveActiveStudyState,
  saveSavedStudies,
} from '../lib/studyStorage';
import {
  buildOverlaidChartData,
  computeComparisonDelta,
  computeIgnitionZeroOffset,
  computeStudyMetrics,
  createStudySeriesFromLibraryEntry,
  createStudySeriesFromSimulation,
  importHermesFilesIntoStudy,
  parseExperimentalFileForStudy,
  toggleExperimentalSeriesTare,
} from '../lib/studyEngine';
import { exportStudyPdf } from '../lib/studyPdfReport';

interface TimeOffsetInputProps {
  value: number;
  onCommit: (nextVal: number) => void;
}

const TimeOffsetInput: React.FC<TimeOffsetInputProps> = ({ value, onCommit }) => {
  const [draft, setDraft] = useState<string>(() => String(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder="0"
      onFocus={(e) => {
        isFocusedRef.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty, minus sign, or decimal typing freely (dot or comma)
        if (!/^-?\d*(?:[.,]\d*)?$/.test(raw)) return;
        setDraft(raw);
        const normalized = raw.replace(',', '.');
        if (normalized !== '' && normalized !== '-' && !normalized.endsWith('.')) {
          const parsed = Number(normalized);
          if (Number.isFinite(parsed)) {
            onCommit(parsed);
          }
        } else if (normalized === '') {
          onCommit(0);
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const normalized = draft.trim().replace(',', '.');
        const parsed = normalized === '' || normalized === '-' ? 0 : Number(normalized);
        const clean = Number.isFinite(parsed) ? parsed : 0;
        onCommit(clean);
        setDraft(String(clean));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className="w-16 h-5 px-1.5 text-right rounded border border-border bg-background font-mono text-[10px] tabular-nums focus:outline-none focus:border-primary"
    />
  );
};

interface StudyPanelProps {
  lang: Language;
  results: SimulationResults | null;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  savedSimulations: SavedSimulationEntry[];
}

export const StudyPanel: React.FC<StudyPanelProps> = ({
  lang,
  results,
  motor,
  nozzle,
  grains,
  customPropellants,
  savedSimulations,
}) => {
  const t = translations[lang] || translations.en;

  // Persistent active study state (never cleared when switching tabs)
  const [studyState, setStudyState] = useState<StudyState>(() => loadActiveStudyState());
  const [savedStudies, setSavedStudies] = useState<SavedStudyEntry[]>(() => loadSavedStudies());

  useEffect(() => {
    saveActiveStudyState(studyState);
  }, [studyState]);

  useEffect(() => {
    const onStudySync = () => {
      setStudyState(loadActiveStudyState());
    };
    window.addEventListener('hermes-study-sync', onStudySync);
    return () => window.removeEventListener('hermes-study-sync', onStudySync);
  }, []);

  useEffect(() => {
    saveSavedStudies(savedStudies);
  }, [savedStudies]);

  // Add-source controls
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [isDraggingHermes, setIsDraggingHermes] = useState(false);
  const hermesInputRef = useRef<HTMLInputElement>(null);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Experimental import modal
  const [showExpModal, setShowExpModal] = useState(false);
  const [expFormat, setExpFormat] = useState<ExpDataType>('time_both');
  const [expPresUnit, setExpPresUnit] = useState<string>('bar');
  const [expForceUnit, setExpForceUnit] = useState<string>('N');
  const [expAutoZero, setExpAutoZero] = useState<boolean>(true);
  const [expCustomName, setExpCustomName] = useState<string>('');
  const expFileInputRef = useRef<HTMLInputElement>(null);

  // Save / Load / Clear modals
  const [showSaveStudyModal, setShowSaveStudyModal] = useState(false);
  const [saveStudyName, setSaveStudyName] = useState('');
  const [showSavedStudiesModal, setShowSavedStudiesModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Keep selectedLibraryId valid
  useEffect(() => {
    if (savedSimulations.length > 0 && !savedSimulations.some((s) => s.id === selectedLibraryId)) {
      setSelectedLibraryId(savedSimulations[0].id);
    }
  }, [savedSimulations, selectedLibraryId]);

  const selectedLibraryEntry = useMemo(
    () => savedSimulations.find((s) => s.id === selectedLibraryId) || null,
    [savedSimulations, selectedLibraryId]
  );

  const expFormatLabel = useMemo(() => {
    switch (expFormat) {
      case 'time_pressure':
        return t.study_exp_fmt_p;
      case 'time_thrust':
        return t.study_exp_fmt_f;
      case 'time_p_time_f':
        return t.study_exp_fmt_tptf;
      case 'time_both':
      default:
        return t.study_exp_fmt_pf;
    }
  }, [expFormat, t]);

  const appendSeriesList = (newItems: StudySeries[]) => {
    if (newItems.length === 0) return;
    setStudyState((prev) => {
      const nextSeries = [...prev.series, ...newItems];
      const nextRef =
        prev.referenceId && nextSeries.some((s) => s.id === prev.referenceId)
          ? prev.referenceId
          : nextSeries[0]?.id || null;
      return {
        ...prev,
        referenceId: nextRef,
        series: nextSeries,
      };
    });
  };

  const handleAddActiveSimulation = () => {
    setStudyError(null);
    if (!results) {
      setStudyError(t.study_err_no_active);
      return;
    }
    const baseName = `${results.summary.motorClass} · ${motor.Dc}x${motor.Lc}`;
    const item = createStudySeriesFromSimulation({
      name: baseName,
      source: 'active',
      sourceDetail: `${motor.Dc}x${motor.Lc} mm`,
      results,
      motor,
      nozzle,
      grains,
      customPropellants,
      existingSeries: studyState.series,
    });
    appendSeriesList([item]);
  };

  const handleAddFromLibrary = () => {
    setStudyError(null);
    const entry = savedSimulations.find((s) => s.id === selectedLibraryId);
    if (!entry) return;
    try {
      const item = createStudySeriesFromLibraryEntry(entry, customPropellants, studyState.series);
      appendSeriesList([item]);
    } catch {
      setStudyError(t.study_err_exp_parse);
    }
  };

  const handleHermesFiles = async (fileList: FileList | File[] | null | undefined) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setStudyError(null);

    const { added, warnings } = await importHermesFilesIntoStudy(
      files,
      customPropellants,
      studyState.series
    );
    if (added.length > 0) {
      appendSeriesList(added);
    }
    if (warnings.length > 0) {
      setStudyError(`${t.study_err_hermes_empty}: ${warnings.join(', ')}`);
    }
  };

  const handleExpFileSelected = async (file: File | undefined | null) => {
    if (!file) return;
    setStudyError(null);
    try {
      const series = await parseExperimentalFileForStudy(
        file,
        {
          dataType: expFormat,
          presUnit: expPresUnit,
          forceUnit: expForceUnit,
          autoAlignZero: expAutoZero,
          customName: expCustomName,
        },
        studyState.series
      );
      appendSeriesList([series]);
      setExpCustomName('');
      setShowExpModal(false);
    } catch {
      setStudyError(t.study_err_exp_parse);
    }
  };

  const updateSeriesField = (id: string, patch: Partial<StudySeries>) => {
    setStudyState((prev) => ({
      ...prev,
      series: prev.series.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeSeries = (id: string) => {
    setStudyState((prev) => {
      const nextSeries = prev.series.filter((s) => s.id !== id);
      const nextRef =
        prev.referenceId === id ? nextSeries[0]?.id || null : prev.referenceId;
      return {
        ...prev,
        referenceId: nextRef,
        series: nextSeries,
      };
    });
  };

  const visibleSeries = useMemo(
    () => studyState.series.filter((s) => s.visible),
    [studyState.series]
  );

  const effectiveRefSeries = useMemo(() => {
    if (studyState.series.length === 0) return null;
    return (
      studyState.series.find((s) => s.id === studyState.referenceId) ||
      visibleSeries[0] ||
      studyState.series[0]
    );
  }, [studyState.series, studyState.referenceId, visibleSeries]);

  const metricsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStudyMetrics>>();
    studyState.series.forEach((s) => {
      map.set(s.id, computeStudyMetrics(s, studyState.thrustModel));
    });
    return map;
  }, [studyState.series, studyState.thrustModel]);

  const refMetrics = effectiveRefSeries ? metricsById.get(effectiveRefSeries.id) || null : null;

  const pressureChartData = useMemo(
    () =>
      buildOverlaidChartData(studyState.series, 'pressure', {
        pressureUnit: studyState.pressureUnit,
        thrustModel: studyState.thrustModel,
      }),
    [studyState.series, studyState.pressureUnit, studyState.thrustModel]
  );

  const thrustChartData = useMemo(
    () =>
      buildOverlaidChartData(studyState.series, 'thrust', {
        pressureUnit: studyState.pressureUnit,
        thrustModel: studyState.thrustModel,
      }),
    [studyState.series, studyState.pressureUnit, studyState.thrustModel]
  );

  const visibleWithPressure = useMemo(
    () => visibleSeries.filter((s) => metricsById.get(s.id)?.hasPressure),
    [visibleSeries, metricsById]
  );

  const visibleWithThrust = useMemo(
    () => visibleSeries.filter((s) => metricsById.get(s.id)?.hasThrust),
    [visibleSeries, metricsById]
  );

  const maxVisibleImpulse = useMemo(() => {
    let maxIt = 0;
    visibleSeries.forEach((s) => {
      const it = metricsById.get(s.id)?.totalImpulseNs ?? 0;
      if (it > maxIt) maxIt = it;
    });
    return Math.max(1, maxIt);
  }, [visibleSeries, metricsById]);

  const pMult = studyState.pressureUnit === 'bar' ? 10 : 1;
  const pDec = studyState.pressureUnit === 'bar' ? 1 : 2;

  const sourceBadgeLabel = (src: StudySeries['source']) => {
    switch (src) {
      case 'active':
        return t.study_src_active;
      case 'library':
        return t.study_src_library;
      case 'hermes':
        return t.study_src_hermes;
      case 'experimental':
      default:
        return t.study_src_exp;
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Study Control Bar */}
      <Card data-tour="study-toolbar" className="bg-card border-border">
        <CardContent className="p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
            <div className="w-60 sm:w-72">
              <Input
                value={studyState.studyTitle}
                onChange={(e) =>
                  setStudyState((prev) => ({ ...prev, studyTitle: e.target.value }))
                }
                placeholder={t.study_title_placeholder}
                className="h-8 text-xs font-semibold bg-background"
              />
            </div>

            {/* Pressure unit switch */}
            <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-lg p-0.5 text-[11px] font-mono">
              <span className="px-2 text-muted-foreground font-semibold">{t.study_pressure_unit}:</span>
              {(['bar', 'MPa'] as StudyPressureUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setStudyState((prev) => ({ ...prev, pressureUnit: u }))}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    studyState.pressureUnit === u
                      ? 'bg-card text-primary font-bold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Simulation thrust model switch */}
            <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-lg p-0.5 text-[11px] font-mono">
              <span className="px-2 text-muted-foreground font-semibold">{t.study_thrust_model}:</span>
              {([
                { id: 'tti', label: 'TTI' },
                { id: 'rn', label: 'Nakka' },
              ] as Array<{ id: StudyThrustModel; label: string }>).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setStudyState((prev) => ({ ...prev, thrustModel: m.id }))}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    studyState.thrustModel === m.id
                      ? 'bg-card text-primary font-bold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={studyState.series.length === 0}
              onClick={() => {
                setSaveStudyName(
                  studyState.studyTitle.trim() || `Study_${new Date().toISOString().slice(0, 10)}`
                );
                setShowSaveStudyModal(true);
              }}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.study_save_btn}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSavedStudiesModal(true)}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>
                {t.study_saved_list_btn} ({savedStudies.length})
              </span>
            </Button>

            <Button
              size="sm"
              disabled={studyState.series.length === 0 || isExportingPdf}
              onClick={async () => {
                if (studyState.series.length === 0 || isExportingPdf) return;
                setIsExportingPdf(true);
                try {
                  await exportStudyPdf({
                    studyState,
                    filename: studyState.studyTitle.trim() || 'HERMES_Study',
                    lang,
                  });
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.study_export_pdf_btn}</span>
            </Button>

            {studyState.series.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.study_clear_btn}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {studyError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{studyError}</span>
          </div>
          <button
            type="button"
            onClick={() => setStudyError(null)}
            className="p-1 hover:bg-red-500/15 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 2-column Study Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Add Sources + Curve List */}
        <div className="lg:col-span-4 space-y-3">
          {/* Add Curves Card */}
          <Card data-tour="study-add-sources" className="bg-card border-border">
            <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border">
              <CardTitle className="text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>{t.study_add_sources_title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5">
              {/* 1. Active Simulation */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddActiveSimulation}
                disabled={!results}
                className="w-full h-8 text-xs justify-start gap-2 font-semibold border-primary/35 hover:bg-primary/10 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{t.study_add_active_btn}</span>
                {results && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {results.summary.motorClass}
                  </span>
                )}
              </Button>

              {/* 2. From Library */}
              <div className="flex items-center gap-1.5">
                <Select
                  value={selectedLibraryId}
                  onValueChange={(v) => {
                    if (v) setSelectedLibraryId(v);
                  }}
                  disabled={savedSimulations.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0 bg-background">
                    <SelectValue placeholder={t.study_add_library_placeholder}>
                      <span className="truncate">
                        {selectedLibraryEntry
                          ? `${selectedLibraryEntry.name} (${selectedLibraryEntry.motor.Dc}x${selectedLibraryEntry.motor.Lc})`
                          : t.study_add_library_placeholder}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground max-h-60">
                    {[...savedSimulations]
                      .sort((a, b) => {
                        const fa = (a.folder || 'General').localeCompare(b.folder || 'General');
                        return fa !== 0 ? fa : a.name.localeCompare(b.name);
                      })
                      .map((sim) => (
                        <SelectItem key={sim.id} value={sim.id} className="text-xs cursor-pointer">
                          [{sim.folder || 'General'}] {sim.name} ({sim.motor.Dc}×{sim.motor.Lc})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!selectedLibraryId || savedSimulations.length === 0}
                  onClick={handleAddFromLibrary}
                  className="h-8 px-3 text-xs font-semibold shrink-0 cursor-pointer"
                >
                  {t.study_add_library_btn}
                </Button>
              </div>

              {/* 3. Multi .hermes Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingHermes(true);
                }}
                onDragLeave={() => setIsDraggingHermes(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingHermes(false);
                  handleHermesFiles(e.dataTransfer.files);
                }}
                onClick={() => hermesInputRef.current?.click()}
                className={`rounded-lg border border-dashed p-3 text-center cursor-pointer transition-colors ${
                  isDraggingHermes
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-muted/25 hover:border-primary/60'
                }`}
              >
                <input
                  ref={hermesInputRef}
                  type="file"
                  multiple
                  accept=".hrms,.hermes,.json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    handleHermesFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground">
                  <UploadCloud className="w-4 h-4 text-primary shrink-0" />
                  <span>{t.study_drop_hermes}</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">
                  {t.study_drop_hermes_sub}
                </p>
              </div>

              {/* 4. Experimental Test Stand CSV / XLSX */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStudyError(null);
                  setShowExpModal(true);
                }}
                className="w-full h-8 text-xs justify-start gap-2 font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{t.study_import_exp_btn}</span>
              </Button>
            </CardContent>
          </Card>

          {/* Series List Card */}
          <Card data-tour="study-series-list" className="bg-card border-border">
            <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{t.study_series_list_title}</span>
              </CardTitle>
              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                {visibleSeries.length}/{studyState.series.length}
              </span>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[540px] overflow-y-auto">
              {studyState.series.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t.study_no_series_title}
                </p>
              ) : (
                studyState.series.map((s) => {
                  const m = metricsById.get(s.id);
                  const isRef = effectiveRefSeries?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                        isRef
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-border bg-background/60'
                      } ${!s.visible ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={s.visible}
                          onCheckedChange={(v) => updateSeriesField(s.id, { visible: Boolean(v) })}
                        />
                        <span
                          className="w-3 h-3 rounded-xs shrink-0 border border-black/15"
                          style={{ backgroundColor: s.color }}
                        />
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => updateSeriesField(s.id, { name: e.target.value })}
                          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-foreground border-b border-transparent focus:border-primary outline-none px-0.5 py-0.5 truncate"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setStudyState((prev) => ({ ...prev, referenceId: s.id }))
                          }
                          title={t.study_set_ref_tooltip}
                          className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                            isRef
                              ? 'text-amber-500 bg-amber-500/15'
                              : 'text-muted-foreground hover:text-amber-500'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" fill={isRef ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSeries(s.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-muted border border-border font-semibold text-foreground">
                            {sourceBadgeLabel(s.source)}
                          </span>
                          {isRef && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold">
                              {t.study_ref_badge}
                            </span>
                          )}
                          {m?.hasPressure && (
                            <span className="px-1 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                              P
                            </span>
                          )}
                          {m?.hasThrust && (
                            <span className="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              F
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{t.study_dt_label}:</span>
                          <TimeOffsetInput
                            value={s.timeOffsetSec}
                            onCommit={(nextVal) =>
                              updateSeriesField(s.id, {
                                timeOffsetSec: nextVal,
                              })
                            }
                          />
                          {s.source === 'experimental' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSeriesField(s.id, {
                                    timeOffsetSec: computeIgnitionZeroOffset(s),
                                  })
                                }
                                className="px-1.5 h-5 rounded border border-border bg-muted hover:bg-accent text-[9.5px] font-semibold cursor-pointer"
                              >
                                {t.study_align_zero_btn}
                              </button>
                              <button
                                type="button"
                                title={t.study_tare_tooltip}
                                onClick={() =>
                                  updateSeriesField(s.id, toggleExperimentalSeriesTare(s))
                                }
                                className={`px-1.5 h-5 rounded border text-[9.5px] font-semibold cursor-pointer transition-colors ${
                                  s.isTared
                                    ? 'border-primary/60 bg-primary/15 text-primary'
                                    : 'border-border bg-muted hover:bg-accent text-foreground'
                                }`}
                              >
                                {s.isTared ? t.study_untare_btn : t.study_tare_btn}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {s.source === 'experimental' && s.isTared && (
                        <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-mono tabular-nums text-muted-foreground pl-1">
                          {typeof s.pTareOffsetMPa === 'number' && (
                            <span>
                              ΔP₀: {(s.pTareOffsetMPa * pMult).toFixed(pDec)} {studyState.pressureUnit}
                            </span>
                          )}
                          {typeof s.fTareOffsetN === 'number' && (
                            <span>
                              ΔF₀: {s.fTareOffsetN.toFixed(1)} N
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Impulse Summary, Overlaid Charts, Comparison Table */}
        <div data-tour="study-charts-area" className="lg:col-span-8 space-y-4">
          {studyState.series.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-10 text-center space-y-3">
                <BarChart3 className="w-10 h-10 mx-auto text-primary/70" />
                <h3 className="text-base font-bold text-foreground">{t.study_no_series_title}</h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  {t.study_no_series_desc}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Visual Total Impulse Bar Comparison */}
              {visibleWithThrust.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <span>{t.study_it_bar_title}</span>
                    </CardTitle>
                    {effectiveRefSeries && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {t.study_ref_badge}: <strong className="text-foreground">{effectiveRefSeries.name}</strong>
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5">
                    {visibleWithThrust.map((s) => {
                      const m = metricsById.get(s.id);
                      const delta = m ? computeComparisonDelta(m, refMetrics) : null;
                      const itVal = m?.totalImpulseNs ?? 0;
                      const pctWidth = Math.max(2, (itVal / maxVisibleImpulse) * 100);
                      const isRef = effectiveRefSeries?.id === s.id;
                      return (
                        <div key={s.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="font-semibold truncate">{s.name}</span>
                              {isRef && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 font-mono text-[9.5px] font-bold">
                                  {t.study_ref_badge}
                                </span>
                              )}
                            </div>
                            <div className="font-mono tabular-nums text-xs shrink-0 flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {itVal.toFixed(1)} N·s
                              </span>
                              {!isRef && delta?.dItPct !== null && delta?.dItPct !== undefined && (
                                <span
                                  className={`text-[11px] font-semibold ${
                                    delta.dItPct >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  ({delta.dItPct >= 0 ? '+' : ''}
                                  {delta.dItPct.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-sm overflow-hidden border border-border/60">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${pctWidth}%`, backgroundColor: s.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Overlaid Pressure & Thrust Charts */}
              <div className="grid grid-cols-1 gap-4">
                {/* Pressure Chart */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-xs uppercase tracking-wider font-bold">
                      {t.study_p_chart_title} ({studyState.pressureUnit})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {visibleWithPressure.length === 0 || pressureChartData.length === 0 ? (
                      <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                        {t.study_no_p_data}
                      </div>
                    ) : (
                      <div className="h-[290px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={pressureChartData} margin={{ top: 10, right: 16, left: 4, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
                            <XAxis
                              dataKey="t"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(v) => Number(v).toFixed(2)}
                              tick={{ fontSize: 11 }}
                              label={{ value: 't [s]', position: 'insideBottom', offset: -10, fontSize: 11 }}
                            />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              width={52}
                              label={{
                                value: `P [${studyState.pressureUnit}]`,
                                angle: -90,
                                position: 'insideLeft',
                                fontSize: 11,
                              }}
                            />
                            <Tooltip
                              labelFormatter={(v) => `t = ${Number(v).toFixed(3)} s`}
                              formatter={(value: any, name: any) => [
                                `${Number(value).toFixed(pDec)} ${studyState.pressureUnit}`,
                                String(name),
                              ]}
                              contentStyle={{
                                backgroundColor: 'var(--card)',
                                borderColor: 'var(--border)',
                                borderRadius: '8px',
                                fontSize: '11px',
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                            {visibleWithPressure.map((s) => (
                              <Line
                                key={s.id}
                                type="monotone"
                                dataKey={s.id}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={2.2}
                                strokeDasharray={s.source === 'experimental' ? '6 3' : undefined}
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Thrust Chart */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-xs uppercase tracking-wider font-bold">
                      {t.study_f_chart_title} (N)
                    </CardTitle>
                    <span className="text-[10.5px] font-mono text-muted-foreground">
                      {studyState.thrustModel === 'rn' ? 'Nakka (RN)' : 'Ideal TTI'}
                    </span>
                  </CardHeader>
                  <CardContent className="p-3">
                    {visibleWithThrust.length === 0 || thrustChartData.length === 0 ? (
                      <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                        {t.study_no_f_data}
                      </div>
                    ) : (
                      <div className="h-[290px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={thrustChartData} margin={{ top: 10, right: 16, left: 4, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
                            <XAxis
                              dataKey="t"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(v) => Number(v).toFixed(2)}
                              tick={{ fontSize: 11 }}
                              label={{ value: 't [s]', position: 'insideBottom', offset: -10, fontSize: 11 }}
                            />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              width={56}
                              label={{ value: 'F [N]', angle: -90, position: 'insideLeft', fontSize: 11 }}
                            />
                            <Tooltip
                              labelFormatter={(v) => `t = ${Number(v).toFixed(3)} s`}
                              formatter={(value: any, name: any) => [`${Number(value).toFixed(1)} N`, String(name)]}
                              contentStyle={{
                                backgroundColor: 'var(--card)',
                                borderColor: 'var(--border)',
                                borderRadius: '8px',
                                fontSize: '11px',
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                            {visibleWithThrust.map((s) => (
                              <Line
                                key={s.id}
                                type="monotone"
                                dataKey={s.id}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={2.2}
                                strokeDasharray={s.source === 'experimental' ? '6 3' : undefined}
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Comparative Metrics Table */}
              <Card data-tour="study-table-card" className="bg-card border-border overflow-hidden">
                <CardHeader className="py-2.5 px-4 bg-card-header border-b border-border">
                  <CardTitle className="text-xs uppercase tracking-wider font-bold">
                    {t.study_table_title}
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/60 border-b border-border text-[10.5px] font-mono uppercase text-muted-foreground">
                        <th className="py-2 px-3 text-left">{t.study_col_series}</th>
                        <th className="py-2 px-2 text-left">{t.study_col_source}</th>
                        <th className="py-2 px-2.5 text-right text-foreground font-bold">{t.study_col_it}</th>
                        <th className="py-2 px-2.5 text-right">{t.study_col_dit}</th>
                        <th className="py-2 px-2.5 text-right">
                          {t.study_col_pmax} ({studyState.pressureUnit})
                        </th>
                        <th className="py-2 px-2.5 text-right">{t.study_col_dpmax}</th>
                        <th className="py-2 px-2.5 text-right">
                          {t.study_col_pavg} ({studyState.pressureUnit})
                        </th>
                        <th className="py-2 px-2.5 text-right">{t.study_col_fmax} (N)</th>
                        <th className="py-2 px-2.5 text-right">{t.study_col_tb}</th>
                        <th className="py-2 px-3 text-right">{t.study_col_isp}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSeries.map((s) => {
                        const m = metricsById.get(s.id);
                        const delta = m ? computeComparisonDelta(m, refMetrics) : null;
                        const isRef = effectiveRefSeries?.id === s.id;
                        return (
                          <tr
                            key={s.id}
                            className={`border-b border-border/60 font-mono tabular-nums ${
                              isRef ? 'bg-primary/5' : 'hover:bg-muted/35'
                            }`}
                          >
                            <td className="py-2 px-3 font-sans">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span className="font-semibold text-foreground">{s.name}</span>
                                {isRef && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 font-mono text-[9px] font-bold">
                                    {t.study_ref_badge}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-[10.5px] text-muted-foreground">
                              {sourceBadgeLabel(s.source)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-foreground">
                              {m?.totalImpulseNs !== null && m?.totalImpulseNs !== undefined
                                ? `${m.totalImpulseNs.toFixed(1)} N·s`
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {isRef ? (
                                <span className="text-muted-foreground">{t.study_ref_badge}</span>
                              ) : delta?.dItNs !== null && delta?.dItPct !== null && delta ? (
                                <span
                                  className={`font-semibold ${
                                    delta.dItPct >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {delta.dItNs >= 0 ? '+' : ''}
                                  {delta.dItNs.toFixed(1)} ({delta.dItPct >= 0 ? '+' : ''}
                                  {delta.dItPct.toFixed(1)}%)
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right font-semibold">
                              {m?.pMaxMPa !== null && m?.pMaxMPa !== undefined
                                ? (m.pMaxMPa * pMult).toFixed(pDec)
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {isRef ? (
                                <span className="text-muted-foreground">{t.study_ref_badge}</span>
                              ) : delta?.dPmaxPct !== null && delta ? (
                                <span
                                  className={
                                    delta.dPmaxPct >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }
                                >
                                  {delta.dPmaxPct >= 0 ? '+' : ''}
                                  {delta.dPmaxPct.toFixed(1)}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {m?.pAvgMPa !== null && m?.pAvgMPa !== undefined
                                ? (m.pAvgMPa * pMult).toFixed(pDec)
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {m?.fMaxN !== null && m?.fMaxN !== undefined
                                ? m.fMaxN.toFixed(0)
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {m?.burnTimeS !== null && m?.burnTimeS !== undefined
                                ? m.burnTimeS.toFixed(2)
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {m?.ispS !== null && m?.ispS !== undefined
                                ? m.ispS.toFixed(1)
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Modal: Import Experimental Test Curve */}
      {showExpModal && (
        <div
          className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExpModal(false);
          }}
        >
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-2xl border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span>{t.study_exp_modal_title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="p-1 rounded-full hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <UiLabel className="text-xs font-semibold">{t.study_exp_name_label}</UiLabel>
              <Input
                value={expCustomName}
                onChange={(e) => setExpCustomName(e.target.value)}
                placeholder="ej., Ensayo Banco #3 - KNSB"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <UiLabel className="text-xs font-semibold">{t.study_exp_format_label}</UiLabel>
              <Select value={expFormat} onValueChange={(v) => v && setExpFormat(v as ExpDataType)}>
                <SelectTrigger className="mt-1 w-full h-8 text-xs bg-background">
                  <SelectValue>
                    <span className="truncate">{expFormatLabel}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="time_pressure" className="text-xs cursor-pointer">
                    {t.study_exp_fmt_p}
                  </SelectItem>
                  <SelectItem value="time_thrust" className="text-xs cursor-pointer">
                    {t.study_exp_fmt_f}
                  </SelectItem>
                  <SelectItem value="time_both" className="text-xs cursor-pointer">
                    {t.study_exp_fmt_pf}
                  </SelectItem>
                  <SelectItem value="time_p_time_f" className="text-xs cursor-pointer">
                    {t.study_exp_fmt_tptf}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">{t.study_exp_strict_note}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {expFormat !== 'time_thrust' && (
                <div>
                  <UiLabel className="text-xs font-semibold">{t.study_exp_pres_unit}</UiLabel>
                  <Select value={expPresUnit} onValueChange={(v) => v && setExpPresUnit(v)}>
                    <SelectTrigger className="mt-1 w-full h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="bar">bar</SelectItem>
                      <SelectItem value="MPa">MPa</SelectItem>
                      <SelectItem value="psi">psi</SelectItem>
                      <SelectItem value="Pa">Pa</SelectItem>
                      <SelectItem value="atm">atm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {expFormat !== 'time_pressure' && (
                <div>
                  <UiLabel className="text-xs font-semibold">{t.study_exp_force_unit}</UiLabel>
                  <Select value={expForceUnit} onValueChange={(v) => v && setExpForceUnit(v)}>
                    <SelectTrigger className="mt-1 w-full h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="N">N</SelectItem>
                      <SelectItem value="kN">kN</SelectItem>
                      <SelectItem value="kgf">kgf</SelectItem>
                      <SelectItem value="lbf">lbf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer select-none p-2 rounded-lg border border-border bg-muted/30">
              <Checkbox
                checked={expAutoZero}
                onCheckedChange={(v) => setExpAutoZero(Boolean(v))}
              />
              <span>{t.study_exp_auto_zero}</span>
            </label>

            <input
              ref={expFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                handleExpFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowExpModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                size="sm"
                onClick={() => expFileInputRef.current?.click()}
                className="gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{t.study_exp_select_file}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Study */}
      {showSaveStudyModal && (
        <div
          className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSaveStudyModal(false);
          }}
        >
          <div className="bg-card w-full max-w-sm rounded-xl p-5 shadow-2xl border border-border space-y-4">
            <h3 className="text-base font-bold">{t.study_save_modal_title}</h3>
            <div>
              <UiLabel className="text-xs font-semibold">{t.study_save_name_label}</UiLabel>
              <Input
                value={saveStudyName}
                onChange={(e) => setSaveStudyName(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveStudyModal(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const trimmed = saveStudyName.trim();
                  if (!trimmed) return;
                  const nextState: StudyState = {
                    ...studyState,
                    studyTitle: studyState.studyTitle.trim() || trimmed,
                  };
                  setStudyState(nextState);
                  const entry: SavedStudyEntry = {
                    id: `study-${Date.now()}`,
                    name: trimmed,
                    savedAt: Date.now(),
                    state: nextState,
                  };
                  setSavedStudies((prev) => [entry, ...prev]);
                  setShowSaveStudyModal(false);
                }}
              >
                {t.save_btn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Saved Studies */}
      {showSavedStudiesModal && (
        <div
          className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSavedStudiesModal(false);
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-3.5 border-b border-border bg-muted flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span>{t.study_saved_modal_title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSavedStudiesModal(false)}
                className="p-1 rounded-full hover:bg-background cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {savedStudies.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {t.study_no_saved}
                </p>
              ) : (
                savedStudies.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background/60"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{st.name}</div>
                      <div className="text-[10.5px] font-mono text-muted-foreground">
                        {new Date(st.savedAt).toLocaleString()} · {st.state.series.length} curves
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs cursor-pointer"
                        onClick={() => {
                          setStudyState(st.state);
                          setShowSavedStudiesModal(false);
                        }}
                      >
                        {t.study_load_btn}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() =>
                          setSavedStudies((prev) => prev.filter((item) => item.id !== st.id))
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Study Confirmation */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearConfirm(false);
          }}
        >
          <div className="bg-card w-full max-w-sm rounded-xl p-5 shadow-2xl border border-border space-y-4">
            <h3 className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>{t.study_clear_btn}</span>
            </h3>
            <p className="text-xs text-muted-foreground">{t.study_clear_confirm}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                {t.cancel_btn}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setStudyState(createDefaultStudyState());
                  setShowClearConfirm(false);
                }}
              >
                {t.study_clear_btn}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
