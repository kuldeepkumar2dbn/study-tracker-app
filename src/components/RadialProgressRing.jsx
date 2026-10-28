import React from 'react';

/**
 * Self-contained Radial Progress Ring component
 * Accepts either `progress` or `percentage`, and either `strokeColor` or `color`
 */
export function RadialProgressRing({ 
  progress, 
  percentage, 
  size = 64, 
  strokeWidth = 6, 
  strokeColor = "#6366F1",
  color,
  className = ""
}) {
  const actualVal = progress !== undefined ? progress : (percentage !== undefined ? percentage : 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const activeColor = color || strokeColor || "#6366F1";
  const offset = circumference - (Math.min(100, Math.max(0, actualVal)) / 100) * circumference;

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`} 
      style={{ width: size, height: size }}
      title={`${Math.round(actualVal)}%`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-700/30 dark:stroke-theme-surface stroke-theme-border/60"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-theme-text font-mono-numbers">{Math.round(actualVal)}%</span>
    </div>
  );
}

export default RadialProgressRing;
