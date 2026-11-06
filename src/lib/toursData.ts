import { TourSequence, TourStep } from '../components/InteractiveTourOverlay';

export interface TourPresetCallbacks {
  setGrains: (grains: any[]) => void;
  setMotor: (motor: any) => void;
  setNozzle: (nozzle: any) => void;
  runSim: () => void;
}

export function getTourSequences(
  lang: string,
  callbacks?: TourPresetCallbacks
): Record<string, TourSequence> {
  const isSpanish = lang === 'es';
  const isFrench = lang === 'fr';
  const isItalian = lang === 'it';

  // Helper for localized strings
  const loc = (es: string, en: string, fr?: string, it?: string) => {
    if (isSpanish) return es;
    if (isFrench) return fr || en;
    if (isItalian) return it || en;
    return en;
  };

  return {
    // 1. TOUR: Creación y Geometría de Granos
    tour_grains: {
      id: 'tour_grains',
      title: loc('Guía: Creación y Geometría de Granos', 'Guide: Propellant Grain Creation & Geometry', 'Guide : Création et Géométrie des Grains', 'Guida: Creazione e Geometria dei Grani'),
      description: loc(
        'Aprende paso a paso a añadir nuevos bloques de grano, elegir geometrías, dimensionar web thickness e inhibir caras.',
        'Learn step-by-step how to add new grain blocks, select core geometries, size web thickness, and set inhibitors.',
        'Apprenez à ajouter de nouveaux blocs de grains, choisir les formes et inhiber les faces.',
        'Impara passo dopo passo ad aggiungere nuovi blocchi di grano, scegliere le geometrie e inibire le facce.'
      ),
      steps: [
        {
          id: 'grain_add_btn',
          targetSelector: '[data-tour="new-grain-btn"]',
          title: loc('1. Añadir Nuevos Granos (+ Nuevo Grano)', '1. Add New Propellant Grains (+ New Grain)', '1. Ajouter de Nouveaux Grains (+ Nouveau Grain)', '1. Aggiungi Nuovi Grani (+ Nuovo Grano)'),
          category: loc('Pila del Motor', 'Motor Stack', 'Empilement', 'Impilamento'),
          tab: 'inputs',
          description: loc(
            'El botón "+ Nuevo Grano" añade un nuevo segmento de propelente al motor. Los cohetes de combustible sólido de alto rendimiento utilizan motores segmentados (típicamente de 3 a 6 granos) para facilitar la fundición del grano, inspección radiográfica y obtener perfiles de empuje optimizados.',
            'The "+ New Grain" button appends an additional propellant segment to the casing stack. High-power solid rocket motors use segmented grains (typically 3 to 6 segments) for ease of casting, radiographic inspection, and neutral thrust curves.',
            'Le bouton "+ Nouveau Grain" ajoute un segment de propergol supplémentaire. Les moteurs utilisent typiquement 3 à 6 blocs.',
            'Il pulsante "+ Nuovo Grano" aggiunge un nuovo segmento di propellente. I motori reali usano da 3 a 6 segmenti.'
          ),
          bulletPoints: [
            loc('Cada grano añadido aparece como una fila independiente con sus propias dimensiones y tipo de propelente.', 'Each added grain appears as an independent row with distinct dimensions and fuel formulation.', 'Chaque bloc ajouté forme une ligne autonome avec ses dimensions propres.', 'Ogni blocco aggiunto costituisce una riga autonoma con dimensioni proprie.'),
            loc('Puedes combinar granos de distinta forma o propelente en la misma cámara (motores de empuje escalonado dual).', 'You can mix different shapes or propellants within the same motor (dual-thrust booster/sustainer configurations).', 'Vous pouvez mélanger différentes géométries ou carburants dans la même chambre.', 'Puoi combinare forme o propellenti diversi nella stessa camera.')
          ],
          tip: loc(
            'Si usas varios granos idénticos, también puedes simplemente aumentar el contador "N" en una sola fila.',
            'If using identical segments, you can also simply increase the "N" multiplier on a single row.',
            'Si vous utilisez des segments identiques, vous pouvez aussi augmenter le compteur N.',
            'Se usi segmenti identici, puoi semplicemente aumentare il contatore N.'
          )
        },
        {
          id: 'grain_propellant_select',
          targetSelector: '[data-tour="grain-propellant-0"]',
          title: loc('2. Selección de Propelente del Grano', '2. Grain Propellant Selection', '2. Sélection du Propergol du Grain', '2. Selezione del Propellente del Grano'),
          category: loc('Combustible', 'Propellant', 'Propergol', 'Propellente'),
          tab: 'inputs',
          description: loc(
            'Selecciona qué fórmula química quema este bloque. El menú desplegable incluye los propelentes estándar contrastados (KNDX, KNSB, KNRX, APCP) y cualquier fórmula que hayas creado y guardado en tu biblioteca.',
            'Select the chemical fuel formula for this segment. The dropdown includes standard proven rocketry fuels (KNDX, KNSB, KNRX, APCP) plus all custom formulations in your library.',
            'Sélectionnez la formule chimique pour ce bloc parmi les standards et vos formules personnalisées.',
            'Seleziona la formula chimica per questo blocco tra i combustibili standard e quelli personalizzati.'
          ),
          bulletPoints: [
            loc('Pulsando en "Fórmula" puedes ver o editar los coeficientes de velocidad r(P) = a·Pⁿ del combustible.', 'Clicking "Formula" displays the chemical synthesis manager with burn rate coefficients r(P) = a·Pⁿ.', 'En cliquant sur "Formule", vous pouvez inspecter ou éditer les coefficients r(P) = a·Pⁿ.', 'Cliccando su "Formula" puoi visualizzare o modificare i coefficienti r(P) = a·Pⁿ.')
          ]
        },
        {
          id: 'grain_shape',
          targetSelector: '[data-tour="grain-shape-select-0"]',
          title: loc('3. Forma y Sección del Canal (BATES, Estrella, Macizo)', '3. Grain Core Shape (BATES, Star, Solid)', '3. Forme du Canal (BATES, Étoile, Massif)', '3. Forma del Canale (BATES, Stella, Massiccio)'),
          category: loc('Geometría', 'Geometry', 'Géométrie', 'Geometria'),
          tab: 'inputs',
          description: loc(
            'El canal central perforado determina la evolución del área de combustión Ab(t) a medida que la llama retrocede perpendicular a la superficie:',
            'The core perforation determines how the burning surface area Ab(t) evolves as the flame regresses inward:',
            'Le canal central détermine l\'évolution de la surface de combustion Ab(t) au cours du temps :',
            'Il canale centrale determina l\'evoluzione dell\'area di combustione Ab(t) nel tempo:'
          ),
          bulletPoints: [
            loc('Cilíndrico (BATES): Núcleo circular central. La superficie del núcleo crece (progresiva) mientras las caras extremas se acortan (regresiva), logrando un empuje neutro casi perfecto.', 'Cylindrical (BATES): Circular central port. Port area expands progressively while ends shorten regressively, balancing into a flat, neutral thrust curve.', 'Cylindrique (BATES) : Canal circulaire central équilibrant poussée progressive et régressive.', 'Cilindrico (BATES): Canale circolare che bilancia spinta progressiva e regressiva per un profilo neutro.'),
            loc('Estrella (Star Grain): Núcleo con puntas (Np = 3 a 8). Ofrece enorme área inicial para acelerar rápido el cohete al despegue.', 'Star Grain: Star-shaped core (Np = 3 to 8 points). High initial burning area for fast liftoff tower clearance.', 'Étoile : Canal étoilé offrant une forte poussée initiale.', 'Stella: Canale stellare con elevata spinta iniziale al decollo.'),
            loc('Macizo (End-burner): Sin orificio central. Arde únicamente desde la base hacia la cabeza como un cigarrillo, ideal para quemados largos de baja aceleración.', 'Solid (End-burner): No core hole. Burns solely end-to-end like a cigarette, producing long low-thrust burn times.', 'Massif (End-burner) : Brûle exclusivement d\'un bout à l\'autre pour de longues durées.', 'Massiccio: Brucia dall\'estremità come una sigaretta per durate prolungate.')
          ],
          autofillLabel: loc('Probar Grano BATES 4 Segmentos', 'Load 4-Segment BATES Stack', 'Charger BATES 4 Segments', 'Carica BATES a 4 Segmenti'),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setGrains([
                { id: 'bates-tour-1', shape: 1, propellantType: 1, D0: 50, d0: 16, L0: 75, N: 4, osi: 0, ci: 1, ei: 0, rhorat: 0.95 }
              ]);
            }
          }
        },
        {
          id: 'grain_dimensions',
          targetSelector: '[data-tour="grain-dimensions-0"]',
          title: loc('4. Dimensionado Físico: D₀, d₀, L₀ y N', '4. Physical Sizing: D₀, d₀, L₀ and N', '4. Cotes Géométriques : D₀, d₀, L₀ et N', '4. Quote Geometriche: D₀, d₀, L₀ e N'),
          category: loc('Dimensiones', 'Dimensions', 'Dimensions', 'Dimensioni'),
          tab: 'inputs',
          description: loc(
            'Estas cuatro variables definen el volumen de combustible, el espesor de pared (web thickness) y la duración de la combustión:',
            'These four variables dictate propellant mass volume, burnable web thickness, and total burn duration:',
            'Ces quatre variables définissent le volume de carburant, l\'épaisseur de web et la durée de poussée :',
            'Queste quattro variabili definiscono il volume di combustibile, lo spessore web e la durata della combustione:'
          ),
          bulletPoints: [
            loc('D₀ [mm]: Diámetro exterior del grano. Debe ser 1-2 mm menor que Dc para permitir el tubo de liner aislante.', 'D₀ [mm]: Outer grain diameter. Must be 1-2 mm smaller than casing Dc to fit the thermal liner tube.', 'D₀ [mm] : Diamètre extérieur. Doit être 1-2 mm inférieur à Dc pour loger le liner.', 'D₀ [mm]: Diametro esterno. Deve essere 1-2 mm inferiore a Dc per ospitare il liner.'),
            loc('d₀ [mm]: Diámetro del orificio central. El espesor quemable (Web) es exactamente (D₀ - d₀) / 2.', 'd₀ [mm]: Core port diameter. Burnable web thickness is exactly (D₀ - d₀) / 2.', 'd₀ [mm] : Diamètre du canal central. Épaisseur de web = (D₀ - d₀) / 2.', 'd₀ [mm]: Diametro del canale. Lo spessore web è esattamente (D₀ - d₀) / 2.'),
            loc('L₀ [mm]: Longitud de cada segmento individual de grano.', 'L₀ [mm]: Axial length of each individual grain block.', 'L₀ [mm] : Longueur axiale de chaque segment.', 'L₀ [mm]: Lunghezza assiale di ciascun segmento.'),
            loc('N: Multiplicador de bloques idénticos apilados en serie a lo largo de la cámara.', 'N: Multiplier for identical grain segments stacked along the casing.', 'N : Nombre de blocs identiques empilés.', 'N: Moltiplicatore di blocchi identici impilati.')
          ],
          tip: loc(
            '¡Regla de oro!: La longitud total (L₀ · N) no debe superar la longitud útil de cámara Lc.',
            'Golden rule: Total propellant length (L₀ · N) must not exceed chamber length Lc.',
            'Règle d\'or : La longueur totale (L₀ · N) ne doit pas dépasser la chambre Lc.',
            'Regola d\'oro: La lunghezza totale (L₀ · N) non deve superare la lunghezza della camera Lc.'
          )
        },
        {
          id: 'grain_faces',
          targetSelector: '[data-tour="grain-faces-0"]',
          title: loc('5. Caras de Combustión e Inhibidores (EXT, ENDS, INT)', '5. Burning Faces & Inhibitors (EXT, ENDS, INT)', '5. Faces de Combustion & Inhibiteurs', '5. Facce di Combustione e Inibitori'),
          category: loc('Inhibición', 'Inhibition', 'Inhibition', 'Inibizione'),
          tab: 'inputs',
          description: loc(
            'Controla con precisión quirúrgica qué superficies del grano entran en contacto con el fuego y cuáles están protegidas:',
            'Controls exactly which surfaces burn and which are thermally shielded by liner tubes or inhibitor paint:',
            'Contrôlez quelles surfaces brûlent et lesquelles sont protégées par un liner ou inhibiteur :',
            'Controlla quali superfici bruciano e quali sono protette da liner o inibitori termici:'
          ),
          bulletPoints: [
            loc('EXT (Exterior): Marca si la cara perimetral exterior arde hacia dentro. En granos BATES va DESMARCADA (inhibida por el liner).', 'EXT (Outer): Checked if outer perimeter burns inward. In standard BATES this is UNCHECKED (inhibited by liner).', 'EXT : Coché si le périmètre extérieur brûle. En BATES, reste décoché.', 'EXT: Selezionato se il perimetro esterno brucia. In configurazione BATES va deselezionato.'),
            loc('ENDS (Extremos): Marca si las bases frontal y trasera del grano arden libremente.', 'ENDS (End faces): Checked if forward and aft faces burn longitudinally.', 'ENDS : Coché si les extrémités avant et arrière brûlent.', 'ENDS: Selezionato se le basi anteriore e posteriore bruciano.'),
            loc('INT (Interior): Marca si la combustión propaga radialmente desde el orificio central.', 'INT (Inner core): Checked if combustion progresses radially outward from the core.', 'INT : Coché si la flamme progresse depuis le canal intérieur.', 'INT: Selezionato se la combustione propaga dal canale interno.')
          ]
        },
        {
          id: 'grain_previews',
          targetSelector: '[data-tour="grain-previews-0"]',
          title: loc('6. Inspección de Cortes Transversal y Longitudinal', '6. Cross-Section & Longitudinal Previews', '6. Vérification des Coupes Transversale et Longitudinale', '6. Verifica Sezioni Trasversale e Longitudinale'),
          category: loc('Verificación', 'Inspection', 'Contrôle', 'Verifica'),
          tab: 'inputs',
          description: loc(
            'Examina los lienzos de previsualización en tiempo real: el canvas izquierdo muestra la sección transversal (comprobando simetría y holgura), y el derecho muestra el cilindro longitudinal. Si todo está correcto, ¡puedes pulsar "SIMULAR"!',
            'Inspect the real-time previews: the left canvas illustrates the cross-section (confirming port clearances), and the right canvas shows the longitudinal stack cutaway. You are now ready to hit "SIMULATE"!',
            'Vérifiez la coupe transversale et l\'empilement longitudinal. Vous êtes prêt à simuler !',
            'Verifica la sezione trasversale e l\'impilamento longitudinale. Sei pronto per simulare!'
          )
        }
      ]
    },

    // 2. TOUR: Cámara y Tobera Laval
    tour_nozzle: {
      id: 'tour_nozzle',
      title: loc('Guía: Cámara de Combustión y Tobera Laval', 'Guide: Combustion Chamber & Laval Nozzle', 'Guide : Chambre de Combustion & Tuyère Laval', 'Guida: Camera di Combustione e Ugello Laval'),
      description: loc(
        'Aprende a dimensionar la cámara de presión, la garganta y la expansión de la tobera sin sobrepresión.',
        'Learn how to size casing diameter, critical throat area, and nozzle expansion without overpressure.',
        'Apprenez à dimensionner le diamètre du boîtier, le col de tuyère et l\'expansion.',
        'Impara a dimensionare il casing, la gola critica e l\'espansione dell\'ugello.'
      ),
      steps: [
        {
          id: 'chamber_inputs',
          targetSelector: '[data-tour="chamber-card"]',
          title: loc('Cámara de Combustión (Dc, Lc, G*, kv)', 'Combustion Chamber (Dc, Lc, G*, kv)', 'Chambre de Combustion (Dc, Lc, G*, kv)', 'Camera di Combustione (Dc, Lc, G*, kv)'),
          category: loc('Cámara', 'Chamber', 'Chambre', 'Camera'),
          tab: 'inputs',
          description: loc(
            'Configura el tubo estructural que aloja los granos de propelente y soporta la presión generada.',
            'Configure the structural pressure casing enclosing the propellant grains and bearing internal pressure.',
            'Configurez le boîtier sous pression contenant les grains de propergol.',
            'Configura il tubo strutturale che ospita i grani e sopporta la pressione.'
          ),
          bulletPoints: [
            loc('Dc [mm]: Diámetro interno de la carcasa o casing (debe ser mayor que D₀ de los granos).', 'Dc [mm]: Inside diameter of casing (must accommodate grain D₀ + liner clearance).', 'Dc [mm] : Diamètre intérieur du carter.', 'Dc [mm]: Diametro interno del casing.'),
            loc('Lc [mm]: Longitud total disponible en la cámara de combustión.', 'Lc [mm]: Usable chamber cavity length.', 'Lc [mm] : Longueur utile de la chambre.', 'Lc [mm]: Lunghezza utile della camera.'),
            loc('G* [kg/(m²·s)]: Flujo másico erosivo de umbral (típicamente entre 1.5 y 2.5).', 'G* [kg/(m²·s)]: Threshold mass flux for erosive burning (typically 1.5 to 2.5).', 'G* : Flux massique seuil pour combustion érosive.', 'G*: Flusso di massa soglia per combustione erosiva.'),
            loc('ηc (Eficiencia de cámara): Factor de rendimiento de combustión real (0.85 a 0.95).', 'ηc (Combustion efficiency): Real-world chemical combustion factor (0.85 to 0.95).', 'ηc : Efficacité de combustion réelle (0.85 à 0.95).', 'ηc: Efficienza di combustione reale (da 0.85 a 0.95).')
          ]
        },
        {
          id: 'nozzle_inputs',
          targetSelector: '[data-tour="nozzle-card"]',
          title: loc('Dimensionado de la Tobera Laval (Dt₀, Ds, α)', 'De Laval Nozzle Sizing (Dt₀, Ds, α)', 'Dimensionnement Tuyère Laval (Dt₀, Ds, α)', 'Dimensionamento Ugello Laval (Dt₀, Ds, α)'),
          category: loc('Tobera', 'Nozzle', 'Tuyère', 'Ugello'),
          tab: 'inputs',
          description: loc(
            'La tobera acelera los gases desde velocidad subsónica en la cámara hasta velocidad supersónica en la salida.',
            'The convergent-divergent nozzle accelerates combustion gases from subsonic to supersonic velocities.',
            'La tuyère accélère les gaz jusqu\'à des vitesses supersoniques.',
            'L\'ugello accelera i gas fino a velocità supersoniche all\'uscita.'
          ),
          bulletPoints: [
            loc('Dt₀ [mm]: Diámetro de garganta inicial. El parámetro más sensible: a menor Dt₀, mayor presión y Kn.', 'Dt₀ [mm]: Initial throat diameter. Most sensitive parameter: smaller Dt₀ dramatically raises chamber pressure and Kn.', 'Dt₀ [mm] : Diamètre au col. Paramètre le plus critique.', 'Dt₀ [mm]: Diametro della gola iniziale. Il parametro più sensibile.'),
            loc('Ds [mm]: Diámetro de la boca de salida de la tobera.', 'Ds [mm]: Exit cone exit diameter.', 'Ds [mm] : Diamètre de sortie de la tuyère.', 'Ds [mm]: Diametro della sezione di uscita.'),
            loc('Relación de expansión ε = (Ds / Dt₀)²: Ajustada para expandir gases hasta 1 atm a nivel del mar.', 'Expansion ratio ε = (Ds / Dt₀)²: Sized to expand exhaust gas to ambient pressure (~1 atm at sea level).', 'Rapport d\'expansion ε = (Ds / Dt₀)²', 'Rapporto di espansione ε = (Ds / Dt₀)²'),
            loc('α [°]: Semiángulo del cono divergente (típicamente 12° a 15°).', 'α [°]: Divergent half-angle (typically 12° to 15°).', 'α [°] : Demi-angle de divergence (12° à 15°).', 'α [°]: Semiangolo del cono divergente (12° a 15°).')
          ],
          autofillLabel: loc('Ajustar Tobera Óptima Nivel del Mar', 'Set Optimal Sea-Level Nozzle', 'Ajuster Tuyère Optimale Niveau Mer', 'Imposta Ugello Ottimale Livello Mare'),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setNozzle({ Dt0: 17.5, Ds: 38.0, e: 0, alpha: 14, etanoz: 0.88 });
            }
          }
        },
        {
          id: 'slag_erosion',
          targetSelector: '[data-tour="slag-panel"]',
          title: loc('Erosión de Garganta y Depósito de Escoria (Modelos de Progresión)', 'Throat Erosion & Slag Deposition (Progression Models)', 'Érosion au Col & Dépôt de Scories (Modèles)', 'Erosione della Gola e Deposito di Scorie (Modelli)'),
          category: loc('Fenómenos Reales', 'Real-world Physics', 'Physique Réelle', 'Fenomeni Reali'),
          tab: 'inputs',
          description: loc(
            'En toberas reales de grafito, fenólico o aluminio, el diámetro de garganta Dt cambia durante la combustión por ablación mecánica/térmica o depósito de residuos sólidos.',
            'In real-world graphite, phenolic, or aluminum nozzles, the throat diameter Dt evolves during firing due to thermal/mechanical ablation or solid residue deposition.',
            'Dans les tuyères réelles, le col Dt évolue par ablation thermique ou dépôt de scories.',
            'Negli ugelli reali, il diametro della gola Dt varia per ablazione termica o deposito di scorie.'
          ),
          bulletPoints: [
            loc('Signo de ΔDt (Valores Positivos vs Negativos): Los valores POSITIVOS (ej. +0.8 mm) indican EROSIÓN O ABLACIÓN de la garganta (ensanchamiento del agujero por gases supersónicos calientes, lo que reduce Kn y baja la presión Pc al final). Los valores NEGATIVOS (ej. -0.8 mm) indican ACUMULACIÓN DE ESCORIA SÓLIDA (depósito de residuos fundidos de KNDX/KNSB o alúmina de APCP en la garganta fría, reduciendo el área, aumentando Kn y provocando picos de sobrepresión).', 'Sign of ΔDt (Positive vs Negative Values): POSITIVE values (e.g. +0.8 mm) represent THROAT EROSION/ABLATION (widening by hot supersonic gas, decreasing Kn and lowering Pc near burnout). NEGATIVE values (e.g. -0.8 mm) represent SOLID SLAG DEPOSITION (molten residue build-up from KNDX/KNSB or APCP alumina constricting the throat, raising Kn and creating late pressure spikes).', 'Signe de ΔDt : Valeurs POSITIVES = ÉROSION (élargissement). Valeurs NÉGATIVES = ESCORIES (réduction du col).', 'Segno di ΔDt: Valori POSITIVI = EROSIONE (allargamento). Valori NEGATIVI = SCORIE (restringimento).'),
            loc('Modelos de Progresión (1 a 6): Controlan cómo evoluciona ΔDt respecto al tiempo de combustión. 1: Lineal, 2: Exponencial, 3: Cuadrático, 4: Raíz Cuadrada, 5: Parabólico, 6: Senoidal.', 'Progression Models (1 to 6): Dictate how ΔDt evolves over burn time. 1: Linear, 2: Exponential, 3: Quadratic, 4: Square Root, 5: Parabolic, 6: Sine.', 'Modèles de progression : 1: Linéaire, 2: Exponentiel, 3: Quadratique, 4: Racine, 5: Parabolique, 6: Sinus.', 'Modelli di progressione: 1: Lineare, 2: Esponenziale, 3: Quadratico, 4: Radice, 5: Parabolico, 6: Seno.'),
            loc('¡MODELO 3 CUADRÁTICO RECOMENDADO! El Modelo 3 (Cuadrático) es el que MEJOR refleja la física real. A medida que la garganta absorbe calor acumulado durante el disparo, la tasa de erosión y ablación se acelera de forma cuadrática con el tiempo (t²).', 'MODEL 3 QUADRATIC RECOMMENDED! Model 3 (Quadratic) BEST matches real-world firing physics. As the throat material absorbs cumulative heat during firing, the erosion/ablation rate accelerates quadratically over time (t²).', 'MODÈLE 3 QUADRATIQUE RECOMMANDÉ : Reflète fidèlement l\'accélération thermique réelle (t²).', 'MODELLO 3 QUADRATICO RACCOMANDATO: Riflette fedelmente l\'accelerazione termica reale (t²).')
          ],
          tip: loc(
            'Si usas una tobera de grafito de alta densidad no ablativa en impulsos cortos, fija ΔDt = 0 para simular conducta ideal.',
            'For high-density non-ablative graphite nozzles in short firings, set ΔDt = 0 for ideal behavior.',
            'Si la tuyère en graphite est idéale, fixez ΔDt = 0.',
            'Se l\'ugello in grafite è ideale, imposta ΔDt = 0.'
          )
        }
      ]
    },

    // 3. TOUR: Composición Química de Granos, Saint-Robert y Saint-Venant
    // 3. TOUR: Composición Química de Granos, Saint-Robert y Saint-Venant (Inputs Tab)
    tour_propellants: {
      id: 'tour_propellants',
      title: loc('Guía: Composición Química, Saint-Robert y Saint-Venant', 'Guide: Propellant Chemistry, Saint-Robert & Saint-Venant', 'Guide : Chimie, Saint-Robert & Saint-Venant', 'Guida: Chimica dei Propellenti, Saint-Robert e Saint-Venant'),
      description: loc(
        'Aprende qué son los parámetros A y N, la ley de Saint-Venant de tobera, y la condición crítica de estabilidad de cámara.',
        'Understand burn rate parameters A and N, Saint-Venant choked nozzle law, and chamber stability conditions.',
        'Comprenez les paramètres A et N, la loi de Saint-Venant et la condition de stabilité de chambre.',
        'Comprendi i parametri A ed N, la legge di Saint-Venant e la condizione di stabilità della camera.'
      ),
      steps: [
        {
          id: 'propellant_selection',
          targetSelector: '[data-tour="grain-propellant-0"]',
          title: loc('1. Selección del Combustible por Segmento de Grano', '1. Propellant Selection per Grain Segment', '1. Sélection du Propergol par Segment', '1. Selezione del Propellente per Segmento'),
          category: loc('Pestaña Inputs', 'Inputs Tab', 'Onglet Entrées', 'Pannello Dati'),
          tab: 'inputs',
          closeModal: 'propellant',
          description: loc(
            'En cada segmento de grano puedes seleccionar el combustible químico que se quemará. El selector incluye los 7 propulsantes estándar de referencia aeroespacial y todos los propulsantes personalizados guardados en tu biblioteca.',
            'For each grain segment you can select the active propellant fuel formulation. The selector includes 7 standard aerospace benchmark fuels plus all custom formulations saved in your library.',
            'Pour chaque grain, sélectionnez le propergol standard ou personnalisé.',
            'Per ogni segmento di grano puoi selezionare il propellente standard o personalizzato.'
          ),
          bulletPoints: [
            loc('KNDX (65% KNO₃ + 35% Dextrosa): Combustible estándar "candy", fiable y seguro.', 'KNDX (65% KNO₃ + 35% Dextrose): Classic rocket candy, safe and predictable.', 'KNDX : Standard candy classique.', 'KNDX: Il classico rocket candy.'),
            loc('KNSB (65% KNO₃ + 35% Sorbitol): Menor viscosidad de fusión, excelente para fundición de núcleos.', 'KNSB (65% KNO₃ + 35% Sorbitol): Low melt viscosity, ideal for casting complex core shapes.', 'KNSB : Faible viscosité de coulée.', 'KNSB: Bassa viscosità di colata.'),
            loc('APCP (Perclorato de Amonio + HTPB + Aluminio): Alto impulso específico aeroespacial (>200 s).', 'APCP (Ammonium Perchlorate Composite): High specific impulse aerospace standard (>200 s).', 'APCP : Composite haute performance (>200 s).', 'APCP: Standard aerospaziale ad alte prestazioni (>200 s).')
          ]
        },
        {
          id: 'propellant_thermo_properties',
          targetSelector: '[data-tour="grain-dimensions-0"]',
          title: loc('2. Propiedades Termoquímicas: Densidad, Calor y Gases', '2. Thermochemical Properties: Density, Heat & Gases', '2. Propriétés Thermochimiques : Densité et Chaleur', '2. Proprietà Termochimiche: Densità e Calore'),
          category: loc('Termoquímica', 'Thermochemistry', 'Thermochimie', 'Termochimica'),
          tab: 'inputs',
          description: loc(
            'El rendimiento termodinámico de la combustión depende de 4 magnitudes físicas fundamentales que rigen el empuje:',
            'Combustion thermodynamic energy is governed by 4 fundamental physical properties:',
            'L\'énergie thermodynamique dépend de 4 grandeurs fondamentales :',
            'L\'energia termodinamica dipende da 4 grandezze fisiche fondamentali:'
          ),
          bulletPoints: [
            loc('Densidad ρ [g/cm³]: Determina la masa exacta de combustible según el volumen geométrico del grano (m = ρ · V_grano).', 'Density ρ [g/cm³]: Fixes propellant mass inside the casing given grain volume (m = ρ · V_grain).', 'Densité ρ : Fixe la masse de carburant embarquée.', 'Densità ρ: Determina la massa di combustibile in base al volume del grano.'),
            loc('Temperatura de llama T₀ [K] y Masa molecular M [g/mol]: Gobiernan la velocidad característica c* = √(R·T₀ / (M·Γ²)). A mayor temperatura y gases más ligeros (menor M), mayor velocidad y energía.', 'Flame Temp T₀ [K] & Molar Mass M [g/mol]: Govern characteristic velocity c* = √(R·T₀ / (M·Γ²)). Higher temp and lighter gas molecules produce higher exhaust velocity.', 'Température T₀ et masse molaire M : Déterminent la vitesse caractéristique c*.', 'Temperatura T₀ e massa molare M: Governano la velocità caratteristica c*.'),
            loc('Relación de calores específicos γ (Cp/Cv): Dicta la capacidad del gas para expandirse adiabáticamente en la tobera Laval.', 'Specific Heat Ratio γ (Cp/Cv): Governs isentropic gas expansion through the supersonic nozzle.', 'Rapport γ (Cp/Cv) : Contrôle la détente supersonique.', 'Rapporto γ (Cp/Cv): Controlla l\'espansione supersonica nell\'ugello.')
          ]
        },
        {
          id: 'saint_robert_law',
          targetSelector: '[data-tour="manage-chemistry-btn-0"]',
          title: loc('3. Ley de Saint-Robert: ¿Qué son los Parámetros A y N?', '3. Saint-Robert Law: What Are Parameters A and N?', '3. Loi de Saint-Robert : Que sont les Paramètres A et N ?', '3. Legge di Saint-Robert: Cosa sono i Parametri A ed N?'),
          category: loc('Ley r = a·Pⁿ', 'Burn Law', 'Loi de Régression', 'Legge di Combustione'),
          tab: 'inputs',
          description: loc(
            'La velocidad lineal a la que retrocede la llama perpendicular a la superficie del grano sigue la ley empírica de Saint-Robert (o ley de Vieille): r = a · Pⁿ [mm/s].',
            'The linear regression velocity of the flame perpendicular to the burning face follows Saint-Robert empirical law: r = a · Pⁿ [mm/s].',
            'La vitesse de régression de la flamme suit la loi empirique de Saint-Robert : r = a · Pⁿ [mm/s].',
            'La velocità lineare di regressione segue la legge empirica di Saint-Robert: r = a · Pⁿ [mm/s].'
          ),
          bulletPoints: [
            loc('Parámetro "a" (Coeficiente de quemado): Factor de escala en mm/(s·MPaⁿ). Representa la rapidez química inherente según el tamaño de partícula del oxidante y catalizadores.', 'Parameter "a" (Burn rate coefficient): Scale factor in mm/(s·MPaⁿ). Represents baseline chemical kinetics, oxidizer grind size, and additives.', 'Paramètre "a" : Coefficient d\'échelle en mm/(s·MPaⁿ).', 'Parametro "a": Coefficiente di scala in mm/(s·MPaⁿ).'),
            loc('Parámetro "n" (Exponente de presión): Sensibilidad de la velocidad al aumento de presión en la cámara.', 'Parameter "n" (Pressure exponent): Sensitivity of combustion rate to chamber pressure rises.', 'Paramètre "n" : Sensibilité de la vitesse à la pression.', 'Parametro "n": Sensibilità della velocità alla pressione.'),
            loc('¡CONDICIÓN VITAL DE ESTABILIDAD! n < 1: Para que el motor sea estable, n DEBE ser menor que 1 (típicamente entre 0.3 y 0.7). Si n ≥ 1, cualquier pequeño aumento de presión acelera la combustión produciendo más gas del que la tobera puede evacuar, provocando una explosión desbocada instantánea (CATO).', 'CRITICAL STABILITY CONDITION! n < 1: Chamber stability strictly requires n < 1 (typically 0.3 to 0.7). If n ≥ 1, any pressure fluctuation generates gas faster than nozzle discharge capacity, causing catastrophic exponential pressure runaway and casing explosion (CATO).', 'CONDITION VITALE ! n < 1 : Obligatoire pour garantir la stabilité et éviter l\'explosion.', 'CONDIZIONE VITALE! n < 1: Obbligatorio n < 1 per garantire stabilità ed evitare l\'esplosione.')
          ]
        },
        {
          id: 'saint_venant_law',
          targetSelector: '[data-tour="nozzle-card"]',
          title: loc('4. Ley de Saint-Venant y Presión de Equilibrio de Cámara', '4. Saint-Venant Law & Chamber Equilibrium Pressure', '4. Loi de Saint-Venant & Équilibre de Chambre', '4. Legge di Saint-Venant e Pressione di Equilibrio'),
          category: loc('Física de Tobera', 'Nozzle Physics', 'Physique Tuyère', 'Fisica dell\'Ugello'),
          tab: 'inputs',
          description: loc(
            'Saint-Venant formuló el caudal másico que escapa por una tobera cuando el flujo se atasca a velocidad sónica (Mach 1) en la garganta. La presión de operación de un motor cohete surge del equilibrio entre el gas producido y el gas expulsado:',
            'Saint-Venant formulated the sonic mass discharge through a choked nozzle throat (Mach 1). Chamber pressure arises strictly from mass balance:',
            'La loi de Saint-Venant régit le débit massique à travers le col sonique de la tuyère :',
            'La legge di Saint-Venant governa la portata massica attraverso la gola sonica dell\'ugello:'
          ),
          bulletPoints: [
            loc('Descarga de Tobera (Saint-Venant): ṁ_out = (Pc · At) / c*, proporcional a la presión de cámara Pc y área de garganta At.', 'Choked Nozzle Discharge (Saint-Venant): ṁ_out = (Pc · At) / c*, strictly proportional to chamber pressure Pc and throat area At.', 'Débit évacué : ṁ_out = (Pc · At) / c*.', 'Portata scaricata: ṁ_out = (Pc · At) / c*.'),
            loc('Generación de Gas en Combustión: ṁ_gen = ρ_p · Ab · r = ρ_p · Ab · a · Pcⁿ, proporcional al área de grano Ab y ley de quemado.', 'Gas Generation: ṁ_gen = ρ_p · Ab · r = ρ_p · Ab · a · Pcⁿ, proportional to burning surface Ab.', 'Débit généré : ṁ_gen = ρ_p · Ab · a · Pcⁿ.', 'Portata generata: ṁ_gen = ρ_p · Ab · a · Pcⁿ.'),
            loc('Presión de Equilibrio Estacionario: Igualando ṁ_gen = ṁ_out se despeja: Pc = (a · ρ_p · c* · Kn)^(1 / (1 - n)), donde Kn = Ab / At. Como se observa, el ratio Kn determina directamente la presión de trabajo del motor.', 'Equilibrium Pressure: Setting ṁ_gen = ṁ_out gives: Pc = (a · ρ_p · c* · Kn)^(1 / (1 - n)), where Kn = Ab / At. The ratio Kn directly dictates chamber operating pressure.', 'Pression d\'équilibre : Pc = (a · ρ_p · c* · Kn)^(1 / (1 - n)).', 'Pressione di equilibrio: Pc = (a · ρ_p · c* · Kn)^(1 / (1 - n)).')
          ],
          tip: loc(
            'El ratio Kn = Ab / At (área quemando / área garganta) es el volante físico para ajustar la presión y empuje deseados.',
            'The ratio Kn = Ab / At (burning grain area / nozzle throat area) is the primary physical dial to control motor pressure.',
            'Le ratio Kn = Ab / At est le levier physique principal de la pression.',
            'Il rapporto Kn = Ab / At è la leva fisica principale per controllare la pressione.'
          )
        },
        {
          id: 'propellant_formula_inspection',
          targetSelector: '[data-tour="manage-chemistry-btn-0"]',
          title: loc('5. Inspección de Valores y Fórmulas Químicas', '5. Inspect Chemical Values & Active Formulation', '5. Inspection des Valeurs et Formules Chimiques', '5. Ispezione dei Valori e Formule Chimiche'),
          category: loc('Inspección', 'Inspection', 'Contrôle', 'Ispezione'),
          tab: 'inputs',
          description: loc(
            'Al pulsar el enlace "Fórmula" o el botón "Química & Propulsantes" puedes consultar en detalle los coeficientes numéricos exactos de cada combustible antes del encendido.',
            'Clicking the "Formula" link or the "Propellant Chemistry" button opens the detailed view of exact coefficients for any fuel prior to firing.',
            'Cliquez sur "Formule" pour consulter les coefficients exacts.',
            'Clicca su "Formula" per consultare i coefficienti esatti.'
          )
        }
      ]
    },

    // 4. NUEVA GUÍA: Crear un Nuevo Propulsante
    tour_create_propellant: {
      id: 'tour_create_propellant',
      title: loc('Guía: Crear un Nuevo Propulsante Personalizado', 'Guide: Create a Custom Propellant', 'Guide : Créer un Propergol Personnalisé', 'Guida: Creare un Propellente Personalizzato'),
      description: loc(
        'Aprende a abrir el gestor desde Inputs, consultar propulsantes existentes y sus rangos de presión, y formular un nuevo combustible.',
        'Learn how to open the manager from Inputs, inspect existing fuels and pressure ranges, and formulate custom propellants.',
        'Apprenez à ouvrir le gestionnaire depuis les Entrées, examiner les propergols existants et créer votre propre carburant.',
        'Impara come aprire il gestore da Dati, esaminare i propellenti esistenti e creare un nuovo propellente.'
      ),
      steps: [
        {
          id: 'propellant_open_button_step',
          targetSelector: '[data-tour="global-propellant-manager-btn"]',
          title: loc('1. Dónde Abrir el Gestor de Propulsantes', '1. Where to Open the Propellant Manager', '1. Où Ouvrir le Gestionnaire de Propergols', '1. Dove Aprire il Gestore Propellenti'),
          category: loc('Acceso en Inputs', 'Inputs Access', 'Accès Entrées', 'Accesso Dati'),
          tab: 'inputs',
          closeModal: 'propellant',
          description: loc(
            'En la pestaña Inputs, para abrir el gestor de propulsantes debes pulsar en el botón "Química & Propulsantes" situado en la cabecera del panel de granos (o en el enlace "Fórmula" de cualquier segmento de grano). Al hacer clic se despliega el catálogo completo.',
            'On the Inputs tab, click the "Propellant Chemistry" button in the grain header (or the "Formula" link on any grain segment). Clicking this opens the complete propellant synthesis manager.',
            'Sur l\'onglet Entrées, cliquez sur le bouton "Química & Propulsantes" pour ouvrir le gestionnaire.',
            'Nel pannello Dati, clicca sul pulsante "Química & Propulsantes" per aprire il gestore.'
          ),
          autofillLabel: loc('Abrir Catálogo de Propulsantes', 'Open Propellant Catalog', 'Ouvrir Catalogue', 'Apri Catalogo'),
          onAutofill: () => {
            window.dispatchEvent(new CustomEvent('hermes-open-propellant-modal', { detail: { startEditor: false } }));
          }
        },
        {
          id: 'propellant_catalog_inspection',
          targetSelector: '[data-tour="propellant-standard-section"]',
          title: loc('2. Propulsantes Existentes y Rangos de Presión', '2. Existing Propellants & Pressure Ranges', '2. Propergols Existants & Plages de Pression', '2. Propellenti Esistenti e Intervalli di Pressione'),
          category: loc('Catálogo', 'Catalog', 'Catalogue', 'Catalogo'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'catalog',
          description: loc(
            'Aquí se encuentran todos los propulsantes estándar (KNDX, KNSO, KNSU, KNAm, Sorbitol, Epoxy, APCP). Cada uno muestra sus propiedades termoquímicas calibradas (ρ, T₀, γ, M) y su tabla empírica de velocidad r(P) dividida en tramos de presión experimentales [P_mín - P_máx] con sus coeficientes a y n asociados.',
            'Here are all standard pre-calibrated propellants (KNDX, KNSO, KNSU, KNAm, Sorbitol, Epoxy, APCP). Each displays its thermochemical values (ρ, T₀, γ, M) and empirical r(P) burn rate table divided into experimental pressure ranges [P_min - P_max] with specific a and n coefficients.',
            'Voici tous les propergols pré-calibrés avec leurs tables empiriques découpées en plages de pression.',
            'Ecco tutti i propellenti pre-calibrati con tabelle empiriche suddivise per intervalli di pressione.'
          ),
          bulletPoints: [
            loc('Los propulsantes estándar están protegidos contra sobreescritura accidental para garantizar simulaciones fiables.', 'Standard propellants are write-protected to preserve calibrated experimental benchmark references.', 'Les propergols standards sont protégés pour garantir la précision.', 'I propellenti standard sono protetti per garantire simulazioni affidabili.'),
            loc('Cada intervalo [P_mín - P_máx] aplica la ley r = a · Pⁿ con los coeficientes representativos de ese régimen de presión.', 'Each range [P_min - P_max] calculates burn rate r = a · Pⁿ with coefficients tuned to that regime.', 'Chaque plage [P_min - P_max] applique r = a · Pⁿ avec ses coefficients propres.', 'Ciascun intervallo [P_min - P_max] applica r = a · Pⁿ con coefficienti dedicati.')
          ]
        },
        {
          id: 'propellant_new_action',
          targetSelector: '[data-tour="propellant-new-btn"]',
          title: loc('3. Crear Nuevo Propulsante o Duplicar Base', '3. Create New Propellant or Duplicate Base', '3. Créer un Nouveau Propergol ou Dupliquer', '3. Crea Nuovo Propellente o Duplica Base'),
          category: loc('Nuevo Propulsante', 'New Propellant', 'Nouveau Propergol', 'Nuovo Propellente'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'catalog',
          description: loc(
            'Para crear un nuevo propulsante propio desde cero, pulsa el botón morado "+ Nuevo Propulsante" arriba a la derecha. También puedes pulsar "Duplicar como Base" en cualquiera de los propulsantes existentes para cargar sus datos y editarlos rápidamente.',
            'To formulate a custom fuel from scratch, click the purple "+ New Propellant" button in the top right. Alternatively, click "Duplicate as Base" on any existing fuel to copy its values and modify them.',
            'Cliquez sur "+ Nouveau Propergol" ou sur "Dupliquer comme Base" pour modifier un propergol existant.',
            'Clicca su "+ Nuovo Propellente" o su "Duplica come Base" per caricare e modificare i dati.'
          ),
          autofillLabel: loc('Abrir Editor de Nuevo Propulsante', 'Open Propellant Editor', 'Ouvrir Éditeur', 'Apri Editor'),
          onAutofill: () => {
            window.dispatchEvent(new CustomEvent('hermes-start-new-propellant-editor'));
          }
        },
        {
          id: 'propellant_identity_step',
          targetSelector: '[data-tour="propellant-name-input"]',
          title: loc('4. Nombre y Familia Química del Propulsor', '4. Propellant Name & Chemical Family', '4. Nom et Famille du Propergol', '4. Nome e Famiglia del Propellente'),
          category: loc('Identificación', 'Identity', 'Identité', 'Identità'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Asigna un nombre descriptivo a tu formulación (ej. "KNSB 65/35 Experimental" o "Candy Dextrosa Modificado") y clasifícalo en su familia: Candy (azúcares), RNX (epoxi), APCP (percloratos) o Personalizado.',
            'Assign a clear name (e.g. "KNSB 65/35 Experimental") and select its family: Candy (sugar), RNX (epoxy), APCP (perchlorates), or Custom.',
            'Nommez votre carburant et choisissez sa famille chimique.',
            'Assegna un nome descrittivo e seleziona la famiglia chimica.'
          )
        },
        {
          id: 'propellant_thermo_inputs',
          targetSelector: '[data-tour="propellant-thermo-card"]',
          title: loc('5. Densidad y Termodinámica (ρ, T₀, γ, M)', '5. Density & Thermodynamics (ρ, T₀, γ, M)', '5. Densité & Thermodynamique (ρ, T₀, γ, M)', '5. Densità e Termodinamica (ρ, T₀, γ, M)'),
          category: loc('Propiedades Físicas', 'Physical Properties', 'Propriétés Physiques', 'Proprietà Fisiche'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Introduce los parámetros termoquímicos obtenidos de CEA (NASA Chemical Equilibrium with Applications) o ensayo experimental:',
            'Enter the thermochemical constants obtained from NASA CEA or experimental test analysis:',
            'Entrez les constantes thermochimiques issues de NASA CEA ou d\'essais réels :',
            'Inserisci i parametri termochimici ottenuti da NASA CEA o da prove sperimentali:'
          ),
          bulletPoints: [
            loc('Densidad ρ [g/cm³]: Masa volumétrica del grano colado (ej. 1.84 g/cm³ para KNSO).', 'Density ρ [g/cm³]: Packing volumetric mass of cast grain (e.g. 1.84 g/cm³ for KNSO).', 'Densité ρ [g/cm³] : Masse volumique du grain coulé.', 'Densità ρ [g/cm³]: Massa volumica del grano colato.'),
            loc('Temperatura de llama T₀ [K]: Temperatura adiabática de combustión (típicamente 1600 - 2800 K).', 'Flame Temp T₀ [K]: Adiabatic combustion temperature (typically 1600 - 2800 K).', 'Température de flamme T₀ [K] : Chaleur de réaction adiabatique.', 'Temperatura di fiamma T₀ [K]: Calore adiabatico di reazione.'),
            loc('Relación de calores γ: Coeficiente adiabático Cp/Cv del gas caliente (ej. 1.13 - 1.25).', 'Specific Heat Ratio γ: Cp/Cv ratio for gas mixture (e.g. 1.13 - 1.25).', 'Rapport γ : Cp/Cv des gaz chauds.', 'Rapporto γ: Cp/Cv dei gas caldi.'),
            loc('Masa molecular M [g/mol]: Peso molecular promedio de los productos de combustión (ej. 40 - 42 g/mol).', 'Molar Mass M [g/mol]: Average molecular weight of exhaust gases (e.g. 40 - 42 g/mol).', 'Masse molaire M [g/mol] : Poids moléculaire moyen des gaz.', 'Massa molecolare M [g/mol]: Peso molecolare medio dei gas.')
          ]
        },
        {
          id: 'propellant_burn_table_step',
          targetSelector: '[data-tour="propellant-burn-table"]',
          title: loc('6. Introducción de Rangos de Presión y Valores de A y N', '6. Pressure Ranges & A & N Parameters', '6. Plages de Pression et Valeurs de A et N', '6. Intervalli di Pressione e Parametri A ed N'),
          category: loc('Tabla r(P)', 'r(P) Table', 'Table r(P)', 'Tabella r(P)'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'En esta tabla introduces los intervalos de presión y los coeficientes experimentales "a" y "n" de la ley r = a · Pⁿ:',
            'Enter the pressure ranges and empirical "a" and "n" coefficients for the burn rate law r = a · Pⁿ:',
            'Définissez les plages de pression et les coefficients a et n associés :',
            'Definisci gli intervalli di pressione e i coefficienti a ed n associati:'
          ),
          bulletPoints: [
            loc('P_mín y P_máx [MPa]: Presión inferior y superior de cada intervalo experimental.', 'P_min and P_max [MPa]: Lower and upper pressure boundaries for each interval.', 'P_min et P_max [MPa] : Bornes de chaque intervalle.', 'P_min e P_max [MPa]: Limiti inferiore e superiore di ciascun intervallo.'),
            loc('Coeficiente "a": Escala la velocidad de quemado en mm/s.', 'Coefficient "a": Scales regression speed in mm/s.', 'Coefficient "a" : Vitesse de base en mm/s.', 'Coefficiente "a": Velocità di base in mm/s.'),
            loc('Exponente "n": Sensibilidad a la presión (recuerda: siempre n < 1.0 para estabilidad).', 'Exponent "n": Pressure sensitivity (always ensure n < 1.0 for chamber safety).', 'Exposant "n" : Sensibilité (doit rester < 1.0).', 'Esponente "n": Sensibilità alla pressione (sempre n < 1.0).'),
            loc('+ Añadir Tramo / Rango Único: Añade cuantos tramos necesites o fija un rango continuo de 0.1 a 99 MPa con 1 clic.', '+ Add Interval / Single Range: Append as many intervals as needed or set a single 0.1-99 MPa range in 1 click.', '+ Ajouter Palier : Définissez plusieurs tranches ou une plage unique.', '+ Aggiungi Intervallo: Definisci più scaglioni o un intervallo unico.')
          ]
        },
        {
          id: 'propellant_curve_preview',
          targetSelector: '[data-tour="propellant-curve-card"]',
          title: loc('7. Inspección Gráfica de la Curva r(P) en Tiempo Real', '7. Live Graphical Inspection of r(P) Curve', '7. Inspection Graphique en Direct r(P)', '7. Ispezione Grafica in Tempo Reale r(P)'),
          category: loc('Curva Balística', 'Ballistic Plot', 'Courbe Balistique', 'Curva Balistica'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'La gráfica interactiva evalúa en tiempo real tus intervalos de presión y coeficientes a y n desde 0.1 hasta 10.0 MPa. Permite comprobar visualmente que no existan discontinuidades bruscas en los empalmes de los tramos.',
            'The interactive plot computes burn velocity in real time from 0.1 to 10.0 MPa. Visually confirm that curve transitions between piecewise intervals are continuous and smooth.',
            'Vérifiez la continuité de la vitesse de régression sans sauts brutaux entre paliers.',
            'Verifica la continuità della velocità di combustione senza salti bruschi tra intervalli.'
          )
        },
        {
          id: 'propellant_save_action',
          targetSelector: '[data-tour="propellant-save-btn"]',
          title: loc('8. Guardar en tu Biblioteca de Propulsantes', '8. Save to Your Propellant Library', '8. Enregistrer dans la Bibliothèque', '8. Salva nella Libreria dei Propellenti'),
          category: loc('Guardado', 'Save', 'Sauvegarde', 'Salvataggio'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Al pulsar "Guardar Propulsante", tu combustible queda almacenado en tu navegador de forma persistente. Aparecerá en el catálogo con la etiqueta "Personalizado" y podrás seleccionarlo directamente en cualquier segmento de grano en la pestaña Inputs.',
            'Clicking "Save Propellant" permanently stores your custom fuel in local storage. It immediately appears in the catalog with the "Custom" badge, ready for assignment on any grain row.',
            'Cliquez sur "Enregistrer" pour stocker le carburant et l\'assigner à vos grains.',
            'Clicca su "Salva" per memorizzare il propellente e assegnarlo ai grani.'
          )
        }
      ]
    },

    // 5. TOUR: Interpretación de Resultados y Curvas Balísticas
    tour_results: {
      id: 'tour_results',
      title: loc('Guía: Interpretación de Resultados y Curvas', 'Guide: Results & Curve Analysis', 'Guide : Résultats & Courbes Balistiques', 'Guida: Risultati e Curve Balistiche'),
      description: loc(
        'Aprende a ejecutar una simulación limpia de 5.56 MPa, interpretar las cajetillas de métricas balísticas y analizar las curvas P(t) y F(t).',
        'Learn how to run a clean 5.56 MPa baseline simulation, interpret ballistic summary cards, and analyze P(t) & F(t) curves.',
        'Apprenez a exécuter une simulation propre à 5.56 MPa, interpréter les métriques et analyser les courbes.',
        'Impara ad eseguire una simulazione pulita a 5.56 MPa, interpretare le metriche e analizzare le curve.'
      ),
      steps: [
        {
          id: 'results_prereq_step',
          targetSelector: '[data-tour="tab-trigger-results"]',
          title: loc('1. Cargar Datos y Ejecutar Simulación (Botón SIMULAR)', '1. Load Motor Data & Run Simulation (SIMULATE Button)', '1. Charger Données & Exécuter Simulation', '1. Carica Dati ed Esegui Simulazione'),
          category: loc('Pestaña Results', 'Results Tab', 'Onglet Résultats', 'Pannello Risultati'),
          tab: 'results',
          description: loc(
            'Para poder visualizar y analizar las curvas y cajetillas de métricas en la pestaña Results, primero debes ejecutar una simulación. Si lo deseas, pulsa el botón "Cargar Motor BATES 3x54mm KNSB" a continuación para inyectar una configuración de motor probada. Después, pulsa el botón rojo "SIMULAR" arriba a la derecha y haz clic en "Siguiente" en esta guía para examinar los resultados.',
            'To view and analyze ballistic curves and metric cards on the Results tab, you must first run a simulation. Click "Load 3x54mm KNSB BATES Motor" below to inject a proven baseline engine configuration. Next, click the red "SIMULATE" button at the top right, then click "Next" in this guide to explore the outputs.',
            'Pour analyser les métriques et courbes, une simulation est requise. Cliquez sur "Charger Moteur BATES 3x54mm KNSB", puis sur le botón rouge SIMULER.',
            'Per analizzare le metriche e le curve, è necessaria una simulazione. Clicca su "Carica Motore BATES 3x54mm KNSB" e poi sul pulsante rosso SIMULA.'
          ),
          bulletPoints: [
            loc('Paso 1: Pulsa "Cargar Motor BATES 3x54mm KNSB" para inyectar la configuración estándar.', 'Step 1: Click "Load 3x54mm KNSB BATES Motor" to populate baseline inputs.', 'Étape 1 : Cliquez sur "Charger Moteur BATES 3x54mm KNSB".', 'Passo 1: Clicca su "Carica Motore BATES 3x54mm KNSB".'),
            loc('Paso 2: Pulsa el botón rojo "SIMULAR" arriba a la derecha para calcular el motor.', 'Step 2: Click the red "SIMULATE" button at top right to compute the motor.', 'Étape 2 : Cliquez sur le bouton rouge "SIMULER" en haut à droite.', 'Passo 2: Clicca sul pulsante rosso "SIMULA" in alto a destra.'),
            loc('Paso 3: Pulsa "Siguiente" para examinar la clasificación Tripoli, la presión P(t) y el empuje F(t).', 'Step 3: Click "Next" to inspect Tripoli class, pressure P(t), and thrust F(t).', 'Étape 3 : Cliquez sur "Suivant" pour explorer les résultats.', 'Passo 3: Clicca su "Avanti" per esaminare i risultati.')
          ],
          tip: loc(
            '¡Recuerda!: Si modificas cualquier dimensión en Inputs, vuelve a pulsar el botón rojo SIMULAR para recalcular los resultados.',
            'Remember: Whenever you modify any input dimension, hit the red SIMULATE button again to update results.',
            'Rappel : Si vous modifiez un paramètre, cliquez à nouveau sur SIMULER.',
            'Ricorda: Se modifichi un parametro, clicca di nuovo su SIMULA.'
          ),
          autofillLabel: loc('Cargar Motor BATES 3x54mm KNSB (5.56 MPa)', 'Load 3x54mm KNSB BATES Motor (5.56 MPa)', 'Charger Moteur BATES 3x54mm (5.56 MPa)', 'Carica Motore BATES 3x54mm (5.56 MPa)'),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setGrains([
                { id: 'bates-results-1', shape: 1, propellantType: 2, D0: 50, d0: 20, d0mayor: 0, L0: 120, N: 3, Np: 0, osi: 1, ci: 1, ei: 0, rhorat: 0.95 }
              ]);
              callbacks.setNozzle({ Dt0: 16.5, Ds: 36.0, e: 0, alpha: 14, etanoz: 0.88 });
              callbacks.setMotor({ Dc: 54, Lc: 400, Gstar: 2.0, kv: 1.0, etac: 0.92, paso_de_tiempo: 0.001, Pamb: 0.101325 });
            }
          }
        },
        {
          id: 'summary_cards',
          targetSelector: '[data-tour="results-summary-cards"]',
          title: loc('2. Explicación Detallada de las Cajetillas de Resultados', '2. Detailed Breakdown of Metric Summary Cards', '2. Explication Détaillée des Cartes de Métriques', '2. Spiegazione Dettagliata delle Schede di Risultato'),
          category: loc('Métricas Balísticas', 'Ballistic Metrics', 'Cartes Métriques', 'Schede Metriche'),
          tab: 'results',
          description: loc(
            'Las cajetillas de la parte superior concentran los indicadores numéricos fundamentales del rendimiento balístico del motor:',
            'The top metric cards present key performance indicators calculated by integrating time differential balances:',
            'Les cartes supérieures affichent les indicateurs clés calculés par intégration numérique :',
            'Le schede superiori mostrano gli indicatori chiave calcolati dall\'integrazione numerica:'
          ),
          bulletPoints: [
            loc('Clase de Motor (Tripoli/NFPA): Letra oficial de rendimiento (ej. I, J, K). Cada letra duplica la energía total del motor (ej. Clase J = 640.1 a 1280.0 N·s).', 'Motor Class (Tripoli/NFPA): Official impulse letter designation (e.g. I, J, K). Each letter doubles total energy capacity (e.g. Class J = 640.1 to 1280.0 N·s).', 'Classe de Moteur : Lettre officielle Tripoli/NFPA (ex. J = 640 à 1280 N·s).', 'Classe del Motore: Lettera ufficiale Tripoli/NFPA (es. J = 640 a 1280 N·s).'),
            loc('Impulso Total (It [N·s]): Trabajo propulsivo total producido por el motor (área bajo la curva F(t)).', 'Total Impulse (It [N·s]): Total propulsive output generated during combustion (area under F(t) thrust curve).', 'Impulsion Totale (It [N·s]) : Énergie propulsive totale (aire sous F(t)).', 'Impulso Totale (It [N·s]): Lavoro propulsivo totale (area sotto la curva F(t)).'),
            loc('Impulso Específico (Isp [s]): Eficiencia física del combustible (segundos de empuje producidos por unidad de peso de propelente consumido).', 'Specific Impulse (Isp [s]): Propellant mass efficiency (seconds of thrust delivered per unit weight of fuel burned).', 'Impulsion Spécifique (Isp [s]) : Efficacité massique du carburant.', 'Impulso Specifico (Isp [s]): Efficienza di massa del propellente.'),
            loc('Presión Máxima (Pmax [MPa]): Presión pico alcanzada en la cámara. Compárala con el límite elástico del tubo de presión para asegurar un Factor de Seguridad FS ≥ 1.5.', 'Max Chamber Pressure (Pmax [MPa]): Peak chamber pressure recorded. Must stay under 65% of casing hydrostatic burst limit (Safety Factor FS ≥ 1.5).', 'Pression Maximale (Pmax [MPa]) : Pression de crête à comparer avec la limite du carter.', 'Pressione Massima (Pmax [MPa]): Pressione di picco da confrontare con il limite del casing.'),
            loc('Tiempos de Combustión (tb) y Acción (tact): tb mide la duración del quemado activo del grano; tact incluye la despresurización residual de la cámara.', 'Burn Time (tb) & Action Time (tact): tb measures active grain regression; tact includes chamber depressurization tail-off.', 'Temps de combustion (tb) et d\'action (tact) : Consommation active vs fin de dépressurisation.', 'Tempi di combustione (tb) e azione (tact): Consumo attivo vs coda di depressurizzazione.'),
            loc('Empuje Medio (Favg) y Pico (Fmax): Fuerza promedio y máxima ejercida en Newtons [N] para acelerar el cohete.', 'Average (Favg) & Peak (Fmax) Thrust: Mean and maximum force delivered in Newtons [N] for airframe liftoff.', 'Poussée Moyenne (Favg) et Crête (Fmax) : Force délivrée en Newtons [N].', 'Spinta Media (Favg) e Picco (Fmax): Forza erogata in Newton [N].')
          ]
        },
        {
          id: 'pressure_curve',
          targetSelector: '[data-tour="pressure-chart-card"]',
          title: loc('3. Curva de Presión de Cámara P(t)', '3. Chamber Pressure Curve P(t)', '3. Courbe de Pression de Chambre P(t)', '3. Curva di Pressione in Camera P(t)'),
          category: loc('Gráfica P(t)', 'Pressure Plot', 'Graphique P(t)', 'Grafico P(t)'),
          tab: 'results',
          description: loc(
            'Muestra la evolución temporal de la presión en la cámara [MPa]. En un grano BATES bien diseñado, la curva presenta un encendido rápido, una meseta neutra plana y una caída limpia al consumirse la masa de web.',
            'Displays chamber pressure evolution over time [MPa]. A well-designed BATES motor produces a sharp ignition rise, an even neutral plateau, and a clean tail-off upon web burnout.',
            'Affiche l\'évolution de la pression [MPa] avec montée rapide et plateau neutre.',
            'Mostra l\'evoluzione della pressione [MPa] con accensione rapida e plateau neutro.'
          ),
          tip: loc(
            'Comprueba siempre que la meseta no presente pendientes ascendentes peligrosas (regresividad/progresividad excesiva).',
            'Verify that the plateau exhibits balanced neutrality without dangerous runaway pressure slopes.',
            'Vérifiez la neutralité du plateau.',
            'Verifica la neutralità del plateau.'
          )
        },
        {
          id: 'thrust_curve',
          targetSelector: '[data-tour="thrust-chart-card"]',
          title: loc('4. Curva de Empuje F(t) (Nakka vs TTI)', '4. Thrust Profile F(t) (Nakka vs TTI)', '4. Profil de Poussée F(t) (Nakka vs TTI)', '4. Profilo di Spinta F(t) (Nakka vs TTI)'),
          category: loc('Gráfica F(t)', 'Thrust Plot', 'Graphique F(t)', 'Grafico F(t)'),
          tab: 'results',
          description: loc(
            'Representa el empuje neto en Newtons [N] a lo largo del tiempo. Compara el modelo balístico clásico de Richard Nakka con el modelo cinético transitorio TTI.',
            'Depicts net thrust force in Newtons [N] over time. Compares Richard Nakka classical rocket model against the TTI transient flow balance model.',
            'Affiche la poussée en Newtons [N] en comparant le modèle Nakka et TTI.',
            'Mostra la spinta in Newton [N] confrontando il modello Nakka e TTI.'
          )
        }
      ]
    },

    // 6. NUEVA GUÍA SEPARADA: Exportación de Datos Numéricos (CSV / Excel)
    tour_export: {
      id: 'tour_export',
      title: loc('Guía: Exportación de Datos Numéricos a CSV y Excel', 'Guide: Numeric Data Export to CSV & Excel', 'Guide : Exportation Numérique vers CSV & Excel', 'Guida: Esportazione Dati Numerici in CSV ed Excel'),
      description: loc(
        'Aprende a exportar las series temporales de empuje F(t), presión P(t), flujo másico y resúmenes balísticos a formato CSV y Microsoft Excel.',
        'Learn how to export high-resolution F(t), P(t), mass flow time series and ballistic summaries into CSV and Excel files.',
        'Apprenez à exporter les séries temporelles de poussée, pression et débit massique vers CSV et Excel.',
        'Impara ad esportare le serie temporali di spinta, pressione e portata di massa in CSV ed Excel.'
      ),
      steps: [
        {
          id: 'export_csv_btn',
          targetSelector: '[data-tour="export-csv-btn"]',
          title: loc('1. Exportar Curvas Numéricas y Series Temporales', '1. Export Numeric Time Series & Curves', '1. Exporter les Séries Temporelles Numériques', '1. Esporta le Serie Temporali Numeriche'),
          category: loc('Exportación', 'Export', 'Export', 'Esportazione'),
          tab: 'results',
          description: loc(
            'Tras ejecutar una simulación, el botón "Exportar CSV / Excel" abre el diálogo de descarga de datos numéricos en alta resolución.',
            'After running a simulation, the "Export CSV / Excel" button opens the high-resolution data download dialog.',
            'Après la simulation, le bouton "Exportar CSV / Excel" génère les fichiers numérotés.',
            'Dopo la simulazione, il pulsante "Exportar CSV / Excel" genera i file dati.'
          ),
          bulletPoints: [
            loc('Series Temporales Balísticas: Archivo numérico con resolución del paso de integración dt conteniendo columnas de tiempo [s], presión manométrica en MPa, bar y atmósferas, empuje en N y kgf, y flujo másico ṁ [kg/s].', 'Ballistic Time Series: High-resolution dataset with integration step dt containing columns for time [s], gauge pressure in MPa, bar, and atm, thrust in N and kgf, and mass flow ṁ [kg/s].', 'Séries temporelles : Temps [s], pression (MPa, bar, atm), poussée (N, kgf) et débit ṁ [kg/s].', 'Serie temporali: Tempo [s], pressione (MPa, bar, atm), spinta (N, kgf) e portata ṁ [kg/s].'),
            loc('Resumen de Rendimiento: Tabla con los indicadores clave (Pmax, It, Isp, tb, clase Tripoli) lista para informes técnicos.', 'Performance Summary: Built-in summary table with key indicators (Pmax, It, Isp, tb, Tripoli class) ready for engineering reports.', 'Résumé de performances : Métriques clés prêtes pour rapports d\'ingénierie.', 'Riepilogo prestazioni: Metriche chiave pronte per report tecnici.'),
            loc('Compatibilidad con Bancos de Pruebas: Estructura formateada para importar directamente en Excel, MATLAB, Python o software de adquisición de celdas de carga.', 'Test Stand Compatibility: Pre-formatted structure compatible with Excel, MATLAB, Python, or load cell calibration software.', 'Compatibilité : Compatible Excel, MATLAB, Python et bancs de tir.', 'Compatibilità: Compatibile con Excel, MATLAB, Python e banchi di prova.')
          ]
        }
      ]
    },

    // 6B. NUEVA GUÍA SEPARADA: Guardar Simulaciones en la Biblioteca Local
    tour_save: {
      id: 'tour_save',
      title: loc('Guía: Guardar Simulaciones en la Biblioteca Local', 'Guide: Save Simulations to Local Library', 'Guide : Enregistrer en Bibliothèque Locale', 'Guida: Salvare le Simulazioni nella Libreria Locale'),
      description: loc(
        'Aprende a guardar la configuración completa del motor con nombre y carpeta personalizada, y cómo volver a recargarla desde la biblioteca.',
        'Learn how to save complete motor designs with custom names and folder groups, and reload them instantly from the library.',
        'Apprenez à sauvegarder vos moteurs dans des dossiers et à les recharger depuis la bibliothèque.',
        'Impara a salvare i motori in cartelle e a ricaricarli dalla libreria.'
      ),
      steps: [
        {
          id: 'save_sim_button_step',
          targetSelector: '[data-tour="save-sim-btn"]',
          title: loc('1. Dónde se Encuentra el Botón de Guardar', '1. Where to Find the Save Button', '1. Emplacement du Bouton Enregistrer', '1. Dove si Trova il Pulsante Salva'),
          category: loc('Barra Superior', 'Header Bar', 'Barre Supérieure', 'Barra Superiore'),
          tab: 'inputs',
          description: loc(
            'En la cabecera superior derecha de la interfaz dispones del botón "Guardar". Permite almacenar de forma persistente en tu navegador la configuración actual del motor.',
            'In the top right header bar, you find the "Save" button. It permanently stores the active motor configuration in your browser local storage.',
            'Dans la barre supérieure à droite, le bouton "Guardar" sauvegarde la configuration active.',
            'Nella barra superiore a destra, il pulsante "Salva" memorizza la configurazione attiva.'
          )
        },
        {
          id: 'save_modal_dialog_step',
          targetSelector: '[data-tour="save-sim-btn"]',
          title: loc('2. Asignar Nombre y Carpeta en la Ventana Modal', '2. Assign Simulation Name & Folder in Modal', '2. Nommer et Classer dans le Dialogue Modal', '2. Assegna Nome e Cartella nel Modale'),
          category: loc('Modal de Guardado', 'Save Modal', 'Dialogue Modal', 'Modale Salva'),
          tab: 'inputs',
          description: loc(
            'Al pulsar "Guardar" se abre una ventana modal emergente donde especificas los datos organizativos del proyecto:',
            'Clicking "Save" opens a modal popup where you enter project organization fields:',
            'Le clic sur Enregistrer ouvre un dialogue popup pour configurer le projet :',
            'Cliccando su Salva si apre un modale per impostare i dati del progetto:'
          ),
          bulletPoints: [
            loc('Nombre de la simulación: Título descriptivo para identificar el motor (ej. "Prototipo KNSB 3x54mm V1").', 'Simulation Name: Descriptive title identifying the design (e.g. "3x54mm KNSB Prototype V1").', 'Nom de la simulation : Titre explicite (ex. "Prototype KNSB 3x54mm").', 'Nome della simulazione: Titolo descrittivo (es. "Prototipo KNSB 3x54mm").'),
            loc('Carpeta / Grupo: Categoría organizativa para agrupar proyectos (ej. "Motores BATES", "Candy", "Pruebas Estáticas").', 'Folder / Group: Category field to group project files (e.g. "BATES Motors", "Candy", "Static Tests").', 'Dossier / Groupe : Catégorie d\'organisation (ex. "Moteurs BATES").', 'Cartella / Gruppo: Categoria di organizzazione (es. "Motori BATES").'),
            loc('Guardado Persistente: Al pulsar Guardar en la modal, la geometría, carcasa, tobera y granos quedan grabados en localStorage.', 'Persistent Save: Hitting Save in the modal records casing, nozzle, and grain parameters in browser localStorage.', 'Enregistrement : Stocke carter, tuyère et grains dans le localStorage.', 'Salvataggio: Memorizza casing, ugello e grani nel localStorage.')
          ]
        },
        {
          id: 'library_explorer_step',
          targetSelector: '[data-tour="library-btn"]',
          title: loc('3. Acceder y Recargar desde la Biblioteca', '3. Access & Reload from Simulations Library', '3. Recharger depuis la Bibliothèque', '3. Ricarica dalla Libreria Simulazioni'),
          category: loc('Biblioteca', 'Library', 'Bibliothèque', 'Libreria'),
          tab: 'inputs',
          description: loc(
            'Junto al botón Guardar se encuentra el botón "Biblioteca". Abre el explorador de simulaciones clasificadas por carpetas. Al hacer clic sobre cualquier motor guardado, se recarga instantáneamente toda la geometría en pantalla para seguir iterando.',
            'Next to the Save button is the "Library" button. Opens the file explorer organized by folder categories. Click on any saved motor to immediately reload its complete geometry onto the screen for further iterations.',
            'Le bouton "Biblioteca" ouvre l\'explorateur par dossiers. Cliquez sur un moteur para le recharger.',
            'Il pulsante "Biblioteca" apre l\'esploratore per cartelle. Clicca su un motore per ricaricarlo.'
          )
        }
      ]
    },

    // 7. NUEVA GUÍA: Mission Control y Vuelo 1D
    tour_mission_control: {
      id: 'tour_mission_control',
      title: loc('Guía: Mission Control, Datos y Vuelo 1D', 'Guide: Mission Control, Data & 1D Flight', 'Guide : Mission Control, Données & Vol 1D', 'Guida: Mission Control, Dati e Volo 1D'),
      description: loc(
        'Aprende a configurar pesos de simulación, nivel del mar, curvas Mach vs Cd, importación de datos experimentales con unidades y análisis de apogeo.',
        'Learn how to set simulation weights, launch altitude, Mach vs Cd curves, experimental test stand import with unit selection, and apogee analysis.',
        'Apprenez à configurer les masses, l\'altitude, les courbes Mach vs Cd et l\'import de données expérimentales.',
        'Impara a configurare pesi di simulazione, quota di lancio, curve Mach vs Cd e importazione di dati sperimentali.'
      ),
      steps: [
        {
          id: 'mission_rocket_params',
          targetSelector: '[data-tour="mission-rocket-params-card"]',
          title: loc('1. Parámetros del Cohete y Entorno de Lanzamiento', '1. Rocket Parameters & Launch Environment', '1. Paramètres de la Fusée & Environnement de Tir', '1. Parametri del Razzo e Ambiente di Lancio'),
          category: loc('Parámetros de Vuelo', 'Flight Inputs', 'Paramètres de Vol', 'Parametri di Volo'),
          tab: 'mission_control',
          description: loc(
            'En esta tarjeta configuras la estructura física del cohete y las condiciones barométricas de la rampa de lanzamiento:',
            'Configure rocket mechanical mass properties and launch pad atmospheric conditions:',
            'Configurez la masse mécanique de la fusée et l\'atmosphère du pas de tir :',
            'Configura la massa meccanica del razzo e le condizioni atmosferiche della rampa:'
          ),
          bulletPoints: [
            loc('Masa en seco (Dry Mass [kg]): Masa de la estructura, aviónica y paracaídas sin contar el motor.', 'Dry Mass [kg]: Total mass of airframe, nosecone, avionics, and recovery parachute without motor.', 'Masse à vide (Dry Mass [kg]) : Fusée complète sans le moteur.', 'Massa a secco (Dry Mass [kg]): Struttura, avionica e paracadute senza motore.'),
            loc('Diámetro [mm]: Diámetro exterior del fuselaje que define el área frontal transversal expuesta al aire.', 'Diameter [mm]: Outer body tube caliber determining frontal cross-section area exposed to flow.', 'Diamètre [mm] : Calibre extérieur déterminant la surface frontale.', 'Diametro [mm]: Calibro esterno del tubo che definisce l\'area frontale.'),
            loc('Altitud de Lanzamiento [m]: Elevación de la rampa sobre el nivel del mar. Afecta directamente a la densidad atmosférica ρ(z), presión y gravedad.', 'Launch Altitude [m]: Launch site elevation above sea level. Directly alters ambient density ρ(z), pressure, and gravity.', 'Altitude de tir [m] : Altitude du pas de tir modifiant la densité de l\'air.', 'Quota di lancio [m]: Altitudine della rampa sul livello del mare che modifica la densità dell\'aria.'),
            loc('Temperatura [ºC]: Temperatura ambiente local que fija la velocidad del sonido a = √(γ·R·T) para el número de Mach.', 'Launch Temp [ºC]: Local ambient temperature setting speed of sound a = √(γ·R·T) for Mach calculation.', 'Température [ºC] : Fixe la vitesse locale du son.', 'Temperatura [ºC]: Temperatura ambiente che determina la velocità del suono.'),
            loc('Botón "Actualizar": Tras modificar cualquiera de estos parámetros, pulsa "Actualizar" para reejecutar la integración numérica del vuelo.', '"Update" Button: After changing any parameter, click "Update" to re-run the 1D numerical trajectory integration.', 'Bouton "Actualiser" : Cliquez pour recalculer la trajectoire 1D.', 'Pulsante "Aggiorna": Clicca per ricalcolare la traiettoria 1D.')
          ]
        },
        {
          id: 'mission_aero_drag',
          targetSelector: '[data-tour="mission-aero-card"]',
          title: loc('2. Resistencia Aerodinámica y Curva Mach vs Cd', '2. Aerodynamic Drag & Mach vs Cd Curve', '2. Traînée Aérodynamique & Courbe Mach vs Cd', '2. Resistenza Aerodinamica e Curva Mach vs Cd'),
          category: loc('Aerodinámica', 'Aerodynamics', 'Aérodynamique', 'Aerodinamica'),
          tab: 'mission_control',
          description: loc(
            'El simulador resuelve la fuerza de frenado por resistencia atmosférica Fd = ½ · ρ · v² · A · Cd. Puedes usar el modelo estándar o cargar tus propios datos aerodinámicos:',
            'The simulator computes atmospheric braking drag force Fd = ½ · ρ · v² · A · Cd. You can use default supersonic profiles or load custom aerodynamic data:',
            'Calcule la force de traînée Fd = ½ · ρ · v² · A · Cd avec profil standard ou personnalisé :',
            'Calcola la forza frenante di resistenza Fd = ½ · ρ · v² · A · Cd con modello standard o personalizzato:'
          ),
          bulletPoints: [
            loc('Casilla "Usar Personalizado": Actívala para utilizar tus propios datos aerodinámicos calculados en OpenRocket, RASAero o túnel de viento.', '"Use Custom" Checkbox: Check this to feed your own aerodynamic polar computed in OpenRocket, RASAero, or wind tunnel tests.', 'Case "Utiliser Personnalisé" : Activez pour charger vos données OpenRocket ou RASAero.', 'Casella "Usa Personalizzato": Attiva per caricare i dati calcolati in OpenRocket o RASAero.'),
            loc('Descargar Plantilla CSV: Botón para descargar una plantilla con la cabecera "Mach,Cd" lista para rellenar.', 'Download CSV Template: Convenient button to download a spreadsheet template with "Mach,Cd" headers.', 'Télécharger Modèle CSV : Télécharge un fichier type Mach vs Cd prêt à l\'emploi.', 'Scarica Modello CSV: Scarica un file modello Mach vs Cd pronto all\'uso.'),
            loc('Importar Archivo o Editor Manual: Arrastra tu archivo .CSV o Excel (.xlsx), o pega directamente los pares numéricos en el editor de texto integrado.', 'File Upload or Manual Editor: Drop your CSV or Excel (.xlsx) file, or paste raw numeric rows into the manual tab.', 'Import ou Éditeur Manuel : Glissez votre fichier Excel/CSV ou collez les données.', 'Carica File o Editor Manuale: Trascina il file Excel/CSV o incolla i dati nell\'editor.'),
            loc('Insignia de Estado y Actualizar: Muestra el número de puntos leídos, rango Mach y Cd pico. Pulsa "Actualizar" para recalcular el vuelo.', 'Status Badge & Update: Shows loaded points, Mach envelope, and max Cd. Hit "Update" to apply to the trajectory.', 'Statut et Actualisation : Affiche les points chargés. Cliquez sur Actualiser.', 'Stato e Aggiorna: Mostra i punti caricati. Clicca su Aggiorna per ricalcolare.')
          ]
        },
        {
          id: 'mission_exp_import',
          targetSelector: '[data-tour="mission-exp-card"]',
          title: loc('3. Importación de Datos de Banco de Pruebas y Unidades', '3. Test Stand Data Import & Unit Selection', '3. Import de Données de Banc d\'Essai & Unités', '3. Importazione Dati da Banco Prova e Unità'),
          category: loc('Datos de Ensayo', 'Experimental Data', 'Données Réelles', 'Dati Sperimentali'),
          tab: 'mission_control',
          description: loc(
            'Permite importar curvas reales registradas por transductores de presión y celdas de carga en tu banco de pruebas estático:',
            'Allows importing real-world firing logs recorded by load cells or pressure transducers on your static test bench:',
            'Permet d\'importer les courbes réelles de capteurs de pression et cellules de charge :',
            'Permette di importare le curve reali registrate da trasduttori di pressione e celle di carico:'
          ),
          bulletPoints: [
            loc('Estructura de Columnas: Selecciona entre "Tiempo y Empuje" (fuerza directa), "Tiempo y Presión" (calcula empuje estimado con la tobera Dt0), "Tiempo, Presión y Empuje" (3 columnas compartiendo tiempo) o "Tiempos Independientes" (4 columnas interpoladas si cada sensor tuvo frecuencias distintas).', 'Data Columns: Choose between "Time & Thrust" (direct load cell), "Time & Pressure" (estimates thrust using nozzle throat Dt0), "Shared Time" (3 columns), or "Independent Times" (4 columns automatically synchronized and interpolated).', 'Colonnes de données : Temps & Poussée, Temps & Pression, Temps Partagé ou Temps Indépendants synchronisés.', 'Colonne di dati: Tempo e Spinta, Tempo e Pressione, Tempo Condiviso o Tempi Indipendenti sincronizzati.'),
            loc('Selectores de Unidades: Puedes elegir las unidades exactas de tus sensores para Presión (MPa, Pa, bar, atm, psi) y Fuerza (N, kN, kgf, lbf). El conversor normaliza todo automáticamente.', 'Unit Selectors: Match your acquisition hardware for Pressure (MPa, Pa, bar, atm, psi) and Force (N, kN, kgf, lbf). Auto-converted seamlessly.', 'Sélecteurs d\'Unités : Choisissez les unités de vos capteurs (MPa, bar, psi, N, kgf, lbf).', 'Selettori di Unità: Seleziona le unità dei tuoi sensori (MPa, bar, psi, N, kgf, lbf). Conversione automatica.'),
            loc('Descargar Plantilla y Arrastrar Archivo: Descarga el CSV de ejemplo o suelta tu archivo de registro.', 'Download Template & Drop File: Download sample CSV structure or drag-and-drop your logged test file.', 'Télécharger Modèle : Téléchargez le format type et glissez votre fichier.', 'Scarica Modello: Scarica il file di esempio e trascina il tuo log di prova.'),
            loc('Botón "Actualizar": Procesa las curvas experimentales y genera la predicción de vuelo comparativa.', '"Update" Button: Ingests the experimental profile and computes corresponding real flight apogee.', 'Bouton "Actualiser" : Traite les données pour comparer le vol expérimental.', 'Pulsante "Aggiorna": Elabora i dati per confrontare il volo sperimentale.')
          ]
        },
        {
          id: 'mission_flight_charts',
          targetSelector: '[data-tour="mission-charts-card"]',
          title: loc('4. Resultados de Vuelo, Curvas de Apogeo y Exportación', '4. Flight Outputs, Apogee Curves & Export', '4. Résultats de Vol, Profil d\'Apogée & Export', '4. Risultati di Volo, Curve di Apogeo ed Export'),
          category: loc('Trayectoria 1D', 'Trajectory 1D', 'Trajectoire 1D', 'Traiettoria 1D'),
          tab: 'mission_control',
          description: loc(
            'En esta sección visualizas la integración completa del vuelo vertical y contrastas la simulación teórica con el disparo real:',
            'Inspect full vertical trajectory integration and contrast theoretical predictions against test stand firings:',
            'Visualisez l\'intégration complète du vol et comparez la théorie aux essais réels :',
            'Visualizza l\'integrazione completa del volo e confronta la teoria con i lanci reali:'
          ),
          bulletPoints: [
            loc('Métricas Clave: Apogeo máximo [m], tiempo hasta el apogeo [s], velocidad máxima [m/s] y aceleración pico [m/s²].', 'Key Metrics: Peak apogee altitude [m], time to apogee [s], maximum velocity [m/s], and peak acceleration [m/s²].', 'Métriques clés : Altitude d\'apogée maximale [m], temps d\'apogée, vitesse max et accélération de crête.', 'Metriche chiave: Quota massima di apogeo [m], tempo di apogeo, velocità massima e accelerazione di picco.'),
            loc('Selector de Gráficas: Alterna entre el "Perfil de Altitud" y la "Curva de Empuje" para ver cómo asciende el cohete y cuándo se produce el corte de combustión (burnout).', 'Chart Selector: Toggle between "Altitude Profile" and "Thrust" to track ascent and engine burnout timing.', 'Sélecteur de Graphiques : Basculez entre Profil d\'Altitude et Courbe de Poussée.', 'Selettore Grafici: Alterna tra Profilo di Altitudine e Curva di Spinta.'),
            loc('Comparación Simulación vs Experimental: Si cargaste datos de banco estático, ambas curvas se superponen en la misma gráfica para validar el modelo antes de lanzar.', 'Simulation vs Experimental Comparison: When test stand data is loaded, both trajectories plot side-by-side to validate your motor model.', 'Comparaison Théorie vs Réel : Superposition des deux trajectoires sur le même graphique.', 'Confronto Teoria vs Sperimentale: Sovrapposizione delle due traiettorie sullo stesso grafico.'),
            loc('Exportación de Datos: Al igual que en Results, puedes exportar la serie temporal de vuelo a CSV y Excel.', 'Data Export: Just like in Results, export full flight trajectories to CSV and Microsoft Excel.', 'Export de données : Export des données de vol vers CSV et Excel.', 'Esportazione dati: Esporta le traiettorie di volo in formato CSV ed Excel.')
          ]
        }
      ]
    },

    // 8. TOUR: Smart Search (Diseño Inverso con 3 Fases)
    tour_smart_search: {
      id: 'tour_smart_search',
      title: loc('Guía: Optimización Inversa con Smart Search', 'Guide: Smart Search Inverse Optimization', 'Guide : Optimisation Inverse Smart Search', 'Guida: Ottimizzazione Inversa Smart Search'),
      description: loc(
        'Cómo diseñar automáticamente el motor óptimo fijando metas de presión y empuje con algoritmos aeroespaciales.',
        'Automate optimal motor geometry design across 3 distinct phases using evolutionary aerospace solvers.',
        'Concevez automatiquement le moteur optimal grâce aux algorithmes aérospatiaux.',
        'Progetta automaticamente il motore ottimale con algoritmi aerospaziali.'
      ),
      steps: [
        {
          id: 'smart_search_goal',
          targetSelector: '[data-tour="smart-search-goal-card"]',
          title: loc('Paso 1: Selección del Objetivo de Misión', 'Step 1: Mission Objective Selection', 'Étape 1 : Sélection de l\'objectif de mission', 'Passo 1: Selezione dell\'obiettivo di missione'),
          category: loc('Paso 1: Objetivos', 'Step 1: Goals', 'Étape 1 : Objectifs', 'Passo 1: Obiettivi'),
          tab: 'smart_search',
          smartSearchStep: 0,
          description: loc(
            'En el primer paso, seleccionas el objetivo de propulsión primario en la bandeja inicial (en este caso, Máxima Altitud / Mayor Impulso Total It = ∫ F dt). Al pulsar ahí, accedes directamente al desarrollo de las fases de configuración.',
            'In Step 1, select your primary propulsion objective in the initial tray (in this case, Maximum Altitude / Peak Total Impulse It = ∫ F dt). Clicking here automatically opens the phase configuration flow.',
            'En Étape 1, sélectionnez votre objectif principal de propulsion dans le plateau initial (Impulsion Totale Maximale).',
            'Nel Passo 1, seleziona l\'obiettivo di propulsione primario nel vassoio iniziale (Impulso Totale Massimo).'
          )
        },
        {
          id: 'smart_search_phase1',
          targetSelector: '[data-tour="smart-search-phase1-card"]',
          title: loc('Paso 2: Parámetros de Diseño (Fase 1: Cámara y Tobera)', 'Step 2: Design Parameters (Phase 1: Chamber & Nozzle)', 'Étape 2 : Paramètres de Conception (Phase 1 : Chambre et Tuyère)', 'Passo 2: Parametri di Progetto (Fase 1: Camera e Ugello)'),
          category: loc('Paso 2: Parámetros', 'Step 2: Parameters', 'Étape 2 : Paramètres', 'Passo 2: Parametri'),
          tab: 'smart_search',
          smartSearchStep: 1,
          description: loc(
            'En el segundo paso introduces las cotas físicas inmutables de tu motor actual: diámetro de cámara (Dc), longitud útil (Lc), límite de sobrepresión segura (Pmax) y la tobera fija (diámetro de garganta Dt, salida Ds y ángulo α). Revisa los avisos en vivo si una cota es físicamente incoherente.',
            'In Step 2, define your fixed casing and nozzle dimensions: casing inner diameter (Dc), usable length (Lc), max pressure limit (Pmax), and fixed nozzle (throat Dt, exit Ds, and angle α). Live validation alerts highlight non-physical values immediately.',
            'En Étape 2, entrez les dimensions physiques de la chambre (Dc, Lc), de la tuyère (Dt, Ds) et la pression maximale.',
            'Nel Passo 2 inserisci le dimensioni fisse di camera (Dc, Lc), ugello (Dt, Ds) e il limite di pressione sicura.'
          )
        },
        {
          id: 'smart_search_phase2',
          targetSelector: '[data-tour="smart-search-phase2-card"]',
          title: loc('Paso 3: Restricciones de los Granos (Fase 2: Granos)', 'Step 3: Grain Constraints (Phase 2: Grain Geometry)', 'Étape 3 : Contraintes des Grains (Phase 2 : Géométrie des Grains)', 'Passo 3: Vincoli dei Grani (Fase 2: Geometria dei Grani)'),
          category: loc('Paso 3: Granos', 'Step 3: Grains', 'Étape 3 : Grains', 'Passo 3: Grani'),
          tab: 'smart_search',
          smartSearchStep: 2,
          description: loc(
            'En el tercer paso configuras qué variables geométricas puede explorar el optimizador: forma del grano (BATES, Estrella, Macizo), cantidad de bloques N, modos Libre, Fijo o Rango para D0, d0, L0, superficies de quemado activas o inhibidas y la restricción de masa total de propelente Mprop.',
            'In Step 3, configure which geometric variables the solver can explore: grain shape (BATES, Star, Solid), segment count N, Free/Fixed/Range modes for D0, d0, L0, active burn surfaces, and total propellant mass constraint Mprop.',
            'En Étape 3, définissez la forme des grains, le nombre de blocs N, les modes de dimension et la masse totale.',
            'Nel Passo 3 imposti la forma del grano, il numero di segmenti N, i modi dimensionali e la massa totale.'
          )
        },
        {
          id: 'smart_search_phase3',
          targetSelector: '[data-tour="smart-search-phase3-card"]',
          title: loc('Paso 4: Seleccionar el Algoritmo y Presupuesto (Fase 3)', 'Step 4: Select Algorithm & Budget (Phase 3)', 'Étape 4 : Sélectionner l\'Algorithme (Phase 3)', 'Passo 4: Selezionare l\'Algoritmo e Budget (Fase 3)'),
          category: loc('Paso 4: Algoritmos', 'Step 4: Algorithms', 'Étape 4 : Algorithmes', 'Passo 4: Algoritmi'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'En el cuarto paso seleccionas el presupuesto y tipo de algoritmo de Búsqueda Evolutiva (Evolución Diferencial DE/rand/1/bin) para ejecutar el optimizador:',
            'In Step 4, select your Differential Evolution algorithm budget and execution preset:',
            'En Étape 4, choisissez votre budget de simulation et le mode d\'algorithme :',
            'Nel Passo 4 seleziona il budget e il tipo di algoritmo di Evoluzione Differenziale:'
          ),
          bulletPoints: [
            loc(
              '1. Búsqueda Rápida (500 simulaciones/N): Muestreo inicial con Latin Hypercube (LHS) y evolución ágil para tanteo rápido.',
              '1. Fast Search (500 simulations/N): Initial Latin Hypercube (LHS) sampling and rapid evolution for quick exploration.',
              '1. Recherche Rapide (500 simulations/N) : Échantillonnage LHS initial pour exploration rapide.',
              '1. Ricerca Rapida (500 simulazioni/N): Campionamento LHS per esplorazione veloce.'
            ),
            loc(
              '2. Búsqueda Estándar (1.000 simulaciones/N - ¡RECOMENDADO!): Equilibrio ideal entre tiempo y convergencia balística de alta fidelidad.',
              '2. Standard Search (1,000 simulations/N - RECOMMENDED!): Optimal balance between runtime and high-fidelity ballistic convergence.',
              '2. Recherche Standard (1 000 simulations/N - RECOMMANDÉ !) : Équilibre idéal entre temps et convergence de haute fidélité.',
              '2. Ricerca Standard (1.000 simulazioni/N - RACCOMANDATO!): Equilibrio ideale tra tempo e convergenza di alta fedeltà.'
            ),
            loc(
              '3. Búsqueda Profunda (2.000 simulaciones/N): Máxima exploración global para geometrías intrincadas o carcasas de alta esbeltez.',
              '3. Deep Search (2,000 simulations/N): Maximum global exploration for complex geometries and slender motor casings.',
              '3. Recherche Profonde (2 000 simulations/N) : Exploration globale maximale pour géométries complexes.',
              '3. Ricerca Profonda (2.000 simulazioni/N): Massima esplorazione globale per geometrie complesse.'
            )
          ]
        },
        {
          id: 'smart_search_algo_btn',
          targetSelector: '[data-tour="smart-search-algorithm-btn"]',
          title: loc('Paso 5: Información sobre Algoritmos y Formulación', 'Step 5: Information on Algorithms & Formulation', 'Étape 5 : Information sur les Algorithmes et Formulation', 'Passo 5: Informazioni su Algoritmi e Formulazione'),
          category: loc('Paso 5: Formulación', 'Step 5: Formulation', 'Étape 5 : Formulation', 'Passo 5: Formulazione'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'Al pulsar en el botón "Algoritmo & Formulación" en la barra superior desplegarás la ficha informativa detallada sobre los algoritmos que se están siguiendo, la formulación física 0D intacta y las reglas de factibilidad de Deb.',
            'Clicking "Algorithm & Formulation" in the top bar reveals detailed information explaining the optimization algorithms being executed, the intact 0D physical formulation, and Deb feasibility rules.',
            'En cliquant sur ce bouton, vous affichez des informations détaillées sur les algorithmes utilisés et la formulation physique.',
            'Cliccando questo pulsante visualizzi informazioni dettagliate sugli algoritmi utilizzati e la formulazione fisica.'
          ),
          bulletPoints: [
            loc(
              '• Modus Operandi de Algoritmos: Población, generaciones y parámetros de mutación y cruce de Evolución Diferencial (DE/rand/1/bin).',
              '• Algorithm Modus Operandi: Population, generation counts, and differential mutation/crossover parameters.',
              '• Modus Operandi des Algorithmes : Population, générations et paramètres de mutation/croisement.',
              '• Modus Operandi degli Algoritmi: Popolazione, generazioni e parametri di mutazione.'
            ),
            loc(
              '• Física 0D Intacta: Integración balística de la ley de Vieille (r = a·Pⁿ), continuidad másica en cámara y flujo isentrópico en tobera sin aproximaciones ficticias.',
              '• Intact 0D Physics: Complete numerical integration of Vieille burn law (r = a·Pⁿ), chamber mass continuity, and Laval nozzle flow without altering physical equations.',
              '• Physique 0D Intacte : Intégration numérique complète de la loi de Vieille sans modification des équations.',
              '• Fisica 0D Intatta: Integrazione numerica completa della legge di Vieille senza modificare le equazioni.'
            ),
            loc(
              '• Reglas de Factibilidad de Deb (1998): Selección rígida donde las soluciones factibles (Pmax ≤ Plim) dominan y gana el máximo impulso total puro (Max It).',
              '• Deb Feasibility Rules (1998): Strict rank selection where feasible candidates (Pmax ≤ Plim) dominate and pure total impulse (Max It) wins.',
              '• Règles de Faisabilité de Deb : Sélection stricte où les solutions réalisables dominent et le résultat de poussée maximale l\'emporte.',
              '• Regole di Fattibilità di Deb: Selezione rigida in cui le soluzioni ammissibili dominano e vince il massimo impulso.'
            )
          ]
        },
        {
          id: 'smart_search_execute',
          targetSelector: '[data-tour="smart-search-run-btn"]',
          title: loc('Paso 6: Ejecución y Cancelación de Simulación en Vivo', 'Step 6: Execution & Live Simulation Cancel', 'Étape 6 : Exécution et Annulation en Direct', 'Passo 6: Esecuzione e Annullamento in Tempo Reale'),
          category: loc('Paso 6: Ejecución', 'Step 6: Execution', 'Étape 6 : Exécution', 'Passo 6: Esecuzione'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'Pulsa "Ejecutar Optimizador Global" para iniciar las simulaciones balísticas. Si la simulación tarda o necesitas cambiar algo, dispones de un botón de CANCELAR SIMULACIÓN en rojo que detiene la búsqueda y te devuelve los mejores resultados encontrados hasta la fecha.',
            'Click "Run Global Optimizer" to execute candidate motor evaluations. If a deep search takes too long or you need to make changes, a red CANCEL SIMULATION button allows you to safely stop execution and instantly retrieve all best feasible results found up to that timestamp.',
            'Cliquez pour lancer les simulations. Si la recherche est longue, le bouton rouge Annuler permet d\'arrêter et d\'obtenir les meilleurs résultats actuels.',
            'Clicca per avviare la ricerca. Se la ricerca richiede tempo, il pulsante rosso Annulla consente di interrompere e recuperare i migliori risultati attuali.'
          )
        }
      ]
    },

    // 9. TOUR: Tour General del Simulador (7 Pestañas)
    tour_full: {
      id: 'tour_full',
      title: loc('Guía: Tour General por las 7 Pestañas', 'Guide: General Walkthrough of All 7 Tabs', 'Guide : Tour Général des 7 Onglets', 'Guida: Tour Generale dei 7 Pannelli'),
      description: loc(
        'Explicación clara y detallada de qué se hace y qué objetivo tiene cada una de las 7 pestañas del simulador HERMES.',
        'Clear, structured overview explaining the purpose and workflow of all 7 tabs in HERMES simulator.',
        'Explication claire du rôle et des fonctionnalités de chacun des 7 onglets du simulateur.',
        'Spiegazione chiara dello scopo e del flusso di lavoro di ciascuno dei 7 pannelli del simulatore.'
      ),
      steps: [
        {
          id: 'full_inputs',
          targetSelector: '[data-tour="tab-trigger-inputs"]',
          title: loc('1. Pestaña Inputs (Entradas): Parámetros y Objetivo', '1. Inputs Tab: Parameters & Purpose', '1. Onglet Entrées : Paramètres et Objectif', '1. Pannello Dati: Parametri e Scopo'),
          category: loc('Pestaña 1', 'Tab 1', 'Onglet 1', 'Pannello 1'),
          tab: 'inputs',
          description: loc(
            'El objetivo de esta pestaña es configurar la física, geometría y química completa del motor cohete antes de disparar la simulación.',
            'The purpose of this tab is to configure the complete physics, geometry, and propellant chemistry before running a simulation.',
            'L\'objectif de cet onglet est de configurer la physique, la géométrie et la chimie du moteur.',
            'Lo scopo di questo pannello è configurare la fisica, la geometria e la chimica del motore.'
          ),
          bulletPoints: [
            loc('Cámara de Combustión: Diámetro interior (Dc), longitud útil (Lc), flujo másico umbral de erosión (G*), factor de velocidad (kv), rendimiento de cámara (ηc), paso de tiempo de integración (dt) y presión ambiente (Pamb).', 'Combustion Chamber: Inside casing diameter (Dc), usable length (Lc), erosive threshold flux (G*), velocity factor (kv), chamber efficiency (ηc), integration time-step (dt), and ambient pressure (Pamb).', 'Chambre de combustion : Diamètre (Dc), longueur (Lc), seuil érosif (G*), efficacité (ηc) et pas de temps (dt).', 'Camera di combustione: Diametro interno (Dc), lunghezza (Lc), flusso soglia (G*), efficienza (ηc) e passo temporale (dt).'),
            loc('Tobera Laval: Diámetro inicial de garganta (Dt0), diámetro de salida (Ds), ángulo del cono divergente (α), rendimiento de tobera (ηnoz) y modelo dinámico de escoria o erosión.', 'De Laval Nozzle: Initial throat diameter (Dt0), exit diameter (Ds), divergence half-angle (α), nozzle efficiency (ηnoz), and dynamic erosion/slag parameters.', 'Tuyère Laval : Diamètre au col (Dt0), diamètre de sortie (Ds), angle de divergence (α) et modèle d\'érosion/scories.', 'Ugello Laval: Diametro della gola (Dt0), diametro di uscita (Ds), angolo di divergenza (α) e modello di erosione/scorie.'),
            loc('Pila de Granos: Forma (Cilíndrico BATES, Estrella con Np puntas, Macizo), dimensiones (D0, d0, L0), número de bloques (N), caras activas (EXT, ENDS, INT) y fórmula de propelente.', 'Propellant Grain Stack: Shape (BATES cylindrical, Star with Np points, Solid end-burner), dimensions (D0, d0, L0), segment multiplier (N), active faces (EXT, ENDS, INT), and propellant fuel selection.', 'Blocs de propergol : Forme (BATES, Étoile, Massif), dimensions (D0, d0, L0), nombre de segments (N) et faces actives.', 'Blocchi di propellente: Forma (BATES, Stella, Massiccio), dimensioni (D0, d0, L0), numero di segmenti (N) e facce attive.')
          ],
          tip: loc(
            'Tras rellenar tus datos, pulsa el botón rojo "SIMULAR" arriba a la derecha para resolver las ecuaciones balísticas en milisegundos.',
            'Once parameters are set, click the prominent red "SIMULATE" button at the top right to solve ballistic equations in milliseconds.',
            'Cliquez sur "SIMULER" pour calculer les équations différentielles balistiques en millisecondes.',
            'Dopo aver impostato i parametri, clicca su "SIMULA" per risolvere le equazioni balistiche.'
          ),
          autofillLabel: loc('Simular Motor Ahora', 'Run Simulation Now', 'Simuler Maintenant', 'Simula Ora'),
          onAutofill: () => {
            if (callbacks) callbacks.runSim();
          }
        },
        {
          id: 'full_results',
          targetSelector: '[data-tour="tab-trigger-results"]',
          title: loc('2. Pestaña Results (Resultados): Visualización Balística', '2. Results Tab: Ballistic Visualization', '2. Onglet Résultats : Visualisation Balistique', '2. Pannello Risultati: Visualizzazione Balistica'),
          category: loc('Pestaña 2', 'Tab 2', 'Onglet 2', 'Pannello 2'),
          tab: 'results',
          description: loc(
            'El objetivo de esta pestaña es básicamente visualizar de forma gráfica e intuitiva todo el rendimiento producido por el motor tras la combustión.',
            'The primary purpose of this tab is visualization: clearly inspecting performance metrics and curves computed from the firing.',
            'L\'objectif principal de cet onglet est la visualisation des courbes et performances du moteur.',
            'Lo scopo principale di questo pannello è la visualizzazione grafica delle prestazioni del motore.'
          ),
          bulletPoints: [
            loc('Clasificación Oficial: Letra de clase internacional Tripoli/NFPA (H, I, J, K...) calculada según el Impulso Total (It en N·s).', 'Official Motor Class: Tripoli/NFPA motor class designation (H, I, J, K...) based on Total Impulse (It in N·s).', 'Classe de moteur : Lettre Tripoli/NFPA (H, I, J, K...) basée sur l\'Impulsion Totale (It).', 'Classe del motore: Lettera Tripoli/NFPA (H, I, J, K...) in base all\'Impulso Totale (It).'),
            loc('Métricas Clave: Impulso específico (Isp en segundos), tiempo de combustión (tb), empuje medio/pico y presión máxima de cámara (Pmax).', 'Key Metrics: Specific impulse (Isp in seconds), burn time (tb), average and peak thrust, and peak chamber pressure (Pmax).', 'Métriques clés : Impulsion spécifique (Isp), durée de combustion, poussée moyenne et pression maximale (Pmax).', 'Parametri chiave: Impulso specifico (Isp), durata di combustione, spinta media e pressione massima (Pmax).'),
            loc('Gráficas Balísticas: Curva de presión de cámara P(t) y curva de empuje F(t) comparando el modelo teórico de Nakka con el modelo cinético TTI.', 'Ballistic Curves: Chamber pressure profile P(t) and net thrust curve F(t) comparing Richard Nakka vs TTI kinetic models.', 'Graphiques balistiques : Courbes P(t) et poussée F(t) (Nakka vs TTI).', 'Grafici balistici: Curve di pressione P(t) e spinta F(t) (Nakka vs TTI).'),
            loc('Exportación de Datos: Botón para exportar todas las curvas numéricas directamente a hojas CSV y Microsoft Excel (.xlsx).', 'Data Export: One-click export of full numeric time series directly into CSV and Microsoft Excel (.xlsx) formats.', 'Export de données : Export vers fichiers CSV et Microsoft Excel (.xlsx).', 'Esportazione dati: Esportazione completa in formato CSV e Microsoft Excel (.xlsx).')
          ]
        },
        {
          id: 'full_save_sim',
          targetSelector: '[data-tour="save-sim-btn"]',
          title: loc('3. Guardar en la Biblioteca de Simulaciones', '3. Save to Simulation Library', '3. Enregistrer dans la Bibliothèque', '3. Salva nella Libreria delle Simulazioni'),
          category: loc('Biblioteca', 'Library', 'Bibliothèque', 'Libreria'),
          description: loc(
            'En la cabecera superior derecha dispones de dos botones fundamentales para la gestión persistente de tus proyectos:',
            'At the top right header, you have two primary buttons for persistent project management:',
            'En haut à droite, deux boutons permettent de gérer vos projets :',
            'In alto a destra sono presenti due pulsanti per la gestione dei progetti:'
          ),
          bulletPoints: [
            loc('Botón "Guardar": Al pulsarlo se abre una ventana modal donde introduces el "Nombre de la simulación" (ej. "Motor J-500 Candy V1") y la "Carpeta / Grupo" (ej. "Prototipos", "Motores BATES"). Al pulsar Guardar, almacena instantáneamente en tu navegador toda la configuración del casing, tobera y pila de granos.', '"Save" Button: Clicking opens a modal where you enter "Simulation Name" (e.g. "Test Motor J-500 V1") and "Folder / Group" (e.g. "Prototypes", "BATES Motors"). Hit Save to persistently store chamber, nozzle, and grain stack parameters in your browser (localStorage).', 'Bouton "Guardar" : Ouvre une fenêtre modale pour nommer et classer le moteur dans un dossier.', 'Pulsante "Salva": Apre un modale per assegnare nome e cartella al motore e salvarlo.'),
            loc('Botón "Biblioteca" (junto a Guardar): Abre el explorador de proyectos clasificados por carpetas. Puedes cargar cualquier simulación archivada con 1 solo clic para continuar iterando o eliminar versiones obsoletas.', '"Library" Button: Located right next to Save. Opens the project explorer organized by folders. Load any archived simulation in 1 click or delete obsolete test runs.', 'Bouton "Biblioteca" : Ouvre l\'explorateur de projets classés par dossiers.', 'Pulsante "Biblioteca": Apre l\'esploratore di progetti organizzati per cartelle.')
          ]
        },
        {
          id: 'full_analysis',
          targetSelector: '[data-tour="tab-trigger-analysis"]',
          title: loc('4. Pestaña Detailed Analysis: Estudio Detallado de la Combustión', '4. Detailed Analysis Tab: In-Depth Combustion Study', '4. Onglet Analyse Détaillée : Étude de la Combustion', '4. Pannello Analisi Dettagliata: Studio della Combustione'),
          category: loc('Pestaña 4', 'Tab 4', 'Onglet 4', 'Pannello 4'),
          tab: 'analysis',
          description: loc(
            'El objetivo de esta pestaña es estudiar en detalle qué le pasa internamente a la combustión a lo largo del tiempo, examinando magnitudes aerotermodinámicas que determinan la estabilidad.',
            'The goal of this tab is to study combustion phenomena in detail over time, examining aerothermodynamic properties that govern motor stability.',
            'L\'objectif est d\'étudier en détail les phénomènes aérothermochimiques au cours de la combustion.',
            'Lo scopo è studiare in dettaglio cosa accade alla combustione nel tempo e analizzare la stabilità.'
          ),
          bulletPoints: [
            loc('Ratio Klemmung Kn(t) = Ab / At: Evolución del área de quemado respecto al área de garganta. Permite verificar que Kn se mantenga dentro del rango seguro sin riesgo de sobrepresión ni extinción (chuffing).', 'Klemmung Ratio Kn(t) = Ab / At: Ratio of burning grain surface to nozzle throat area over time. Confirms safe margin against overpressure or low-pressure flameout (chuffing).', 'Ratio Kn = Ab / At : Rapport surface de combustion / col, garant de la stabilité.', 'Rapporto Kn = Ab / At: Area di combustione rispetto alla gola, indicatore di stabilità.'),
            loc('Velocidad y Flujo de Gas en el Núcleo: Supervisa la velocidad del gas en el orificio central para detectar si se supera el umbral crítico de combustión erosiva.', 'Core Gas Velocity & Mass Flux: Tracks axial gas velocity along the port to detect whether the critical threshold for erosive burning is exceeded.', 'Vitesse des gaz au canal : Détection du seuil critique de combustion érosive.', 'Velocità dei gas nel canale: Rilevamento della soglia critica di combustion erosiva.'),
            loc('Flujo Másico Instantáneo (ṁ): Balance entre masa generada por deflagración del combustible y masa descargada sónicamente por la tobera.', 'Instantaneous Mass Flow (ṁ): Dynamic balance between mass generated by solid grain deflagration and sonic discharge through the throat.', 'Débit massique instantané (ṁ) : Bilan entre génération et éjection.', 'Portata massica istantanea (ṁ): Bilancio tra generazione ed espulsione sonica.')
          ]
        },
        {
          id: 'full_mission_control',
          targetSelector: '[data-tour="tab-trigger-mission-control"]',
          title: loc('5. Pestaña Mission Control: Simulación de Alturas y Datos', '5. Mission Control Tab: Altitude Simulation & Data', '5. Onglet Mission Control : Simulation d\'Altitude & Données', '5. Pannello Mission Control: Simulazione di Quota e Dati'),
          category: loc('Pestaña 5', 'Tab 5', 'Onglet 5', 'Pannello 5'),
          tab: 'mission_control',
          description: loc(
            'El objetivo de esta pestaña es controlar y simular alturas y la trayectoria de vuelo vertical del cohete. Además, permite exportar e importar datos numéricos.',
            'The purpose of this tab is to simulate and control rocket flight altitudes and 1D vertical trajectories, with full data export and import capabilities.',
            'L\'objectif est de contrôler et simuler l\'altitude de vol 1D et d\'importer/exporter des données.',
            'Lo scopo è simulare e controllare l\'altitudine di volo 1D ed esportare/importare dati.'
          ),
          bulletPoints: [
            loc('Dinámica de Vuelo 1D: Integra la fuerza de empuje F(t) con la resistencia aerodinámica cuadrática y gravedad según la masa en seco (m_dry), diámetro de fuselaje y coeficiente Cd.', '1D Vertical Flight Dynamics: Integrates thrust F(t) with quadratic drag and gravity based on rocket dry mass (m_dry), body diameter, and drag coefficient Cd.', 'Dynamique de vol 1D : Intègre la poussée F(t), la traînée et la gravité.', 'Dinamica di volo 1D: Integra la spinta F(t), la resistenza aerodinamica e la gravità.'),
            loc('Resultados de Misión: Altitud máxima de apogeo alcanzada [m], tiempo hasta el apogeo, velocidad máxima [m/s], número de Mach y aceleración pico en Gs.', 'Mission Outputs: Predicted apogee altitude [m], time to apogee, maximum velocity [m/s], Mach number, and peak acceleration in Gs.', 'Résultats de mission : Apogée maximale, temps d\'apogée, vitesse max et accélération en G.', 'Risultati di missione: Quota di apogeo, tempo di apogeo, velocità massima e carico G.'),
            loc('Importar y Exportar Datos: Puedes exportar tus curvas de vuelo o importar un archivo .CSV obtenido en un banco de pruebas estático real para simular el vuelo con datos reales medidos.', 'Import & Export Data: Export flight logs or import real test stand load cell .CSV files to simulate flight using measured test curves.', 'Importation et exportation : Export des vols et import de fichiers .CSV de bancs réels.', 'Importazione ed esportazione: Esporta curve di volo o importa file CSV da banchi prova reali.')
          ]
        },
        {
          id: 'full_smart_search',
          targetSelector: '[data-tour="smart-search-tab-trigger"]',
          title: loc('6. Pestaña Smart Search: Optimización de Geometrías', '6. Smart Search Tab: Geometry Optimization Solver', '6. Onglet Smart Search : Optimisation de Géométrie', '6. Pannello Smart Search: Ottimizzazione di Geometria'),
          category: loc('Pestaña 6', 'Tab 6', 'Onglet 6', 'Pannello 6'),
          tab: 'smart_search',
          description: loc(
            'En qué consiste esta pestaña: es un potente motor de diseño inverso concebido para optimizar geometrías y buscar automáticamente soluciones óptimas según tus restricciones de hardware.',
            'What this tab does: a powerful inverse design engine engineered to optimize grain geometries and automatically find optimal motor configurations matching your hardware limits.',
            'En quoi consiste cet onglet : un solveur de conception inverse pour optimiser automatiquement les géométries.',
            'Cosa fa questo pannello: un potente risolutore inverso per ottimizzare le geometrie in base ai vincoli hardware.'
          ),
          bulletPoints: [
            loc('Diseño Inverso Inteligente: En vez de probar dimensiones a ciegas por ensayo y error, introduces las cotas fijas de tu casing (Dc, Lc, garganta, presión máxima) y tu meta de misión.', 'Intelligent Inverse Solver: Instead of trial and error, enter your fixed casing limits (Dc, Lc, throat, safe pressure limit) and your target flight goal.', 'Conception inverse : Définissez vos contraintes de carter et votre objectif de vol.', 'Progettazione inversa: Imposta i vincoli della carcassa e l\'obiettivo di missione.'),
            loc('Motor de Optimización: Differential Evolution (DE/rand/1/bin) con muestreo Latino Hipercúbico (LHS), dither adaptativo y presupuesto de cálculo configurable.', 'Optimization Engine: Differential Evolution (DE/rand/1/bin) with Latin Hypercube Sampling (LHS), adaptive dithering, and configurable budget.', 'Moteur d\'optimisation : Differential Evolution (DE/rand/1/bin) avec échantillonnage LHS et budget configurable.', 'Motore di ottimizzazione: Differential Evolution (DE/rand/1/bin) con campionamento LHS e budget configurabile.'),
            loc('Aplicar con 1 Clic: Al terminar la búsqueda, transfiere instantáneamente la geometría ganadora a tus Inputs.', '1-Click Injection: Once optimized, transfer the winning geometry directly into your Inputs tab in one click.', 'Application en 1 clic : Transférez instantanément la configuration gagnante dans vos Entrées.', 'Applicazione in 1 clic: Trasferisci la geometria vincente direttamente nel pannello Dati.')
          ]
        },
        {
          id: 'full_agente_jesus',
          targetSelector: '[data-tour="tab-trigger-agente-jesus"]',
          title: loc('7. Pestaña Agente Jesús: Inteligencia Artificial para Resultados', '7. Agente Jesús Tab: AI for Result Interpretation', '7. Onglet Agente Jesús : IA pour l\'Interprétation', '7. Pannello Agente Jesús: IA per l\'Interpretazione'),
          category: loc('Pestaña 7', 'Tab 7', 'Onglet 7', 'Pannello 7'),
          tab: 'agente_jesus',
          description: loc(
            'En qué consiste esta pestaña: aplicar Inteligencia Artificial especializada en propulsión aeroespacial para entender y diagnosticar mejor los resultados de la simulación.',
            'What this tab does: applies specialized aerospace AI to help you better understand and diagnose ballistic simulation results.',
            'En quoi consiste cet onglet : appliquer l\'Intelligence Artificielle pour mieux comprendre et diagnostiquer les résultats.',
            'Cosa fa questo pannello: applica l\'Intelligenza Artificiale per comprendere e diagnosticare i risultati di simulazione.'
          ),
          bulletPoints: [
            loc('Tutoría y Explicaciones Físicas: Te explica con lenguaje claro qué fenómenos de flujo o combustión están ocurriendo en tus curvas balísticas.', 'Physics Tutoring: Explains in accessible engineering terms which aerodynamic or thermochemical phenomena occur across your curves.', 'Tutorat physique : Explique clairement les phénomènes aérodynamiques et de combustion.', 'Spiegazioni fisiche: Spiega i fenomeni aerotermochimici presenti nelle curve balistiche.'),
            loc('Detección de Anomalías: Diseñado para alertarte si detecta picos extraños de presión, riesgo de combustión inestable o sobrepresiones peligrosas.', 'Anomaly Detection: Designed to alert you to pressure spikes, unstable combustion modes, or critical casing rupture risks.', 'Détection d\'anomalies : Vous alerte sur les pics anormaux de pression ou instabilités.', 'Rilevamento anomalie: Ti avvisa in presenza di picchi di pressione o instabilità.'),
            loc('100% Local, Opcional y Privado: No requiere enviar datos a nubes externas ni cuentas de pago; funciona enteramente en tu ordenador.', '100% Local, Optional & Private: Zero cloud dependency; runs completely on-device without telemetry or fees.', '100% Local et Privé : Fonctionne entièrement sur votre machine.', '100% Locale e Privato: Funziona interamente sul tuo computer senza dipendenze cloud.')
          ]
        },
        {
          id: 'full_cfd',
          targetSelector: '[data-tour="tab-trigger-cfd"]',
          title: loc('8. Pestaña Animaciones (CFD): Únicamente Visualización', '8. Animations Tab (CFD): Pure Dynamic Visualization', '8. Onglet Animations (CFD) : Visualisation Pure', '8. Pannello Animazioni (CFD): Visualizzazione Pura'),
          category: loc('Pestaña 8', 'Tab 8', 'Onglet 8', 'Pannello 8'),
          tab: 'cfd',
          description: loc(
            'Esta pestaña está dedicada únicamente a la visualización gráfica de los gases en la tobera y la combustión.',
            'This tab is dedicated exclusively to dynamic graphical visualization of exhaust gas dynamics and nozzle expansion.',
            'Cet onglet est dédié uniquement à la visualisation dynamique de l\'écoulement des gaz.',
            'Questo pannello è dedicato unicamente alla visualizzazione dinamica dei gas e dell\'ugello.'
          ),
          bulletPoints: [
            loc('Flujo Supersónico en Tobera Laval: Animación del campo de velocidades desde régimen subsónico en cámara hasta supersónico en la salida.', 'Supersonic De Laval Flow: Animated velocity contours accelerating from subsonic in the chamber to supersonic at the exit.', 'Écoulement supersonique : Visualisation de l\'accélération des gaz.', 'Flusso supersonico: Visualizzazione dell\'accelerazione dei gas nell\'ugello.'),
            loc('Campos de Mach, Temperatura y Presión: Mapa de gradientes para verificar si la expansión está adaptada a 1 atm o si presenta sobreexpansión con ondas de choque.', 'Mach, Temperature & Pressure Fields: Gradient contours confirming whether exhaust is ideally expanded to 1 atm or exhibits shock diamonds.', 'Champs de Mach et température : Vérification de l\'adaptation à 1 atm.', 'Campi di Mach e temperatura: Verifica dell\'adattamento a 1 atm e onde d\'urto.')
          ]
        }
      ]
    }
  };
}
