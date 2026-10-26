import React, { useEffect, useState, useRef } from 'react';

/**
 * Rolling Counter Component
 * Smoothly interpolates numbers from 0 to their actual target value over 700ms
 * using a high-precision ease-out quartic curve: 1 - (1 - t)^4
 */
export default function RollingNumber({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = ''
}) {
  const numericTarget = typeof value === 'number' ? value : parseFloat(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    const startVal = 0;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (isCancelled) return;
      if (!startTimeRef.current) startTimeRef.current = timestamp;

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth Quartic Ease-Out curve for fluid deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (numericTarget - startVal) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericTarget);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [numericTarget, duration]);

  const formatted = decimals > 0 
    ? displayValue.toFixed(decimals) 
    : Math.round(displayValue).toString();

  return (
    <span className={`font-mono-numbers tabular-nums inline-block transition-transform duration-75 ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
