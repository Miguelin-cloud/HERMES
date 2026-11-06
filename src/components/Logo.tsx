import React from 'react';

interface LogoProps {
  size?: number | string;
  className?: string;
  theme?: 'light' | 'dark';
}

/**
 * HERMES v2.0 Aerospace Propulsion Emblem
 * Features:
 * - Winged Caduceus Rocket Ascending (Hermes wings)
 * - Orbital Star Burst & Velocity Rings
 * - Active Supersonic Thrust Plume (Golden / Orange / Blue plasma)
 */
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
        {/* Plasma Flame Plume */}
        <linearGradient id="hermesPlasmaFlame" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="80%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>

        {/* Metallic Hull Gradient */}
        <linearGradient id="hermesHullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="30%" stopColor="#a855f7" />
          <stop offset="70%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>

        {/* Wing Gold Accent Gradient */}
        <linearGradient id="hermesWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>

        {/* Ambient Radial Glows */}
        <radialGradient id="hermesStarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="hermesFlameGlow" cx="50%" cy="80%" r="40%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="100" cy="100" r="90" fill="url(#hermesStarGlow)" />
      <circle cx="100" cy="130" r="60" fill="url(#hermesFlameGlow)" />

      {/* Orbital Velocity Star Burst Ring */}
      <circle cx="100" cy="95" r="72" stroke="rgba(168, 85, 247, 0.35)" strokeWidth="1.5" strokeDasharray="6 4" />
      <circle cx="100" cy="95" r="82" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="12 6" />

      {/* 5-Point Propulsion Star Points in Background */}
      <path
        d="M100 15 L106 45 L135 30 L115 58 L142 75 L112 85 L120 115 L98 95 L75 115 L82 85 L52 75 L80 58 L60 30 L90 45 Z"
        fill="rgba(168, 85, 247, 0.12)"
        stroke="rgba(192, 132, 252, 0.3)"
        strokeWidth="1"
      />

      {/* Active Rocket Thrust Plasma Trail */}
      <path
        d="M88 122 Q100 188 100 192 Q100 188 112 122 Z"
        fill="url(#hermesPlasmaFlame)"
        className="animate-pulse"
      />
      <path
        d="M93 122 Q100 168 100 172 Q100 168 107 122 Z"
        fill="#fef08a"
      />

      {/* HERMES Winged Sandals Motif (Left & Right Wings) */}
      {/* Left Wing */}
      <path
        d="M82 92 C62 72 40 68 22 75 C32 90 48 100 78 108 C80 102 81 96 82 92 Z"
        fill="url(#hermesWingGrad)"
        stroke="#e9d5ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M78 82 C62 65 45 62 30 68 C38 80 52 88 76 95 Z"
        fill="rgba(56, 189, 248, 0.4)"
      />

      {/* Right Wing */}
      <path
        d="M118 92 C138 72 160 68 178 75 C168 90 152 100 122 108 C120 102 119 96 118 92 Z"
        fill="url(#hermesWingGrad)"
        stroke="#e9d5ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M122 82 C138 65 155 62 170 68 C162 80 148 88 124 95 Z"
        fill="rgba(56, 189, 248, 0.4)"
      />

      {/* Rocket Main Hull (Sleek Supersonic Nosecone & Body) */}
      <path
        d="M100 18 C116 52 120 80 120 112 L120 122 C120 124 118 126 116 126 L84 126 C82 126 80 124 80 122 L80 112 C80 80 84 52 100 18 Z"
        fill={theme === 'dark' ? '#0b0f19' : '#ffffff'}
        stroke="url(#hermesHullGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Spine line / Caduceus line */}
      <line
        x1="100"
        y1="38"
        x2="100"
        y2="120"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Orbiting Porthole / Gyro Core */}
      <circle
        cx="100"
        cy="65"
        r="12"
        fill="#020617"
        stroke="#38bdf8"
        strokeWidth="2.5"
      />
      <circle
        cx="100"
        cy="65"
        r="6"
        fill="#a855f7"
      />
      <circle
        cx="97"
        cy="62"
        r="2.5"
        fill="#ffffff"
      />

      {/* Lower Fins */}
      <path
        d="M80 102 L64 124 C64 125 66 126 68 126 L80 122 Z"
        fill="#38bdf8"
        stroke="#7dd3fc"
        strokeWidth="1.5"
      />
      <path
        d="M120 102 L136 124 C136 125 134 126 132 126 L120 122 Z"
        fill="#38bdf8"
        stroke="#7dd3fc"
        strokeWidth="1.5"
      />

      {/* Nozzle Bell Expansion Ring */}
      <path
        d="M84 126 L82 133 C82 134 83 135 85 135 L115 135 C117 135 118 134 118 133 L116 126 Z"
        fill="#334155"
        stroke="#cbd5e1"
        strokeWidth="1.8"
      />

      {/* Version Badge "2.0" Accent */}
      <rect x="85" y="98" width="30" height="12" rx="6" fill="#a855f7" />
      <text x="100" y="107" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900" fontFamily="monospace">v2.0</text>
    </svg>
  );
}

export function AppIcon({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-[32px] overflow-hidden shadow-[0_0_35px_rgba(168,85,247,0.4)] bg-gradient-to-b from-[#0f172a] via-[#090d1a] to-[#020617] border border-purple-500/50 p-3 ${className}`} style={{ width: size, height: size }}>
      {/* Ambient glowing flame light */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(168,85,247,0.25),transparent_70%)] pointer-events-none animate-pulse" />
      <Logo size={size * 0.8} className="relative z-10" theme="dark" />
    </div>
  );
}
