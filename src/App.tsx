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
import { Download, Monitor } from 'lucide-react';

import { GrainViewer } from './components/GrainViewer';
import { EngineViewer } from './components/EngineViewer';
import { GrainPreview } from './components/GrainPreview';
import { MotorPreview } from './components/MotorPreview';
import { PlaybackWrapper } from './components/PlaybackWrapper';
import { SplashScreen } from './components/SplashScreen';
import { Language, translations } from './lib/i18n';

function NumberInput({ 
  value, 
  onChange, 
  label, 
  step = "1",
  tooltip,
  decimals
}: { 
  value: number, 
  onChange: (v: number) => void, 
  label: string, 
  step?: string,
  tooltip?: string,
  decimals?: number
}) {
  const [internal, setInternal] = useState(decimals !== undefined ? value.toFixed(decimals) : value.toString());

  React.useEffect(() => {
    const formatted = decimals !== undefined ? value.toFixed(decimals) : value.toString();
    if (!isNaN(value) && (parseFloat(internal) !== value || internal === "")) {
      setInternal(formatted);
    }
  }, [value, decimals]);

  return (
    <div className="flex items-center justify-between gap-1 w-full border-b border-border pb-1 mb-[2px] hover:bg-muted/50 px-1 rounded transition-colors" title={tooltip}>
      <UiLabel className="text-[10px] text-muted-foreground font-mono tracking-tight whitespace-nowrap">{label}</UiLabel>
      <Input
        type="number"
        step={step}
        value={internal}
        className="w-[65px] h-6 min-h-0 text-[11px] py-0 px-1.5 text-right bg-background border-border text-primary font-mono ring-offset-background focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-0"
        onChange={(e) => {
          setInternal(e.target.value);
          if (e.target.value !== '') {
             const parsed = parseFloat(e.target.value);
             if (!isNaN(parsed)) {
               onChange(parsed);
             }
          }
        }}
        onFocus={e => e.target.select()}
      />
    </div>
  );
}

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

export default function App() {
  const [activeTab, setActiveTab] = useState('inputs');
  const [lang, setLang] = useState<Language>('en');
  const [showSplash, setShowSplash] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
  const [showCfdInfo, setShowCfdInfo] = useState(false);

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
  const [nozzle, setNozzle] = useState({ Dt0: 18.8, Ds: 41.1, e: 0, alpha: 12, ro: 2, etanoz: 0.75 });
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
      ["Max Pressure", (res.summary.Pmax_MPa || 0).toFixed(2), "MPa"],
      ["Avg Pressure", (res.summary.Pmed_MPa || 0).toFixed(2), "MPa"],
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HERMES_Results_${motor.Dc}mm.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Quick alert instructing user on charts
    setTimeout(() => {
      alert("Note: Data and Summary Table have been exported to CSV. Graphs must be manually generated in Excel by inserting plots from these columns.");
    }, 500);
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

      <header className="bg-card border-border shadow-sm text-slate-200 py-2 px-4 md:px-6 flex justify-between items-center border-b-4 border-primary shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 border border-primary p-2 rounded-lg shadow-sm">
             <Rocket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-slate-200 flex items-center gap-2 ">
              {t.title.split(' ')[0]} <span className="text-primary font-light hidden sm:inline">{t.title.substring(t.title.indexOf(' ')+1)}</span>
            </h1>
            <p className="text-[10px] md:text-xs text-primary/70 font-mono tracking-widest uppercase mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <div className="text-[10px] md:text-xs font-mono bg-slate-900/80 px-2 py-1 rounded text-cyan-400 border border-cyan-900/50 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_#22d3ee]"></div>
              {t.system_op}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-wider hidden sm:block">
              V 1.0.0 • {new Date().toISOString().split('T')[0]}
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

          <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
            <SelectTrigger className="w-20 bg-slate-900/80 border-slate-700/50 text-slate-200 h-8 text-xs font-medium backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
              <SelectItem value="en">ENG</SelectItem>
              <SelectItem value="es">ESP</SelectItem>
              <SelectItem value="fr">FRA</SelectItem>
              <SelectItem value="it">ITA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex-1 p-2 md:p-4 max-w-[1600px] mx-auto w-full flex flex-col overflow-hidden relative z-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full min-h-0">
          <div className="flex justify-between items-center mb-1 shrink-0 overflow-x-auto">
            <TabsList className="flex h-8 w-max shrink-0 bg-slate-900/50 border border-slate-700/50 backdrop-blur-md">
              <TabsTrigger value="inputs" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{t.inputs}</TabsTrigger>
              <TabsTrigger value="results" disabled={!results} className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{t.results}</TabsTrigger>
              <TabsTrigger value="analysis" disabled={!results} className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{t.analysis || "Análisis"}</TabsTrigger>
              <TabsTrigger value="cfd" disabled={!results} className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">{t.cfd || "CFD Animation"}</TabsTrigger>
            </TabsList>
            <Button onClick={simulate} className="bg-destructive hover:bg-destructive/80 text-slate-200 font-bold shadow-[0_0_15px_rgba(249,115,22,0.5)] whitespace-nowrap min-w-[150px] h-9 ml-4 shrink-0 transition-all">
               {t.run}
            </Button>
          </div>

          <TabsContent value="inputs" className="flex-1 flex flex-col min-h-0 gap-2 px-1 overflow-y-auto no-scrollbar pt-2">
              
            {/* TOP ROW: Motor & Nozzle Settings + Visualizations */}
            <div className="flex-none grid grid-cols-1 xl:grid-cols-3 gap-3 min-h-[170px] mb-1">
                <Card className="bg-card border-border shadow-sm shadow-sm flex flex-col rounded-md overflow-hidden border-t-2 border-t-primary">
                  <CardHeader className="py-2 px-3 bg-muted/50 border-b border-slate-700/50 flex-none"><CardTitle className="text-[11px] uppercase tracking-widest text-primary">{t.motor}</CardTitle></CardHeader>
                  <CardContent className="flex-1 p-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <NumberInput label={t.chamber_d + " [mm]"} value={motor.Dc} onChange={(v:any) => setMotor({...motor, Dc: v})} tooltip={t.dc_desc} />
                    <NumberInput label={t.chamber_l + " [mm]"} value={motor.Lc} onChange={(v:any) => setMotor({...motor, Lc: v})} tooltip={t.lc_desc} />
                    <NumberInput label={t.gstar} step="0.1" value={motor.Gstar} onChange={(v:any) => setMotor({...motor, Gstar: v})} tooltip={t.gstar_desc} />
                    <NumberInput label={t.kv} step="0.1" value={motor.kv} onChange={(v:any) => setMotor({...motor, kv: v})} tooltip={t.kv_desc} />
                    <NumberInput label={t.eff_c} step="0.01" value={motor.etac} onChange={(v:any) => setMotor({...motor, etac: v})} tooltip={t.etac_desc} />
                    <NumberInput label={t.time_step } step="0.00001" decimals={5} value={motor.paso_de_tiempo} onChange={(v:any) => setMotor({...motor, paso_de_tiempo: v})} tooltip={t.dt_desc} />
                    <NumberInput label={t.p_amb } step="0.001" value={motor.Pamb} onChange={(v:any) => setMotor({...motor, Pamb: v})} tooltip={t.pamb_desc} />
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm shadow-sm flex flex-col rounded-md overflow-hidden border-t-2 border-t-cyan-500">
                  <CardHeader className="py-2 px-3 bg-muted/50 border-b border-slate-700/50 flex-none"><CardTitle className="text-[11px] uppercase tracking-widest text-cyan-400">{t.nozzle}</CardTitle></CardHeader>
                  <CardContent className="flex-1 p-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <NumberInput label={t.throat_d + " [mm]"} value={nozzle.Dt0} onChange={(v:any) => setNozzle({...nozzle, Dt0: v})} tooltip={t.dt0_desc} />
                    <NumberInput label={t.exit_d + " [mm]"} value={nozzle.Ds} onChange={(v:any) => setNozzle({...nozzle, Ds: v})} tooltip={t.ds_desc} />
                    <NumberInput label={t.div_angle + " [º]"} step="1" value={nozzle.alpha} onChange={(v:any) => setNozzle({...nozzle, alpha: v})} tooltip={t.alpha_desc} />
                    <NumberInput label={t.throat_ro + " [mm]"} step="0.1" value={nozzle.ro} onChange={(v:any) => setNozzle({...nozzle, ro: v})} tooltip={t.ro_desc} />
                    <NumberInput label={t.erosion + " [mm]"} step="0.1" value={nozzle.e} onChange={(v:any) => setNozzle({...nozzle, e: v})} tooltip={t.e_desc} />
                    <NumberInput label={t.eff_n} step="0.01" value={nozzle.etanoz} onChange={(v:any) => setNozzle({...nozzle, etanoz: v})} tooltip={t.etanoz_desc} />
                  </CardContent>
                </Card>

                <div className="bg-card border-border shadow-sm rounded-md shadow-sm relative overflow-hidden flex flex-col min-h-[160px] justify-center items-center border-t-2 border-t-slate-400">
                   <span className="absolute top-1.5 left-2 text-[9px] font-bold text-slate-300 uppercase bg-slate-900/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-700/50 z-10 shadow-sm">{t.motor_chamber} SCHEMATIC</span>
                   <MotorPreview motor={motor} grains={grains} />
                </div>
            </div>

            {/* BOTTOM AREA: Vertical list of horizontal grain rows */}
            <Card className="flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden bg-card border-border shadow-sm rounded-md">
               <CardHeader className="py-2 px-3 bg-muted/50 border-b border-slate-700/50 flex flex-row justify-between items-center shrink-0">
                  <CardTitle className="text-[12px] font-bold uppercase tracking-widest text-slate-300">{t.grains}</CardTitle>
                  <Button onClick={addGrain} size="sm" className="h-7 text-[10px] px-4 bg-primary/20 hover:bg-primary/40 border border-primary text-primary rounded font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all">
                    {t.new_grain}
                  </Button>
               </CardHeader>
               
               <CardContent className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 no-scrollbar">
                  {grains.map((g, index) => (
                    <div key={g.id} className="w-full flex shrink-0 border border-slate-700/50 bg-slate-800/40 rounded-md shadow-md min-h-[140px] overflow-hidden backdrop-blur-sm relative group hover:border-slate-600/80 transition-colors">
                        {/* 1. Index & Remove */}
                        <div className="w-8 shrink-0 bg-slate-900/80 text-primary flex flex-col items-center justify-center border-r border-slate-700/50 relative">
                           <span className="text-xs font-bold transform -rotate-90 whitespace-nowrap uppercase tracking-widest drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">{t.grains} {index + 1}</span>
                           <Button variant="ghost" size="icon" onClick={() => removeGrain(g.id)} disabled={grains.length === 1} className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-950/50 p-0 text-[12px] absolute top-1 opacity-50 group-hover:opacity-100 transition-opacity">
                             ✕
                           </Button>
                        </div>

                        {/* 2. Inputs (Propellant/Shape & Main dimensions) */}
                        <div className="flex-1 p-2.5 grid grid-cols-2 gap-x-6 gap-y-1 min-w-[300px]">
                            <div className="space-y-1.5">
                                <div>
                                  <UiLabel className="text-[10px] mb-1 block px-0.5 uppercase tracking-wider text-slate-400 font-bold">{t.propellant}</UiLabel>
                                  <Select value={String(g.propellantType)} onValueChange={v => setGrains(grains.map(x => x.id === g.id ? {...x, propellantType: +v as any} : x))}>
                                    <SelectTrigger className="bg-slate-900/80 h-7 text-[11px] px-2 py-0 border-slate-700/50 min-h-0 text-slate-200"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                                      {PROPELLANTS.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-[11px] focus:bg-slate-800">{p.name}</SelectItem>)}
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
                                  <UiLabel className="text-[10px] mb-1 block px-0.5 uppercase tracking-wider text-slate-400 font-bold">{t.shape}</UiLabel>
                                  <Select value={String(g.shape)} onValueChange={v => setGrains(grains.map(x => x.id === g.id ? {...x, shape: +v as any} : x))}>
                                    <SelectTrigger className="bg-slate-900/80 h-7 text-[11px] px-2 py-0 border-slate-700/50 min-h-0 text-slate-200"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                                      <SelectItem value="1" className="text-[11px] focus:bg-slate-800">Tubular</SelectItem>
                                      <SelectItem value="2" className="text-[11px] focus:bg-slate-800">Star</SelectItem>
                                      <SelectItem value="3" className="text-[11px] focus:bg-slate-800">Solid</SelectItem>
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
                                
                                <div className="border-t border-slate-700/50 pt-2 mt-2 flex justify-between items-center px-1">
                                  <UiLabel className="text-[10px] text-primary/80 uppercase font-bold tracking-wider">{t.burn_faces}</UiLabel>
                                  <div className="flex gap-4">
                                  <div className="flex items-center space-x-1.5" title={t.external}><Checkbox className="w-4 h-4 rounded-sm border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.osi===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, osi: c ? 1 : 0} : x))} id={`osi-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-300 font-semibold cursor-pointer" htmlFor={`osi-${g.id}`}>EXT</UiLabel></div>
                                  <div className="flex items-center space-x-1.5" title={t.ends}><Checkbox className="w-4 h-4 rounded-sm border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.ei===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, ei: c ? 1 : 0} : x))} id={`ei-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-300 font-semibold cursor-pointer" htmlFor={`ei-${g.id}`}>ENDS</UiLabel></div>
                                  {g.shape !== 3 && <div className="flex items-center space-x-1.5" title={t.internal}><Checkbox className="w-4 h-4 rounded-sm border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={g.ci===1} onCheckedChange={c => setGrains(grains.map(x => x.id === g.id ? {...x, ci: c ? 1 : 0} : x))} id={`ci-${g.id}`} /><UiLabel className="text-[11px] font-mono text-slate-300 font-semibold cursor-pointer" htmlFor={`ci-${g.id}`}>INT</UiLabel></div>}
                                  </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Previews (Transversal & Longitudinal) */}
                        <div className="w-[350px] shrink-0 bg-slate-900/50 border-l border-slate-700/50 flex flex-row overflow-hidden relative">
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
            {results && (
              <div className="flex flex-col gap-6 pb-20">
                <div className="flex justify-end">
                  <Button onClick={() => exportToCsv(results)} variant="outline" size="sm" className="bg-card h-9 shadow-sm border-border text-primary">{t.export_csv}</Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-cyan-500"><CardContent className="p-3"><p className="text-xs font-mono text-cyan-400/80 uppercase">{t.shape} (Motor)</p><h3 className="text-[17px] font-bold text-slate-200 tracking-widest mt-1">{results.summary.motorClass}</h3></CardContent></Card>
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-cyan-500"><CardContent className="p-3"><p className="text-xs font-mono text-cyan-400/80 uppercase">{t.total_impulse} (IT)</p><h3 className="text-lg font-bold text-slate-200 mt-1">{(results.summary.It_total_N_s || 0).toFixed(0)} <span className="text-[11px] text-cyan-500 font-normal">N·s</span></h3></CardContent></Card>
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-cyan-500"><CardContent className="p-3"><p className="text-xs font-mono text-cyan-400/80 uppercase">{t.specific_impulse} (ISP)</p><h3 className="text-lg font-bold text-slate-200 mt-1">{(results.summary.Isp_total_s || 0).toFixed(1)} <span className="text-[11px] text-cyan-500 font-normal">s</span></h3></CardContent></Card>
                  
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-slate-500"><CardContent className="p-2 gap-1 flex flex-col justify-center">
                    <p className="text-[10px] font-mono text-slate-400 text-center mb-1 uppercase tracking-widest">{t.times}</p>
                    <div className="flex justify-between text-[11px] font-mono items-center"><span className="text-slate-400">{t.burn}</span><span className="font-bold text-slate-200 shadow-[0_0_5px_rgba(255,255,255,0.2)] px-1">{(results.summary.t_quemado || 0).toFixed(3)}s</span></div>
                    <div className="flex justify-between text-[11px] font-mono items-center"><span className="text-slate-400">{t.action}</span><span className="font-bold text-slate-200 shadow-[0_0_5px_rgba(255,255,255,0.2)] px-1">{(results.summary.t_fin || 0).toFixed(3)}s</span></div>
                  </CardContent></Card>
                  
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-cyan-500"><CardContent className="p-3">
                    <p className="text-xs font-mono text-blue-400/80 uppercase">{t.max_p}</p>
                    <h3 className="text-lg font-bold text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] mt-1">{(results.summary.Pmax_MPa || 0).toFixed(2)} <span className="text-[11px] font-normal">MPa</span></h3>
                  </CardContent></Card>
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-cyan-500"><CardContent className="p-3">
                    <p className="text-xs font-mono text-blue-400/80 uppercase">{t.avg_p}</p>
                    <h3 className="text-lg font-bold text-blue-400 mt-1">{(results.summary.Pmed_MPa || 0).toFixed(2)} <span className="text-[11px] font-normal">MPa</span></h3>
                  </CardContent></Card>
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-orange-500"><CardContent className="p-3">
                    <p className="text-xs font-mono text-orange-400/80 uppercase">{t.max_f}</p>
                    <h3 className="text-lg font-bold text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] mt-1">{(results.summary.Fmax_N || 0).toFixed(0)} <span className="text-[11px] font-normal">N</span></h3>
                  </CardContent></Card>
                  <Card className="col-span-2 lg:col-span-1 bg-card border-border shadow-sm border-t-2 border-t-orange-500"><CardContent className="p-3">
                    <p className="text-xs font-mono text-orange-400/80 uppercase">{t.avg_f}</p>
                    <h3 className="text-lg font-bold text-orange-500 mt-1">{(results.summary.Fmed_N || 0).toFixed(0)} <span className="text-[11px] font-normal">N</span></h3>
                  </CardContent></Card>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
                  <Card className="flex flex-col bg-card border-border shadow-sm">
                    <CardHeader className="py-2 border-b border-border"><CardTitle className="text-[13px] uppercase tracking-widest text-blue-400">{t.pressure_vs_time}</CardTitle></CardHeader>
                    <CardContent className="p-0 pt-4 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#334155" />
                          <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={[0, 'dataMax']} 
                            tickCount={10} 
                            tickFormatter={(value) => value.toFixed(2)}
                            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                            height={60}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                          >
                            <ChartLabel value={t.axis_time} position="bottom" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                          </XAxis>
                          <YAxis 
                            domain={[0, (dataMax: number) => (dataMax * 1.1)]} 
                            tickFormatter={(value) => value.toFixed(1)} 
                            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                            width={70}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                          >
                            <ChartLabel value={t.axis_pressure} angle={-90} position="left" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                          </YAxis>
                          <Tooltip 
                            formatter={(value: number) => value.toFixed(2) + " MPa"} 
                            labelFormatter={(lbl) => "T+ " + Number(lbl).toFixed(3) + "s"}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right"
                            wrapperStyle={{ 
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
                            }} 
                          />
                          <Line type="monotone" dataKey="P0_gage" stroke="#3b82f6" dot={false} strokeWidth={2.5} name="Chamber Pressure (MPa)" style={{ filter: 'drop-shadow(0px 0px 5px rgba(59,130,246,0.6))' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="flex flex-col bg-card border-border shadow-sm">
                    <CardHeader className="py-2 border-b border-border"><CardTitle className="text-[13px] uppercase tracking-widest text-orange-400">{t.thrust_vs_time}</CardTitle></CardHeader>
                    <CardContent className="p-0 pt-4 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#334155" />
                          <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={[0, 'dataMax']} 
                            tickCount={10} 
                            tickFormatter={(value) => value.toFixed(2)}
                            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                            height={60}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                          >
                            <ChartLabel value={t.axis_time} position="bottom" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                          </XAxis>
                          <YAxis 
                            domain={[0, (dataMax: number) => (dataMax * 1.1)]} 
                            tickFormatter={(value) => value.toFixed(0)} 
                            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                            width={70}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                          >
                            <ChartLabel value={t.axis_thrust} angle={-90} position="left" offset={0} fill="#cbd5e1" style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, textAnchor: 'middle' }} />
                          </YAxis>
                          <Tooltip 
                            formatter={(value: number) => value.toFixed(1) + " N"} 
                            labelFormatter={(lbl) => "T+ " + Number(lbl).toFixed(3) + "s"}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right"
                            layout="vertical"
                            wrapperStyle={{ 
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
                            }} 
                          />
                          <Line type="monotone" dataKey="F_N" stroke="#f97316" dot={false} strokeWidth={2.5} name={t.r_nakka + " (N)"} style={{ filter: 'drop-shadow(0px 0px 5px rgba(249,115,22,0.6))' }} />
                          <Line type="monotone" dataKey="E_N" stroke="#10b981" dot={false} strokeWidth={1.5} strokeDasharray="3 3" name={t.ideal_tti + " (N)"} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

           <TabsContent value="analysis" className="flex-1 overflow-y-auto w-full no-scrollbar p-1">
             {results && (
                <div className="flex flex-col h-full gap-4 pb-10">
                   <div className="flex flex-wrap gap-4 shrink-0 mt-2">
                    {results.grains.map((g, idx) => (
                      <Card key={g.id} className="flex flex-col bg-card border-border shadow-sm flex-1 min-w-[320px]">
                        <CardHeader className="py-2 px-3 bg-muted/50 border-b border-border">
                          <CardTitle className="text-[13px] uppercase tracking-widest text-cyan-400">{t.grains} {idx + 1} - Area</CardTitle>
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
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4 pb-10">
                 <Button variant="outline" size="sm" className="w-fit self-end h-6 text-[10px]" onClick={() => setShowCfdInfo(!showCfdInfo)}>{t.more_info}</Button>
                 {showCfdInfo && (
                   <div className="p-3 bg-slate-900 text-slate-200 rounded text-[10px] leading-relaxed">
                     <p className="font-bold text-blue-400 mb-1">{t.cfd_solver_title}</p>
                     {t.cfd_solver_desc}
                   </div>
                 )}
                 <div className="flex flex-col mx-auto bg-card rounded-lg shadow-sm border overflow-hidden shrink-0 w-full min-h-[300px]">
                    <PlaybackWrapper results={results} t_parent={t} />
                 </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* PROFESSIONAL FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-3 border-t-4 border-slate-800 mt-auto">
        <div className="max-w-100 mx-auto w-full px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono">
           <div className="flex items-center gap-2">
              <span className="text-slate-400">AUTHOR:</span>
              <span className="text-slate-200 font-semibold uppercase tracking-wider">MIGUEL TEJERA LESMES</span>
           </div>
           <div className="text-slate-400 text-center md:text-right">
              © {new Date().getFullYear()} HERMES
           </div>
        </div>
      </footer>
    </div>
  );
}
