import React, { useEffect, useState, useRef } from 'react';
import RollingNumber from './RollingNumber';

/**
 * Interactive Kinetic SVG Radial Progress Ring
 * Draws smoothly on page entry using stroke-dasharray and stroke-dashoffset with 700ms ease-out
 */
export default function RadialProgressRing({
  percentage = 88,
  duration = 700,
  size = 56,
  strokeWidth = 5,
  color = 'var(--color-accent)',
  className = ''
}) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  const clampedPct = Math.min(100, Math.max(0, percentage));
  const targetOffset = circumference - (clampedPct / 100) * circumference;

  useEffect(() => {
    let isCancelled = false;
    startTimeRef.current = null;
    setAnimatedOffset(circumference); // Start at 0% drawn

    const animate = (timestamp) => {
      if (isCancelled) return;
      if (!startTimeRef.current) startTimeRef.current = timestamp;

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth Ease-out Quartic
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentOffset = circumference - (clampedPct / 100) * circumference * easeProgress;

      setAnimatedOffset(currentOffset);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setAnimatedOffset(targetOffset);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [clampedPct, duration, circumference, targetOffset]);

  return (
    <div 
      className={`relative flex items-center justify-center group cursor-pointer select-none transition-transform duration-200 hover:scale-105 ${className}`}
      style={{ width: size, height: size }}
      title={`${Math.round(clampedPct)}% Goal Met`}
    >
      <svg 
        className="w-full h-full -rotate-90 transform filter drop-shadow-sm transition-all duration-300 group-hover:drop-shadow-md" 
        viewBox="0 0 60 60"
      >
        {/* Background Track Circle */}
        <circle 
          cx="30" 
          cy="30" 
          r={radius} 
          className="stroke-theme-border/60 dark:stroke-theme-surface" 
          strokeWidth={strokeWidth} 
          fill="transparent" 
        />
        {/* Animated Drawing Progress Circle */}
        <circle 
          cx="30" 
          cy="30" 
          r={radius} 
          stroke={color} 
          strokeWidth={strokeWidth} 
          strokeDasharray={circumference} 
          strokeDashoffset={animatedOffset} 
          strokeLinecap="round" 
          fill="transparent" 
          className="transition-colors duration-200" 
        />
      </svg>

      {/* Kinetic Centered Percentage Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <RollingNumber 
          value={clampedPct} 
          duration={duration}
          suffix="%" 
          className="text-[11px] font-extrabold font-mono-numbers text-theme-text group-hover:text-theme-accent transition-colors" 
        />
      </div>
    </div>
  );
}
