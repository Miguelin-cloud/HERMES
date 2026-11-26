import React, { useState, useMemo, useEffect } from 'react';
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
  Rocket,
  Cpu,
  HelpCircle,
  Wand2,
  Beaker,
  Activity,
  Download,
  FolderOpen,
  RotateCcw,
  Wind,
  GitCompare,
  Globe,
  AlertTriangle
} from 'lucide-react';
import {
  resetCompletedTours,
  unmarkSingleTour,
  COMPLETED_TOURS_STORAGE_KEY
} from './InteractiveTourOverlay';
import { Language } from '../lib/i18n';

export interface GuideDefinition {
  id: string;
  tourSequenceId: string;
  category:
    | 'beginner'
    | 'geometry'
    | 'nozzle'
    | 'propellant'
    | 'results'
    | 'flight'
    | 'optimizer'
    | 'export'
    | 'postprocess';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  requiresResults?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  titleEs: string;
  titleEn: string;
  titleFr: string;
  titleIt: string;
  summaryEs: string;
  summaryEn: string;
  summaryFr: string;
  summaryIt: string;
  bulletPointsEs: string[];
  bulletPointsEn: string[];
  bulletPointsFr: string[];
  bulletPointsIt: string[];
  presetLabelEs?: string;
  presetLabelEn?: string;
  presetLabelFr?: string;
  presetLabelIt?: string;
  onApplyPreset?: () => void;
}

interface GuideBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: (tourId: string, tourLang?: Language) => void;
  onApplyPresetMotor: (type: 'bates_j' | 'star_k' | 'apcp_l' | 'nozzle_opt') => void;
  lang: Language;
  onChangeGuideLang: (lang: Language) => void;
  hasResults?: boolean;
  theme: string;
}

const GUIDE_LANGUAGES: Array<{ code: Language; label: string; name: string }> = [
  { code: 'es', label: 'ESP', name: 'Español' },
  { code: 'en', label: 'ENG', name: 'English' },
  { code: 'fr', label: 'FRA', name: 'Français' },
  { code: 'it', label: 'ITA', name: 'Italiano' },
];

export function GuideBookModal({
  isOpen,
  onClose,
  onStartTour,
  onApplyPresetMotor,
  lang,
  onChangeGuideLang,
  hasResults = false,
}: GuideBookModalProps) {
  const loc = <T,>(es: T, en: T, fr: T, it: T): T => {
    if (lang === 'es') return es;
    if (lang === 'fr') return fr;
    if (lang === 'it') return it;
    return en;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  const refreshCompletedStatus = () => {
    try {
      const raw = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const map: Record<string, boolean> = {};
      list.forEach((id) => {
        map[id] = true;
      });
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

  const guides: GuideDefinition[] = useMemo(
    () => [
      {
        id: 'full_simulator_tour',
        tourSequenceId: 'tour_full',
        category: 'beginner',
        difficulty: 'basic',
        estimatedMinutes: 7,
        icon: Sparkles,
        titleEs: 'Tour General de HERMES (Simulate, Post-Process, Ajustes y .hrms)',
        titleEn: 'HERMES Complete Overview (Simulate, Post-Process, Settings & .hrms)',
        titleFr: 'Visite Générale de HERMES (Simulate, Post-Process, Paramètres & .hrms)',
        titleIt: 'Tour Generale di HERMES (Simulate, Post-Process, Impostazioni & .hrms)',
        summaryEs:
          'Recorrido completo por la arquitectura actual de la aplicación: acceso START, cambio entre Simulate y Post-Process, las 6 pestañas de simulación, Estudio, barra lateral de Ajustes, cabecera rápida (.hrms / Save) y módulos en desarrollo.',
        summaryEn:
          'Complete walkthrough of the current app architecture: START entry, Simulate vs Post-Process switch, all 6 simulation tabs, Study workspace, Settings sidebar, quick header (.hrms / Save), and upcoming modules.',
        summaryFr:
          'Visite complète de l’architecture actuelle : accès START, bascule Simulate / Post-Process, 6 onglets de simulation, Study, barre latérale Réglages, en-tête rapide (.hrms / Save) et modules à venir.',
        summaryIt:
          'Panoramica completa dell’architettura attuale: accesso START, cambio Simulate / Post-Process, 6 schede di simulazione, Study, barra laterale Impostazioni, intestazione rapida (.hrms / Save) e moduli futuri.',
        bulletPointsEs: [
          'Pantalla inicial (START) y selector superior Simulate / Post-Process para cambiar sin perder estado.',
          'Simulate: Inputs, Results, Detailed Analysis, Mission Control, Smart Search y Animations / 3D Flight.',
          'Post-Process: Estudio comparativo operativo y módulo Caracterización a y n (en desarrollo).',
          'Cabecera minimalista (Save, .hrms, Guía) y barra lateral (Biblioteca, Unidades, Tema, Idioma y Agente Jesús en desarrollo).'
        ],
        bulletPointsEn: [
          'Entry screen (START) and top Simulate / Post-Process switcher without losing state.',
          'Simulate: Inputs, Results, Detailed Analysis, Mission Control, Smart Search, and Animations / 3D Flight.',
          'Post-Process: active Study comparator and Characterization a & n module (in development).',
          'Minimal header (Save, .hrms, Guide) and Settings sidebar (Library, Units, Theme, Language & Agent Jesús in development).'
        ],
        bulletPointsFr: [
          'Écran d’accueil (START) et sélecteur Simulate / Post-Process sans perte de données.',
          'Simulate : Inputs, Results, Detailed Analysis, Mission Control, Smart Search et Animations / Vol 3D.',
          'Post-Process : module Study actif et Caractérisation a & n (en développement).',
          'En-tête épuré (Save, .hrms, Guide) et barre latérale (Bibliothèque, Unités, Thème, Langue et Agent Jesús en développement).'
        ],
        bulletPointsIt: [
          'Schermata iniziale (START) e selettore Simulate / Post-Process senza perdere lo stato.',
          'Simulate: Inputs, Results, Detailed Analysis, Mission Control, Smart Search e Animations / Volo 3D.',
          'Post-Process: modulo Study attivo e Caratterizzazione a e n (in sviluppo).',
          'Intestazione essenziale (Save, .hrms, Guida) e barra laterale (Libreria, Unità, Tema, Lingua e Agente Jesús in sviluppo).'
        ]
      },
      {
        id: 'grain_creation',
        tourSequenceId: 'tour_grains',
        category: 'geometry',
        difficulty: 'basic',
        estimatedMinutes: 4,
        icon: Layers,
        titleEs: 'Granos de Propelente (10 Geometrías + Estudio de Dibujo, rhorat y Validación)',
        titleEn: 'Propellant Grains (10 Geometries + Custom Sketch Studio, rhorat & Validation)',
        titleFr: 'Grains de Propergol (10 Géométries + Studio Dessin, rhorat & Validation)',
        titleIt: 'Grani di Propellente (10 Geometrie + Studio Disegno, rhorat e Validazione)',
        summaryEs:
          'Configura segmentos con "+ Nuevo Grano", domina las 9 formas paramétricas más la forma Personalizada dibujada (mano alzada suavizada, simetría radial, cortes secuenciales hueco/isla, guardado local por nombre), densidad rhorat, inhibición EXT/ENDS/INT y alertas.',
        summaryEn:
          'Configure segments with "+ New Grain", master all 9 parametric shapes plus Custom Drawn shapes (smoothed freehand, radial symmetry, sequential void/island cuts, named local library), rhorat, EXT/ENDS/INT inhibition, and validation.',
        summaryFr:
          'Configurez vos blocs avec "+ Nouveau Grain", maîtrisez les 9 formes paramétriques et la forme Personnalisée dessinée (main levée lissée, symétrie radiale, coupes séquentielles vide/îlot, bibliothèque locale nommée), rhorat et inhibition.',
        summaryIt:
          'Configura i blocchi con "+ Nuovo Grano", gestisci tutte le 9 geometrie parametriche più la forma Personalizzata disegnata (mano libera smussata, simmetria radiale, tagli sequenziali vuoto/isola, libreria locale per nome), rhorat e inibizione.',
        bulletPointsEs: [
          '9 geometrías paramétricas + 10ª forma Personalizada dibujada con selector por nombre y botón Dibujar/Editar.',
          'Estudio de Formas: mano alzada suavizada, polilínea, círculo, simetría 1×–12× y cortes secuenciales Hueco/Isla (incluso agujerear islas).',
          'Factor rhorat, dimensiones D₀, d₀, longitud L, bloques N e inhibición de caras EXT / ENDS / INT.',
          'Privacidad local: cada usuario guarda, nombra y borra sus formas solo en su navegador; se exportan si van dentro de un .hrms.'
        ],
        bulletPointsEn: [
          '9 parametric geometries + 10th Custom Drawn shape with named library dropdown and Draw/Edit button.',
          'Shape Studio: smoothed freehand, polyline, circle, 1×–12× symmetry, and sequential Void/Island cuts (even cutting inside islands).',
          'rhorat density factor, D₀, d₀, length L, segment count N, and EXT / ENDS / INT burning faces.',
          'Local privacy: saved shapes are named, deleted, and stored only in each user’s browser unless explicitly bundled inside a .hrms file.'
        ],
        bulletPointsFr: [
          '9 géométries paramétriques + 10e forme Personnalisée dessinée avec menu déroulant par nom et bouton Dessiner/Modifier.',
          'Studio de Formes : main levée lissée, polyligne, cercle, symétrie 1×–12× et découpes séquentielles Vide/Îlot.',
          'Facteur rhorat, cotes D₀, d₀, longueur L, blocs N et faces actives EXT / ENDS / INT.',
          'Confidentialité locale : vos formes nommées restent privées dans votre navigateur sauf export volontaire en .hrms.'
        ],
        bulletPointsIt: [
          '9 geometrie parametriche + 10ª forma Personalizzata disegnata con elenco per nome e pulsante Disegna/Modifica.',
          'Studio Forme: mano libera smussata, polilinea, cerchio, simmetria 1×–12× e tagli sequenziali Vuoto/Isola (anche dentro le isole).',
          'Fattore rhorat, quote D₀, d₀, lunghezza L, blocchi N e facce attive EXT / ENDS / INT.',
          'Privacy locale: le forme salvate con nome restano private nel proprio browser e si condividono solo nei pacchetti .hrms.'
        ],
        presetLabelEs: 'Cargar BATES 4x54mm',
        presetLabelEn: 'Load BATES 4x54mm',
        presetLabelFr: 'Charger BATES 4x54mm',
        presetLabelIt: 'Carica BATES 4x54mm',
        onApplyPreset: () => onApplyPresetMotor('bates_j')
      },
      {
        id: 'nozzle_and_chamber',
        tourSequenceId: 'tour_nozzle',
        category: 'nozzle',
        difficulty: 'intermediate',
        estimatedMinutes: 5,
        icon: Compass,
        titleEs: 'Cámara, Estructura (Lamé + Tornillos) y Tobera Laval',
        titleEn: 'Chamber, Structure (Lamé + Bolts) & De Laval Nozzle',
        titleFr: 'Chambre, Structure (Lamé + Boulons) & Tuyère Laval',
        titleIt: 'Camera, Struttura (Lamé + Bulloni) e Ugello Laval',
        summaryEs:
          'Dimensiona la cámara (Dc, Lc, G*, kv, ηc, dt, Pamb), calcula la presión admisible gobernante Padm (pared Lamé vs cortante/aplastamiento de tornillos radiales), liner, inhibidor, garganta Dt0, expansión Ds y 6 modelos de erosión/escoria.',
        summaryEn:
          'Size chamber (Dc, Lc, G*, kv, ηc, dt, Pamb), evaluate governing Padm (Lamé wall vs bolted closure shear/bearing/net-section), liner, inhibitor, throat Dt0, expansion Ds, and 6 erosion/slag models.',
        summaryFr:
          'Dimensionnez la chambre (Dc, Lc, G*, kv, ηc, dt, Pamb), calculez la Padm gouvernante (paroi Lamé vs boulons radiaux), liner, inhibiteur, col Dt0, divergence Ds et 6 modèles d’érosion/scories.',
        summaryIt:
          'Dimensiona la camera (Dc, Lc, G*, kv, ηc, dt, Pamb), valuta la Padm governante (parete Lamé vs bulloni radiali), liner, inibitore, gola Dt0, espansione Ds e 6 modelli di erosione/scorie.',
        bulletPointsEs: [
          'Cámara: Dc, Lc, erosividad (G*, kv), eficiencia de combustión ηc, paso dt y presión ambiente Pamb.',
          'Estructura: espesor, Aluminio 6082-T6 / Acero AISI 304 / personalizado, Factor de Seguridad y unión atornillada.',
          'Liner térmico, inhibidor radial de grano (2 mm), comprobación de holgura y sincronización de masa.',
          'Tobera: Dt0, Ds, semiángulo α, rendimiento ηnoz y 6 modelos dinámicos de erosión o escoria.'
        ],
        bulletPointsEn: [
          'Chamber: Dc, Lc, erosive burning (G*, kv), combustion efficiency ηc, dt step, and ambient Pamb.',
          'Structure: wall thickness, Al 6082-T6 / AISI 304 / custom, Safety Factor, and bolted closure check.',
          'Thermal liner, radial grain inhibitor (2 mm), fit clearance check, and motor mass sync.',
          'Nozzle: Dt0, Ds, half-angle α, efficiency ηnoz, and 6 dynamic throat erosion or slag models.'
        ],
        bulletPointsFr: [
          'Chambre : Dc, Lc, combustion érosive (G*, kv), rendement ηc, pas dt et pression ambiante Pamb.',
          'Structure : épaisseur, Al 6082-T6 / AISI 304 / personnalisé, Facteur de Sécurité et fermeture boulonnée.',
          'Liner thermique, inhibiteur radial (2 mm), contrôle du jeu et synchronisation de masse.',
          'Tuyère : Dt0, Ds, demi-angle α, rendement ηnoz et 6 modèles dynamiques d’érosion ou scories.'
        ],
        bulletPointsIt: [
          'Camera: Dc, Lc, combustione erosiva (G*, kv), efficienza ηc, passo dt e pressione ambiente Pamb.',
          'Struttura: spessore, Al 6082-T6 / AISI 304 / personalizzato, Fattore di Sicurezza e chiusura a bulloni.',
          'Liner termico, inibitore radiale (2 mm), controllo del gioco e sincronizzazione della massa.',
          'Ugello: Dt0, Ds, semiangolo α, efficienza ηnoz e 6 modelli dinamici di erosione o scorie.'
        ],
        presetLabelEs: 'Tobera Óptima 1 atm',
        presetLabelEn: 'Optimal 1 atm Nozzle',
        presetLabelFr: 'Tuyère Optimale 1 atm',
        presetLabelIt: 'Ugello Ottimale 1 atm',
        onApplyPreset: () => onApplyPresetMotor('nozzle_opt')
      },
      {
        id: 'propellants_chemistry',
        tourSequenceId: 'tour_propellants',
        category: 'propellant',
        difficulty: 'intermediate',
        estimatedMinutes: 4,
        icon: Flame,
        titleEs: 'Química, Saint-Robert (r = a·Pⁿ) y Equilibrio Saint-Venant',
        titleEn: 'Propellant Chemistry, Saint-Robert & Saint-Venant Equilibrium',
        titleFr: 'Chimie des Propergols, Saint-Robert & Saint-Venant',
        titleIt: 'Chimica, Saint-Robert e Equilibrio Saint-Venant',
        summaryEs:
          'Asigna propulsantes distintos por segmento, comprende los parámetros termoquímicos (ρ, T₀, γ, M, c*), el papel crítico de n < 1 en Saint-Robert y cómo la garganta sónica fija la presión de cámara.',
        summaryEn:
          'Assign distinct propellants per segment, understand thermochemical constants (ρ, T₀, γ, M, c*), why n < 1 is mandatory in Saint-Robert, and how choked nozzle flow sets chamber pressure.',
        summaryFr:
          'Assignez des propergols par bloc, comprenez les constantes thermochimiques (ρ, T₀, γ, M, c*), le rôle critique de n < 1 et l’équilibre par col sonique.',
        summaryIt:
          'Assegna propellenti per segmento, comprendi le costanti termochimiche (ρ, T₀, γ, M, c*), perché n < 1 è vitale in Saint-Robert e l’equilibrio in gola sonica.',
        bulletPointsEs: [
          'Asignación independiente de propulsante por bloque (estándar o de tu biblioteca local).',
          'Propiedades termoquímicas: densidad ρ, temperatura adiabática T₀, razón γ, masa molar M y c*.',
          'Ley de Vieille / Saint-Robert por tramos de presión y criterio de estabilidad balística (n < 1).',
          'Balance instantáneo entre gas generado por Ab y descarga sónica por At (Saint-Venant).'
        ],
        bulletPointsEn: [
          'Per-grain propellant assignment (built-in standard or custom library formulas).',
          'Thermochemical constants: density ρ, flame temperature T₀, gamma γ, molar mass M, and c*.',
          'Piecewise Saint-Robert / Vieille burn law and ballistic stability rule (n < 1).',
          'Instantaneous balance between mass generated across Ab and sonic discharge through At.'
        ],
        bulletPointsFr: [
          'Affectation du propergol par bloc (standard ou personnalisé depuis votre bibliothèque).',
          'Propriétés thermochimiques : densité ρ, température T₀, gamma γ, masse molaire M et c*.',
          'Loi de Saint-Robert par intervalles de pression et critère de stabilité (n < 1).',
          'Équilibre instantané entre gaz générés sur Ab et débit sonique au col At.'
        ],
        bulletPointsIt: [
          'Assegnazione indipendente per grano (propellenti standard o personalizzati in libreria).',
          'Proprietà termochimiche: densità ρ, temperatura T₀, gamma γ, massa molare M e c*.',
          'Legge di Saint-Robert a tratti di pressione e criterio di stabilità balistica (n < 1).',
          'Bilancio istantaneo tra gas generato su Ab e scarico sonico attraverso la gola At.'
        ],
        presetLabelEs: 'Cargar APCP K-Class',
        presetLabelEn: 'Load APCP K-Class',
        presetLabelFr: 'Charger APCP K-Class',
        presetLabelIt: 'Carica APCP K-Class',
        onApplyPreset: () => onApplyPresetMotor('apcp_l')
      },
      {
        id: 'create_custom_propellant',
        tourSequenceId: 'tour_create_propellant',
        category: 'propellant',
        difficulty: 'intermediate',
        estimatedMinutes: 4,
        icon: Beaker,
        titleEs: 'Gestor de Propulsantes Personalizados (Tabla r(P) por Tramos)',
        titleEn: 'Custom Propellant Manager (Piecewise r(P) Table)',
        titleFr: 'Gestionnaire de Propergols Personnalisés (Table r(P))',
        titleIt: 'Gestore Propellenti Personalizzati (Tabella r(P) a Tratti)',
        summaryEs:
          'Localiza el botón "Química de Propelente" en Inputs, explora o duplica fórmulas existentes, define ρ, T₀, γ, M, añade intervalos [Pmin–Pmax] con (a, n), revisa la curva r(P) en vivo y guárdalos en el navegador y en archivos .hrms.',
        summaryEn:
          'Locate "Propellant Chemistry" on Inputs, inspect or clone existing formulas, set ρ, T₀, γ, M, define piecewise [Pmin–Pmax] intervals with (a, n), inspect the live r(P) chart, and persist locally or inside .hrms files.',
        summaryFr:
          'Trouvez "Chimie Propergol" dans Inputs, clonez ou créez une formule, définissez ρ, T₀, γ, M, saisissez les intervalles [Pmin–Pmax], visualisez r(P) et sauvegardez localement ou en .hrms.',
        summaryIt:
          'Trova "Chimica Propellente" in Inputs, ispeziona o clona formule, imposta ρ, T₀, γ, M, definisci intervalli [Pmin–Pmax], controlla la curva r(P) e salva in locale o nei file .hrms.',
        bulletPointsEs: [
          'Acceso directo desde la cabecera Química de Propelente o desde cada bloque de grano.',
          'Creación desde cero o duplicación de formulaciones KNSU, KNDX, APCP y más.',
          'Tabla multipunto [Pmin–Pmax] con coeficientes a y exponentes n y gráfico r(P) en tiempo real.',
          'Guardado persistente en el navegador y exportación automática dentro del paquete .hrms.'
        ],
        bulletPointsEn: [
          'Direct launch from the Propellant Chemistry header button or individual grain cards.',
          'Create from scratch or clone built-in KNSU, KNDX, APCP, and composite formulas.',
          'Multi-interval [Pmin–Pmax] table for (a, n) paired with a real-time r(P) plot.',
          'Persistent browser storage plus automatic bundling inside exported .hrms projects.'
        ],
        bulletPointsFr: [
          'Accès direct depuis l’en-tête Chimie Propergol ou chaque carte de grain.',
          'Création complète ou duplication des formules KNSU, KNDX, APCP.',
          'Tableau multi-intervalles [Pmin–Pmax] (a, n) avec courbe r(P) en temps réel.',
          'Sauvegarde persistante dans le navigateur et inclusion automatique dans les fichiers .hrms.'
        ],
        bulletPointsIt: [
          'Accesso diretto dall’intestazione Chimica Propellente o dalle schede dei grani.',
          'Creazione da zero o clonazione di formule KNSU, KNDX ed APCP.',
          'Tabella multi-intervallo [Pmin–Pmax] (a, n) con grafico r(P) dal vivo.',
          'Salvataggio persistente nel browser e inclusione automatica nei progetti .hrms.'
        ]
      },
      {
        id: 'results_interpretation',
        tourSequenceId: 'tour_results',
        category: 'results',
        difficulty: 'basic',
        estimatedMinutes: 4,
        requiresResults: true,
        icon: LineChart,
        titleEs: 'Resultados Balísticos: Padm, P(t) y Empuje TTI vs Nakka',
        titleEn: 'Ballistic Results: Padm, P(t) & TTI vs Nakka Thrust',
        titleFr: 'Résultats Balistiques : Padm, P(t) & Poussée TTI vs Nakka',
        titleIt: 'Risultati Balistici: Padm, P(t) e Spinta TTI vs Nakka',
        summaryEs:
          'Interpreta la alerta de seguridad frente a Padm gobernante, las 10 métricas de rendimiento (It, Isp, Pmax, Fmax, clase Tripoli/NAR) y la diferencia física entre Empuje Nakka y Teoría de Toberas Ideales (TTI). Requiere pulsar SIMULAR antes.',
        summaryEn:
          'Read the governing Padm safety banner, all 10 ballistic metric cards (It, Isp, Pmax, Fmax, Tripoli/NAR class), and the difference between Nakka Thrust and Ideal Nozzle Theory (TTI). Requires clicking SIMULATE first.',
        summaryFr:
          'Analysez la bannière de sécurité Padm, les 10 cartes de métriques (It, Isp, Pmax, Fmax, classe) et la différence entre poussée Nakka et Théorie des Tuyères Idéales (TTI). Nécessite SIMULER d’abord.',
        summaryIt:
          'Interpreta il banner di sicurezza Padm, le 10 schede metriche (It, Isp, Pmax, Fmax, classe) e la differenza tra spinta Nakka e Teoria Ugelli Ideali (TTI). Richiede prima SIMULA.',
        bulletPointsEs: [
          'Banner Padm: compara Pmax con el límite más restrictivo entre pared Lamé y tornillos radiales.',
          '10 tarjetas resumen: Pmax, Pmedia, Fmax, Fmedia, It, Clase, Isp, tiempo de quemado/acción y masa.',
          'Gráfica P(t) con línea de seguridad y clasificación instantánea de sobrepresión.',
          'Gráfica F(t): alterna o superpone modelo Nakka y Teoría de Toberas Ideales (TTI).'
        ],
        bulletPointsEn: [
          'Padm safety banner: compares Pmax against the stricter limit between Lamé wall and radial bolts.',
          '10 summary cards: Pmax, Pavg, Fmax, Favg, Total Impulse, Motor Class, Isp, burn/action times & mass.',
          'Chamber pressure P(t) plot with structural limit overlay and safety assessment.',
          'Thrust F(t) plot comparing Nakka formulation against Ideal Nozzle Theory (TTI).'
        ],
        bulletPointsFr: [
          'Bannière Padm : compare Pmax à la limite la plus stricte entre paroi Lamé et boulons radiaux.',
          '10 cartes clés : Pmax, Pmoy, Fmax, Fmoy, Impulsion Totale, Classe, Isp, temps et masse.',
          'Courbe de pression P(t) avec seuil structural admissible et diagnostic.',
          'Courbe de poussée F(t) comparant Nakka et la Théorie des Tuyères Idéales (TTI).'
        ],
        bulletPointsIt: [
          'Banner Padm: confronta Pmax col limite più severo tra parete Lamé e bulloni radiali.',
          '10 schede metriche: Pmax, Pmedia, Fmax, Fmedia, Impulso Totale, Classe, Isp, tempi e massa.',
          'Grafico pressione P(t) con soglia strutturale ammissibile e valutazione sicurezza.',
          'Grafico spinta F(t) a confronto tra modello Nakka e Teoria degli Ugelli Ideali (TTI).'
        ]
      },
      {
        id: 'detailed_analysis_guide',
        tourSequenceId: 'tour_analysis',
        category: 'results',
        difficulty: 'intermediate',
        estimatedMinutes: 4,
        requiresResults: true,
        icon: Activity,
        titleEs: 'Análisis Detallado: Áreas, Kn, Tasa r(t) y Flujos M*',
        titleEn: 'Detailed Analysis: Burn Areas, Kn, Burn Rate & Mass Flux',
        titleFr: 'Analyse Détaillée : Surfaces, Kn, Vitesse r(t) & Débits M*',
        titleIt: 'Analisi Dettagliata: Aree, Kn, Velocità r(t) e Flussi M*',
        summaryEs:
          'Explora las 4 sub-pestañas de balística interna dentro de Detailed Analysis: evolución de áreas por grano, ratio de Klemmung Kn, tasa de quemado base vs erosiva y flujos másicos/Mach en el puerto. Requiere pulsar SIMULAR antes.',
        summaryEn:
          'Explore all 4 internal ballistics sub-tabs in Detailed Analysis: per-grain burn area decomposition, Kn Klemmung ratio, base vs erosive burn rate, and port mass flux/Mach numbers. Requires SIMULATE first.',
        summaryFr:
          'Explorez les 4 sous-onglets de balistique interne : surfaces par bloc, ratio Kn, vitesse de combustion de base vs érosive et flux massiques/Mach. Nécessite SIMULER d’abord.',
        summaryIt:
          'Esplora le 4 sotto-schede di balistica interna: scomposizione aree per grano, rapporto Kn, velocità di combustione base vs erosiva e flussi massici/Mach. Richiede SIMULA prima.',
        bulletPointsEs: [
          'Sub-pestaña Áreas de Quemado: contribución individual de cada grano y progresividad/regresividad.',
          'Sub-pestaña Ratio Kn: relación Ab / At instantánea para evitar apagados o picos peligrosos.',
          'Sub-pestaña Tasa de Quemado: separación entre r₀(P) Saint-Robert y aumento erosivo Lenoir-Robillard.',
          'Sub-pestaña Flujos Másicos + Teoría: G, velocidad de gases, Mach en puerto y fórmulas matemáticas.'
        ],
        bulletPointsEn: [
          'Burn Areas sub-tab: individual grain contribution and progressive/neutral/regressive behavior.',
          'Kn Ratio sub-tab: instantaneous Ab / At profile to prevent chuffing or overpressure.',
          'Burn Rate sub-tab: breakdown of base Saint-Robert r₀(P) vs erosive augmentation.',
          'Mass Flow sub-tab + Theory modal: mass flux G, port Mach number, and governing equations.'
        ],
        bulletPointsFr: [
          'Sous-onglet Surfaces : contribution par bloc et profil progressif/neutre/régressif.',
          'Sous-onglet Ratio Kn : profil Ab / At instantané pour prévenir extinctions ou surpressions.',
          'Sous-onglet Vitesse r(t) : part de Saint-Robert r₀(P) et contribution érosive.',
          'Sous-onglet Débits + Théorie : flux massique G, Mach interne et équations du modèle.'
        ],
        bulletPointsIt: [
          'Sotto-scheda Aree: contributo per grano e andamento progressivo/neutro/regressivo.',
          'Sotto-scheda Rapporto Kn: andamento Ab / At per prevenire spegnimenti o sovrapressioni.',
          'Sotto-scheda Velocità r(t): separazione tra Saint-Robert r₀(P) e incremento erosivo.',
          'Sotto-scheda Flussi + Teoria: flusso massico G, Mach interno ed equazioni del modello.'
        ]
      },
      {
        id: 'mission_control_flight',
        tourSequenceId: 'tour_mission_control',
        category: 'flight',
        difficulty: 'intermediate',
        estimatedMinutes: 5,
        icon: Rocket,
        titleEs: 'Mission Control: Riel, Viento, Recuperación, Mach vs Cd y Banco',
        titleEn: 'Mission Control: Rail, Wind, Recovery, Mach-Cd & Test Stand',
        titleFr: 'Mission Control : Rampe, Vent, Récupération, Mach-Cd & Banc',
        titleIt: 'Mission Control: Rampa, Vento, Recupero, Mach-Cd e Banco',
        summaryEs:
          'Simula el vuelo completo: masa, altitud, longitud de riel, viento, ángulo de lanzamiento, modo de recuperación (solo ascenso, paracaídas principal o drogue + principal), polar Mach vs Cd y comparación con ensayos estáticos.',
        summaryEn:
          'Simulate full trajectory: rocket mass, site elevation, rail length, wind, launch tilt, recovery modes (ascent only, main only, drogue + main), Mach vs Cd drag polar, and static test-stand data import.',
        summaryFr:
          'Simulez le vol complet : masse, altitude, longueur de rampe, vent, inclinaison, récupération (montée seule, parachute principal, drogue + principal), polaire Mach-Cd et import de banc statique.',
        summaryIt:
          'Simula il volo completo: massa, quota di lancio, lunghezza rampa, vento, inclinazione, recupero (solo salita, principale, drogue + principale), polare Mach-Cd e importazione da banco prova.',
        bulletPointsEs: [
          'Parámetros de cohete y riel: masa en seco, diámetro, elevación, longitud de riel, viento e inclinación (0–90°).',
          'Recuperación: Solo Ascenso, Paracaídas Principal o Drogue + Principal con cotas y coeficientes Cd.',
          'Aerodinámica Mach vs Cd: modelo integrado, plantilla CSV descargable o curva personalizada.',
          'Banco de pruebas estático: importación CSV/XLSX con unidades, puesta a cero (Zero) manual y comparativa.'
        ],
        bulletPointsEn: [
          'Vehicle & launch rail: dry mass, diameter, elevation, rail length, wind speed, and launch tilt (0–90°).',
          'Recovery system: Ascent Only, Main Only, or Drogue + Main with deployment altitudes and Cd.',
          'Aerodynamics Mach vs Cd: built-in polar, CSV template download, or custom pasted table.',
          'Static test stand: CSV/XLSX import with unit mapping, manual zero tare, and overlay comparison.'
        ],
        bulletPointsFr: [
          'Véhicule et rampe : masse à sec, diamètre, altitude, longueur de rampe, vent et angle de tir (0–90°).',
          'Récupération : Montée seule, Principal seul ou Drogue + Principal avec altitudes et Cd.',
          'Aérodynamique Mach vs Cd : polaire standard, modèle CSV téléchargeable ou table personnalisée.',
          'Banc d’essai statique : import CSV/XLSX avec unités, mise à zéro manuelle et comparaison.'
        ],
        bulletPointsIt: [
          'Veicolo e rampa: massa a secco, diametro, quota, lunghezza rampa, vento e angolo di lancio (0–90°).',
          'Recupero: Solo Salita, Solo Principale o Drogue + Principale con quote di apertura e Cd.',
          'Aerodinamica Mach vs Cd: polare integrata, modello CSV scaricabile o tabella personalizzata.',
          'Banco prova statico: import CSV/XLSX con unità, azzeramento manuale (Zero) e confronto.'
        ]
      },
      {
        id: 'smart_search_optimization',
        tourSequenceId: 'tour_smart_search',
        category: 'optimizer',
        difficulty: 'advanced',
        estimatedMinutes: 5,
        icon: Cpu,
        titleEs: 'Smart Search: Optimización Inversa (LHS + DE/rand/1/bin)',
        titleEn: 'Smart Search: Inverse Optimization (LHS + DE/rand/1/bin)',
        titleFr: 'Smart Search : Optimisation Inverse (LHS + DE/rand/1/bin)',
        titleIt: 'Smart Search: Ottimizzazione Inversa (LHS + DE/rand/1/bin)',
        summaryEs:
          'Define la meta de diseño en el Paso 0, fija límites mecánicos y presión segura (Fase 1), acota geometrías de grano (Fase 2), ajusta algoritmo LHS + Differential Evolution (Fase 3) y aplica la solución ganadora en 1 clic.',
        summaryEn:
          'Choose your motor goal in Step 0, enforce casing and safe pressure bounds (Phase 1), constrain grain geometries (Phase 2), tune LHS + Differential Evolution (Phase 3), and apply the winner in 1 click.',
        summaryFr:
          'Définissez l’objectif (Étape 0), les limites mécaniques (Phase 1), les géométries de grains (Phase 2), réglez LHS + Differential Evolution (Phase 3) et appliquez le meilleur moteur en 1 clic.',
        summaryIt:
          'Imposta l’obiettivo (Passo 0), i vincoli di camera e pressione (Fase 1), le geometrie dei grani (Fase 2), regola LHS + Differential Evolution (Fase 3) e applica la soluzione migliore in 1 clic.',
        bulletPointsEs: [
          'Paso 0 y Fase 1: objetivo (máximo It, despegue rápido o impulso objetivo) y límites de cámara/tobera/Pmax.',
          'Fase 2: tipo de grano, rango de segmentos N y bloqueo o libertad por variable geométrica.',
          'Fase 3: selector de estrategia (objetivo + penalización por presión/tobera) y presupuesto de evaluaciones.',
          'Ejecución en vivo con cancelación segura, ranking multi-candidato y botón Aplicar al Simulador.'
        ],
        bulletPointsEn: [
          'Step 0 & Phase 1: mission goal (max It, fast liftoff, or target impulse) and casing/nozzle/Pmax limits.',
          'Phase 2: grain shape, segment count range N, and locked vs free geometric bounds.',
          'Phase 3: objective formulation, Deb constraint penalties, and evaluation budget.',
          'Live progress with cancel button, top candidate ranking, and 1-click Apply to Simulator.'
        ],
        bulletPointsFr: [
          'Étape 0 & Phase 1 : objectif (It max, décollage rapide ou cible) et limites chambre/tuyère/Pmax.',
          'Phase 2 : forme du grain, plage de blocs N et variables géométriques figées ou libres.',
          'Phase 3 : formulation de pénalité (Deb) et budget d’évaluations LHS + DE.',
          'Exécution en direct avec annulation, classement des candidats et application en 1 clic.'
        ],
        bulletPointsIt: [
          'Passo 0 e Fase 1: obiettivo (It max, spinta iniziale o target) e limiti di camera/ugello/Pmax.',
          'Fase 2: forma del grano, intervallo blocchi N e variabili geometriche bloccate o libere.',
          'Fase 3: formulazione dei vincoli (Deb) e budget di valutazioni LHS + DE.',
          'Esecuzione dal vivo con annullamento, classifica candidati e applicazione in 1 clic.'
        ]
      },
      {
        id: 'cfd_and_3d_flight',
        tourSequenceId: 'tour_cfd',
        category: 'results',
        difficulty: 'intermediate',
        estimatedMinutes: 3,
        requiresResults: true,
        icon: Wind,
        titleEs: 'Animaciones: Tobera CFD 2D, Burnback y Vuelo 3D',
        titleEn: 'Animations: 2D Nozzle CFD, Burnback & 3D Flight Viewer',
        titleFr: 'Animations : Tuyère CFD 2D, Burnback & Vol 3D',
        titleIt: 'Animazioni: Ugello CFD 2D, Burnback e Volo 3D',
        summaryEs:
          'Visualiza de forma sincronizada el flujo supersónico en la tobera (Mach, presión, temperatura, diamantes de choque), el retroceso geométrico del grano y la trayectoria 3D del cohete. Requiere pulsar SIMULAR antes.',
        summaryEn:
          'Synchronized visualization of supersonic nozzle flow (Mach, pressure, temperature, shock diamonds), propellant grain burnback regression, and 3D rocket flight trajectory. Requires SIMULATE first.',
        summaryFr:
          'Visualisation synchronisée de l’écoulement supersonique en tuyère (Mach, pression, température, ondes de choc), de la régression du grain et du vol 3D. Nécessite SIMULER d’abord.',
        summaryIt:
          'Visualizzazione sincronizzata del flusso supersonico nell’ugello (Mach, pressione, temperatura, diamanti d’urto), regressione del grano e traiettoria 3D. Richiede SIMULA prima.',
        bulletPointsEs: [
          'Reproductor unificado Play/Pause, línea de tiempo y control de velocidad para recorrer toda la combustión.',
          'Tobera CFD 2D: mapas de campo (Mach, P, T), régimen sobreexpandido/adaptado/subexpandido y pluma.',
          'Burnback sincrónico: desgaste progresivo de la sección transversal del grano en el mismo instante t.',
          'Visor 3D de Vuelo: vista interactiva del lanzamiento siguiendo la trayectoria calculada en Mission Control.'
        ],
        bulletPointsEn: [
          'Unified Play/Pause scrubber and speed controls across the full motor action time.',
          '2D Nozzle CFD: field colormaps (Mach, P, T), over/adapted/under-expanded regimes, and exhaust plume.',
          'Synchronized burnback: progressive propellant cross-section regression at matching time t.',
          '3D Flight Viewer: interactive 3D trajectory playback driven by Mission Control flight physics.'
        ],
        bulletPointsFr: [
          'Lecteur unifié Lecture/Pause, curseur temporel et vitesse de lecture sur toute la combustion.',
          'Tuyère CFD 2D : champs (Mach, P, T), régimes sur/sous-détendus et panache de sortie.',
          'Burnback synchronisé : régression progressive de la coupe du grain à l’instant t.',
          'Visionneuse Vol 3D : lecture 3D interactive de la trajectoire calculée dans Mission Control.'
        ],
        bulletPointsIt: [
          'Player unificato Play/Pausa, timeline e velocità lungo tutto il tempo di azione.',
          'Ugello CFD 2D: mappe di campo (Mach, P, T), regime sovra/sotto-espanso e pennacchio.',
          'Burnback sincronizzato: regressione progressiva della sezione del grano all’istante t.',
          'Visore Volo 3D: riproduzione 3D interattiva della traiettoria calcolata in Mission Control.'
        ]
      },
      {
        id: 'save_library_hrms',
        tourSequenceId: 'tour_save',
        category: 'export',
        difficulty: 'basic',
        estimatedMinutes: 4,
        icon: FolderOpen,
        titleEs: 'Guardar, Biblioteca Organizada y Paquetes .hrms',
        titleEn: 'Save, Organized Library & .hrms Project Packages',
        titleFr: 'Sauvegarde, Bibliothèque & Fichiers .hrms',
        titleIt: 'Salvataggio, Libreria Organizzata e File .hrms',
        summaryEs:
          'Guarda proyectos desde la cabecera con carpetas y detector de sobrescritura, importa/exporta archivos .hrms en 1 clic (incluyendo propulsantes y formas de grano personalizadas) y gestiona tu Biblioteca desde la barra lateral.',
        summaryEn:
          'Save projects from the header with folders and overwrite detection, import/export .hrms packages in 1 click (including custom propellants and custom grain shapes), and organize your Library from the sidebar.',
        summaryFr:
          'Enregistrez depuis l’en-tête avec dossiers et détection d’écrasement, importez/exportez des paquets .hrms (propergols et formes de grain inclus) et gérez la Bibliothèque depuis la barre latérale.',
        summaryIt:
          'Salva dall’intestazione con cartelle e rilevamento sovrascritture, importa/esporta pacchetti .hrms in 1 clic (inclusi propellenti e forme personalizzate) e gestisci la Libreria dalla barra laterale.',
        bulletPointsEs: [
          'Botón Save en cabecera: selector visual de carpetas existentes, vista previa de métricas y aviso de sobrescritura.',
          'Botón .hrms en cabecera: descarga portátil completa o importación directa a Simulate o Biblioteca.',
          'Biblioteca en barra lateral (Settings): búsqueda, filtro por carpeta, mover de carpeta y borrar.',
          'Reutilización directa: botón "Abrir en Simulate" o "Añadir a Study" desde cualquier simulación guardada.'
        ],
        bulletPointsEn: [
          'Header Save button: visual folder picker, motor summary preview, and overwrite safeguard.',
          'Header .hrms button: portable project export or direct import into Simulate or Library.',
          'Sidebar Library (Settings): search bar, folder filter, move between folders, and delete.',
          'Direct reuse: open any archived project in Simulate or send it straight into Study.'
        ],
        bulletPointsFr: [
          'Bouton Save : sélecteur visuel de dossiers, aperçu des métriques et protection contre l’écrasement.',
          'Bouton .hrms : export portable complet ou import direct dans Simulate ou la Bibliothèque.',
          'Bibliothèque en barre latérale : recherche, filtre par dossier, déplacement et suppression.',
          'Réutilisation directe : rouvrir dans Simulate ou envoyer vers Study en 1 clic.'
        ],
        bulletPointsIt: [
          'Pulsante Save: selettore visivo delle cartelle, anteprima metriche e protezione da sovrascrittura.',
          'Pulsante .hrms: esportazione portatile completa o importazione diretta in Simulate o Libreria.',
          'Libreria nella barra laterale: ricerca, filtro per cartella, spostamento ed eliminazione.',
          'Riutilizzo diretto: apri qualsiasi progetto in Simulate o invialo subito in Study.'
        ]
      },
      {
        id: 'data_export_and_library',
        tourSequenceId: 'tour_export',
        category: 'export',
        difficulty: 'basic',
        estimatedMinutes: 3,
        requiresResults: true,
        icon: Download,
        titleEs: 'Exportación Numérica: CSV, Excel (Filas/Columnas) y PDF Técnico',
        titleEn: 'Data Export: CSV, Excel (Rows/Columns) & Technical PDF',
        titleFr: 'Exportation : CSV, Excel (Lignes/Colonnes) & PDF Technique',
        titleIt: 'Esportazione: CSV, Excel (Righe/Colonne) e PDF Tecnico',
        summaryEs:
          'Exporta series temporales y métricas de rendimiento en CSV, hoja Excel (.xlsx) configurable por columnas verticales u filas horizontales, o genera un Informe Técnico PDF con gráficas y vuelo opcional. Requiere pulsar SIMULAR antes.',
        summaryEn:
          'Export ballistic time series and performance metrics as CSV, Excel (.xlsx) in Vertical Columns or Horizontal Rows orientation, or generate a full Technical PDF Report. Requires SIMULATE first.',
        summaryFr:
          'Exportez séries temporelles et métriques en CSV, Excel (.xlsx) orientable en Colonnes ou Lignes, ou générez un Rapport Technique PDF complet. Nécessite SIMULER d’abord.',
        summaryIt:
          'Esporta serie temporali e metriche in CSV, Excel (.xlsx) in orientamento Colonne o Righe, oppure genera un Report Tecnico PDF completo. Richiede SIMULA prima.',
        bulletPointsEs: [
          'CSV con todas las series temporales del motor (t, P, F_Nakka, F_TTI, Kn, flujo másico).',
          'Excel (.xlsx) con dos pestañas y selector de orientación: Vertical por Columnas u Horizontal por Filas.',
          'Informe PDF Técnico configurable: incluye geometría, estructura, resultados y sección de vuelo.',
          'Compatibilidad directa con MATLAB, Python, Excel y hojas de análisis en banco.'
        ],
        bulletPointsEn: [
          'CSV export containing full time-series arrays (t, P, F_Nakka, F_TTI, Kn, mass flow).',
          'Multi-sheet Excel (.xlsx) with Vertical Columns or Horizontal Rows layout selector.',
          'Configurable Technical PDF Report covering geometry, casing safety, curves, and optional flight.',
          'Ready for MATLAB, Python, Excel, and static test-stand post-processing.'
        ],
        bulletPointsFr: [
          'Export CSV contenant toutes les séries temporelles (t, P, F_Nakka, F_TTI, Kn, débit massique).',
          'Excel (.xlsx) multi-feuilles avec choix d’orientation Colonnes Verticales ou Lignes Horizontales.',
          'Rapport Technique PDF configurable : géométrie, structure, courbes et section vol optionnelle.',
          'Compatible directement avec MATLAB, Python, Excel et vos outils d’analyse.'
        ],
        bulletPointsIt: [
          'Esportazione CSV con tutte le serie temporali (t, P, F_Nakka, F_TTI, Kn, flusso massico).',
          'Excel (.xlsx) multi-foglio con scelta orientamento Colonne Verticali o Righe Orizzontali.',
          'Report Tecnico PDF configurabile con geometria, sicurezza camera, curve e volo opzionale.',
          'Compatibile direttamente con MATLAB, Python, Excel e fogli di post-analisi.'
        ]
      },
      {
        id: 'study_postprocess_guide',
        tourSequenceId: 'tour_study',
        category: 'postprocess',
        difficulty: 'intermediate',
        estimatedMinutes: 5,
        icon: GitCompare,
        titleEs: 'Post-Process → Study: Comparador Multi-Simulación y Banco',
        titleEn: 'Post-Process → Study: Multi-Simulation & Bench Comparator',
        titleFr: 'Post-Process → Study : Comparateur Multi-Simulations & Banc',
        titleIt: 'Post-Process → Study: Confronto Multi-Simulazione e Banco',
        summaryEs:
          'Compara simultáneamente simulaciones activas, proyectos de Biblioteca, múltiples archivos .hrms y ensayos reales de banco (CSV/XLSX), con alineación Δt, t₀ automático, tara manual Y (Raw/Tare), referencia ★ y PDF comparativo.',
        summaryEn:
          'Compare active simulations, Library entries, multiple .hrms packages, and real static test-stand CSV/XLSX logs simultaneously, featuring Δt shift, t₀ auto-zero, manual Y tare (Raw/Tare), ★ reference, and comparative PDF.',
        summaryFr:
          'Comparez simulation active, Bibliothèque, plusieurs fichiers .hrms et essais au banc (CSV/XLSX) avec décalage Δt, t₀ auto, tare manuelle Y (Raw/Tare), référence ★ et PDF comparatif.',
        summaryIt:
          'Confronta simulazione attiva, Libreria, più file .hrms e test reali su banco (CSV/XLSX) con sfasamento Δt, t₀ automatico, tara manuale Y (Raw/Tare), riferimento ★ e PDF comparativo.',
        bulletPointsEs: [
          'Barra superior de Estudio: selector bar/MPa, modelo TTI/Nakka, guardar/cargar Estudio JSON y PDF comparativo.',
          '4 fuentes de carga: Simulación Activa, Biblioteca local, subida múltiple de .hrms y ensayos de banco (CSV/XLSX).',
          'Control por serie: estrella ★ de referencia, edición Δt, t₀ automático y botón manual Tara Y / Datos Crudos.',
          'Gráficas superpuestas F(t), P(t) y tabla cuantitativa con diferencias porcentuales Δ% frente a la referencia.'
        ],
        bulletPointsEn: [
          'Study toolbar: bar/MPa units, TTI/Nakka model toggle, Save/Load Study JSON, and comparative PDF export.',
          '4 data sources: Active Simulation, Local Library, multi-file .hrms upload, and bench CSV/XLSX import.',
          'Per-series alignment: ★ baseline star, editable Δt offset, t₀ auto-zero, and manual Tare Y / Raw Data toggle.',
          'Overlaid F(t) & P(t) curves plus quantitative comparison table showing Δ% against the ★ reference.'
        ],
        bulletPointsFr: [
          'Barre Study : unités bar/MPa, modèle TTI/Nakka, sauvegarde/chargement JSON et PDF comparatif.',
          '4 sources : Simulation active, Bibliothèque locale, import multi-.hrms et essais banc CSV/XLSX.',
          'Alignement par série : référence ★, décalage Δt éditable, t₀ auto et bascule manuelle Tare Y / Brut.',
          'Courbes superposées F(t), P(t) et tableau quantitatif avec écarts Δ% par rapport à la référence ★.'
        ],
        bulletPointsIt: [
          'Barra Study: unità bar/MPa, modello TTI/Nakka, salva/carica Studio JSON e PDF comparativo.',
          '4 fonti dati: Simulazione attiva, Libreria locale, caricamento multi-.hrms e dati banco CSV/XLSX.',
          'Allineamento per serie: stella ★ di riferimento, offset Δt, t₀ auto e pulsante manuale Tara Y / Dati Grezzi.',
          'Grafici sovrapposti F(t), P(t) e tabella quantitativa con scarti Δ% rispetto al riferimento ★.'
        ]
      }
    ],
    [onApplyPresetMotor]
  );

  const getTitle = (g: GuideDefinition) => loc(g.titleEs, g.titleEn, g.titleFr, g.titleIt);
  const getSummary = (g: GuideDefinition) => loc(g.summaryEs, g.summaryEn, g.summaryFr, g.summaryIt);
  const getBullets = (g: GuideDefinition) => loc(g.bulletPointsEs, g.bulletPointsEn, g.bulletPointsFr, g.bulletPointsIt);
  const getPresetLabel = (g: GuideDefinition) =>
    loc(g.presetLabelEs, g.presetLabelEn, g.presetLabelFr, g.presetLabelIt);
  const getDifficultyLabel = (d: GuideDefinition['difficulty']) => {
    if (d === 'basic') return loc('Básico', 'Basic', 'Basique', 'Base');
    if (d === 'intermediate') return loc('Intermedio', 'Intermediate', 'Intermédiaire', 'Intermedio');
    return loc('Avanzado', 'Advanced', 'Avancé', 'Avanzato');
  };

  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = loc(guide.titleEs, guide.titleEn, guide.titleFr, guide.titleIt).toLowerCase();
      const summary = loc(guide.summaryEs, guide.summaryEn, guide.summaryFr, guide.summaryIt).toLowerCase();
      const bullets = loc(guide.bulletPointsEs, guide.bulletPointsEn, guide.bulletPointsFr, guide.bulletPointsIt)
        .join(' ')
        .toLowerCase();

      return title.includes(q) || summary.includes(q) || bullets.includes(q);
    });
  }, [guides, selectedCategory, searchQuery, lang]);

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
    setCompletedMap((prev) => {
      const next = { ...prev };
      delete next[tourId];
      return next;
    });
  };

  const categories = [
    { id: 'all', label: loc('Todas', 'All', 'Toutes', 'Tutte') },
    { id: 'beginner', label: loc('Tour Completo', 'Full Tour', 'Visite Complète', 'Tour Completo') },
    { id: 'geometry', label: loc('Granos', 'Grains', 'Grains', 'Grani') },
    { id: 'nozzle', label: loc('Cámara & Tobera', 'Chamber & Nozzle', 'Chambre & Tuyère', 'Camera & Ugello') },
    { id: 'propellant', label: loc('Propelentes', 'Propellants', 'Propergols', 'Propellenti') },
    { id: 'results', label: loc('Resultados / CFD', 'Results / CFD', 'Résultats / CFD', 'Risultati / CFD') },
    { id: 'flight', label: 'Mission Control' },
    { id: 'optimizer', label: 'Smart Search' },
    { id: 'export', label: loc('Guardar & Exportar', 'Save & Export', 'Sauvegarde & Export', 'Salva & Esporta') },
    { id: 'postprocess', label: 'Post-Process / Study' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card text-foreground shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card-header text-card-header-foreground shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {loc(
                    'Libro de Guías de HERMES',
                    'HERMES Simulator Guide Hub',
                    'Livre des Guides HERMES',
                    'Libro delle Guide HERMES'
                  )}
                </h2>
                <span className="text-[11px] font-mono font-semibold text-primary">
                  · {guides.length}{' '}
                  {loc(
                    'Tours Interactivos',
                    'Interactive Tours',
                    'Tours Interactifs',
                    'Tour Interattivi'
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {loc(
                  'Selecciona el idioma y elige cualquier guía temática para seguir el recorrido guiado sobre la interfaz real.',
                  'Choose your language and pick any themed guide to launch step-by-step spotlights directly on the live UI.',
                  'Choisissez votre langue et lancez n’importe quel guide thématique directement sur l’interface.',
                  'Seleziona la lingua e avvia qualsiasi guida tematica direttamente sull’interfaccia reale.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Guide Book & Tour Language Switcher */}
            <div
              className="flex items-center gap-1 rounded-lg border border-border bg-background/80 p-1"
              title={loc(
                'Idioma del Libro de Guías y Tours',
                'Guide Book & Tour Language',
                'Langue des Guides et Tours',
                'Lingua delle Guide e dei Tour'
              )}
            >
              <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5 shrink-0" />
              {GUIDE_LANGUAGES.map((item) => {
                const active = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => onChangeGuideLang(item.code)}
                    title={item.name}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
              aria-label={loc('Cerrar', 'Close', 'Fermer', 'Chiudi')}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={loc(
                'Buscar (grano, Padm, Kn, TTI, Study, .hrms)...',
                'Search (grain, Padm, Kn, TTI, Study, .hrms)...',
                'Rechercher (grain, Padm, Kn, TTI, Study, .hrms)...',
                'Cerca (grano, Padm, Kn, TTI, Study, .hrms)...'
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/80 border-border"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar pb-1 sm:pb-0">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-7 text-[11px] px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-primary hover:opacity-90 text-primary-foreground font-bold'
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
          <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25 shrink-0">
                <Wand2 className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  {loc(
                    'Carga Rápida de Motores de Demostración',
                    'Quick Demo Rocket Motor Presets',
                    'Chargement Rapide de Moteurs Démo',
                    'Caricamento Rapido Motori Demo'
                  )}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {loc(
                    'Carga una configuración probada en Simulate para probar resultados, análisis detallado o Study al instante:',
                    'Load a verified configuration in Simulate to test results, detailed analysis, or Study right away:',
                    'Chargez une configuration éprouvée dans Simulate pour tester résultats, analyse ou Study aussitôt :',
                    'Carica una configurazione verificata in Simulate per provare subito risultati, analisi o Study:'
                  )}
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
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-primary/40 text-primary hover:bg-primary/10 whitespace-nowrap shrink-0 cursor-pointer"
              >
                BATES J-Class (54mm)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPresetMotor('star_k');
                  onClose();
                }}
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loc('Estrella K-Class', 'Star K-Class', 'Étoile K-Class', 'Stella K-Class')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPresetMotor('apcp_l');
                  onClose();
                }}
                className="h-7 text-[10px] font-bold px-2.5 bg-background border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap shrink-0 cursor-pointer"
              >
                APCP K/L-Class
              </Button>
            </div>
          </div>

          {/* Prerequisite notice when no simulation results exist yet */}
          {!hasResults && (
            <div className="px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {loc(
                  'Aún no has ejecutado una simulación. Si inicias una guía marcada con "Requiere SIMULAR", el tour te llevará primero al botón SIMULAR sin lanzar cálculos automáticos.',
                  'No simulation results yet. Starting any guide marked "Requires SIMULATE" will point you to the SIMULATE button first without running calculations automatically.',
                  'Aucune simulation lancée pour l’instant. Les guides marqués « Nécessite SIMULER » vous guideront d’abord vers le bouton SIMULER.',
                  'Nessuna simulazione ancora eseguita. Le guide contrassegnate « Richiede SIMULA » ti mostreranno prima il pulsante SIMULA.'
                )}
              </span>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGuides.map((guide) => {
              const Icon = guide.icon;
              const completed = !!completedMap[guide.tourSequenceId];
              const presetLabel = getPresetLabel(guide);

              return (
                <div
                  key={guide.id}
                  className="rounded-xl border border-border bg-card hover:border-primary/45 p-4 flex flex-col justify-between transition-all hover:shadow-md relative group"
                >
                  <div>
                    {/* Card Header & Inline Metadata */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/25 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground leading-snug">
                            {getTitle(guide)}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 font-mono text-[10px] tabular-nums">
                            <span className="font-semibold text-primary">
                              {guide.estimatedMinutes} min
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              {getDifficultyLabel(guide.difficulty)}
                            </span>
                            {guide.requiresResults && !hasResults && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                  {loc(
                                    'Requiere SIMULAR',
                                    'Requires SIMULATE',
                                    'Nécessite SIMULER',
                                    'Richiede SIMULA'
                                  )}
                                </span>
                              </>
                            )}
                            {completed && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmarkSingle(guide.tourSequenceId);
                                }}
                                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                                title={loc(
                                  'Haz clic para desmarcar esta guía',
                                  'Click to unmark this guide',
                                  'Cliquer pour décocher ce guide',
                                  'Clicca per deselezionare questa guida'
                                )}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>
                                  {loc('Completada', 'Completed', 'Complétée', 'Completata')}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {getSummary(guide)}
                    </p>

                    {/* Key Topics List */}
                    <ul className="mt-3 space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/40 text-[11px]">
                      {getBullets(guide).map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-foreground/80">
                          <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          <span className="leading-tight">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    {guide.onApplyPreset && presetLabel ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={guide.onApplyPreset}
                        className="h-8 text-[11px] text-primary hover:bg-primary/10 px-2 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Wand2 className="w-3 h-3 mr-1" />
                        {presetLabel}
                      </Button>
                    ) : (
                      <span />
                    )}

                    <Button
                      size="sm"
                      onClick={() => {
                        onClose();
                        onStartTour(guide.tourSequenceId, lang);
                      }}
                      className={`h-8 text-xs font-bold px-3 gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        completed
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-primary hover:opacity-90 text-primary-foreground'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {completed
                        ? loc('Repetir Tour', 'Repeat Tour', 'Refaire le Tour', 'Ripeti Tour')
                        : loc(
                            'Iniciar Tour en Pantalla',
                            'Start Screen Tour',
                            'Démarrer le Tour',
                            'Avvia il Tour'
                          )}
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
                {loc(
                  'No se encontraron guías para tu búsqueda.',
                  'No guides match your search query.',
                  'Aucun guide ne correspond à votre recherche.',
                  'Nessuna guida trovata per la tua ricerca.'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer with Reset Progress Button */}
        <div className="p-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-5 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-mono">
              {loc(
                'HERMES · Manual Balístico Integrado',
                'HERMES · Integrated Ballistic Manual',
                'HERMES · Manuel Balistique Intégré',
                'HERMES · Manuale Balistico Integrato'
              )}
            </span>
            {showResetConfirm ? (
              <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 rounded-lg animate-fade-in">
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  {loc(
                    '¿Reiniciar todas las guías?',
                    'Reset all guides?',
                    'Réinitialiser tous les guides ?',
                    'Reimpostare tutte le guide?'
                  )}
                </span>
                <Button
                  size="sm"
                  onClick={handleConfirmReset}
                  className="h-5 text-[10px] font-bold px-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                >
                  {loc('Sí, reiniciar', 'Yes, reset', 'Oui, réinitialiser', 'Sì, azzera')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowResetConfirm(false)}
                  className="h-5 text-[10px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {loc('Cancelar', 'Cancel', 'Annuler', 'Annulla')}
                </Button>
              </div>
            ) : resetSuccessMessage ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {loc(
                  '¡Progreso reiniciado correctamente!',
                  'Progress reset successfully!',
                  'Progression réinitialisée !',
                  'Avanzamento azzerato con successo!'
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] text-muted-foreground hover:text-red-400 underline flex items-center gap-1 cursor-pointer font-mono transition-colors"
                title={loc(
                  'Borrar historial de guías completadas',
                  'Clear completed tours history',
                  'Effacer l’historique des guides complétés',
                  'Cancella la cronologia delle guide completate'
                )}
              >
                <RotateCcw className="w-3 h-3" />
                {loc(
                  'Reiniciar progreso de guías',
                  'Reset guide progress',
                  'Réinitialiser la progression',
                  'Reimposta avanzamento guide'
                )}
              </button>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs cursor-pointer">
            {loc('Cerrar', 'Close', 'Fermer', 'Chiudi')}
          </Button>
        </div>
      </div>
    </div>
  );
}
