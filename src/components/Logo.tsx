import React from 'react';

interface LogoProps {
  size?: number | string;
  className?: string;
  theme?: 'light' | 'dark';
}

export function Logo({ size = 48, className = '', theme = 'dark' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Active Engine Fire Plume Gradient */}
        <linearGradient id="activeFire" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#f97316" />
          <stop offset="70%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="fireGlow" cx="50%" cy="75%" r="45%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bodyGlow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Radial ambient glow */}
      <circle cx="100" cy="110" r="70" fill="url(#fireGlow)" />
      <circle cx="100" cy="80" r="60" fill="url(#bodyGlow)" />

      {/* Active Rocket Fire Plume (Minimalist & Energetic) */}
      <path
        d="M92 120 L100 175 L108 120 Z"
        fill="url(#activeFire)"
        className="animate-pulse"
      />
      <path
        d="M95 120 L100 160 L105 120 Z"
        fill="#fef08a"
      />

      {/* Rocket Main Body (Sleek Minimalist Vector) */}
      <path
        d="M100 25 C114 55 118 78 118 108 L118 120 C118 122 116 124 114 124 L86 124 C84 124 82 122 82 120 L82 108 C82 78 86 55 100 25 Z"
        fill={theme === 'dark' ? '#0f172a' : '#ffffff'}
        stroke="url(#activeFire)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center structural spine */}
      <line
        x1="100"
        y1="85"
        x2="100"
        y2="120"
        stroke="#a855f7"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Circular Viewport Window */}
      <circle
        cx="100"
        cy="65"
        r="10"
        fill="#38bdf8"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      <circle
        cx="97"
        cy="62"
        r="3"
        fill="#ffffff"
        opacity="0.8"
      />

      {/* Left Aerodynamic Fin */}
      <path
        d="M82 95 C70 102 65 112 63 123 C72 123 79 121 82 117 Z"
        fill="#a855f7"
        stroke="#c084fc"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Right Aerodynamic Fin */}
      <path
        d="M118 95 C130 102 135 112 137 123 C128 123 121 121 118 117 Z"
        fill="#a855f7"
        stroke="#c084fc"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Nozzle Base */}
      <path
        d="M86 124 L84 130 C84 131 85 132 87 132 L113 132 C115 132 116 131 116 130 L114 124 Z"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="2"
      />
    </svg>
  );
}

export function AppIcon({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-[32px] overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-gradient-to-b from-[#0f172a] via-[#090d1a] to-[#020617] border border-purple-500/40 p-3 ${className}`} style={{ width: size, height: size }}>
      {/* Ambient glowing flame light */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(249,115,22,0.2),transparent_70%)] pointer-events-none animate-pulse" />
      <Logo size={size * 0.75} className="relative z-10" theme="dark" />
    </div>
  );
}
