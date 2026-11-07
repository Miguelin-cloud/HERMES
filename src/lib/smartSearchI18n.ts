export type SmartSearchLang = 'es' | 'en' | 'fr' | 'it';

export const SMART_SEARCH_TRANSLATIONS = {
  header_title: {
    es: "HERMES SMART SEARCH v2.0.0",
    en: "HERMES SMART SEARCH v2.0.0",
    fr: "HERMES SMART SEARCH v2.0.0",
    it: "HERMES SMART SEARCH v2.0.0"
  },
  header_badge: {
    es: "Optimizador Balístico Inteligente",
    en: "Intelligent Ballistic Optimizer",
    fr: "Optimiseur Balistique Intelligent",
    it: "Ottimizzatore Balistico Intelligente"
  },
  header_subtitle: {
    es: "Búsqueda evolutiva de geometrías de grano óptimas para cámara y tobera existentes",
    en: "Evolutionary inverse optimization of propellant grain geometries for fixed chamber and nozzle",
    fr: "Optimisation inverse évolutive des géométries de grains pour chambre et tuyère fixes",
    it: "Ottimizzazione inversa evolutiva delle geometrie dei grani per camera e ugello fissi"
  },
  btn_algorithm_info: {
    es: "Algoritmo & Formulación",
    en: "Algorithm & Formulation",
    fr: "Algorithme & Formulation",
    it: "Algoritmo & Formulazione"
  },
  btn_close_guide: {
    es: "Cerrar Guía",
    en: "Close Guide",
    fr: "Fermer le Guide",
    it: "Chiudi Guida"
  },
  step_0_btn: {
    es: "Objetivo: Máx Altitud",
    en: "Goal: Max Altitude",
    fr: "Objectif : Altitude Max",
    it: "Obiettivo: Altitudine Max"
  },
  step_1_btn: {
    es: "Fase 1: Hardware",
    en: "Phase 1: Hardware",
    fr: "Phase 1 : Matériel",
    it: "Fase 1: Hardware"
  },
  step_2_btn: {
    es: "Fase 2: Granos",
    en: "Phase 2: Grains",
    fr: "Phase 2 : Grains",
    it: "Fase 2: Grani"
  },
  step_3_btn: {
    es: "Fase 3: Algoritmos",
    en: "Phase 3: Algorithms",
    fr: "Phase 3 : Algorithmes",
    it: "Fase 3: Algoritmi"
  },

  // Step 0 - Objective Inbox
  goal_inbox_title: {
    es: "Bandeja de Objetivos de Misión",
    en: "Mission Objectives Inbox",
    fr: "Boîte des Objectifs de Mission",
    it: "Casella degli Obiettivi di Missione"
  },
  goal_inbox_subtitle: {
    es: "Selecciona el objetivo propulsivo para iniciar la configuración de motor, restricciones de grano y algoritmos de optimización",
    en: "Select your propulsion mission goal to enter the hardware, grain constraints, and algorithm configuration flow",
    fr: "Sélectionnez votre objectif propulsif pour commencer la configuration du moteur, des grains et des algorithmes",
    it: "Seleziona l'obiettivo propulsivo per avviare la configurazione del motore, dei vincoli dei grani e degli algoritmi"
  },
  workflow_label: {
    es: "Flujo:",
    en: "Workflow:",
    fr: "Flux :",
    it: "Flusso:"
  },
  workflow_steps: {
    es: "Objetivo → Fase 1 → Fase 2 → Fase 3",
    en: "Goal → Phase 1 → Phase 2 → Phase 3",
    fr: "Objectif → Phase 1 → Phase 2 → Phase 3",
    it: "Obiettivo → Fase 1 → Fase 2 → Fase 3"
  },
  primary_goal_label: {
    es: "Objetivo Primario de Optimización",
    en: "Primary Optimization Objective",
    fr: "Objectif Principal d'Optimisation",
    it: "Obiettivo Primario di Ottimizzazione"
  },
  main_tray_tag: {
    es: "Bandeja Principal de Misión",
    en: "Main Mission Tray",
    fr: "Bac Principal de Mission",
    it: "Cassetto Principale di Missione"
  },
  active_tag: {
    es: "Activo",
    en: "Active",
    fr: "Actif",
    it: "Attivo"
  },
  max_altitude_title: {
    es: "Máxima Altitud / Mayor Impulso Total (It)",
    en: "Maximum Altitude / Peak Total Impulse (It)",
    fr: "Altitude Maximale / Impulsion Totale Maximale (It)",
    it: "Massima Altitudine / Massimo Impulso Totale (It)"
  },
  configure_phase1_btn: {
    es: "Configurar Motor y Tobera (Fase 1)",
    en: "Configure Motor & Nozzle (Phase 1)",
    fr: "Configurer Moteur et Tuyère (Phase 1)",
    it: "Configura Motore e Ugello (Fase 1)"
  },
  strict_selection_rule: {
    es: "Criterio de Selección Estricto:",
    en: "Strict Selection Criterion:",
    fr: "Critère de Sélection Strict :",
    it: "Criterio di Selezione Severo:"
  },
  strict_selection_formula: {
    es: "Mejor Solución = max I_total [sujeto a P_max ≤ P_límite]",
    en: "Best Solution = max I_total [subject to P_max ≤ P_limit]",
    fr: "Meilleure Solution = max I_total [sujet à P_max ≤ P_limite]",
    it: "Migliore Soluzione = max I_total [soggetto a P_max ≤ P_limite]"
  },
  strict_selection_desc: {
    es: "Maximiza estrictamente la energía propulsiva total acumulada obtenida de la integración temporal completa del empuje (I_total = ∫ F dt) devuelta por el simulador físico. No premia artificialmente geometrías por planitud ni ocupación de cámara si entregan menor impulso total. La selección global de granos (N) y cotas geométricas se rige por factibilidad de Deb.",
    en: "Strictly maximizes total propulsive energy from complete physical thrust time integration (I_total = ∫ F dt) returned by the simulator. Does not artificially favor flat thrust or packing volume if total impulse is lower. Global grain count (N) and dimensions are governed by Deb feasibility selection.",
    fr: "Maximise strictement l'énergie propulsive totale issue de l'intégration temporelle de la poussée (I_total = ∫ F dt) calculée par le simulateur. Ne favorise pas artificiellement la planéité si l'impulsion totale est moindre. Le nombre de grains (N) et les cotes obéissent aux règles de Deb.",
    it: "Massimizza rigorosamente l'energia propulsiva totale derivante dall'integrazione temporale della spinta (I_total = ∫ F dt) restituita dal simulatore. Non favorisce artificialmente la piattezza se l'impulso totale è inferiore. Il numero di grani (N) e le dimensioni seguono le regole di Deb."
  },

  // Algorithm Guide Modal
  guide_title: {
    es: "Guía Completa de Smart Search: Flujo de Misión, Algoritmos, Modus Operandi y Formulación",
    en: "Smart Search Complete Guide: Mission Workflow, Algorithms, Modus Operandi & Formulation",
    fr: "Guide Complet Smart Search : Flux de Mission, Algorithmes, Modus Operandi et Formulation",
    it: "Guida Completa Smart Search: Flusso di Missione, Algoritmi, Modus Operandi e Formulazione"
  },
  guide_sec1_title: {
    es: "1. Flujo Secuencial de Optimización (De Objetivo a Ejecución)",
    en: "1. Sequential Optimization Workflow (Goal to Execution)",
    fr: "1. Flux Séquentiel d'Optimisation (De l'Objectif à l'Exécution)",
    it: "1. Flusso Sequenziale di Ottimizzazione (Dall'Obiettivo all'Esecuzione)"
  },
  guide_sec2_title: {
    es: "2. Modos de Algoritmo de Búsqueda Evolutiva y su Modus Operandi",
    en: "2. Evolutionary Search Algorithm Modes & Modus Operandi",
    fr: "2. Modes d'Algorithme de Recherche Évolutive et leur Modus Operandi",
    it: "2. Modalità degli Algoritmi Evolutivi e loro Modus Operandi"
  },
  guide_sec3_title: {
    es: "3. Cancelación de Simulación en Vivo y Retorno de Resultados Parciales",
    en: "3. Live Simulation Cancellation & Partial Results Preservation",
    fr: "3. Annulation de Simulation en Direct et Résultats Partiels",
    it: "3. Annullamento della Simulazione dal Vivo e Risultati Parziali"
  },
  guide_sec4_title: {
    es: "4. Motor de Simulación Numérico 0D Intacto",
    en: "4. Untouched Exact Numerical 0D Solver",
    fr: "4. Moteur de Simulation Numérique 0D Intact",
    it: "4. Motore di Simulazione Numerica 0D Intatto"
  },
  guide_sec5_title: {
    es: "5. Reglas de Factibilidad de Deb (1998) y Selección Rígida",
    en: "5. Deb Feasibility Rules (1998) & Strict Selection",
    fr: "5. Règles de Faisabilité de Deb (1998) et Sélection Stricte",
    it: "5. Regole di Fattibilità di Deb (1998) e Selezione Rigida"
  },

  // Phase 1 - Hardware
  p1_title: {
    es: "Fase 1: Cotas Fijas de Carcasa, Tobera y Límite de Presión",
    en: "Phase 1: Fixed Casing Dimensions, Nozzle & Pressure Limit",
    fr: "Phase 1 : Dimensions du Boîtier, Tuyère et Limite de Pression",
    it: "Fase 1: Dimensioni della Cassa, Ugello e Limite di Pressione"
  },
  p1_subtitle: {
    es: "Define el hardware base existente sobre el cual optimizaremos la pila de granos",
    en: "Define the existing motor casing hardware for which optimal grain geometries will be searched",
    fr: "Définissez le matériel existant pour lequel nous optimiserons la géométrie des grains",
    it: "Definisci l'hardware esistente per il quale ottimizzeremo la geometria dei grani"
  },
  p1_chamber_card: {
    es: "Cámara de Combustión & Límites",
    en: "Combustion Chamber & Limits",
    fr: "Chambre de Combustion & Limites",
    it: "Camera di Combustione & Limiti"
  },
  p1_nozzle_card: {
    es: "Geometría de Tobera Fija",
    en: "Fixed Nozzle Geometry",
    fr: "Géométrie Fixe de la Tuyère",
    it: "Geometria Fissa dell'Ugello"
  },
  p1_propellant_card: {
    es: "Propelente Seleccionado",
    en: "Selected Propellant",
    fr: "Propergol Sélectionné",
    it: "Propellente Selezionato"
  },
  p1_next_btn: {
    es: "Continuar a Restricciones de Granos (Fase 2)",
    en: "Proceed to Grain Constraints (Phase 2)",
    fr: "Passer aux Contraintes des Grains (Phase 2)",
    it: "Procedi ai Vincoli dei Grani (Fase 2)"
  },
  p1_back_btn: {
    es: "Volver a Selección de Objetivo",
    en: "Back to Goal Selection",
    fr: "Retour à la Sélection de l'Objectif",
    it: "Torna alla Selezione dell'Obiettivo"
  },

  // Phase 2 - Grains
  p2_title: {
    es: "Fase 2: Geometría de Grano, Espacio Libre y Restricciones",
    en: "Phase 2: Grain Geometry, Variable Freedom & Constraints",
    fr: "Phase 2 : Géométrie des Grains, Liberté et Contraintes",
    it: "Fase 2: Geometria del Grano, Libertà e Vincoli"
  },
  p2_subtitle: {
    es: "Configura qué variables explora libremente el optimizador y cuáles deseas fijar o acotar",
    en: "Configure which geometric variables the optimizer explores freely and which ones are locked",
    fr: "Configurez les variables explorées librement par l'optimiseur et celles que vous souhaitez fixer",
    it: "Configura quali variabili l'ottimizzatore esplora liberamente e quali desideri bloccare"
  },
  p2_grain_shape: {
    es: "Geometría del Grano",
    en: "Grain Geometry",
    fr: "Géométrie du Grain",
    it: "Geometria del Grano"
  },
  p2_grain_count: {
    es: "Número de Segmentos de Grano (N)",
    en: "Grain Segment Count (N)",
    fr: "Nombre de Segments de Grain (N)",
    it: "Numero di Segmenti di Grano (N)"
  },
  p2_mode_free: {
    es: "Libre",
    en: "Free",
    fr: "Libre",
    it: "Libero"
  },
  p2_mode_range: {
    es: "Rango [Mín, Máx]",
    en: "Range [Min, Max]",
    fr: "Plage [Min, Max]",
    it: "Intervallo [Min, Max]"
  },
  p2_mode_fixed: {
    es: "Fijo",
    en: "Fixed",
    fr: "Fixe",
    it: "Fisso"
  },
  p2_next_btn: {
    es: "Continuar a Algoritmos y Ejecución (Fase 3)",
    en: "Proceed to Algorithms & Execution (Phase 3)",
    fr: "Passer aux Algorithmes et Exécution (Phase 3)",
    it: "Procedi agli Algoritmi ed Esecuzione (Fase 3)"
  },
  p2_back_btn: {
    es: "Volver a Hardware (Fase 1)",
    en: "Back to Hardware (Phase 1)",
    fr: "Retour au Matériel (Phase 1)",
    it: "Torna a Hardware (Fase 1)"
  },

  // Phase 3 - Algorithms
  p3_title: {
    es: "Fase 3: Selección de Algoritmo y Ejecución",
    en: "Phase 3: Algorithm Selection & Execution",
    fr: "Phase 3 : Sélection de l'Algorithme et Exécution",
    it: "Fase 3: Selezione dell'Algoritmo ed Esecuzione"
  },
  p3_subtitle: {
    es: "Elige la profundidad de búsqueda evolutiva e inicia el proceso de optimización balística",
    en: "Select evolutionary search depth budget and launch the inverse ballistic optimization",
    fr: "Choisissez le budget de recherche évolutive et lancez l'optimisation balistique inverse",
    it: "Scegli il budget di ricerca evolutiva e avvia l'ottimizzazione balistica inversa"
  },
  p3_btn_start: {
    es: "Iniciar Smart Search",
    en: "Start Smart Search",
    fr: "Démarrer Smart Search",
    it: "Avvia Smart Search"
  },
  p3_btn_cancel: {
    es: "Cancelar Simulación",
    en: "Cancel Simulation",
    fr: "Annuler la Simulation",
    it: "Annulla Simulazione"
  },
  p3_cancelling: {
    es: "Cancelando simulación y recopilando candidatos...",
    en: "Cancelling simulation and gathering evaluated candidates...",
    fr: "Annulation de la simulation et collecte des candidats...",
    it: "Annullamento della simulazione e raccolta dei candidati..."
  },
  p3_running: {
    es: "Simulación en curso...",
    en: "Simulation in progress...",
    fr: "Simulation en cours...",
    it: "Simulazione in corso..."
  },
  p3_back_btn: {
    es: "Volver a Granos (Fase 2)",
    en: "Back to Grains (Phase 2)",
    fr: "Retour aux Grains (Phase 2)",
    it: "Torna ai Grani (Fase 2)"
  },

  // Results & Candidates
  results_title: {
    es: "Resultados de la Búsqueda",
    en: "Optimization Search Results",
    fr: "Résultats de l'Optimisation",
    it: "Risultati dell'Ottimizzazione"
  },
  btn_apply_engine: {
    es: "Aplicar al Simulador",
    en: "Apply to Simulator",
    fr: "Appliquer au Simulateur",
    it: "Applica al Simulatore"
  },
  applied_success: {
    es: "¡Configuración cargada en el simulador principal!",
    en: "Configuration loaded into main simulator!",
    fr: "Configuration chargée dans le simulateur principal !",
    it: "Configurazione caricata nel simulatore principale!"
  },
  tab_curves: {
    es: "Curvas de Empuje y Presión",
    en: "Thrust & Pressure Curves",
    fr: "Courbes de Poussée et Pression",
    it: "Curve di Spinta e Pressione"
  },
  tab_scatter: {
    es: "Diagrama de Dispersión",
    en: "Scatter Diagram",
    fr: "Diagramme de Dispersion",
    it: "Diagramma di Dispersione"
  },
  tab_convergence: {
    es: "Historial de Convergencia",
    en: "Convergence History",
    fr: "Historique de Convergence",
    it: "Cronologia di Convergenza"
  },
  metric_it: {
    es: "Impulso Total (It)",
    en: "Total Impulse (It)",
    fr: "Impulsion Totale (It)",
    it: "Impulso Totale (It)"
  },
  metric_pmax: {
    es: "Presión Máxima (Pmax)",
    en: "Max Pressure (Pmax)",
    fr: "Pression Maximale (Pmax)",
    it: "Pressione Massima (Pmax)"
  },
  metric_tb: {
    es: "Tiempo de Quemado",
    en: "Burn Time",
    fr: "Temps de Combustion",
    it: "Tempo di Combustione"
  },
  metric_fmax: {
    es: "Empuje Máximo",
    en: "Max Thrust",
    fr: "Poussée Maximale",
    it: "Spinta Massima"
  },
  metric_fmed: {
    es: "Empuje Medio",
    en: "Avg Thrust",
    fr: "Poussée Moyenne",
    it: "Spinta Media"
  },
  metric_isp: {
    es: "Impulso Específico (Isp)",
    en: "Specific Impulse (Isp)",
    fr: "Impulsion Spécifique (Isp)",
    it: "Impulso Specifico (Isp)"
  },
  metric_mass: {
    es: "Masa de Propelente",
    en: "Propellant Mass",
    fr: "Masse de Propergol",
    it: "Massa del Propellente"
  },
  metric_apogee: {
    es: "Apogeo Estimado",
    en: "Estimated Apogee",
    fr: "Apogée Estimé",
    it: "Apogeo Stimato"
  }
};

export function getSmartSearchText(key: keyof typeof SMART_SEARCH_TRANSLATIONS, lang: string): string {
  const item = SMART_SEARCH_TRANSLATIONS[key];
  if (!item) return "";
  const validLang = (lang === 'es' || lang === 'en' || lang === 'fr' || lang === 'it') ? lang : 'en';
  return item[validLang] || item.en;
}


export const SMART_SEARCH_DICT: Record<string, { en: string; fr: string; it: string }> = {
  "Diámetro Interior Cámara (Dc)": {
    "en": "Chamber Inner Diameter (Dc)",
    "fr": "Diamètre intérieur chambre (Dc)",
    "it": "Diametro interno camera (Dc)"
  },
  "⚠️ Recomendación: define un diámetro válido (> 0 mm)": {
    "en": "⚠️ Recommendation: define a valid diameter (> 0 mm)",
    "fr": "⚠️ Recommandation : définissez un diamètre valide (> 0 mm)",
    "it": "⚠️ Raccomandazione: definisci un diametro valido (> 0 mm)"
  },
  "Diámetro interno disponible para el grano + liner": {
    "en": "Usable inner diameter for propellant & liner",
    "fr": "Diamètre intérieur utile pour propergol et liner",
    "it": "Diametro interno utile per propellente e liner"
  },
  "Longitud Útil Cámara (Lc)": {
    "en": "Chamber Usable Length (Lc)",
    "fr": "Longueur utile chambre (Lc)",
    "it": "Lunghezza utile camera (Lc)"
  },
  "⚠️ Recomendación: define una longitud válida (> 0 mm)": {
    "en": "⚠️ Recommendation: define a valid length (> 0 mm)",
    "fr": "⚠️ Recommandation : définissez une longueur valide (> 0 mm)",
    "it": "⚠️ Raccomandazione: definisci una lunghezza valida (> 0 mm)"
  },
  "Longitud entre cierres/tobera disponible para granos": {
    "en": "Usable length inside casing",
    "fr": "Longueur utile disponible pour les grains",
    "it": "Lunghezza utile disponibile per i grani"
  },
  "Presión Máxima Segura (Pmax)": {
    "en": "Max Safe Pressure Limit (Pmax)",
    "fr": "Limite de pression maximale admissible (Pmax)",
    "it": "Limite di pressione massima ammissibile (Pmax)"
  },
  "⚠️ Recomendación: define un límite de presión (ej: 6.0 MPa) para una simulación realista": {
    "en": "⚠️ Recommendation: define a pressure limit (e.g. 6.0 MPa) for realistic simulation",
    "fr": "⚠️ Recommandation : définissez une limite de pression (ex : 6.0 MPa) pour une simulation réaliste",
    "it": "⚠️ Raccomandazione: definisci un limite di pressione (es: 6.0 MPa) per una simulazione realistica"
  },
  "Límite estructural admisible para descartar sobrepresiones": {
    "en": "Maximum allowable MEOP / proof pressure threshold",
    "fr": "Pression maximale admissible pour rejeter les surpressions",
    "it": "Pressione massima ammissibile per escludere sovrappressioni"
  },
  "Tobera Fija Existente": {
    "en": "Fixed Nozzle Geometry",
    "fr": "Géométrie fixe de la tuyère",
    "it": "Geometria fissa dell'ugello"
  },
  "Garganta (Dt) [mm]": {
    "en": "Throat (Dt) [mm]",
    "fr": "Col (Dt) [mm]",
    "it": "Gola (Dt) [mm]"
  },
  "Salida (Ds) [mm]": {
    "en": "Exit (Ds) [mm]",
    "fr": "Sortie (Ds) [mm]",
    "it": "Uscita (Ds) [mm]"
  },
  "Ángulo (α) [°]": {
    "en": "Angle (α) [°]",
    "fr": "Angle (α) [°]",
    "it": "Angolo (α) [°]"
  },
  "Propelente a Utilizar": {
    "en": "Selected Propellant",
    "fr": "Propergol à utiliser",
    "it": "Propellente da utilizzare"
  },
  "Rendimientos y Entorno Operativo": {
    "en": "Efficiencies & Operating Environment",
    "fr": "Rendements et environnement opérationnel",
    "it": "Rendimenti e ambiente operativo"
  },
  "Rendimiento Cámara (ηc*)": {
    "en": "Chamber Efficiency (ηc*)",
    "fr": "Rendement de chambre (ηc*)",
    "it": "Rendimento di camera (ηc*)"
  },
  "Eficiencia de combustión (típico: 0.85 - 0.95)": {
    "en": "Combustion C* efficiency",
    "fr": "Efficacité de combustion C* (typique : 0.85 - 0.95)",
    "it": "Efficienza di combustione C* (tipica: 0.85 - 0.95)"
  },
  "Rendimiento Tobera (ηnoz)": {
    "en": "Nozzle Efficiency (ηnoz)",
    "fr": "Rendement de tuyère (ηnoz)",
    "it": "Rendimento dell'ugello (ηnoz)"
  },
  "Eficiencia de tobera / expansión (típico: 0.70 - 0.90)": {
    "en": "Nozzle thrust efficiency",
    "fr": "Efficacité de poussée de la tuyère (typique : 0.70 - 0.90)",
    "it": "Efficienza di spinta dell'ugello (tipica: 0.70 - 0.90)"
  },
  "Presión Ambiente (Pamb) [MPa]": {
    "en": "Ambient Pressure (Pamb) [MPa]",
    "fr": "Pression ambiante (Pamb) [MPa]",
    "it": "Pressione ambiente (Pamb) [MPa]"
  },
  "Nivel del mar: 0.101325 MPa (1 atm)": {
    "en": "Sea level pressure: 0.101325 MPa",
    "fr": "Niveau de la mer : 0.101325 MPa (1 atm)",
    "it": "Livello del mare: 0.101325 MPa (1 atm)"
  },
  "Volver a Bandeja de Objetivos": {
    "en": "Back to Goal Inbox",
    "fr": "Retour aux objectifs de mission",
    "it": "Torna alla casella degli obiettivi"
  },
  "Continuar a Fase 2: Granos": {
    "en": "Continue to Phase 2: Grains",
    "fr": "Continuer vers Phase 2 : Grains",
    "it": "Continua a Fase 2: Grani"
  },
  "Fase 2: Geometría y Restricción de Granos": {
    "en": "Phase 2: Grain Geometry & Constraints",
    "fr": "Phase 2 : Géométrie et contraintes des grains",
    "it": "Fase 2: Geometria e vincoli dei grani"
  },
  "Elige la forma del grano, caras activas de combustión y bloquea o libera dimensiones": {
    "en": "Select grain shape, active burn surfaces, and lock/unlock dimensions",
    "fr": "Choisissez la forme du grain, les surfaces actives et verrouillez/libérez les cotes",
    "it": "Scegli la forma del grano, le superfici attive e blocca/libera le dimensioni"
  },
  "Cámara:": {
    "en": "Chamber:",
    "fr": "Chambre :",
    "it": "Camera:"
  },
  "Geometría y Superficies": {
    "en": "Geometry & Surfaces",
    "fr": "Géométrie et surfaces",
    "it": "Geometria e superfici"
  },
  "Forma del Grano": {
    "en": "Grain Shape",
    "fr": "Forme du grain",
    "it": "Forma del grano"
  },
  "BATES Cilíndrico / Tubular": {
    "en": "Cylindrical / Tubular (BATES)",
    "fr": "Cylindrique / Tubulaire (BATES)",
    "it": "Cilindrico / Tubolare (BATES)"
  },
  "Forma Estrella (Progresivo / Regresivo)": {
    "en": "Star Core (Progressive / Regressive)",
    "fr": "Profil Étoile (Progressif / Régressif)",
    "it": "Profilo a Stella (Progressivo / Regressivo)"
  },
  "Grano Macizo (End-Burning / Varilla)": {
    "en": "Solid Grain (End-Burning / Rod)",
    "fr": "Grain Massif (Combustion en bout / Barre)",
    "it": "Grano Massiccio (Combustione di testata / Barra)"
  },
  "Superficies Activas de Combustión (1 = Arde, 0 = Inhibida)": {
    "en": "Active Burn Faces (1 = Burns, 0 = Inhibited)",
    "fr": "Surfaces de combustion actives (1 = Brûle, 0 = Inhibée)",
    "it": "Superfici di combustione attive (1 = Brucia, 0 = Inibita)"
  },
  "Superficie Exterior (Cilíndrica)": {
    "en": "Outer Surface (Cylindrical)",
    "fr": "Surface extérieure (Cylindrique)",
    "it": "Superficie esterna (Cilindrica)"
  },
  "Canal Central / Núcleo": {
    "en": "Central Core / Channel",
    "fr": "Canal central / Cœur",
    "it": "Canale centrale / Nucleo"
  },
  "Caras Extremas / Bases": {
    "en": "End Faces / Bases",
    "fr": "Faces d'extrémité / Bases",
    "it": "Facce terminali / Basi"
  },
  "Número de Segmentos de Grano (N)": {
    "en": "Grain Segment Count (N)",
    "fr": "Nombre de segments de grain (N)",
    "it": "Numero di segmenti di grano (N)"
  },
  "Exploración Rango Libre (1 a N)": {
    "en": "Free Range Sweep (1 to N)",
    "fr": "Balayage libre (1 à N)",
    "it": "Esplorazione libera (1 a N)"
  },
  "Número Fijo de Granos": {
    "en": "Fixed Grain Count",
    "fr": "Nombre fixe de grains",
    "it": "Numero fisso di grani"
  },
  "Segmentos Máximos (N_max)": {
    "en": "Max Segments (N_max)",
    "fr": "Segments maximums (N_max)",
    "it": "Segmenti massimi (N_max)"
  },
  "Segmentos Fijos (N)": {
    "en": "Fixed Segments (N)",
    "fr": "Segments fixes (N)",
    "it": "Segmenti fissi (N)"
  },
  "Diámetro Exterior del Grano (D0)": {
    "en": "Grain Outer Diameter (D0)",
    "fr": "Diamètre extérieur du grain (D0)",
    "it": "Diametro esterno del grano (D0)"
  },
  "Diámetro del Núcleo / Canal (d0)": {
    "en": "Core / Port Diameter (d0)",
    "fr": "Diamètre du canal / noyau (d0)",
    "it": "Diametro del canale / nucleo (d0)"
  },
  "Longitud Unitaria de Grano (L0)": {
    "en": "Single Grain Length (L0)",
    "fr": "Longueur unitaire du grain (L0)",
    "it": "Lunghezza unitaria del grain (L0)"
  },
  "Masa Total de Propelente": {
    "en": "Total Propellant Mass",
    "fr": "Masse totale de propergol",
    "it": "Massa totale del propellente"
  },
  "Libre (Algoritmo Explora)": {
    "en": "Free (Algorithm Sweeps)",
    "fr": "Libre (l'algorithme explore)",
    "it": "Libero (l'algoritmo esplora)"
  },
  "Valor Fijo Exacto": {
    "en": "Exact Fixed Value",
    "fr": "Valeur fixe exacte",
    "it": "Valore fisso esatto"
  },
  "Rango Personalizado [Mín, Máx]": {
    "en": "Custom Range [Min, Max]",
    "fr": "Plage personnalisée [Min, Max]",
    "it": "Intervallo personalizzato [Min, Max]"
  },
  "Volver a Hardware (Fase 1)": {
    "en": "Back to Hardware (Phase 1)",
    "fr": "Retour au matériel (Phase 1)",
    "it": "Torna all'hardware (Fase 1)"
  },
  "Continuar a Fase 3: Algoritmos": {
    "en": "Continue to Phase 3: Algorithms",
    "fr": "Continuer vers Phase 3 : Algorithmes",
    "it": "Continua a Fase 3: Algoritmi"
  },
  "Fase 3: Algoritmos Evolutivos y Ejecución de Búsqueda": {
    "en": "Phase 3: Evolutionary Algorithms & Search Execution",
    "fr": "Phase 3 : Algorithmes évolutifs et exécution de la recherche",
    "it": "Fase 3: Algoritmi evolutivi ed esecuzione della ricerca"
  },
  "Elige el algoritmo de optimización balística, ajusta el presupuesto de evaluaciones y lanza la búsqueda": {
    "en": "Select ballistic optimization algorithm, configure evaluation budget, and launch search",
    "fr": "Sélectionnez l'algorithme d'optimisation balistique, ajustez le budget d'évaluations et lancez la recherche",
    "it": "Seleziona l'algoritmo di ottimizzazione balistica, imposta il budget di valutazioni e avvia la ricerca"
  },
  "Algoritmo Seleccionado:": {
    "en": "Selected Algorithm:",
    "fr": "Algorithme sélectionné :",
    "it": "Algoritmo selezionato:"
  },
  "Presupuesto de Búsqueda": {
    "en": "Search Budget",
    "fr": "Budget de recherche",
    "it": "Budget di ricerca"
  },
  "Búsqueda Rápida": {
    "en": "Fast Search",
    "fr": "Recherche Rapide",
    "it": "Ricerca Rapida"
  },
  "Búsqueda Estándar (Recomendado)": {
    "en": "Standard Search (Recommended)",
    "fr": "Recherche Standard (Recommandé)",
    "it": "Ricerca Standard (Consigliato)"
  },
  "Búsqueda Profunda": {
    "en": "Deep Search",
    "fr": "Recherche Approfondie",
    "it": "Ricerca Approfondita"
  },
  "Iniciar Búsqueda Balística": {
    "en": "Launch Ballistic Search",
    "fr": "Lancer la Recherche Balistique",
    "it": "Avvia Ricerca Balistica"
  },
  "Cancelar Simulación": {
    "en": "Cancel Simulation",
    "fr": "Annuler la Simulation",
    "it": "Annulla Simulazione"
  },
  "Volver a Granos (Fase 2)": {
    "en": "Back to Grains (Phase 2)",
    "fr": "Retour aux grains (Phase 2)",
    "it": "Torna ai grani (Fase 2)"
  },
  "Volver a Restricciones de Granos (Fase 2)": {
    "en": "Back to Grain Constraints (Phase 2)",
    "fr": "Retour aux contraintes de grains (Phase 2)",
    "it": "Torna ai vincoli dei grani (Fase 2)"
  },
  "Configuración Óptima Encontrada": {
    "en": "Optimal Configuration Found",
    "fr": "Configuration optimale trouvée",
    "it": "Configurazione ottimale trovata"
  },
  "Cargar Configuración Óptima en Simulador": {
    "en": "Load Optimal Configuration into Simulator",
    "fr": "Appliquer la configuration optimale dans le simulateur",
    "it": "Carica configurazione ottimale nel simulatore"
  },
  "Exportar Candidatos CSV": {
    "en": "Export Candidates CSV",
    "fr": "Exporter les candidats en CSV",
    "it": "Esporta candidati CSV"
  },
  "Curvas de Empuje y Presión": {
    "en": "Thrust & Pressure Curves",
    "fr": "Courbes de poussée et pression",
    "it": "Curve di spinta e pressione"
  },
  "Diagrama de Dispersión": {
    "en": "Scatter Diagram",
    "fr": "Diagramme de dispersion",
    "it": "Diagramma di dispersione"
  },
  "Historial de Convergencia": {
    "en": "Convergence History",
    "fr": "Historique de convergence",
    "it": "Cronologia di convergenza"
  },
  "Impulso Total (It)": {
    "en": "Total Impulse (It)",
    "fr": "Impulsion Totale (It)",
    "it": "Impulso Totale (It)"
  },
  "Presión Máxima (Pmax)": {
    "en": "Max Pressure (Pmax)",
    "fr": "Pression Maximale (Pmax)",
    "it": "Pressione Massima (Pmax)"
  },
  "Tiempo de Quemado": {
    "en": "Burn Time",
    "fr": "Temps de combustion",
    "it": "Tempo di combustione"
  },
  "Apogeo Estimado": {
    "en": "Estimated Apogee",
    "fr": "Apogée estimé",
    "it": "Apogeo stimato"
  },
  "Masa Propelente": {
    "en": "Propellant Mass",
    "fr": "Masse de propergol",
    "it": "Massa propellente"
  },
  "Frontera de Pareto (Presión vs Impulso)": {
    "en": "Pareto Frontier (Pressure vs Impulse)",
    "fr": "Frontière de Pareto (Pression vs Impulsion)",
    "it": "Frontiera di Pareto (Pressione vs Impulso)"
  },
  "Comparativa de Candidatos Evaluados": {
    "en": "Evaluated Candidates Comparison",
    "fr": "Comparaison des candidats évalués",
    "it": "Confronto dei candidati valutati"
  },
  "Viable": {
    "en": "Feasible",
    "fr": "Faisable",
    "it": "Fattibile"
  },
  "Sobrepresión": {
    "en": "Overpressure",
    "fr": "Surpression",
    "it": "Sovrappressione"
  },
  "Candidatos Evaluados": {
    "en": "Evaluated Candidates",
    "fr": "Candidats évalués",
    "it": "Candidati valutati"
  },
  "Espacio de Búsqueda": {
    "en": "Search Space",
    "fr": "Espace de recherche",
    "it": "Spazio di ricerca"
  },
  "Métricas": {
    "en": "Metrics",
    "fr": "Métriques",
    "it": "Metriche"
  },
  "Detalles": {
    "en": "Details",
    "fr": "Détails",
    "it": "Dettagli"
  }
};

export function smartLoc(es: string, en: string, lang: string, fr?: string, it?: string): string {
  if (lang === 'es') return es;
  if (lang === 'fr') {
    if (fr) return fr;
    const entry = SMART_SEARCH_DICT[es] || SMART_SEARCH_DICT[en];
    if (entry && entry.fr) return entry.fr;
    return en;
  }
  if (lang === 'it') {
    if (it) return it;
    const entry = SMART_SEARCH_DICT[es] || SMART_SEARCH_DICT[en];
    if (entry && entry.it) return entry.it;
    return en;
  }
  return en;
}
