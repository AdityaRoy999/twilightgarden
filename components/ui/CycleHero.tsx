import React, { useId } from 'react';

/** The reference's softly undulating card edge, drawn once for both roles. */
export function CycleHero({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <section className={`bloom-cycle-hero ${className}`}>
    <svg className="cycle-hero-frame" viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={`${id}-hero`} x2="1" y2="1"><stop stopColor="var(--hero-start)"/><stop offset="1" stopColor="var(--hero-end)"/></linearGradient></defs>
      <path d="M1 56C1 25 22 13 55 15C180 12 271 32 383 16C511-4 594 3 738 21C780 26 799 40 799 73V315Q799 359 755 359H45Q1 359 1 315Z" fill={`url(#${id}-hero)`} stroke="var(--hero-edge)" strokeWidth="1.2"/>
    </svg>
    {children}
  </section>;
}
