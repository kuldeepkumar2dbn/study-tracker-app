import React from 'react';

export function LogoMark({ size = 38, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Study & Skill Tracker Logo"
    >
      <defs>
        {/* Core Ascent Gradient (Indigo to Blue to Emerald) */}
        <linearGradient id="stLogoGrad1" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Dynamic Orbital Swoop Gradient */}
        <linearGradient id="stOrbitGrad" x1="10" y1="42" x2="56" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>

        {/* Peak Spark Gradient */}
        <linearGradient id="stStarGrad" x1="42" y1="3" x2="49" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Open Book Foundation Pages */}
      <path
        d="M 8 50 C 18 50 26 46 32 42 C 38 46 46 50 56 50 C 56 53 46 56 32 53 C 18 56 8 53 8 50 Z"
        fill="url(#stLogoGrad1)"
        opacity="0.85"
      />
      <path
        d="M 8 45 C 18 45 26 41 32 37 L 32 42 C 26 46 18 50 8 50 Z"
        fill="#4f46e5"
        opacity="0.65"
      />
      <path
        d="M 56 45 C 46 45 38 41 32 37 L 32 42 C 38 46 46 50 56 50 Z"
        fill="#10b981"
        opacity="0.65"
      />

      {/* Ascending Progress Staircase Bars */}
      <rect x="18" y="32" width="7" height="15" rx="2" fill="url(#stLogoGrad1)" />
      <rect x="28.5" y="22" width="7" height="25" rx="2" fill="url(#stLogoGrad1)" />
      <rect x="39" y="12" width="7" height="35" rx="2" fill="url(#stLogoGrad1)" />

      {/* Swooping Orbit Gradient Arc */}
      <path
        d="M 10 36 C 10 18 30 10 50 16 C 56 18 58 24 54 30 C 46 40 22 46 12 40"
        stroke="url(#stOrbitGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.95"
      />

      {/* 4-Pointed Spark Star at Peak */}
      <path
        d="M 42.5 3 Q 42.5 8.5 48 8.5 Q 42.5 8.5 42.5 14 Q 42.5 8.5 37 8.5 Q 42.5 8.5 42.5 3 Z"
        fill="url(#stStarGrad)"
      />
      <circle cx="42.5" cy="8.5" r="1.2" fill="#ffffff" />
    </svg>
  );
}

export default function Logo({ onClick }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Study Tracker - Back to Overview"
      className="flex items-center space-x-2.5 cursor-pointer group select-none focus:outline-none transition-transform duration-200 active:scale-95"
    >
      <div className="relative group-hover:scale-105 transition-transform duration-200">
        <LogoMark size={38} />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-black text-base sm:text-lg tracking-tight text-theme-text leading-tight group-hover:text-theme-accent transition-colors">
            STUDY <span className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 bg-clip-text text-transparent">TRACKER</span>
          </span>
          <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
            PRO
          </span>
        </div>
        <span className="hidden md:block text-[10px] text-theme-muted font-medium -mt-0.5 tracking-wide">
          Personal Daily Study & Skill Tracker
        </span>
      </div>
    </div>
  );
}
