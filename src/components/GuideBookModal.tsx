import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Sparkles, 
  Layers, 
  Flame, 
  LineChart, 
  Compass, 
  Search, 
  X, 
  Play, 
  CheckCircle2, 
  ArrowRight, 
  Rocket, 
  Cpu, 
  ShieldCheck, 
  HelpCircle,
  Wand2,
  Sliders,
  Beaker,
  Gauge,
  Activity,
  Download,
  FolderOpen,
  RotateCcw
} from 'lucide-react';
import { 
  isTourCompleted, 
  resetCompletedTours, 
  unmarkSingleTour,
  COMPLETED_TOURS_STORAGE_KEY 
} from './InteractiveTourOverlay';

export interface GuideDefinition {
  id: string;
  tourSequenceId: string;
  titleEs: string;
  titleEn: string;
  titleFr?: string;
  titleIt?: string;
  category: 'beginner' | 'geometry' | 'nozzle' | 'propellant' | 'results' | 'optimizer' | 'flight' | 'export';
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  estimatedMinutes: number;
  icon: any;
  color: string;
  summaryEs: string;
  summaryEn: string;
  summaryFr?: string;
  summaryIt?: string;
  bulletPointsEs: string[];
  bulletPointsEn: string[];
  bulletPointsFr?: string[];
  bulletPointsIt?: string[];
  presetLabelEs?: string;
  presetLabelEn?: string;
  onApplyPreset?: () => void;
}

interface GuideBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: (tourId: string) => void;
  onApplyPresetMotor: (type: 'bates_j' | 'star_k' | 'apcp_l' | 'nozzle_opt') => void;
  lang: string;
  theme: string;
}

export function GuideBookModal({
  isOpen,
  onClose,
  onStartTour,
  onApplyPresetMotor,
  lang,
  theme
}: GuideBookModalProps) {
  const isSpanish = lang === 'es';
  const isFrench = lang === 'fr';
  const isItalian = lang === 'it';
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  // Reload completed status whenever modal opens or event is dispatched
  const refreshCompletedStatus = () => {
    try {
      const raw = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const map: Record<string, boolean> = {};
      list.forEach(id => { map[id] = true; });
      setCompletedMap(map);
    } catch {
      setCompletedMap({});
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshCompletedStatus();
    }
    const handler = () => refreshCompletedStatus();
    window.addEventListener('hermes-tour-completed', handler);
    return () => window.removeEventListener('hermes-tour-completed', handler);
  }, [isOpen]);

  const guides: GuideDefinition[] = useMemo(() => [
    {
      id: 'grain_creation',
      tourSequenceId: 'tour_grains',
      titleEs: 'Creación y Geometría de Granos de Propelente',
      titleEn: 'Propellant Grain Creation & Geometry',
      titleFr: 'Création et Géométrie des Grains',
      titleIt: 'Creazione e Geometria dei Grani',
      category: 'geometry',
      difficulty: 'Básico',
      estimatedMinutes: 4,
      icon: Layers,
      color: 'from-purple-500 to-indigo-600',
      summaryEs: 'Aprende paso a paso cómo añadir nuevos bloques de grano (+ Nuevo Grano), seleccionar combustible, configurar formas (BATES, Estrella, Macizo), calcular web thickness e inhibir caras.',
      summaryEn: 'Step-by-step tutorial on adding new grain segments (+ New Grain), selecting fuels, configuring shapes (BATES, Star, Solid), sizing web thickness, and setting inhibitors.',
      summaryFr: 'Guide pas à pas pour ajouter de nouveaux grains, choisir la géométrie et inhiber les faces.',
      summaryIt: 'Guida passo-passo per aggiungere nuovi grani, scegliere la geometria e inibire le facce.',
      bulletPointsEs: [
        'Añadir nuevos segmentos a la pila con el botón "+ Nuevo Grano".',
        'Selección de combustible (estándar o personalizado de tu biblioteca).',
        'Formas: Cilíndrico BATES (empuje neutro), Estrella (alto despegue) o Macizo.',
        'Dimensiones críticas: D₀ (ajuste a cámara), d₀ (orificio), espesor Web y recuento N.',
        'Inhibición térmica de caras: EXT (liner perimetral), ENDS (extremos) e INT (núcleo).'
      ],
      bulletPointsEn: [
        'Appending new segments with the "+ New Grain" button.',
        'Fuel formulation assignment (standard or custom from your library).',
        'Geometries: BATES (neutral thrust), Star (high liftoff), or End-burner solid.',
        'Critical dimensions: D₀ (casing fit), d₀ (port), Web thickness, and count N.',
        'Face inhibition controls: EXT (casing liner), ENDS (face edges), and INT (core).'
      ],
      presetLabelEs: 'Cargar Grano BATES 4x54mm',
      presetLabelEn: 'Load BATES 4x54mm Grain',
      onApplyPreset: () => onApplyPresetMotor('bates_j')
    },
    {
      id: 'nozzle_and_chamber',
      tourSequenceId: 'tour_nozzle',
      titleEs: 'Cámara de Combustión y Tobera Laval',
      titleEn: 'Combustion Chamber & De Laval Nozzle',
      titleFr: 'Chambre de Combustion & Tuyère Laval',
      titleIt: 'Camera di Combustione e Ugello Laval',
      category: 'nozzle',
      difficulty: 'Intermedio',
      estimatedMinutes: 4,
      icon: Compass,
      color: 'from-blue-500 to-cyan-600',
      summaryEs: 'Domina el dimensionado crítico de la garganta (Dt0), relación de expansión (Ds/Dt0), ángulo de divergencia y fenómenos reales de erosión y acumulación de escoria.',
      summaryEn: 'Master critical throat sizing (Dt0), expansion ratio (Ds/Dt0), divergence angle, and real-world throat erosion and slag buildup phenomena.',
      summaryFr: 'Dimensionnez le col Dt0, le rapport d\'expansion et simulez l\'érosion et les scories.',
      summaryIt: 'Dimensiona la gola Dt0, il rapporto di espansione e modella erosione e scorie.',
      bulletPointsEs: [
        'Diámetro de garganta (Dt0): el regulador principal de la presión de cámara y Kn.',
        'Diámetro de salida (Ds) y relación de expansión óptima a 1 atm.',
        'Rendimientos reales: eficiencia de cámara (ηc) y eficiencia de tobera (ηnoz).',
        'Modelado de erosión ablativa (+) o acumulación de escoria (-) en tiempo real.'
      ],
      bulletPointsEn: [
        'Throat diameter (Dt0): the primary controller of chamber pressure and Kn.',
        'Exit diameter (Ds) and optimal expansion ratio at 1 atm sea level.',
        'Real efficiencies: chamber thermal factor (ηc) and nozzle efficiency (ηnoz).',
        'Ablative throat erosion (+) and slag deposition (-) dynamic modeling.'
      ],
      presetLabelEs: 'Tobera Óptima Nivel Mar',
      presetLabelEn: 'Optimal Sea-Level Nozzle',
      onApplyPreset: () => onApplyPresetMotor('nozzle_opt')
    },
    {
      id: 'create_custom_propellant',
      tourSequenceId: 'tour_create_propellant',
      titleEs: 'Crear un Nuevo Propulsante Personalizado',
      titleEn: 'Create a Custom Propellant Formula',
      titleFr: 'Créer un Propergol Personnalisé',
      titleIt: 'Crea un Propellente Personalizzato',
      category: 'propellant',
      difficulty: 'Intermedio',
      estimatedMinutes: 4,
      icon: Beaker,
      color: 'from-purple-600 to-pink-600',
      summaryEs: 'Aprende a localizar el botón en Inputs para abrir el gestor, explorar los propulsantes existentes y sus rangos de presión, y formular un nuevo combustible con tabla r(P).',
      summaryEn: 'Learn where to find the manager button on Inputs, inspect existing fuels and piecewise pressure ranges, and synthesize custom propellants with r(P) tables.',
      summaryFr: 'Localisez le bouton dans les Entrées, examinez les propergols existants et créez votre propre carburant.',
      summaryIt: 'Localizza il pulsante in Dati, esamina i propellenti esistenti e formula un nuovo combustibile.',
      bulletPointsEs: [
        'Localización exacta del botón en la pestaña Inputs ("Química & Propulsantes" / "Fórmula").',
        'Exploración de propulsantes estándar existentes y sus rangos de presión calibrados.',
        'Creación desde cero (+ Nuevo Propulsante) o duplicación de base existente.',
        'Parámetros termoquímicos (ρ, T₀, γ, M) y tabla interactiva por tramos de presión [Pmin-Pmax].',
        'Curva gráfica r(P) en tiempo real y guardado persistente en tu navegador.'
      ],
      bulletPointsEn: [
        'Exact location of the launcher button on Inputs ("Propellant Chemistry" / "Formula").',
        'Exploring standard pre-calibrated propellants and their empirical pressure intervals.',
        'Creating from scratch (+ New Propellant) or duplicating an existing base fuel.',
        'Thermochemistry (ρ, T₀, γ, M) and interactive piecewise pressure table [Pmin-Pmax].',
        'Live r(P) regression curve inspection and persistent local storage saving.'
      ]
    },
    {
      id: 'propellants_chemistry',
      tourSequenceId: 'tour_propellants',
      titleEs: 'Composición Química, Saint-Robert y Saint-Venant',
      titleEn: 'Propellant Chemistry, Saint-Robert & Saint-Venant',
      titleFr: 'Chimie des Propergols, Saint-Robert & Saint-Venant',
      titleIt: 'Chimica dei Propellenti, Saint-Robert e Saint-Venant',
      category: 'propellant',
      difficulty: 'Intermedio',
      estimatedMinutes: 5,
      icon: Flame,
      color: 'from-amber-500 to-rose-600',
      summaryEs: 'Guía centrada en la pestaña Inputs: selección de combustibles, qué significan los parámetros A y N (r = a·Pⁿ), la condición crítica de estabilidad (n < 1) y la ley de Saint-Venant.',
      summaryEn: 'Inputs-focused guide: propellant assignment, meaning of burn parameters A and N (r = a·Pⁿ), stability condition (n < 1), and Saint-Venant choked nozzle law.',
      summaryFr: 'Guide centré sur l\'onglet Entrées : sélection, paramètres A et N, condition n < 1 et loi de Saint-Venant.',
      summaryIt: 'Guida per il pannello Dati: selezione, parametri A ed N, condizione n < 1 e legge di Saint-Venant.',
      bulletPointsEs: [
        'Selección de combustible por grano (estándar o personalizado de biblioteca).',
        'Propiedades termoquímicas: densidad ρ, calor T₀, γ, masa molar M y velocidad c*.',
        'Ley de Saint-Robert: coeficientes A y N, y por qué n < 1 es obligatorio para evitar explosión (CATO).',
        'Ley de Saint-Venant: flujo sónico en garganta y presión de equilibrio de cámara P_eq.',
        'Inspección rápida de la fórmula química y parámetros activos desde Inputs.'
      ],
      bulletPointsEn: [
        'Propellant selection per grain segment (standard fuels or custom from library).',
        'Thermochemical properties: density ρ, flame temp T₀, γ, molar mass M, and velocity c*.',
        'Saint-Robert law: parameters A & N, and why n < 1 is strictly mandatory to prevent CATO.',
        'Saint-Venant law: sonic choked mass discharge and chamber equilibrium pressure P_eq.',
        'Quick inspection of chemical values and active formulation directly on Inputs.'
      ],
      presetLabelEs: 'Cargar Motor APCP K-Class',
      presetLabelEn: 'Load APCP K-Class Motor',
      onApplyPreset: () => onApplyPresetMotor('apcp_l')
    },
    {
      id: 'results_interpretation',
      tourSequenceId: 'tour_results',
      titleEs: 'Interpretación de Resultados y Curvas Balísticas',
      titleEn: 'Interpreting Results & Ballistic Curves',
      titleFr: 'Interprétation des Résultats & Courbes',
      titleIt: 'Interpretazione dei Risultati e Curve',
      category: 'results',
      difficulty: 'Básico',
      estimatedMinutes: 4,
      icon: LineChart,
      color: 'from-emerald-500 to-teal-600',
      summaryEs: 'Aprende a leer como un ingeniero la curva de presión P(t), el perfil de empuje F(t), el ratio de estrangulamiento Kn y la clasificación internacional de motores.',
      summaryEn: 'Learn how to interpret chamber pressure P(t), thrust profile F(t), Klemmung ratio Kn, and official Tripoli/NFPA rocket motor impulse classification.',
      summaryFr: 'Analysez la pression de chambre P(t), la poussée F(t) et la classe Tripoli.',
      summaryIt: 'Analizza la pressione in camera P(t), il profilo di spinta F(t) e la classe Tripoli.',
      bulletPointsEs: [
        'Presión máxima (Pmax) vs límite de rotura del casing con factor de seguridad (FS > 1.5).',
        'Tiempo de quemado (propelente activo) vs tiempo de acción (despresurización residual).',
        'Área bajo la curva F(t): Impulso Total (It) y determinación de la Clase (H, I, J, K...).',
        'Curva Kn = Ab / At: rango seguro de operación para evitar extinciones o explosión.'
      ],
      bulletPointsEn: [
        'Peak pressure (Pmax) vs casing burst limit with engineering safety factor (FS > 1.5).',
        'Burn time (active propellant consumption) vs action time (exhaust tail-off).',
        'Integral of thrust F(t): Total Impulse (It) and official motor class letter (H, I, J, K...).',
        'Kn ratio curve = Ab / At: safe operating envelope preventing chuffing or overpressure.'
      ]
    },
    {
      id: 'data_export_and_library',
      tourSequenceId: 'tour_export',
      titleEs: 'Exportación de Datos Numéricos (CSV y Excel)',
      titleEn: 'Numeric Data Export (CSV & Excel)',
      titleFr: 'Exportation de Données Numériques (CSV & Excel)',
      titleIt: 'Esportazione Dati Numerici (CSV ed Excel)',
      category: 'export',
      difficulty: 'Básico',
      estimatedMinutes: 3,
      icon: Download,
      color: 'from-cyan-500 to-blue-600',
      summaryEs: 'Aprende a exportar las series temporales de empuje F(t), presión P(t), flujo másico y resúmenes balísticos a archivos CSV y Microsoft Excel (.xlsx).',
      summaryEn: 'Learn how to export high-resolution F(t), P(t), mass flow time series and ballistic summaries into CSV and Excel (.xlsx) files.',
      summaryFr: 'Exporter les séries temporelles de poussée et pression vers CSV et Excel.',
      summaryIt: 'Esporta le serie temporali di spinta e pressione in formato CSV ed Excel.',
      bulletPointsEs: [
        'Series temporales balísticas con resolución del paso dt.',
        'Columnas de tiempo [s], presión (MPa/bar/atm), empuje (N/kgf) y flujo másico.',
        'Tabla de resumen de rendimiento para informes técnicos.',
        'Compatibilidad directa con Excel, MATLAB, Python y bancos de pruebas.'
      ],
      bulletPointsEn: [
        'Ballistic time series with integration step dt resolution.',
        'Columns for time [s], pressure (MPa/bar/atm), thrust (N/kgf), and mass flow.',
        'Built-in performance summary table for engineering reports.',
        'Direct compatibility with Excel, MATLAB, Python, and test stands.'
      ]
    },
    {
      id: 'save_simulation_local',
      tourSequenceId: 'tour_save',
      titleEs: 'Guardar Simulaciones en la Biblioteca Local',
      titleEn: 'Save Simulations to Local Library',
      titleFr: 'Enregistrer en Bibliothèque Locale',
      titleIt: 'Salvare le Simulazioni nella Libreria Locale',
      category: 'export',
      difficulty: 'Básico',
      estimatedMinutes: 3,
      icon: FolderOpen,
      color: 'from-blue-600 to-indigo-600',
      summaryEs: 'Aprende a ubicar el botón Guardar en la barra superior, asignar nombre y carpeta en la ventana modal emergente y recargar proyectos guardados desde la biblioteca.',
      summaryEn: 'Learn where to find the Save button in the top bar, set simulation name and folder group in the modal dialog, and reload designs from the library.',
      summaryFr: 'Localisez le bouton Enregistrer, nommez votre projet et rechargez depuis la bibliothèque.',
      summaryIt: 'Individua il pulsante Salva, imposta nome e cartella e ricarica i progetti dalla libreria.',
      bulletPointsEs: [
        'Localización del botón Guardar en la cabecera superior.',
        'Ventana modal: asignación de nombre de simulación y carpeta organizativa.',
        'Almacenamiento persistente en localStorage del navegador.',
        'Acceso al explorador de la Biblioteca para recargar proyectos en 1 clic.'
      ],
      bulletPointsEn: [
        'Locating the Save button in the top header bar.',
        'Modal dialog: specifying simulation name and category folder group.',
        'Persistent storage inside browser localStorage.',
        'Opening the Library explorer to reload archived designs in 1 click.'
      ]
    },
    {
      id: 'mission_control_flight',
      tourSequenceId: 'tour_mission_control',
      titleEs: 'Mission Control, Datos y Vuelo 1D',
      titleEn: 'Mission Control, Data & 1D Flight',
      titleFr: 'Mission Control, Données & Vol 1D',
      titleIt: 'Mission Control, Dati e Volo 1D',
      category: 'flight',
      difficulty: 'Intermedio',
      estimatedMinutes: 5,
      icon: Rocket,
      color: 'from-orange-500 to-amber-600',
      summaryEs: 'Explicación detallada de todas las funcionalidades: parámetros del cohete, elevación sobre el nivel del mar, aerodinámica Mach vs Cd, importación de ensayos con unidades y análisis de apogeo.',
      summaryEn: 'Detailed walkthrough of all features: rocket flight weights, launch site elevation, Mach vs Cd aerodynamics, test stand data import with unit selectors, and trajectory curves.',
      summaryFr: 'Visite détaillée : masses de fusée, altitude de tir, profil Mach vs Cd, import de bancs réels et apogée.',
      summaryIt: 'Guida dettagliata: pesi del razzo, quota di lancio, aerodinamica Mach vs Cd, importazione da banco prova e apogeo.',
      bulletPointsEs: [
        'Parámetros mecánicos y de atmósfera: masa en seco, diámetro exterior, altitud sobre el mar y botón Actualizar.',
        'Aerodinámica Mach vs Cd: modelo estándar vs personalizado, descarga de plantilla CSV y editor manual.',
        'Importación de ensayos estáticos: selección de formato de columnas y selectores de unidades (MPa/bar/psi, N/lbf).',
        'Resultados de trayectoria: apogeo máximo, velocidad, aceleración pico en Gs, gráficas comparativas y exportación.'
      ],
      bulletPointsEn: [
        'Mechanical & atmospheric inputs: dry mass, outer diameter, launch site elevation, and Update button.',
        'Aerodynamic drag polar: standard vs custom, CSV template download, and manual paste editor.',
        'Test stand data import: column formats (Time/Thrust, Time/Pressure, etc.) and unit selectors (MPa/bar/psi, N/lbf).',
        'Trajectory results: peak apogee, max velocity, peak G-load, comparison plots, and Excel/CSV export.'
      ]
    },
    {
      id: 'smart_search_optimization',
      tourSequenceId: 'tour_smart_search',
      titleEs: 'Optimización Inversa con Smart Search (3 Fases)',
      titleEn: 'Smart Search Inverse Optimization (3 Phases)',
      titleFr: 'Optimisation Inverse Smart Search (3 Phases)',
      titleIt: 'Ottimizzazione Inversa Smart Search (3 Fasi)',
      category: 'optimizer',
      difficulty: 'Avanzado',
      estimatedMinutes: 5,
      icon: Cpu,
      color: 'from-violet-500 to-purple-700',
      summaryEs: 'Diseño automático inverso: especifica límites de cámara y metas de empuje, y deja que el optimizador global unificado Differential Evolution encuentre la mejor geometría.',
      summaryEn: 'Inverse automated motor design: set casing limits and flight goals, and let the unified Differential Evolution global engine find optimal geometries.',
      summaryFr: 'Conception inverse automatique guidée en 3 phases par Differential Evolution.',
      summaryIt: 'Progettazione inversa automatica guidata in 3 fasi con Differential Evolution.',
      bulletPointsEs: [
        'Fase 1: Restricciones de hardware (diámetro y longitud de cámara, garganta, Pmax segura).',
        'Fase 2: Geometría de grano, número de segmentos y variables acotadas o libres.',
        'Fase 3: Selección de objetivo (máximo impulso total real, velocidad rápida o impulso objetivo).',
        'Motor unificado: Differential Evolution (DE/rand/1/bin) con muestreo LHS y presupuesto configurable.'
      ],
      bulletPointsEn: [
        'Phase 1: Hardware constraints (casing diameter and length, throat, safe Pmax limit).',
        'Phase 2: Grain geometry, segment count, and locked/free variables.',
        'Phase 3: Mission goal selection (pure total impulse, fast liftoff, or target impulse).',
        'Unified solver: Differential Evolution (DE/rand/1/bin) with LHS sampling and configurable budget.'
      ]
    },
    {
      id: 'full_simulator_tour',
      tourSequenceId: 'tour_full',
      titleEs: 'Tour General del Simulador (7 Pestañas y Guardado)',
      titleEn: 'General Simulator Walkthrough (7 Tabs & Saving)',
      titleFr: 'Tour Général du Simulateur (7 Onglets & Sauvegarde)',
      titleIt: 'Tour Generale del Simulatore (7 Pannelli e Salvataggio)',
      category: 'beginner',
      difficulty: 'Básico',
      estimatedMinutes: 6,
      icon: Sparkles,
      color: 'from-rose-500 to-pink-600',
      summaryEs: 'Explicación clara y detallada de qué se hace y qué objetivo tiene cada una de las 7 pestañas, además de cómo guardar simulaciones en tu biblioteca local.',
      summaryEn: 'Structured walkthrough explaining the purpose and workflows of all 7 tabs, plus how to save complete motor simulations to your library.',
      summaryFr: 'Visite guidée complète des 7 onglets du simulateur HERMES et de l\'enregistrement en bibliothèque.',
      summaryIt: 'Guida passo-passo che illustra lo scopo di tutti e 7 i pannelli e come salvare le simulazioni nella libreria.',
      bulletPointsEs: [
        'Pestaña 1 (Inputs): Todos los parámetros a introducir (cámara, tobera, granos) y su objetivo.',
        'Pestaña 2 (Results): Básicamente visualización (métricas balísticas, curvas P(t), F(t) y exportación).',
        'Guardado y Biblioteca: Dónde está el botón Guardar, ventana modal de proyecto y explorador de biblioteca.',
        'Pestaña 3 (Detailed Analysis): Estudio en detalle de la combustión (Kn, velocidad de gas, flujo).',
        'Pestaña 4 (Mission Control): Simulación de alturas, exportación e importación de datos CSV.',
        'Pestaña 5 (Smart Search): Optimización de geometrías y búsqueda automática de soluciones óptimas.',
        'Pestaña 6 (Agente Jesús): Aplicación de Inteligencia Artificial para entender mejor los resultados.',
        'Pestaña 7 (Animaciones): Únicamente visualización dinámica de gases y tobera.'
      ],
      bulletPointsEn: [
        'Tab 1 (Inputs): Parameters to input (chamber, nozzle, grains) and primary objective.',
        'Tab 2 (Results): Primarily visualization (metrics, P(t) & F(t) curves, and export).',
        'Save & Library: Location of Save button, project modal, and library explorer.',
        'Tab 3 (Detailed Analysis): In-depth combustion study (Kn, port gas velocity, mass flux).',
        'Tab 4 (Mission Control): Altitude simulation, trajectory control, and CSV import/export.',
        'Tab 5 (Smart Search): Geometry optimization solver to automatically find optimal motors.',
        'Tab 6 (Agente Jesús): Applying Artificial Intelligence to interpret results and anomalies.',
        'Tab 7 (Animations): Dedicated purely to dynamic nozzle flow and expansion visualization.'
      ]
    }
  ], [onApplyPresetMotor]);

  const filteredGuides = useMemo(() => {
    return guides.filter(guide => {
      const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = (isSpanish ? guide.titleEs : guide.titleEn).toLowerCase();
      const summary = (isSpanish ? guide.summaryEs : guide.summaryEn).toLowerCase();
      const bullets = (isSpanish ? guide.bulletPointsEs : guide.bulletPointsEn).join(' ').toLowerCase();

      return title.includes(q) || summary.includes(q) || bullets.includes(q);
    });
  }, [guides, selectedCategory, searchQuery, isSpanish]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState(false);

  const handleConfirmReset = () => {
    resetCompletedTours();
    setCompletedMap({});
    setShowResetConfirm(false);
    setResetSuccessMessage(true);
    setTimeout(() => setResetSuccessMessage(false), 3000);
  };

  const handleUnmarkSingle = (tourId: string) => {
    unmarkSingleTour(tourId);
    setCompletedMap(prev => {
      const next = { ...prev };
      delete next[tourId];
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div 
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all ${
          isDark
            ? 'bg-slate-900 border-purple-500/30 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.15)]'
            : 'bg-white border-purple-200 text-slate-900 shadow-[0_20px_50px_rgba(79,70,229,0.12)]'
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {isSpanish ? 'Libro de Guías del Simulador' : isFrench ? 'Livre des Guides du Simulateur' : isItalian ? 'Libro delle Guide del Simulatore' : 'Simulator Guide Hub'}
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  {isSpanish ? '10 Tours Interactivos' : '10 Interactive Tours'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSpanish 
                  ? 'Selecciona una guía temática para activar el foco visual y las flechas paso a paso sobre la interfaz.' 
                  : 'Select any themed guide to launch step-by-step interactive spotlights and directional arrows.'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={isSpanish ? 'Buscar temas (grano, tobera, Kn, Saint-Robert)...' : 'Search topics (grain, nozzle, Kn, Saint-Robert)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/80 border-border"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar pb-1 sm:pb-0">
            {[
              { id: 'all', label: isSpanish ? 'Todas' : 'All' },
              { id: 'beginner', label: isSpanish ? 'Tour Completo' : 'Full Tour' },
              { id: 'geometry', label: isSpanish ? 'Granos' : 'Grains' },
              { id: 'nozzle', label: isSpanish ? 'Tobera & Cámara' : 'Nozzle & Chamber' },
              { id: 'propellant', label: isSpanish ? 'Propelentes' : 'Propellants' },
              { id: 'results', label: isSpanish ? 'Resultados' : 'Results' },
              { id: 'export', label: isSpanish ? 'Exportación' : 'Export' },
              { id: 'flight', label: 'Mission Control' },
              { id: 'optimizer', label: 'Smart Search' },
            ].map(cat => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-7 text-[11px] px-2.5 rounded-lg whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 hover:bg-purple-500 text-white font-bold'
                    : 'bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Guides Grid Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Quick Presets Banner */}
          <div className={`p-3 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
            isDark ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-purple-50/70 border-purple-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Wand2 className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  {isSpanish ? 'Carga Rápida de Motores de Demostración' : 'Quick Demo Rocket Motor Presets'}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {isSpanish ? 'Inyecta al simulador configuraciones representativas y probadas para ver los resultados al instante:' : 'Inject representative, flight-tested motor configurations into the simulator to test right away:'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPresetMotor('bates_j');
                  onClose();
                }}
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
              >
                🚀 {isSpanish ? 'BATES J-Class (54mm)' : 'BATES J-Class (54mm)'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPresetMotor('star_k');
                  onClose();
                }}
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                ⭐ {isSpanish ? 'Estrella Neutra K-Class' : 'Neutral Star K-Class'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPresetMotor('apcp_l');
                  onClose();
                }}
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              >
                ⚡ {isSpanish ? 'APCP L-Class Militar' : 'APCP L-Class Military'}
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGuides.map((guide) => {
              const Icon = guide.icon;
              const completed = !!completedMap[guide.tourSequenceId];

              return (
                <div
                  key={guide.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all hover:shadow-lg relative group ${
                    isDark 
                      ? 'bg-slate-900/60 border-border hover:border-purple-500/50' 
                      : 'bg-white border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div>
                    {/* Card Header & Completion Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${guide.color} text-white shadow-sm shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground leading-snug">
                              {isSpanish ? guide.titleEs : guide.titleEn}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono font-semibold text-purple-400">
                              ⏱ {guide.estimatedMinutes} min
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                              {guide.difficulty}
                            </span>
                            {completed && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmarkSingle(guide.tourSequenceId);
                                }}
                                className="text-[10px] font-mono font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/40 flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title={isSpanish ? 'Haz clic para desmarcar esta guía' : 'Click to unmark this guide'}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>{isSpanish ? 'Completada ✓' : isFrench ? 'Complétée ✓' : isItalian ? 'Completata ✓' : 'Completed ✓'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {isSpanish ? guide.summaryEs : guide.summaryEn}
                    </p>

                    {/* Key Topics List */}
                    <ul className="mt-3 space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/40 text-[11px]">
                      {(isSpanish ? guide.bulletPointsEs : guide.bulletPointsEn).map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-foreground/80">
                          <CheckCircle2 className="w-3 h-3 text-purple-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    {guide.onApplyPreset && guide.presetLabelEs ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={guide.onApplyPreset}
                        className="h-8 text-[11px] text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 px-2 font-medium"
                      >
                        <Wand2 className="w-3 h-3 mr-1" />
                        {isSpanish ? guide.presetLabelEs : guide.presetLabelEn}
                      </Button>
                    ) : (
                      <span />
                    )}

                    <Button
                      size="sm"
                      onClick={() => {
                        onClose();
                        onStartTour(guide.tourSequenceId);
                      }}
                      className={`h-8 text-xs font-bold px-3 text-white gap-1.5 shadow-sm transition-all ${
                        completed
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                          : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {completed 
                        ? (isSpanish ? 'Repetir Tour' : isFrench ? 'Refaire le Tour' : isItalian ? 'Ripeti Tour' : 'Repeat Tour')
                        : (isSpanish ? 'Iniciar Tour en Pantalla' : isFrench ? 'Démarrer le Tour' : isItalian ? 'Avvia il Tour' : 'Start Screen Tour')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredGuides.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">
                {isSpanish ? 'No se encontraron guías para tu búsqueda.' : 'No guides match your search query.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer with Reset Progress Button */}
        <div className="p-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono">
              {isSpanish ? 'HERMES V2.1 • Manual Balístico Integrado' : 'HERMES V2.1 • Ballistic Integrated Manual'}
            </span>
            {showResetConfirm ? (
              <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 rounded-lg animate-fade-in">
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  {isSpanish ? '¿Reiniciar todas las guías?' : 'Reset all guides?'}
                </span>
                <Button
                  size="sm"
                  onClick={handleConfirmReset}
                  className="h-5 text-[10px] font-bold px-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                >
                  {isSpanish ? 'Sí, reiniciar' : 'Yes, reset'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowResetConfirm(false)}
                  className="h-5 text-[10px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </Button>
              </div>
            ) : resetSuccessMessage ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {isSpanish ? '¡Progreso reiniciado correctamente!' : 'Progress reset successfully!'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] text-muted-foreground hover:text-red-400 underline flex items-center gap-1 cursor-pointer font-mono transition-colors"
                title={isSpanish ? 'Borrar historial de guías completadas' : 'Clear completed tours history'}
              >
                <RotateCcw className="w-3 h-3" />
                {isSpanish ? 'Reiniciar progreso de guías' : 'Reset guide progress'}
              </button>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-7 text-xs"
          >
            {isSpanish ? 'Cerrar' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
}
