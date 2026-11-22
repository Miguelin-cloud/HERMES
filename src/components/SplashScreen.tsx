import React, { useCallback, useEffect, useRef, useState } from 'react';
import coheterosLogo from '../assets/coheteros_logo.png';
import { Language, translations } from '../lib/i18n';

const QUOTES = [
  {
    text: 'The Earth is the cradle of humanity, but mankind cannot stay in the cradle forever.',
    author: 'Konstantin Tsiolkovsky',
  },
  {
    text: 'To confine our attention to terrestrial matters would be to limit the human spirit.',
    author: 'Stephen Hawking',
  },
  {
    text: 'Once you have tasted flight, you will forever walk the earth with your eyes turned skyward.',
    author: 'Leonardo da Vinci',
  },
  {
    text: 'That’s one small step for man, one giant leap for mankind.',
    author: 'Neil Armstrong',
  },
  {
    text: 'Spaceflight will never tolerate carelessness, incapacity, and neglect.',
    author: 'Gene Kranz',
  },
  {
    text: 'Any sufficiently advanced technology is indistinguishable from magic.',
    author: 'Arthur C. Clarke',
  },
  {
    text: 'Esto es como si Chicote le tiene miedo a sus macarrones',
    author: 'Nico Pérez',
  },
];

const PHYSICS_EQUATIONS = [
  'F = ṁ·vₑ + (Pₑ − Pₐ)·Aₑ',
  'Δv = Iₛₚ·g₀·ln(m₀/m_f)',
  'r = a·Pⁿ',
  'P₀ = (ṁ·c*) / Aₜ',
  'Kₙ = A_b / Aₜ',
  'Iₜ = ∫ F(t) dt',
  'c* = √(γ·R·T₀) / Γ',
  'P₀/P = (1 + ½(γ−1)M²)^(γ/(γ−1))',
  '∇·(ρu) + ∂ρ/∂t = 0',
  'F = m·a',
  'C_F = F / (P₀·Aₜ)',
  'Aₑ/Aₜ = f(Mₑ, γ)',
  'E = m·c²',
  'p + ½ρv² + ρgh = const',
];

interface StarNode {
  x: number;
  y: number;
  r: number;
  energy: number;
}

interface ConstellationEdge {
  a: number;
  b: number;
}

interface EquationNode {
  x: number;
  y: number;
  text: string;
  energy: number;
}

interface SceneData {
  width: number;
  height: number;
  stars: StarNode[];
  edges: ConstellationEdge[];
  equations: EquationNode[];
}

function createDeterministicRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildConstellationScene(width: number, height: number): SceneData {
  const rng = createDeterministicRng(202604);
  const area = width * height;
  const starCount = Math.max(42, Math.min(95, Math.round(area / 18000)));
  const stars: StarNode[] = [];

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (0.04 + rng() * 0.92) * width,
      y: (0.05 + rng() * 0.9) * height,
      r: 1.0 + rng() * 1.4,
      energy: 0,
    });
  }

  // Connect nearby stars into subtle constellation clusters
  const maxLinkDist = Math.min(185, Math.max(115, Math.min(width, height) * 0.22));
  const linkCount = new Array(stars.length).fill(0);
  const edges: ConstellationEdge[] = [];

  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      if (linkCount[i] >= 3 || linkCount[j] >= 3) continue;
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const d = Math.hypot(dx, dy);
      if (d > 28 && d < maxLinkDist && rng() > 0.32) {
        edges.push({ a: i, b: j });
        linkCount[i]++;
        linkCount[j]++;
      }
    }
  }

  // Distribute equations avoiding tight overlap and keeping center band sparser for crisp legibility
  const equations: EquationNode[] = [];
  const candidateSlots: Array<{ x: number; y: number }> = [];
  const cols = width < 640 ? 3 : 5;
  const rows = height < 640 ? 4 : 4;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.2 + rng() * 0.6) * cellW;
      const cy = (r + 0.25 + rng() * 0.5) * cellH;
      // Leave central HERMES headline zone cleaner while still allowing surrounding & perimeter equations
      const inCenterBox =
        Math.abs(cx - width * 0.5) < Math.min(210, width * 0.26) &&
        Math.abs(cy - height * 0.48) < Math.min(125, height * 0.2);
      if (!inCenterBox) {
        candidateSlots.push({ x: cx, y: cy });
      }
    }
  }

  for (let i = 0; i < candidateSlots.length && i < PHYSICS_EQUATIONS.length; i++) {
    equations.push({
      x: candidateSlots[i].x,
      y: candidateSlots[i].y,
      text: PHYSICS_EQUATIONS[i],
      energy: 0,
    });
  }

  return { width, height, stars, edges, equations };
}

export function SplashScreen({ lang, onComplete }: { lang: Language; onComplete: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneData | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number | null>(null);
  const requestDrawRef = useRef<(() => void) | null>(null);

  const t = translations[lang] || translations.en;

  const handleEnterApp = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onCompleteRef.current();
    }, 220);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterApp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEnterApp]);

  // Lightweight event-driven 2D canvas: illuminates constellations & physics equations near cursor, then sleeps when idle
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let lastFrameTime = performance.now();

    const drawFrame = (now: number) => {
      rafRef.current = null;
      const scene = sceneRef.current;
      if (!ctx || !scene) return;

      const dt = Math.min(0.08, Math.max(0.008, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      const ptr = pointerRef.current;
      const radius = Math.min(220, Math.max(150, Math.min(scene.width, scene.height) * 0.25));
      let hasActiveGlow = ptr.active;

      ctx.clearRect(0, 0, scene.width, scene.height);

      // Update & draw subtle ambient cursor aura (no heavy shadowBlur filters -> fast on all laptop GPUs & SwiftShader)
      if (ptr.active) {
        const aura = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, radius * 1.1);
        aura.addColorStop(0, 'rgba(148, 163, 184, 0.085)');
        aura.addColorStop(0.55, 'rgba(100, 116, 139, 0.03)');
        aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(ptr.x - radius * 1.1, ptr.y - radius * 1.1, radius * 2.2, radius * 2.2);
      }

      // Update star energies smoothly
      const decayRate = prefersReducedMotion ? 12 : 2.1;
      for (let i = 0; i < scene.stars.length; i++) {
        const star = scene.stars[i];
        let target = 0;
        if (ptr.active) {
          const dist = Math.hypot(star.x - ptr.x, star.y - ptr.y);
          if (dist < radius) {
            target = Math.pow(1 - dist / radius, 1.45);
          }
        }
        if (target > star.energy) {
          star.energy = prefersReducedMotion ? target : Math.min(1, star.energy + (target - star.energy) * Math.min(1, dt * 16));
        } else if (star.energy > 0.004) {
          star.energy = Math.max(0, star.energy - dt * decayRate);
        } else {
          star.energy = 0;
        }
        if (star.energy > 0.004) hasActiveGlow = true;
      }

      // Draw constellation edges
      ctx.lineCap = 'round';
      for (let i = 0; i < scene.edges.length; i++) {
        const edge = scene.edges[i];
        const sA = scene.stars[edge.a];
        const sB = scene.stars[edge.b];
        const glow = Math.max(sA.energy * 0.75 + sB.energy * 0.25, sB.energy * 0.75 + sA.energy * 0.25);
        const alpha = 0.03 + glow * 0.42;
        ctx.strokeStyle =
          glow > 0.05
            ? `rgba(186, 214, 247, ${alpha.toFixed(3)})`
            : `rgba(148, 163, 184, ${alpha.toFixed(3)})`;
        ctx.lineWidth = glow > 0.15 ? 1.15 : 0.75;
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();
      }

      // Draw stars (two-pass soft halo when illuminated, crisp core)
      for (let i = 0; i < scene.stars.length; i++) {
        const star = scene.stars[i];
        if (star.energy > 0.04) {
          ctx.fillStyle = `rgba(186, 214, 247, ${(star.energy * 0.24).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * (2.6 + star.energy * 1.8), 0, Math.PI * 2);
          ctx.fill();
        }
        const coreAlpha = 0.12 + star.energy * 0.82;
        ctx.fillStyle = `rgba(241, 245, 249, ${coreAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r * (1 + star.energy * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & draw physics/propulsion equations
      ctx.font = '500 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < scene.equations.length; i++) {
        const eq = scene.equations[i];
        let target = 0;
        if (ptr.active) {
          const dist = Math.hypot(eq.x - ptr.x, eq.y - ptr.y);
          if (dist < radius * 1.12) {
            target = Math.pow(1 - dist / (radius * 1.12), 1.3);
          }
        }
        if (target > eq.energy) {
          eq.energy = prefersReducedMotion ? target : Math.min(1, eq.energy + (target - eq.energy) * Math.min(1, dt * 15));
        } else if (eq.energy > 0.004) {
          eq.energy = Math.max(0, eq.energy - dt * (decayRate * 0.85));
        } else {
          eq.energy = 0;
        }
        if (eq.energy > 0.004) hasActiveGlow = true;

        const baseAlpha = 0.045;
        const alpha = baseAlpha + eq.energy * 0.56;
        if (eq.energy > 0.08) {
          // Soft subtle bloom behind illuminated equation without expensive canvas shadowBlur
          ctx.fillStyle = `rgba(186, 214, 247, ${(eq.energy * 0.14).toFixed(3)})`;
          ctx.fillText(eq.text, eq.x, eq.y + 0.5);
        }
        ctx.fillStyle =
          eq.energy > 0.05
            ? `rgba(226, 232, 240, ${alpha.toFixed(3)})`
            : `rgba(148, 163, 184, ${alpha.toFixed(3)})`;
        ctx.fillText(eq.text, eq.x, eq.y);
      }

      if (hasActiveGlow) {
        rafRef.current = requestAnimationFrame(drawFrame);
      }
    };

    const scheduleDraw = () => {
      if (rafRef.current === null) {
        lastFrameTime = performance.now();
        rafRef.current = requestAnimationFrame(drawFrame);
      }
    };
    requestDrawRef.current = scheduleDraw;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(320, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      sceneRef.current = buildConstellationScene(width, height);
      drawFrame(performance.now());
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      requestDrawRef.current = null;
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
    requestDrawRef.current?.();
  };

  const handlePointerLeave = () => {
    pointerRef.current.active = false;
    requestDrawRef.current?.();
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`fixed inset-0 z-[100] bg-[#0b101b] text-slate-100 flex flex-col justify-between items-center px-6 py-10 overflow-hidden font-sans select-none transition-opacity duration-200 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle monochrome depth vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(30, 41, 59, 0.34) 0%, rgba(11, 16, 27, 0.96) 72%)',
        }}
      />

      {/* Interactive Constellation & Physics Equations Layer */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-[1]"
      />

      {/* Top minimal version hairline */}
      <div className="relative z-10 w-full max-w-2xl flex items-center justify-between text-[11px] font-mono tracking-[0.22em] text-slate-500 uppercase pointer-events-none">
        <span>HERMES · v2.1.0</span>
        <span className="hidden sm:inline">{t.dept_prop}</span>
      </div>

      {/* Center Minimalist Brand + Quote + Enter Button */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto py-8">
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.26em] text-slate-50 pl-[0.26em] leading-none">
          HERMES
        </h1>

        <div className="w-16 h-px bg-slate-700/80 my-5" />

        <p className="text-[11px] sm:text-xs font-mono tracking-[0.22em] uppercase text-slate-400">
          High Efficiency Rocket Motor Emulation System
        </p>

        {/* Classic Quote */}
        <div className="mt-10 mb-9 max-w-lg px-2 min-h-[68px] flex flex-col items-center justify-center">
          <p className="text-slate-300/90 italic text-xs sm:text-sm leading-relaxed font-serif">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-slate-500 font-mono text-[10px] tracking-[0.18em] uppercase mt-2">
            — {quote.author}
          </p>
        </div>

        {/* Minimalist Central Simulate Button with subtle hover reaction */}
        <button
          type="button"
          onClick={handleEnterApp}
          className="inline-flex items-center justify-center px-10 py-3 rounded-md bg-slate-100 text-slate-950 border border-slate-200/80 hover:bg-white hover:scale-[1.045] hover:shadow-xl hover:shadow-black/40 active:scale-[0.985] transition-all duration-200 ease-out font-mono text-xs sm:text-[13px] font-bold tracking-[0.24em] uppercase shadow-lg shadow-black/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Simulate
        </button>
      </div>

      {/* Bottom Institutional Mark */}
      <div className="relative z-10 flex items-center justify-center opacity-75 pointer-events-none">
        <img
          src={coheterosLogo}
          alt="COHETEROS"
          className="h-7 w-auto object-contain brightness-0 invert"
          draggable={false}
        />
      </div>
    </div>
  );
}
