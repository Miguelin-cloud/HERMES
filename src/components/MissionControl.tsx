import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ThemeColors } from "../lib/theme";
import { Download, FileSpreadsheet, Sparkles, CheckCircle2, Layers, UploadCloud, HelpCircle, X, Compass, ExternalLink, Lock } from "lucide-react";
import * as XLSX from "xlsx";

const MC_STORAGE_KEY = "hermes_mc_params";
const MC_DRAFT_STORAGE_KEY = "hermes_mc_draft_params";

function parseStoredMcParams(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        emptyRocketMass: typeof p.emptyRocketMass === "number" && !isNaN(p.emptyRocketMass) ? Math.max(0, p.emptyRocketMass) : 6.5,
        rocketDiameter: typeof p.rocketDiameter === "number" && !isNaN(p.rocketDiameter) ? Math.max(1, p.rocketDiameter) : 80,
        launchAltitude: typeof p.launchAltitude === "number" && !isNaN(p.launchAltitude) ? p.launchAltitude : 169,
        launchTemp: typeof p.launchTemp === "number" && !isNaN(p.launchTemp) ? p.launchTemp : 28,
        flightPathAngle: typeof p.flightPathAngle === "number" && !isNaN(p.flightPathAngle) ? Math.max(0, Math.min(90, p.flightPathAngle)) : 90,
      };
    }
  } catch {
    // ignore storage parse error
  }
  return null;
}

export function loadSavedMissionControlParams() {
  return (
    parseStoredMcParams(MC_STORAGE_KEY) ?? {
      emptyRocketMass: 6.5,
      rocketDiameter: 80,
      launchAltitude: 169,
      launchTemp: 28,
      flightPathAngle: 90,
    }
  );
}

function loadDraftMissionControlParams() {
  return parseStoredMcParams(MC_DRAFT_STORAGE_KEY) ?? loadSavedMissionControlParams();
}

const NumberInputMC = ({
  label,
  value,
  onChange,
  tooltip,
  decimals,
  min,
  max,
}: any) => {
  const formatVal = (v: number) =>
    decimals !== undefined && !isNaN(v) ? Number(v).toFixed(decimals) : String(v);

  const [internal, setInternal] = useState(() => formatVal(value));
  const lastPushedValue = React.useRef(value);
  const isFocusedRef = React.useRef(false);
  const justFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current && value !== lastPushedValue.current) {
      setInternal(formatVal(value));
      lastPushedValue.current = value;
    }
  }, [value, decimals]);

  const commitBlur = () => {
    isFocusedRef.current = false;
    justFocusedRef.current = false;
    const normalized = internal.replace(/[º°\s]/g, "").replace(",", ".").trim();
    const parsed = parseFloat(normalized);
    if (normalized === "" || normalized === "-" || normalized === "." || isNaN(parsed)) {
      const fallback = formatVal(value);
      setInternal(fallback);
      lastPushedValue.current = value;
      return;
    }
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== value || clamped !== lastPushedValue.current) {
      lastPushedValue.current = clamped;
      onChange(clamped);
    }
    setInternal(formatVal(clamped));
  };

  return (
    <div
      className="group relative flex items-center justify-between gap-1.5 w-full min-w-0 border-b border-border/80 pb-1 mb-1 px-1.5 py-0.5 hover:bg-muted/40 rounded-sm transition-colors focus-within:bg-accent/35 focus-within:border-primary"
      title={tooltip}
    >
      <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium flex-1 min-w-0 group-focus-within:text-foreground transition-colors z-10 cursor-help select-none leading-tight py-0.5 whitespace-normal break-words">
        {label}
      </UiLabel>
      <input
        type="text"
        inputMode="decimal"
        value={internal}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow only numeric characters, decimal separators, optional minus, and strip degree symbols cleanly
          const cleaned = raw.replace(/[º°\s]/g, "");
          if (cleaned !== "" && !/^-?\d*[.,]?\d*$/.test(cleaned)) {
            return;
          }
          setInternal(cleaned);
          const normalized = cleaned.replace(",", ".").trim();
          if (
            normalized !== "" &&
            normalized !== "-" &&
            normalized !== "."
          ) {
            const val = parseFloat(normalized);
            if (!isNaN(val)) {
              const inBounds =
                (min === undefined || val >= min) &&
                (max === undefined || val <= max);
              if (inBounds) {
                lastPushedValue.current = val;
                onChange(val);
              }
            }
          }
        }}
        onBlur={commitBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => {
          isFocusedRef.current = true;
          justFocusedRef.current = true;
          e.target.select();
        }}
        onMouseUp={(e) => {
          if (justFocusedRef.current) {
            e.preventDefault();
            justFocusedRef.current = false;
          }
        }}
        className="w-[62px] sm:w-[68px] shrink-0 h-6 min-h-0 text-[11px] sm:text-xs py-0 px-1.5 text-right bg-background/90 border border-border/40 text-foreground font-mono font-semibold shadow-2xs rounded outline-none ring-0 focus:ring-1 focus:ring-primary focus:border-primary transition-all z-10"
      />
    </div>
  );
};

export function MissionControl({
  results,
  lang,
  onApogeeUpdate,
  nozzleParams,
  motorMassKg = 0,
  propellantMassKg = 0,
  themeColors,
}: {
  results: SimulationResults | null;
  lang: Language;
  onApogeeUpdate?: (sim: ApogeeResult | null, exp: ApogeeResult | null) => void;
  nozzleParams?: any;
  motorMassKg?: number;
  propellantMassKg?: number;
  themeColors?: ThemeColors;
}) {
  const t = translations[lang];
  const simPrimaryColor = themeColors?.primary || "#2563eb";
  const simThrustColor = themeColors?.chartThrust || "#2563eb";
  const expSecondaryColor =
    themeColors?.secondary && themeColors.secondary.toLowerCase() !== simThrustColor.toLowerCase() && themeColors.secondary.toLowerCase() !== simPrimaryColor.toLowerCase()
      ? themeColors.secondary
      : "#f97316";
  const simAccelColor = themeColors?.secondary || "#10b981";
  const initialApplied = React.useMemo(() => loadSavedMissionControlParams(), []);
  const initialDraft = React.useMemo(() => loadDraftMissionControlParams(), []);

  // Parameters for Apogee Simulation (Draft edit states; applied only when Update button is clicked)
  const [emptyRocketMass, setEmptyRocketMass] = useState(initialDraft.emptyRocketMass);
  const [rocketDiameter, setRocketDiameter] = useState(initialDraft.rocketDiameter);
  const [launchAltitude, setLaunchAltitude] = useState(initialDraft.launchAltitude);
  const [launchTemp, setLaunchTemp] = useState(initialDraft.launchTemp);
  const [flightPathAngle, setFlightPathAngle] = useState(initialDraft.flightPathAngle);

  const activePropellantMassKg =
    results && results.mgra_total && results.mgra_total.length > 0
      ? results.mgra_total[0]
      : propellantMassKg;
  
  // Aerodynamic Data & Format Modal
  const [useAeroData, setUseAeroData] = useState(false);
  const [aeroDataRaw, setAeroDataRaw] = useState("");
  const [aeroParsed, setAeroParsed] = useState<{ mach: number[], cd: number[] } | null>(null);
  const [aeroInputTab, setAeroInputTab] = useState<"upload" | "manual">("upload");
  const [aeroFileName, setAeroFileName] = useState<string>("");
  const [isAeroModalOpen, setIsAeroModalOpen] = useState<boolean>(false);

  const downloadAeroTemplate = () => {
    const headers = "Mach,Cd\n";
    const sample = "0.00,0.45\n0.20,0.45\n0.40,0.44\n0.60,0.44\n0.80,0.46\n0.90,0.52\n1.00,0.61\n1.10,0.65\n1.20,0.66\n1.40,0.61\n1.60,0.55\n1.80,0.51\n2.00,0.48\n2.50,0.42\n3.00,0.38\n3.50,0.35\n4.00,0.33\n";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "hermes_plantilla_mach_cd.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAeroFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ("files" in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ("dataTransfer" in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }
    if (!file) return;

    setAeroFileName(file.name);
    const reader = new FileReader();
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    reader.onload = (evt) => {
      try {
        let data: any[][] = [];
        if (isXlsx) {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        } else {
          const text = evt.target?.result as string;
          data = text
            .split(/\r?\n/)
            .map((row) => row.split(/[\t,;]+/))
            .filter((row) => row.length > 0 && row.some((c) => c.trim() !== ""));
        }

        if (data.length === 0) return;

        let machIdx = 0;
        let cdIdx = 1;

        // Auto-detect header columns
        for (let r = 0; r < Math.min(5, data.length); r++) {
          const row = data[r];
          if (!row) continue;
          let foundM = -1;
          let foundCd = -1;
          for (let c = 0; c < row.length; c++) {
            const s = String(row[c] || "").toLowerCase().trim();
            if (s.includes("mach") || s === "m" || s.startsWith("mach_") || s.includes("velocidad")) {
              foundM = c;
            } else if (s.includes("cd") || s.includes("drag") || s.includes("coef") || s.includes("cx") || s.includes("resistencia") || s.includes("arrastre")) {
              foundCd = c;
            }
          }
          if (foundM !== -1 && foundCd !== -1) {
            machIdx = foundM;
            cdIdx = foundCd;
            break;
          }
        }

        const linesOut: string[] = [];
        const mArr: number[] = [];
        const cArr: number[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          if (machIdx >= row.length || cdIdx >= row.length) continue;

          const mRaw = parseFloat(String(row[machIdx]).replace(",", "."));
          const cRaw = parseFloat(String(row[cdIdx]).replace(",", "."));

          if (!isNaN(mRaw) && !isNaN(cRaw)) {
            mArr.push(mRaw);
            cArr.push(cRaw);
            linesOut.push(`${mRaw.toFixed(2)}\t${cRaw.toFixed(4)}`);
          }
        }

        if (mArr.length > 0) {
          setAeroDataRaw(linesOut.join("\n"));
          setUseAeroData(true);
        }
      } catch (err) {
        console.error("Error parsing aerodynamic file:", err);
      }
    };

    if (isXlsx) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  React.useEffect(() => {
    if (!useAeroData || aeroDataRaw.trim() === "") {
        setAeroParsed(null);
        return;
    }
    const lines = aeroDataRaw.split(/\r?\n/);
    const m: number[] = [];
    const c: number[] = [];
    for (const line of lines) {
        const parts = line.split(/[\t,;]+/);
        if (parts.length >= 2) {
            const valM = parseFloat(parts[0].replace(",", "."));
            const valC = parseFloat(parts[1].replace(",", "."));
            if (!isNaN(valM) && !isNaN(valC)) {
                m.push(valM);
                c.push(valC);
            }
        }
    }
    if (m.length > 0) {
        setAeroParsed({ mach: m, cd: c });
    } else {
        setAeroParsed(null);
    }
  }, [useAeroData, aeroDataRaw]);

  // Applied States for Calculation (only changed when Update is clicked)
  const [calcParams, setCalcParams] = useState({
    emptyRocketMass: initialApplied.emptyRocketMass,
    rocketDiameter: initialApplied.rocketDiameter,
    launchAltitude: initialApplied.launchAltitude,
    launchTemp: initialApplied.launchTemp,
    flightPathAngle: initialApplied.flightPathAngle,
    useAeroData: false,
    aeroParsed: null as { mach: number[], cd: number[] } | null,
  });

  // Persist draft edits across tab switches without triggering apogee/animation updates
  useEffect(() => {
    const safeAngle = Math.max(0, Math.min(90, isNaN(flightPathAngle) ? 90 : flightPathAngle));
    try {
      localStorage.setItem(
        MC_DRAFT_STORAGE_KEY,
        JSON.stringify({
          emptyRocketMass,
          rocketDiameter,
          launchAltitude,
          launchTemp,
          flightPathAngle: safeAngle,
        }),
      );
    } catch {
      // ignore
    }
  }, [emptyRocketMass, rocketDiameter, launchAltitude, launchTemp, flightPathAngle]);

  const hasChanges =
    emptyRocketMass !== calcParams.emptyRocketMass ||
    rocketDiameter !== calcParams.rocketDiameter ||
    launchAltitude !== calcParams.launchAltitude ||
    launchTemp !== calcParams.launchTemp ||
    flightPathAngle !== calcParams.flightPathAngle ||
    useAeroData !== calcParams.useAeroData ||
    aeroParsed !== calcParams.aeroParsed;

  const handleUpdate = () => {
    const safeAngle = Math.max(0, Math.min(90, isNaN(flightPathAngle) ? 90 : flightPathAngle));
    if (safeAngle !== flightPathAngle) setFlightPathAngle(safeAngle);
    const appliedPayload = {
      emptyRocketMass,
      rocketDiameter,
      launchAltitude,
      launchTemp,
      flightPathAngle: safeAngle,
    };
    try {
      localStorage.setItem(MC_STORAGE_KEY, JSON.stringify(appliedPayload));
      localStorage.setItem(MC_DRAFT_STORAGE_KEY, JSON.stringify(appliedPayload));
    } catch {
      // ignore
    }
    setCalcParams({ ...appliedPayload, useAeroData, aeroParsed });
  };

  // Simulated Apogee Result
  const [simApogee, setSimApogee] = useState<ApogeeResult | null>(null);

  // Experimental Data state
  const [expDataRaw, setExpDataRaw] = useState<
    { t: number; p: number; f: number }[]
  >([]);
  const [presUnit, setPresUnit] = useState("MPa");
  const [forceUnit, setForceUnit] = useState("N");
  const [expDataType, setExpDataType] = useState<"time_thrust" | "time_pressure" | "time_both" | "time_p_time_f">(
    "time_thrust",
  );

  const [calcExpParams, setCalcExpParams] = useState({
    expDataRaw: [] as { t: number; p: number; f: number }[],
    presUnit: "MPa",
    forceUnit: "N",
    expDataType: "time_thrust" as "time_thrust" | "time_pressure" | "time_both" | "time_p_time_f",
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
      case "Pa":
        return val * 1e-6;
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
    if (onApogeeUpdate && (simApogee !== null || !results)) {
      onApogeeUpdate(simApogee, expApogee);
    }
  }, [simApogee, expApogee, results]);

  // Rerun simulated apogee synchronously when results, motor mass, or rocket inputs change
  useEffect(() => {
    if (!results) {
      setSimApogee(null);
      return;
    }
    const totalDryMass = calcParams.emptyRocketMass + motorMassKg;
    const simResult = calculateApogee(
      results.t,
      results.E_N,
      results.mgra_total.map((mg) => mg + totalDryMass),
      totalDryMass,
      calcParams.rocketDiameter / 1000,
      calcParams.launchAltitude,
      calcParams.launchTemp,
      calcParams.aeroParsed ? calcParams.aeroParsed.mach : undefined,
      calcParams.aeroParsed ? calcParams.aeroParsed.cd : undefined,
      calcParams.flightPathAngle
    );
    setSimApogee(simResult);
    setIsUpdating(false);
  }, [results, calcParams, motorMassKg]);

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
        if (calcExpParams.expDataType === "time_pressure") {
          const P_MPa_gauge = convertPresToMPa(d.p, calcExpParams.presUnit);
          const P_Pa_gauge = P_MPa_gauge * 1e6;
          
          const Pa = 101325 * Math.pow(1 - 2.25577e-5 * (calcParams.launchAltitude || 0), 5.25588);
          // Absolute chamber pressure: gauge pressure + atmospheric pressure (never below Pa)
          const P_Pa_abs = Math.max(Pa, P_Pa_gauge + Pa);
          
          const Dt = nozzleParams?.Dt0 || 18.8; // mm
          const Ds = nozzleParams?.Ds || 37.6; // mm
          const alpha_deg = nozzleParams?.alpha || 12; // deg
          const etanoz = nozzleParams?.etanoz || 0.95;
          const At_m2 = Math.PI * Math.pow(Dt / 2000, 2);
          const epsilon = Math.pow(Ds / Dt, 2);
          
          const k = results?.summary.k_avg || 1.13;
          
          const CF = getTTIThrustCoefficient(P_Pa_abs, Pa, k, epsilon, alpha_deg, etanoz);
          f_N = P_Pa_abs * At_m2 * CF;
        } else if (calcExpParams.expDataType === "time_both" || calcExpParams.expDataType === "time_p_time_f") {
          // If direct load cell force is available, prioritize it; otherwise calculate from pressure
          if (d.f > 0) {
            f_N = convertForceToN(d.f, calcExpParams.forceUnit);
          } else if (d.p > 0) {
            const P_MPa_gauge = convertPresToMPa(d.p, calcExpParams.presUnit);
            const P_Pa_gauge = P_MPa_gauge * 1e6;
            const Pa = 101325 * Math.pow(1 - 2.25577e-5 * (calcParams.launchAltitude || 0), 5.25588);
            const P_Pa_abs = Math.max(Pa, P_Pa_gauge + Pa);
            const Dt = nozzleParams?.Dt0 || 18.8;
            const Ds = nozzleParams?.Ds || 37.6;
            const alpha_deg = nozzleParams?.alpha || 12;
            const etanoz = nozzleParams?.etanoz || 0.95;
            const At_m2 = Math.PI * Math.pow(Dt / 2000, 2);
            const epsilon = Math.pow(Ds / Dt, 2);
            const k = results?.summary.k_avg || 1.13;
            const CF = getTTIThrustCoefficient(P_Pa_abs, Pa, k, epsilon, alpha_deg, etanoz);
            f_N = P_Pa_abs * At_m2 * CF;
          } else {
            f_N = 0;
          }
        } else {
          f_N = convertForceToN(Math.max(0, d.f), calcExpParams.forceUnit);
        }
        return Math.max(0, f_N);
      });

      // Basic interpolation of simulated mass onto experimental time array
      const totalDryMass = calcParams.emptyRocketMass + motorMassKg;
      const exp_mass = exp_t.map((et) => {
        if (!results) return totalDryMass;
        let idx = 0;
        while (idx < results.t.length - 1 && results.t[idx] <= et) {
          idx++;
        }
        const simMass = results.mgra_total[idx] + totalDryMass;
        return simMass;
      });

      const res = calculateApogee(
        exp_t,
        exp_f_N,
        exp_mass,
        totalDryMass,
        calcParams.rocketDiameter / 1000,
        calcParams.launchAltitude,
        calcParams.launchTemp,
        calcParams.aeroParsed ? calcParams.aeroParsed.mach : undefined,
        calcParams.aeroParsed ? calcParams.aeroParsed.cd : undefined,
        calcParams.flightPathAngle
      );

      setExpApogee(res);
      setIsUpdating(false);
    }, 50);
  }, [calcExpParams, calcParams, results, nozzleParams, motorMassKg]);

  const downloadTemplate = () => {
    let headers = "";
    let sample = "";
    if (expDataType === "time_pressure") {
      headers = "Time,Pressure\n";
      sample = "0.00,0.10\n0.05,1.25\n0.10,2.85\n0.15,4.10\n0.20,3.95\n0.25,1.80\n0.30,0.10\n";
    } else if (expDataType === "time_both") {
      headers = "Time,Pressure,Force\n";
      sample = "0.00,0.10,0.0\n0.05,1.25,120.5\n0.10,2.85,340.2\n0.15,4.10,510.9\n0.20,3.95,490.4\n0.25,1.80,180.1\n0.30,0.10,0.0\n";
    } else if (expDataType === "time_p_time_f") {
      headers = "Time_Pressure,Pressure,Time_Force,Force\n";
      sample = "0.00,0.10,0.00,0.0\n0.05,1.25,0.04,120.5\n0.10,2.85,0.09,340.2\n0.15,4.10,0.14,510.9\n0.20,3.95,0.19,490.4\n0.25,1.80,0.24,180.1\n0.30,0.10,0.29,0.0\n";
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

      const parsed: { t: number; p: number; f: number }[] = [];

      // Independent Times Case (Time_P, Pressure, Time_F, Force)
      if (expDataType === "time_p_time_f") {
        let timePIdx = 0;
        let pressIdx = 1;
        let timeFIdx = 2;
        let forceIdx = 3;

        // Try to auto-detect columns from header row
        for (let r = 0; r < Math.min(5, data.length); r++) {
          const row = data[r] as any[];
          if (!row) continue;
          let foundTP = -1, foundP = -1, foundTF = -1, foundF = -1;

          for (let c = 0; c < row.length; c++) {
            const s = String(row[c] || "").toLowerCase().trim();
            if (!s) continue;
            if ((s.includes("time") || s.includes("tiempo") || s.startsWith("t")) && (s.includes("p") || s.includes("pres"))) {
              foundTP = c;
            } else if ((s.includes("time") || s.includes("tiempo") || s.startsWith("t")) && (s.includes("f") || s.includes("empuje") || s.includes("thrust") || s.includes("force"))) {
              foundTF = c;
            } else if (s.includes("press") || s.includes("pres") || s === "p" || s.includes("mpa") || s.includes("bar") || s.includes("psi")) {
              foundP = c;
            } else if (s.includes("force") || s.includes("thrust") || s.includes("empuje") || s.includes("fuerza") || s === "f" || s === "n" || s.includes("load")) {
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

        const pPoints: { t: number; p: number }[] = [];
        const fPoints: { t: number; f: number }[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length === 0) continue;

          // Parse Pressure channel
          if (timePIdx < row.length && pressIdx < row.length) {
            const tpRaw = parseFloat(String(row[timePIdx]).replace(",", "."));
            const pRaw = parseFloat(String(row[pressIdx]).replace(",", "."));
            if (!isNaN(tpRaw) && !isNaN(pRaw)) {
              pPoints.push({ t: tpRaw, p: pRaw });
            }
          }

          // Parse Force channel
          if (timeFIdx < row.length && forceIdx < row.length) {
            const tfRaw = parseFloat(String(row[timeFIdx]).replace(",", "."));
            const fRaw = parseFloat(String(row[forceIdx]).replace(",", "."));
            if (!isNaN(tfRaw) && !isNaN(fRaw)) {
              fPoints.push({ t: tfRaw, f: fRaw });
            }
          }
        }

        pPoints.sort((a, b) => a.t - b.t);
        fPoints.sort((a, b) => a.t - b.t);

        // Linear interpolation helper
        const interp = (pts: { t: number; val: number }[], targetT: number): number => {
          if (pts.length === 0) return 0;
          if (targetT <= pts[0].t) return pts[0].val;
          if (targetT >= pts[pts.length - 1].t) return pts[pts.length - 1].val;
          let idx = 0;
          while (idx < pts.length - 1 && pts[idx + 1].t <= targetT) idx++;
          const p0 = pts[idx];
          const p1 = pts[idx + 1];
          if (p1.t === p0.t) return p0.val;
          return p0.val + ((targetT - p0.t) / (p1.t - p0.t)) * (p1.val - p0.val);
        };

        const pAdapter = pPoints.map(pt => ({ t: pt.t, val: pt.p }));
        const fAdapter = fPoints.map(pt => ({ t: pt.t, val: pt.f }));

        const allTimeSet = new Set<number>();
        pPoints.forEach(pt => allTimeSet.add(Number(pt.t.toFixed(6))));
        fPoints.forEach(pt => allTimeSet.add(Number(pt.t.toFixed(6))));
        const allTimes = Array.from(allTimeSet).sort((a, b) => a - b);

        for (const t of allTimes) {
          const p = interp(pAdapter, t);
          const f = interp(fAdapter, t);
          parsed.push({ t, p, f });
        }
      } else {
        // Robust Column Header Detection for Standard, Pressure, or Shared-Time modes
        let timeIdx = 0;
        let pressIdx = -1;
        let forceIdx = -1;
        let foundTime = -1;
        let foundPress = -1;
        let foundForce = -1;
        let hasHeader = false;

        for (let r = 0; r < Math.min(5, data.length); r++) {
          const row = data[r] as any[];
          if (!row) continue;
          
          foundTime = -1;
          foundPress = -1;
          foundForce = -1;

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

          if (foundTime !== -1 && (foundPress !== -1 || foundForce !== -1)) {
            timeIdx = foundTime;
            if (foundPress !== -1) pressIdx = foundPress;
            if (foundForce !== -1) forceIdx = foundForce;
            hasHeader = true;
            break;
          }
        }

        // Default fallbacks by expDataType if no header found
        if (!hasHeader) {
          if (expDataType === "time_thrust") {
            timeIdx = 0;
            forceIdx = 1;
            pressIdx = -1;
          } else if (expDataType === "time_pressure") {
            timeIdx = 0;
            pressIdx = 1;
            forceIdx = -1;
          } else if (expDataType === "time_both") {
            timeIdx = 0;
            pressIdx = 1;
            forceIdx = 2;
          }
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length === 0) continue;

          const t_raw = parseFloat(String(row[timeIdx]).replace(",", "."));
          if (isNaN(t_raw)) continue;

          const p_raw = pressIdx !== -1 && pressIdx < row.length ? parseFloat(String(row[pressIdx]).replace(",", ".")) : 0;
          const f_raw = forceIdx !== -1 && forceIdx < row.length ? parseFloat(String(row[forceIdx]).replace(",", ".")) : 0;

          const p_val = isNaN(p_raw) ? 0 : p_raw;
          const f_val = isNaN(f_raw) ? 0 : f_raw;

          parsed.push({ t: t_raw, p: p_val, f: f_val });
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

      if (calcExpParams.expDataType !== "time_pressure") {
        if (d.f !== undefined && d.f !== null) {
          exp_F = Math.max(0, convertForceToN(d.f, calcExpParams.forceUnit));
        }
      }
      if (calcExpParams.expDataType !== "time_thrust") {
        if (d.p !== undefined && d.p !== null) {
          const P_MPa_gauge = convertPresToMPa(d.p, calcExpParams.presUnit);
          const P_Pa_gauge = P_MPa_gauge * 1e6;
          
          const Pa = 101325 * Math.pow(1 - 2.25577e-5 * (calcParams.launchAltitude || 0), 5.25588);
          // Absolute chamber pressure: gauge pressure + atmospheric pressure (never below Pa)
          const P_Pa_abs = Math.max(Pa, P_Pa_gauge + Pa);
          
          const Dt = nozzleParams?.Dt0 || 18.8; // mm
          const Ds = nozzleParams?.Ds || 37.6; // mm
          const alpha_deg = nozzleParams?.alpha || 12; // deg
          const etanoz = nozzleParams?.etanoz || 0.95;
          const At_m2 = Math.PI * Math.pow(Dt / 2000, 2);
          const epsilon = Math.pow(Ds / Dt, 2);

          const k = results?.summary.k_avg || 1.13;

          const CF = getTTIThrustCoefficient(P_Pa_abs, Pa, k, epsilon, alpha_deg, etanoz);
          exp_P_F = Math.max(0, P_Pa_abs * At_m2 * CF);
        }
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
        <div className="flex flex-col gap-4">
        {/* Rocket Parameters */}
        <Card data-tour="mission-rocket-params-card" className="bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-primary shrink-0" />
              <span>{t.rocket_params || "Rocket Parameters"}</span>
            </CardTitle>
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={!hasChanges || isUpdating}
              variant={hasChanges ? "default" : "secondary"}
              className="h-6 text-[10px] px-2.5 py-0"
            >
              {isUpdating ? "..." : t.update_btn || "Actualizar"}
            </Button>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <NumberInputMC
              label={t.empty_rocket_mass || "Empty Rocket Mass [kg]"}
              value={emptyRocketMass}
              onChange={setEmptyRocketMass}
              min={0}
              step="0.1"
              tooltip={t.empty_rocket_mass_desc}
            />
            <NumberInputMC
              label={t.rocket_diam || "Diameter [mm]"}
              value={rocketDiameter}
              onChange={setRocketDiameter}
              min={1}
              step="1"
            />
            {/* Read-Only Auto-Synced Motor Mass */}
            <div
              className="flex items-center justify-between gap-1.5 w-full border-b border-border/80 pb-1 mb-1 px-1.5 py-0.5 bg-muted/25 rounded-sm"
              title={t.motor_mass_breakdown}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Lock className="w-2.5 h-2.5 text-primary shrink-0" />
                <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium leading-tight truncate">
                  {t.mc_motor_mass || "Motor Mass [kg]"}
                </UiLabel>
              </div>
              <span className="w-[62px] sm:w-[68px] h-6 flex items-center justify-end text-[11px] sm:text-xs font-mono tabular-nums font-semibold text-primary px-1.5 bg-background rounded-sm border border-border shrink-0">
                {motorMassKg.toFixed(3)}
              </span>
            </div>
            {/* Read-Only Auto-Synced Propellant Mass */}
            <div
              className="flex items-center justify-between gap-1.5 w-full border-b border-border/80 pb-1 mb-1 px-1.5 py-0.5 bg-muted/25 rounded-sm"
              title={t.auto_from_inputs}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Lock className="w-2.5 h-2.5 text-secondary shrink-0" />
                <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium leading-tight truncate">
                  {t.mc_prop_mass || "Propellant Mass [kg]"}
                </UiLabel>
              </div>
              <span className="w-[62px] sm:w-[68px] h-6 flex items-center justify-end text-[11px] sm:text-xs font-mono tabular-nums font-semibold text-foreground px-1.5 bg-background rounded-sm border border-border shrink-0">
                {activePropellantMassKg.toFixed(3)}
              </span>
            </div>
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
            <div className="col-span-2 pt-1.5 border-t border-border/50 mt-1">
              <NumberInputMC
                label={
                  <span className="flex items-center justify-between gap-2 w-full pr-1">
                    <span className="flex items-center gap-1">
                      <Compass className="w-3 h-3 text-primary shrink-0" />
                      <span>{t.flight_path_angle || "Flight Path Angle [º]"}</span>
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-primary font-semibold shrink-0">
                      {flightPathAngle === 90
                        ? t.mc_vertical
                        : `${Number(flightPathAngle).toFixed(1)}º (${(90 - flightPathAngle).toFixed(1)}º ${t.mc_tilt_suffix})`}
                    </span>
                  </span>
                }
                value={flightPathAngle}
                onChange={(val: number) => setFlightPathAngle(val)}
                min={0}
                max={90}
                tooltip={t.flight_path_angle_desc || "Elevación de la rampa respecto a la horizontal (90º = vertical, 87º = 3º de inclinación)"}
              />
            </div>
            {/* Total Liftoff Mass Summary Strip */}
            <div className="col-span-2 mt-1.5 pt-1.5 border-t border-border/50 flex items-center justify-between px-2 py-1 rounded bg-muted/40 text-[10px] sm:text-[11px]">
              <span className="text-muted-foreground font-medium">
                {t.mc_liftoff_mass || "Total Liftoff Mass"}:
              </span>
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {(emptyRocketMass + motorMassKg + activePropellantMassKg).toFixed(3)} kg
                <span className="text-[9.5px] text-muted-foreground font-normal ml-1.5">
                  ({emptyRocketMass.toFixed(2)} + {motorMassKg.toFixed(3)} + {activePropellantMassKg.toFixed(3)})
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* Aerodynamic Data */}
        <Card data-tour="mission-aero-card" className="bg-card border-border rounded-lg overflow-hidden flex-1">
          <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-xs bg-emerald-500 shrink-0" />
                <span>{t.mc_aero_title}</span>
              </CardTitle>
              {useAeroData && aeroParsed && aeroParsed.mach.length > 0 ? (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {aeroParsed.mach.length} pts
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">
                  · {t.mc_std_cd}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setIsAeroModalOpen(true)}
                variant="outline"
                className="h-6 text-[10px] px-2 py-0 gap-1 font-semibold border-border text-primary hover:bg-primary/10 hover:border-primary/50"
              >
                <FileSpreadsheet className="w-3 h-3" />
                {t.import_aero_btn}
              </Button>
              <div className="flex items-center space-x-1.5 border-l border-border pl-2">
                <UiLabel htmlFor="use-aero" className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground cursor-pointer">
                  {t.mc_use_btn}
                </UiLabel>
                <Checkbox
                  id="use-aero"
                  checked={useAeroData}
                  onCheckedChange={(v) => setUseAeroData(!!v)}
                  className="w-4 h-4 rounded-sm border-2 border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                />
              </div>
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={!hasChanges || isUpdating}
                variant={hasChanges ? "default" : "secondary"}
                className="h-6 text-[10px] px-2.5 py-0 shrink-0"
              >
                {isUpdating ? "..." : t.update_btn || "Actualizar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 flex flex-col gap-2.5">
             <div className="flex items-start justify-between gap-3">
               <p className="text-[10px] text-muted-foreground leading-snug flex-1">
                 {t.mc_aero_desc}
               </p>
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => setIsAeroModalOpen(true)}
                 className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 underline font-semibold shrink-0"
               >
                 <HelpCircle className="w-3 h-3 mr-1" />
                 {t.view_format_btn || "Ver Formato / Ejemplo"}
               </Button>
             </div>

             {!useAeroData && (
               <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border text-[11px] font-mono">
                 <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-xs bg-muted-foreground/60" />
                   <span className="text-muted-foreground">
                     {t.mc_aero_active_std}
                   </span>
                 </div>
                 <Button
                   size="sm"
                   variant="outline"
                   onClick={() => setIsAeroModalOpen(true)}
                   className="h-6 text-[10px] gap-1 px-2 border-border text-primary hover:bg-primary/10 font-semibold"
                 >
                   <FileSpreadsheet className="w-3 h-3" />
                   {t.mc_upload_custom}
                 </Button>
               </div>
             )}
             
             {useAeroData && (
                <div className="space-y-2.5">
                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-1.5 p-0.5 bg-muted/60 rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setAeroInputTab("upload")}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        aeroInputTab === "upload"
                          ? "bg-background text-foreground border border-border/50"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileSpreadsheet className="w-3 h-3 text-primary" />
                      {t.mc_upload_csv_excel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAeroInputTab("manual")}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        aeroInputTab === "manual"
                          ? "bg-background text-foreground border border-border/50"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers className="w-3 h-3 text-secondary" />
                      {t.mc_manual_paste}
                    </button>
                  </div>

                  {aeroInputTab === "upload" ? (
                    <div className="space-y-2">
                      {/* Structure Diagram & Template Download */}
                      <div className="bg-muted/40 border border-border p-2 rounded-md text-[10px] space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground font-semibold">
                          <span className="uppercase tracking-wider text-[9px]">
                            {t.mc_expected_aero_fmt}
                          </span>
                          <Button
                            onClick={downloadAeroTemplate}
                            size="sm"
                            variant="outline"
                            className="h-5 text-[9px] gap-1 px-1.5 py-0 border-border hover:border-primary/60 bg-background text-primary font-semibold"
                          >
                            <Download className="h-2.5 w-2.5" />
                            {t.mc_download_csv_tpl}
                          </Button>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-mono border-collapse text-[9px]">
                            <thead>
                              <tr className="border-b border-border/60 text-muted-foreground/80">
                                <th className="py-0.5 px-1.5">Col 1 (Mach)</th>
                                <th className="py-0.5 px-1.5">Col 2 ({t.mc_col_drag})</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <td className="py-0.5 px-1.5 font-bold text-foreground">0.00</td>
                                <td className="py-0.5 px-1.5 text-primary">0.45</td>
                              </tr>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <td className="py-0.5 px-1.5 font-bold text-foreground">1.00</td>
                                <td className="py-0.5 px-1.5 text-primary">0.61</td>
                              </tr>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <td className="py-0.5 px-1.5 font-bold text-foreground">2.00</td>
                                <td className="py-0.5 px-1.5 text-primary">0.48</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Dropzone */}
                      <div className="relative border border-dashed border-border hover:border-primary/60 p-3 rounded-md text-center hover:bg-muted/30 transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept=".csv, .xlsx, .xls, .txt"
                          onChange={handleAeroFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <FileSpreadsheet className="h-5 w-5 text-primary mx-auto mb-1 opacity-85" />
                        <p className="text-[10.5px] text-foreground font-semibold">
                          {aeroParsed && aeroParsed.mach.length > 0 ? (
                            <span className="text-emerald-500 dark:text-emerald-400 flex items-center justify-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-500" />
                              {aeroFileName ? `${aeroFileName} (${aeroParsed.mach.length} pts)` : `${aeroParsed.mach.length} ${t.mc_pts_loaded}`}
                            </span>
                          ) : (
                            t.mc_drop_csv_hint
                          )}
                        </p>
                        <p className="text-[9.5px] text-muted-foreground mt-0.5 font-mono">
                          {t.mc_aero_autodetect}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-[120px] flex flex-col relative">
                      <textarea
                        className="w-full h-full min-h-[130px] p-2 text-xs font-mono bg-muted/30 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                        placeholder={"0.0\t0.45\n0.2\t0.45\n0.8\t0.46\n1.0\t0.61\n1.2\t0.66\n2.0\t0.48\n3.0\t0.38..."}
                        value={aeroDataRaw}
                        onChange={(e) => setAeroDataRaw(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Summary status badge */}
                  {aeroParsed && aeroParsed.mach.length > 0 && (
                    <div className="flex items-center justify-between p-1.5 px-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9.5px] text-emerald-600 dark:text-emerald-400 font-mono">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 size={11} />
                        <span>{aeroParsed.mach.length} {t.mc_pts_processed}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>M: {Math.min(...aeroParsed.mach).toFixed(1)} - {Math.max(...aeroParsed.mach).toFixed(1)}</span>
                        <span>Cd max: {Math.max(...aeroParsed.cd).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            {/* Modal Format & Importer for Mach vs Cd */}
            {isAeroModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-card border border-border shadow-xl rounded-xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-border pb-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-mono uppercase tracking-wider">
                        <FileSpreadsheet className="w-4 h-4 text-primary" />
                        {t.mc_aero_modal_title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t.mc_aero_modal_subtitle}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAeroModalOpen(false)}
                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Format Explanation & Table Preview */}
                  <div className="bg-muted/40 border border-border/80 rounded-lg p-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5 uppercase font-mono text-[10px] tracking-wider">
                        <HelpCircle className="w-3.5 h-3.5 text-primary" />
                        {t.mc_aero_req_format}
                      </span>
                      <Button
                        size="sm"
                        onClick={downloadAeroTemplate}
                        variant="outline"
                        className="h-6 text-[10px] gap-1 px-2 border-border text-primary hover:bg-primary/10 font-semibold"
                      >
                        <Download className="w-3 h-3" />
                        {t.mc_download_csv_tpl}
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t.mc_aero_format_desc}
                    </p>

                    {/* Example Table */}
                    <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
                      <table className="w-full text-left font-mono text-[10px]">
                        <thead className="bg-muted/80 text-muted-foreground border-b border-border/60">
                          <tr>
                            <th className="py-1 px-2.5 font-bold">Col 1: Mach (M)</th>
                            <th className="py-1 px-2.5 font-bold">Col 2: {t.mc_col_drag}</th>
                            <th className="py-1 px-2.5 font-normal text-muted-foreground">{t.mc_flight_regime}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          <tr>
                            <td className="py-0.5 px-2.5 font-bold text-foreground">0.00</td>
                            <td className="py-0.5 px-2.5 text-primary font-semibold">0.45</td>
                            <td className="py-0.5 px-2.5 text-muted-foreground">{t.mc_regime_subsonic}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-bold text-foreground">0.80</td>
                            <td className="py-0.5 px-2.5 text-primary font-semibold">0.46</td>
                            <td className="py-0.5 px-2.5 text-muted-foreground">{t.mc_regime_pretransonic}</td>
                          </tr>
                          <tr className="bg-primary/5">
                            <td className="py-0.5 px-2.5 font-bold text-foreground">1.05</td>
                            <td className="py-0.5 px-2.5 text-primary font-bold">0.65</td>
                            <td className="py-0.5 px-2.5 text-primary font-medium">{t.mc_regime_transonic}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-bold text-foreground">2.00</td>
                            <td className="py-0.5 px-2.5 text-primary font-semibold">0.48</td>
                            <td className="py-0.5 px-2.5 text-muted-foreground">{t.mc_regime_supersonic}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-1.5 p-0.5 bg-muted/60 rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setAeroInputTab("upload")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        aeroInputTab === "upload"
                          ? "bg-background text-foreground border border-border/50"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                      {t.mc_upload_file_txt}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAeroInputTab("manual")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        aeroInputTab === "manual"
                          ? "bg-background text-foreground border border-border/50"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-secondary" />
                      {t.mc_paste_excel_manual}
                    </button>
                  </div>

                  {/* Tab 1: Upload */}
                  {aeroInputTab === "upload" ? (
                    <div className="relative border border-dashed border-border hover:border-primary/60 p-6 rounded-lg text-center hover:bg-muted/20 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls, .txt"
                        onChange={handleAeroFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="h-8 w-8 text-primary mx-auto mb-2 opacity-85" />
                      <p className="text-xs text-foreground font-semibold">
                        {aeroParsed && aeroParsed.mach.length > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            {aeroFileName ? `${aeroFileName} (${aeroParsed.mach.length} pts)` : `${aeroParsed.mach.length} ${t.mc_pts_loaded}`}
                          </span>
                        ) : (
                          t.mc_drop_txt_hint
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {t.mc_aero_autodetect_cols}
                      </p>
                    </div>
                  ) : (
                    /* Tab 2: Manual Paste */
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono text-muted-foreground font-bold">
                        {t.mc_paste_rows_label}
                      </label>
                      <textarea
                        className="w-full h-36 p-2.5 text-xs font-mono bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                        placeholder={"0.00\t0.45\n0.20\t0.45\n0.50\t0.44\n0.80\t0.46\n1.00\t0.61\n1.20\t0.66\n2.00\t0.48\n3.00\t0.38"}
                        value={aeroDataRaw}
                        onChange={(e) => {
                          setAeroDataRaw(e.target.value);
                          setUseAeroData(true);
                        }}
                      />
                    </div>
                  )}

                  {/* Summary of Parsed Points */}
                  {aeroParsed && aeroParsed.mach.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{aeroParsed.mach.length} {t.mc_valid_pts}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                        <span>Mach: <strong>{Math.min(...aeroParsed.mach).toFixed(2)} - {Math.max(...aeroParsed.mach).toFixed(2)}</strong></span>
                        <span>Cd max: <strong>{Math.max(...aeroParsed.cd).toFixed(2)}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setUseAeroData(false);
                        setAeroParsed(null);
                        setAeroFileName("");
                        setAeroDataRaw("");
                        setCalcParams(prev => ({ ...prev, useAeroData: false, aeroParsed: null }));
                        setIsAeroModalOpen(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-red-500"
                    >
                      {t.mc_reset_default}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAeroModalOpen(false)}
                        className="text-xs"
                      >
                        {t.close_btn}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setUseAeroData(true);
                          setCalcParams(prev => ({
                            ...prev,
                            useAeroData: true,
                            aeroParsed
                          }));
                          setIsAeroModalOpen(false);
                        }}
                        disabled={!aeroParsed || aeroParsed.mach.length === 0}
                        className="text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {t.mc_save_apply_curve}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Experimental Data Upload */}
        <Card data-tour="mission-exp-card" className="bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-secondary shrink-0" />
              <span>{t.exp_data || "Experimental Data Import"}</span>
            </CardTitle>
            <Button
              size="sm"
              onClick={handleExpUpdate}
              disabled={!hasExpChanges || isUpdating}
              variant={hasExpChanges ? "default" : "secondary"}
              className="h-6 text-[10px] px-2.5 py-0"
            >
              {isUpdating ? "..." : t.update_btn || "Actualizar"}
            </Button>
          </CardHeader>
          <CardContent className="p-3 flex flex-col gap-3">
            <div className="space-y-1">
              <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">
                {t.data_cols || "Data Columns"}
              </UiLabel>
              <Select
                value={expDataType}
                onValueChange={(v: any) => setExpDataType(v)}
              >
                <SelectTrigger className="h-7 text-xs bg-background border-border text-foreground w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="time_thrust">
                    {t.mc_type_time_thrust}
                  </SelectItem>
                  <SelectItem value="time_pressure">
                    {t.mc_type_time_pressure}
                  </SelectItem>
                  <SelectItem value="time_both">
                    {t.mc_type_time_both}
                  </SelectItem>
                  <SelectItem value="time_p_time_f">
                    {t.mc_type_indep}
                  </SelectItem>
                </SelectContent>
              </Select>
              {expDataType === "time_pressure" && (
                <p className="text-[9px] text-emerald-500 italic mt-0.5 leading-tight">
                  {t.est_thrust_msg}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                {expDataType === "time_pressure"
                  ? t.import_desc_pressure
                  : expDataType === "time_both"
                  ? t.mc_desc_time_both
                  : expDataType === "time_p_time_f"
                  ? t.mc_desc_time_indep
                  : t.import_desc_force}
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">
                  {t.pres_unit || "Pressure Unit"}
                </UiLabel>
                <Select value={presUnit} onValueChange={setPresUnit}>
                  <SelectTrigger className="h-7 text-xs bg-background border-border text-foreground">
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
                <UiLabel className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">
                   {t.force_unit || "Force Unit"}
                </UiLabel>
                <Select value={forceUnit} onValueChange={setForceUnit}>
                  <SelectTrigger className="h-7 text-xs bg-background border-border text-foreground">
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
                  {t.mc_exp_file_struct}
                </span>
                <Button
                  onClick={downloadTemplate}
                  size="sm"
                  variant="outline"
                  className="h-6 text-[9px] gap-1 px-1.5 py-0 border-border hover:border-primary/60 bg-background text-primary font-semibold"
                >
                  <Download className="h-3 w-3" />
                  {t.mc_download_tpl}
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground/80 text-[9px]">
                      {expDataType === "time_p_time_f" ? (
                        <>
                          <th className="py-1 px-1.5">Col 1 ({t.mc_col_time_p})</th>
                          <th className="py-1 px-1.5">Col 2 ({t.mc_col_pressure})</th>
                          <th className="py-1 px-1.5">Col 3 ({t.mc_col_time_f})</th>
                          <th className="py-1 px-1.5">Col 4 ({t.mc_col_thrust})</th>
                        </>
                      ) : expDataType === "time_both" ? (
                        <>
                          <th className="py-1 px-1.5">Col 1 ({t.mc_col_time})</th>
                          <th className="py-1 px-1.5">Col 2 ({t.mc_col_pressure})</th>
                          <th className="py-1 px-1.5">Col 3 ({t.mc_col_thrust})</th>
                        </>
                      ) : (
                        <>
                          <th className="py-1 px-2">Col 1 ({t.mc_col_time})</th>
                          <th className="py-1 px-2">Col 2 ({expDataType === "time_thrust" ? t.mc_col_force : t.mc_col_pressure})</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30 text-[9.5px]">
                      {expDataType === "time_p_time_f" ? (
                        <>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.00</td>
                          <td className="py-1 px-1.5 text-secondary">0.10</td>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.00</td>
                          <td className="py-1 px-1.5 text-primary">0.0</td>
                        </>
                      ) : expDataType === "time_both" ? (
                        <>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.00</td>
                          <td className="py-1 px-1.5 text-secondary">0.10</td>
                          <td className="py-1 px-1.5 text-primary">0.0</td>
                        </>
                      ) : (
                        <>
                          <td className="py-1 px-2 font-bold text-foreground">0.00</td>
                          <td className="py-1 px-2 text-primary">{expDataType === "time_thrust" ? "0.0" : "0.10"}</td>
                        </>
                      )}
                    </tr>
                    <tr className="border-b border-border/30 text-[9.5px]">
                      {expDataType === "time_p_time_f" ? (
                        <>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.15</td>
                          <td className="py-1 px-1.5 text-secondary">4.10</td>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.14</td>
                          <td className="py-1 px-1.5 text-primary">510.9</td>
                        </>
                      ) : expDataType === "time_both" ? (
                        <>
                          <td className="py-1 px-1.5 font-bold text-foreground">0.15</td>
                          <td className="py-1 px-1.5 text-secondary">4.10</td>
                          <td className="py-1 px-1.5 text-primary">510.9</td>
                        </>
                      ) : (
                        <>
                          <td className="py-1 px-2 font-bold text-foreground">0.15</td>
                          <td className="py-1 px-2 text-primary">{expDataType === "time_thrust" ? "510.9" : "4.10"}</td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[9px] text-muted-foreground leading-tight font-mono">
                {t.mc_smart_autodetect_hint}
              </p>
            </div>

            <div className="relative border border-dashed border-border hover:border-primary/60 p-4 rounded-md text-center hover:bg-muted/30 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-6 w-6 text-primary mx-auto mb-1.5 opacity-85" />
              <p className="text-[11px] text-foreground font-semibold">
                {expDataRaw.length > 0 ? (
                  <span className="text-emerald-500 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-500" />
                    {expDataRaw.length} {t.mc_rows_loaded}
                  </span>
                ) : (
                  t.mc_drop_csv_hint
                )}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {t.mc_supports_formats}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sim Results */}
        <Card className="bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-primary shrink-0" />
              <span>{t.sim_apogee || "Simulation Apogee"}</span>
            </CardTitle>
            <span className="text-[10px] font-mono tabular-nums text-primary font-semibold flex items-center gap-1">
              <Compass className="w-3 h-3" />
              FPA: {calcParams.flightPathAngle ?? 90}º
            </span>
          </CardHeader>
          <CardContent className="p-3">
            {simApogee ? (
              <div className="grid grid-cols-2 gap-4 font-mono tabular-nums">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight flex items-center justify-between">
                    <span>{t.mc_apogee_agl_card}</span>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold uppercase">AGL</span>
                  </span>
                  <span className="text-xl font-bold text-foreground mt-0.5">
                    {simApogee.maxApogee.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-foreground/80">
                      {t.mc_asl_prefix}
                    </span>
                    <strong className="text-foreground">
                      {(calcParams.launchAltitude + simApogee.maxApogee).toFixed(1)} m
                    </strong>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_max_vel}
                  </span>
                  <span className="text-xl font-mono font-bold text-foreground mt-0.5">
                    {simApogee.maxVelocity.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m/s</span>
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    Mach {(simApogee.maxVelocity / 340).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_time_to_apogee}
                  </span>
                  <span className="text-xl font-mono font-bold text-foreground mt-0.5">
                    {simApogee.apogeeTime.toFixed(2)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_max_accel}
                  </span>
                  <span className="text-xl font-mono font-bold text-foreground mt-0.5">
                    {simApogee.maxAcceleration.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m/s²</span>
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {(simApogee.maxAcceleration / 9.80665).toFixed(1)} G
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
        <Card className="bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold flex items-center gap-2">
              <span className="w-1.5 h-3 rounded-xs bg-secondary shrink-0" />
              <span>{t.exp_apogee || "Experimental Apogee"}</span>
            </CardTitle>
            <span className="text-[10px] font-mono tabular-nums text-secondary font-semibold flex items-center gap-1">
              <Compass className="w-3 h-3" />
              FPA: {calcParams.flightPathAngle ?? 90}º
            </span>
          </CardHeader>
          <CardContent className="p-3">
            {expApogee ? (
              <div className="grid grid-cols-2 gap-4 font-mono tabular-nums">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight flex items-center justify-between">
                    <span>{t.mc_apogee_agl_card}</span>
                    <span className="text-[9px] font-mono text-secondary font-semibold uppercase">AGL</span>
                  </span>
                  <span className="text-xl font-bold text-foreground mt-0.5">
                    {expApogee.maxApogee.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-foreground/80">
                      {t.mc_asl_prefix}
                    </span>
                    <strong className="text-foreground">
                      {(calcParams.launchAltitude + expApogee.maxApogee).toFixed(1)} m
                    </strong>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_max_vel}
                  </span>
                  <span className="text-xl font-bold text-foreground mt-0.5">
                    {expApogee.maxVelocity.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m/s</span>
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    Mach {(expApogee.maxVelocity / 340).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_time_to_apogee}
                  </span>
                  <span className="text-xl font-bold text-foreground mt-0.5">
                    {expApogee.apogeeTime.toFixed(2)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">s</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                    {t.mc_max_accel}
                  </span>
                  <span className="text-xl font-bold text-foreground mt-0.5">
                    {expApogee.maxAcceleration.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">m/s²</span>
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {(expApogee.maxAcceleration / 9.80665).toFixed(1)} G
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
              <div className="absolute inset-0 bg-background/60 backdrop-blur-xs z-50 flex items-center justify-center rounded-lg border border-border">
                <div className="flex flex-col items-center gap-2">
                  <span className="w-7 h-7 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
                  <span className="text-xs text-primary font-mono tracking-widest uppercase font-semibold">
                    {t.mc_processing}
                  </span>
                </div>
              </div>
            )}
            {/* Altitude Chart */}
            <Card data-tour="mission-charts-card" className="bg-card border-border rounded-lg overflow-hidden min-h-[300px] flex flex-col">
              <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold">
                  {t.flight_profile || "Altitude Profile"}
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant={activeMainChart === "altitude" ? "default" : "outline"}
                    onClick={() => setActiveMainChart("altitude")}
                    className={`h-6 text-[10px] px-2 py-0 font-mono ${
                      activeMainChart === "altitude"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {t.altitude || "Altitude"}
                  </Button>
                  <Button
                    size="sm"
                    variant={activeMainChart === "thrust" ? "default" : "outline"}
                    onClick={() => setActiveMainChart("thrust")}
                    className={`h-6 text-[10px] px-2 py-0 font-mono ${
                      activeMainChart === "thrust"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
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
                          strokeDasharray="2 4"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke={simPrimaryColor}
                          fontSize={11}
                          label={{
                            value: "Altitude [m]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -5,
                            fill: simPrimaryColor,
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
                            stroke={simPrimaryColor}
                            strokeWidth={2.2}
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
                            stroke={expSecondaryColor}
                            strokeWidth={2}
                            strokeDasharray="5 3"
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
                          strokeDasharray="2 4"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke={simThrustColor}
                          fontSize={11}
                          label={{
                            value: "Thrust [N]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -5,
                            fill: simThrustColor,
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
                            stroke={simThrustColor}
                            strokeWidth={2.2}
                            dot={false}
                            isAnimationActive={false}
                            name="Sim Thrust"
                          />
                        )}
                        {calcExpParams.expDataRaw.length > 0 &&
                          calcExpParams.expDataType !== "time_pressure" && (
                            <Line
                              connectNulls
                              type="monotone"
                              dataKey="exp_F"
                              stroke={expSecondaryColor}
                              strokeWidth={2}
                              strokeDasharray="5 3"
                              dot={false}
                              isAnimationActive={false}
                              name="Exp Thrust (Raw)"
                            />
                          )}
                        {calcExpParams.expDataRaw.length > 0 &&
                          calcExpParams.expDataType !== "time_thrust" && (
                            <Line
                              connectNulls
                              type="monotone"
                              dataKey="exp_P_F"
                              stroke="#10b981"
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
                  <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
                    {t.no_sim || "Run Simulation first to see predictions."}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Velocity & Accel Chart */}
            <Card className="bg-card border-border rounded-lg overflow-hidden min-h-[300px] flex flex-col">
              <CardHeader className="py-2 px-3 bg-card-header text-card-header-foreground border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-[11px] uppercase tracking-wider text-card-header-foreground font-semibold">
                  {t.flight_dynamics || "Velocity & Acceleration"}
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant={activeDynChart === "velocity" ? "default" : "outline"}
                    onClick={() => setActiveDynChart("velocity")}
                    className={`h-6 text-[10px] px-2 py-0 font-mono ${
                      activeDynChart === "velocity"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {t.velocity}
                  </Button>
                  <Button
                    size="sm"
                    variant={activeDynChart === "acceleration" ? "default" : "outline"}
                    onClick={() => setActiveDynChart("acceleration")}
                    className={`h-6 text-[10px] px-2 py-0 font-mono ${
                      activeDynChart === "acceleration"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
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
                          strokeDasharray="2 4"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, "auto"]}
                          stroke={simPrimaryColor}
                          fontSize={11}
                          label={{
                            value: "Velocity [m/s]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -15,
                            fill: simPrimaryColor,
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
                            stroke={simPrimaryColor}
                            strokeWidth={2.2}
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
                            stroke={expSecondaryColor}
                            strokeWidth={2}
                            strokeDasharray="5 3"
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
                          strokeDasharray="2 4"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          label={{
                            value: "Time [s]",
                            position: "insideBottom",
                            offset: -15,
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={["auto", "auto"]}
                          stroke={simAccelColor}
                          fontSize={11}
                          label={{
                            value: "Accel. [m/s²]",
                            angle: -90,
                            position: "insideLeft",
                            offset: -15,
                            fill: simAccelColor,
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
                            stroke={simAccelColor}
                            strokeWidth={2.2}
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
                            stroke={expSecondaryColor}
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            dot={false}
                            isAnimationActive={false}
                            name="Exp Accel."
                          />
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
                    {t.no_sim || "Run Simulation first to see predictions."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ),
        [chartData, isUpdating, expApogee, simApogee, t, activeDynChart, activeMainChart, simPrimaryColor, expSecondaryColor, simThrustColor, simAccelColor],
      )}
    </div>
  );
}
