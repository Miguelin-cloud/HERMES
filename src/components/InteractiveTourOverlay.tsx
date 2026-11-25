import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  Lightbulb, 
  Wand2, 
  ArrowDown, 
  ArrowUp, 
  ArrowLeft, 
  ArrowRight,
  HelpCircle,
  Play,
  Minimize2,
  Maximize2,
  GripHorizontal,
  RotateCcw
} from 'lucide-react';

export interface TourStep {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  title: string;
  category?: string;
  description: string;
  bulletPoints?: string[];
  tab?: string; // Tab to switch to if needed
  requiresResults?: boolean;
  analysisSubTab?: 'areas' | 'kn' | 'burn_rate' | 'mass_flow';
  smartSearchStep?: 0 | 1 | 2 | 3;
  openModal?: 'propellant';
  openModalTab?: 'catalog' | 'editor';
  closeModal?: 'propellant';
  tip?: string;
  autofillLabel?: string;
  onAutofill?: () => void;
  arrowPosition?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}

export interface TourSequence {
  id: string;
  title: string;
  description: string;
  steps: TourStep[];
}

interface InteractiveTourOverlayProps {
  activeTour: TourSequence | null;
  currentStepIndex: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onCloseTour: () => void;
  onOpenGuideBook: () => void;
  onSwitchTab?: (tab: string) => void;
  hasResults?: boolean;
  lang: string;
  theme: string;
}

export const COMPLETED_TOURS_STORAGE_KEY = 'hermes_completed_tours';

export function markTourCompleted(tourId: string) {
  try {
    const raw = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(tourId);
    localStorage.setItem(COMPLETED_TOURS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent('hermes-tour-completed', { detail: tourId }));
  } catch (err) {
    console.error('Error recording completed tour:', err);
  }
}

export function isTourCompleted(tourId: string): boolean {
  try {
    const raw = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(tourId);
  } catch {
    return false;
  }
}

export function resetCompletedTours() {
  try {
    localStorage.removeItem(COMPLETED_TOURS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('hermes-tour-completed', { detail: null }));
  } catch (err) {
    console.error('Error resetting completed tours:', err);
  }
}

export function unmarkSingleTour(tourId: string) {
  try {
    const raw = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    const updated = list.filter(id => id !== tourId);
    localStorage.setItem(COMPLETED_TOURS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('hermes-tour-completed', { detail: tourId }));
  } catch (err) {
    console.error('Error unmarking tour:', err);
  }
}

export function InteractiveTourOverlay({
  activeTour,
  currentStepIndex,
  onNextStep,
  onPrevStep,
  onCloseTour,
  onOpenGuideBook,
  onSwitchTab,
  hasResults = false,
  lang,
  theme
}: InteractiveTourOverlayProps) {
  const isSpanish = lang === 'es';
  const isFrench = lang === 'fr';
  const isItalian = lang === 'it';
  const isDark = theme === 'dark';

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' }>({
    top: 100,
    left: 100,
    placement: 'bottom'
  });
  const [hasScrolled, setHasScrolled] = useState(false);
  const [autofillSuccess, setAutofillSuccess] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; cardX: number; cardY: number }>({
    mouseX: 0,
    mouseY: 0,
    cardX: 0,
    cardY: 0
  });

  const step = activeTour?.steps[currentStepIndex];
  const needsSimulationFirst = Boolean(step?.requiresResults && !hasResults);

  // Reset drag position whenever the step or active tour changes so new step opens adjacent to target
  useEffect(() => {
    setDragPos(null);
  }, [currentStepIndex, activeTour?.id]);

  // Mouse drag handler for card header
  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }

    const currentCardX = dragPos?.x ?? tooltipPos.left;
    const currentCardY = dragPos?.y ?? tooltipPos.top;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cardX: currentCardX,
      cardY: currentCardY
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;

      const cardWidth = Math.min(440, window.innerWidth - 32);
      const newX = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, dragStartRef.current.cardX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 80, dragStartRef.current.cardY + dy));

      setDragPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch drag handler for mobile/tablet screens
  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    const currentCardX = dragPos?.x ?? tooltipPos.left;
    const currentCardY = dragPos?.y ?? tooltipPos.top;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      cardX: currentCardX,
      cardY: currentCardY
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const t = moveEvent.touches[0];
      const dx = t.clientX - dragStartRef.current.mouseX;
      const dy = t.clientY - dragStartRef.current.mouseY;

      const cardWidth = Math.min(440, window.innerWidth - 32);
      const newX = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, dragStartRef.current.cardX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 80, dragStartRef.current.cardY + dy));

      setDragPos({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Auto-switch tab if step requires it (or redirect to Inputs if simulation results are required first)
  useEffect(() => {
    if (!step) return;
    if (needsSimulationFirst) {
      onSwitchTab?.('inputs');
      setAutofillSuccess(false);
      return;
    }
    if (step.tab && onSwitchTab) {
      onSwitchTab(step.tab);
    }
    if (step.analysisSubTab) {
      window.dispatchEvent(new CustomEvent('hermes-analysis-set-subtab', { detail: step.analysisSubTab }));
    }
    if (step.smartSearchStep !== undefined) {
      window.dispatchEvent(new CustomEvent('hermes-smart-search-set-step', { detail: step.smartSearchStep }));
    }
    if (step.openModal === 'propellant') {
      window.dispatchEvent(new CustomEvent('hermes-open-propellant-modal', {
        detail: { startEditor: step.openModalTab === 'editor' }
      }));
    }
    if (step.closeModal === 'propellant') {
      window.dispatchEvent(new CustomEvent('hermes-close-propellant-modal'));
    }
    setAutofillSuccess(false);
  }, [step, onSwitchTab, needsSimulationFirst, hasResults]);

  // Recalculate target position & calculate non-overlapping position
  const updateTargetRect = useCallback(() => {
    if (!step) return;

    const effectiveSelector = needsSimulationFirst ? '[data-tour="simulate-btn"]' : step.targetSelector;
    const el =
      document.querySelector(effectiveSelector) ||
      (step.fallbackSelector ? document.querySelector(step.fallbackSelector) : null);
    if (el) {
      let r = el.getBoundingClientRect();

      // If target element is inside a scroll container or modal, clamp rect to visible scroll bounds
      const modalParent = el.closest('.overflow-y-auto') || el.closest('[role="dialog"]');
      if (modalParent) {
        const pRect = modalParent.getBoundingClientRect();
        const top = Math.max(r.top, pRect.top + 4);
        const bottom = Math.min(r.bottom, pRect.bottom - 4);
        const left = Math.max(r.left, pRect.left + 4);
        const right = Math.min(r.right, pRect.right - 4);

        if (bottom > top && right > left) {
          r = new DOMRect(left, top, right - left, bottom - top);
        }
      }

      setRect(r);

      // Scroll element smoothly into view if out of viewport
      const isInViewport =
        r.top >= 50 &&
        r.left >= 10 &&
        r.bottom <= (window.innerHeight - 50) &&
        r.right <= (window.innerWidth - 10);

      if (!isInViewport && !hasScrolled) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setHasScrolled(true);
      }

      // Calculate best tooltip position to guarantee NO overlap with target rect
      const tooltipWidth = Math.min(440, window.innerWidth - 32);
      const tooltipHeight = 290;
      const margin = 16;

      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const spaceRight = window.innerWidth - r.right;
      const spaceLeft = r.left;

      let placement: 'top' | 'bottom' | 'left' | 'right' = step.arrowPosition && step.arrowPosition !== 'auto'
        ? step.arrowPosition
        : 'bottom';

      if (!step.arrowPosition || step.arrowPosition === 'auto') {
        if (spaceBelow >= tooltipHeight + margin) {
          placement = 'bottom';
        } else if (spaceAbove >= tooltipHeight + margin) {
          placement = 'top';
        } else if (spaceRight >= tooltipWidth + margin) {
          placement = 'right';
        } else if (spaceLeft >= tooltipWidth + margin) {
          placement = 'left';
        } else {
          // If neither has full room, pick whichever has more vertical clearance
          placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';
        }
      }

      let top = 0;
      let left = 0;

      if (placement === 'bottom') {
        top = r.bottom + margin;
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, r.left + r.width / 2 - tooltipWidth / 2));
      } else if (placement === 'top') {
        top = Math.max(16, r.top - tooltipHeight - margin);
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, r.left + r.width / 2 - tooltipWidth / 2));
      } else if (placement === 'right') {
        top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, r.top + r.height / 2 - tooltipHeight / 2));
        left = r.right + margin;
      } else if (placement === 'left') {
        top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, r.top + r.height / 2 - tooltipHeight / 2));
        left = Math.max(16, r.left - tooltipWidth - margin);
      }

      // Hard check: Ensure card top/bottom doesn't cover the target rectangle directly
      // If bottom placement overflows viewport, push card to side instead of covering target
      if (placement === 'bottom' && top + tooltipHeight > window.innerHeight) {
        if (spaceRight >= tooltipWidth) {
          placement = 'right';
          left = r.right + margin;
          top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, r.top));
        } else if (spaceLeft >= tooltipWidth) {
          placement = 'left';
          left = Math.max(16, r.left - tooltipWidth - margin);
          top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, r.top));
        }
      }

      setTooltipPos({ top, left, placement });
    } else {
      // If target element is not found, fallback to safe bottom-right corner
      setRect(null);
      setTooltipPos({
        top: Math.max(40, window.innerHeight - 340),
        left: Math.max(16, window.innerWidth - 460),
        placement: 'bottom'
      });
    }
  }, [step, hasScrolled, needsSimulationFirst]);

  useEffect(() => {
    setHasScrolled(false);
    const t1 = setTimeout(updateTargetRect, 60);
    const t2 = setTimeout(updateTargetRect, 220);

    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [step, currentStepIndex, updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        onNextStep();
      } else if (e.key === 'ArrowLeft') {
        onPrevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextStep, onPrevStep, onCloseTour]);

  if (!activeTour || !step) return null;

  const totalSteps = activeTour.steps.length;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  const handleFinishTour = () => {
    markTourCompleted(activeTour.id);
    onCloseTour();
  };

  const handleAutofill = () => {
    if (step.onAutofill) {
      step.onAutofill();
      setAutofillSuccess(true);
      setTimeout(() => setAutofillSuccess(false), 2400);
      setTimeout(updateTargetRect, 100);
    }
  };

  // Localized texts
  const tStrings = {
    stepOf: isSpanish ? `Paso ${currentStepIndex + 1} de ${totalSteps}` : isFrench ? `Étape ${currentStepIndex + 1} sur ${totalSteps}` : isItalian ? `Passo ${currentStepIndex + 1} di ${totalSteps}` : `Step ${currentStepIndex + 1} of ${totalSteps}`,
    guideBook: isSpanish ? 'Libro de Guías' : isFrench ? 'Livre des Guides' : isItalian ? 'Libro delle Guide' : 'Guide Book',
    close: isSpanish ? 'Cerrar guía (Esc)' : isFrench ? 'Fermer (Échap)' : isItalian ? 'Chiudi (Esc)' : 'Close tour (Esc)',
    minimize: isSpanish ? 'Minimizar tarjeta' : isFrench ? 'Réduire' : isItalian ? 'Riduci a icona' : 'Minimize card',
    restore: isSpanish ? 'Desplegar tarjeta' : isFrench ? 'Agrandir' : isItalian ? 'Espandi' : 'Expand card',
    back: isSpanish ? 'Atrás' : isFrench ? 'Retour' : isItalian ? 'Indietro' : 'Back',
    next: isSpanish ? 'Siguiente' : isFrench ? 'Suivant' : isItalian ? 'Avanti' : 'Next',
    done: isSpanish ? '¡Entendido!' : isFrench ? 'Terminé !' : isItalian ? 'Completato!' : 'Got it!',
    applied: isSpanish ? '¡Valores de ejemplo aplicados!' : isFrench ? 'Valeurs d\'exemple appliquées !' : isItalian ? 'Valori di prova applicati!' : 'Sample values applied!',
    autofill: isSpanish ? 'Autocompletar valores de prueba' : isFrench ? 'Remplir automatiquement' : isItalian ? 'Riempi automaticamente' : 'Autofill test values',
    dragHint: isSpanish ? 'Arrastra desde el encabezado para mover esta tarjeta' : isFrench ? 'Faites glisser l\'en-tête pour déplacer cette carte' : isItalian ? 'Trascina l\'intestazione per spostare questa scheda' : 'Drag header to move this card',
    move: isSpanish ? 'Mover' : isFrench ? 'Déplacer' : isItalian ? 'Sposta' : 'Move',
    resetPos: isSpanish ? 'Restablecer posición inicial' : isFrench ? 'Réinitialiser la position' : isItalian ? 'Ripristina posizione' : 'Reset initial position',
    prereqTitle: isSpanish
      ? 'Simulación requerida primero'
      : isFrench
        ? 'Simulation requise au préalable'
        : isItalian
          ? 'Simulazione richiesta prima'
          : 'Simulation required first',
    prereqDesc: isSpanish
      ? 'Aún no hay resultados calculados. Revisa tus datos en Inputs (o carga un motor de prueba) y pulsa el botón SIMULAR señalado arriba a la derecha para desbloquear esta pestaña.'
      : isFrench
        ? 'Aucun résultat calculé pour le moment. Vérifiez vos entrées puis cliquez sur SIMULER en haut à droite pour débloquer cet onglet.'
        : isItalian
          ? 'Nessun risultato disponibile. Controlla i parametri in Dati e premi il pulsante SIMULA in alto a destra per sbloccare questo pannello.'
          : 'No simulation results yet. Review your parameters on Inputs (or load a sample motor) and click the highlighted SIMULATE button at the top right to unlock this tab.',
  };

  const backdropBg = isDark ? 'rgba(3, 7, 18, 0.72)' : 'rgba(15, 23, 42, 0.60)';
  const pad = 6;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none select-none font-sans">
      {/* 1. TRUE CLICK-THROUGH CUTOUT BACKDROP */}
      {/* 4 separate surrounding dark panels so the spotlight area is a 100% free transparent window with ZERO DOM blocking pointer events! */}
      {rect ? (
        <>
          {/* Top panel */}
          <div 
            style={{ 
              top: 0, 
              left: 0, 
              right: 0, 
              height: Math.max(0, rect.top - pad),
              backgroundColor: backdropBg
            }}
            className="absolute pointer-events-auto backdrop-blur-[1px] transition-all duration-200"
            onClick={onCloseTour}
          />
          {/* Bottom panel */}
          <div 
            style={{ 
              top: rect.bottom + pad, 
              left: 0, 
              right: 0, 
              bottom: 0,
              backgroundColor: backdropBg
            }}
            className="absolute pointer-events-auto backdrop-blur-[1px] transition-all duration-200"
            onClick={onCloseTour}
          />
          {/* Left panel */}
          <div 
            style={{ 
              top: Math.max(0, rect.top - pad), 
              left: 0, 
              width: Math.max(0, rect.left - pad), 
              height: rect.height + pad * 2,
              backgroundColor: backdropBg
            }}
            className="absolute pointer-events-auto backdrop-blur-[1px] transition-all duration-200"
            onClick={onCloseTour}
          />
          {/* Right panel */}
          <div 
            style={{ 
              top: Math.max(0, rect.top - pad), 
              left: rect.right + pad, 
              right: 0, 
              height: rect.height + pad * 2,
              backgroundColor: backdropBg
            }}
            className="absolute pointer-events-auto backdrop-blur-[1px] transition-all duration-200"
            onClick={onCloseTour}
          />
        </>
      ) : (
        <div 
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs pointer-events-auto transition-all"
          onClick={onCloseTour}
        />
      )}

      {/* 2. Target Spotlight Border & Crisp Corner Accents */}
      {rect && (
        <div
          style={{
            top: Math.max(8, rect.top - pad),
            left: Math.max(8, rect.left - pad),
            width: Math.max(20, Math.min(window.innerWidth - Math.max(8, rect.left - pad) - 16, rect.width + pad * 2)),
            height: Math.max(20, Math.min(window.innerHeight - Math.max(8, rect.top - pad) - 16, rect.height + pad * 2)),
          }}
          className="absolute pointer-events-none transition-all duration-200 rounded-lg ring-2 ring-primary shadow-lg"
        >
          {/* Corner calibration ticks */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary rounded-br" />
        </div>
      )}

      {/* 3. Dynamic Visual Indicator Arrow */}
      {rect && !isMinimized && (
        <div
          style={{
            top: tooltipPos.placement === 'bottom'
              ? rect.bottom + 2
              : tooltipPos.placement === 'top'
              ? rect.top - 22
              : rect.top + rect.height / 2 - 12,
            left: tooltipPos.placement === 'right'
              ? rect.right + 4
              : tooltipPos.placement === 'left'
              ? rect.left - 24
              : rect.left + rect.width / 2 - 12,
          }}
          className="absolute z-[10000] pointer-events-none transition-all duration-200"
        >
          {tooltipPos.placement === 'bottom' && (
            <div className="flex flex-col items-center">
              <ArrowDown className="w-6 h-6 text-primary fill-primary/20" />
            </div>
          )}
          {tooltipPos.placement === 'top' && (
            <div className="flex flex-col items-center">
              <ArrowUp className="w-6 h-6 text-primary fill-primary/20" />
            </div>
          )}
          {tooltipPos.placement === 'right' && (
            <div className="flex items-center">
              <ArrowLeft className="w-6 h-6 text-primary fill-primary/20" />
            </div>
          )}
          {tooltipPos.placement === 'left' && (
            <div className="flex items-center">
              <ArrowRight className="w-6 h-6 text-primary fill-primary/20" />
            </div>
          )}
        </div>
      )}

      {/* 4. MINIMIZED FLOATING DOCKED TOOLBAR */}
      {isMinimized ? (
        <div 
          className="fixed bottom-4 right-4 z-[10002] pointer-events-auto rounded-lg px-3.5 py-2 shadow-xl flex items-center gap-2.5 border border-primary/40 bg-card/95 text-foreground backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </span>
            <div className="flex flex-col pr-1">
              <span className="text-[11px] font-bold text-foreground leading-tight max-w-[180px] truncate">
                {step.title}
              </span>
              <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                {tStrings.stepOf}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-border/60" />

          {/* Quick Nav Controls inside docked bar */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevStep}
              disabled={isFirst}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {isLast ? (
              <Button
                size="sm"
                onClick={handleFinishTour}
                className="h-7 px-2.5 text-[11px] bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-md"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {tStrings.done}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNextStep}
                className="h-7 w-7 text-primary hover:bg-primary/10"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(false)}
              title={tStrings.restore}
              className="h-7 w-7 text-primary hover:bg-primary/10"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseTour}
              title={tStrings.close}
              className="h-7 w-7 text-muted-foreground hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* 5. INTERACTIVE GUIDANCE CARD POPOVER */
        <div
          style={{
            top: dragPos ? dragPos.y : tooltipPos.top,
            left: dragPos ? dragPos.x : tooltipPos.left,
            width: Math.min(440, window.innerWidth - 32),
          }}
          className={`absolute z-[10001] pointer-events-auto rounded-xl p-4 shadow-2xl border border-primary/40 bg-card/95 text-foreground backdrop-blur-md ${
            isDragging ? 'transition-none ring-2 ring-primary' : 'transition-all duration-300'
          }`}
        >
          {/* Card Header: Tour Name, Drag Handle, Minimize & Close */}
          <div 
            className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/60 cursor-grab active:cursor-grabbing select-none group"
            onMouseDown={handleHeaderMouseDown}
            onTouchStart={handleHeaderTouchStart}
            title={tStrings.dragHint}
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary border border-primary/30 group-hover:scale-105 transition-transform">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-primary">
                    {activeTour.title}
                  </span>
                  <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground/80 font-mono px-1 py-0.2 rounded bg-muted/50 border border-border/40">
                    <GripHorizontal className="w-3 h-3 text-primary/80" />
                    <span className="text-[8px] font-bold uppercase tracking-wider hidden sm:inline">
                      {tStrings.move}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                  {tStrings.stepOf}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              {/* Reset drag position button if dragged */}
              {dragPos && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDragPos(null)}
                  title={tStrings.resetPos}
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
              {/* Minimize button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                title={tStrings.minimize}
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenGuideBook}
                title={tStrings.guideBook}
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseTour}
                title={tStrings.close}
                className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Card Content: Title & Explanation */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-foreground leading-snug">
                {step.title}
              </h4>
              {step.category && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                  {step.category}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {step.description}
            </p>

            {/* Bullet points for engineering tips */}
            {step.bulletPoints && step.bulletPoints.length > 0 && (
              <ul className="space-y-1 my-2 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs">
                {step.bulletPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/90">
                    <span className="text-primary font-bold mt-0.5 leading-none">•</span>
                    <span className="leading-tight text-[11px]">{pt}</span>
                  </li>
                ))}
              </ul>
            )}

            {needsSimulationFirst && (
              <div className="p-2.5 rounded-lg bg-amber-500/12 border border-amber-500/45 text-amber-800 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{tStrings.prereqTitle}</span>
                </div>
                <p className="text-[11px] leading-snug">{tStrings.prereqDesc}</p>
              </div>
            )}

            {/* Practical Pro-tip Box */}
            {step.tip && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-tight">{step.tip}</span>
              </div>
            )}

            {/* Interactive Autofill / Try preset action button */}
            {step.onAutofill && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutofill}
                  className={`w-full h-8 text-xs font-semibold gap-2 transition-all ${
                    autofillSuccess
                      ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
                      : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/40 hover:border-primary'
                  }`}
                >
                  {autofillSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{tStrings.applied}</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                      <span>{step.autofillLabel || tStrings.autofill}</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Card Footer: Step progress bar & Navigation */}
          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
            {/* Progress segments */}
            <div className="flex items-center gap-1">
              {activeTour.steps.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-xs transition-all duration-300 ${
                    idx === currentStepIndex
                      ? 'w-5 bg-primary'
                      : idx < currentStepIndex
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            {/* Buttons: Prev, Next, Ready */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevStep}
                disabled={isFirst}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                {tStrings.back}
              </Button>

              {isLast ? (
                <Button
                  size="sm"
                  onClick={handleFinishTour}
                  className="h-7 px-3 text-xs bg-primary hover:opacity-90 text-primary-foreground font-bold gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {tStrings.done}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onNextStep}
                  className="h-7 px-3 text-xs bg-primary hover:opacity-90 text-primary-foreground font-bold gap-1 shadow-sm"
                >
                  {tStrings.next}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
