import React, { useState } from 'react';
import { 
  TelemetryMetrics, 
  loadTelemetryData, 
  resetTelemetryMetrics, 
  generateMonthlyEmailBody 
} from '../lib/telemetry';
import { 
  BarChart3, 
  Mail, 
  Download, 
  RotateCcw, 
  X, 
  ShieldCheck, 
  Activity, 
  Monitor, 
  Globe, 
  Flame, 
  Search, 
  FileSpreadsheet, 
  BookOpen, 
  Layers,
  Calendar,
  Clock,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface UsageAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
}

export const UsageAnalyticsModal: React.FC<UsageAnalyticsModalProps> = ({ isOpen, onClose, lang = 'es' }) => {
  const [metrics, setMetrics] = useState<TelemetryMetrics>(loadTelemetryData);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  if (!isOpen) return null;

  const handleRefresh = () => {
    setMetrics(loadTelemetryData());
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`📊 Informe Mensual de Uso HERMES - ${new Date().toLocaleDateString('es-ES')}`);
    const body = encodeURIComponent(generateMonthlyEmailBody(metrics));
    window.location.href = `mailto:info@coheteros.com?subject=${subject}&body=${body}`;
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metrics, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hermes_estadisticas_uso_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleReset = () => {
    const fresh = resetTelemetryMetrics();
    setMetrics(fresh);
    setShowResetConfirm(false);
  };

  const totalTabVisits = Object.values(metrics.tabVisits).reduce((a, b) => a + b, 0) || 1;

  const tabNames: Record<string, string> = {
    inputs: 'Entradas (Inputs)',
    results: 'Resultados (Results)',
    analysis: 'Análisis Detallado',
    mission_control: 'Control de Misión',
    smart_search: 'Smart Search (Optim)',
    agente_jesus: 'Agente Jesús AI',
    cfd: 'CFD 2D/3D',
  };

  const installDateStr = new Date(metrics.firstLaunchDate).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const monthsAvailable = Object.keys(metrics.monthlyLog).sort().reverse();
  const currentMonthData = metrics.monthlyLog[selectedMonth] || { launches: 0, simulations: 0, smartSearches: 0, exports: 0 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card-header text-card-header-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-primary">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground">
                  {lang === 'es' ? 'Mis Estadísticas de Uso' : 'My Usage Statistics'}
                </h2>
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  · <ShieldCheck className="w-3.5 h-3.5" /> {lang === 'es' ? '100% Privado en tu PC' : '100% Private on Device'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === 'es' 
                  ? 'Resumen personal de uso de HERMES Simulator desde la instalación y por meses' 
                  : 'Personal usage summary of HERMES Simulator since installation and monthly'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Banner Notice & Email Share Action */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-foreground max-w-xl">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-xs text-foreground">
                  {lang === 'es' ? 'Tus estadísticas pertenecen únicamente a ti' : 'Your statistics belong solely to you'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lang === 'es' 
                    ? 'No enviamos datos en segundo plano a ningún servidor. Si deseas compartir tus estadísticas de uso o enviar sugerencias al equipo de desarrollo, puedes hacerlo opcionalmente por correo.' 
                    : 'We do not send telemetry in the background. You can voluntarily email your monthly report to the team if you wish.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendEmail}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Compartir informe de uso por correo"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Enviar Reporte a info@coheteros.com' : 'Send Report to info@coheteros.com'}</span>
              </button>
            </div>
          </div>

          {/* Reset Confirmation dialog */}
          {showResetConfirm && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
              <p className="text-xs font-medium">¿Estás seguro de que deseas reiniciar todas tus estadísticas locales a cero?</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleReset} 
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md cursor-pointer"
                >
                  Sí, reiniciar
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)} 
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-md border border-border cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: ACUMULADO DESDE LA INSTALACIÓN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {lang === 'es' ? 'Acumulado Desde la Instalación' : 'Lifetime Metrics Since Installation'}
                </h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {lang === 'es' ? `Instalado el ${installDateStr}` : `Installed on ${installDateStr}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Sesiones</span>
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">{metrics.totalLaunches}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Lanzamientos totales</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Simulaciones</span>
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">{metrics.totalSimulationsRun}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Motores calculados</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Smart Search</span>
                  <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">{metrics.totalSmartSearchesRun}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Búsquedas optimizadas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Propulsantes</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{metrics.totalCustomPropellantsCreated}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Químicas sintetizadas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Exportaciones</span>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">{metrics.totalExportsCount}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Descargas CSV/Excel</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/25 border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                  <span>Guías Vistas</span>
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-primary">{metrics.totalGuidesCompleted}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Tours completados</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ESTADÍSTICAS MENSUALES */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/15 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {lang === 'es' ? 'Desglose y Actividad Mensual' : 'Monthly Activity Breakdown'}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{lang === 'es' ? 'Seleccionar Mes:' : 'Select Month:'}</span>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-background text-foreground font-mono font-semibold border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
                >
                  {monthsAvailable.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Month Highlight Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">Sesiones ({selectedMonth})</span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground mt-0.5 block">{currentMonthData.launches}</span>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">Simulaciones ({selectedMonth})</span>
                <span className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5 block">{currentMonthData.simulations}</span>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">Smart Search ({selectedMonth})</span>
                <span className="text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 mt-0.5 block">{currentMonthData.smartSearches}</span>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-[10px] block font-mono">Exportaciones ({selectedMonth})</span>
                <span className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5 block">{currentMonthData.exports}</span>
              </div>
            </div>

            {/* Monthly History Table */}
            <div className="pt-2">
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="bg-card-header border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3">Mes (Año-Mes)</th>
                      <th className="py-2.5 px-3">Sesiones</th>
                      <th className="py-2.5 px-3">Simulaciones</th>
                      <th className="py-2.5 px-3">Smart Search</th>
                      <th className="py-2.5 px-3">Exportaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {monthsAvailable.map((mKey) => {
                      const log = metrics.monthlyLog[mKey];
                      const isSelected = mKey === selectedMonth;
                      return (
                        <tr 
                          key={mKey} 
                          onClick={() => setSelectedMonth(mKey)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/40'}`}
                        >
                          <td className={`py-2.5 px-3 font-mono ${isSelected ? 'text-primary font-bold' : 'text-foreground'}`}>
                            {mKey}
                          </td>
                          <td className="py-2.5 px-3">{log.launches}</td>
                          <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">{log.simulations}</td>
                          <td className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400">{log.smartSearches}</td>
                          <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{log.exports}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 3: NAVEGACIÓN Y ENTORNO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Usage by Tab */}
            <div className="md:col-span-2 p-4 rounded-xl bg-muted/15 border border-border space-y-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                {lang === 'es' ? 'Preferencia de Pestañas' : 'Tab Usage Preference'}
              </h3>
              <div className="space-y-2.5">
                {Object.entries(metrics.tabVisits).map(([tabKey, visits]) => {
                  const percentage = Math.round((visits / totalTabVisits) * 100);
                  return (
                    <div key={tabKey} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono tabular-nums">
                        <span className="font-medium text-foreground">{tabNames[tabKey] || tabKey}</span>
                        <span className="text-muted-foreground">{visits} visitas ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-xs overflow-hidden border border-border/50">
                        <div 
                          className="h-full bg-primary rounded-xs transition-all duration-500"
                          style={{ width: `${Math.max(percentage, visits > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform & System Details */}
            <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                {lang === 'es' ? 'Datos del Entorno' : 'Environment Details'}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Modo de Ejecución</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                    <Monitor className="w-3.5 h-3.5 text-primary" />
                    {metrics.isElectron ? 'Ejecutable Electron (Desktop)' : 'Navegador Web (Browser)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Idioma de Trabajo</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                    {metrics.activeLanguage.toUpperCase()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Fecha de Instalación</span>
                  <span className="font-medium text-foreground mt-0.5 block font-mono tabular-nums">
                    {installDateStr}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card-header text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="font-mono">HERMES Usage Analytics v2.1.0</span>
            <button
              onClick={handleDownloadJson}
              className="text-muted-foreground hover:text-foreground underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Descargar JSON
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-red-500 hover:text-red-600 underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reiniciar
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border font-medium transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
