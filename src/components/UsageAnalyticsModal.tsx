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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-100">
                  {lang === 'es' ? 'Mis Estadísticas de Uso' : 'My Usage Statistics'}
                </h2>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {lang === 'es' ? '100% Privado en tu PC' : '100% Private on Device'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'es' 
                  ? 'Resumen personal de uso de HERMES Simulator desde la instalación y por meses' 
                  : 'Personal usage summary of HERMES Simulator since installation and monthly'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Banner Notice & Email Share Action */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-800/40 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-purple-200 max-w-xl">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <p className="font-semibold text-xs text-purple-100">
                  {lang === 'es' ? 'Tus estadísticas pertenecen únicamente a ti' : 'Your statistics belong solely to you'}
                </p>
                <p className="text-[11px] text-purple-300/80 mt-0.5">
                  {lang === 'es' 
                    ? 'No enviamos datos en segundo plano a ningún servidor. Si deseas compartir tus estadísticas de uso o enviar sugerencias al equipo de desarrollo, puedes hacerlo opcionalmente por correo.' 
                    : 'We do not send telemetry in the background. You can voluntarily email your monthly report to the team if you wish.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendEmail}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Compartir informe de uso por correo"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Enviar Reporte a info@coheteros.com' : 'Send Report to info@coheteros.com'}</span>
              </button>
            </div>
          </div>

          {/* Reset Confirmation dialog */}
          {showResetConfirm && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center justify-between gap-4">
              <p className="text-xs">¿Estás seguro de que deseas reiniciar todas tus estadísticas locales a cero?</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleReset} 
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-md"
                >
                  Sí, reiniciar
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)} 
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: ACUMULADO DESDE LA INSTALACIÓN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  {lang === 'es' ? 'Acumulado Desde la Instalación' : 'Lifetime Metrics Since Installation'}
                </h3>
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                {lang === 'es' ? `Instalado el ${installDateStr}` : `Installed on ${installDateStr}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Sesiones</span>
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-slate-100">{metrics.totalLaunches}</div>
                <div className="text-[10px] text-slate-500 mt-1">Lanzamientos totales</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Simulaciones</span>
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div className="text-2xl font-extrabold text-orange-400">{metrics.totalSimulationsRun}</div>
                <div className="text-[10px] text-slate-500 mt-1">Motores calculados</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Smart Search</span>
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-2xl font-extrabold text-cyan-400">{metrics.totalSmartSearchesRun}</div>
                <div className="text-[10px] text-slate-500 mt-1">Búsquedas optimizadas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Propulsantes</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400">{metrics.totalCustomPropellantsCreated}</div>
                <div className="text-[10px] text-slate-500 mt-1">Químicas sintetizadas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Exportaciones</span>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-blue-400">{metrics.totalExportsCount}</div>
                <div className="text-[10px] text-slate-500 mt-1">Descargas CSV/Excel</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                  <span>Guías Vistas</span>
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-purple-400">{metrics.totalGuidesCompleted}</div>
                <div className="text-[10px] text-slate-500 mt-1">Tours completados</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ESTADÍSTICAS MENSUALES */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-800/30 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  {lang === 'es' ? 'Desglose y Actividad Mensual' : 'Monthly Activity Breakdown'}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{lang === 'es' ? 'Seleccionar Mes:' : 'Select Month:'}</span>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 text-purple-300 font-semibold border border-purple-500/30 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                >
                  {monthsAvailable.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Month Highlight Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-slate-400 text-[10px] block">Sesiones ({selectedMonth})</span>
                <span className="text-lg font-bold text-slate-100 mt-0.5 block">{currentMonthData.launches}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-slate-400 text-[10px] block">Simulaciones ({selectedMonth})</span>
                <span className="text-lg font-bold text-orange-400 mt-0.5 block">{currentMonthData.simulations}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-slate-400 text-[10px] block">Smart Search ({selectedMonth})</span>
                <span className="text-lg font-bold text-cyan-400 mt-0.5 block">{currentMonthData.smartSearches}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-slate-400 text-[10px] block">Exportaciones ({selectedMonth})</span>
                <span className="text-lg font-bold text-blue-400 mt-0.5 block">{currentMonthData.exports}</span>
              </div>
            </div>

            {/* Monthly History Table */}
            <div className="pt-2">
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Mes (Año-Mes)</th>
                      <th className="py-2.5 px-3">Sesiones</th>
                      <th className="py-2.5 px-3">Simulaciones</th>
                      <th className="py-2.5 px-3">Smart Search</th>
                      <th className="py-2.5 px-3">Exportaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 text-slate-300">
                    {monthsAvailable.map((mKey) => {
                      const log = metrics.monthlyLog[mKey];
                      const isSelected = mKey === selectedMonth;
                      return (
                        <tr 
                          key={mKey} 
                          onClick={() => setSelectedMonth(mKey)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-950/40 font-semibold' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className="py-2.5 px-3 font-mono text-purple-300 flex items-center gap-1.5">
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                            {mKey}
                          </td>
                          <td className="py-2.5 px-3">{log.launches}</td>
                          <td className="py-2.5 px-3 text-orange-300">{log.simulations}</td>
                          <td className="py-2.5 px-3 text-cyan-300">{log.smartSearches}</td>
                          <td className="py-2.5 px-3 text-blue-300">{log.exports}</td>
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
            <div className="md:col-span-2 p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                {lang === 'es' ? 'Preferencia de Pestañas' : 'Tab Usage Preference'}
              </h3>
              <div className="space-y-2.5">
                {Object.entries(metrics.tabVisits).map(([tabKey, visits]) => {
                  const percentage = Math.round((visits / totalTabVisits) * 100);
                  return (
                    <div key={tabKey} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-300">{tabNames[tabKey] || tabKey}</span>
                        <span className="text-slate-400">{visits} visitas ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(percentage, visits > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform & System Details */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-400" />
                {lang === 'es' ? 'Datos del Entorno' : 'Environment Details'}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px]">Modo de Ejecución</span>
                  <span className="font-medium text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Monitor className="w-3.5 h-3.5 text-purple-400" />
                    {metrics.isElectron ? 'Ejecutable Electron (Desktop)' : 'Navegador Web (Browser)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px]">Idioma de Trabajo</span>
                  <span className="font-medium text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    {metrics.activeLanguage.toUpperCase()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px]">Fecha de Instalación</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">
                    {installDateStr}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>HERMES Usage Analytics v1.0</span>
            <button
              onClick={handleDownloadJson}
              className="text-slate-400 hover:text-slate-200 underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Descargar JSON
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-rose-400/80 hover:text-rose-300 underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reiniciar
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
