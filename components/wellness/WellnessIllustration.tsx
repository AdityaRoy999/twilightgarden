import React from 'react';
import { getWellnessIllustration } from '../../lib/wellnessGuide';
import { useTheme } from '../../contexts/ThemeContext';

/** Fixed dimensions reserve layout space; only the visible subjects are loaded. */
export function WellnessIllustration({ id, className = '', decorative = false, eager = false }: { id: string; className?: string; decorative?: boolean; eager?: boolean }) {
  const art = getWellnessIllustration(id);
  const { theme } = useTheme();
  return <img className={`wellness-illustration ${className}`} src={theme === 'dark' && art.darkSrc ? art.darkSrc : art.src} alt={decorative ? '' : art.label} aria-hidden={decorative || undefined} width="360" height="320" loading={eager ? 'eager' : 'lazy'} decoding="async" data-illustration={art.id}/>;
}
