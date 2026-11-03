export interface TelemetryMetrics {
  firstLaunchDate: string;
  lastLaunchDate: string;
  totalLaunches: number;
  isElectron: boolean;
  osPlatform: string;
  activeLanguage: string;
  tabVisits: {
    inputs: number;
    results: number;
    analysis: number;
    mission_control: number;
    smart_search: number;
    agente_jesus: number;
    cfd: number;
  };
  totalSimulationsRun: number;
  totalSmartSearchesRun: number;
  totalCustomPropellantsCreated: number;
  totalExportsCount: number;
  totalGuidesCompleted: number;
  monthlyLog: Record<string, {
    launches: number;
    simulations: number;
    smartSearches: number;
    exports: number;
  }>;
}

const TELEMETRY_STORAGE_KEY = 'hermes_analytics_telemetry_v1';

function getMonthlyKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function loadTelemetryData(): TelemetryMetrics {
  const defaultData: TelemetryMetrics = {
    firstLaunchDate: new Date().toISOString(),
    lastLaunchDate: new Date().toISOString(),
    totalLaunches: 1,
    isElectron: typeof window !== 'undefined' && Boolean((window as any).process?.versions?.electron || (window as any).navigator?.userAgent?.includes('Electron')),
    osPlatform: typeof navigator !== 'undefined' ? (navigator.platform || 'Desktop') : 'Desktop',
    activeLanguage: 'es',
    tabVisits: {
      inputs: 1,
      results: 0,
      analysis: 0,
      mission_control: 0,
      smart_search: 0,
      agente_jesus: 0,
      cfd: 0,
    },
    totalSimulationsRun: 0,
    totalSmartSearchesRun: 0,
    totalCustomPropellantsCreated: 0,
    totalExportsCount: 0,
    totalGuidesCompleted: 0,
    monthlyLog: {
      [getMonthlyKey()]: {
        launches: 1,
        simulations: 0,
        smartSearches: 0,
        exports: 0
      }
    }
  };

  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) {
      saveTelemetryData(defaultData);
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed, tabVisits: { ...defaultData.tabVisits, ...(parsed.tabVisits || {}) } };
  } catch {
    return defaultData;
  }
}

export function saveTelemetryData(data: TelemetryMetrics) {
  try {
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving telemetry data:', err);
  }
}

export function recordAppLaunch(lang: string) {
  const data = loadTelemetryData();
  const mKey = getMonthlyKey();

  data.totalLaunches += 1;
  data.lastLaunchDate = new Date().toISOString();
  data.activeLanguage = lang;

  if (!data.monthlyLog[mKey]) {
    data.monthlyLog[mKey] = { launches: 0, simulations: 0, smartSearches: 0, exports: 0 };
  }
  data.monthlyLog[mKey].launches += 1;

  saveTelemetryData(data);
}

export function trackTabVisit(tabId: string) {
  const data = loadTelemetryData();
  const key = tabId as keyof typeof data.tabVisits;
  if (data.tabVisits[key] !== undefined) {
    data.tabVisits[key] += 1;
  } else {
    data.tabVisits.inputs += 1;
  }
  saveTelemetryData(data);
}

export function trackEvent(eventType: 'simulation' | 'smart_search' | 'propellant_created' | 'export_data' | 'guide_completed') {
  const data = loadTelemetryData();
  const mKey = getMonthlyKey();

  if (!data.monthlyLog[mKey]) {
    data.monthlyLog[mKey] = { launches: 1, simulations: 0, smartSearches: 0, exports: 0 };
  }

  if (eventType === 'simulation') {
    data.totalSimulationsRun += 1;
    data.monthlyLog[mKey].simulations += 1;
  } else if (eventType === 'smart_search') {
    data.totalSmartSearchesRun += 1;
    data.monthlyLog[mKey].smartSearches += 1;
  } else if (eventType === 'propellant_created') {
    data.totalCustomPropellantsCreated += 1;
  } else if (eventType === 'export_data') {
    data.totalExportsCount += 1;
    data.monthlyLog[mKey].exports += 1;
  } else if (eventType === 'guide_completed') {
    data.totalGuidesCompleted += 1;
  }

  saveTelemetryData(data);
}

export function resetTelemetryMetrics() {
  localStorage.removeItem(TELEMETRY_STORAGE_KEY);
  return loadTelemetryData();
}

export function generateMonthlyEmailBody(metrics: TelemetryMetrics): string {
  const mKey = getMonthlyKey();
  const currentMonthStats = metrics.monthlyLog[mKey] || { launches: 0, simulations: 0, smartSearches: 0, exports: 0 };

  const mostVisitedTab = Object.entries(metrics.tabVisits).sort((a, b) => b[1] - a[1])[0]?.[0] || 'inputs';

  return `
==================================================
📊 INFORME MENSUAL DE USO Y ESTADÍSTICAS - HERMES
==================================================
Mes Reportado: ${mKey}
Fecha del Informe: ${new Date().toLocaleDateString('es-ES')}
Entorno de Ejecución: ${metrics.isElectron ? 'Ejecutable Electron Desktop App' : 'Navegador Web'}

📈 RESUMEN DEL MES ACTUAL (${mKey}):
--------------------------------------------------
• Sesiones de la aplicación: ${currentMonthStats.launches}
• Simulaciones calculadas: ${currentMonthStats.simulations}
• Optimizaciones Smart Search: ${currentMonthStats.smartSearches}
• Ficheros exportados (CSV/Excel): ${currentMonthStats.exports}

🏆 ESTADÍSTICAS ACUMULADAS TOTALES:
--------------------------------------------------
• Total de Lanzamientos / Sesiones: ${metrics.totalLaunches}
• Total de Simulaciones Ejecutadas: ${metrics.totalSimulationsRun}
• Total de Búsquedas Smart Search: ${metrics.totalSmartSearchesRun}
• Propulsantes Personalizados Creados: ${metrics.totalCustomPropellantsCreated}
• Exportaciones Totales a Excel/CSV: ${metrics.totalExportsCount}
• Guías Interactivas Completadas: ${metrics.totalGuidesCompleted}
• Pestaña Preferida / Más Usada: ${mostVisitedTab.toUpperCase()}
• Idioma Seleccionado: ${metrics.activeLanguage.toUpperCase()}
• Primera Instalación / Uso: ${new Date(metrics.firstLaunchDate).toLocaleDateString('es-ES')}

==================================================
Generado automáticamente por HERMES Simulator Admin Telemetry Module.
`.trim();
}
