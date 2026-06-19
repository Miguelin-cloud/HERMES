import React, { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PROPELLANTS, SimulationInputs, SimulationResults } from './lib/types';
import { runSimulation } from './lib/simulator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label as ChartLabel } from 'recharts';
import { Download, Monitor, Sun, Moon, User } from 'lucide-react';

import { GrainViewer } from './components/GrainViewer';
import { EngineViewer } from './components/EngineViewer';
import { GrainPreview } from './components/GrainPreview';
import { MotorPreview } from './components/MotorPreview';
import { PlaybackWrapper } from './components/PlaybackWrapper';
import { MissionControl } from './components/MissionControl';
import { SplashScreen } from './components/SplashScreen';
import { Language, translations } from './lib/i18n';
import { Logo } from './components/Logo';

function NumberInput({ 
  value, 
  onChange, 
  label, 
  step = "1",
  tooltip,
  decimals,
  inputWidth = "w-[65px]"
}: { 
  value: number, 
  onChange: (v: number) => void, 
  label: string, 
  step?: string,
  tooltip?: string,
  decimals?: number,
  inputWidth?: string
}) {
  const [internal, setInternal] = useState(decimals !== undefined ? value.toFixed(decimals) : value.toString());
  const lastPushedValue = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastPushedValue.current) {
      setInternal(decimals !== undefined ? value.toFixed(decimals) : value.toString());
      lastPushedValue.current = value;
    }
  }, [value, decimals]);

  return (
    <div className="group relative flex items-center justify-between gap-1 w-full border-b border-border pb-1 mb-[2px] hover:bg-muted/50 px-1 rounded transition-all focus-within:bg-purple-500/10 focus-within:shadow-[inset_0_0_8px_rgba(168,85,247,0.08)]" title={tooltip}>
      <div className="absolute bottom-[-1px] left-0 right-0 h-[1.5px] bg-gradient-to-r from-purple-500 via-purple-300 to-blue-500 opacity-0 group-focus-within:opacity-100 transition-all duration-300 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>
      <UiLabel className="text-[10px] text-muted-foreground font-mono tracking-tight whitespace-nowrap group-focus-within:text-foreground transition-colors z-10">{label}</UiLabel>
      <Input
        type="number"
        step={step}
        value={internal}
        className={`${inputWidth} h-6 min-h-0 text-[11px] py-0 px-1.5 text-right bg-background/80 border-transparent text-primary font-mono shadow-inner outline-none ring-0 focus-visible:ring-0 focus-visible:border-transparent focus-within:text-purple-600 dark:focus-within:text-purple-300 transition-all z-10`}
        onChange={(e) => {
          setInternal(e.target.value);
          if (e.target.value !== '' && e.target.value !== '-' && e.target.value !== '.') {
             const parsed = parseFloat(e.target.value);
             if (!isNaN(parsed)) {
               lastPushedValue.current = parsed;
               onChange(parsed);
             }
          }
        }}
        onBlur={() => {
          if (decimals !== undefined && !isNaN(value)) {
            const formatted = value.toFixed(decimals);
            setInternal(formatted);
            lastPushedValue.current = value;
          }
        }}
        onFocus={e => e.target.select()}
      />
    </div>
  );
}

interface GrainShapeIconProps {
  shape: number;
  grainId: string;
}

const GrainShapeIcon: React.FC<GrainShapeIconProps> = ({ shape, grainId }) => {
  const patternId = `stripe-${shape}-${grainId}`;
  return (
    <svg className="w-8 h-8 shrink-0 select-none" viewBox="0 0 32 32">
      <defs>
        <pattern id={patternId} width="4.5" height="4.5" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4.5" stroke="currentColor" strokeWidth="1.2" className="text-purple-500/70 dark:text-purple-400/70" />
        </pattern>
      </defs>
      {/* Outer propellant body */}
      <circle cx="16" cy="16" r="13" fill={`url(#${patternId})`} stroke="currentColor" className="text-slate-550 dark:text-slate-650" strokeWidth="1.5" />
      
      {shape === 1 && (
        // Tubular (Cylindrical)
        <circle cx="16" cy="16" r="4.5" fill="var(--card)" stroke="currentColor" className="text-slate-450 dark:text-slate-550" strokeDasharray="1.5 1.2" strokeWidth="1.2" />
      )}
      
      {shape === 2 && (
        // Star (Estrella)
        <path 
          d="M 16,10 L 17.5,13.5 L 21,14 L 18.2,16.5 L 19,20 L 16,18.2 L 13,20 L 13.8,16.5 L 11,14 L 14.5,13.5 Z" 
          fill="var(--card)" 
          stroke="currentColor" 
          className="text-slate-450 dark:text-slate-550" 
          strokeWidth="1.2" 
        />
      )}
    </svg>
  );
};

function InteractiveGrain3D({ grain }: { grain: any }) {
  const [rotX, setRotX] = useState(60);
  const [rotZ, setRotZ] = useState(45);
  const [isDown, setIsDown] = useState(false);
  const lastPos = React.useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDown(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDown) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setRotZ(z => z + dx * 0.5);
    setRotX(x => Math.max(0, Math.min(180, x - dy * 0.5)));
  };

  const layers = 10;
  return (
    <div 
       className="w-full h-full relative cursor-move overflow-hidden" 
       onPointerDown={handlePointerDown} 
       onPointerMove={handlePointerMove} 
       onPointerUp={(e) => { setIsDown(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
       style={{ perspective: '400px' }}
       title="Drag to rotate 3D view"
    >
       <div className="absolute top-0 right-0 text-[8px] font-bold text-slate-300 pointer-events-none p-1">3D DRAG</div>
        <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transformStyle: 'preserve-3d', transform: `rotateX(${rotX}deg) rotateZ(${rotZ}deg)` }}>
          {Array.from({ length: layers }).map((_, i) => (
             <div key={i} className="absolute inset-2 flex items-center justify-center" style={{ transform: `translateZ(${(i - layers/2) * 4}px)` }}>
                 <div className="w-full h-full max-w-[65px] max-h-[65px]">
                   <GrainPreview grain={grain} disableLabel />
                 </div>
             </div>
          ))}
       </div>
    </div>
  );
}

import { ApogeeResult } from './lib/apogee';
import { FlightViewer } from './components/FlightViewer';

export default function App() {
  const [activeTab, setActiveTab] = useState('inputs');
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showSplash, setShowSplash] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showCfdInfo, setShowCfdInfo] = useState(false);
  const [simApogee, setSimApogee] = useState<ApogeeResult | null>(null);
  const [expApogee, setExpApogee] = useState<ApogeeResult | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };
  
  const [motor, setMotor] = useState({ Dc: 60.5, Lc: 483, Gstar: 2, kv: 0, etac: 0.85, paso_de_tiempo: 0.0005, Pamb: 0.101325 });
  const [nozzle, setNozzle] = useState({ Dt0: 18.8, Ds: 41.1, e: 0, alpha: 12, etanoz: 0.75 });
  const [grains, setGrains] = useState([
    { id: '1', shape: 1 as 1 | 2 | 3, propellantType: 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7, D0: 56, d0: 25, d0mayor: 0, L0: 60, N: 5, Np: 0, osi: 1, ci: 1, ei: 1, rhorat: 0.94 }
  ]);
  const [results, setResults] = useState<SimulationResults | null>(null);

  const addGrain = () => {
    setGrains([...grains, { id: Math.random().toString(), shape: 1, propellantType: 1, D0: 56, d0: 25, d0mayor: 0, L0: 60, N: 1, Np: 0, osi: 1, ci: 1, ei: 1, rhorat: 1 }]);
  };

  const removeGrain = (id: string) => {
    setGrains(grains.filter(g => g.id !== id));
  };

  const simulate = () => {
    try {
      const res = runSimulation({ motor, nozzle, grains: grains as any });
      setResults(res);
      setActiveTab('results');
    } catch (err) {
      console.error(err);
      alert("Error during simulation. Check the console for details.");
    }
  };

  const exportToCsv = (res: SimulationResults) => {
    let csv = "Time (s);Pressure (MPa);Pressure (bar);Pressure (atm);Thrust RN (N);Thrust RN (kg);Thrust TTI (N);Thrust TTI (kg);;Summary Metric;Value;Unit\n";
    
    const summaryRows = [
      ["Motor Class", res.summary.motorClass, ""],
      ["Total Impulse (IT)", (res.summary.It_total_N_s || 0).toFixed(2), "N·s"],
      ["Specific Impulse (ISP)", (res.summary.Isp_total_s || 0).toFixed(2), "s"],
      ["Burn Time", (res.summary.t_quemado || 0).toFixed(3), "s"],
      ["Action Time", (res.summary.t_fin || 0).toFixed(3), "s"],
      ["Max Pressure", (res.summary.Pmax_MPa || 0).toFixed(4), "MPa"],
      ["Avg Pressure", (res.summary.Pmed_MPa || 0).toFixed(4), "MPa"],
      ["Max Thrust", (res.summary.Fmax_N || 0).toFixed(2), "N"],
      ["Avg Thrust", (res.summary.Fmed_N || 0).toFixed(2), "N"]
    ];

    const maxRows = Math.max(res.t.length, summaryRows.length);

    for (let i = 0; i < maxRows; i++) {
      const formatNumber = (num: number) => num.toFixed(4).replace('.', ',');
      
      let row = "";
      if (i < res.t.length) {
        const t = res.t[i] || 0;
        const p_mpa = Math.max(0, res.P0_gage[i] || 0);
        const p_bar = p_mpa * 10;
        const p_atm = p_mpa * 9.86923;
        const f_rn = Math.max(0, res.F_N[i] || 0);
        const f_rn_kg = f_rn / 9.81;
        const f_tti = Math.max(0, res.E_N[i] || 0);
        const f_tti_kg = f_tti / 9.81;
        
        row += `${formatNumber(t)};${formatNumber(p_mpa)};${formatNumber(p_bar)};${formatNumber(p_atm)};${formatNumber(f_rn)};${formatNumber(f_rn_kg)};${formatNumber(f_tti)};${formatNumber(f_tti_kg)};;`;
      } else {
        row += ";;;;;;;;;";
      }

      if (i < summaryRows.length) {
        row += `${summaryRows[i][0]};${summaryRows[i][1]};${summaryRows[i][2]}\n`;
      } else {
        row += ";;\n";
      }
      
      csv += row;
    }
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    setCsvBlob(blob);
    setExportFilename(`HERMES_Results_${motor.Dc}mm.csv`);
    setShowExportModal(true);
  };

  const chartData = results ? results.t.map((time, i) => {
    let pointData: any = {
      time: Number((time || 0).toFixed(4)),
      P0_MPa: Number(Math.max(0, results.P0_MPa[i] || 0).toFixed(3)),
      P0_gage: Number(Math.max(0, results.P0_gage[i] || 0).toFixed(3)),
      F_N: Number(Math.max(0, results.F_N[i] || 0).toFixed(2)),
      E_N: Number(Math.max(0, results.E_N[i] || 0).toFixed(2)),
      mgra_total: Number((results.mgra_total[i] || 0).toFixed(3)),
    };
    
    // Add burn areas for each grain
    results.grains.forEach((g, gIndex) => {
      pointData[`g${gIndex}_Abc`] = Number((results.grains_Abc?.[gIndex]?.[i] || 0).toFixed(1));
      pointData[`g${gIndex}_Abe`] = Number((results.grains_Abe?.[gIndex]?.[i] || 0).toFixed(1));
      pointData[`g${gIndex}_Abs`] = Number((results.grains_Abs?.[gIndex]?.[i] || 0).toFixed(1));
      pointData[`g${gIndex}_Ab`] = Number((results.grains_Ab?.[gIndex]?.[i] || 0).toFixed(1));
    });

    return pointData;
  }) : [];

  const t = translations[lang];

  return (
    <div className="h-screen max-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {showSplash && <SplashScreen lang={lang} onComplete={() => setShowSplash(false)} />}

      <header className="bg-card border-border shadow-md text-slate-800 dark:text-slate-200 py-3 px-4 md:px-6 flex justify-between items-center border-b-4 border-b-purple-500 shrink-0 relative z-10 transition-all">
        <div className="flex items-center gap-4">
          <div className="bg-[#040814] p-1 rounded-2xl border border-slate-800 shadow-[0_0_15px_rgba(56,189,248,0.2)] self-center flex items-center justify-center">
             <Logo size={46} className="text-slate-100" theme="dark" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-widest flex items-center gap-2">
              <span className={theme === 'light' ? 'text-slate-900' : 'text-slate-100'}>
                {t.title.split(' ')[0]}
              </span>
              <span className="text-purple-600 dark:text-purple-400 font-semibold hidden sm:inline drop-shadow-[0_0_4px_rgba(168,85,247,0.25)]">
                {t.title.substring(t.title.indexOf(' ') + 1)}
              </span>
            </h1>
            <p className="text-[10px] md:text-xs text-[#2563eb] dark:text-blue-400/80 font-mono tracking-widest uppercase mt-0.5 font-extrabold">
              {t.subtitle}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <div className="text-[10px] md:text-xs font-mono bg-indigo-900/40 px-2 py-1 rounded text-purple-400 border border-purple-900/50 flex items-center gap-2 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_5px_rgba(168,85,247,0.8)]"></div>
              {t.system_op}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-wider hidden sm:block">
              V 2.0.0 • {new Date().toISOString().split('T')[0]}
            </div>
          </div>

          {showInstallBtn && (
            <Button 
              onClick={handleInstallClick}
              className="bg-emerald-600/80 hover:bg-emerald-500 text-slate-200 border border-emerald-400/50 h-8 text-[10px] font-bold px-3 gap-2 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse hover:animate-none"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === 'es' ? 'INSTALAR APP' : (lang === 'fr' ? 'INSTALLER' : 'INSTALL APP')}
            </Button>
          )}

          {/* Theme Dropdown */}
          <Select value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light')}>
            <SelectTrigger className={`w-24 h-8 text-xs font-semibold px-2 flex items-center justify-between gap-1 backdrop-blur-sm shadow-sm transition-colors cursor-pointer rounded border focus:outline-none focus:ring-0 ${
              theme === 'light' 
                ? 'bg-white border-slate-300 text-slate-700' 
                : 'bg-slate-900/80 border-slate-700/50 text-slate-200'
            }`}>
              <div className="flex items-center gap-1.5">
                {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" /> : <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span className="truncate">{theme === 'dark' ? (lang === 'es' ? 'Oscuro' : 'Dark') : (lang === 'es' ? 'Claro' : 'Light')}</span>
              </div>
            </SelectTrigger>
            <SelectContent className={`border ${
              theme === 'light' 
                ? 'bg-white text-slate-800 border-slate-200' 
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}>
              <SelectItem value="dark" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  {lang === 'es' ? 'Oscuro' : (lang === 'fr' ? 'Sombre' : (lang === 'it' ? 'Scuro' : 'Dark'))}
                </span>
              </SelectItem>
              <SelectItem value="light" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {lang === 'es' ? 'Claro' : (lang === 'fr' ? 'Clair' : (lang === 'it' ? 'Chiaro' : 'Light'))}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Language Dropdown */}
          <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
            <SelectTrigger className={`w-20 h-8 text-xs font-semibold backdrop-blur-sm shadow-sm transition-colors cursor-pointer rounded border ${
              theme === 'light' 
                ? 'bg-white border-slate-300 text-slate-700' 
                : 'bg-slate-900/80 border-slate-700/50 text-slate-200'
            }`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={`border ${
              theme === 'light' 
                ? 'bg-white text-slate-800 border-slate-200' 
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}>
              <SelectItem value="en" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>ENG</SelectItem>
              <SelectItem value="es" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>ESP</SelectItem>
              <SelectItem value="fr" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>FRA</SelectItem>
              <SelectItem value="it" className={`text-xs ${theme === 'light' ? 'focus:bg-slate-100' : 'focus:bg-slate-800'}`}>ITA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex-1 p-2 md:p-4 max-w-[1600px] mx-auto w-full flex flex-col overflow-hidden relative z-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full min-h-0">
          <div className="flex justify-between items-center mb-1 shrink-0 overflow-x-auto">
            <TabsList className={`flex h-8 w-max shrink-0 ${theme === 'light' ? 'bg-[#f1ede3] border-[#dfd8ca]' : 'bg-slate-900/60 border-slate-800/80'} border backdrop-blur-md rounded-lg p-0.5 gap-1.5 shadow-sm`}>
              <TabsTrigger value="inputs" className={`font-bold text-xs ${theme === 'light' ? 'data-[state=active]:bg-[#faf9f6]/95 data-[state=active]:text-indigo-600' : 'data-[state=active]:bg-slate-950 data-[state=active]:text-purple-400'}`}>{t.inputs}</TabsTrigger>
              <TabsTrigger value="results" disabled={!results} className={`font-bold text-xs ${theme === 'light' ? 'data-[state=active]:bg-[#faf9f6]/95 data-[state=active]:text-indigo-600' : 'data-[state=active]:bg-slate-950 data-[state=active]:text-purple-400'}`}>{t.results}</TabsTrigger>
              <TabsTrigger value="analysis" disabled={!results} className={`font-bold text-xs ${theme === 'light' ? 'data-[state=active]:bg-[#faf9f6]/95 data-[state=active]:text-indigo-600' : 'data-[state=active]:bg-slate-950 data-[state=active]:text-purple-400'}`}>{t.analysis || "Análisis"}</TabsTrigger>
              <TabsTrigger value="mission_control" className={`font-bold text-xs ${theme === 'light' ? 'data-[state=active]:bg-[#faf9f6]/95 data-[state=active]:text-indigo-600' : 'data-[state=active]:bg-slate-950 data-[state=active]:text-purple-400'}`}>{t.mission_control || "Mission Control"}</TabsTrigger>
              <TabsTrigger value="cfd" disabled={!results} className={`font-bold text-xs ${theme === 'light' ? 'data-[state=active]:bg-[#faf9f6]/95 data-[state=active]:text-indigo-600' : 'data-[state=active]:bg-slate-950 data-[state=active]:text-purple-400'}`}>{t.cfd || "CFD Animation"}</TabsTrigger>
            </TabsList>
            <Button onClick={simulate} className="bg-destructive hover:bg-destructive/80 text-slate-200 font-bold shadow-[0_0_15px_rgba(249,115,22,0.5)] whitespace-nowrap min-w-[150px] h-9 ml-4 shrink-0 transition-all">
               {t.run}
            </Button>
          </div>

          <TabsContent value="inputs" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto no-scrollbar pt-2">
              
            {/* TOP ROW: Motor & Nozzle Settings + Visualizations */}
            <div className="flex-none grid grid-cols-1 xl:grid-cols-3 gap-3 min-h-[170px] mb-1">
                <Card className="bg-card border-border shadow-sm flex flex-col rounded-md overflow-hidden border-t-2 border-t-purple-500">
                  <CardHeader className="py-2 px-3 bg-purple-500/10 dark:bg-indigo-950/30 border-b border-border flex-none"><CardTitle className="text-[11px] uppercase tracking-widest text-purple-700 dark:text-purple-400 font-bold">{t.motor}</CardTitle></CardHeader>
                  <CardContent className="flex-1 p-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <NumberInput label={t.chamber_d + " [mm]"} value={motor.Dc} onChange={(v:any) => setMotor({...motor, Dc: v})} tooltip={t.dc_desc} />
                    <NumberInput label={t.chamber_l + " [mm]"} value={motor.Lc} onChange={(v:any) => setMotor({...motor, Lc: v})} tooltip={t.lc_desc} />
                    <NumberInput label={t.gstar} step="0.1" value={motor.Gstar} onChange={(v:any) => setMotor({...motor, Gstar: v})} tooltip={t.gstar_desc} />
                    <NumberInput label={t.kv} step="0.1" value={motor.kv} onChange={(v:any) => setMotor({...motor, kv: v})} tooltip={t.kv_desc} />
                    <NumberInput label={t.eff_c} step="0.01" value={motor.etac} onChange={(v:any) => setMotor({...motor, etac: v})} tooltip={t.etac_desc} />
                    <NumberInput label={t.time_step } step="0.001" decimals={3} value={motor.paso_de_tiempo} onChange={(v:any) => setMotor({...motor, paso_de_tiempo: v})} tooltip={t.dt_desc} inputWidth="w-[75px]" />
                    <NumberInput label={t.p_amb } step="0.001" decimals={3} value={motor.Pamb} onChange={(v:any) => setMotor({...motor, Pamb: v})} tooltip={t.pamb_desc} inputWidth="w-[75px]" />
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm flex flex-col rounded-md overflow-hidden border-t-2 border-t-blue-500">
                  <CardHeader className="py-2 px-3 bg-blue-500/10 dark:bg-indigo-950/30 border-b border-border flex-none"><CardTitle className="text-[11px] uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">{t.nozzle}</CardTitle></CardHeader>
                  <CardContent className="flex-1 p-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <NumberInput label={t.throat_d + " [mm]"} value={nozzle.Dt0} onChange={(v:any) => setNozzle({...nozzle, Dt0: v})} tooltip={t.dt0_desc} />
                    <NumberInput label={t.exit_d + " [mm]"} value={nozzle.Ds} onChange={(v:any) => setNozzle({...nozzle, Ds: v})} tooltip={t.ds_desc} />
                    <NumberInput label={t.div_angle + " [º]"} step="1" value={nozzle.alpha} onChange={(v:any) => setNozzle({...nozzle, alpha: v})} tooltip={t.alpha_desc} />
                    <NumberInput label={t.erosion + " [mm]"} step="0.1" value={nozzle.e} onChange={(v:any) => setNozzle({...nozzle, e: v})} tooltip={t.e_desc} />
                    <NumberInput label={t.eff_n} step="0.01" value={nozzle.etanoz} onChange={(v:any) => setNozzle({...nozzle, etanoz: v})} tooltip={t.etanoz_desc} />
                  </CardContent>
                </Card>

                <div className="bg-card border-border shadow-[inset_0_2px_15px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] rounded-md relative overflow-hidden flex flex-col min-h-[160px] justify-center items-center border-t-2 border-t-slate-500/50">
                   <span className="absolute top-1.5 left-2 text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase bg-card dark:bg-slate-900/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border dark:border-slate-700 z-10 shadow-sm">{t.motor_chamber} SCHEMATIC</span>
                   <MotorPreview motor={motor} grains={grains} />
                </div>
            </div>

            {/* BOTTOM AREA: Vertical list of horizontal grain rows */}
            <Card className="flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden bg-card border-border rounded-md">
               <CardHeader className={`py-2 px-3 ${theme === 'light' ? 'bg-purple-50/80 text-purple-800' : 'bg-muted/30 text-purple-400'} border-b border-border flex flex-row justify-between items-center shrink-0`}>
                  <CardTitle className={`text-[12px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-purple-800' : 'text-purple-400'}`}>{t.grains}</CardTitle>
                  <Button onClick={addGrain} size="sm" className="h-7 text-[10px] px-4 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-700 dark:text-purple-300 rounded font-bold shadow-[0_0_10px_rgba(168,85,247,0.15)] dark:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all">
                    {t.new_grain}
                  </Button>
               </CardHeader>
               
               <CardContent className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 no-scrollbar">
                  {grains.map((g, index) => (
                    <div key={g.id} className={`w-full flex shrink-0 border border-border/80 dark:border-slate-700/50 ${theme === 'light' ? 'bg-white hover:border-purple-200' : 'bg-muted/10 hover:border-slate-600/80'} rounded-md shadow-sm min-h-[140px] overflow-hidden backdrop-blur-xs relative group/grain transition-colors`}>
                        {/* 1. Index & Remove */}
                        <div className={`w-8 shrink-0 ${theme === 'light' ? 'bg-purple-50/50 text-purple-700' : 'bg-slate-900/60 text-purple-400'} flex flex-col items-center justify-center border-r border-border relative`}>
                           <span className="text-xs font-bold transform -rotate-90 whitespace-nowrap uppercase tracking-widest drop-shadow-[0_0_4px_rgba(168,85,247,0.2)]">{t.grains} {index + 1}</span>
                           <Button variant="ghost" size="icon" onClick={() => removeGrain(g.id)} disabled={grains.length === 1} className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 p-0 text-[12px] absolute top-1 opacity-50 group-hover/grain:opacity-100 transition-opacity">
                             ✕
                           </Button>
                        </div>

                        {/* 2. Inputs (Propellant/Shape & Main dimensions) */}
                        <div className="flex-1 p-2.5 grid grid-cols-2 gap-x-6 gap-y-1 min-w-[300px]">
                            <div className="space-y-1.5">
                                <div>
                                  <UiLabel className="text-[10px] mb-1 block px-0.5 uppercase tracking-wider text-slate-550 dark:text-slate-400 font-bold">{t.propellant}</UiLabel>
                                  <Select value={String(g.propellantType)} onValueChange={v => setGrains(grains.map(x => x.id === g.id ? {...x, propellantType: +v as any} : x))}>
                                    <SelectTrigger className="bg-background border-input h-8 text-[11px] px-2 py-0 min-h-0 text-foreground cursor-pointer flex items-center justify-between"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-card text-foreground border-border">
                                      {PROPELLANTS.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-[11px] font-medium focus:bg-muted cursor-pointer">{p.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <NumberInput label={t.outer_d0 + " [mm]"} value={g.D0} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, D0: v} : x))} tooltip={t.outer_d0_desc} />
                                <NumberInput label={t.length_l0 + " [mm]"} value={g.L0} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, L0: v} : x))} tooltip={t.length_l0_desc} />
                                <NumberInput label={t.n_blocks} value={g.N} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, N: v} : x))} tooltip={t.n_blocks_desc} />
                                <NumberInput label={t.rho_rat} step="0.01" value={g.rhorat} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, rhorat: v} : x))} tooltip={t.rho_rat_desc} />
                            </div>

                            <div className="space-y-1.5">
                                <div>
                                  <UiLabel className="text-[10px] mb-1 block px-0.5 uppercase tracking-wider text-slate-550 dark:text-slate-400 font-bold">{t.shape}</UiLabel>
                                  <Select value={String(g.shape)} onValueChange={v => setGrains(grains.map(x => x.id === g.id ? {...x, shape: +v as any} : x))}>
                                    <SelectTrigger className="bg-background border-input h-8 text-[11px] px-2 py-0 min-h-0 text-foreground flex items-center gap-2 cursor-pointer w-full justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <GrainShapeIcon shape={g.shape} grainId={g.id} />
                                        <span className="font-semibold">{g.shape === 1 ? (lang === 'es' ? 'Cilíndrico' : 'Cylindrical') : g.shape === 2 ? (lang === 'es' ? 'Estrella' : 'Star') : (lang === 'es' ? 'Macizo' : 'Solid')}</span>
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-card text-foreground border-border min-w-[200px]">
                                      <SelectItem value="1" className="text-[11px] focus:bg-muted py-1.5 cursor-pointer">
                                        <div className="flex items-center gap-2">
                                          <GrainShapeIcon shape={1} grainId={`${g.id}-opt1`} />
                                          <div className="text-left">
                                            <p className="font-bold text-xs">{lang === 'es' ? 'Cilíndrico' : 'Cylindrical'}</p>
                                            <p className="text-[9px] text-muted-foreground leading-none">{lang === 'es' ? 'Perforación tubular central' : 'Central tubular core'}</p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="2" className="text-[11px] focus:bg-muted py-1.5 cursor-pointer">
                                        <div className="flex items-center gap-2">
                                          <GrainShapeIcon shape={2} grainId={`${g.id}-opt2`} />
                                          <div className="text-left">
                                            <p className="font-bold text-xs">{lang === 'es' ? 'Estrella' : 'Star'}</p>
                                            <p className="text-[9px] text-muted-foreground leading-none">{lang === 'es' ? 'Perforación estelar progresiva' : 'Star core configuration'}</p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="3" className="text-[11px] focus:bg-muted py-1.5 cursor-pointer">
                                        <div className="flex items-center gap-2">
                                          <GrainShapeIcon shape={3} grainId={`${g.id}-opt3`} />
                                          <div className="text-left">
                                            <p className="font-bold text-xs">{lang === 'es' ? 'Macizo' : 'Solid'}</p>
                                            <p className="text-[9px] text-muted-foreground leading-none">{lang === 'es' ? 'Sin núcleo, quemado exterior' : 'No core, external burn only'}</p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {g.shape !== 3 && <NumberInput label={t.inner_d0 + " [mm]"} value={g.d0} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, d0: v} : x))} tooltip={t.inner_d0_desc} />}
                                {g.shape === 2 && (
                                  <>
                                    <NumberInput label={t.valley_d0 + " [mm]"} value={g.d0mayor} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, d0mayor: v} : x))} tooltip={t.valley_d0_desc} />
                                    <NumberInput label={t.star_points} value={g.Np} onChange={(v:any) => setGrains(grains.map(x => x.id === g.id ? {...x, Np: v} : x))} tooltip={t.star_points_desc} />
                                    {(() => {
                                      const minD0mayor = g.d0 / Math.cos(Math.PI / Math.max(3, g.Np));
                                      const isInvalid = g.d0mayor <= minD0mayor || g.d0mayor >= g.D0 || g.Np < 3;
                                      if (isInvalid) {
                                        return (
                                          <div className="col-span-2 bg-destructive/10 border border-destructive/30 p-1.5 rounded-sm flex flex-col gap-0.5 mt-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-bold text-destructive uppercase tracking-widest leading-none drop-shadow-md">Star Configuration Alert</span>
                                            {g.Np < 3 && <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">• Need &gt;= 3 points</span>}
                                            {g.d0mayor <= minD0mayor && <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">• Valley (Dp) &gt; {(minD0mayor).toFixed(1)}mm</span>}
                                            {g.d0mayor >= g.D0 && <span className="text-[9px] text-destructive/80 font-mono line-clamp-1 italic">• Valley (Dp) &lt; Outer D0</span>}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </>
                                )}
                                
                                <div className="border-t border-border pt-2 mt-2 flex justify-between items-center px-1">
                                  <UiLabel className="text-[10px] text-[#2563eb] dark:text-blue-400/80 uppercase font-bold tracking-wider">{t.burn_faces}</UiLabel>
                                  <div className="flex gap-4">
                                  <div className="flex items-center space-x-1.5" title={t.external}><Checkbox className="w-4 h-4 rounded-sm border-slate-400 dark:border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.osi===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, osi: c ? 1 : 0} : x))} id={`osi-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-700 dark:text-slate-350 font-bold cursor-pointer" htmlFor={`osi-${g.id}`}>EXT</UiLabel></div>
                                  <div className="flex items-center space-x-1.5" title={t.ends}><Checkbox className="w-4 h-4 rounded-sm border-slate-400 dark:border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.ei===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, osi: g.osi, ei: c ? 1 : 0} : x))} id={`ei-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-700 dark:text-slate-350 font-bold cursor-pointer" htmlFor={`ei-${g.id}`}>ENDS</UiLabel></div>
                                  {g.shape !== 3 && <div className="flex items-center space-x-1.5" title={t.internal}><Checkbox className="w-4 h-4 rounded-sm border-slate-400 dark:border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.ci===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, ci: c ? 1 : 0} : x))} id={`ci-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-700 dark:text-slate-350 font-bold cursor-pointer" htmlFor={`ci-${g.id}`}>INT</UiLabel></div>}
                                  </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Previews (Transversal & Longitudinal) */}
                        <div className={`w-[350px] shrink-0 ${theme === 'light' ? 'bg-purple-50/15' : 'bg-slate-900/50'} border-l border-border flex flex-row overflow-hidden relative`}>
                            {/* Inner glow effect */}
                            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-0 pointer-events-none"></div>
                            
                            <div className="w-1/2 h-full border-r border-slate-700/30 relative z-10">
                               <GrainPreview grain={g} t={t} mode="transversal" />
                            </div>
                            <div className="w-1/2 h-full relative z-10">
                               <GrainPreview grain={g} t={t} mode="longitudinal" />
                            </div>
                        </div>
                    </div>
                  ))}
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="flex-1 overflow-y-auto w-full p-2">
            {results && (() => {
              const f_nakka_max = Math.max(...results.F_N);
              const activeNakkaSteps = results.F_N.filter((_, i) => results.mgra_total[i] > 0);
              const f_nakka_avg = activeNakkaSteps.length > 0 
                ? activeNakkaSteps.reduce((sum, v) => sum + v, 0) / activeNakkaSteps.length 
                : 0;
              const textValClass = theme === 'light' ? 'text-slate-900' : 'text-slate-100';

              return (
                <div className="flex flex-col gap-6 pb-20">
                  <div className="flex justify-end">
                    <Button onClick={() => exportToCsv(results)} variant="outline" size="sm" className="bg-card h-9 shadow-sm border-border text-primary">{t.export_csv}</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3">
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-purple-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">{t.shape} (Motor)</p>
                        <h3 className={`text-lg font-bold tracking-widest mt-1.5 leading-none ${textValClass}`}>{results.summary.motorClass}</h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-blue-500">
                      <CardContent className="p-3 font-semibold">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">{t.total_impulse} (IT)</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none ${textValClass}`}>{(results.summary.It_total_N_s || 0).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">N·s</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-blue-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">{t.specific_impulse} (ISP)</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none ${textValClass}`}>{(results.summary.Isp_total_s || 0).toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">s</span></h3>
                      </CardContent>
                    </Card>
                    
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-slate-500/50"><CardContent className="p-2 gap-1 flex flex-col justify-center">
                      <p className="text-[10px] font-mono text-muted-foreground text-center mb-1 uppercase tracking-widest leading-none">{t.times}</p>
                      <div className="flex justify-between text-[11px] font-mono items-center"><span className="text-muted-foreground">{t.burn}</span><span className={`font-bold px-1 ${textValClass}`}>{(results.summary.t_quemado || 0).toFixed(3)}s</span></div>
                      <div className="flex justify-between text-[11px] font-mono items-center"><span className="text-muted-foreground">{t.action}</span><span className={`font-bold px-1 ${textValClass}`}>{(results.summary.t_fin || 0).toFixed(3)}s</span></div>
                    </CardContent></Card>
                    
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-orange-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-orange-600 dark:text-orange-400 font-bold uppercase leading-tight">{t.max_p || "Max Pressure"}</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none text-orange-600 dark:text-orange-400 ${theme === 'dark' ? 'drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : ''}`}>{(results.summary.Pmax_MPa || 0).toFixed(4)} <span className="text-[10px] font-normal text-muted-foreground">MPa</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-orange-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-orange-600 dark:text-orange-400 font-bold uppercase leading-tight">{t.avg_p || "Avg Pressure"}</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none text-orange-600 dark:text-orange-400`}>{(results.summary.Pmed_MPa || 0).toFixed(4)} <span className="text-[10px] font-normal text-muted-foreground">MPa</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-sky-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-sky-600 dark:text-sky-450 font-bold uppercase leading-tight">{t.max_f} (Nakka)</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none text-sky-600 dark:text-sky-400 ${theme === 'dark' ? 'drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]' : ''}`}>{f_nakka_max.toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">N</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-sky-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-sky-600 dark:text-sky-450 font-bold uppercase leading-tight">{t.avg_f} (Nakka)</p>
                        <h3 className="text-lg font-bold mt-1.5 leading-none text-sky-600 dark:text-sky-400">{f_nakka_avg.toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">N</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-purple-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold uppercase leading-tight">{t.max_f} (TTI)</p>
                        <h3 className={`text-lg font-bold mt-1.5 leading-none text-purple-600 dark:text-purple-400 ${theme === 'dark' ? 'drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : ''}`}>{(results.summary.Fmax_N || 0).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">N</span></h3>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-purple-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold uppercase leading-tight">{t.avg_f} (TTI)</p>
                        <h3 className="text-lg font-bold mt-1.5 leading-none text-purple-600 dark:text-purple-400">{(results.summary.Fmed_N || 0).toFixed(0)} <span className="text-[10px] font-normal text-muted-foreground">N</span></h3>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
                    <Card className="flex flex-col bg-card border-border shadow-sm">
                      <CardHeader className="py-2 border-b border-border bg-muted/20"><CardTitle className="text-[13px] uppercase tracking-widest text-orange-600 dark:text-orange-400">{t.pressure_vs_time}</CardTitle></CardHeader>
                      <CardContent className="p-0 pt-4 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                            <XAxis 
                              dataKey="time" 
                              type="number" 
                              domain={[0, 'dataMax']} 
                              tickCount={10} 
                              tickFormatter={(value) => value.toFixed(2)}
                              tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#475569', fontFamily: 'monospace' }}
                              height={60}
                              axisLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                              tickLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                            >
                              <ChartLabel value={t.axis_time} position="bottom" offset={0} fill={theme === 'dark' ? '#cbd5e1' : '#475569'} style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                            </XAxis>
                            <YAxis 
                              domain={[0, (dataMax: number) => (dataMax * 1.1)]} 
                              tickFormatter={(value) => value.toFixed(1)} 
                              tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#475569', fontFamily: 'monospace' }}
                              width={70}
                              axisLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                              tickLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                            >
                              <ChartLabel value={t.axis_pressure} angle={-90} position="left" offset={0} fill={theme === 'dark' ? '#cbd5e1' : '#475569'} style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip 
                              formatter={(value: number) => value.toFixed(2) + " MPa"} 
                              labelFormatter={(lbl) => "T+ " + Number(lbl).toFixed(3) + "s"}
                              contentStyle={theme === 'dark' ? { backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' } : { backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right"
                              wrapperStyle={theme === 'dark' ? { 
                                display: 'inline-block',
                                width: 'auto',
                                right: '0px',
                                backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                                border: '1px solid rgba(51, 65, 85, 0.8)', 
                                borderRadius: '4px', 
                                padding: '4px 8px', 
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#cbd5e1'
                              } : {
                                display: 'inline-block',
                                width: 'auto',
                                right: '0px',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                border: '1px solid rgba(203, 213, 225, 0.8)', 
                                borderRadius: '4px', 
                                padding: '4px 8px', 
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#0f172a'
                              }} 
                            />
                            <Line type="monotone" dataKey="P0_gage" stroke="#f97316" dot={false} strokeWidth={2.5} name="Chamber Gauge Pressure (MPa)" style={{ filter: 'drop-shadow(0px 0px 5px rgba(249,115,22,0.5))' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col bg-card border-border shadow-sm">
                      <CardHeader className="py-2 border-b border-border bg-muted/20"><CardTitle className="text-[13px] uppercase tracking-widest text-[#00ccff]">{t.thrust_vs_time}</CardTitle></CardHeader>
                      <CardContent className="p-0 pt-4 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                            <XAxis 
                              dataKey="time" 
                              type="number" 
                              domain={[0, 'dataMax']} 
                              tickCount={10} 
                              tickFormatter={(value) => value.toFixed(2)}
                              tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#475569', fontFamily: 'monospace' }}
                              height={60}
                              axisLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                              tickLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                            >
                              <ChartLabel value={t.axis_time} position="bottom" offset={0} fill={theme === 'dark' ? '#cbd5e1' : '#475569'} style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                            </XAxis>
                            <YAxis 
                              domain={[0, (dataMax: number) => (dataMax * 1.1)]} 
                              tickFormatter={(value) => value.toFixed(0)} 
                              tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#475569', fontFamily: 'monospace' }}
                              width={70}
                              axisLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                              tickLine={{ stroke: theme === 'dark' ? '#475569' : '#cbd5e1' }}
                            >
                              <ChartLabel value={t.axis_thrust} angle={-90} position="left" offset={0} fill={theme === 'dark' ? '#cbd5e1' : '#475569'} style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip 
                              formatter={(value: number) => value.toFixed(1) + " N"} 
                              labelFormatter={(lbl) => "T+ " + Number(lbl).toFixed(3) + "s"}
                              contentStyle={theme === 'dark' ? { backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' } : { backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right"
                              layout="vertical"
                              wrapperStyle={theme === 'dark' ? { 
                                display: 'inline-block',
                                width: 'auto',
                                right: '0px',
                                backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                                border: '1px solid rgba(51, 65, 85, 0.8)', 
                                borderRadius: '4px', 
                                padding: '4px 8px', 
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#cbd5e1'
                              } : {
                                display: 'inline-block',
                                width: 'auto',
                                right: '0px',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                border: '1px solid rgba(203, 213, 225, 0.8)', 
                                borderRadius: '4px', 
                                padding: '4px 8px', 
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#0f172a'
                              }} 
                            />
                            <Line type="monotone" dataKey="F_N" stroke="#00ccff" dot={false} strokeWidth={2.5} name={t.r_nakka + " (N)"} style={{ filter: 'drop-shadow(0px 0px 5px rgba(0,204,255,0.5))' }} />
                            <Line type="monotone" dataKey="E_N" stroke="#a855f7" dot={false} strokeWidth={2.5} name={t.ideal_tti + " (N)"} style={{ filter: 'drop-shadow(0px 0px 5px rgba(168,85,247,0.4))' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

           <TabsContent value="analysis" className="flex-1 overflow-y-auto w-full no-scrollbar p-1">
             {results && (
                <div className="flex flex-col h-full gap-4 pb-10">
                   <div className="flex flex-wrap gap-4 shrink-0 mt-2">
                    {results.grains.map((g, idx) => (
                      <Card key={g.id} className="flex flex-col bg-card border-border shadow-sm flex-1 min-w-[320px]">
                        <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border">
                          <CardTitle className="text-[13px] uppercase tracking-widest text-purple-400">{t.grains} {idx + 1} - Area</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 pt-4 h-[420px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 70, bottom: 80 }}>
                              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#334155" />
                              <XAxis 
                                dataKey="time" 
                                type="number" 
                                domain={[0, 'dataMax']} 
                                tickCount={8} 
                                tickFormatter={(value) => value.toFixed(2)}
                                tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                                height={60}
                                axisLine={{ stroke: '#475569' }}
                                tickLine={{ stroke: '#475569' }}
                              >
                                <ChartLabel value={t.axis_time} position="bottom" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                              </XAxis>
                              <YAxis 
                                domain={[0, 'auto']} 
                                tickFormatter={(value) => (value/1000).toFixed(1)} 
                                width={70}
                                tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                                axisLine={{ stroke: '#475569' }}
                                tickLine={{ stroke: '#475569' }}
                              >
                                <ChartLabel value={t.axis_area} angle={-90} position="left" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                              </YAxis>
                              <Tooltip 
                                formatter={(value: number) => (value/100).toFixed(2) + " cm²"} 
                                labelFormatter={(label) => `T+ ${Number(label).toFixed(3)}s`} 
                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' }}
                              />
                              <Legend 
                                verticalAlign="top" 
                                align="right"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '5px', color: '#cbd5e1' }} 
                              />
                              {g.ci === 1 && g.shape !== 3 && <Line type="monotone" dataKey={`g${idx}_Abc`} stroke="#ef4444" dot={false} strokeWidth={2} name={t.internal} />}
                              {g.ei === 1 && <Line type="monotone" dataKey={`g${idx}_Abe`} stroke="#3b82f6" dot={false} strokeWidth={2} name={t.ends} />}
                              {g.osi === 1 && <Line type="monotone" dataKey={`g${idx}_Abs`} stroke="#eab308" dot={false} strokeWidth={2} name={t.external} />}
                              <Line type="monotone" dataKey={`g${idx}_Ab`} stroke="#10b981" dot={false} strokeWidth={2} strokeDasharray="4 4" name={t.total_area} style={{ filter: 'drop-shadow(0px 0px 3px rgba(16,185,129,0.5))' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    ))}
                   </div>
                </div>
             )}
           </TabsContent>

           <TabsContent value="cfd" className="flex-1 overflow-hidden w-full relative min-h-0 flex flex-col gap-2">
             {results && (
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col xl:flex-row gap-4 pb-10">
                 <div className="flex-1 flex flex-col gap-4">
                     <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg border border-border">
                        <span className="text-xs uppercase font-bold text-slate-300 font-mono tracking-widest">{t.exhaust_sim}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setShowCfdInfo(!showCfdInfo)}>{t.more_info}</Button>
                     </div>
                     {showCfdInfo && (
                       <div className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] leading-relaxed border border-border shadow-inner">
                         <p className="font-bold text-blue-400 mb-1">{t.cfd_solver_title}</p>
                         {t.cfd_solver_desc}
                       </div>
                     )}
                     <div className="flex flex-col flex-1 min-h-[350px] bg-card rounded-lg shadow-sm border overflow-hidden shrink-0 w-full">
                        <PlaybackWrapper results={results} t_parent={t} />
                     </div>
                 </div>
                 <div className="flex-1 flex flex-col min-h-[400px]">
                     <FlightViewer simApogee={simApogee} expApogee={expApogee} t={t} propellantType={results?.propellantType || 1} />
                 </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="mission_control" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto pt-2">
             <MissionControl 
               results={results} 
               lang={lang} 
               onApogeeUpdate={(sim, exp) => { setSimApogee(sim); setExpApogee(exp); }} 
               nozzleParams={nozzle}
             />
          </TabsContent>
        </Tabs>
      </main>

      {/* PROFESSIONAL FOOTER */}
      <footer className={`py-2.5 border-t mt-auto shrink-0 relative z-10 transition-all ${
        theme === 'light' 
          ? 'bg-[#f4f1ea] border-[#e4dfd5] text-stone-850' 
          : 'bg-slate-900 border-slate-800 text-slate-400'
      }`}>
        <div className="max-w-[1600px] mx-auto w-full px-6 flex justify-between items-center text-xs font-mono relative">
           <div className="flex items-center gap-2">
              <span className={`font-semibold tracking-wider ${theme === 'light' ? 'text-stone-900' : 'text-slate-200'}`}>
                {t.dept_prop}
              </span>
           </div>
           
           <div className="relative">
              <button 
                onClick={() => setShowCredits(!showCredits)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all font-semibold uppercase cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white hover:bg-stone-50 border-[#e4dfd5] text-stone-700 hover:text-stone-950 shadow-xs'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-slate-100'
                }`}
              >
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] tracking-wide">{lang === 'es' ? 'Créditos' : 'Credits'}</span>
              </button>
              
              {showCredits && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowCredits(false)} />
                  <div className={`absolute right-0 bottom-full mb-2 w-[280px] border rounded-lg p-3.5 shadow-lg z-50 text-left font-sans backdrop-blur-md ${
                    theme === 'light'
                      ? 'bg-white border-[#e4dfd5] shadow-stone-200 text-stone-800 shadow-xl'
                      : 'bg-slate-950/95 border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.25)] text-slate-100'
                  }`}>
                    <div className="space-y-2.5">
                      <div>
                        <p className={`text-[9px] font-bold tracking-wider uppercase font-mono ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{lang === 'es' ? 'DESARROLLADOR' : 'DEVELOPER'}</p>
                        <p className={`text-xs font-extrabold mt-0.5 ${theme === 'light' ? 'text-stone-950' : 'text-slate-100'}`}>Miguel Tejera Lesmes</p>
                      </div>
                      <div className={`border-t pt-2 ${theme === 'light' ? 'border-stone-100' : 'border-slate-800/85'}`}>
                        <p className={`text-[9px] font-bold tracking-wider uppercase font-mono ${theme === 'light' ? 'text-stone-500' : 'text-slate-400'}`}>{lang === 'es' ? 'COLABORADORES' : 'COLLABORATORS'}</p>
                        <p className={`text-xs font-bold mt-0.5 ${theme === 'light' ? 'text-stone-800' : 'text-slate-200'}`}>Jesús Sáez Barragán</p>
                        <p className={`text-xs font-bold ${theme === 'light' ? 'text-stone-800' : 'text-slate-200'}`}>Pablo Sánchez Mora</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
           </div>
        </div>
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-lg p-6 shadow-xl border border-border">
              <h2 className="text-lg font-bold mb-4">{lang === 'es' ? 'Exportar Resultados' : 'Export Results'}</h2>
              <UiLabel>{lang === 'es' ? 'Nombre del archivo' : 'Filename'}</UiLabel>
              <Input 
                value={exportFilename} 
                onChange={(e) => setExportFilename(e.target.value)} 
                className="mb-4"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExportModal(false)}>{lang === 'es' ? 'Cancelar' : 'Cancel'}</Button>
                <Button onClick={() => {
                  if (csvBlob) {
                    const url = URL.createObjectURL(csvBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = exportFilename;
                    a.click();
                    setShowExportModal(false);
                    URL.revokeObjectURL(url);
                  }
                }}>{lang === 'es' ? 'Descargar' : 'Download'}</Button>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
