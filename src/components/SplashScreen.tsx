import React, { useEffect, useState, useRef } from 'react';
import { AppIcon } from './Logo';
import { translations, Language } from '../lib/i18n';

const QUOTES = [
  { text: "The Earth is the cradle of humanity, but mankind cannot stay in the cradle forever.", author: "Konstantin Tsiolkovsky" },
  { text: "To confine our attention to terrestrial matters would be to limit the human spirit.", author: "Stephen Hawking" },
  { text: "Once you have tasted flight, you will forever walk the earth with your eyes turned skyward.", author: "Leonardo da Vinci" },
  { text: "That's one small step for man, one giant leap for mankind.", author: "Neil Armstrong" },
  { text: "Spaceflight will never tolerate carelessness, incapacity, and neglect.", author: "Gene Kranz" },
  { text: "There is no sound in space, but the roar of a rocket makes up for it.", author: "Unknown" },
  { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke" },
  { text: "If we can conquer space, we can conquer childhood hunger.", author: "Buzz Aldrin" },
];

/**
 * Animated High-Tech Algorithmic Labyrinth & Rocket Telemetry Background.
 * Pure HTML5 Canvas & SVG - 100% offline & standalone, eliminates Electron image file path errors.
 */
function AlgorithmicLabyrinthCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Nodes for Differential Evolution / Labyrinth network
    const cols = Math.max(12, Math.floor(width / 90));
    const rows = Math.max(8, Math.floor(height / 90));
    const nodes: { x: number; y: number; vx: number; vy: number; radius: number; phase: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          x: (c + 0.5) * (width / cols) + (Math.random() - 0.5) * 25,
          y: (r + 0.5) * (height / rows) + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: 1.5 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Telemetry pulses navigating the labyrinth
    const pulses: { from: number; to: number; progress: number; speed: number; color: string }[] = [];
    const colors = ['rgba(168, 85, 247, ', 'rgba(56, 189, 248, ', 'rgba(52, 211, 153, '];

    const createPulse = () => {
      if (nodes.length < 2) return;
      const from = Math.floor(Math.random() * nodes.length);
      const fromNode = nodes[from];
      let closest = -1;
      let minDist = Infinity;
      nodes.forEach((n, idx) => {
        if (idx !== from) {
          const dx = n.x - fromNode.x;
          const dy = n.y - fromNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && dist > 20 && dist < minDist) {
            minDist = dist;
            closest = idx;
          }
        }
      });

      if (closest !== -1) {
        pulses.push({
          from,
          to: closest,
          progress: 0,
          speed: 0.015 + Math.random() * 0.02,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    let tick = 0;

    const render = () => {
      tick += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Deep radial vignette backdrop
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) * 0.8);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#040711');
      bgGrad.addColorStop(1, '#02040a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle labyrinth grid lines
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.06)';
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update and draw nodes
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 10 || node.x > width - 10) node.vx *= -1;
        if (node.y < 10 || node.y > height - 10) node.vy *= -1;

        const alpha = 0.3 + 0.3 * Math.sin(tick + node.phase);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fill();
      });

      // Draw vector connection mesh lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineAlpha = (1 - dist / 140) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Spawn pulses randomly
      if (Math.random() < 0.2 && pulses.length < 35) {
        createPulse();
      }

      // Render traveling pulse telemetry packets
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulses.splice(p, 1);
          continue;
        }

        const n1 = nodes[pulse.from];
        const n2 = nodes[pulse.to];
        if (!n1 || !n2) continue;

        const px = n1.x + (n2.x - n1.x) * pulse.progress;
        const py = n1.y + (n2.y - n1.y) * pulse.progress;

        const pulseGlow = ctx.createRadialGradient(px, py, 0, px, py, 12);
        pulseGlow.addColorStop(0, pulse.color + '0.9)');
        pulseGlow.addColorStop(0.5, pulse.color + '0.4)');
        pulseGlow.addColorStop(1, pulse.color + '0)');

        ctx.fillStyle = pulseGlow;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw central holographic rocket nozzle/chamber telemetry outline
      const cx = width / 2;
      const cy = height / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // Rocket chamber contour
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);

      // Chamber body
      ctx.strokeRect(-180, -90, 200, 180);

      // Nozzle convergence/divergence
      ctx.beginPath();
      ctx.moveTo(20, -90);
      ctx.lineTo(60, -30);
      ctx.lineTo(160, -110);
      ctx.moveTo(20, 90);
      ctx.lineTo(60, 30);
      ctx.lineTo(160, 110);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />;
}

export function SplashScreen({ lang, onComplete }: { lang: Language; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const t = translations[lang];

  useEffect(() => {
    const duration = 2000;
    const interval = 20;
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, Math.floor((step / steps) * 100)));
      if (step >= steps) {
        clearInterval(timer);
        setTimeout(onComplete, 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* 100% Self-contained High-Tech Algorithmic Labyrinth & Telemetry Canvas Background (No image files = Zero Electron path errors!) */}
      <AlgorithmicLabyrinthCanvas />

      {/* Futuristic Ambient Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.85)_100%)] pointer-events-none" />

      {/* Content Container (Floating with high-contrast glowing typography) */}
      <div className="relative z-10 flex flex-col items-center max-w-xl w-full px-6 text-center">
        
        {/* Glowing App Icon with active flame */}
        <div className="mb-6 relative hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-x-0 bottom-0 top-6 rounded-[32px] bg-purple-500/40 blur-3xl animate-pulse" />
          <div className="absolute inset-x-0 bottom-[-20px] h-12 bg-emerald-500/30 blur-xl animate-pulse" />
          <AppIcon size={120} className="relative z-10 shadow-[0_0_35px_rgba(168,85,247,0.7)]" />
        </div>

        {/* Title and Version Badge */}
        <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-slate-100 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] font-mono">
            HERMES SIMULATOR
          </h1>
          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-mono text-xs font-extrabold border border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]">
            v2.0
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-purple-300 font-mono tracking-widest text-xs sm:text-sm uppercase mb-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] font-black">
          High Efficiency Rocket Motor Emulation System
        </p>

        {/* Quote Section */}
        <div className="h-16 flex flex-col items-center justify-center mb-8 px-4">
          <p className="text-slate-100 italic text-xs sm:text-base font-serif mb-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            "{quote.text}"
          </p>
          <p className="text-emerald-400 font-mono text-[10px] sm:text-xs tracking-widest uppercase font-bold drop-shadow">
            — {quote.author}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950/90 h-3.5 rounded-full overflow-hidden mb-3 border border-emerald-500/40 shadow-[0_0_20px_rgba(0,0,0,0.9)] backdrop-blur-md p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 via-emerald-500 to-cyan-400 shadow-[0_0_20px_rgba(52,211,153,0.9)] transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading Sub and Percentage */}
        <div className="flex justify-between w-full text-xs text-slate-200 font-mono drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] font-bold">
          <span className="text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
            {t.loading_sub}
          </span>
          <span className="text-cyan-300">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
