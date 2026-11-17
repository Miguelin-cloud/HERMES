import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Beaker, Info, Layers, Scale, ShieldAlert } from 'lucide-react';
import {
  CustomPropellant,
  DEFAULT_PROPELLANTS,
  GrainInput,
  MOTOR_MATERIALS,
  MotorInput,
  MotorMaterialId,
  NozzleInput,
  SimulationResults,
} from '../lib/types';
import { MotorInputsValidation, MotorStructureResult } from '../lib/motorStructure';
import { GrainPreview } from './GrainPreview';
import { MotorPreview } from './MotorPreview';

interface NumberInputProps {
  value?: number | null;
  onChange: (v: number) => void;
  label: string;
  step?: string;
  tooltip?: string;
  decimals?: number;
  inputWidth?: string;
  warning?: string | null;
  error?: string | null;
}

function NumberInput({
  value,
  onChange,
  label,
  step = '1',
  tooltip,
  decimals,
  inputWidth,
  warning,
  error,
}: NumberInputProps) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const formatVal = (v: number) => (decimals !== undefined ? v.toFixed(decimals) : v.toString());

  const [internal, setInternal] = useState(formatVal(safeValue));
  const lastPushedValue = useRef(safeValue);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current && safeValue !== lastPushedValue.current) {
      setInternal(formatVal(safeValue));
      lastPushedValue.current = safeValue;
    }
  }, [value, decimals, safeValue]);

  const hasAlert = Boolean(error || warning);
  const alertMsg = error || warning || '';
  const alertColor = error ? 'text-red-500' : 'text-amber-500';
  const borderAlert = error
    ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 focus-visible:ring-red-500 focus-visible:border-red-500 ring-1 ring-red-500/30'
    : warning
      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 ring-1 ring-amber-500/30'
      : '';

  return (
    <div className="flex flex-col w-full min-w-0">
      <div
        className={`group relative flex items-center justify-between gap-2 w-full min-w-0 border-b ${
          hasAlert
            ? error
              ? 'border-red-500/60 bg-red-500/5'
              : 'border-amber-500/60 bg-amber-500/5'
            : 'border-border/75 focus-within:border-primary focus-within:bg-accent/35'
        } pb-1 mb-1 hover:bg-muted/40 px-1.5 py-0.5 rounded-sm transition-colors`}
        title={alertMsg ? `${tooltip ? tooltip + ' — ' : ''}⚠️ ${alertMsg}` : tooltip || label}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <UiLabel
            className={`text-[10px] sm:text-[11px] ${
              hasAlert
                ? error
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : 'text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-muted-foreground group-focus-within:text-foreground'
            } font-medium flex-1 min-w-0 transition-colors cursor-help select-none leading-tight py-0.5 whitespace-normal break-words`}
          >
            {label}
          </UiLabel>
          {hasAlert && (
            <span title={alertMsg} className={`cursor-help ${alertColor} shrink-0`}>
              <AlertTriangle size={13} />
            </span>
          )}
        </div>
        <Input
          type="number"
          step={step}
          value={internal}
          className={`${inputWidth ? inputWidth : 'w-[58px] sm:w-[66px]'} min-w-[50px] h-6 min-h-0 text-[11px] sm:text-xs py-0 px-1.5 text-right tabular-nums bg-background ${
            borderAlert || 'border border-border text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring'
          } font-mono font-semibold rounded-sm outline-none transition-colors shrink-0`}
          onChange={(e) => {
            const raw = e.target.value;
            setInternal(raw);
            const normalized = raw.replace(',', '.').trim();
            if (normalized !== '' && normalized !== '-' && normalized !== '.') {
              const parsed = parseFloat(normalized);
              if (!isNaN(parsed)) {
                lastPushedValue.current = parsed;
                onChange(parsed);
              }
            }
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            const formatted = formatVal(safeValue);
            setInternal(formatted);
            lastPushedValue.current = safeValue;
          }}
          onFocus={(e) => {
            isFocusedRef.current = true;
            e.target.select();
          }}
        />
      </div>
      {hasAlert && (
        <div className={`px-1.5 text-[9.5px] font-mono flex items-start gap-1 pb-1 -mt-0.5 ${alertColor} leading-tight`}>
          <span className="shrink-0">!</span>
          <span className="break-words">{alertMsg}</span>
        </div>
      )}
    </div>
  );
}

const GrainShapeIcon: React.FC<{ shape: number; grainId: string }> = ({ shape, grainId }) => {
  const patternId = `stripe-${shape}-${grainId}`;
  return (
    <svg className="w-7 h-7 shrink-0 select-none" viewBox="0 0 32 32">
      <defs>
        <pattern id={patternId} width="4.5" height="4.5" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4.5" stroke="currentColor" strokeWidth="1.2" className="text-primary/65" />
        </pattern>
      </defs>
      <circle cx="16" cy="16" r="13" fill={`url(#${patternId})`} stroke="currentColor" className="text-muted-foreground" strokeWidth="1.5" />
      {shape === 1 && (
        <circle cx="16" cy="16" r="4.5" fill="var(--card)" stroke="currentColor" className="text-muted-foreground" strokeDasharray="1.5 1.2" strokeWidth="1.2" />
      )}
      {shape === 2 && (
        <path
          d="M 16,10 L 17.5,13.5 L 21,14 L 18.2,16.5 L 19,20 L 16,18.2 L 13,20 L 13.8,16.5 L 11,14 L 14.5,13.5 Z"
          fill="var(--card)"
          stroke="currentColor"
          className="text-muted-foreground"
          strokeWidth="1.2"
        />
      )}
    </svg>
  );
};

interface MotorInputsPanelProps {
  motor: MotorInput;
  setMotor: React.Dispatch<React.SetStateAction<MotorInput>>;
  nozzle: NozzleInput;
  setNozzle: React.Dispatch<React.SetStateAction<NozzleInput>>;
  grains: GrainInput[];
  setGrains: React.Dispatch<React.SetStateAction<GrainInput[]>>;
  addGrain: () => void;
  removeGrain: (id: string) => void;
  slagMode: 'none' | 'slag' | 'erosion';
  setSlagMode: React.Dispatch<React.SetStateAction<'none' | 'slag' | 'erosion'>>;
  slagMagnitudeStr: string;
  setSlagMagnitudeStr: React.Dispatch<React.SetStateAction<string>>;
  isEditingSlagRef: React.MutableRefObject<boolean>;
  customPropellants: CustomPropellant[];
  motorStruct: MotorStructureResult;
  motorValidation: MotorInputsValidation;
  totalPropellantMassKg: number;
  isOverpressure: boolean;
  results: SimulationResults | null;
  theme: 'dark' | 'light';
  t: any;
  onOpenPadmInfo: () => void;
  onOpenPropellantModal: (grainId: string | null) => void;
}

export const MotorInputsPanel: React.FC<MotorInputsPanelProps> = ({
  motor,
  setMotor,
  nozzle,
  setNozzle,
  grains,
  setGrains,
  addGrain,
  removeGrain,
  slagMode,
  setSlagMode,
  slagMagnitudeStr,
  setSlagMagnitudeStr,
  isEditingSlagRef,
  customPropellants,
  motorStruct,
  motorValidation,
  totalPropellantMassKg,
  isOverpressure,
  results,
  theme,
  t,
  onOpenPadmInfo,
  onOpenPropellantModal,
}) => {
  const { totalGrainsLengthMm: totalGrainsLength, maxGrainD0Mm: maxGrainD0, hasRadialClearanceError } = motorValidation;
  const totalPropellantMass = totalPropellantMassKg.toFixed(3);

  return (
    <>
      {/* TOP ROW: Chamber Thermodynamics, Chamber Structure/Material/Protection, and Nozzle */}
      <div className="flex-none grid grid-cols-1 xl:grid-cols-3 gap-3 mb-1">
        <Card data-tour="chamber-card" className="bg-card border-border flex flex-col rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header border-b border-border flex-none">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-primary shrink-0" />
              <span>{t.motor}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-2 grid grid-cols-2 gap-x-2.5 sm:gap-x-3 gap-y-1">
            <NumberInput
              label={t.chamber_d + ' [mm]'}
              value={motor.Dc}
              onChange={(v) => setMotor({ ...motor, Dc: v })}
              tooltip={t.dc_desc}
              error={motor.Dc <= 0 ? t.err_dc_gt0 : null}
              warning={
                maxGrainD0 > motorStruct.availableGrainDiameterMm
                  ? `${t.avail_grain_d}: ${motorStruct.availableGrainDiameterMm.toFixed(1)} mm < D0 (${maxGrainD0} mm)`
                  : null
              }
            />
            <NumberInput
              label={t.chamber_l + ' [mm]'}
              value={motor.Lc}
              onChange={(v) => setMotor({ ...motor, Lc: v })}
              tooltip={t.lc_desc}
              error={motor.Lc <= 0 ? t.err_lc_gt0 : null}
              warning={
                totalGrainsLength > motor.Lc
                  ? `${t.warn_grains_exceed_lc} (${totalGrainsLength.toFixed(1)} > ${motor.Lc} mm)`
                  : null
              }
            />
            <NumberInput label={t.gstar} step="0.1" value={motor.Gstar} onChange={(v) => setMotor({ ...motor, Gstar: v })} tooltip={t.gstar_desc} />
            <NumberInput label={t.kv} step="0.1" value={motor.kv} onChange={(v) => setMotor({ ...motor, kv: v })} tooltip={t.kv_desc} />
            <NumberInput label={t.eff_c} step="0.01" value={motor.etac} onChange={(v) => setMotor({ ...motor, etac: v })} tooltip={t.etac_desc} />
            <NumberInput
              label={t.time_step}
              step="0.001"
              decimals={3}
              value={motor.paso_de_tiempo}
              onChange={(v) => setMotor({ ...motor, paso_de_tiempo: v })}
              tooltip={t.dt_desc}
              inputWidth="w-[58px] sm:w-[68px]"
            />
            <NumberInput
              label={t.p_amb}
              step="0.001"
              decimals={3}
              value={motor.Pamb}
              onChange={(v) => setMotor({ ...motor, Pamb: v })}
              tooltip={t.pamb_desc}
              inputWidth="w-[58px] sm:w-[68px]"
            />
          </CardContent>
        </Card>

        {/* STRUCTURE, MATERIAL, SAFETY FACTOR, LINER & INHIBITOR CARD */}
        <Card data-tour="chamber-structure-card" className="bg-card border-border flex flex-col rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header border-b border-border flex-none flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="truncate">{t.casing_structure_title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-2.5 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
              <NumberInput
                label={(t.wall_thickness || 'Wall Thick.') + ' [mm]'}
                step="0.5"
                value={motorStruct.wallThicknessMm}
                onChange={(v) => setMotor({ ...motor, wallThickness: Math.max(0, v) })}
                tooltip={t.wall_thickness_desc}
                error={motorStruct.wallThicknessMm <= 0 ? '> 0 mm' : null}
              />
              <NumberInput
                label={t.safety_factor || 'Safety Factor'}
                step="0.1"
                value={motorStruct.safetyFactor}
                onChange={(v) => setMotor({ ...motor, safetyFactor: Math.max(0.1, v) })}
                tooltip={t.safety_factor_desc}
                warning={motorStruct.safetyFactor < 1.2 ? 'FS < 1.2' : null}
              />
            </div>

            {/* Casing Material Selector */}
            <div className="flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between gap-2">
                <UiLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.motor_material}
                </UiLabel>
                <div className="flex items-center gap-2 font-mono tabular-nums text-[10px] text-muted-foreground">
                  <span>ρ={motorStruct.densityKgM3} kg/m³</span>
                  <span className="opacity-40">·</span>
                  <span>σy={motorStruct.yieldStrengthMPa} MPa</span>
                </div>
              </div>
              <Select
                value={motorStruct.materialId}
                onValueChange={(v: MotorMaterialId) => {
                  if (v === 'al6082') {
                    setMotor({ ...motor, materialId: 'al6082' });
                  } else if (v === 'ss174ph') {
                    setMotor({ ...motor, materialId: 'ss174ph' });
                  } else {
                    setMotor({
                      ...motor,
                      materialId: 'custom',
                      customMaterialName: motor.customMaterialName || 'Custom Alloy',
                      customMaterialDensity: motor.customMaterialDensity ?? MOTOR_MATERIALS.al6082.densityKgM3,
                      customMaterialYieldMPa: motor.customMaterialYieldMPa ?? MOTOR_MATERIALS.al6082.yieldStrengthMPa,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-[11px] px-2 py-0 bg-background border-border font-medium cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="al6082" className="text-[11px] cursor-pointer font-medium">
                    {t.mat_al6082} (2700 kg/m³ • 250 MPa)
                  </SelectItem>
                  <SelectItem value="ss174ph" className="text-[11px] cursor-pointer font-medium">
                    {t.mat_ss174ph} (7800 kg/m³ • 1000 MPa)
                  </SelectItem>
                  <SelectItem value="custom" className="text-[11px] cursor-pointer font-semibold text-primary">
                    {t.mat_custom}
                  </SelectItem>
                </SelectContent>
              </Select>

              {motorStruct.materialId === 'custom' && (
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-md bg-muted/40 border border-primary/35 mt-0.5">
                  <div className="col-span-3 flex items-center gap-2">
                    <UiLabel className="text-[9.5px] font-mono text-muted-foreground whitespace-nowrap">{t.mat_name}:</UiLabel>
                    <Input
                      type="text"
                      value={motor.customMaterialName || ''}
                      onChange={(e) => setMotor({ ...motor, customMaterialName: e.target.value })}
                      className="h-6 text-[10.5px] font-mono px-1.5 bg-background"
                      placeholder={t.mat_custom}
                    />
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-2">
                    <NumberInput
                      label={(t.mat_density || 'ρ') + ' [kg/m³]'}
                      step="50"
                      value={motor.customMaterialDensity ?? 2700}
                      onChange={(v) => setMotor({ ...motor, customMaterialDensity: Math.max(1, v) })}
                      inputWidth="w-[62px]"
                    />
                    <NumberInput
                      label={(t.mat_yield || 'σy') + ' [MPa]'}
                      step="10"
                      value={motor.customMaterialYieldMPa ?? 250}
                      onChange={(v) => setMotor({ ...motor, customMaterialYieldMPa: Math.max(0.1, v) })}
                      inputWidth="w-[62px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Liner & Optional Inhibitor */}
            <div className="grid grid-cols-2 gap-2 px-1 pt-1 border-t border-border/60">
              <div
                className={`p-1.5 rounded-md transition-colors flex flex-col gap-1 border ${
                  motor.hasLiner
                    ? 'bg-amber-500/12 border-amber-500/60'
                    : 'bg-muted/45 border-border hover:border-amber-500/45'
                }`}
              >
                <div className="flex items-center justify-between gap-1" title={t.liner_desc}>
                  <UiLabel
                    htmlFor="has-liner-chk"
                    className={`text-[10px] font-semibold uppercase tracking-tight cursor-pointer flex items-center gap-1.5 flex-1 min-w-0 ${
                      motor.hasLiner ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/80'
                    }`}
                  >
                    <Checkbox
                      id="has-liner-chk"
                      checked={Boolean(motor.hasLiner)}
                      onCheckedChange={(c) => setMotor({ ...motor, hasLiner: Boolean(c) })}
                      className="w-4 h-4 rounded-sm border border-amber-600/70 bg-background data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 data-[state=checked]:text-white shrink-0"
                    />
                    <span className="truncate">{t.add_liner}</span>
                  </UiLabel>
                  <span
                    className={`text-[9px] font-mono font-semibold shrink-0 ${
                      motor.hasLiner ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                    }`}
                  >
                    {motor.hasLiner ? 'ON' : 'OFF'}
                  </span>
                </div>
                {motor.hasLiner && (
                  <NumberInput
                    label={(t.liner_thickness || 'Esp.') + ' [mm]'}
                    step="0.5"
                    value={motor.linerThickness ?? 2.0}
                    onChange={(v) => setMotor({ ...motor, linerThickness: Math.max(0, v) })}
                    tooltip={t.liner_desc}
                    inputWidth="w-[52px]"
                  />
                )}
              </div>

              <div
                className={`p-1.5 rounded-md transition-colors flex flex-col gap-1 border ${
                  motor.hasInhibitor
                    ? 'bg-emerald-500/12 border-emerald-500/60'
                    : 'bg-muted/45 border-border hover:border-emerald-500/45'
                }`}
              >
                <div className="flex items-center justify-between gap-1" title={t.inhibitor_desc}>
                  <UiLabel
                    htmlFor="has-inhib-chk"
                    className={`text-[10px] font-semibold uppercase tracking-tight cursor-pointer flex items-center gap-1.5 flex-1 min-w-0 ${
                      motor.hasInhibitor ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground/80'
                    }`}
                  >
                    <Checkbox
                      id="has-inhib-chk"
                      checked={Boolean(motor.hasInhibitor)}
                      onCheckedChange={(c) => setMotor({ ...motor, hasInhibitor: Boolean(c) })}
                      className="w-4 h-4 rounded-sm border border-emerald-600/70 bg-background data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 data-[state=checked]:text-white shrink-0"
                    />
                    <span className="truncate">{t.add_inhibitor}</span>
                  </UiLabel>
                  <span
                    className={`text-[9px] font-mono font-semibold shrink-0 ${
                      motor.hasInhibitor ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                    }`}
                  >
                    {motor.hasInhibitor ? 'ON' : 'OFF'}
                  </span>
                </div>
                {motor.hasInhibitor && (
                  <NumberInput
                    label={(t.inhibitor_thickness || 'Esp.') + ' [mm]'}
                    step="0.5"
                    value={motor.inhibitorThickness ?? 2.0}
                    onChange={(v) => setMotor({ ...motor, inhibitorThickness: Math.max(0, v) })}
                    tooltip={t.inhibitor_desc}
                    inputWidth="w-[52px]"
                  />
                )}
              </div>
            </div>

            {/* Live Admissible Pressure Box */}
            <div
              className={`mt-auto p-2 rounded-md border font-mono text-[10px] flex flex-col gap-1 ${
                isOverpressure ? 'bg-red-500/12 border-red-500/60 text-red-700 dark:text-red-300' : 'bg-muted/40 border-border text-foreground'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground font-semibold uppercase truncate">{t.max_admissible_p}:</span>
                  <button
                    type="button"
                    onClick={onOpenPadmInfo}
                    title={t.padm_info_btn}
                    aria-label={t.padm_info_btn}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/40 transition-colors cursor-pointer shrink-0"
                  >
                    <Info className="w-2.5 h-2.5" />
                  </button>
                </div>
                <span className={`font-bold text-xs tabular-nums shrink-0 ${isOverpressure ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa
                  <span className="text-[9.5px] font-normal text-muted-foreground ml-1">
                    ({motorStruct.maxAdmissiblePressureBar.toFixed(1)} bar)
                  </span>
                </span>
              </div>
              <div className="text-[9.5px] font-sans text-muted-foreground leading-tight flex items-center justify-between gap-2">
                <span>{t.padm_wall_only_short}</span>
              </div>
              {isOverpressure && results && (
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-red-600 dark:text-red-300 pt-1 border-t border-red-500/30">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {t.overpressure_warning} ({results.summary.Pmax_MPa.toFixed(2)} &gt; {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Nozzle Card */}
        <Card data-tour="nozzle-card" className="bg-card border-border flex flex-col rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header border-b border-border flex-none flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-secondary shrink-0" />
              <span>{t.nozzle}</span>
            </CardTitle>
            <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-help" title={t.slag_tooltip}>
              <Info className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9.5px] font-mono font-medium hidden sm:inline">{t.slag_erosion_short}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-2.5 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-x-2.5 sm:gap-x-3 gap-y-1">
              <NumberInput
                label={t.throat_d + ' [mm]'}
                value={nozzle.Dt0}
                onChange={(v) => setNozzle({ ...nozzle, Dt0: v })}
                tooltip={t.dt0_desc}
                error={nozzle.Dt0 <= 0 ? t.err_dt0_gt0 : null}
                warning={
                  nozzle.Dt0 >= nozzle.Ds
                    ? `${t.warn_dt0_gte_ds} (${nozzle.Dt0} ≥ ${nozzle.Ds} mm)`
                    : nozzle.Dt0 >= motor.Dc
                      ? `${t.warn_dt0_gte_dc} (${nozzle.Dt0} ≥ ${motor.Dc} mm)`
                      : null
                }
              />
              <NumberInput
                label={t.exit_d + ' [mm]'}
                value={nozzle.Ds}
                onChange={(v) => setNozzle({ ...nozzle, Ds: v })}
                tooltip={t.ds_desc}
                error={nozzle.Ds <= 0 ? t.err_ds_gt0 : null}
                warning={nozzle.Ds <= nozzle.Dt0 ? `${t.warn_ds_lte_dt0} (${nozzle.Ds} ≤ ${nozzle.Dt0} mm)` : null}
              />
              <NumberInput label={t.div_angle + ' [º]'} step="1" value={nozzle.alpha} onChange={(v) => setNozzle({ ...nozzle, alpha: v })} tooltip={t.alpha_desc} />
              <NumberInput label={t.eff_n} step="0.01" value={nozzle.etanoz} onChange={(v) => setNozzle({ ...nozzle, etanoz: v })} tooltip={t.etanoz_desc} />
            </div>

            {/* Slag & Erosion Panel */}
            <div
              data-tour="slag-panel"
              className="p-2 rounded-md border border-border bg-muted/35 flex flex-col gap-1.5 mt-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-tight">{t.slag_erosion_title}</span>
                  <span title={t.slag_tooltip} className="cursor-help text-primary/80 hover:text-primary inline-flex items-center">
                    <Info className="w-3 h-3" />
                  </span>
                </div>
                {slagMode !== 'none' && (
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                      slagMode === 'slag'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {slagMode === 'slag'
                      ? `Slag: Dt → ${Math.max(0.1, (nozzle.Dt0 || 0) - (parseFloat(slagMagnitudeStr) || 0)).toFixed(2)} mm`
                      : `Ero: Dt → ${((nozzle.Dt0 || 0) + (parseFloat(slagMagnitudeStr) || 0)).toFixed(2)} mm`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 items-center">
                <div className="col-span-1">
                  <Select
                    value={slagMode}
                    onValueChange={(v: 'none' | 'slag' | 'erosion') => {
                      setSlagMode(v);
                      if (v === 'none') {
                        setNozzle((prev) => ({ ...prev, e: 0 }));
                      } else if (v === 'slag') {
                        const mag = Math.abs(parseFloat(slagMagnitudeStr)) || 0.8;
                        const maxSafe = Math.max(0.1, nozzle.Dt0 - 0.5);
                        const clamped = Math.min(mag, maxSafe);
                        setNozzle((prev) => ({ ...prev, e: -clamped, ero_model: prev.ero_model || 1 }));
                      } else if (v === 'erosion') {
                        const mag = Math.abs(parseFloat(slagMagnitudeStr)) || 0.8;
                        setNozzle((prev) => ({ ...prev, e: mag, ero_model: prev.ero_model || 1 }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[10px] px-1.5 py-0 bg-background border-input font-medium cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="none" className="text-[10px] cursor-pointer font-medium">
                        {t.slag_none}
                      </SelectItem>
                      <SelectItem value="slag" className="text-[10px] cursor-pointer font-medium text-amber-600 dark:text-amber-400">
                        {t.slag_deposit}
                      </SelectItem>
                      <SelectItem value="erosion" className="text-[10px] cursor-pointer font-medium text-blue-600 dark:text-blue-400">
                        {t.slag_erosion}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1">
                  {slagMode !== 'none' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">|ΔDt| [mm]:</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.01"
                        max={slagMode === 'slag' ? String(Math.max(0.1, nozzle.Dt0 - 0.5)) : '15'}
                        value={slagMagnitudeStr}
                        onFocus={(e) => {
                          isEditingSlagRef.current = true;
                          e.target.select();
                        }}
                        onChange={(e) => {
                          const text = e.target.value;
                          setSlagMagnitudeStr(text);
                          if (text !== '' && text !== '-' && text !== '.') {
                            const parsed = parseFloat(text);
                            if (!isNaN(parsed) && parsed >= 0) {
                              const sign = slagMode === 'slag' ? -1 : 1;
                              const maxSafe = slagMode === 'slag' ? Math.max(0.1, nozzle.Dt0 - 0.5) : 50;
                              const clamped = Math.min(parsed, maxSafe);
                              setNozzle((prev) => ({ ...prev, e: sign * clamped }));
                            }
                          }
                        }}
                        onBlur={() => {
                          isEditingSlagRef.current = false;
                          const parsed = parseFloat(slagMagnitudeStr);
                          if (isNaN(parsed) || parsed <= 0) {
                            const fallback = 0.8;
                            setSlagMagnitudeStr(fallback.toString());
                            const sign = slagMode === 'slag' ? -1 : 1;
                            setNozzle((prev) => ({ ...prev, e: sign * fallback }));
                          } else {
                            const sign = slagMode === 'slag' ? -1 : 1;
                            const maxSafe = slagMode === 'slag' ? Math.max(0.1, nozzle.Dt0 - 0.5) : 50;
                            const clamped = Math.min(parsed, maxSafe);
                            setSlagMagnitudeStr(clamped.toString());
                            setNozzle((prev) => ({ ...prev, e: sign * clamped }));
                          }
                        }}
                        className={`h-6 w-full text-[10px] font-mono px-1 py-0 bg-background border-input text-right font-bold ${slagMode === 'slag' && (parseFloat(slagMagnitudeStr) || 0) >= nozzle.Dt0 ? 'border-red-500 bg-red-500/10 text-red-500' : ''}`}
                      />
                    </div>
                  ) : (
                    <span className="text-[9px] text-muted-foreground italic pl-1 font-mono">{t.ideal_nozzle_label}</span>
                  )}
                </div>
              </div>

              {slagMode !== 'none' && (
                <div className="mt-0.5">
                  <UiLabel className="text-[9px] text-muted-foreground font-mono mb-0.5 block">{t.slag_model_label}</UiLabel>
                  <Select value={String(nozzle.ero_model || 1)} onValueChange={(v) => setNozzle((prev) => ({ ...prev, ero_model: +v as any }))}>
                    <SelectTrigger className="h-6 text-[10px] px-1.5 py-0 bg-background border-input font-medium cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="1" className="text-[10px] cursor-pointer">
                        {t.model_linear}
                      </SelectItem>
                      <SelectItem value="2" className="text-[10px] cursor-pointer">
                        {t.model_exp}
                      </SelectItem>
                      <SelectItem value="3" className="text-[10px] cursor-pointer">
                        {t.model_quad}
                      </SelectItem>
                      <SelectItem value="4" className="text-[10px] cursor-pointer">
                        {t.model_sqrt}
                      </SelectItem>
                      <SelectItem value="5" className="text-[10px] cursor-pointer">
                        {t.model_parabola}
                      </SelectItem>
                      <SelectItem value="6" className="text-[10px] cursor-pointer">
                        {t.model_sine}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FULL-WIDTH MOTOR SCHEMATIC BLUEPRINT & STRUCTURAL WARNINGS */}
      <div className="flex-none bg-card border border-border rounded-lg relative overflow-hidden flex flex-col min-h-[185px] mb-1">
        <MotorPreview motor={motor} grains={grains} nozzle={nozzle} t={t} overpressure={isOverpressure} />
        {(hasRadialClearanceError || isOverpressure) && (
          <div className="px-3 pb-2 flex flex-wrap gap-2">
            {motorStruct.availableGrainDiameterMm <= 0 && (
              <div className="text-[10px] font-mono font-bold text-red-600 dark:text-red-300 bg-red-500/10 border border-red-500/40 px-2.5 py-1 rounded flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.clearance_negative_warning} (Dc = {motor.Dc} mm)
                </span>
              </div>
            )}
            {motorStruct.availableGrainDiameterMm > 0 && maxGrainD0 > motorStruct.availableGrainDiameterMm + 1e-6 && (
              <div className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/50 px-2.5 py-1 rounded flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.clearance_warning} (D0={maxGrainD0} mm &gt; {t.avail_grain_d}: {motorStruct.availableGrainDiameterMm.toFixed(1)} mm)
                </span>
              </div>
            )}
            {isOverpressure && results && (
              <div className="text-[10px] font-mono font-bold text-red-600 dark:text-red-300 bg-red-500/15 border border-red-500/50 px-2.5 py-1 rounded flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.overpressure_warning} ({results.summary.Pmax_MPa.toFixed(2)} MPa &gt; {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM AREA: Vertical list of horizontal grain rows */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border-border rounded-lg">
        <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-card-header-foreground flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-primary shrink-0" />
              <span>{t.grains}</span>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-muted-foreground border-l border-border pl-3">
              <span className="inline-flex items-center gap-1" title={t.propellant_mass}>
                <Scale className="w-3 h-3 text-primary shrink-0" />
                <span>{t.propellant_mass}:</span>
                <strong className="text-foreground font-semibold">{totalPropellantMass} kg</strong>
              </span>
              <span className="opacity-40">·</span>
              <span
                className="inline-flex items-center gap-1"
                title={`${t.motor_mass_breakdown} — Cyl: ${motorStruct.cylinderMassKg.toFixed(3)} kg | Clos: ${motorStruct.closureMassKg.toFixed(3)} kg | Noz: ${motorStruct.nozzleMassKg.toFixed(3)} kg`}
              >
                <span>{t.motor_mass}:</span>
                <strong className="text-foreground font-semibold">{motorStruct.motorMassKg.toFixed(3)} kg</strong>
              </span>
              <span className="hidden sm:inline opacity-40">·</span>
              <span className="hidden sm:inline-flex items-center gap-1" title={t.total_loaded_mass}>
                <span>{t.total_loaded_mass}:</span>
                <strong className="text-foreground font-semibold">{(motorStruct.motorMassKg + totalPropellantMassKg).toFixed(3)} kg</strong>
              </span>
            </div>

            {totalGrainsLength > motor.Lc && (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono bg-amber-500/12 border-amber-500/50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold"
                title={`${t.warn_grains_exceed_lc} (${totalGrainsLength.toFixed(1)} > ${motor.Lc} mm)`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="tabular-nums">
                  Σ L0×N ({totalGrainsLength.toFixed(1)} mm) &gt; Lc ({motor.Lc} mm)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => onOpenPropellantModal(null)}
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2.5 sm:px-3 gap-1.5 border-border bg-background/70 hover:bg-muted text-foreground font-medium rounded-md cursor-pointer whitespace-nowrap"
            >
              <Beaker className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">{t.propellant_chemistry_btn}</span>
              <span className="sm:hidden">{t.chemistry_short_btn}</span>
            </Button>
            <Button
              data-tour="new-grain-btn"
              onClick={addGrain}
              size="sm"
              className="h-7 text-[11px] px-3 sm:px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {t.new_grain}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 no-scrollbar">
          {grains.map((g, index) => {
            const gc = motorValidation.grainChecks[g.id];
            const isD0ExceedsClearance = gc?.isD0ExceedsClearance ?? false;
            const isD0Invalid = gc?.isD0Invalid ?? false;
            const isL0Invalid = gc?.isL0Invalid ?? false;
            const isGrainL0ExceedsLc = gc?.isGrainLengthExceedsLc ?? false;
            const isNInvalid = gc?.isNInvalid ?? false;
            const isd0Invalid = gc?.isd0Invalid ?? false;
            const isd0ExceedsD0 = gc?.isd0ExceedsD0 ?? false;
            const isd0ExceedsDc = gc?.isd0ExceedsDc ?? false;
            const minD0mayor = gc?.minD0mayor ?? 0;
            const isStarPointsInvalid = gc?.isStarPointsInvalid ?? false;
            const isStarInvalid = gc?.hasStarError ?? (g.d0mayor <= g.d0 || g.d0mayor >= g.D0 || g.Np < 3);

            return (
              <div
                key={g.id}
                data-tour={index === 0 ? 'grain-card-0' : undefined}
                className="w-full flex shrink-0 border border-border bg-card hover:border-primary/40 rounded-lg min-h-[140px] overflow-hidden relative group/grain transition-colors"
              >
                {/* 1. Index & Remove */}
                <div className="w-8 shrink-0 bg-card-header text-card-header-foreground flex flex-col items-center justify-center border-r border-border relative">
                  <span className="text-[11px] font-mono font-semibold transform -rotate-90 whitespace-nowrap uppercase tracking-wider">
                    {t.grains} {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGrain(g.id)}
                    disabled={grains.length === 1}
                    className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10 p-0 text-[12px] absolute top-1 opacity-55 group-hover/grain:opacity-100 transition-opacity cursor-pointer"
                  >
                    ✕
                  </Button>
                </div>

                {/* 2. Inputs */}
                <div className="flex-1 p-2.5 grid grid-cols-2 gap-x-3.5 sm:gap-x-5 gap-y-1 min-w-[280px]">
                  <div className="space-y-1.5" data-tour={index === 0 ? 'grain-dimensions-0' : undefined}>
                    <div data-tour={index === 0 ? 'grain-propellant-0' : undefined}>
                      <div className="flex items-center justify-between mb-1">
                        <UiLabel className="text-[10px] block px-0.5 uppercase tracking-wider text-muted-foreground font-semibold">
                          {t.propellant}
                        </UiLabel>
                        <button
                          type="button"
                          data-tour={index === 0 ? 'manage-chemistry-btn-0' : undefined}
                          onClick={() => onOpenPropellantModal(g.id)}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                        >
                          <Beaker className="w-3 h-3" />
                          {t.formula_btn}
                        </button>
                      </div>
                      <Select
                        value={String(g.propellantType)}
                        onValueChange={(v) => {
                          if (v === '__manage_propellants__') {
                            onOpenPropellantModal(g.id);
                          } else {
                            setGrains(grains.map((x) => (x.id === g.id ? { ...x, propellantType: +v } : x)));
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background border-border h-8 text-[11px] px-2 py-0 min-h-0 text-foreground cursor-pointer flex items-center justify-between">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card text-foreground border-border max-h-64">
                          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t.standard_group}</div>
                          {DEFAULT_PROPELLANTS.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)} className="text-[11px] font-medium cursor-pointer">
                              {p.name}
                            </SelectItem>
                          ))}
                          {customPropellants.length > 0 && (
                            <>
                              <div className="px-2 py-1 mt-1.5 text-[9px] font-bold uppercase tracking-wider text-primary border-t border-border/50">
                                {t.custom_group}
                              </div>
                              {customPropellants.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)} className="text-[11px] font-medium cursor-pointer">
                                  🧪 {p.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          <SelectItem
                            value="__manage_propellants__"
                            className="text-[10px] font-bold text-primary cursor-pointer border-t border-border mt-1"
                          >
                            + {t.manage_chemistry}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <NumberInput
                      label={t.outer_d0 + ' [mm]'}
                      value={g.D0}
                      onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, D0: v } : x)))}
                      tooltip={t.outer_d0_desc}
                      error={isD0Invalid ? t.err_d0_gt0 : null}
                      warning={
                        !isD0Invalid && isD0ExceedsClearance
                          ? `${t.clearance_warning} (${g.D0} > ${motorStruct.availableGrainDiameterMm.toFixed(1)} mm)`
                          : null
                      }
                    />
                    <NumberInput
                      label={t.length_l0 + ' [mm]'}
                      value={g.L0}
                      onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, L0: v } : x)))}
                      tooltip={t.length_l0_desc}
                      error={isL0Invalid ? t.err_l0_gt0 : null}
                      warning={
                        !isL0Invalid && isGrainL0ExceedsLc ? `${t.warn_grains_exceed_lc} (${(g.L0 * g.N).toFixed(1)} > ${motor.Lc} mm)` : null
                      }
                    />
                    <NumberInput
                      label={t.n_blocks}
                      value={g.N}
                      onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, N: v } : x)))}
                      tooltip={t.n_blocks_desc}
                      error={isNInvalid ? t.err_n_gte1 : null}
                      warning={
                        !isNInvalid && isGrainL0ExceedsLc ? `${t.warn_grains_exceed_lc} (${(g.L0 * g.N).toFixed(1)} > ${motor.Lc} mm)` : null
                      }
                    />
                    <NumberInput
                      label={t.rho_rat}
                      step="0.01"
                      value={g.rhorat}
                      onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, rhorat: v } : x)))}
                      tooltip={t.rho_rat_desc}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div data-tour={index === 0 ? 'grain-shape-select-0' : undefined}>
                      <UiLabel className="text-[10px] mb-1 block px-0.5 uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                        {t.shape}
                      </UiLabel>
                      <Select value={String(g.shape)} onValueChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, shape: +v as 1 | 2 | 3 } : x)))}>
                        <SelectTrigger className="bg-background border-input h-8 text-[11px] px-2 py-0 min-h-0 text-foreground flex items-center gap-2 cursor-pointer w-full justify-between">
                          <div className="flex items-center gap-1.5">
                            <GrainShapeIcon shape={g.shape} grainId={g.id} />
                            <span className="font-semibold">{g.shape === 1 ? t.shape_cylindrical : g.shape === 2 ? t.shape_star : t.shape_solid}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card text-foreground border-border min-w-[200px]">
                          <SelectItem value="1" className="text-[11px] py-1.5 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <GrainShapeIcon shape={1} grainId={`${g.id}-opt1`} />
                              <div className="text-left">
                                <p className="font-bold text-xs">{t.shape_cylindrical}</p>
                                <p className="text-[9px] opacity-80 leading-none">{t.shape_cylindrical_desc}</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="2" className="text-[11px] py-1.5 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <GrainShapeIcon shape={2} grainId={`${g.id}-opt2`} />
                              <div className="text-left">
                                <p className="font-bold text-xs">{t.shape_star}</p>
                                <p className="text-[9px] opacity-80 leading-none">{t.shape_star_desc}</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="3" className="text-[11px] py-1.5 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <GrainShapeIcon shape={3} grainId={`${g.id}-opt3`} />
                              <div className="text-left">
                                <p className="font-bold text-xs">{t.shape_solid}</p>
                                <p className="text-[9px] opacity-80 leading-none">{t.shape_solid_desc}</p>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {g.shape !== 3 && (
                      <NumberInput
                        label={t.inner_d0 + ' [mm]'}
                        value={g.d0}
                        onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, d0: v } : x)))}
                        tooltip={t.inner_d0_desc}
                        error={isd0Invalid ? t.err_small_d0_gt0 : null}
                        warning={
                          !isd0Invalid && isd0ExceedsD0
                            ? `${t.warn_zero_web} (${g.d0} ≥ ${g.D0} mm)`
                            : !isd0Invalid && isd0ExceedsDc
                              ? `${t.warn_d0_gte_dc} (${g.d0} ≥ ${motor.Dc} mm)`
                              : null
                        }
                      />
                    )}

                    {g.shape === 2 && (
                      <>
                        <NumberInput
                          label={t.valley_d0 + ' [mm]'}
                          value={g.d0mayor}
                          onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, d0mayor: v } : x)))}
                          tooltip={t.valley_d0_desc}
                          error={g.d0mayor <= 0 ? t.err_dp_gt0 : null}
                          warning={
                            g.d0mayor <= minD0mayor
                              ? `${t.warn_dp_geom_min} (${minD0mayor.toFixed(1)} mm)`
                              : g.d0mayor >= g.D0
                                ? `${t.warn_dp_gte_d0} (${g.d0mayor} ≥ ${g.D0} mm)`
                                : null
                          }
                        />
                        <NumberInput
                          label={t.star_points}
                          value={g.Np}
                          onChange={(v) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, Np: v } : x)))}
                          tooltip={t.star_points_desc}
                          error={isStarPointsInvalid ? t.err_star_min_points : null}
                        />
                        {isStarInvalid && (
                          <div className="col-span-2 bg-destructive/10 border border-destructive/30 p-1.5 rounded-sm flex flex-col gap-0.5 mt-1 backdrop-blur-sm">
                            <span className="text-[9px] font-bold text-destructive uppercase tracking-widest leading-none drop-shadow-md">
                              {t.star_alert_title}
                            </span>
                            {g.Np < 3 && (
                              <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">• {t.star_alert_pts}</span>
                            )}
                            {g.d0mayor <= minD0mayor && (
                              <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">
                                • {t.star_alert_valley_min} ({minD0mayor.toFixed(1)}mm)
                              </span>
                            )}
                            {g.d0mayor >= g.D0 && (
                              <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">• {t.star_alert_valley_max}</span>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div data-tour={index === 0 ? 'grain-faces-0' : undefined} className="border-t border-border pt-2 mt-2 flex justify-between items-center px-1">
                      <UiLabel className="text-[10px] text-primary uppercase font-semibold tracking-wider">{t.burn_faces}</UiLabel>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-1.5" title={t.external}>
                          <Checkbox
                            className="w-4 h-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            checked={g.osi === 1}
                            onCheckedChange={(c) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, osi: c ? 1 : 0 } : x)))}
                            id={`osi-${g.id}`}
                          />
                          <UiLabel className="text-[11px] font-mono text-foreground font-semibold cursor-pointer" htmlFor={`osi-${g.id}`}>
                            EXT
                          </UiLabel>
                        </div>
                        <div className="flex items-center space-x-1.5" title={t.ends}>
                          <Checkbox
                            className="w-4 h-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            checked={g.ei === 1}
                            onCheckedChange={(c) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, osi: g.osi, ei: c ? 1 : 0 } : x)))}
                            id={`ei-${g.id}`}
                          />
                          <UiLabel className="text-[11px] font-mono text-foreground font-semibold cursor-pointer" htmlFor={`ei-${g.id}`}>
                            ENDS
                          </UiLabel>
                        </div>
                        {g.shape !== 3 && (
                          <div className="flex items-center space-x-1.5" title={t.internal}>
                            <Checkbox
                              className="w-4 h-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              checked={g.ci === 1}
                              onCheckedChange={(c) => setGrains(grains.map((x) => (x.id === g.id ? { ...x, ci: c ? 1 : 0 } : x)))}
                              id={`ci-${g.id}`}
                            />
                            <UiLabel className="text-[11px] font-mono text-foreground font-semibold cursor-pointer" htmlFor={`ci-${g.id}`}>
                              INT
                            </UiLabel>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Previews */}
                <div
                  data-tour={index === 0 ? 'grain-previews-0' : undefined}
                  className="w-[350px] shrink-0 bg-muted/25 border-l border-border flex flex-row overflow-hidden relative"
                >
                  <div className="w-1/2 h-full border-r border-border relative z-10">
                    <GrainPreview grain={g} t={t} mode="transversal" />
                  </div>
                  <div className="w-1/2 h-full relative z-10">
                    <GrainPreview grain={g} t={t} mode="longitudinal" />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
};
