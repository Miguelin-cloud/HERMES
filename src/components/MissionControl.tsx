import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label as UiLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SimulationResults } from "../lib/types";
import { calculateApogee, ApogeeResult, getExitMach, getTTIThrustCoefficient } from "../lib/apogee";
import { Language, translations } from "../lib/i18n";
import { Download, FileSpreadsheet, Sparkles, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

const NumberInputMC = ({
  label,
  value,
  onChange,
  tooltip,
  step,
  decimals,
}: any) => {
  const [internal, setInternal] = useState(
    decimals !== undefined ? Number(value).toFixed(decimals) : String(value),
  );
  const lastPushedValue = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastPushedValue.current) {
      setInternal(
        decimals !== undefined
          ? Number(value).toFixed(decimals)
          : String(value),
      );
      lastPushedValue.current = value;
    }
  }, [value, decimals]);

  return (
    <div
      className="group relative flex items-center justify-between gap-1 w-full border-b border-border pb-1 mb-[2px] px-1 hover:bg-muted/50 rounded transition-all focus-within:bg-purple-500/10 focus-within:shadow-[inset_0_0_8px_rgba(168,85,247,0.08)]"
      title={tooltip}
    >
      <div className="absolute bottom-[-1px] left-0 right-0 h-[1.5px] bg-gradient-to-r from-purple-500 via-purple-300 to-blue-500 opacity-0 group-focus-within:opacity-100 transition-all duration-300 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>
      <UiLabel className="text-[10px] text-muted-foreground font-mono whitespace-nowrap group-focus-within:text-foreground transition-colors z-10">
        {label}
      </UiLabel>
      <input
        type="number"
        step={step}
        value={internal}
        onChange={(e) => {
          setInternal(e.target.value);
          if (
            e.target.value !== "" &&
            e.target.value !== "-" &&
            e.target.value !== "."
          ) {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              lastPushedValue.current = val;
              onChange(val);
            }
          }
        }}
        onBlur={() => {
          if (decimals !== undefined && !isNaN(value)) {
            const formatted = Number(value).toFixed(decimals);
            setInternal(formatted);
            lastPushedValue.current = value;
          } else if (internal === "" || internal === "-" || internal === ".") {
            setInternal(String(value));
          }
        }}
        onFocus={(e) => e.target.select()}
        className="w-[65px] h-6 min-h-0 text-[11px] py-0 px-1.5 text-right bg-background border-transparent text-primary font-mono ring-offset-background outline-none rounded-sm transition-all z-10 focus:ring-0 focus:outline-none"
      />
    </div>
  );
};

export function MissionControl({
  results,
  lang,
  onApogeeUpdate,
  nozzleParams,
}: {
  results: SimulationResults | null;
  lang: Language;
  onApogeeUpdate?: (sim: ApogeeResult | null, exp: ApogeeResult | null) => void;
  nozzleParams?: any;
}) {
  const t = translations[lang];

  // Parameters for Apogee Simulation (Edit States)
  const [dryMass, setDryMass] = useState(7.5); // kg
  const [rocketDiameter, setRocketDiameter] = useState(80); // mm
  const [launchAltitude, setLaunchAltitude] = useState(169); // m
  const [launchTemp, setLaunchTemp] = useState(28); // ºC

  // Applied States for Calculation
  const [calcParams, setCalcParams] = useState({
    dryMass: 7.5,
    rocketDiameter: 80,
    launchAltitude: 169,
    launchTemp: 28,
  });

  const hasChanges =
    dryMass !== calcParams.dryMass ||
    rocketDiameter !== calcParams.rocketDiameter ||
    launchAltitude !== calcParams.launchAltitude ||
    launchTemp !== calcParams.launchTemp;

  const handleUpdate = () => {
    setCalcParams({ dryMass, rocketDiameter, launchAltitude, launchTemp });
  };

  // Simulated Apogee Result
  const [simApogee, setSimApogee] = useState<ApogeeResult | null>(null);

  // Experimental Data state
  const [expDataRaw, setExpDataRaw] = useState<
    { t: number; p: number; f: number }[]
  >([]);
  const [presUnit, setPresUnit] = useState("MPa");
  const [forceUnit, setForceUnit] = useState("N");
  const [expDataType, setExpDataType] = useState<"both" | "pressure" | "force">(
    "both",
  );

  const [calcExpParams, setCalcExpParams] = useState({
    expDataRaw: [] as { t: number; p: number; f: number }[],
    presUnit: "MPa",
    forceUnit: "N",
    expDataType: "both" as "both" | "pressure" | "force",
  });

  const hasExpChanges =
    expDataRaw !== calcExpParams.expDataRaw ||
    presUnit !== calcExpParams.presUnit ||
    forceUnit !== calcExpParams.forceUnit ||
    expDataType !== calcExpParams.expDataType;

  const handleExpUpdate = () => {
    setCalcExpParams({ expDataRaw, presUnit, forceUnit, expDataType });
  };

  // Experimental Apogee Result
  const [expApogee, setExpApogee] = useState<ApogeeResult | null>(null);

  const convertForceToN = (val: number, unit: string) => {
    switch (unit) {
      case "kN":
        return val * 1000;
      case "N":
        return val;
      case "kgf":
        return val * 9.80665;
      case "lbf":
        return val * 4.44822;
      default:
        return val;
    }
  };

  const convertPresToMPa = (val: number, unit: string) => {
    switch (unit) {
      case "bar":
        return val * 0.1;
      case "atm":
        return val * 0.101325;
      case "psi":
        return val * 0.00689476;
      case "MPa":
      default:
        return val;
    }
  };

  const [isUpdating, setIsUpdating] = useState(false);
  const [activeDynChart, setActiveDynChart] = useState<
    "velocity" | "acceleration"
  >("velocity");
  const [activeMainChart, setActiveMainChart] = useState<"altitude" | "thrust">(
    "altitude",
  );

  useEffect(() => {
    if (onApogeeUpdate) {
      onApogeeUpdate(simApogee, expApogee);
    }
  }, [simApogee, expApogee]);

  // Rerun simulated apogee when results or inputs change
  useEffect(() => {
    if (!results) {
      setSimApogee(null);
      return;
    }
    setIsUpdating(true);
    setTimeout(() => {
      const simResult = calculateApogee(
        results.t,
        results.E_N,
        results.mgra_total.map((mg) => mg + calcParams.dryMass),
        calcParams.dryMass,
        calcParams.rocketDiameter / 1000,
        calcParams.launchAltitude,
        calcParams.launchTemp,
      );
      setSimApogee(simResult);
      setIsUpdating(false);
    }, 50);
  }, [results, calcParams]);

  // Rerun experimental apogee when experimental data / units / inputs change
  useEffect(() => {
    if (calcExpParams.expDataRaw.length === 0) {
      setExpApogee(null);
      return;
    }
    setIsUpdating(true);
    setTimeout(() => {
      // Process experimental force and mass
      const t0 = calcExpParams.expDataRaw[0]?.t || 0;
      const exp_t = calcExpParams.expDataRaw.map((d) => d.t - t0);

      const exp_f_N = calcExpParams.expDataRaw.map((d) => {
        let f_N = 0;
        if (calcExpParams.expDataType === "pressure") {
          const P_MPa = convertPresToMPa(d.p, calcExpParams.presUnit);
          const P_Pa = P_MPa * 1e6;
          const Dt = nozzleParams?.Dt0 || 18.8; // mm
          const Ds = nozzleParams?.Ds || 37.6; // mm
          const alpha_deg = nozzleParams?.alpha || 12; // deg
          const etanoz = nozzleParams?.etanoz || 0.95;
          const At_m2 = Math.PI * Math.pow(Dt / 2000, 2);
          const epsilon = Math.pow(Ds / Dt, 2);
          
          const k = results?.summary.k_avg || 1.13;
          const Pa = 101325 * Math.pow(1 - 2.25577e-5 * (calcParams.launchAltitude || 0), 5.25588);
          
          const CF = getTTIThrustCoefficient(P_Pa, Pa, k, epsilon, alpha_deg, etanoz);
          f_N = P_Pa * At_m2 * CF;
        } else {
          f_N = convertForceToN(Math.max(0, d.f), calcExpParams.forceUnit);
        }
        return Math.max(0, f_N);
      });

      // Basic interpolation of simulated mass onto experimental time array
      const exp_mass = exp_t.map((et) => {
        if (!results) return calcParams.dryMass;
        let idx = 0;
        while (idx < results.t.length - 1 && results.t[idx] <= et) {
          idx++;
        }
        const simMass = results.mgra_total[idx] + calcParams.dryMass;
        return simMass;
      });

      const res = calculateApogee(
        exp_t,
        exp_f_N,
        exp_mass,
        calcParams.dryMass,
        calcParams.rocketDiameter / 1000,
        calcParams.launchAltitude,
        calcParams.launchTemp,
      );

      setExpApogee(res);
      setIsUpdating(false);
    }, 50);
  }, [calcExpParams, calcParams, results]);

  const downloadTemplate = () => {
    let headers = "";
    let sample = "";
    if (expDataType === "both") {
      headers = "Time,Pressure,Force\n";
      sample = "0.00,0.10,0.0\n0.05,1.25,120.5\n0.10,2.85,340.2\n0.15,4.10,510.9\n0.20,3.95,490.4\n0.25,1.80,180.1\n0.30,0.10,0.0\n";
    } else if (expDataType === "pressure") {
      headers = "Time,Pressure\n";
      sample = "0.00,0.10\n0.05,1.25\n0.10,2.85\n0.15,4.10\n0.20,3.95\n0.25,1.80\n0.30,0.10\n";
    } else {
      headers = "Time,Force\n";
      sample = "0.00,0.0\n0.05,120.5\n0.10,340.2\n0.15,510.9\n0.20,490.4\n0.25,180.1\n0.30,0.0\n";
    }
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `hermes_template_${expDataType}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length === 0) return;

      // Robust Column Header Detection
      let timeIdx = 0;
      let pressIdx = -1;
      let forceIdx = -1;
      let hasHeader = false;

      // Scan first 5 rows for potential header words to support any language or order
      for (let r = 0; r < Math.min(5, data.length); r++) {
        const row = data[r] as any[];
        if (!row) continue;
        
        let foundTime = -1;
        let foundPress = -1;
        let foundForce = -1;

        for (let c = 0; c < row.length; c++) {
          const valStr = String(row[c] || "").toLowerCase().trim();
          if (!valStr) continue;
          
          if (valStr.includes("time") || valStr.includes("tiempo") || valStr === "t" || valStr === "s" || valStr.includes("seconds") || valStr.includes("seg")) {
            foundTime = c;
          } else if (valStr.includes("press") || valStr.includes("pres") || valStr === "p" || valStr.includes("mpa") || valStr.includes("bar") || valStr.includes("psi") || valStr.includes("chamber") || valStr.includes("cámara")) {
            foundPress = c;
          } else if (valStr.includes("force") || valStr.includes("thrust") || valStr.includes("empuje") || valStr.includes("fuerza") || valStr === "f" || valStr === "n" || valStr.includes("load")) {
            foundForce = c;
          }
        }

        // We found a matching time plus at least one of the inputs
        if (foundTime !== -1 && (foundPress !== -1 || foundForce !== -1)) {
          timeIdx = foundTime;
          if (foundPress !== -1) pressIdx = foundPress;
          if (foundForce !== -1) forceIdx = foundForce;
          hasHeader = true;
          break;
        }
      }

      // Default fallback if we did not auto-detect a header
      if (!hasHeader) {
        timeIdx = 0;
        if (expDataType === "force") {
          forceIdx = 1;
          pressIdx = -1;
        } else if (expDataType === "pressure") {
          pressIdx = 1;
          forceIdx = -1;
        } else {
          pressIdx = 1;
          forceIdx = 2;
        }
      }

      // Parse data
      const parsed: { t: number; p: number; f: number }[] = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;

        // Try extracting numeric values
        const t_raw = parseFloat(String(row[timeIdx]).replace(",", "."));
        const p_raw = pressIdx !== -1 && pressIdx < row.length ? parseFloat(String(row[pressIdx]).replace(",", ".")) : 0;
        const f_raw = forceIdx !== -1 && forceIdx < row.length ? parseFloat(String(row[forceIdx]).replace(",", ".")) : 0;

        // If time is completely non-numeric (e.g. the header itself), skip
        if (isNaN(t_raw)) continue;

        const t_val = t_raw;
        const p_val = isNaN(p_raw) ? 0 : p_raw;
        const f_val = isNaN(f_raw) ? 0 : f_raw;

        parsed.push({ t: t_val, p: p_val, f: f_val });
      }

      // Fallback index-based parser if empty parsed array
      if (parsed.length === 0) {
        for (let i = 0; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length < 2) continue;
          
          const t_val = parseFloat(String(row[0]).replace(",", "."));
          let p_val = 0;
          let f_val = 0;
          
          if (expDataType === "force") {
            f_val = parseFloat(String(row[1]).replace(",", "."));
          } else if (expDataType === "pressure") {
            p_val = parseFloat(String(row[1]).replace(",", "."));
          } else if (expDataType === "both" && row.length >= 3) {
            p_val = parseFloat(String(row[1]).replace(",", "."));
            f_val = parseFloat(String(row[2]).replace(",", "."));
          }
          
          if (!isNaN(t_val) && !isNaN(p_val) && !isNaN(f_val)) {
            parsed.push({ t: t_val, p: p_val, f: f_val });
          }
        }
      }

      // Sort chronological
      parsed.sort((a, b) => a.t - b.t);
      setExpDataRaw(parsed);
    };
    reader.readAsBinaryString(file);
  };

  // Merge data for comparison chart
  const chartData = React.useMemo(() => {
    let data: any[] = [];

    // Helper to get simulated thrust
    const getSimF = (t: number) => {
      if (!results || !results.t) return null;
      if (t > results.t[results.t.length - 1]) return 0;
      let r_idx = 0;
      while (r_idx < results.t.length - 1 && results.t[r_idx] <= t) r_idx++;
      return results.E_N[r_idx] || 0;
    };

    // Helper to get experimental thrust
    const getExpF = (time: number) => {
      const t0 = calcExpParams.expDataRaw[0]?.t || 0;
      const rawT = time + t0;
      if (calcExpParams.expDataRaw.length === 0)
        return { exp_F: null, exp_P_F: null };
      if (
        rawT > calcExpParams.expDataRaw[calcExpParams.expDataRaw.length - 1].t
      )
        return { exp_F: 0, exp_P_F: 0 };

      let r_idx = 0;
      while (
        r_idx < calcExpParams.expDataRaw.length - 1 &&
        calcExpParams.expDataRaw[r_idx].t <= rawT
      )
        r_idx++;
      const d = calcExpParams.expDataRaw[r_idx];

      let exp_F: number | null = null;
      let exp_P_F: number | null = null;

      if (
        calcExpParams.expDataType === "force" ||
        calcExpParams.expDataType === "both"
      ) {
        exp_F = Math.max(0, convertForceToN(d.f, calcExpParams.forceUnit));
      }
      if (
        calcExpParams.expDataType === "pressure" ||
        calcExpParams.expDataType === "both"
      ) {
        const P_MPa = convertPresToMPa(d.p, calcExpParams.presUnit);
        const P_Pa = P_MPa * 1e6;
        const Dt = nozzleParams?.Dt0 || 18.8; // mm
        const Ds = nozzleParams?.Ds || 37.6; // mm
        const alpha_deg = nozzleParams?.alpha || 12; // deg
        const etanoz = nozzleParams?.etanoz || 0.95;
        const At_m2 = Math.PI * Math.pow(Dt / 2000, 2);
        const epsilon = Math.pow(Ds / Dt, 2);

        const k = results?.summary.k_avg || 1.13;
        const Pa = 101325 * Math.pow(1 - 2.25577e-5 * (calcParams.launchAltitude || 0), 5.25588);

        const CF = getTTIThrustCoefficient(P_Pa, Pa, k, epsilon, alpha_deg, etanoz);
        exp_P_F = Math.max(0, P_Pa * At_m2 * CF);
      }
      return { exp_F, exp_P_F };
    };

    if (simApogee) {
      const step = Math.max(1, Math.floor(simApogee.t.length / 300));
      for (let i = 0; i < simApogee.t.length; i += step) {
        const t = simApogee.t[i];
        const { exp_F, exp_P_F } = getExpF(t);
        const sim_F_val = getSimF(t);
        data.push({
          time: Number(t.toFixed(3)),
          sim_h: Number(simApogee.h[i].toFixed(1)),
          sim_v: Number(simApogee.v[i].toFixed(1)),
          sim_a: Number(simApogee.a[i].toFixed(1)),
          ...(sim_F_val !== null && { sim_F: Number(sim_F_val.toFixed(1)) }),
          ...(exp_F !== null && { exp_F: Number(exp_F.toFixed(1)) }),
          ...(exp_P_F !== null && { exp_P_F: Number(exp_P_F.toFixed(1)) }),
        });
      }
      if (simApogee.t.length > 0 && (simApogee.t.length - 1) % step !== 0) {
        const el = simApogee.t.length - 1;
        const t = simApogee.t[el];
        const { exp_F, exp_P_F } = getExpF(t);
        const sim_F_val = getSimF(t);
        data.push({
          time: Number(t.toFixed(3)),
          sim_h: Number(simApogee.h[el].toFixed(1)),
          sim_v: Number(simApogee.v[el].toFixed(1)),
          sim_a: Number(simApogee.a[el].toFixed(1)),
          ...(sim_F_val !== null && { sim_F: Number(sim_F_val.toFixed(1)) }),
          ...(exp_F !== null && { exp_F: Number(exp_F.toFixed(1)) }),
          ...(exp_P_F !== null && { exp_P_F: Number(exp_P_F.toFixed(1)) }),
        });
      }
    }

    if (expApogee) {
      const step = Math.max(1, Math.floor(expApogee.t.length / 300));
      for (let i = 0; i < expApogee.t.length; i += step) {
        const t = expApogee.t[i];
        const { exp_F, exp_P_F } = getExpF(t);
        const sim_F_val = getSimF(t);
        data.push({
          time: Number(t.toFixed(3)),
          exp_h: Number(expApogee.h[i].toFixed(1)),
          exp_v: Number(expApogee.v[i].toFixed(1)),
          exp_a: Number(expApogee.a[i].toFixed(1)),
          ...(sim_F_val !== null && { sim_F: Number(sim_F_val.toFixed(1)) }),
          ...(exp_F !== null && { exp_F: Number(exp_F.toFixed(1)) }),
          ...(exp_P_F !== null && { exp_P_F: Number(exp_P_F.toFixed(1)) }),
        });
      }
      data.sort((a, b) => a.time - b.time);
    }
    return data;
  }, [simApogee, expApogee, results, calcExpParams, nozzleParams]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rocket Parameters */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[12px] uppercase text-muted-foreground font-bold">
              {t.rocket_params || "Rocket Parameters"}
            </CardTitle>
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={!hasChanges || isUpdating}
              variant={hasChanges ? "default" : "secondary"}
              className="h-6 text-[10px] px-2 py-0"
            >
              {isUpdating ? "..." : t.update_btn || "Actualizar"}
            </Button>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <NumberInputMC
              label={t.dry_mass || "Dry Mass [kg]"}
              value={dryMass}
              onChange={setDryMass}
              step="0.1"
            />
            <NumberInputMC
              label={t.rocket_diam || "Diameter [mm]"}
              value={rocketDiameter}
              onChange={setRocketDiameter}
              step="1"
            />
            <NumberInputMC
              label={t.launch_alt || "Launch Altitude [m]"}
              value={launchAltitude}
              onChange={setLaunchAltitude}
              step="1"
            />
            <NumberInputMC
              label={t.launch_temp || "Launch Temp [ºC]"}
              value={launchTemp}
              onChange={setLaunchTemp}
              step="0.1"
            />
          </CardContent>
        </Card>

        {/* Experimental Data Upload */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[12px] uppercase text-muted-foreground font-bold">
              {t.exp_data || "Experimental Data Import"}
            </CardTitle>
            <Button
              size="sm"
              onClick={handleExpUpdate}
              disabled={!hasExpChanges || isUpdating}
              variant={hasExpChanges ? "default" : "secondary"}
              className="h-6 text-[10px] px-2 py-0"
            >
              {isUpdating ? "..." : t.update_btn || "Actualizar"}
            </Button>
          </CardHeader>
          <CardContent className="p-3 flex flex-col gap-3">
            <div className="space-y-1">
              <UiLabel className="text-[10px] text-muted-foreground font-bold uppercase">
                {t.data_cols || "Data Columns"}
              </UiLabel>
              <Select
                value={expDataType}
                onValueChange={(v: any) => setExpDataType(v)}
              >
                <SelectTrigger className="h-7 text-xs bg-muted/60 dark:bg-slate-950 border-border text-foreground w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="both">
                    {t.cols_3 || "Time, Pressure, Force (3 cols)"}
                  </SelectItem>
                  <SelectItem value="pressure">
                    {t.cols_2p || "Only Time and Pressure (2 cols)"}
                  </SelectItem>
                  <SelectItem value="force">
                    {t.cols_2f || "Only Time and Force (2 cols)"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {expDataType === "pressure" && (
                <p className="text-[9px] text-emerald-500 italic mt-0.5 leading-tight">
                  {t.est_thrust_msg ||
                    "* Thrust will be estimated from pressure using nozzle data."}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                {expDataType === "both"
                  ? t.import_desc_both ||
                    "Calculates altitude and thrust from experimental pressure and thrust from Excel. Plotted alongside simulation data if available."
                  : expDataType === "pressure"
                    ? t.import_desc_pressure ||
                      "Calculates thrust using experimental pressure and nozzle inputs (Dt0), then calculates altitude. Plotted alongside simulation if available."
                    : t.import_desc_force ||
                      "Uses experimental thrust to calculate altitude. Plotted alongside simulation data if available."}
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <UiLabel className="text-[10px] text-muted-foreground font-bold uppercase">
                  {t.pres_unit || "Pressure Unit"}
                </UiLabel>
                <Select value={presUnit} onValueChange={setPresUnit}>
                  <SelectTrigger className="h-7 text-xs bg-muted/60 dark:bg-slate-950 border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border">
                    <SelectItem value="MPa">MPa</SelectItem>
                    <SelectItem value="Pa">Pa</SelectItem>
                    <SelectItem value="bar">bar</SelectItem>
                    <SelectItem value="atm">atm</SelectItem>
                    <SelectItem value="psi">psi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <UiLabel className="text-[10px] text-muted-foreground font-bold uppercase">
                   {t.force_unit || "Force Unit"}
                </UiLabel>
                <Select value={forceUnit} onValueChange={setForceUnit}>
                  <SelectTrigger className="h-7 text-xs bg-muted/60 dark:bg-slate-950 border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border">
                    <SelectItem value="N">N</SelectItem>
                    <SelectItem value="kN">kN</SelectItem>
                    <SelectItem value="kgf">kgf</SelectItem>
                    <SelectItem value="lbf">lbf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Visual template helper diagram and Template Download button */}
            <div className="bg-muted/40 border border-border p-2.5 rounded-lg text-[10px] space-y-2">
              <div className="flex items-center justify-between text-muted-foreground font-semibold">
                <span className="uppercase tracking-wider">
                  {lang === "es" ? "Formato del archivo Excel/CSV" : "Excel/CSV File Structure"}
                </span>
                <Button
                  onClick={downloadTemplate}
                  size="sm"
                  variant="outline"
                  className="h-6 text-[9px] gap-1 px-1.5 py-0 border-purple-500/30 hover:border-purple-500 bg-background/50 hover:bg-purple-500/5 text-purple-600 dark:text-purple-400 font-bold"
                >
                  <Download className="h-3 w-3" />
                  {lang === "es" ? "Descargar Plantilla" : "Download Template"}
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground/80 text-[9px]">
                      <th className="py-1 px-2">Col 1 ({lang === "es" ? "Tiempo" : "Time"})</th>
                      <th className="py-1 px-2">Col 2 ({expDataType === "force" ? (lang === "es" ? "Empuje" : "Force") : (lang === "es" ? "Presión" : "Pressure")})</th>
                      {expDataType === "both" && <th className="py-1 px-2">Col 3 ({lang === "es" ? "Empuje" : "Force"})</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30 text-[9.5px]">
                      <td className="py-1 px-2 font-bold text-foreground">0.00</td>
                      <td className="py-1 px-2 text-[#a855f7]">{expDataType === "force" ? "0.0" : "0.10"}</td>
                      {expDataType === "both" && <td className="py-1 px-2 text-[#3b82f6]">0.0</td>}
                    </tr>
                    <tr className="border-b border-border/30 text-[9.5px]">
                      <td className="py-1 px-2 font-bold text-foreground">0.15</td>
                      <td className="py-1 px-2 text-[#a855f7]">{expDataType === "force" ? "510.9" : "4.10"}</td>
                      {expDataType === "both" && <td className="py-1 px-2 text-[#3b82f6]">510.9</td>}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[9px] text-[#9333ea] dark:text-[#a855f7] leading-tight italic font-mono">
                {lang === "es" 
                  ? "💡 Inteligente: La app buscará palabras clave en tu cabecera (como 'time/tiempo', 'pressure/presión', 'force/fuerza/empuje') para colocar las columnas de manera automática. También puedes usar archivos sin cabeceras." 
                  : "💡 Smart Auto-detect: The app looks for keywords in your headers (like 'time/tiempo', 'pressure/presión', 'force/thrust') to map columns automatically. Headers can also be omitted completely."}
              </p>
            </div>

            <div className="relative border-2 border-dashed border-border p-4 rounded-md text-center hover:bg-muted/30 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-6 w-6 text-purple-500 mx-auto mb-1.5 opacity-80" />
              <p className="text-[11px] text-foreground font-semibold">
                {expDataRaw.length > 0 ? (
                  <span className="text-emerald-500 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-500" />
                    {lang === "es" ? `${expDataRaw.length} filas cargadas con éxito.` : `${expDataRaw.length} rows loaded successfully.`}
                  </span>
                ) : (
                  lang === "es" ? "Haz clic o arrastra tu archivo CSV o Excel aquí" : "Click or drop your Excel/CSV file here"
                )}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {lang === "es" ? "Soporta formatos .xlsx, .xls, .csv" : "Supports .xlsx, .xls, and .csv formats"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sim Results */}
        <Card
          className={`bg-card border-border shadow-sm border-t-2 ${simApogee ? "border-t-primary" : "border-t-slate-700"}`}
        >
          <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border">
            <CardTitle className="text-[12px] uppercase text-primary font-bold">
              {t.sim_apogee || "Simulation Apogee"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {simApogee ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Apogee
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {simApogee.maxApogee.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Max Velocity
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {simApogee.maxVelocity.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m/s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Time to Apogee
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {simApogee.apogeeTime.toFixed(2)}{" "}
                    <span className="text-sm text-muted-foreground">s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Max Acceleration
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {simApogee.maxAcceleration.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m/s²</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.no_sim || "Run Simulation first to see predictions."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Exp Results */}
        <Card
          className={`bg-card border-border shadow-sm border-t-2 ${expApogee ? "border-t-purple-500" : "border-t-slate-700"}`}
        >
          <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border">
            <CardTitle className="text-[12px] uppercase text-purple-400 font-bold">
              {t.exp_apogee || "Experimental Apogee"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {expApogee ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Apogee
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {expApogee.maxApogee.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Max Velocity
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {expApogee.maxVelocity.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m/s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Time to Apogee
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {expApogee.apogeeTime.toFixed(2)}{" "}
                    <span className="text-sm text-muted-foreground">s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    Max Acceleration
                  </span>
                  <span className="text-xl font-mono text-foreground">
                    {expApogee.maxAcceleration.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">m/s²</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.no_exp || "Upload experimental data to see comparison."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Charts */}
      {React.useMemo(
        () => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
            {isUpdating && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg border border-slate-700/50">
                <div className="flex flex-col items-center gap-2">
                  <span className="relative flex h-8 w-8">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-8 w-8 bg-purple-500"></span>
                  </span>
                  <span className="text-sm text-purple-400 font-mono tracking-widest text-shadow uppercase font-bold text-shadow-lg shadow-purple-500/50">
                    Processing...
                  </span>
                </div>
              </div>
            )}
            {/* Altitude Chart */}
            <Card className="bg-card border-border shadow-sm min-h-[300px] flex flex-col">
              <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-[12px] uppercase text-muted-foreground font-bold">
                  {t.flight_profile || "Altitude Profile"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      activeMainChart === "altitude" ? "default" : "outline"
                    }
                    onClick={() => setActiveMainChart("altitude")}
                    className="h-6 text-[10px] px-2 py-0 border-orange-500/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                    data-state={
                      activeMainChart === "altitude" ? "active" : "inactive"
                    }
                  >
                    {t.altitude || "Altitude"}
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      activeMainChart === "thrust" ? "default" : "outline"
                    }
                    onClick={() => setActiveMainChart("thrust")}
                    className="h-6 text-[10px] px-2 py-0 border-red-500/50 text-red-500 hover:text-red-400 hover:bg-red-500/20 data-[state=active]:bg-red-500 data-[state=active]:text-white"
                    data-state={
                      activeMainChart === "thrust" ? "active" : "inactive"
                    }
                  >
                    {t.thrust_label || "Thrust"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1 min-h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {activeMainChart === "altitude" ? (
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148, 163, 184, 0.15)"
                          opacity={0.7}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="#f97316"
                          fontSize={11}
                          label={{
                            value: "Altitude [m]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -5,
                            fill: "#f97316",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                          }}
                          itemStyle={{ padding: 0 }}
                          labelFormatter={(v) => `t = ${Number(v).toFixed(3)} s`}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          layout="vertical"
                          iconSize={8}
                          wrapperStyle={{
                            position: "absolute",
                            top: 0,
                            right: 10,
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "var(--foreground)",
                            backgroundColor: "var(--card)",
                            padding: "6px",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            zIndex: 10,
                            opacity: 0.95,
                          }}
                        />
                        {simApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="sim_h"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Sim Altitude (m)"
                          />
                        )}
                        {expApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="exp_h"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Exp Altitude (m)"
                          />
                        )}
                      </LineChart>
                    ) : (
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148, 163, 184, 0.15)"
                          opacity={0.7}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="#ef4444"
                          fontSize={11}
                          label={{
                            value: "Thrust [N]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -5,
                            fill: "#ef4444",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                          }}
                          itemStyle={{ padding: 0 }}
                          labelFormatter={(v) => `t = ${Number(v).toFixed(3)} s`}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          layout="vertical"
                          iconSize={8}
                          wrapperStyle={{
                            position: "absolute",
                            top: 0,
                            right: 10,
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "var(--foreground)",
                            backgroundColor: "var(--card)",
                            padding: "6px",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            zIndex: 10,
                            opacity: 0.95,
                          }}
                        />
                        {simApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="sim_F"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Sim Thrust"
                          />
                        )}
                        {calcExpParams.expDataRaw.length > 0 &&
                          (calcExpParams.expDataType === "force" ||
                            calcExpParams.expDataType === "both") && (
                            <Line
                              connectNulls
                              type="monotone"
                              dataKey="exp_F"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                              name="Exp Thrust (Raw)"
                            />
                          )}
                        {calcExpParams.expDataRaw.length > 0 &&
                          (calcExpParams.expDataType === "pressure" ||
                            calcExpParams.expDataType === "both") && (
                            <Line
                              connectNulls
                              type="monotone"
                              dataKey="exp_P_F"
                              stroke="#06b6d4"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                              name="Exp Thrust (from Pressure)"
                            />
                          )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs">
                    {t.no_sim || "Run Simulation first to see predictions."}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Velocity & Accel Chart */}
            <Card className="bg-card border-border shadow-sm min-h-[300px] flex flex-col">
              <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-[12px] uppercase text-muted-foreground font-bold">
                  {t.flight_dynamics || "Velocity & Acceleration"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      activeDynChart === "velocity" ? "default" : "outline"
                    }
                    onClick={() => setActiveDynChart("velocity")}
                    className="h-6 text-[10px] px-2 py-0 border-pink-500/50 text-pink-400 hover:text-pink-300 hover:bg-pink-500/20 data-[state=active]:bg-pink-500 data-[state=active]:text-white"
                    data-state={
                      activeDynChart === "velocity" ? "active" : "inactive"
                    }
                  >
                    {t.velocity}
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      activeDynChart === "acceleration" ? "default" : "outline"
                    }
                    onClick={() => setActiveDynChart("acceleration")}
                    className="h-6 text-[10px] px-2 py-0 border-emerald-500/50 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
                    data-state={
                      activeDynChart === "acceleration" ? "active" : "inactive"
                    }
                  >
                    {t.acceleration}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1 min-h-[300px] flex flex-col gap-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {activeDynChart === "velocity" ? (
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 30, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148, 163, 184, 0.15)"
                          opacity={0.7}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, "auto"]}
                          stroke="#ec4899"
                          fontSize={11}
                          label={{
                            value: "Velocity [m/s]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -15,
                            fill: "#ec4899",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                          }}
                          itemStyle={{ padding: 0 }}
                          labelFormatter={(v) =>
                            `t = ${Number(v).toFixed(3)} s`
                          }
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          layout="vertical"
                          iconSize={8}
                          wrapperStyle={{
                            position: "absolute",
                            top: 0,
                            right: 10,
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "var(--foreground)",
                            backgroundColor: "var(--card)",
                            padding: "6px",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            zIndex: 10,
                            opacity: 0.95,
                          }}
                        />
                        {simApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="sim_v"
                            stroke="#ec4899"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Sim Velocity"
                          />
                        )}
                        {expApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="exp_v"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Exp Velocity"
                          />
                        )}
                      </LineChart>
                    ) : (
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 30, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148, 163, 184, 0.15)"
                          opacity={0.7}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={["auto", "auto"]}
                          stroke="#10b981"
                          fontSize={11}
                          label={{
                            value: "Accel. [m/s²]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -15,
                            fill: "#10b981",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                          }}
                          itemStyle={{ padding: 0 }}
                          labelFormatter={(v) =>
                            `t = ${Number(v).toFixed(3)} s`
                          }
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          layout="vertical"
                          iconSize={8}
                          wrapperStyle={{
                            position: "absolute",
                            top: 0,
                            right: 10,
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "var(--foreground)",
                            backgroundColor: "var(--card)",
                            padding: "6px",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            zIndex: 10,
                            opacity: 0.95,
                          }}
                        />
                        {simApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="sim_a"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Sim Accel."
                          />
                        )}
                        {expApogee && (
                          <Line
                            connectNulls
                            type="monotone"
                            dataKey="exp_a"
                            stroke="#bef264"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name="Exp Accel."
                          />
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs">
                    {t.no_sim || "Run Simulation first to see predictions."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ),
        [chartData, isUpdating, expApogee, t, activeDynChart, activeMainChart],
      )}
    </div>
  );
}
