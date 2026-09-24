import React from 'react';

interface NrLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const NrLogo: React.FC<NrLogoProps> = ({ size = 'md', className = '' }) => {
  const dimensions = {
    sm: { box: 28, text: 12 },
    md: { box: 38, text: 16 },
    lg: { box: 54, text: 24 }
  }[size];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={dimensions.box}
        height={dimensions.box}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md transition-transform duration-300 hover:scale-105"
        role="img"
        aria-label="Nomatic Remember Bulb Logo"
      >
        <defs>
          {/* Deep dark container gradient */}
          <linearGradient id="bulb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0B0F19" />
          </linearGradient>

          {/* Google Keep style warm golden/amber radiant gradient */}
          <linearGradient id="keep-bulb-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="35%" stopColor="#FBBF24" />
            <stop offset="80%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Inner reflection highlight */}
          <linearGradient id="bulb-glass-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Luminous aura glow filter */}
          <filter id="bulb-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Outer Squircle Container with Elevation */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="24"
          fill="url(#bulb-bg)"
          stroke="#334155"
          strokeWidth="2.5"
        />

        {/* Ambient Warm Backlight Halo */}
        <circle cx="50" cy="42" r="28" fill="#F59E0B" fillOpacity="0.15" />

        {/* Radiance spark rays (Google Note style inspiration) */}
        <line x1="50" y1="8" x2="50" y2="12" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <line x1="25" y1="18" x2="28.5" y2="21.5" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <line x1="75" y1="18" x2="71.5" y2="21.5" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

        {/* Main Bulb Body - Google Keep style dome and neck */}
        <path
          d="M 50 16
             C 36.7 16 26 26.7 26 40
             C 26 48.8 30.8 55.2 35.5 60.5
             C 36.8 62 37.5 63.5 37.5 65
             L 62.5 65
             C 62.5 63.5 63.2 62 64.5 60.5
             C 69.2 55.2 74 48.8 74 40
             C 74 26.7 63.3 16 50 16 Z"
          fill="url(#keep-bulb-gradient)"
          filter="url(#bulb-glow)"
        />

        {/* Gloss Sheen Reflection */}
        <path
          d="M 33 28 C 36 21 44 19 49 18 C 45 22 36 26 33 34 Z"
          fill="url(#bulb-glass-sheen)"
        />

        {/* Google Keep style inner filament loop */}
        <path
          d="M 43 51
             L 43 38
             C 43 34.2 46.1 31 50 31
             C 53.9 31 57 34.2 57 38
             L 57 51"
          stroke="#78350F"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {/* Filament horizontal bridge */}
        <path
          d="M 45 44 L 55 44"
          stroke="#78350F"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Screw Base Metal Threads */}
        <path
          d="M 39 70 L 61 70"
          stroke="#94A3B8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 41.5 75.5 L 58.5 75.5"
          stroke="#94A3B8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Bottom Contact Terminal */}
        <path
          d="M 46 79.5 C 46 82 47.8 83.5 50 83.5 C 52.2 83.5 54 82 54 79.5 Z"
          fill="#64748B"
        />
      </svg>
    </div>
  );
};
