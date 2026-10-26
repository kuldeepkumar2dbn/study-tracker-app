import React from 'react';

/**
 * AnimatedHeadline
 * Renders an animated typographic headline where characters smoothly fade-in and slide up
 * with staggered delays, giving a kinetic, premium feel identical to the Dashboard banner.
 */
export default function AnimatedHeadline({ 
  text, 
  className = '', 
  as: Component = 'h1',
  delayStep = 18
}) {
  if (!text) return null;

  return (
    <Component className={`flex flex-wrap gap-x-1.5 ${className}`}>
      {text.split(' ').map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap">
          {word.split('').map((char, charIndex) => {
            const delay = (wordIndex * 5 + charIndex) * delayStep;
            return (
              <span 
                key={charIndex} 
                className="letter-fade-in"
                style={{ animationDelay: `${delay}ms` }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </Component>
  );
}
