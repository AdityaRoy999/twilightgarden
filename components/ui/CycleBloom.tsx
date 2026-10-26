import React, { useId } from 'react';
import { Droplet } from 'lucide-react';

/** A lightweight cycle illustration; values always come from the cycle model. */
export function CycleBloom({ day, length, hasEstimate = true }: { day: number; length: number; hasEstimate?: boolean }) {
  const id = useId().replace(/:/g, '');
  const fraction = Math.max(0, Math.min(1, day / Math.max(1, length)));
  return <div className="cycle-bloom" role="img" aria-label={hasEstimate ? `Cycle day ${day} of an estimated ${length} days` : 'No cycle estimate yet'}>
    <svg viewBox="0 0 280 280" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rose`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff92aa"/><stop offset="1" stopColor="#f24783"/></linearGradient>
        <linearGradient id={`${id}-coral`}><stop stopColor="#ffb0a4"/><stop offset="1" stopColor="#ff758f"/></linearGradient>
        <linearGradient id={`${id}-center`} x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#fff2f6"/><stop offset="1" stopColor="#ffdce8"/></linearGradient>
        <clipPath id={`${id}-clip`}><circle cx="140" cy="140" r="95"/></clipPath>
      </defs>
      <circle cx="140" cy="140" r="119" fill="none" stroke="var(--cycle-track)" strokeWidth="19"/>
      <g transform="rotate(-90 140 140)" fill="none" strokeWidth="19" strokeLinecap="round">
        <circle cx="140" cy="140" r="119" stroke={`url(#${id}-rose)`} pathLength="100" strokeDasharray="21 79"/>
        <circle cx="140" cy="140" r="119" stroke="var(--cycle-lavender)" pathLength="100" strokeDasharray="8 92" strokeDashoffset="-24"/>
        <circle cx="140" cy="140" r="119" stroke={`url(#${id}-coral)`} pathLength="100" strokeDasharray="36 64" strokeDashoffset="-36"/>
      </g>
      <circle cx="140" cy="140" r="95" fill={`url(#${id}-center)`}/>
      <path d="M36 165 Q85 125 140 165 T250 165 V250 H30Z" fill="#fbc5d8" opacity=".38" clipPath={`url(#${id}-clip)`}/>
      {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={140 + Math.cos((-73 + i * 14) * Math.PI / 180) * 119} cy={140 + Math.sin((-73 + i * 14) * Math.PI / 180) * 119} r="3.2" fill="white" opacity=".6"/>)}
      {hasEstimate && <circle cx={140 + Math.cos((fraction * 360 - 90) * Math.PI / 180) * 119} cy={140 + Math.sin((fraction * 360 - 90) * Math.PI / 180) * 119} r="15" fill="var(--bg-surface)" stroke="#ffb8cf" strokeWidth="2.5"/>}
    </svg>
    <div className="cycle-bloom-label"><Droplet size={20} fill="currentColor" strokeWidth={1.5}/><span>{hasEstimate ? 'Day' : 'Your cycle'}</span><strong>{hasEstimate ? day : '—'}</strong><span>{hasEstimate ? `of ${length}` : 'One day at a time'}</span></div>
  </div>;
}

export function BotanicalSprig({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 150 190" fill="none" aria-hidden="true"><path d="M80 190C87 138 55 95 87 32" stroke="currentColor" strokeWidth="2"/><path d="M79 153C24 153 20 112 20 112C62 109 83 130 79 153ZM77 121C119 114 135 79 135 79C93 77 71 96 77 121ZM75 88C35 73 41 34 41 34C78 44 85 65 75 88ZM83 59C118 46 115 9 115 9C84 17 78 37 83 59Z" fill="currentColor" opacity=".45"/></svg>;
}
