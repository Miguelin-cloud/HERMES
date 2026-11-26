import { TourSequence } from '../components/InteractiveTourOverlay';

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

  const loc = (es: string, en: string, fr: string, it: string) => {
    if (isSpanish) return es;
    if (isFrench) return fr;
    if (isItalian) return it;
    return en;
  };

  return {
    // 1. TOUR: Creación y Geometría de Granos (10 formas: 9 paramétricas + Personalizada dibujada)
    tour_grains: {
      id: 'tour_grains',
      title: loc(
        'Guía: Creación y Geometría de Granos',
        'Guide: Propellant Grain Creation & Geometry',
        'Guide : Création et Géométrie des Grains',
        'Guida: Creazione e Geometria dei Grani'
      ),
      description: loc(
        'Domina las 10 geometrías disponibles (9 paramétricas + Forma Personalizada dibujada), dimensiones, rhorat, inhibición de caras y validaciones.',
        'Master all 10 grain geometries (9 parametric + Custom Drawn Shape), dimensions, rhorat, face inhibition, and live validation.',
        'Maîtrisez les 10 géométries de grains (9 paramétriques + Forme Personnalisée dessinée), dimensions, rhorat, inhibition et validations.',
        'Padroneggia tutte le 10 geometrie dei grani (9 parametriche + Forma Personalizzata disegnata), dimensioni, rhorat, inibizione e validazioni.'
      ),
      steps: [
        {
          id: 'grain_add_btn',
          targetSelector: '[data-tour="new-grain-btn"]',
          title: loc(
            '1. Añadir Segmentos de Grano (+ Nuevo Grano)',
            '1. Add Propellant Grain Segments (+ New Grain)',
            '1. Ajouter des Segments de Grain (+ Nouveau Grain)',
            '1. Aggiungi Segmenti di Grano (+ Nuovo Grano)'
          ),
          category: loc('Pila del Motor', 'Motor Stack', 'Empilement', 'Impilamento'),
          tab: 'inputs',
          description: loc(
            'El botón "+ Nuevo Grano" añade otro bloque independiente a la cámara. Puedes combinar distintas geometrías o distintos propulsantes dentro del mismo motor (por ejemplo, encendido agresivo + crucero sostenido).',
            'The "+ New Grain" button appends an independent propellant block to the casing. You can combine different shapes or propellants inside the same motor (e.g., booster + sustainer stages).',
            'Le bouton "+ Nouveau Grain" ajoute un bloc indépendant dans la chambre. Vous pouvez combiner différentes géométries ou propergols dans le même moteur.',
            'Il pulsante "+ Nuovo Grano" aggiunge un blocco indipendente nella camera. Puoi combinare geometrie o propellenti diversi nello stesso motore.'
          ),
          bulletPoints: [
            loc(
              'Cada fila posee sus propias cotas geométricas, fórmula de propelente y caras activas.',
              'Each row keeps independent dimensions, fuel chemistry, and active burning faces.',
              'Chaque ligne possède ses cotes, sa chimie et ses faces de combustion.',
              'Ogni riga dispone di dimensioni, chimica e facce di combustione proprie.'
            ),
            loc(
              'Si todos los bloques son idénticos, usa el multiplicador N en una sola fila.',
              'If all blocks are identical, simply increase the N multiplier on a single row.',
              'Si les blocs sont identiques, augmentez simplement le multiplicateur N sur une ligne.',
              'Se i blocchi sono identici, aumenta semplicemente il moltiplicatore N su una sola riga.'
            ),
          ],
        },
        {
          id: 'grain_propellant_select',
          targetSelector: '[data-tour="grain-propellant-0"]',
          title: loc(
            '2. Selección de Propelente y Fórmula',
            '2. Propellant Selection & Formula',
            '2. Sélection du Propergol et Formule',
            '2. Selezione Propellente e Formula'
          ),
          category: loc('Combustible', 'Propellant', 'Propergol', 'Propellente'),
          tab: 'inputs',
          description: loc(
            'Elige el propelente que quema este grano: desde formulaciones estándar (KNDX, KNSB, KNRX, APCP) hasta tus propios propelentes creados en la biblioteca.',
            'Select the chemical formulation burned by this grain: from standard fuels (KNDX, KNSB, KNRX, APCP) to your saved custom formulations.',
            'Choisissez la formulation brûlée par ce grain : propergols standards ou vos formules personnalisées.',
            'Seleziona la formulazione per questo grano: dai propellenti standard alle tue formule personalizzate.'
          ),
          bulletPoints: [
            loc(
              'El enlace "Fórmula" abre directamente el visor/editor químico de ese segmento.',
              'The "Formula" button opens the thermochemical viewer/editor directly for that segment.',
              'Le bouton "Formule" ouvre directement l’inspecteur/éditeur chimique de ce bloc.',
              'Il pulsante "Formula" apre direttamente il gestore chimico per questo segmento.'
            ),
          ],
        },
        {
          id: 'grain_shape',
          targetSelector: '[data-tour="grain-shape-select-0"]',
          title: loc(
            '3. Las 10 Geometrías de Grano Soportadas',
            '3. All 10 Supported Grain Geometries',
            '3. Les 10 Géométries de Grain Disponibles',
            '3. Tutte le 10 Geometrie di Grano Supportate'
          ),
          category: loc('Geometría', 'Geometry', 'Géométrie', 'Geometria'),
          tab: 'inputs',
          description: loc(
            'La forma del canal controla cómo cambia el área de combustión Ab(t) al retroceder la llama. HERMES integra 9 geometrías paramétricas más la forma 10 Personalizada (Dibujada):',
            'The perforation geometry dictates how burning area Ab(t) evolves as the flame regresses. HERMES models 9 parametric geometries plus shape 10 Custom (Drawn):',
            'La géométrie du canal contrôle l’évolution de l’aire Ab(t). HERMES intègre 9 géométries paramétriques plus la forme 10 Personnalisée (Dessinée) :',
            'La geometria del canale governa l’evoluzione dell’area Ab(t). HERMES supporta 9 geometrie parametriche più la forma 10 Personalizzata (Disegnata):'
          ),
          bulletPoints: [
            loc(
              '1. Cilíndrico (BATES) · Canal circular neutro.  2. Estrella (Star) · Np puntas para alto empuje inicial.  3. Macizo (End-burner) · Sin canal axial, combustión larga.',
              '1. Cylindrical (BATES) · Neutral circular core.  2. Star · Np points for strong liftoff peak.  3. Solid (End-burner) · No core hole, long low-thrust burn.',
              '1. Cylindrique (BATES) · Canal neutre.  2. Étoile · Np pointes, forte poussée initiale.  3. Massif · Sans canal, combustion longue.',
              '1. Cilindrico (BATES) · Canale neutro.  2. Stella · Np punte per spinta iniziale elevata.  3. Massiccio · Senza foro, combustione lunga.'
            ),
            loc(
              '4. Finocyl · Canal circular con aletas radiales.  5. Moonburner · Canal circular excéntrico (offset).  6. C-Slot · Ranura lateral abierta al perímetro exterior.',
              '4. Finocyl · Circular core with radial fins.  5. Moonburner · Eccentric circular port (offset).  6. C-Slot · Lateral radial slot open to outer wall.',
              '4. Finocyl · Canal avec ailettes radiales.  5. Moonburner · Canal excentré.  6. C-Slot · Fente latérale ouverte en périphérie.',
              '4. Finocyl · Canale con alette radiali.  5. Moonburner · Canale eccentrico.  6. C-Slot · Fessura laterale aperta sul perimetro.'
            ),
            loc(
              '7. D-Grain · Corte plano cordal.  8. Rod & Tube · Varilla sólida concéntrica + tubo.  9. Wagon Wheel · Canal central + radios.  10. Personalizada · Sección libre dibujada en el Estudio de Formas.',
              '7. D-Grain · Flat chordal cut.  8. Rod & Tube · Concentric inner rod + tube.  9. Wagon Wheel · Central port + spokes.  10. Custom (Drawn) · Freehand/symmetric cross-section built in the Shape Studio.',
              '7. D-Grain · Coupe plane.  8. Rod & Tube · Tige + tube.  9. Wagon Wheel · Canal + rayons.  10. Personnalisée · Section dessinée librement ou par symétrie.',
              '7. D-Grain · Taglio piatto.  8. Rod & Tube · Barra + tubo.  9. Wagon Wheel · Canale + razze.  10. Personalizzata · Sezione disegnata a mano libera o con simmetria.'
            ),
          ],
          autofillLabel: loc(
            'Cargar BATES Estándar (4×50mm)',
            'Load Standard BATES (4×50mm)',
            'Charger BATES Standard (4×50mm)',
            'Carica BATES Standard (4×50mm)'
          ),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setGrains([
                {
                  id: 'bates-tour-1',
                  shape: 1,
                  propellantType: 1,
                  D0: 50,
                  d0: 16,
                  d0mayor: 0,
                  L0: 75,
                  N: 4,
                  Np: 0,
                  osi: 0,
                  ci: 1,
                  ei: 1,
                  rhorat: 0.95,
                },
              ]);
            }
          },
        },
        {
          id: 'grain_custom_studio',
          targetSelector: '[data-tour="global-custom-grain-btn"]',
          fallbackSelector: '[data-tour="grain-custom-shape-0"]',
          title: loc(
            '4. Estudio de Formas Personalizadas (Dibujo Libre y Simetría)',
            '4. Custom Grain Studio (Freehand & Radial Symmetry)',
            '4. Studio de Formes Personnalisées (Dessin & Symétrie)',
            '4. Studio Forme Personalizzate (Disegno e Simmetria)'
          ),
          category: loc('Personalizado', 'Custom Shape', 'Forme Perso', 'Forma Pers.'),
          tab: 'inputs',
          description: loc(
            'Abre "Formas Personalizadas" en la cabecera de Granos (o elige "Personalizada (Dibujada)" en el desplegable de Forma para ver tu selector por nombre y el botón "Dibujar / Editar").',
            'Open "Custom Shapes" in the Grains header (or pick "Custom (Drawn)" in the Shape menu to reveal your named shapes dropdown and "Draw / Edit" link).',
            'Ouvrez "Formes Personnalisées" en haut des Grains (ou choisissez "Personnalisée (Dessinée)" pour afficher votre liste nommée).',
            'Apri "Forme Personalizzate" in alto nei Grani (o scegli "Personalizzata (Disegnata)" per aprire il selettore per nome).'
          ),
          bulletPoints: [
            loc(
              'Herramientas asistidas: Mano alzada suavizada, Polilínea, Círculo, rejilla polar/imán y simetría radial (1×–12×) con espejo.',
              'Assisted tools: Smoothed freehand, Polyline, Circle, polar grid/snap, and radial symmetry (1×–12×) with sector mirror.',
              'Outils assistés : Main levée lissée, Polyligne, Cercle, grille polaire/aimant et symétrie radiale (1×–12×) avec miroir.',
              'Strumenti assistiti: Mano libera smussata, Polilinea, Cerchio, griglia polare/aggancio e simmetria radiale (1×–12×) con specchio.'
            ),
            loc(
              'Cortes secuenciales: Alterna "Recortar Hueco" y "Añadir Isla" en orden; incluso puedes volver a perforar un hueco dentro de una isla creada antes.',
              'Sequential CSG: Alternate "Cut Void" and "Add Island" in chronological order—you can cut holes back inside previously added islands.',
              'Découpe séquentielle : Alternez "Creuser Vide" et "Ajouter Îlot" dans l’ordre ; vous pouvez percer à nouveau un îlot existant.',
              'Tagli sequenziali: Alterna "Scava Vuoto" e "Aggiungi Isola" in ordine; puoi anche forare di nuovo un’isola aggiunta prima.'
            ),
            loc(
              'Biblioteca local y privada: Pon nombre y notas a cada forma, duplícalas o bórralas para limpiar. Cada usuario conserva sus propias formas localmente en su navegador y solo se comparten si se incluyen en un paquete .hrms.',
              'Private local library: Name and annotate each shape, duplicate, or delete to clean up. Shapes stay private in each user’s local browser storage unless explicitly shared in a .hrms file.',
              'Bibliothèque locale et privée : Nommez, annotez, dupliquez ou supprimez vos formes. Elles restent privées dans votre navigateur local sauf partage explicite en .hrms.',
              'Libreria locale e privata: Dai nome e note a ogni forma, duplica o elimina per fare pulizia. Ogni utente vede solo le proprie forme locali salvo condivisione via .hrms.'
            ),
          ],
        },
        {
          id: 'grain_dimensions',
          targetSelector: '[data-tour="grain-dimensions-0"]',
          title: loc(
            '5. Dimensiones, Densidad Real (rhorat) y Validación',
            '5. Dimensions, Density Ratio (rhorat) & Validation',
            '5. Cotes, Ratio de Densité (rhorat) & Validation',
            '5. Quote, Rapporto Densità (rhorat) e Validazione'
          ),
          category: loc('Dimensiones', 'Dimensions', 'Dimensions', 'Dimensioni'),
          tab: 'inputs',
          description: loc(
            'Define D₀, d₀ (o diámetro interior de tubo en Rod & Tube), L₀, N, parámetros propios de la forma elegida y el factor de densidad real de colada (rhorat).',
            'Configure D₀, d₀ (or Tube ID for Rod & Tube), L₀, N, shape-specific parameters, and real casting density ratio (rhorat).',
            'Réglez D₀, d₀ (ou Ø interne tube en Rod & Tube), L₀, N, les cotes de forme et le ratio de densité réelle (rhorat).',
            'Imposta D₀, d₀ (o Ø interno tubo per Rod & Tube), L₀, N, parametri di forma e rapporto di densità reale (rhorat).'
          ),
          bulletPoints: [
            loc(
              'rhorat (0.85–1.00): Factor que corrige la densidad teórica según la compactación real lograda al fundir o prensar el grano (ej. 0.95 = 95%).',
              'rhorat (0.85–1.00): Packing factor scaling theoretical propellant density to real cast density (e.g., 0.95 = 95%).',
              'rhorat (0.85–1.00) : Facteur corrigeant la densité théorique selon le moulage réel (ex. 0.95 = 95%).',
              'rhorat (0.85–1.00): Fattore che scala la densità teorica alla densità reale di colata (es. 0.95 = 95%).'
            ),
            loc(
              'Validación en vivo: Si el grano no cabe radialmente (con liner/inhibidor), excede Lc, o las aletas/radios/formas se solapan o quedan sin propelente, HERMES muestra el error exacto y bloquea SIMULAR hasta corregirlo.',
              'Live validation: If the grain clashes radially with liner/inhibitor, exceeds Lc, leaves no propellant, or fins/spokes overlap, HERMES flags the exact limit and blocks SIMULATE.',
              'Validation en direct : Si le grain dépasse Lc, touche la paroi, manque de propergol ou si les ailettes se chevauchent, HERMES signale la limite exacte et bloque la simulation.',
              'Validazione live: Se il grano interferisce con liner/inibitore, supera Lc, resta senza propellente o le alette si sovrappongono, HERMES segnala il limite e blocca SIMULA.'
            ),
          ],
        },
        {
          id: 'grain_faces',
          targetSelector: '[data-tour="grain-faces-0"]',
          title: loc(
            '6. Caras Activas de Combustión (EXT, ENDS, INT)',
            '6. Active Burning Faces (EXT, ENDS, INT)',
            '6. Faces Actives de Combustion (EXT, ENDS, INT)',
            '6. Facce Attive di Combustione (EXT, ENDS, INT)'
          ),
          category: loc('Inhibición', 'Inhibition', 'Inhibition', 'Inibizione'),
          tab: 'inputs',
          description: loc(
            'Cada casilla indica si esa superficie QUEMA (marcada) o está INHIBIDA (desmarcada). Debe quedar al menos una cara activa.',
            'Each checkbox specifies whether that surface BURNS (checked) or is INHIBITED (unchecked). At least one burning face is required.',
            'Chaque case indique si la surface BRÛLE (cochée) ou est INHIBÉE (décochée). Au moins une face doit brûler.',
            'Ogni casella indica se quella superficie BRUCIA (selezionata) o è INIBITA (deselezionata). Almeno una faccia deve bruciare.'
          ),
          bulletPoints: [
            loc(
              'EXT: Cara cilíndrica exterior. En BATES estándar va DESMARCADA (protegida por el inhibidor/liner).',
              'EXT: Outer cylindrical surface. UNCHECKED in standard BATES (shielded by liner/inhibitor).',
              'EXT : Paroi cylindrique extérieure. DÉCOCHÉE en BATES standard (protégée par le liner).',
              'EXT: Parete cilindrica esterna. DESELEZIONATA in BATES standard (protetta da liner/inibitore).'
            ),
            loc(
              'ENDS: Caras planas frontal y trasera. Marcada en BATES para compensar el crecimiento del canal con el acortamiento axial.',
              'ENDS: Forward and aft flat faces. CHECKED in BATES to balance port expansion with axial shortening.',
              'ENDS : Faces avant et arrière. COCHÉE en BATES pour équilibrer la poussée.',
              'ENDS: Basi anteriore e posteriore. SELEZIONATA in BATES per bilanciare la spinta.'
            ),
            loc(
              'INT: Superficie del canal interior (no aplica en grano Macizo).',
              'INT: Internal core/port surface (hidden on Solid end-burners).',
              'INT : Surface du canal interne (masquée sur les grains Massifs).',
              'INT: Superficie del canale interno (non presente sul grano Massiccio).'
            ),
          ],
        },
        {
          id: 'grain_previews',
          targetSelector: '[data-tour="grain-previews-0"]',
          title: loc(
            '7. Cortes Transversal y Longitudinal en Vivo',
            '7. Live Cross-Section & Longitudinal Previews',
            '7. Coupes Transversale et Longitudinale en Direct',
            '7. Anteprime Sezione Trasversale e Longitudinale'
          ),
          category: loc('Verificación', 'Inspection', 'Contrôle', 'Verifica'),
          tab: 'inputs',
          description: loc(
            'Verifica visualmente la sección del canal (a izquierda) y el apilado longitudinal dentro de la cámara (a derecha). Si no hay avisos rojos, ya puedes pulsar SIMULAR.',
            'Visually inspect the core cross-section (left) and longitudinal stack inside the casing (right). With no red errors, you are ready to click SIMULATE.',
            'Vérifiez la section du canal (à gauche) et l’empilement longitudinal (à droite). Sans erreur rouge, cliquez sur SIMULER.',
            'Verifica la sezione trasversale (a sinistra) e l’impilamento longitudinale (a destra). Senza errori rossi puoi premere SIMULA.'
          ),
        },
      ],
    },

    // 2. TOUR: Cámara, Estructura (Tornillos + Padm) y Tobera Laval
    tour_nozzle: {
      id: 'tour_nozzle',
      title: loc(
        'Guía: Cámara, Estructura, Tornillos y Tobera',
        'Guide: Chamber, Structure, Bolts & Nozzle',
        'Guide : Chambre, Structure, Vis & Tuyère',
        'Guida: Camera, Struttura, Viti e Ugello'
      ),
      description: loc(
        'Dimensiona cámara (Dc, Lc, dt, Pamb), espesor y tornillos para calcular Padm gobernante, protecciones térmicas y tobera con erosión/escoria.',
        'Size the chamber (Dc, Lc, dt, Pamb), wall thickness and closure bolts for governing Padm, thermal sleeves, and De Laval nozzle with erosion/slag.',
        'Dimensionnez la chambre, la paroi et les vis pour calculer Padm, les isolants et la tuyère avec érosion/scories.',
        'Dimensiona camera, spessore e viti per Padm governante, protezioni termiche e ugello con erosione/scorie.'
      ),
      steps: [
        {
          id: 'chamber_inputs',
          targetSelector: '[data-tour="chamber-card"]',
          title: loc(
            '1. Cámara de Combustión y Paso Numérico (Dc, Lc, G*, kv, ηc, dt, Pamb)',
            '1. Combustion Chamber & Solver Settings (Dc, Lc, G*, kv, ηc, dt, Pamb)',
            '1. Chambre de Combustion & Solveur (Dc, Lc, G*, kv, ηc, dt, Pamb)',
            '1. Camera di Combustione e Parametri Solver (Dc, Lc, G*, kv, ηc, dt, Pamb)'
          ),
          category: loc('Cámara', 'Chamber', 'Chambre', 'Camera'),
          tab: 'inputs',
          description: loc(
            'Define la geometría interior del tubo motor, los parámetros de combustión erosiva/eficiencia y el paso temporal del solver:',
            'Define internal casing geometry, erosive/combustion efficiency coefficients, and solver time settings:',
            'Définissez la géométrie interne du boîtier, les coefficients de combustion et le pas de temps :',
            'Definisci geometria interna del tubo, coefficienti di combustione/erosione e passo temporale:'
          ),
          bulletPoints: [
            loc(
              'Dc y Lc [mm]: Diámetro interno y longitud útil disponible para alojar el tren de granos.',
              'Dc & Lc [mm]: Inner casing diameter and usable axial length holding the grain stack.',
              'Dc et Lc [mm] : Diamètre interne et longueur utile de chambre.',
              'Dc e Lc [mm]: Diametro interno e lunghezza utile della camera.'
            ),
            loc(
              'G* [kg/(m²·s)] y kv: Umbral y factor de sensibilidad a la combustión erosiva por flujo axial rápido en el canal.',
              'G* [kg/(m²·s)] & kv: Threshold mass flux and velocity sensitivity for erosive burning along narrow ports.',
              'G* [kg/(m²·s)] et kv : Seuil et sensibilité de combustion érosive.',
              'G* [kg/(m²·s)] e kv: Soglia e sensibilità alla combustione erosiva.'
            ),
            loc(
              'ηc, dt [s] y Pamb [MPa]: Eficiencia de combustión (0.85–0.95), paso de integración (ej. 0.0005–0.001 s) y presión atmosférica local (0.101325 MPa a nivel del mar).',
              'ηc, dt [s] & Pamb [MPa]: Combustion efficiency (0.85–0.95), integration step (e.g., 0.0005–0.001 s), and local ambient pressure (0.101325 MPa at sea level).',
              'ηc, dt [s] et Pamb [MPa] : Efficacité (0.85–0.95), pas d’intégration et pression ambiante.',
              'ηc, dt [s] e Pamb [MPa]: Efficienza (0.85–0.95), passo temporale e pressione ambiente.'
            ),
          ],
        },
        {
          id: 'chamber_structure_protection',
          targetSelector: '[data-tour="chamber-structure-card"]',
          title: loc(
            '2. Estructura, Liner, Inhibidor y Tornillos (Padm Gobernante)',
            '2. Structure, Liner, Inhibitor & Bolts (Governing Padm)',
            '2. Structure, Liner, Inhibiteur & Vis (Padm Gouvernante)',
            '2. Struttura, Liner, Inibitore e Viti (Padm Governante)'
          ),
          category: loc('Estructura', 'Structure', 'Structure', 'Struttura'),
          tab: 'inputs',
          description: loc(
            'Calcula en vivo las holguras radiales, la masa estructural del motor (1.3× cilindro) sincronizada con Mission Control y la presión máxima admisible Padm:',
            'Computes radial clearances, structural motor mass (1.3× cylinder) synced to Mission Control, and maximum admissible pressure Padm:',
            'Calcule en direct les jeux radiaux, la masse du moteur synchronisée avec Mission Control et la pression admissible Padm :',
            'Calcola in diretta giochi radiali, massa del motore sincronizzata con Mission Control e pressione ammissibile Padm:'
          ),
          bulletPoints: [
            loc(
              'Pared y Material: Espesor [mm], Factor de Seguridad (FS) y material (Aluminio 6082-T6, Acero Inox. AISI 304 o Personalizado).',
              'Wall & Material: Wall thickness [mm], Safety Factor (SF), and alloy (Al 6082-T6, Stainless Steel AISI 304, or Custom).',
              'Paroi & Matériau : Épaisseur [mm], Facteur de Sécurité (FS) et alliage (Al 6082-T6, AISI 304 ou Personnalisé).',
              'Parete e Materiale: Spessore [mm], Fattore di Sicurezza (FS) e lega (Al 6082-T6, Acciaio Inox AISI 304 o Personalizzato).'
            ),
            loc(
              'Cierre con Tornillos / Pasadores (opcional): Actívalo e indica métrica (M4–M12), calidad (A2-70, A4-80, 8.8, 10.9, 12.9) y número de tornillos; HERMES compara pared (Lamé) vs cizalladura, aplastamiento y sección neta para mostrar el límite más restrictivo.',
              'Bolted Closure (optional): Enable and select metric (M4–M12), bolt grade (A2-70 to 12.9), and count; HERMES checks cylinder Lamé stress vs bolt shear, wall bearing, and net-section tearout to report the governing Padm.',
              'Fermeture par Vis (optionnel) : Choisissez métrique, classe (A2-70 à 12.9) et nombre ; HERMES compare paroi (Lamé) vs cisaillement, matage et section nette.',
              'Chiusura Bullonata (opzionale): Imposta metrica, classe (A2-70 a 12.9) e numero viti; HERMES confronta parete (Lamé) vs taglio, rifollamento e sezione netta.'
            ),
            loc(
              'Liner e Inhibidor: El liner interior y el inhibidor exterior del grano (2 mm por defecto) se dibujan en el esquema y comprueban el ajuste físico dentro de Dc.',
              'Liner & Inhibitor: Optional chamber liner and outer grain inhibitor (2 mm default) update the cutaway and verify radial clearance inside Dc.',
              'Liner & Inhibiteur : Le liner et l’inhibiteur (2 mm par défaut) vérifient le jeu radial dans Dc.',
              'Liner e Inibitore: Il liner e l’inibitore esterno (2 mm predefinito) aggiornano lo schema e verificano il gioco in Dc.'
            ),
          ],
          tip: loc(
            'Pulsa el botón (i) junto a "Presión Máx. Admisible" para inspeccionar el desglose completo de ecuaciones y límites.',
            'Click the (i) icon next to "Max Admissible Pressure" to inspect the full equation breakdown.',
            'Cliquez sur (i) près de "Pression Max Admissible" pour afficher le détail des équations.',
            'Clicca su (i) vicino a "Pressione Max Ammissibile" per vedere tutte le equazioni.'
          ),
        },
        {
          id: 'nozzle_inputs',
          targetSelector: '[data-tour="nozzle-card"]',
          title: loc(
            '3. Dimensionado de Tobera Laval (Dt₀, Ds, α, ηnoz)',
            '3. De Laval Nozzle Sizing (Dt₀, Ds, α, ηnoz)',
            '3. Dimensionnement Tuyère Laval (Dt₀, Ds, α, ηnoz)',
            '3. Dimensionamento Ugello Laval (Dt₀, Ds, α, ηnoz)'
          ),
          category: loc('Tobera', 'Nozzle', 'Tuyère', 'Ugello'),
          tab: 'inputs',
          description: loc(
            'La tobera acelera el gas desde régimen subsónico hasta supersónico en la salida mediante la relación de áreas (Ds/Dt₀)².',
            'The convergent-divergent nozzle accelerates combustion gases from subsonic to supersonic exit velocity via expansion ratio (Ds/Dt₀)².',
            'La tuyère accélère les gaz jusqu’en régime supersonique grâce au rapport d’expansion (Ds/Dt₀)².',
            'L’ugello accelera i gas fino al regime supersonico tramite il rapporto di espansione (Ds/Dt₀)².'
          ),
          bulletPoints: [
            loc(
              'Dt₀ [mm]: Diámetro de garganta; es el parámetro más sensible sobre la presión de cámara y Kn.',
              'Dt₀ [mm]: Throat diameter; the single most sensitive parameter controlling chamber pressure and Kn.',
              'Dt₀ [mm] : Diamètre au col ; paramètre le plus sensible sur la pression et Kn.',
              'Dt₀ [mm]: Diametro di gola; il parametro più sensibile per pressione e Kn.'
            ),
            loc(
              'Ds [mm], α [°] y ηnoz: Diámetro de salida, semiángulo divergente (12°–15° típico) y eficiencia de tobera.',
              'Ds [mm], α [°] & ηnoz: Exit diameter, divergent half-angle (typically 12°–15°), and nozzle efficiency.',
              'Ds [mm], α [°] et ηnoz : Diamètre de sortie, demi-angle (12°–15°) et efficacité.',
              'Ds [mm], α [°] e ηnoz: Diametro di uscita, semiangolo (12°–15°) ed efficienza.'
            ),
          ],
          autofillLabel: loc(
            'Aplicar Tobera 17.5 / 38 mm',
            'Apply 17.5 / 38 mm Nozzle',
            'Appliquer Tuyère 17.5 / 38 mm',
            'Applica Ugello 17.5 / 38 mm'
          ),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setNozzle({ Dt0: 17.5, Ds: 38.0, e: 0, alpha: 14, etanoz: 0.88 });
            }
          },
        },
        {
          id: 'slag_erosion',
          targetSelector: '[data-tour="slag-panel"]',
          title: loc(
            '4. Erosión y Escoria en Garganta (ΔDt y Modelos 1–6)',
            '4. Throat Erosion & Slag Deposition (ΔDt & Models 1–6)',
            '4. Érosion & Dépôt de Scories (ΔDt & Modèles 1–6)',
            '4. Erosione e Scorie alla Gola (ΔDt e Modelli 1–6)'
          ),
          category: loc('Fenómenos Reales', 'Real Physics', 'Physique Réelle', 'Fisica Reale'),
          tab: 'inputs',
          description: loc(
            'Simula la variación real de la garganta durante el disparo mediante tres modos (Ninguno, Depósito de Escoria o Erosión) y 6 curvas temporales:',
            'Models real throat diameter variation during firing across three modes (None, Slag Deposition, or Erosion) and 6 time profiles:',
            'Modélise la variation réelle du col pendant le tir via 3 modes (Aucun, Scories, Érosion) et 6 lois temporelles :',
            'Modella la variazione reale della gola durante la combustione con 3 modalità e 6 profili temporali:'
          ),
          bulletPoints: [
            loc(
              'Erosión (+ΔDt): Agranda la garganta por ablación, reduciendo Kn y presión hacia el final.',
              'Erosion (+ΔDt): Widens the throat via ablation, dropping Kn and pressure toward burnout.',
              'Érosion (+ΔDt) : Élargit le col par ablation, réduisant Kn et la pression.',
              'Erosione (+ΔDt): Allarga la gola per ablazione, riducendo Kn e pressione.'
            ),
            loc(
              'Escoria (-ΔDt): Deposita óxidos condensados cerrando la garganta, elevando Kn y presión.',
              'Slag (-ΔDt): Accumulates condensed residue constricting the throat, raising Kn and pressure.',
              'Scories (-ΔDt) : Rétrécit le col par dépôt solide, augmentant Kn et la pression.',
              'Scorie (-ΔDt): Restringe la gola per deposito solido, aumentando Kn e pressione.'
            ),
            loc(
              'Progresión 1–6: Lineal, Exponencial, Cuadrático (recomendado para erosión térmica), Raíz cuadrada, Parabólico y Senoidal.',
              'Progression 1–6: Linear, Exponential, Quadratic (recommended for thermal erosion), Square Root, Parabolic, and Sine.',
              'Progression 1–6 : Linéaire, Exponentiel, Quadratique (recommandé), Racine, Parabolique, Sinus.',
              'Progressione 1–6: Lineare, Esponenziale, Quadratico (raccomandato), Radice, Parabolico, Seno.'
            ),
          ],
        },
      ],
    },

    // 3. TOUR: Química, Saint-Robert y Saint-Venant
    tour_propellants: {
      id: 'tour_propellants',
      title: loc(
        'Guía: Química, Saint-Robert y Saint-Venant',
        'Guide: Propellant Chemistry, Saint-Robert & Saint-Venant',
        'Guide : Chimie, Saint-Robert & Saint-Venant',
        'Guida: Chimica, Saint-Robert e Saint-Venant'
      ),
      description: loc(
        'Comprende los coeficientes A y N (r = a·Pⁿ), la condición crítica de estabilidad n < 1 y el equilibrio de Saint-Venant en tobera.',
        'Understand burn rate parameters A and N (r = a·Pⁿ), chamber stability condition n < 1, and Saint-Venant sonic nozzle balance.',
        'Comprenez les paramètres A et N (r = a·Pⁿ), la condition de stabilité n < 1 et la loi de Saint-Venant.',
        'Comprendi i parametri A ed N (r = a·Pⁿ), la condizione di stabilità n < 1 e la legge di Saint-Venant.'
      ),
      steps: [
        {
          id: 'propellant_selection',
          targetSelector: '[data-tour="grain-propellant-0"]',
          title: loc(
            '1. Asignación de Combustible por Grano',
            '1. Fuel Assignment per Grain',
            '1. Choix du Propergol par Grain',
            '1. Scelta Propellente per Grano'
          ),
          category: loc('Inputs', 'Inputs', 'Entrées', 'Dati'),
          tab: 'inputs',
          closeModal: 'propellant',
          description: loc(
            'Cada segmento de grano puede utilizar un propulsante estándar de la biblioteca (KNDX, KNSB, KNSU, KNRX, APCP, etc.) o cualquiera que hayas creado.',
            'Each grain segment can burn any standard library propellant (KNDX, KNSB, KNSU, KNRX, APCP, etc.) or any custom formulation you create.',
            'Chaque grain peut utiliser un propergol standard de la bibliothèque ou l’une de vos formules personnalisées.',
            'Ogni segmento può utilizzare un propellente standard oppure una tua formulazione personalizzata.'
          ),
        },
        {
          id: 'propellant_thermo_properties',
          targetSelector: '[data-tour="grain-dimensions-0"]',
          title: loc(
            '2. Propiedades Termoquímicas (ρ, T₀, γ, M)',
            '2. Thermochemical Properties (ρ, T₀, γ, M)',
            '2. Propriétés Thermochimiques (ρ, T₀, γ, M)',
            '2. Proprietà Termochimiche (ρ, T₀, γ, M)'
          ),
          category: loc('Termoquímica', 'Thermochemistry', 'Thermochimie', 'Termochimica'),
          tab: 'inputs',
          description: loc(
            'Cuatro constantes definen la masa energética y la velocidad característica c* de los gases:',
            'Four constants govern propellant mass loading and characteristic gas velocity c*:',
            'Quatre constantes définissent la masse énergétique et la vitesse caractéristique c* :',
            'Quattro costanti governano la massa energetica e la velocità caratteristica c*:'
          ),
          bulletPoints: [
            loc(
              'Densidad ρ [g/cm³]: Multiplicada por rhorat fija la masa real de propelente en el volumen del grano.',
              'Density ρ [g/cm³]: Multiplied by rhorat sets actual propellant mass for the grain geometry.',
              'Densité ρ [g/cm³] : Multipliée par rhorat fixe la masse réelle du grain.',
              'Densità ρ [g/cm³]: Moltiplicata per rhorat determina la massa reale del grano.'
            ),
            loc(
              'T₀ [K], γ y M [g/mol]: Determinan la temperatura de llama, masa molecular de gases y relación Cp/Cv para c* y expansión supersónica.',
              'T₀ [K], γ & M [g/mol]: Fix flame temperature, exhaust molar weight, and Cp/Cv for c* and supersonic expansion.',
              'T₀ [K], γ et M [g/mol] : Fixent température de flamme, masse molaire et Cp/Cv.',
              'T₀ [K], γ e M [g/mol]: Fissano temperatura di fiamma, massa molare e rapporto Cp/Cv.'
            ),
          ],
        },
        {
          id: 'saint_robert_law',
          targetSelector: '[data-tour="manage-chemistry-btn-0"]',
          title: loc(
            '3. Ley de Saint-Robert (r = a·Pⁿ) y Estabilidad n < 1',
            '3. Saint-Robert Law (r = a·Pⁿ) & n < 1 Stability',
            '3. Loi de Saint-Robert (r = a·Pⁿ) & Stabilité n < 1',
            '3. Legge di Saint-Robert (r = a·Pⁿ) e Stabilità n < 1'
          ),
          category: loc('Ley de Quemado', 'Burn Law', 'Loi de Régression', 'Legge di Combustione'),
          tab: 'inputs',
          description: loc(
            'La velocidad de retroceso de llama sigue r = a · Pⁿ [mm/s]. El exponente n debe cumplir estrictamente n < 1 para evitar inestabilidad explosiva.',
            'Flame regression follows r = a · Pⁿ [mm/s]. The pressure exponent must satisfy n < 1 to avoid exponential pressure runaway.',
            'La vitesse de régression suit r = a · Pⁿ [mm/s]. L’exposant n doit impérativement rester < 1 pour garantir la stabilité.',
            'La velocità di regressione segue r = a · Pⁿ [mm/s]. L’esponente n deve rimanere < 1 per evitare instabilità.'
          ),
        },
        {
          id: 'saint_venant_law',
          targetSelector: '[data-tour="nozzle-card"]',
          title: loc(
            '4. Ley de Saint-Venant y Presión de Equilibrio',
            '4. Saint-Venant Law & Equilibrium Pressure',
            '4. Loi de Saint-Venant & Pression d’Équilibre',
            '4. Legge di Saint-Venant e Pressione di Equilibrio'
          ),
          category: loc('Física de Tobera', 'Nozzle Physics', 'Physique Tuyère', 'Fisica Ugello'),
          tab: 'inputs',
          description: loc(
            'Igualando el gas generado (ρ·Ab·a·Pcⁿ) con la descarga sónica de Saint-Venant (Pc·At/c*), resulta Pc = (a·ρ·c*·Kn)^(1/(1-n)), gobernada directamente por Kn = Ab / At.',
            'Equating gas generation (ρ·Ab·a·Pcⁿ) with Saint-Venant choked discharge (Pc·At/c*) yields Pc = (a·ρ·c*·Kn)^(1/(1-n)), directly governed by Kn = Ab / At.',
            'En égalant débit généré et débit sonique (Pc·At/c*), on obtient Pc = (a·ρ·c*·Kn)^(1/(1-n)), gouvernée par Kn = Ab / At.',
            'Uguagliando gas generato e portata sonica (Pc·At/c*) si ottiene Pc = (a·ρ·c*·Kn)^(1/(1-n)), governata da Kn = Ab / At.'
          ),
        },
      ],
    },

    // 4. TOUR: Crear un Nuevo Propulsante Personalizado
    tour_create_propellant: {
      id: 'tour_create_propellant',
      title: loc(
        'Guía: Crear un Propulsante Personalizado',
        'Guide: Create a Custom Propellant',
        'Guide : Créer un Propergol Personnalisé',
        'Guida: Creare un Propellente Personalizzato'
      ),
      description: loc(
        'Abre el gestor desde Inputs, inspecciona propulsantes calibrados por tramos de presión, crea tu fórmula y guárdala localmente.',
        'Open the manager from Inputs, inspect calibrated piecewise pressure fuels, create your custom formula, and save it locally.',
        'Ouvrez le gestionnaire depuis Entrées, inspectez les propergols calibrés, créez votre formule et sauvegardez-la.',
        'Apri il gestore da Dati, esamina i propellenti calibrati, crea la tua formula e salvala localmente.'
      ),
      steps: [
        {
          id: 'propellant_open_button_step',
          targetSelector: '[data-tour="global-propellant-manager-btn"]',
          fallbackSelector: '[data-tour="manage-chemistry-btn-0"]',
          title: loc(
            '1. Abrir Química & Propulsantes desde Inputs',
            '1. Open Propellant Chemistry from Inputs',
            '1. Ouvrir Chimie & Propergols depuis Entrées',
            '1. Apri Chimica e Propellenti da Dati'
          ),
          category: loc('Inputs', 'Inputs', 'Entrées', 'Dati'),
          tab: 'inputs',
          closeModal: 'propellant',
          description: loc(
            'Pulsa "Química & Propulsantes" en la cabecera del panel de granos (o "Fórmula" junto a un grano) para abrir el catálogo completo y editor.',
            'Click "Propellant Chemistry" in the grains panel header (or "Formula" on any grain) to open the full catalog and formula editor.',
            'Cliquez sur "Chimie & Propergols" en haut du panneau des grains (ou "Formule") pour ouvrir le catalogue complet.',
            'Clicca su "Chimica & Propellenti" nell’intestazione dei grani (o "Formula") per aprire catalogo ed editor.'
          ),
          autofillLabel: loc(
            'Abrir Catálogo de Propulsantes',
            'Open Propellant Catalog',
            'Ouvrir Catalogue Propergols',
            'Apri Catalogo Propellenti'
          ),
          onAutofill: () => {
            window.dispatchEvent(new CustomEvent('hermes-open-propellant-modal', { detail: { startEditor: false } }));
          },
        },
        {
          id: 'propellant_catalog_inspection',
          targetSelector: '[data-tour="propellant-standard-section"]',
          title: loc(
            '2. Propulsantes Estándar y Tramos de Presión',
            '2. Standard Propellants & Pressure Intervals',
            '2. Propergols Standards & Plages de Pression',
            '2. Propellenti Standard e Intervalli di Pressione'
          ),
          category: loc('Catálogo', 'Catalog', 'Catalogue', 'Catalogo'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'catalog',
          description: loc(
            'Consulta los propulsantes de referencia con sus constantes (ρ, T₀, γ, M) y su tabla experimental de tramos [P_mín - P_máx] con pares a y n.',
            'Inspect benchmark fuels with their thermochemical constants (ρ, T₀, γ, M) and piecewise [P_min - P_max] tables of a and n values.',
            'Consultez les propergols de référence avec leurs constantes (ρ, T₀, γ, M) et leurs plages [P_min - P_max].',
            'Consulta i propellenti standard con le relative costanti (ρ, T₀, γ, M) e le tabelle [P_min - P_max].'
          ),
        },
        {
          id: 'propellant_new_action',
          targetSelector: '[data-tour="propellant-new-btn"]',
          title: loc(
            '3. Crear Desde Cero o Duplicar Base',
            '3. Create New or Duplicate Base Fuel',
            '3. Créer ou Dupliquer une Base',
            '3. Crea Nuovo o Duplica Base'
          ),
          category: loc('Editor', 'Editor', 'Éditeur', 'Editor'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'catalog',
          description: loc(
            'Pulsa "+ Nuevo Propulsante" (o el botón Duplicar en cualquier propulsante existente) para iniciar una nueva formulación editable.',
            'Click "+ New Propellant" (or Duplicate on any existing formulation) to start an editable custom fuel.',
            'Cliquez sur "+ Nouveau Propergol" (ou Dupliquer) pour démarrer une formule personnalisée.',
            'Clicca su "+ Nuovo Propellente" (o Duplica) per iniziare una formulazione personalizzata.'
          ),
        },
        {
          id: 'propellant_identity_step',
          targetSelector: '[data-tour="propellant-identity-card"]',
          title: loc(
            '4. Nombre y Familia Química',
            '4. Name & Chemical Family',
            '4. Nom et Famille Chimique',
            '4. Nome e Famiglia Chimica'
          ),
          category: loc('Identidad', 'Identity', 'Identité', 'Identità'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Asigna un nombre descriptivo y la familia química (Candy, RNX, APCP o Personalizado) para reconocerlo rápido en los selectores.',
            'Assign a clear name and chemical family (Candy, RNX, APCP, or Custom) so it stands out in dropdown menus.',
            'Donnez un nom clair et sélectionnez sa famille chimique (Candy, RNX, APCP ou Personnalisé).',
            'Assegna un nome chiaro e la famiglia chimica (Candy, RNX, APCP o Personalizzato).'
          ),
        },
        {
          id: 'propellant_thermo_inputs',
          targetSelector: '[data-tour="propellant-thermo-card"]',
          title: loc(
            '5. Parámetros Termoquímicos (ρ, T₀, γ, M)',
            '5. Thermochemical Constants (ρ, T₀, γ, M)',
            '5. Constantes Thermochimiques (ρ, T₀, γ, M)',
            '5. Costanti Termochimiche (ρ, T₀, γ, M)'
          ),
          category: loc('Física', 'Physics', 'Physique', 'Fisica'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Introduce densidad, temperatura adiabática de llama, relación Cp/Cv y peso molecular medio obtenidos de NASA CEA o ensayo.',
            'Enter grain density, adiabatic flame temperature, Cp/Cv ratio, and average molar weight from NASA CEA or lab data.',
            'Saisissez densité, température de flamme, rapport Cp/Cv et masse molaire issus de NASA CEA ou d’essais.',
            'Inserisci densità, temperatura di fiamma, rapporto Cp/Cv e massa molecolare da NASA CEA o prove.'
          ),
        },
        {
          id: 'propellant_burn_table_step',
          targetSelector: '[data-tour="propellant-burn-table"]',
          title: loc(
            '6. Tramos de Presión y Valores a y n',
            '6. Pressure Intervals & a, n Table',
            '6. Paliers de Pression & Tableau a, n',
            '6. Intervalli di Pressione e Tabella a, n'
          ),
          category: loc('Tabla r(P)', 'r(P) Table', 'Table r(P)', 'Tabella r(P)'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Define uno o varios intervalos [P_mín, P_máx] en MPa con sus valores de "a" y "n" (manteniendo siempre P_mín < P_máx y n < 1 para estabilidad).',
            'Define one or more [P_min, P_max] MPa intervals with "a" and "n" values (keeping P_min < P_max and n < 1 for stability).',
            'Définissez un ou plusieurs paliers [P_min, P_max] en MPa avec leurs valeurs a et n (n < 1 obligatoire).',
            'Definisci uno o più intervalli [P_min, P_max] in MPa con i valori di a e n (mantenendo sempre n < 1).'
          ),
        },
        {
          id: 'propellant_curve_preview',
          targetSelector: '[data-tour="propellant-curve-card"]',
          title: loc(
            '7. Curva r(P) en Tiempo Real',
            '7. Live r(P) Curve Inspection',
            '7. Courbe r(P) en Temps Réel',
            '7. Curva r(P) in Tempo Reale'
          ),
          category: loc('Gráfica', 'Plot', 'Graphique', 'Grafico'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Comprueba en la gráfica interactiva que los tramos enlazan de forma coherente entre 0.1 y 10 MPa antes de guardar.',
            'Verify on the live interactive plot that piecewise segments transition cleanly from 0.1 to 10 MPa.',
            'Vérifiez sur le graphique en direct que les paliers se raccordent proprement entre 0.1 et 10 MPa.',
            'Verifica sul grafico in tempo reale che gli intervalli tra 0.1 e 10 MPa siano continui e coerenti.'
          ),
        },
        {
          id: 'propellant_save_action',
          targetSelector: '[data-tour="propellant-save-btn"]',
          title: loc(
            '8. Guardar en Biblioteca de Propelentes',
            '8. Save to Propellant Library',
            '8. Enregistrer dans la Bibliothèque',
            '8. Salva nella Libreria Propellenti'
          ),
          category: loc('Guardado', 'Save', 'Sauvegarde', 'Salvataggio'),
          tab: 'inputs',
          openModal: 'propellant',
          openModalTab: 'editor',
          description: loc(
            'Pulsa "Guardar Propulsante" para conservar tu fórmula en el navegador, compartirla dentro de archivos .hrms y asignarla a cualquier grano.',
            'Click "Save Propellant" to persist your formula in browser storage, bundle it inside .hrms packages, and select it on any grain.',
            'Cliquez sur "Enregistrer" pour stocker la formule dans le navigateur et la sélectionner sur n’importe quel grain.',
            'Clicca su "Salva Propellente" per memorizzare la formula nel browser, includerla nei file .hrms e usarla nei grani.'
          ),
        },
      ],
    },

    // 5. TOUR: Interpretación de Resultados y Curvas (requiere simular primero)
    tour_results: {
      id: 'tour_results',
      title: loc(
        'Guía: Resultados y Curvas Balísticas',
        'Guide: Results & Ballistic Curves',
        'Guide : Résultats & Courbes Balistiques',
        'Guida: Risultati e Curve Balistiche'
      ),
      description: loc(
        'Lee las 10 métricas clave, el estado estructural Padm y las curvas P(t) y F(t) (Nakka vs Tobera Ideal TTI).',
        'Read all 10 key ballistic cards, structural Padm status, and P(t) & F(t) curves (Nakka vs Ideal Nozzle TTI).',
        'Lisez les 10 métriques clés, l’état structural Padm et les courbes P(t) et F(t) (Nakka vs TTI).',
        'Leggi le 10 schede metriche, lo stato strutturale Padm e le curve P(t) e F(t) (Nakka vs TTI).'
      ),
      steps: [
        {
          id: 'results_prereq_step',
          targetSelector: '[data-tour="tab-trigger-results"]',
          requiresResults: true,
          title: loc(
            '1. Estado de Seguridad Padm y Acceso a Resultados',
            '1. Padm Safety Status & Results Access',
            '1. État Padm & Accès aux Résultats',
            '1. Stato Sicurezza Padm e Accesso Risultati'
          ),
          category: loc('Results', 'Results', 'Résultats', 'Risultati'),
          tab: 'results',
          description: loc(
            'Esta pestaña se desbloquea tras pulsar SIMULAR. Arriba muestra el semáforo de presión comparando Pmáx con la presión admisible Padm y el modo de fallo gobernante (pared o tornillos).',
            'This tab unlocks after clicking SIMULATE. The top banner compares peak pressure Pmax against admissible Padm and reports the governing limit (cylinder wall or bolts).',
            'Cet onglet se débloque après avoir cliqué sur SIMULER. La bannière supérieure compare Pmax à Padm et indique la limite gouvernante.',
            'Questo pannello si sblocca dopo aver premuto SIMULA. In alto confronta Pmax con Padm e mostra il limite governante (parete o viti).'
          ),
          autofillLabel: loc(
            'Cargar Datos BATES 3×54mm KNSB (luego pulsa SIMULAR)',
            'Load 3×54mm KNSB BATES Data (then click SIMULATE)',
            'Charger BATES 3×54mm KNSB (puis SIMULER)',
            'Carica Dati BATES 3×54mm KNSB (poi SIMULA)'
          ),
          onAutofill: () => {
            if (callbacks) {
              callbacks.setGrains([
                {
                  id: 'bates-results-1',
                  shape: 1,
                  propellantType: 2,
                  D0: 50,
                  d0: 20,
                  d0mayor: 0,
                  L0: 120,
                  N: 3,
                  Np: 0,
                  osi: 0,
                  ci: 1,
                  ei: 1,
                  rhorat: 0.95,
                },
              ]);
              callbacks.setNozzle({ Dt0: 16.5, Ds: 36.0, e: 0, alpha: 14, etanoz: 0.88 });
              callbacks.setMotor({ Dc: 54, Lc: 400, Gstar: 2.0, kv: 1.0, etac: 0.92, paso_de_tiempo: 0.001, Pamb: 0.101325 });
            }
          },
        },
        {
          id: 'summary_cards',
          targetSelector: '[data-tour="results-summary-cards"]',
          requiresResults: true,
          title: loc(
            '2. Las 10 Cajetillas de Rendimiento Balístico',
            '2. All 10 Ballistic Performance Metric Cards',
            '2. Les 10 Cartes de Performances Balistiques',
            '2. Le 10 Schede di Prestazione Balistica'
          ),
          category: loc('Métricas', 'Metrics', 'Métriques', 'Metriche'),
          tab: 'results',
          description: loc(
            'Revisa de un vistazo la clasificación oficial Tripoli/NFPA y las magnitudes integradas del disparo:',
            'Inspect official Tripoli/NFPA classification and integrated motor performance at a glance:',
            'Consultez en un coup d’œil la classe officielle Tripoli/NFPA et les grandeurs clés du tir :',
            'Esamina a colpo d’occhio la classe ufficiale Tripoli/NFPA e le grandezze integrate del motore:'
          ),
          bulletPoints: [
            loc(
              'Clase de Motor, Impulso Total It [N·s] e Impulso Específico Isp [s].',
              'Motor Class, Total Impulse It [N·s], and Specific Impulse Isp [s].',
              'Classe de moteur, Impulsion Totale It [N·s] et Impulsion Spécifique Isp [s].',
              'Classe Motore, Impulso Totale It [N·s] e Impulso Specifico Isp [s].'
            ),
            loc(
              'Presión Máxima (Pmax) y Media (Pmed) [MPa], Empuje Máximo (Fmax) y Medio (Favg) [N].',
              'Max (Pmax) & Average (Pmed) Pressure [MPa], Max (Fmax) & Average (Favg) Thrust [N].',
              'Pressions Max/Moyenne [MPa] et Poussées Max/Moyenne [N].',
              'Pressione Max/Media [MPa] e Spinta Max/Media [N].'
            ),
            loc(
              'Tiempo de Quemado (tb) [s], Tiempo de Acción (tact) [s] y Masa Total de Propelente [kg].',
              'Burn Time (tb) [s], Action Time (tact) [s], and Total Propellant Mass [kg].',
              'Temps de combustion (tb), Temps d’action (tact) et Masse de propergol [kg].',
              'Tempo di combustione (tb), Tempo d’azione (tact) e Massa propellente [kg].'
            ),
          ],
        },
        {
          id: 'pressure_curve',
          targetSelector: '[data-tour="pressure-chart-card"]',
          requiresResults: true,
          title: loc(
            '3. Curva de Presión de Cámara P(t)',
            '3. Chamber Pressure Curve P(t)',
            '3. Courbe de Pression de Chambre P(t)',
            '3. Curva di Pressione in Camera P(t)'
          ),
          category: loc('Gráfica P(t)', 'Pressure Plot', 'Graphique P(t)', 'Grafico P(t)'),
          tab: 'results',
          description: loc(
            'Muestra la presión manométrica frente al tiempo [MPa] para comprobar la forma de meseta (neutra, progresiva o regresiva) y el transitorio final de despresurización.',
            'Plots gauge chamber pressure over time [MPa] to inspect curve shape (neutral, progressive, regressive) and blowdown tail-off.',
            'Affiche la pression relative [MPa] dans le temps pour vérifier le plateau et la chute finale.',
            'Mostra la pressione relativa [MPa] nel tempo per verificare plateau e coda di depressurizzazione.'
          ),
        },
        {
          id: 'thrust_curve',
          targetSelector: '[data-tour="thrust-chart-card"]',
          requiresResults: true,
          title: loc(
            '4. Curva de Empuje F(t): Nakka vs Tobera Ideal TTI',
            '4. Thrust Curve F(t): Nakka vs Ideal Nozzle TTI',
            '4. Courbe de Poussée F(t) : Nakka vs Tuyère Idéale TTI',
            '4. Curva di Spinta F(t): Nakka vs Ugello Ideale TTI'
          ),
          category: loc('Gráfica F(t)', 'Thrust Plot', 'Graphique F(t)', 'Grafico F(t)'),
          tab: 'results',
          description: loc(
            'Superpone la aproximación clásica de Richard Nakka con el modelo de Teoría de Toberas Ideales (TTI) que evalúa expansión sub/sobreexpandida según Ds/Dt y Pamb.',
            'Overlays Richard Nakka’s empirical curve with the Ideal Nozzle Theory (TTI) model accounting for under/over-expansion from Ds/Dt and Pamb.',
            'Superpose la courbe de Richard Nakka au modèle TTI complet tenant compte de la détente réelle selon Ds/Dt et Pamb.',
            'Sovrappone la curva di Richard Nakka al modello di Ugello Ideale (TTI) considerando l’espansione reale da Ds/Dt e Pamb.'
          ),
        },
      ],
    },

    // 6. NUEVA GUÍA: Análisis Detallado de la Combustión (4 subpestañas)
    tour_analysis: {
      id: 'tour_analysis',
      title: loc(
        'Guía: Análisis Detallado de la Combustión',
        'Guide: Detailed Combustion Analysis',
        'Guide : Analyse Détaillée de la Combustion',
        'Guida: Analisi Dettagliata della Combustione'
      ),
      description: loc(
        'Explora las 4 subpestañas internas del motor: Áreas Ab(t), Ratio Klemmung Kn(t), Velocidad r(P) y Flujo Másico / Erosión G*.',
        'Inspect all 4 internal combustion sub-tabs: Burning Areas Ab(t), Klemmung Ratio Kn(t), Burn Rate r(P), and Mass Flow / Erosive Flux.',
        'Explorez les 4 sous-onglets : Aires Ab(t), Ratio Kn(t), Vitesse r(P) et Débit Massique / Érosion.',
        'Esplora i 4 sotto-pannelli: Aree Ab(t), Rapporto Kn(t), Velocità r(P) e Portata Massica / Erosione.'
      ),
      steps: [
        {
          id: 'analysis_areas_step',
          targetSelector: '[data-tour="subtab-btn-areas"]',
          requiresResults: true,
          analysisSubTab: 'areas',
          title: loc(
            '1. Áreas de Combustión Ab(t) y Desglose por Grano',
            '1. Burning Areas Ab(t) & Per-Grain Breakdown',
            '1. Aires de Combustion Ab(t) & Détail par Grain',
            '1. Aree di Combustione Ab(t) e Dettaglio per Grano'
          ),
          category: loc('Subpestaña 1', 'Sub-tab 1', 'Sous-onglet 1', 'Sotto-pannello 1'),
          tab: 'analysis',
          description: loc(
            'Visualiza el área total quemando y separa la contribución de cada cara (canal interior Abc, extremos Abe, exterior Abs) e incluso filtra por cada segmento individual.',
            'Inspects total burning area and isolates each surface contribution (core Abc, ends Abe, outer Abs) with per-grain filtering.',
            'Affiche l’aire totale et sépare la contribution de chaque face (canal Abc, extrémités Abe, extérieur Abs) par segment.',
            'Mostra l’area totale e separa il contributo di ciascuna faccia (canale Abc, basi Abe, esterno Abs) per singolo grano.'
          ),
        },
        {
          id: 'analysis_kn_step',
          targetSelector: '[data-tour="subtab-btn-kn"]',
          requiresResults: true,
          analysisSubTab: 'kn',
          title: loc(
            '2. Ratio Klemmung Kn(t) = Ab / At',
            '2. Klemmung Ratio Kn(t) = Ab / At',
            '2. Ratio Klemmung Kn(t) = Ab / At',
            '2. Rapporto Klemmung Kn(t) = Ab / At'
          ),
          category: loc('Subpestaña 2', 'Sub-tab 2', 'Sous-onglet 2', 'Sotto-pannello 2'),
          tab: 'analysis',
          description: loc(
            'Controla la relación entre el área de combustión y la garganta en cada instante. Permite verificar si el diseño progresa suavemente sin picos peligrosos ni extinción.',
            'Tracks instantaneous burning-area-to-throat ratio to verify smooth operation without dangerous pressure spikes or low-Kn flameout.',
            'Suit le ratio surface de combustion / col à chaque instant pour vérifier la stabilité sans pic ni extinction.',
            'Monitora il rapporto area di combustione / gola in ogni istante per evitare picchi di pressione o spegnimenti.'
          ),
        },
        {
          id: 'analysis_burnrate_step',
          targetSelector: '[data-tour="subtab-btn-burnrate"]',
          requiresResults: true,
          analysisSubTab: 'burn_rate',
          title: loc(
            '3. Velocidad de Regresión r(t) y Régimen de Presión',
            '3. Burn Rate r(t) & Pressure Regime',
            '3. Vitesse de Régression r(t) & Régime de Pression',
            '3. Velocità di Regressione r(t) e Regime di Pressione'
          ),
          category: loc('Subpestaña 3', 'Sub-tab 3', 'Sous-onglet 3', 'Sotto-pannello 3'),
          tab: 'analysis',
          description: loc(
            'Muestra la velocidad real de retroceso de llama [mm/s] durante el quemado, incluyendo las transiciones entre tramos de la ley de Saint-Robert.',
            'Shows instantaneous flame regression velocity [mm/s] across the firing, including transitions between piecewise Saint-Robert intervals.',
            'Montre la vitesse instantanée de régression [mm/s] et les transitions entre paliers de pression.',
            'Mostra la velocità istantanea di regressione [mm/s] comprese le transizioni tra intervalli della legge di Saint-Robert.'
          ),
        },
        {
          id: 'analysis_massflow_step',
          targetSelector: '[data-tour="subtab-btn-massflow"]',
          requiresResults: true,
          analysisSubTab: 'mass_flow',
          title: loc(
            '4. Flujo Másico, Masa Restante y Botón Más Info',
            '4. Mass Flow, Propellant Mass & More Info',
            '4. Débit Massique, Masse Restante & Plus d’Infos',
            '4. Portata Massica, Massa Residua e Altre Info'
          ),
          category: loc('Subpestaña 4', 'Sub-tab 4', 'Sous-onglet 4', 'Sotto-pannello 4'),
          tab: 'analysis',
          description: loc(
            'Compara el caudal generado por el grano frente al descargado por la tobera, sigue el consumo de masa y abre "Más Información" arriba a la derecha para ver la teoría de cada gráfico.',
            'Compares grain gas generation against nozzle mass discharge, tracks propellant depletion, and lets you toggle "More Info" at top right for equation summaries.',
            'Compare débit généré et débit évacué, suit la masse restante et offre un panneau théorique via "Plus d’Infos".',
            'Confronta portata generata e scaricata, segue il consumo di massa e offre il pannello teorico tramite "Altre Info".'
          ),
        },
      ],
    },

    // 7. TOUR: Exportación Numérica (CSV / Excel Columnas-Filas / Informe PDF)
    tour_export: {
      id: 'tour_export',
      title: loc(
        'Guía: Exportación Numérica (CSV, Excel y PDF)',
        'Guide: Data Export (CSV, Excel & PDF)',
        'Guide : Exportation (CSV, Excel & PDF)',
        'Guida: Esportazione Dati (CSV, Excel e PDF)'
      ),
      description: loc(
        'Exporta series balísticas en CSV, hojas Excel configurables por columnas o filas, e informes técnicos en PDF con opción de vuelo 1D.',
        'Export ballistic series to CSV, column- or row-oriented Excel workbooks, and technical PDF reports including optional 1D flight metrics.',
        'Exportez vos courbes vers CSV, classeurs Excel (en colonnes ou en lignes) et rapports techniques PDF.',
        'Esporta serie balistiche in CSV, file Excel (per colonne o righe) e report tecnici PDF con volo 1D opzionale.'
      ),
      steps: [
        {
          id: 'export_csv_btn',
          targetSelector: '[data-tour="export-csv-btn"]',
          requiresResults: true,
          title: loc(
            '1. Exportar Resultados a CSV, Excel (.xlsx) o Informe PDF',
            '1. Export Results to CSV, Excel (.xlsx) or PDF Report',
            '1. Exporter vers CSV, Excel (.xlsx) ou Rapport PDF',
            '1. Esporta Risultati in CSV, Excel (.xlsx) o Report PDF'
          ),
          category: loc('Exportación', 'Export', 'Export', 'Esportazione'),
          tab: 'results',
          description: loc(
            'Con una simulación calculada, pulsa "Exportar" en la esquina superior derecha de Results para elegir entre tres formatos:',
            'Once a simulation is computed, click "Export" at the top right of Results to choose from three output formats:',
            'Une fois la simulation calculée, cliquez sur "Exporter" en haut à droite de Résultats pour choisir parmi trois formats :',
            'Una volta calcolata la simulazione, clicca su "Esporta" in alto a destra in Risultati per scegliere tra tre formati:'
          ),
          bulletPoints: [
            loc(
              'CSV (.csv): Serie temporal completa con paso dt (tiempo, presión, empuje Nakka y TTI, Kn, flujo másico y áreas) lista para Python o MATLAB.',
              'CSV (.csv): Full time-stepped dataset (time, pressure, Nakka & TTI thrust, Kn, mass flow, areas) ready for Python or MATLAB.',
              'CSV (.csv) : Série temporelle complète prête pour Python, MATLAB ou tableurs.',
              'CSV (.csv): Serie temporale completa pronta per Python, MATLAB o fogli di calcolo.'
            ),
            loc(
              'Excel (.xlsx): Permite elegir disposición "Por Columnas" o "Por Filas" e incluye hoja de resumen y parámetros del motor.',
              'Excel (.xlsx): Supports choosing "By Columns" or "By Rows" orientation with summary metrics and motor input sheets.',
              'Excel (.xlsx) : Permet de choisir l’orientation "Par Colonnes" ou "Par Lignes" avec feuille de résumé.',
              'Excel (.xlsx): Consente di scegliere l’orientamento "Per Colonne" o "Per Righe" con riepilogo e dati motore.'
            ),
            loc(
              'Informe PDF (.pdf): Genera un informe técnico con título editable, gráficos de presión/empuje, tabla de granos y, si lo marcas, la sección de apogeo de Mission Control.',
              'PDF Report (.pdf): Builds an engineering dossier with custom title, pressure/thrust plots, grain specs, and optional Mission Control flight summary.',
              'Rapport PDF (.pdf) : Génère un dossier technique avec titre, courbes, géométries et résumé optionnel de vol.',
              'Report PDF (.pdf): Genera un dossier tecnico con titolo personalizzato, grafici, geometria e riepilogo volo opzionale.'
            ),
          ],
        },
      ],
    },

    // 8. TOUR: Guardar, Biblioteca (Carpetas/Estudio) y Paquetes .hrms
    tour_save: {
      id: 'tour_save',
      title: loc(
        'Guía: Guardar, Biblioteca y Paquetes .hrms',
        'Guide: Save, Library & .hrms Packages',
        'Guide : Sauvegarde, Bibliothèque & Fichiers .hrms',
        'Guida: Salva, Libreria e Pacchetti .hrms'
      ),
      description: loc(
        'Organiza motores por carpetas, evita duplicados, envía diseños directos a Estudio y comparte proyectos completos con archivos .hrms.',
        'Organize motors in folders, avoid accidental duplicates, send runs straight to Study, and share complete projects as .hrms files.',
        'Classez vos moteurs par dossiers, envoyez-les directement vers l’Étude et partagez des projets complets en .hrms.',
        'Organizza i motori in cartelle, inviali direttamente a Studio e condividi progetti completi con file .hrms.'
      ),
      steps: [
        {
          id: 'save_sim_button_step',
          targetSelector: '[data-tour="save-sim-btn"]',
          title: loc(
            '1. Guardar Motor en Carpetas (Cabecera)',
            '1. Save Motor in Folders (Header)',
            '1. Enregistrer dans des Dossiers (En-tête)',
            '1. Salva Motore in Cartelle (Intestazione)'
          ),
          category: loc('Cabecera', 'Header', 'En-tête', 'Intestazione'),
          tab: 'inputs',
          description: loc(
            'El botón "Guardar" de la cabecera superior abre el modal de almacenamiento local. Puedes elegir una carpeta existente con un clic o crear una nueva (+ Nueva carpeta), ver qué simulaciones ya hay dentro y recibir aviso automático si vas a actualizar una existente.',
            'The top-bar "Save" button opens local storage organization: pick an existing folder in one click or create a new one, preview files already inside that folder, and get an overwrite warning if updating an existing name.',
            'Le bouton "Enregistrer" en haut permet de choisir un dossier existant, créer un nouveau dossier, voir le contenu du dossier et éviter les écrasements involontaires.',
            'Il pulsante "Salva" in alto consente di scegliere o creare cartelle, vedere i file già presenti e ricevere avviso se stai aggiornando un progetto esistente.'
          ),
        },
        {
          id: 'hermes_package_step',
          targetSelector: '[data-tour="hermes-share-btn"]',
          title: loc(
            '2. Intercambio Rápido con Archivos .hrms',
            '2. Quick Project Sharing via .hrms Files',
            '2. Partage Rapide via Fichiers .hrms',
            '2. Condivisione Rapida con File .hrms'
          ),
          category: loc('Cabecera · .hrms', 'Header · .hrms', 'En-tête · .hrms', 'Intestazione · .hrms'),
          tab: 'inputs',
          description: loc(
            'El botón ".hrms" de la cabecera exporta o importa paquetes portables con todo el proyecto: cámara, tobera, granos (incluyendo formas dibujadas personalizadas), propulsantes personalizados incrustados, configuración de Mission Control y datos experimentales opcionales.',
            'The header ".hrms" button exports or imports portable project bundles containing casing, nozzle, grains (including custom drawn shapes), embedded custom propellants, Mission Control parameters, and optional test stand logs.',
            'Le bouton ".hrms" exporte ou importe des paquets complets incluant carter, tuyère, grains (y compris formes dessinées personnalisées), propergols personnalisés et données de vol/essai.',
            'Il pulsante ".hrms" esporta o importa pacchetti completi con carcassa, ugello, grani (incluse forme disegnate personalizzate), propellenti personalizzati, parametri di volo e dati sperimentali.'
          ),
        },
        {
          id: 'library_explorer_step',
          targetSelector: '[data-tour="settings-menu-btn"]',
          title: loc(
            '3. Biblioteca en la Barra Lateral de Ajustes',
            '3. Library Inside the Settings Sidebar',
            '3. Bibliothèque dans la Barre de Réglages',
            '3. Libreria nella Barra Laterale Impostazioni'
          ),
          category: loc('Barra Lateral · Biblioteca', 'Sidebar · Library', 'Barre Latérale · Bibliothèque', 'Barra Laterale · Libreria'),
          tab: 'inputs',
          description: loc(
            'Abre "Ajustes" arriba a la derecha y pulsa "Biblioteca" para explorar tus proyectos con buscador y filtro de carpetas. Cada simulación guardada permite: "Abrir en Simulate", "Añadir a Estudio", mover de carpeta, exportar a .hrms o eliminar.',
            'Open "Settings" at top right and click "Library" to browse saved designs with search and folder filtering. From there you can "Open in Simulate", "Add to Study", move folders, export .hrms, or delete.',
            'Ouvrez "Réglages" en haut à droite puis "Bibliothèque" pour rechercher, filtrer par dossier, ouvrir dans Simulate, ajouter à l’Étude ou exporter en .hrms.',
            'Apri "Impostazioni" in alto a destra e clicca "Libreria" per cercare, filtrare per cartella, aprire in Simulate, aggiungere a Studio o esportare in .hrms.'
          ),
        },
      ],
    },

    // 9. TOUR: Mission Control, Recuperación, Rampa/Viento y Vuelo 1D
    tour_mission_control: {
      id: 'tour_mission_control',
      title: loc(
        'Guía: Mission Control, Recuperación y Vuelo 1D',
        'Guide: Mission Control, Recovery & 1D Flight',
        'Guide : Mission Control, Récupération & Vol 1D',
        'Guida: Mission Control, Recupero e Volo 1D'
      ),
      description: loc(
        'Configura masas, rampa, viento, ángulo, paracaídas (simple o doble), curva Mach vs Cd, ensayos con tara y gráficas completas de trayectoria.',
        'Configure masses, rail length, wind, launch tilt, single/dual recovery chutes, Mach vs Cd drag, tared test-stand data, and trajectory charts.',
        'Configurez masses, rampe, vent, inclinaison, parachutes, courbe Mach vs Cd, essais tarés et graphiques de trajectoire.',
        'Configura masse, rampa, vento, inclinazione, paracadute singolo/doppio, curva Mach vs Cd, dati di banco tarati e grafici di traiettoria.'
      ),
      steps: [
        {
          id: 'mission_rocket_params',
          targetSelector: '[data-tour="mission-rocket-params-card"]',
          title: loc(
            '1. Cohete, Rampa, Viento e Inclinación',
            '1. Rocket Mass, Rail, Wind & Tilt Angle',
            '1. Masse Fusée, Rampe, Vent & Inclinaison',
            '1. Massa Razzo, Rampa, Vento e Inclinazione'
          ),
          category: loc('Parámetros de Vuelo', 'Flight Inputs', 'Paramètres de Vol', 'Parametri Volo'),
          tab: 'mission_control',
          description: loc(
            'Introduce la masa en seco sin motor (la masa estructural del motor se sincroniza desde Inputs), diámetro del fuselaje, altitud y temperatura de lanzamiento, longitud de guía/rampa [m], viento en rampa [m/s] y ángulo de trayectoria [0–90º].',
            'Enter airframe dry mass (structural motor mass auto-syncs from Inputs), fuselage diameter, launch altitude & temperature, launch rail length [m], wind at rail [m/s], and flight path angle [0–90°].',
            'Saisissez masse à vide (la masse moteur est synchronisée depuis Entrées), calibre, altitude/température, longueur de rampe [m], vent [m/s] et angle [0–90°].',
            'Inserisci massa a secco (la massa motore si sincronizza da Dati), calibro, quota/temperatura, lunghezza rampa [m], vento [m/s] e angolo [0–90°].'
          ),
          tip: loc(
            'Tras modificar los parámetros, pulsa "Actualizar" en la esquina superior de la tarjeta para recalcular el apogeo y la velocidad de salida de rampa.',
            'After editing inputs, press "Update" at the card header to recompute apogee and rail-exit velocity.',
            'Après modification, cliquez sur "Actualiser" en haut de la carte pour recalculer le vol.',
            'Dopo le modifiche, premi "Aggiorna" in alto nella scheda per ricalcolare la traiettoria.'
          ),
        },
        {
          id: 'mission_recovery_step',
          targetSelector: '[data-tour="mission-recovery-section"]',
          title: loc(
            '2. Sistema de Recuperación (Paracaídas Simple o Doble)',
            '2. Recovery System (Main Only or Drogue + Main)',
            '2. Système de Récupération (Simple ou Double)',
            '2. Sistema di Recupero (Singolo o Doppio)'
          ),
          category: loc('Recuperación', 'Recovery', 'Récupération', 'Recupero'),
          tab: 'mission_control',
          description: loc(
            'Elige entre "Solo Ascenso", "Principal" (despliega en apogeo) o "Drogue + Principal" (drogue en apogeo y principal a la altura AGL seleccionada), configurando diámetros y Cd para calcular velocidad de descenso y tiempo hasta aterrizaje.',
            'Choose "Ascent Only", "Main Only" (deploys at apogee), or "Drogue + Main" (drogue at apogee, main at selected AGL altitude), setting chute diameters and Cd to compute sink rate and landing time.',
            'Choisissez "Montée Seule", "Principal" (à l’apogée) ou "Drogue + Principal" (drogue à l’apogée puis principal à l’altitude AGL choisie) avec diamètres et Cd.',
            'Scegli "Solo Salita", "Principale" (all’apogeo) o "Drogue + Principale" (drogue all’apogeo e principale alla quota AGL scelta) impostando diametri e Cd.'
          ),
        },
        {
          id: 'mission_aero_drag',
          targetSelector: '[data-tour="mission-aero-card"]',
          title: loc(
            '3. Curva Aerodinámica Mach vs Cd',
            '3. Aerodynamic Drag & Mach vs Cd Polar',
            '3. Traînée Aérodynamique & Courbe Mach vs Cd',
            '3. Resistenza Aerodinamica e Curva Mach vs Cd'
          ),
          category: loc('Aerodinámica', 'Aerodynamics', 'Aérodynamique', 'Aerodinamica'),
          tab: 'mission_control',
          description: loc(
            'Usa el modelo estándar o activa "Usar Personalizado" para cargar tu tabla Mach vs Cd desde OpenRocket/RASAero en CSV, Excel o pegado manual en el editor.',
            'Use the standard drag profile or toggle "Use Custom" to load your own Mach vs Cd table from OpenRocket/RASAero via CSV, Excel, or manual paste.',
            'Utilisez le modèle standard ou activez "Personnalisé" pour charger votre table Mach vs Cd depuis OpenRocket/RASAero (CSV, Excel ou éditeur).',
            'Usa il profilo standard o attiva "Personalizzato" per caricare la tabella Mach vs Cd da OpenRocket/RASAero (CSV, Excel o editor manuale).'
          ),
        },
        {
          id: 'mission_exp_import',
          targetSelector: '[data-tour="mission-exp-card"]',
          title: loc(
            '4. Importar Ensayos de Banco y Puesta a Cero (Tara)',
            '4. Static Test-Stand Import & Zero Tare',
            '4. Import de Banc d’Essai & Mise à Zéro (Tare)',
            '4. Importazione Dati di Banco e Azzeramento (Tara)'
          ),
          category: loc('Ensayos Reales', 'Test Data', 'Données Réelles', 'Dati Sperimentali'),
          tab: 'mission_control',
          description: loc(
            'Importa registros experimentales (Tiempo+Empuje, Tiempo+Presión, 3 columnas compartidas o 4 columnas independientes), elige las unidades de tus sensores y utiliza la puesta a cero manual para corregir offset de tara sin alterar los datos crudos.',
            'Import test-stand logs (Time+Thrust, Time+Pressure, shared 3-column, or independent 4-column logs), match sensor units, and toggle manual baseline tare without altering raw values.',
            'Importez vos essais (Temps+Poussée, Temps+Pression, 3 ou 4 colonnes), choisissez les unités et appliquez la mise à zéro (tare) sans modifier les données brutes.',
            'Importa log sperimentali (Tempo+Spinta, Tempo+Pressione, 3 o 4 colonne), imposta le unità e usa l’azzeramento manuale preservando i dati grezzi.'
          ),
        },
        {
          id: 'mission_flight_charts',
          targetSelector: '[data-tour="mission-charts-card"]',
          title: loc(
            '5. Métricas de Vuelo, Gráficas y Exportación',
            '5. Flight Metrics, Trajectory Plots & Export',
            '5. Métriques de Vol, Graphiques & Export',
            '5. Metriche di Volo, Grafici ed Export'
          ),
          category: loc('Trayectoria 1D', '1D Trajectory', 'Trajectoire 1D', 'Traiettoria 1D'),
          tab: 'mission_control',
          description: loc(
            'Analiza apogeo, velocidad máxima, Mach, aceleración pico (G), velocidad de descenso y compara Simulado frente a Experimental en las gráficas de Altitud, Empuje, Velocidad o Aceleración, con exportación a CSV/Excel.',
            'Inspect apogee, max speed, Mach, peak Gs, descent rate, and compare Simulated vs Experimental curves across Altitude, Thrust, Velocity, or Acceleration views, with CSV/Excel export.',
            'Analysez apogée, vitesse max, Mach, accélération (G), descente et comparez Simulé vs Expérimental sur tous les graphiques avec export CSV/Excel.',
            'Analizza apogeo, velocità max, Mach, accelerazione (G), discesa e confronta Simulato vs Sperimentale su tutti i grafici con export CSV/Excel.'
          ),
        },
      ],
    },

    // 10. TOUR: Smart Search (Diseño Inverso en 3 Fases)
    tour_smart_search: {
      id: 'tour_smart_search',
      title: loc(
        'Guía: Optimización Inversa con Smart Search',
        'Guide: Smart Search Inverse Optimization',
        'Guide : Optimisation Inverse Smart Search',
        'Guida: Ottimizzazione Inversa Smart Search'
      ),
      description: loc(
        'Diseña automáticamente geometrías óptimas respetando tus límites físicos con Differential Evolution (DE/rand/1/bin) y reglas de factibilidad.',
        'Automatically find optimal grain geometries respecting hardware limits via Differential Evolution (DE/rand/1/bin) and Deb feasibility rules.',
        'Concevez automatiquement des géométries optimales sous contraintes via Differential Evolution (DE/rand/1/bin) et règles de Deb.',
        'Trova automaticamente geometrie ottimali rispettando i vincoli fisici con Differential Evolution (DE/rand/1/bin) e regole di Deb.'
      ),
      steps: [
        {
          id: 'smart_search_goal',
          targetSelector: '[data-tour="smart-search-goal-card"]',
          title: loc('Paso 1: Objetivo de Misión', 'Step 1: Mission Objective', 'Étape 1 : Objectif de Mission', 'Passo 1: Obiettivo di Missione'),
          category: loc('Paso 1', 'Step 1', 'Étape 1', 'Passo 1'),
          tab: 'smart_search',
          smartSearchStep: 0,
          description: loc(
            'Elige la meta principal del optimizador (Máximo Impulso Total, Despegue Rápido o Impulso Objetivo) para acceder a las tres fases de configuración.',
            'Select the primary optimization target (Maximum Total Impulse, Fast Liftoff, or Target Impulse) to enter the 3-phase setup.',
            'Choisissez l’objectif principal (Impulsion Totale Max, Décollage Rapide ou Impulsion Cible) pour ouvrir les 3 phases.',
            'Seleziona l’obiettivo principale (Impulso Totale Max, Decollo Rapido o Impulso Obiettivo) per aprire le 3 fasi.'
          ),
        },
        {
          id: 'smart_search_phase1',
          targetSelector: '[data-tour="smart-search-phase1-card"]',
          title: loc('Paso 2: Fase 1 — Cámara, Presión Límite y Tobera', 'Step 2: Phase 1 — Chamber, Pressure Limit & Nozzle', 'Étape 2 : Phase 1 — Chambre, Pression Max & Tuyère', 'Passo 2: Fase 1 — Camera, Pressione Max e Ugello'),
          category: loc('Fase 1', 'Phase 1', 'Phase 1', 'Fase 1'),
          tab: 'smart_search',
          smartSearchStep: 1,
          description: loc(
            'Fija las cotas físicas de tu hardware (Dc, Lc, Pmáx segura, garganta Dt, salida Ds y ángulo α). Las alertas en vivo avisan de cualquier incoherencia geométrica.',
            'Set your fixed hardware constraints (Dc, Lc, safe Pmax limit, throat Dt, exit Ds, and α). Live alerts warn about any geometric conflict.',
            'Fixez les contraintes matérielles (Dc, Lc, Pmax sûre, col Dt, sortie Ds, angle α) avec alertes de cohérence en direct.',
            'Imposta i vincoli hardware fissi (Dc, Lc, Pmax sicura, gola Dt, uscita Ds e angolo α) con avvisi di coerenza in tempo reale.'
          ),
        },
        {
          id: 'smart_search_phase2',
          targetSelector: '[data-tour="smart-search-phase2-card"]',
          title: loc('Paso 3: Fase 2 — Geometría de Granos y Variables', 'Step 3: Phase 2 — Grain Geometry & Variables', 'Étape 3 : Phase 2 — Géométrie des Grains & Variables', 'Passo 3: Fase 2 — Geometria Grani e Variabili'),
          category: loc('Fase 2', 'Phase 2', 'Phase 2', 'Fase 2'),
          tab: 'smart_search',
          smartSearchStep: 2,
          description: loc(
            'Define qué formas puede explorar el optimizador, qué dimensiones están Fijas, en Rango o Libres (D₀, d₀, L₀, N), caras activas y límite de masa de propelente.',
            'Choose allowed grain shapes, Fixed/Range/Free dimension modes (D₀, d₀, L₀, N), burning faces, and total propellant mass constraint.',
            'Définissez formes autorisées, modes Fixe/Plage/Libre (D₀, d₀, L₀, N), faces actives et limite de masse.',
            'Scegli le forme consentite, le modalità Fisso/Intervallo/Libero (D₀, d₀, L₀, N), le facce attive e il limite di massa.'
          ),
        },
        {
          id: 'smart_search_phase3',
          targetSelector: '[data-tour="smart-search-phase3-card"]',
          title: loc('Paso 4: Fase 3 — Presupuesto Evolutivo', 'Step 4: Phase 3 — Evolutionary Budget', 'Étape 4 : Phase 3 — Budget Évolutif', 'Passo 4: Fase 3 — Budget Evolutivo'),
          category: loc('Fase 3', 'Phase 3', 'Phase 3', 'Fase 3'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'Selecciona el nivel de exploración del algoritmo (Rápido, Equilibrado o Profundo) según el tiempo de cómputo y precisión que necesites.',
            'Select the search depth preset (Fast, Balanced, or Deep) depending on desired computation budget and convergence precision.',
            'Sélectionnez la profondeur de recherche (Rapide, Équilibrée ou Approfondie) selon la précision souhaitée.',
            'Seleziona il livello di ricerca (Rapido, Bilanciato o Approfondito) in base a precisione e tempo desiderati.'
          ),
        },
        {
          id: 'smart_search_algo_btn',
          targetSelector: '[data-tour="smart-search-algorithm-btn"]',
          title: loc('Paso 5: Algoritmo y Formulación Matemática', 'Step 5: Algorithm & Mathematical Formulation', 'Étape 5 : Algorithme & Formulation', 'Passo 5: Algoritmo e Formulazione'),
          category: loc('Formulación', 'Formulation', 'Formulation', 'Formulazione'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'Este botón explica en detalle el muestreo Latin Hypercube (LHS), la mutación/cruce DE/rand/1/bin, la física 0D intacta y las reglas de factibilidad de Deb (1998).',
            'This button documents Latin Hypercube Sampling (LHS), DE/rand/1/bin evolution, intact 0D ballistics, and Deb feasibility ranking (1998).',
            'Ce bouton détaille l’échantillonnage LHS, l’évolution DE/rand/1/bin, la physique 0D intacte et les règles de faisabilité de Deb.',
            'Questo pulsante illustra campionamento LHS, evoluzione DE/rand/1/bin, fisica 0D intatta e regole di fattibilità di Deb.'
          ),
        },
        {
          id: 'smart_search_execute',
          targetSelector: '[data-tour="smart-search-run-btn"]',
          title: loc('Paso 6: Ejecutar, Cancelar en Vivo y Aplicar en 1 Clic', 'Step 6: Run, Live Cancel & 1-Click Apply', 'Étape 6 : Lancer, Annuler & Appliquer en 1 Clic', 'Passo 6: Avvia, Annulla e Applica in 1 Clic'),
          category: loc('Ejecución', 'Execution', 'Exécution', 'Esecuzione'),
          tab: 'smart_search',
          smartSearchStep: 3,
          description: loc(
            'Lanza la optimización global; puedes cancelarla en cualquier instante para recuperar las mejores soluciones válidas encontradas hasta ese momento y aplicar la ganadora a Inputs con 1 clic.',
            'Launch global optimization; cancel at any time to keep the best feasible designs found so far and apply the winner straight into Inputs in 1 click.',
            'Lancez la recherche ; vous pouvez l’annuler à tout moment pour conserver les meilleurs candidats et appliquer le gagnant en 1 clic.',
            'Avvia la ricerca; puoi annullarla in qualsiasi momento conservando i migliori candidati e applicare il vincitore in Dati con 1 clic.'
          ),
        },
      ],
    },

    // 11. NUEVA GUÍA: Animaciones CFD y Visor 3D de Vuelo
    tour_cfd: {
      id: 'tour_cfd',
      title: loc(
        'Guía: Animaciones CFD y Visor 3D de Vuelo',
        'Guide: CFD Animations & 3D Flight Viewer',
        'Guide : Animations CFD & Vue 3D de Vol',
        'Guida: Animazioni CFD e Vista 3D di Volo'
      ),
      description: loc(
        'Visualización dinámica de flujo supersónico en tobera Laval y reproducción 3D del vuelo vertical comparando simulación y ensayo.',
        'Dynamic visualization of supersonic De Laval nozzle flow alongside 3D flight trajectory playback comparing simulated vs experimental runs.',
        'Visualisation dynamique de l’écoulement en tuyère Laval et lecture 3D du vol comparant simulation et essai.',
        'Visualizzazione dinamica del flusso in ugello Laval e riproduzione 3D del volo tra simulazione e prova.'
      ),
      steps: [
        {
          id: 'cfd_overview_step',
          targetSelector: '[data-tour="cfd-panel"]',
          fallbackSelector: '[data-tour="tab-trigger-cfd"]',
          requiresResults: true,
          title: loc(
            '1. Visualización CFD de Tobera + Vuelo 3D en Tiempo Real',
            '1. Nozzle CFD Visualization + Real-Time 3D Flight',
            '1. Visualisation CFD Tuyère + Vol 3D en Temps Réel',
            '1. Visualizzazione CFD Ugello + Volo 3D in Tempo Reale'
          ),
          category: loc('Animaciones', 'Animations', 'Animations', 'Animazioni'),
          tab: 'cfd',
          description: loc(
            'Una vez simulado el motor, esta pestaña reúne dos visores visuales sin alterar los cálculos numéricos:',
            'Once a simulation is computed, this tab brings together two visual analyzers without modifying numerical results:',
            'Une fois la simulation exécutée, cet onglet réunit deux visualiseurs sans altérer les calculs :',
            'Dopo la simulazione, questo pannello riunisce due visualizzatori senza alterare i calcoli:'
          ),
          bulletPoints: [
            loc(
              'Visor CFD y Regresión (izquierda): Anima el flujo de gases en la tobera Laval (Mach, presión, temperatura, ondas de choque) sincronizado con el quemado del grano.',
              'CFD & Burnback Viewer (left): Animates De Laval nozzle exhaust (Mach, pressure, temperature, shock diamonds) synced with grain regression.',
              'Vue CFD (à gauche) : Anime l’écoulement supersonique dans la tuyère (Mach, pression, ondes de choc) synchronisé avec le grain.',
              'Vista CFD (a sinistra): Anima il flusso nell’ugello Laval (Mach, pressione, onde d’urto) sincronizzato col grano.'
            ),
            loc(
              'Visor 3D de Vuelo (derecha): Muestra el cohete 3D recorriendo la trayectoria de Mission Control (con estela según el propelente y comparación con datos experimentales si se han cargado).',
              '3D Flight Viewer (right): Renders the 3D rocket trajectory from Mission Control (with propellant-matched plume and experimental flight comparison if loaded).',
              'Vue 3D de Vol (à droite) : Représente la fusée 3D le long de la trajectoire Mission Control (avec comparaison expérimentale si chargée).',
              'Vista 3D di Volo (a destra): Mostra il razzo 3D lungo la traiettoria di Mission Control (con confronto sperimentale se caricato).'
            ),
          ],
        },
      ],
    },

    // 12. NUEVA GUÍA: Post-Process -> Estudio Comparativo
    tour_study: {
      id: 'tour_study',
      title: loc(
        'Guía: Post-Process — Estudio Comparativo',
        'Guide: Post-Process — Comparative Study',
        'Guide : Post-Traitement — Étude Comparative',
        'Guida: Post-Process — Studio Comparativo'
      ),
      description: loc(
        'Compara múltiples simulaciones, archivos .hrms y ensayos reales de banco de pruebas con desfase Δt, auto-cero t₀, tara manual Y e informe PDF.',
        'Compare multiple simulations, .hrms packages, and real static test-stand logs with editable Δt offset, t₀ auto-zero, manual Y tare, and PDF reports.',
        'Comparez plusieurs simulations, paquets .hrms et essais réels avec décalage Δt, t₀ auto, tare Y manuelle et rapport PDF.',
        'Confronta più simulazioni, pacchetti .hrms e prove reali con offset Δt, auto-zero t₀, tara Y manuale e report PDF.'
      ),
      steps: [
        {
          id: 'study_mode_entry',
          targetSelector: '[data-tour="tab-trigger-study"]',
          fallbackSelector: '[data-tour="workspace-mode-switcher"]',
          title: loc(
            '1. Entrar al Entorno Post-Process -> Estudio',
            '1. Entering Post-Process -> Study Workspace',
            '1. Accéder à l’Espace Post-Traitement -> Étude',
            '1. Accedere all’Area Post-Process -> Studio'
          ),
          category: loc('Post-Process', 'Post-Process', 'Post-Traitement', 'Post-Process'),
          tab: 'study',
          description: loc(
            'El selector superior izquierdo cambia instantáneamente entre "Simulate" (diseño y cálculo) y "Post-Process" (comparación en Estudio y próxima Caracterización a y n) sin perder tus curvas cargadas.',
            'The top-left mode switch toggles instantaneously between "Simulate" (design & solving) and "Post-Process" (Study comparison and upcoming a & n Characterization) without losing loaded curves.',
            'Le sélecteur en haut à gauche bascule instantanément entre "Simulate" et "Post-Process" tout en conservant vos courbes chargées.',
            'Il selettore in alto a sinistra alterna istantaneamente tra "Simulate" e "Post-Process" mantenendo intatte le curve caricate.'
          ),
        },
        {
          id: 'study_toolbar_step',
          targetSelector: '[data-tour="study-toolbar"]',
          title: loc(
            '2. Barra de Estudio: Unidades, Modelo, Guardar y PDF',
            '2. Study Toolbar: Units, Model, Save & PDF',
            '2. Barre d’Étude : Unités, Modèle, Sauvegarde & PDF',
            '2. Barra Studio: Unità, Modello, Salva e PDF'
          ),
          category: loc('Controles', 'Controls', 'Contrôles', 'Controlli'),
          tab: 'study',
          description: loc(
            'Pon un título al estudio, elige la unidad de presión (bar o MPa) y el modelo de empuje de las simulaciones (TTI o Nakka). También puedes guardar/cargar estudios completos o generar un Informe PDF comparativo.',
            'Name your study, switch pressure units (bar or MPa) and simulated thrust model (TTI or Nakka), save/reload full study sessions, or export a comparative PDF report.',
            'Nommez l’étude, choisissez bar/MPa et le modèle TTI/Nakka, sauvegardez/rechargez l’étude ou générez un rapport PDF comparatif.',
            'Assegna un titolo allo studio, scegli bar/MPa e il modello TTI/Nakka, salva/ricarica sessioni o esporta un report PDF comparativo.'
          ),
        },
        {
          id: 'study_sources_step',
          targetSelector: '[data-tour="study-add-sources"]',
          title: loc(
            '3. Cargar Curvas: Activa, Biblioteca, .hrms o Banco Real',
            '3. Add Curves: Active Run, Library, .hrms or Bench CSV',
            '3. Ajouter des Courbes : Active, Bibliothèque, .hrms ou Banc',
            '3. Aggiungi Curve: Attiva, Libreria, .hrms o Banco Prova'
          ),
          category: loc('Fuentes', 'Sources', 'Sources', 'Sorgenti'),
          tab: 'study',
          description: loc(
            'Añade todas las series que quieras superponer desde cuatro fuentes distintas:',
            'Add as many curves as needed from four input sources:',
            'Ajoutez autant de séries que souhaité depuis quatre sources :',
            'Aggiungi tutte le serie che vuoi confrontare da quattro sorgenti:'
          ),
          bulletPoints: [
            loc(
              'Simulación Activa o Biblioteca: Añade el motor actual o cualquiera guardado por carpetas.',
              'Active Simulation or Library: Import your current run or any motor saved in your Library.',
              'Simulation Active ou Bibliothèque : Ajoutez le moteur courant ou tout projet enregistré.',
              'Simulazione Attiva o Libreria: Importa il motore attuale o uno salvato in Libreria.'
            ),
            loc(
              'Múltiples .hrms: Arrastra varios paquetes .hrms a la vez para comparar diseños compartidos.',
              'Multiple .hrms Files: Drop several .hrms files at once to overlay shared motor designs.',
              'Multiples .hrms : Glissez plusieurs fichiers .hrms simultanément.',
              'File .hrms Multipli: Trascina più pacchetti .hrms insieme.'
            ),
            loc(
              'CSV / XLSX Experimental: Carga datos reales de presión/empuje seleccionando columnas y unidades.',
              'Experimental CSV / XLSX: Import real test-stand logs with column layout and sensor unit mapping.',
              'CSV / XLSX Expérimental : Importez des essais réels avec sélection de colonnes et d’unités.',
              'CSV / XLSX Sperimentale: Carica log di banco prova scegliendo colonne e unità dei sensori.'
            ),
          ],
        },
        {
          id: 'study_series_step',
          targetSelector: '[data-tour="study-series-list"]',
          title: loc(
            '4. Curvas en Estudio: Referencia (★), Δt, t₀ y Tarar Y',
            '4. Study Curves: Reference (★), Δt, t₀ & Tare Y',
            '4. Courbes : Référence (★), Δt, t₀ & Tarer Y',
            '4. Curve: Riferimento (★), Δt, t₀ e Tara Y'
          ),
          category: loc('Alineación', 'Alignment', 'Alignement', 'Allineamento'),
          tab: 'study',
          description: loc(
            'Gestiona cada serie individualmente: oculta/muestra con su casilla, edita su nombre, márcala con la estrella (★) como referencia para los porcentajes Δ%, ajusta el desfase Δt manualmente, auto-alinea el encendido (t₀) o aplica "Tarar Y / Datos Crudos" en ensayos experimentales.',
            'Manage each series individually: toggle visibility, rename inline, star (★) as baseline for Δ% deltas, edit Δt time offset freely, auto-align ignition (t₀), or toggle manual "Tare Y / Raw Data" on experimental logs.',
            'Gérez chaque série : visibilité, nom, étoile (★) de référence pour les écarts Δ%, décalage Δt, alignement auto t₀ et tare manuelle "Tarer Y / Données Brutes".',
            'Gestisci ogni serie: visibilità, rinomina, stella (★) come riferimento per i delta Δ%, offset Δt modificabile, auto-allineamento t₀ e "Tara Y / Dati Grezzi".'
          ),
        },
        {
          id: 'study_charts_step',
          targetSelector: '[data-tour="study-charts-area"]',
          title: loc(
            '5. Comparación Gráfica y Tabla de Variaciones (Δ%)',
            '5. Overlaid Charts & Delta Comparison Table (Δ%)',
            '5. Graphiques Superposés & Tableau des Écarts (Δ%)',
            '5. Grafici Sovrapposti e Tabella Variazioni (Δ%)'
          ),
          category: loc('Resultados', 'Outputs', 'Résultats', 'Risultati'),
          tab: 'study',
          description: loc(
            'A la derecha se comparan las barras de Impulso Total, las curvas superpuestas de Presión P(t) y Empuje F(t) (línea discontinua en ensayos reales), y la tabla completa de métricas con desviaciones porcentuales frente a tu curva de referencia.',
            'On the right, inspect Total Impulse bars, overlaid Pressure P(t) and Thrust F(t) curves (dashed for experimental bench logs), and the full metrics table with % deltas relative to your reference curve.',
            'À droite apparaissent les barres d’Impulsion Totale, les courbes superposées P(t) et F(t) (pointillés pour le réel) et le tableau complet des écarts par rapport à la référence.',
            'A destra trovi le barre di Impulso Totale, i grafici sovrapposti P(t) ed F(t) (tratteggiati per le prove reali) e la tabella metriche con variazioni % rispetto al riferimento.'
          ),
        },
      ],
    },

    // 13. TOUR GENERAL ACTUALIZADO (Arquitectura Dual + Barra Lateral + Vistas Previas Honestas)
    tour_full: {
      id: 'tour_full',
      title: loc(
        'Guía: Tour General de HERMES (Arquitectura Completa)',
        'Guide: General HERMES Walkthrough (Full Architecture)',
        'Guide : Tour Général de HERMES (Architecture Complète)',
        'Guida: Tour Generale di HERMES (Architettura Completa)'
      ),
      description: loc(
        'Recorrido fiel por toda la interfaz actual: modo Simulate, modo Post-Process, barra lateral de Ajustes, .hrms y módulos en vista previa.',
        'Accurate end-to-end tour of the current interface: Simulate mode, Post-Process mode, Settings sidebar, .hrms packages, and preview modules.',
        'Visite fidèle de toute l’interface actuelle : mode Simulate, mode Post-Process, barre Réglages, .hrms et aperçus.',
        'Panoramica fedele dell’intera interfaccia attuale: modalità Simulate, Post-Process, barra Impostazioni, .hrms e anteprime.'
      ),
      steps: [
        {
          id: 'full_workspace_mode',
          targetSelector: '[data-tour="workspace-mode-switcher"]',
          title: loc(
            '1. Selector de Entorno: Simulate vs Post-Process',
            '1. Workspace Switcher: Simulate vs Post-Process',
            '1. Sélecteur d’Espace : Simulate vs Post-Process',
            '1. Selettore Ambiente: Simulate vs Post-Process'
          ),
          category: loc('Arquitectura', 'Architecture', 'Architecture', 'Architettura'),
          tab: 'inputs',
          description: loc(
            'Tras pulsar START en la pantalla de bienvenida accedes a un entorno unificado con dos modos arriba a la izquierda: "Simulate" para diseñar, simular y optimizar motores; y "Post-Process" para comparar ensayos/simulaciones en Estudio.',
            'After pressing START on the welcome screen, the top-left switcher moves seamlessly between "Simulate" (motor design, solving & optimization) and "Post-Process" (comparative Study & upcoming characterization).',
            'Après avoir cliqué sur START, le sélecteur en haut à gauche bascule entre "Simulate" (conception et simulation) et "Post-Process" (Étude comparative).',
            'Dopo aver premuto START nella schermata iniziale, il selettore in alto a sinistra alterna tra "Simulate" (progettazione e calcolo) e "Post-Process" (Studio comparativo).'
          ),
        },
        {
          id: 'full_inputs',
          targetSelector: '[data-tour="tab-trigger-inputs"]',
          title: loc(
            '2. Simulate · Pestaña Inputs (Diseño y Validación)',
            '2. Simulate · Inputs Tab (Design & Validation)',
            '2. Simulate · Onglet Entrées (Conception & Validation)',
            '2. Simulate · Pannello Dati (Progetto e Validazione)'
          ),
          category: loc('Simulate · 1', 'Simulate · 1', 'Simulate · 1', 'Simulate · 1'),
          tab: 'inputs',
          description: loc(
            'Configura cámara, estructura/material/tornillos (Padm), tobera Laval con escoria/erosión y una pila de granos con 10 geometrías (9 paramétricas + Personalizada dibujada) y química propia. Cuando no haya errores bloqueantes, pulsa SIMULAR arriba a la derecha.',
            'Configure chamber, structure/alloy/bolts (Padm), De Laval nozzle with slag/erosion, and a multi-grain stack across 10 shapes (9 parametric + Custom Drawn) and custom fuels. With no blocking errors, hit SIMULATE at top right.',
            'Configurez chambre, structure/vis (Padm), tuyère avec érosion/scories et empilement de grains (10 formes dont Personnalisée dessinée). Sans erreur bloquante, cliquez sur SIMULER.',
            'Configura camera, struttura/viti (Padm), ugello con erosione/scorie e grani (10 forme inclusa Personalizzata disegnata). Senza errori bloccanti, premi SIMULA.'
          ),
          autofillLabel: loc('Simular Motor Actual', 'Simulate Active Motor', 'Simuler Moteur Actuel', 'Simula Motore Attuale'),
          onAutofill: () => {
            if (callbacks) callbacks.runSim();
          },
        },
        {
          id: 'full_results',
          targetSelector: '[data-tour="tab-trigger-results"]',
          requiresResults: true,
          title: loc(
            '3. Simulate · Pestaña Results (Métricas, P(t), F(t) y Export)',
            '3. Simulate · Results Tab (Metrics, P(t), F(t) & Export)',
            '3. Simulate · Onglet Résultats (Métriques, Courbes & Export)',
            '3. Simulate · Pannello Risultati (Metriche, Curve ed Export)'
          ),
          category: loc('Simulate · 2', 'Simulate · 2', 'Simulate · 2', 'Simulate · 2'),
          tab: 'results',
          description: loc(
            'Muestra el semáforo de seguridad Padm, las 10 tarjetas de rendimiento balístico, la curva de presión P(t), la comparativa de empuje Nakka vs TTI y la exportación en CSV, Excel (Columnas/Filas) y PDF.',
            'Displays Padm safety status, 10 ballistic summary cards, chamber pressure P(t), Nakka vs Ideal TTI thrust F(t), and export to CSV, Excel (Columns/Rows), and PDF.',
            'Affiche l’état Padm, 10 cartes métriques, P(t), F(t) Nakka vs TTI et l’export CSV, Excel et PDF.',
            'Mostra stato Padm, 10 schede metriche, P(t), spinta Nakka vs TTI ed esportazione CSV, Excel e PDF.'
          ),
        },
        {
          id: 'full_analysis',
          targetSelector: '[data-tour="tab-trigger-analysis"]',
          requiresResults: true,
          title: loc(
            '4. Simulate · Pestaña Análisis Detallado (4 Subvistas)',
            '4. Simulate · Detailed Analysis Tab (4 Sub-views)',
            '4. Simulate · Onglet Analyse Détaillée (4 Sous-vues)',
            '4. Simulate · Pannello Analisi Dettagliata (4 Sotto-viste)'
          ),
          category: loc('Simulate · 3', 'Simulate · 3', 'Simulate · 3', 'Simulate · 3'),
          tab: 'analysis',
          description: loc(
            'Desglosa internamente la combustión en 4 subpestañas: Áreas Ab(t) por cara y grano, Klemmung Kn(t), velocidad de quemado r(P) y flujo másico con comprobación de combustión erosiva.',
            'Breaks down internal combustion into 4 sub-tabs: Burning Areas Ab(t) per face/grain, Klemmung Kn(t), regression rate r(P), and mass flow with erosive flux checks.',
            'Détaille la combustion en 4 sous-onglets : Aires Ab(t), Ratio Kn(t), Vitesse r(P) et Débit massique / érosion.',
            'Analizza la combustione interna in 4 sotto-pannelli: Aree Ab(t), Rapporto Kn(t), Velocità r(P) e Portata massica / erosione.'
          ),
        },
        {
          id: 'full_mission_control',
          targetSelector: '[data-tour="tab-trigger-mission-control"]',
          title: loc(
            '5. Simulate · Pestaña Mission Control (Vuelo 1D y Recuperación)',
            '5. Simulate · Mission Control Tab (1D Flight & Recovery)',
            '5. Simulate · Onglet Mission Control (Vol 1D & Récupération)',
            '5. Simulate · Pannello Mission Control (Volo 1D e Recupero)'
          ),
          category: loc('Simulate · 4', 'Simulate · 4', 'Simulate · 4', 'Simulate · 4'),
          tab: 'mission_control',
          description: loc(
            'Integra la trayectoria 1D con atmósfera, rampa, viento, inclinación, paracaídas (simple o doble), polar Mach vs Cd personalizada e importación/tara de ensayos estáticos para comparar apogeos.',
            'Integrates 1D trajectory with launch atmosphere, rail, wind, tilt, single/dual parachutes, custom Mach vs Cd drag, and static test-stand import/tare for flight comparison.',
            'Intègre la trajectoire 1D avec rampe, vent, inclinaison, parachutes, traînée Mach vs Cd personnalisée et essais réels.',
            'Integra la traiettoria 1D con rampa, vento, inclinazione, paracadute, curva Mach vs Cd e log sperimentali tarati.'
          ),
        },
        {
          id: 'full_smart_search',
          targetSelector: '[data-tour="smart-search-tab-trigger"]',
          title: loc(
            '6. Simulate · Pestaña Smart Search (Optimización Inversa)',
            '6. Simulate · Smart Search Tab (Inverse Optimization)',
            '6. Simulate · Onglet Smart Search (Optimisation Inverse)',
            '6. Simulate · Pannello Smart Search (Ottimizzazione Inversa)'
          ),
          category: loc('Simulate · 5', 'Simulate · 5', 'Simulate · 5', 'Simulate · 5'),
          tab: 'smart_search',
          description: loc(
            'Motor evolutivo en 3 fases (Differential Evolution + LHS + reglas de Deb) que busca automáticamente la mejor geometría de grano dentro de tus límites de cámara y Pmáx.',
            '3-phase evolutionary solver (Differential Evolution + LHS + Deb feasibility rules) that automatically finds optimal grain geometries inside your casing and Pmax limits.',
            'Solveur évolutif en 3 phases trouvant automatiquement la géométrie optimale dans vos limites de carter et Pmax.',
            'Risolutore evolutivo in 3 fasi che trova automaticamente la geometria ottimale entro i limiti di carcassa e Pmax.'
          ),
        },
        {
          id: 'full_cfd',
          targetSelector: '[data-tour="tab-trigger-cfd"]',
          requiresResults: true,
          title: loc(
            '7. Simulate · Pestaña Animaciones (CFD Tobera + Vuelo 3D)',
            '7. Simulate · Animations Tab (Nozzle CFD + 3D Flight)',
            '7. Simulate · Onglet Animations (CFD Tuyère + Vol 3D)',
            '7. Simulate · Pannello Animazioni (CFD Ugello + Volo 3D)'
          ),
          category: loc('Simulate · 6', 'Simulate · 6', 'Simulate · 6', 'Simulate · 6'),
          tab: 'cfd',
          description: loc(
            'Reproduce visualmente el flujo supersónico en la tobera Laval sincronizado con la regresión del grano junto al visor 3D del vuelo vertical.',
            'Visually plays back supersonic De Laval nozzle contours synced with grain burnback alongside the 3D vertical flight viewer.',
            'Reproduit visuellement l’écoulement supersonique dans la tuyère ainsi que la trajectoire 3D du vol.',
            'Riproduce visivamente il flusso supersonico nell’ugello sincronizzato con il grano insieme alla vista 3D del volo.'
          ),
        },
        {
          id: 'full_study_postprocess',
          targetSelector: '[data-tour="tab-trigger-study"]',
          title: loc(
            '8. Post-Process · Pestaña Estudio (Comparación Multi-Curva)',
            '8. Post-Process · Study Tab (Multi-Curve Comparison)',
            '8. Post-Process · Onglet Étude (Comparaison Multi-Courbes)',
            '8. Post-Process · Pannello Studio (Confronto Multi-Curva)'
          ),
          category: loc('Post-Process · 1', 'Post-Process · 1', 'Post-Process · 1', 'Post-Process · 1'),
          tab: 'study',
          description: loc(
            'Superpone simulaciones activas, motores de Biblioteca, archivos .hrms y ensayos reales de banco con desfase Δt, auto-cero t₀, puesta a cero manual (Tarar Y), deltas porcentuales e informe PDF.',
            'Overlays active simulations, Library motors, .hrms bundles, and static test logs with Δt shifting, t₀ auto-zero, manual Y tare, percentage deltas, and PDF export.',
            'Superpose simulations, bibliothèque, paquets .hrms et essais avec décalage Δt, t₀, tare manuelle Y, deltas % et PDF.',
            'Sovrappone simulazioni, libreria, pacchetti .hrms e prove di banco con offset Δt, t₀, tara manuale Y, delta % e report PDF.'
          ),
        },
        {
          id: 'full_propellant_char',
          targetSelector: '[data-tour="tab-trigger-propellant-char"]',
          title: loc(
            '9. Post-Process · Caracterización a y n (Vista Previa)',
            '9. Post-Process · a & n Characterization (Preview)',
            '9. Post-Process · Caractérisation a & n (Aperçu)',
            '9. Post-Process · Caratterizzazione a e n (Anteprima)'
          ),
          category: loc('Post-Process · 2', 'Post-Process · 2', 'Post-Process · 2', 'Post-Process · 2'),
          tab: 'propellant_char',
          description: loc(
            'Módulo en vista previa aún no activado: cuando se desarrolle permitirá ajustar experimentalmente los parámetros a y n de la ley r = a·Pⁿ a partir de ensayos reales. Por ahora muestra la ficha informativa de su arquitectura.',
            'Upcoming module currently in preview: once developed, it will fit experimental burn-rate coefficients a and n (r = a·Pⁿ) from static firing logs. Currently displays its planned architecture overview.',
            'Module en aperçu non encore activé : il permettra d’ajuster expérimentalement a et n à partir des tirs réels. Affiche actuellement sa fiche d’architecture.',
            'Modulo in anteprima non ancora attivo: in futuro consentirà di ricavare sperimentalmente a ed n da prove reali. Al momento mostra la scheda informativa.'
          ),
        },
        {
          id: 'full_header_and_sidebar',
          targetSelector: '[data-tour="settings-menu-btn"]',
          title: loc(
            '10. Cabecera (.hrms, Guardar) y Barra Lateral de Ajustes',
            '10. Header (.hrms, Save) & Settings Sidebar',
            '10. En-tête (.hrms, Sauvegarde) & Barre de Réglages',
            '10. Intestazione (.hrms, Salva) e Barra Impostazioni'
          ),
          category: loc('Navegación Global', 'Global Controls', 'Navigation Globale', 'Navigazione Globale'),
          tab: 'inputs',
          description: loc(
            'Arriba permanecen solo los accesos rápidos "Guardar", ".hrms" y "Ajustes". Dentro de Ajustes encontrarás: Biblioteca, Agente Jesús (vista previa del asistente IA global aún en preparación), Libro de Guías, volver a Inicio, Temas/Colores, Idioma, Puntero, Versiones, Estadísticas y Feedback.',
            'The top bar stays uncluttered with only "Save", ".hrms", and "Settings". Inside Settings you access Library, Agent Jesús (upcoming global AI assistant preview), Guide Book, Start screen, Themes/Colors, Language, Pointer, Version History, Analytics, and Feedback.',
            'En haut restent uniquement "Enregistrer", ".hrms" et "Réglages". Dans Réglages se trouvent Bibliothèque, Agent Jesús (aperçu à venir), Guides, Accueil, Thèmes, Langue, Pointeur, Versions et Retours.',
            'In alto restano solo "Salva", ".hrms" e "Impostazioni". Dentro Impostazioni trovi Libreria, Agente Jesús (anteprima assistente IA futuro), Guide, Inizio, Temi, Lingua, Puntatore, Versioni e Feedback.'
          ),
        },
      ],
    },
  };
}
