import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Circle,
  Copy,
  Edit3,
  Eraser,
  FlipHorizontal,
  Grid,
  Magnet,
  PenTool,
  Plus,
  Redo2,
  Shapes,
  Sparkles,
  Spline,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CustomGrainLoopKind,
  CustomGrainPointNorm,
  CustomGrainShape,
} from '../lib/types';
import {
  buildSequentialVoidLoopsMm,
  contoursToSvgPath,
  solveClipperCrossSectionAtDepth,
} from '../lib/grains';
import {
  SketchStroke,
  buildCirclePointsNorm,
  buildNormalizedLoopsFromStrokes,
  createStarterTemplateStrokes,
  inspectNormalizedLoops,
  smoothAndSimplifyClosedStroke,
  snapPointToPolarGrid,
} from '../lib/grains/sketchUtils';

interface CustomGrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  customGrainShapes: CustomGrainShape[];
  onSaveCustomGrains: (list: CustomGrainShape[]) => void;
  onSelectCustomGrainForGrain?: (shape: CustomGrainShape) => void;
  referenceDiameterMm?: number;
  initialSelectedId?: string | null;
  startNew?: boolean;
}

const STAGE_RADIUS_PX = 112;
const STAGE_HALF_VIEW = 144;
const SYMMETRY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

function shapeToInitialStrokes(shape: CustomGrainShape): SketchStroke[] {
  if (!shape.loops || shape.loops.length === 0) return [];
  const ts = Date.now();
  return shape.loops.map((loop, idx) => ({
    id: `loaded-${idx}-${ts}`,
    kind: loop.kind === 'solid' ? 'solid' : 'void',
    tool: 'polyline',
    basePoints: loop.points.map((p) => ({ x: p.x, y: p.y })),
    // Loaded loops are already unified across symmetry; keep sym=1 so re-editing preserves exact geometry.
    symmetryCount: 1,
    mirrorSector: false,
  }));
}

function getPreviewTransforms(symmetryCount: number, mirrorSector: boolean): Array<{ angleDeg: number; mirror: boolean }> {
  const sym = Math.max(1, Math.min(24, symmetryCount));
  const out: Array<{ angleDeg: number; mirror: boolean }> = [];
  for (let k = 0; k < sym; k++) {
    const angleDeg = (360 * k) / sym;
    out.push({ angleDeg, mirror: false });
    if (mirrorSector) {
      out.push({ angleDeg, mirror: true });
    }
  }
  return out;
}

function pointsToSvgPolyline(pts: CustomGrainPointNorm[], radiusPx: number): string {
  return pts.map((p) => `${(p.x * radiusPx).toFixed(2)},${(p.y * radiusPx).toFixed(2)}`).join(' ');
}

function buildSectorWedgePath(radiusPx: number, symmetryCount: number, mirrorSector: boolean): string {
  if (symmetryCount <= 1) return '';
  const stepRad = (2 * Math.PI) / symmetryCount;
  const sectorRad = mirrorSector ? stepRad * 0.5 : stepRad;
  const x1 = radiusPx;
  const y1 = 0;
  const x2 = radiusPx * Math.cos(sectorRad);
  const y2 = radiusPx * Math.sin(sectorRad);
  const largeArc = sectorRad > Math.PI ? 1 : 0;
  return `M 0,0 L ${x1.toFixed(2)},${y1.toFixed(2)} A ${radiusPx},${radiusPx} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

const ShapeThumbnail: React.FC<{ shape: CustomGrainShape; size?: number }> = ({ shape, size = 38 }) => {
  const pathD = useMemo(() => {
    const outerR = 13.5;
    if (!shape.loops || shape.loops.length === 0) return '';
    const ops = shape.loops
      .filter((l) => l.points && l.points.length >= 3)
      .map((l) => ({
        loop: l.points.map((p) => ({ x: p.x * outerR, y: p.y * outerR })),
        kind: (l.kind === 'solid' ? 'solid' : 'void') as 'void' | 'solid',
      }));
    const voidLoops = buildSequentialVoidLoopsMm(ops, outerR);
    const contours = solveClipperCrossSectionAtDepth(
      {
        outerRadiusMm: outerR,
        ci: 1,
        osi: 0,
        innerVoidLoopsMm: voidLoops,
        preserveVoidOrientation: true,
        circleSegments: 48,
      },
      0
    );
    return contoursToSvgPath(contours, 0, 0, 1);
  }, [shape]);

  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" className="shrink-0 select-none">
      <circle
        cx="0"
        cy="0"
        r="13.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="0.9"
        className="text-muted-foreground/60"
      />
      {pathD ? (
        <path
          d={pathD}
          fill="currentColor"
          fillOpacity="0.78"
          fillRule="evenodd"
          stroke="currentColor"
          strokeWidth="0.95"
          strokeLinejoin="round"
          className="text-primary"
        />
      ) : (
        <circle
          cx="0"
          cy="0"
          r="13.5"
          fill="currentColor"
          fillOpacity="0.72"
          className="text-primary"
        />
      )}
    </svg>
  );
};

export const CustomGrainModal: React.FC<CustomGrainModalProps> = ({
  isOpen,
  onClose,
  lang = 'es',
  customGrainShapes,
  onSaveCustomGrains,
  onSelectCustomGrainForGrain,
  referenceDiameterMm = 56,
  initialSelectedId = null,
  startNew = false,
}) => {
  const txt = useMemo(() => {
    if (lang === 'en') {
      return {
        title: 'Custom Grain Cross-Section Studio',
        catalogTitle: 'Saved Shapes',
        newShapeBtn: 'New Shape',
        noSaved: 'No custom shapes saved yet. Draw one or start from a template.',
        useInGrain: 'Use',
        edit: 'Edit',
        duplicate: 'Duplicate',
        delete: 'Delete',
        confirmDelete: 'Confirm',
        nameLabel: 'Shape Name',
        namePlaceholder: 'e.g. Tri-Lobed Asymmetric 5x',
        descLabel: 'Notes (optional)',
        descPlaceholder: 'Neutral regression test...',
        templatesLabel: 'Starter Templates',
        tplStar: '5-Star',
        tplFinocyl: '6-Finocyl',
        tplPeanut: 'Dual Port',
        tplRing: 'Ring + Rod',
        clearBtn: 'Clear',
        modeVoid: 'Cut Void',
        modeSolid: 'Add Island',
        toolFreehand: 'Freehand',
        toolPolyline: 'Polyline',
        toolCircle: 'Circle',
        symmetryLabel: 'Symmetry',
        symFree: '1× Free',
        mirrorBtn: 'Mirror',
        gridBtn: 'Polar Grid',
        snapBtn: 'Snap',
        smoothLabel: 'Smooth',
        smoothLow: 'Light',
        smoothMed: 'Med',
        smoothHigh: 'Firm',
        undo: 'Undo',
        redo: 'Redo',
        closePolylineBtn: 'Close Polygon',
        cancelDraftBtn: 'Cancel Stroke',
        strokesTitle: 'Applied Strokes',
        noStrokes: 'No strokes yet. Draw inside the grain circle.',
        strokeVoid: 'Void',
        strokeSolid: 'Island',
        metricsTitle: 'Cross-Section Inspection',
        fillLabel: 'Propellant Fill',
        propAreaLabel: 'Propellant Area',
        portAreaLabel: 'Port Area',
        webEstLabel: 'Est. Web',
        piecesLabel: 'Pieces',
        errEmpty: 'Draw at least one void cutout or load a starter template.',
        errNoPropellant: 'Drawing removes nearly 100% of propellant area.',
        warnSplit: 'Notice: cross-section has {n} separate solid pieces or an internal island.',
        errNameRequired: 'Enter a shape name before saving.',
        hintFreehand: 'Drag to sketch a closed cutout or island (smoothed automatically on release).',
        hintPolyline: 'Click vertices; click the start marker or press Enter to close (Esc cancels).',
        hintCircle: 'Drag from circle center outward to set the radius.',
        cancel: 'Cancel',
        saveLib: 'Save to Library',
        saveAndUse: 'Save & Use in Grain',
        copySuffix: ' (Copy)',
        defaultNewName: 'Custom Grain',
      };
    }
    if (lang === 'fr') {
      return {
        title: 'Studio de Sections de Grain Personnalisées',
        catalogTitle: 'Formes Enregistrées',
        newShapeBtn: 'Nouvelle Forme',
        noSaved: 'Aucune forme personnalisée. Dessinez ou utilisez un modèle.',
        useInGrain: 'Utiliser',
        edit: 'Modifier',
        duplicate: 'Dupliquer',
        delete: 'Supprimer',
        confirmDelete: 'Confirmer',
        nameLabel: 'Nom de la forme',
        namePlaceholder: 'ex. Étoile asymétrique 5×',
        descLabel: 'Notes (optionnel)',
        descPlaceholder: 'Profil neutre...',
        templatesLabel: 'Modèles rapides',
        tplStar: 'Étoile 5×',
        tplFinocyl: 'Finocyl 6×',
        tplPeanut: 'Double Canal',
        tplRing: 'Anneau + Tige',
        clearBtn: 'Effacer',
        modeVoid: 'Creuser Vide',
        modeSolid: 'Ajouter Îlot',
        toolFreehand: 'Main Levée',
        toolPolyline: 'Polyligne',
        toolCircle: 'Cercle',
        symmetryLabel: 'Symétrie',
        symFree: '1× Libre',
        mirrorBtn: 'Miroir',
        gridBtn: 'Grille Polaire',
        snapBtn: 'Aimant',
        smoothLabel: 'Lissage',
        smoothLow: 'Léger',
        smoothMed: 'Moyen',
        smoothHigh: 'Fort',
        undo: 'Annuler',
        redo: 'Rétablir',
        closePolylineBtn: 'Fermer Polygone',
        cancelDraftBtn: 'Annuler Tracé',
        strokesTitle: 'Tracés appliqués',
        noStrokes: 'Aucun tracé. Dessinez dans le disque de propergol.',
        strokeVoid: 'Vide',
        strokeSolid: 'Îlot',
        metricsTitle: 'Inspection de la Section',
        fillLabel: 'Remplissage',
        propAreaLabel: 'Aire Propergol',
        portAreaLabel: 'Aire Canal',
        webEstLabel: 'Âme Est.',
        piecesLabel: 'Pièces',
        errEmpty: 'Dessinez au moins une cavité ou chargez un modèle.',
        errNoPropellant: 'Le dessin supprime presque 100 % du propergol.',
        warnSplit: 'Avis : la section comporte {n} pièces séparées ou un îlot interne.',
        errNameRequired: 'Indiquez un nom avant d’enregistrer.',
        hintFreehand: 'Glissez pour tracer une boucle fermée (lissée au relâchement).',
        hintPolyline: 'Cliquez les sommets ; cliquez sur le départ ou Entrée pour fermer.',
        hintCircle: 'Glissez depuis le centre pour définir le rayon.',
        cancel: 'Fermer',
        saveLib: 'Enregistrer',
        saveAndUse: 'Enregistrer & Utiliser',
        copySuffix: ' (Copie)',
        defaultNewName: 'Grain Perso',
      };
    }
    if (lang === 'it') {
      return {
        title: 'Studio Sezioni di Grano Personalizzate',
        catalogTitle: 'Forme Salvate',
        newShapeBtn: 'Nuova Forma',
        noSaved: 'Nessuna forma salvata. Disegna o carica un modello.',
        useInGrain: 'Usa',
        edit: 'Modifica',
        duplicate: 'Duplica',
        delete: 'Elimina',
        confirmDelete: 'Conferma',
        nameLabel: 'Nome Forma',
        namePlaceholder: 'es. Stella asimmetrica 5×',
        descLabel: 'Note (opzionale)',
        descPlaceholder: 'Profilo neutro...',
        templatesLabel: 'Modelli rapidi',
        tplStar: 'Stella 5×',
        tplFinocyl: 'Finocyl 6×',
        tplPeanut: 'Doppio Foro',
        tplRing: 'Anello + Barra',
        clearBtn: 'Pulisci',
        modeVoid: 'Scava Vuoto',
        modeSolid: 'Aggiungi Isola',
        toolFreehand: 'Mano Libera',
        toolPolyline: 'Polilinea',
        toolCircle: 'Cerchio',
        symmetryLabel: 'Simmetria',
        symFree: '1× Libero',
        mirrorBtn: 'Specchio',
        gridBtn: 'Griglia Polare',
        snapBtn: 'Aggancio',
        smoothLabel: 'Smuss.',
        smoothLow: 'Leggero',
        smoothMed: 'Medio',
        smoothHigh: 'Forte',
        undo: 'Annulla',
        redo: 'Ripeti',
        closePolylineBtn: 'Chiudi Poligono',
        cancelDraftBtn: 'Annulla Tratto',
        strokesTitle: 'Tratti applicati',
        noStrokes: 'Nessun tratto. Disegna nel disco del propellente.',
        strokeVoid: 'Vuoto',
        strokeSolid: 'Isola',
        metricsTitle: 'Ispezione Sezione',
        fillLabel: 'Riempimento',
        propAreaLabel: 'Area Prop.',
        portAreaLabel: 'Area Foro',
        webEstLabel: 'Web Stim.',
        piecesLabel: 'Pezzi',
        errEmpty: 'Disegna almeno un intaglio vuoto o carica un modello.',
        errNoPropellant: 'Il disegno rimuove quasi il 100% del propellente.',
        warnSplit: 'Avviso: la sezione presenta {n} pezzi separati o un’isola interna.',
        errNameRequired: 'Inserisci un nome prima di salvare.',
        hintFreehand: 'Trascina per disegnare un contorno chiuso (smussato al rilascio).',
        hintPolyline: 'Clicca i vertici; clicca l’inizio o Invio per chiudere.',
        hintCircle: 'Trascina dal centro verso l’esterno per il raggio.',
        cancel: 'Chiudi',
        saveLib: 'Salva in Libreria',
        saveAndUse: 'Salva e Usa nel Grano',
        copySuffix: ' (Copia)',
        defaultNewName: 'Grano Pers.',
      };
    }
    return {
      title: 'Estudio de Formas de Grano Personalizadas',
      catalogTitle: 'Formas Guardadas',
      newShapeBtn: 'Nueva Forma',
      noSaved: 'Aún no tienes formas guardadas. Dibuja una o parte de una plantilla.',
      useInGrain: 'Usar',
      edit: 'Editar',
      duplicate: 'Duplicar',
      delete: 'Eliminar',
      confirmDelete: 'Confirmar',
      nameLabel: 'Nombre de la Forma',
      namePlaceholder: 'ej. Estrella Asimétrica 5×',
      descLabel: 'Notas (opcional)',
      descPlaceholder: 'Perfil neutro de prueba...',
      templatesLabel: 'Plantillas Base',
      tplStar: 'Estrella 5×',
      tplFinocyl: 'Finocyl 6×',
      tplPeanut: 'Doble Puerto',
      tplRing: 'Anillo + Varilla',
      clearBtn: 'Limpiar',
      modeVoid: 'Recortar Hueco',
      modeSolid: 'Añadir Isla',
      toolFreehand: 'Mano Alzada',
      toolPolyline: 'Polilínea',
      toolCircle: 'Círculo',
      symmetryLabel: 'Simetría',
      symFree: '1× Libre',
      mirrorBtn: 'Espejo',
      gridBtn: 'Rejilla Polar',
      snapBtn: 'Imán',
      smoothLabel: 'Suavizado',
      smoothLow: 'Suave',
      smoothMed: 'Medio',
      smoothHigh: 'Firme',
      undo: 'Deshacer',
      redo: 'Rehacer',
      closePolylineBtn: 'Cerrar Polígono',
      cancelDraftBtn: 'Cancelar Trazo',
      strokesTitle: 'Trazos Aplicados',
      noStrokes: 'Sin trazos aún. Dibuja dentro del círculo del grano.',
      strokeVoid: 'Hueco',
      strokeSolid: 'Isla',
      metricsTitle: 'Inspección Transversal',
      fillLabel: 'Relleno Propelente',
      propAreaLabel: 'Área Propelente',
      portAreaLabel: 'Área Puerto',
      webEstLabel: 'tweb est.',
      piecesLabel: 'Piezas',
      errEmpty: 'Dibuja al menos un recorte hueco o usa una plantilla base.',
      errNoPropellant: 'El dibujo elimina casi el 100% del propelente.',
      warnSplit: 'Aviso: el corte deja {n} piezas sólidas independientes o contiene una isla interna.',
      errNameRequired: 'Introduce un nombre antes de guardar.',
      hintFreehand: 'Arrastra para dibujar un contorno cerrado (se suaviza al soltar).',
      hintPolyline: 'Haz clic para fijar vértices; pulsa el punto inicial o Enter para cerrar.',
      hintCircle: 'Arrastra desde el centro hacia fuera para fijar el radio.',
      cancel: 'Cerrar',
      saveLib: 'Guardar en Biblioteca',
      saveAndUse: 'Guardar y Usar en Grano',
      copySuffix: ' (Copia)',
      defaultNewName: 'Grano Pers.',
    };
  }, [lang]);

  const refD0 = Math.max(10, Number(referenceDiameterMm) || 56);
  const refOuterR = refD0 * 0.5;

  // Editor session state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shapeName, setShapeName] = useState('');
  const [shapeDesc, setShapeDesc] = useState('');
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [redoStack, setRedoStack] = useState<SketchStroke[][]>([]);
  const [undoStack, setUndoStack] = useState<SketchStroke[][]>([]);

  // Drawing controls
  const [kind, setKind] = useState<CustomGrainLoopKind>('void');
  const [tool, setTool] = useState<'freehand' | 'polyline' | 'circle'>('freehand');
  const [symmetryCount, setSymmetryCount] = useState<number>(5);
  const [mirrorSector, setMirrorSector] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [smoothLevel, setSmoothLevel] = useState<'low' | 'medium' | 'high'>('medium');

  // Interactive draft state
  const [draftPoints, setDraftPoints] = useState<CustomGrainPointNorm[]>([]);
  const [circleDraft, setCircleDraft] = useState<{ cx: number; cy: number; r: number } | null>(null);
  const [cursorPt, setCursorPt] = useState<CustomGrainPointNorm | null>(null);
  const [isDrawingPointer, setIsDrawingPointer] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const uid = useId().replace(/:/g, '');
  const hatchId = `cg-editor-hatch-${uid}`;

  const loadShapeIntoEditor = useCallback((shape: CustomGrainShape | null) => {
    setSaveError(null);
    setDraftPoints([]);
    setCircleDraft(null);
    setIsDrawingPointer(false);
    setUndoStack([]);
    setRedoStack([]);
    if (!shape) {
      setEditingId(null);
      setShapeName(`${txt.defaultNewName} ${customGrainShapes.length + 1}`);
      setShapeDesc('');
      setStrokes([]);
      setSymmetryCount(5);
      setMirrorSector(true);
      return;
    }
    setEditingId(shape.id);
    setShapeName(shape.name);
    setShapeDesc(shape.description || '');
    setStrokes(shapeToInitialStrokes(shape));
    setSymmetryCount(Math.max(1, shape.symmetryCount || 1));
    setMirrorSector(Boolean(shape.mirrorSector));
  }, [customGrainShapes.length, txt.defaultNewName]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDeleteId(null);
    setSaveError(null);
    if (startNew) {
      loadShapeIntoEditor(null);
      return;
    }
    const target =
      (initialSelectedId && customGrainShapes.find((s) => s.id === initialSelectedId)) ||
      (customGrainShapes.length > 0 ? customGrainShapes[0] : null);
    loadShapeIntoEditor(target);
  }, [isOpen, initialSelectedId, startNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitStrokesChange = useCallback(
    (updater: (prev: SketchStroke[]) => SketchStroke[]) => {
      setStrokes((prev) => {
        const next = updater(prev);
        setUndoStack((u) => [...u.slice(-24), prev]);
        setRedoStack([]);
        return next;
      });
      setSaveError(null);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (draftPoints.length > 0 && tool === 'polyline') {
      setDraftPoints((prev) => prev.slice(0, -1));
      return;
    }
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1];
      setStrokes((curr) => {
        setRedoStack((r) => [...r, curr]);
        return previous;
      });
      return u.slice(0, -1);
    });
  }, [draftPoints.length, tool]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setStrokes((curr) => {
        setUndoStack((u) => [...u, curr]);
        return next;
      });
      return r.slice(0, -1);
    });
  }, []);

  const normalizedLoops = useMemo(() => buildNormalizedLoopsFromStrokes(strokes), [strokes]);
  const inspection = useMemo(
    () => inspectNormalizedLoops(normalizedLoops, refD0),
    [normalizedLoops, refD0]
  );

  const propellantPathD = useMemo(() => {
    if (inspection.previewContoursMm.length === 0) return '';
    return contoursToSvgPath(inspection.previewContoursMm, 0, 0, STAGE_RADIUS_PX / refOuterR);
  }, [inspection.previewContoursMm, refOuterR]);

  const sectorWedgeD = useMemo(
    () => buildSectorWedgePath(STAGE_RADIUS_PX, symmetryCount, mirrorSector),
    [symmetryCount, mirrorSector]
  );

  const previewTransforms = useMemo(
    () => getPreviewTransforms(symmetryCount, mirrorSector),
    [symmetryCount, mirrorSector]
  );

  const getPointerNorm = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, allowSnap: boolean): CustomGrainPointNorm => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = (STAGE_HALF_VIEW * 2) / Math.max(1, rect.width);
      const scaleY = (STAGE_HALF_VIEW * 2) / Math.max(1, rect.height);
      const svgX = (e.clientX - rect.left) * scaleX - STAGE_HALF_VIEW;
      const svgY = (e.clientY - rect.top) * scaleY - STAGE_HALF_VIEW;
      const rawPt: CustomGrainPointNorm = {
        x: Math.max(-1.24, Math.min(1.24, svgX / STAGE_RADIUS_PX)),
        y: Math.max(-1.24, Math.min(1.24, svgY / STAGE_RADIUS_PX)),
      };
      return allowSnap ? snapPointToPolarGrid(rawPt, 0.1, 15) : rawPt;
    },
    []
  );

  const closePolylineDraft = useCallback(() => {
    if (draftPoints.length < 3) {
      setDraftPoints([]);
      return;
    }
    const newStroke: SketchStroke = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      tool: 'polyline',
      basePoints: draftPoints.slice(),
      symmetryCount,
      mirrorSector,
    };
    commitStrokesChange((prev) => [...prev, newStroke]);
    setDraftPoints([]);
  }, [commitStrokesChange, draftPoints, kind, mirrorSector, symmetryCount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draftPoints.length > 0 || circleDraft) {
          setDraftPoints([]);
          setCircleDraft(null);
          setIsDrawingPointer(false);
        }
      } else if (e.key === 'Enter' && tool === 'polyline' && draftPoints.length >= 3) {
        e.preventDefault();
        closePolylineDraft();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [circleDraft, closePolylineDraft, draftPoints.length, handleRedo, handleUndo, isOpen, tool]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = getPointerNorm(e, snapToGrid && tool !== 'freehand');
    setCursorPt(pt);

    if (tool === 'polyline') {
      if (draftPoints.length >= 3) {
        const start = draftPoints[0];
        if (Math.hypot(pt.x - start.x, pt.y - start.y) <= 0.075) {
          closePolylineDraft();
          return;
        }
      }
      setDraftPoints((prev) => [...prev, pt]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawingPointer(true);

    if (tool === 'circle') {
      setCircleDraft({ cx: pt.x, cy: pt.y, r: 0.05 });
    } else {
      setDraftPoints([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getPointerNorm(e, snapToGrid && tool !== 'freehand');
    setCursorPt(pt);
    if (!isDrawingPointer) return;

    if (tool === 'freehand') {
      setDraftPoints((prev) => {
        if (prev.length === 0) return [pt];
        const last = prev[prev.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.012) return prev;
        return [...prev, pt];
      });
    } else if (tool === 'circle' && circleDraft) {
      const r = Math.max(0.03, Math.min(1.25, Math.hypot(pt.x - circleDraft.cx, pt.y - circleDraft.cy)));
      setCircleDraft({ ...circleDraft, r });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingPointer) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
    setIsDrawingPointer(false);

    if (tool === 'freehand') {
      if (draftPoints.length >= 3) {
        const smoothed = smoothAndSimplifyClosedStroke(draftPoints, smoothLevel);
        if (smoothed.length >= 3) {
          const newStroke: SketchStroke = {
            id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind,
            tool: 'freehand',
            basePoints: smoothed,
            symmetryCount,
            mirrorSector,
            smoothLevel,
          };
          commitStrokesChange((prev) => [...prev, newStroke]);
        }
      }
      setDraftPoints([]);
    } else if (tool === 'circle' && circleDraft) {
      if (circleDraft.r >= 0.035) {
        const newStroke: SketchStroke = {
          id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind,
          tool: 'circle',
          basePoints: buildCirclePointsNorm(circleDraft.cx, circleDraft.cy, circleDraft.r, 48),
          symmetryCount,
          mirrorSector,
        };
        commitStrokesChange((prev) => [...prev, newStroke]);
      }
      setCircleDraft(null);
    }
  };

  const applyTemplate = (preset: 'star5' | 'finocyl6' | 'peanut' | 'ring_island') => {
    setDraftPoints([]);
    setCircleDraft(null);
    const seed = createStarterTemplateStrokes(preset);
    if (preset === 'star5') {
      setSymmetryCount(5);
      setMirrorSector(true);
    } else if (preset === 'finocyl6') {
      setSymmetryCount(6);
      setMirrorSector(false);
    } else if (preset === 'peanut') {
      setSymmetryCount(2);
      setMirrorSector(false);
    } else {
      setSymmetryCount(1);
      setMirrorSector(false);
    }
    commitStrokesChange(() => seed);
  };

  const handleSave = (andUseInGrain: boolean) => {
    const cleanName = shapeName.trim();
    if (!cleanName) {
      setSaveError(txt.errNameRequired);
      return;
    }
    if (inspection.isEmpty) {
      setSaveError(txt.errEmpty);
      return;
    }
    if (inspection.hasNoPropellant) {
      setSaveError(txt.errNoPropellant);
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? customGrainShapes.find((s) => s.id === editingId) : undefined;
    const savedShape: CustomGrainShape = {
      id: existing ? existing.id : `cg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      ...(shapeDesc.trim() ? { description: shapeDesc.trim() } : {}),
      loops: normalizedLoops,
      symmetryCount,
      mirrorSector,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextList = existing
      ? customGrainShapes.map((s) => (s.id === existing.id ? savedShape : s))
      : [...customGrainShapes, savedShape];

    onSaveCustomGrains(nextList);
    setEditingId(savedShape.id);
    setSaveError(null);

    if (andUseInGrain && onSelectCustomGrainForGrain) {
      onSelectCustomGrainForGrain(savedShape);
      onClose();
    }
  };

  const handleDuplicate = (shape: CustomGrainShape) => {
    const nowIso = new Date().toISOString();
    const copy: CustomGrainShape = {
      ...shape,
      id: `cg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${shape.name}${txt.copySuffix}`,
      loops: shape.loops.map((l) => ({
        kind: l.kind,
        points: l.points.map((p) => ({ ...p })),
      })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const nextList = [...customGrainShapes, copy];
    onSaveCustomGrains(nextList);
    loadShapeIntoEditor(copy);
  };

  const handleDelete = (id: string) => {
    const nextList = customGrainShapes.filter((s) => s.id !== id);
    onSaveCustomGrains(nextList);
    setConfirmDeleteId(null);
    if (editingId === id) {
      loadShapeIntoEditor(nextList[0] || null);
    }
  };

  if (!isOpen) return null;

  const cursorR = cursorPt ? Math.hypot(cursorPt.x, cursorPt.y) : 0;
  const cursorDeg = cursorPt
    ? (((Math.atan2(-cursorPt.y, cursorPt.x) * 180) / Math.PI) + 360) % 360
    : 0;
  const activeHint =
    tool === 'freehand' ? txt.hintFreehand : tool === 'polyline' ? txt.hintPolyline : txt.hintCircle;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[110] flex items-center justify-center p-2 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card text-foreground w-full max-w-6xl h-[92vh] max-h-[840px] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
              <Shapes className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">{txt.title}</h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Main 2-column Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Catalog Sidebar */}
          <aside className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/20 flex flex-col max-h-48 lg:max-h-none">
            <div className="p-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                {txt.catalogTitle} ({customGrainShapes.length})
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => loadShapeIntoEditor(null)}
                className="h-7 px-2.5 text-xs gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{txt.newShapeBtn}</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {customGrainShapes.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center">
                  {txt.noSaved}
                </div>
              ) : (
                customGrainShapes.map((shape) => {
                  const isActive = editingId === shape.id;
                  const voidCount = shape.loops.filter((l) => l.kind !== 'solid').length;
                  const solidCount = shape.loops.filter((l) => l.kind === 'solid').length;

                  return (
                    <div
                      key={shape.id}
                      className={`p-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-primary/10 border-primary/60'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ShapeThumbnail shape={shape} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-foreground truncate">{shape.name}</div>
                          <div className="text-[10.5px] font-mono text-muted-foreground truncate">
                            {voidCount} {txt.strokeVoid.toLowerCase()}
                            {solidCount > 0 ? ` · ${solidCount} ${txt.strokeSolid.toLowerCase()}` : ''}
                            {shape.symmetryCount && shape.symmetryCount > 1 ? ` · ${shape.symmetryCount}×` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-border/50">
                        {onSelectCustomGrainForGrain && (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => {
                              onSelectCustomGrainForGrain(shape);
                              onClose();
                            }}
                            className="h-6 px-2 text-[11px] gap-1 mr-auto cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-3 h-3" />
                            <span>{txt.useInGrain}</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => loadShapeIntoEditor(shape)}
                          title={txt.edit}
                          className="h-6 w-6 p-0 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(shape)}
                          title={txt.duplicate}
                          className="h-6 w-6 p-0 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {confirmDeleteId === shape.id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(shape.id)}
                            className="h-6 px-2 text-[10.5px] cursor-pointer whitespace-nowrap"
                          >
                            {txt.confirmDelete}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(shape.id)}
                            title={txt.delete}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right CAD Sketch Editor */}
          <div className="flex-1 min-w-0 flex flex-col bg-background overflow-y-auto">
            {/* Metadata & Templates Row */}
            <div className="px-4 py-2.5 border-b border-border bg-card/40 flex flex-wrap items-end justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-end gap-2.5 flex-1 min-w-[240px]">
                <div className="flex-1 min-w-[160px] max-w-xs">
                  <label className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    {txt.nameLabel}
                  </label>
                  <Input
                    value={shapeName}
                    onChange={(e) => {
                      setShapeName(e.target.value);
                      setSaveError(null);
                    }}
                    placeholder={txt.namePlaceholder}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1 min-w-[150px] max-w-xs hidden sm:block">
                  <label className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    {txt.descLabel}
                  </label>
                  <Input
                    value={shapeDesc}
                    onChange={(e) => setShapeDesc(e.target.value)}
                    placeholder={txt.descPlaceholder}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1 hidden xl:inline">
                  {txt.templatesLabel}:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('star5')}
                  className="h-7 px-2 text-[11px] gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>{txt.tplStar}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('finocyl6')}
                  className="h-7 px-2 text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {txt.tplFinocyl}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('peanut')}
                  className="h-7 px-2 text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {txt.tplPeanut}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('ring_island')}
                  className="h-7 px-2 text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {txt.tplRing}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftPoints([]);
                    setCircleDraft(null);
                    commitStrokesChange(() => []);
                  }}
                  disabled={strokes.length === 0 && draftPoints.length === 0}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Eraser className="w-3 h-3" />
                  <span>{txt.clearBtn}</span>
                </Button>
              </div>
            </div>

            {/* Drawing Toolbar */}
            <div className="px-4 py-2 border-b border-border bg-muted/25 flex flex-wrap items-center gap-2 shrink-0">
              {/* Void vs Solid Mode */}
              <div className="inline-flex rounded-md border border-border bg-background p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setKind('void')}
                  className={`h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    kind === 'void'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {txt.modeVoid}
                </button>
                <button
                  type="button"
                  onClick={() => setKind('solid')}
                  className={`h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    kind === 'solid'
                      ? 'bg-amber-600 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {txt.modeSolid}
                </button>
              </div>

              {/* Tool Selector */}
              <div className="inline-flex rounded-md border border-border bg-background p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTool('freehand');
                    setDraftPoints([]);
                    setCircleDraft(null);
                  }}
                  className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    tool === 'freehand'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{txt.toolFreehand}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool('polyline');
                    setDraftPoints([]);
                    setCircleDraft(null);
                  }}
                  className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    tool === 'polyline'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>{txt.toolPolyline}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool('circle');
                    setDraftPoints([]);
                    setCircleDraft(null);
                  }}
                  className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    tool === 'circle'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>{txt.toolCircle}</span>
                </button>
              </div>

              {/* Symmetry + Mirror */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10.5px] font-mono uppercase text-muted-foreground hidden sm:inline">
                  {txt.symmetryLabel}:
                </span>
                <select
                  value={symmetryCount}
                  onChange={(e) => setSymmetryCount(Number(e.target.value))}
                  aria-label={txt.symmetryLabel}
                  className="h-8 px-2 rounded-md border border-border bg-background text-xs font-mono text-foreground cursor-pointer"
                >
                  {SYMMETRY_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? txt.symFree : `${n}×`}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant={mirrorSector ? 'default' : 'outline'}
                  onClick={() => setMirrorSector((v) => !v)}
                  className="h-8 px-2.5 text-xs gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>{txt.mirrorBtn}</span>
                </Button>
              </div>

              {/* Assist Toggles + Smooth + Undo/Redo */}
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={showGrid ? 'secondary' : 'outline'}
                  onClick={() => setShowGrid((v) => !v)}
                  className="h-8 px-2 text-xs gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{txt.gridBtn}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={snapToGrid ? 'default' : 'outline'}
                  onClick={() => setSnapToGrid((v) => !v)}
                  className="h-8 px-2 text-xs gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Magnet className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{txt.snapBtn}</span>
                </Button>

                {tool === 'freehand' && (
                  <select
                    value={smoothLevel}
                    onChange={(e) => setSmoothLevel(e.target.value as 'low' | 'medium' | 'high')}
                    title={txt.smoothLabel}
                    className="h-8 px-2 rounded-md border border-border bg-background text-xs text-foreground cursor-pointer"
                  >
                    <option value="low">{txt.smoothLabel}: {txt.smoothLow}</option>
                    <option value="medium">{txt.smoothLabel}: {txt.smoothMed}</option>
                    <option value="high">{txt.smoothLabel}: {txt.smoothHigh}</option>
                  </select>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 && !(tool === 'polyline' && draftPoints.length > 0)}
                  title={txt.undo}
                  className="h-8 w-8 p-0 cursor-pointer shrink-0"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title={txt.redo}
                  className="h-8 w-8 p-0 cursor-pointer shrink-0"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Canvas Stage + Side Telemetry/Strokes */}
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_270px] gap-4 p-4 items-start">
              {/* Interactive Cross-Section SVG Canvas */}
              <div className="flex flex-col items-center justify-center">
                {tool === 'polyline' && draftPoints.length > 0 && (
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={draftPoints.length < 3}
                      onClick={closePolylineDraft}
                      className="h-7 px-3 text-xs cursor-pointer"
                    >
                      {txt.closePolylineBtn} ({draftPoints.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDraftPoints([])}
                      className="h-7 px-2.5 text-xs cursor-pointer"
                    >
                      {txt.cancelDraftBtn}
                    </Button>
                  </div>
                )}

                <div className="relative w-full max-w-[430px] aspect-square rounded-xl border border-border bg-card shadow-inner flex items-center justify-center overflow-hidden">
                  <svg
                    ref={svgRef}
                    viewBox={`${-STAGE_HALF_VIEW} ${-STAGE_HALF_VIEW} ${STAGE_HALF_VIEW * 2} ${STAGE_HALF_VIEW * 2}`}
                    className="w-full h-full touch-none select-none cursor-crosshair"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => setCursorPt(null)}
                    onDoubleClick={() => {
                      if (tool === 'polyline' && draftPoints.length >= 3) {
                        closePolylineDraft();
                      }
                    }}
                  >
                    <defs>
                      <pattern
                        id={hatchId}
                        width="7"
                        height="7"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="7" height="7" fill="currentColor" fillOpacity="0.14" className="text-primary" />
                        <line x1="0" y1="0" x2="0" y2="7" stroke="currentColor" strokeWidth="1" strokeOpacity="0.28" className="text-primary" />
                      </pattern>
                    </defs>

                    {/* Outer Grain Bore Reference Disk */}
                    <circle
                      cx="0"
                      cy="0"
                      r={STAGE_RADIUS_PX}
                      fill="currentColor"
                      fillOpacity="0.04"
                      className="text-muted-foreground"
                    />

                    {/* Resulting Propellant Cross-Section */}
                    {inspection.isEmpty ? (
                      <circle
                        cx="0"
                        cy="0"
                        r={STAGE_RADIUS_PX}
                        fill={`url(#${hatchId})`}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="text-primary/70"
                      />
                    ) : propellantPathD ? (
                      <path
                        d={propellantPathD}
                        fill={`url(#${hatchId})`}
                        fillRule="evenodd"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        className="text-primary"
                      />
                    ) : null}

                    {/* Active Symmetry Sector Guide */}
                    {sectorWedgeD && (
                      <path
                        d={sectorWedgeD}
                        fill="currentColor"
                        fillOpacity="0.06"
                        stroke="currentColor"
                        strokeWidth="0.8"
                        strokeDasharray="3 3"
                        className="text-primary pointer-events-none"
                      />
                    )}

                    {/* Polar Grid Overlay */}
                    {showGrid && (
                      <g className="text-muted-foreground/35 pointer-events-none">
                        {[0.25, 0.5, 0.75].map((frac) => (
                          <circle
                            key={frac}
                            cx="0"
                            cy="0"
                            r={STAGE_RADIUS_PX * frac}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="0.7"
                            strokeDasharray="2 3"
                          />
                        ))}
                        {Array.from({ length: 12 }, (_, idx) => {
                          const angle = (Math.PI * idx) / 6;
                          const dx = STAGE_RADIUS_PX * Math.cos(angle);
                          const dy = STAGE_RADIUS_PX * Math.sin(angle);
                          return (
                            <line
                              key={idx}
                              x1={-dx}
                              y1={-dy}
                              x2={dx}
                              y2={dy}
                              stroke="currentColor"
                              strokeWidth="0.6"
                              strokeDasharray={idx % 3 === 0 ? undefined : '2 3'}
                            />
                          );
                        })}
                        <circle cx="0" cy="0" r="2.2" fill="currentColor" />
                      </g>
                    )}

                    {/* Outer Grain Boundary Ring (D0) */}
                    <circle
                      cx="0"
                      cy="0"
                      r={STAGE_RADIUS_PX}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      className="text-foreground/65 pointer-events-none"
                    />

                    {/* Live Draft Stroke + Symmetric Ghost Copies */}
                    {tool !== 'circle' && draftPoints.length >= 1 && (
                      <g className="pointer-events-none">
                        {previewTransforms.map((tr, idx) => {
                          const activePts =
                            tool === 'polyline' && cursorPt
                              ? [...draftPoints, cursorPt]
                              : draftPoints;
                          const polyStr = pointsToSvgPolyline(activePts, STAGE_RADIUS_PX);
                          const transformStr = `${tr.angleDeg !== 0 ? `rotate(${tr.angleDeg})` : ''} ${tr.mirror ? 'scale(1,-1)' : ''}`.trim();
                          return (
                            <polyline
                              key={idx}
                              points={polyStr}
                              transform={transformStr || undefined}
                              fill={kind === 'solid' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)'}
                              stroke={kind === 'solid' ? '#f59e0b' : '#ef4444'}
                              strokeWidth={idx === 0 ? '1.8' : '1.1'}
                              strokeDasharray={idx === 0 ? undefined : '3 2'}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          );
                        })}
                        {tool === 'polyline' &&
                          draftPoints.map((pt, i) => (
                            <circle
                              key={i}
                              cx={pt.x * STAGE_RADIUS_PX}
                              cy={pt.y * STAGE_RADIUS_PX}
                              r={i === 0 ? 4.2 : 2.6}
                              fill={i === 0 ? '#10b981' : '#ef4444'}
                              stroke="white"
                              strokeWidth="0.9"
                            />
                          ))}
                      </g>
                    )}

                    {/* Live Circle Tool Draft + Symmetric Ghosts */}
                    {tool === 'circle' && circleDraft && (
                      <g className="pointer-events-none">
                        {previewTransforms.map((tr, idx) => {
                          const transformStr = `${tr.angleDeg !== 0 ? `rotate(${tr.angleDeg})` : ''} ${tr.mirror ? 'scale(1,-1)' : ''}`.trim();
                          return (
                            <circle
                              key={idx}
                              cx={circleDraft.cx * STAGE_RADIUS_PX}
                              cy={circleDraft.cy * STAGE_RADIUS_PX}
                              r={circleDraft.r * STAGE_RADIUS_PX}
                              transform={transformStr || undefined}
                              fill={kind === 'solid' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)'}
                              stroke={kind === 'solid' ? '#f59e0b' : '#ef4444'}
                              strokeWidth={idx === 0 ? '1.8' : '1.1'}
                              strokeDasharray={idx === 0 ? undefined : '3 2'}
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* Snapped/Active Pointer Reticle */}
                    {cursorPt && (
                      <circle
                        cx={cursorPt.x * STAGE_RADIUS_PX}
                        cy={cursorPt.y * STAGE_RADIUS_PX}
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        className="text-primary pointer-events-none"
                      />
                    )}
                  </svg>

                  {/* Corner Polar Coordinate Readout */}
                  <div className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded bg-background/85 border border-border/80 text-[10.5px] font-mono tabular-nums text-muted-foreground pointer-events-none">
                    {cursorPt
                      ? `r/R₀ ${(cursorR * 100).toFixed(0)}% · ${cursorDeg.toFixed(0)}°`
                      : `Ø ref ${refD0.toFixed(1)} mm`}
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground text-center max-w-md">
                  {activeHint}
                </p>
              </div>

              {/* Right Column: Geometry Inspection + Applied Strokes */}
              <div className="space-y-3">
                {/* Quiet Engineering Metrics Card */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                    {txt.metricsTitle} (Ø {refD0.toFixed(1)} mm)
                  </div>
                  <div className="space-y-1.5 text-xs font-mono tabular-nums">
                    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                      <span className="text-muted-foreground">{txt.fillLabel}:</span>
                      <span className="font-semibold text-foreground">{inspection.fillPercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                      <span className="text-muted-foreground">{txt.propAreaLabel}:</span>
                      <span className="font-semibold text-foreground">{inspection.propellantAreaMm2.toFixed(1)} mm²</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                      <span className="text-muted-foreground">{txt.portAreaLabel}:</span>
                      <span className="font-semibold text-foreground">{inspection.portAreaMm2.toFixed(1)} mm²</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
                      <span className="text-muted-foreground">{txt.webEstLabel}:</span>
                      <span className="font-semibold text-foreground">{inspection.estimatedWebMm.toFixed(2)} mm</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{txt.piecesLabel}:</span>
                      <span className="font-semibold text-foreground">{inspection.propellantPieceCount}</span>
                    </div>
                  </div>
                </div>

                {/* Validation / Topology Warnings */}
                {(inspection.isEmpty || inspection.hasNoPropellant || inspection.isSplitOrHasIsland || saveError) && (
                  <div className="space-y-2">
                    {saveError && (
                      <div className="p-2.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{saveError}</span>
                      </div>
                    )}
                    {!saveError && inspection.isEmpty && (
                      <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-muted-foreground text-xs">
                        {txt.errEmpty}
                      </div>
                    )}
                    {!saveError && inspection.hasNoPropellant && (
                      <div className="p-2.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{txt.errNoPropellant}</span>
                      </div>
                    )}
                    {inspection.isSplitOrHasIsland && (
                      <div className="p-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{txt.warnSplit.replace('{n}', String(inspection.propellantPieceCount))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Applied Strokes List */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                    {txt.strokesTitle} ({strokes.length})
                  </div>
                  {strokes.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">{txt.noStrokes}</div>
                  ) : (
                    <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
                      {strokes.map((stk, i) => (
                        <div
                          key={stk.id}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-border/60 bg-background text-[11px] font-mono"
                        >
                          <span className="inline-flex items-center gap-1.5 truncate text-foreground">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                stk.kind === 'solid' ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                            />
                            <span className="truncate">
                              #{i + 1} · {stk.kind === 'solid' ? txt.strokeSolid : txt.strokeVoid}
                              {stk.symmetryCount > 1 ? ` · ${stk.symmetryCount}×` : ''}
                              {stk.mirrorSector ? ' ⇄' : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => commitStrokesChange((prev) => prev.filter((item) => item.id !== stk.id))}
                            className="text-muted-foreground hover:text-destructive p-0.5 cursor-pointer shrink-0"
                            title={txt.delete}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {normalizedLoops.length} loops · {inspection.fillPercent.toFixed(1)}% fill
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer whitespace-nowrap shrink-0">
              {txt.cancel}
            </Button>
            <Button
              variant={onSelectCustomGrainForGrain ? 'outline' : 'default'}
              size="sm"
              onClick={() => handleSave(false)}
              className="cursor-pointer whitespace-nowrap shrink-0"
            >
              {txt.saveLib}
            </Button>
            {onSelectCustomGrainForGrain && (
              <Button
                size="sm"
                onClick={() => handleSave(true)}
                className="cursor-pointer whitespace-nowrap shrink-0 gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{txt.saveAndUse}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
