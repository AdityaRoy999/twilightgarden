import React, { useId } from 'react';
import { Heart, BellRing, Palette, AppIcon } from './Icons';
import {BotanicalBranch} from './BotanicalBranch';

/** Local vector artwork, kept decorative and separate from health data. */
export function ReferenceArt({ kind = 'clipboard', className = '' }: { kind?: 'clipboard' | 'moon' | 'leaves' | 'hearts' | 'bell' | 'palette'; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`reference-art ${className}`} viewBox="0 0 240 190" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-petal`} x1="20" y1="20" x2="220" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="var(--art-petal-start, #ffd6e3)"/><stop offset="1" stopColor="var(--art-petal-end, #ff8faf)"/></linearGradient><linearGradient id={`${id}-rose`} x1="80" y1="30" x2="160" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="var(--art-rose-start, #ff9bb8)"/><stop offset="1" stopColor="var(--art-rose-end, #f55c8f)"/></linearGradient></defs>
    <path d="M30 115C7 67 67 67 87 32C113-8 179 7 190 52C201 97 244 94 218 144C186 200 65 192 30 115Z" fill="var(--art-wash, #fff0f5)"/>
    <BotanicalBranch transform="translate(7 70) rotate(-18 40 90) scale(.55)" stem="var(--art-petal-end, #ff8faf)" leaf={`url(#${id}-petal)`} opacity={1}/>
    <BotanicalBranch transform="translate(151 72) rotate(20 40 90) scale(.55)" stem="var(--art-petal-end, #ff8faf)" leaf={`url(#${id}-petal)`} opacity={1}/>
    {kind === 'clipboard' && <><rect x="75" y="48" width="91" height="113" rx="14" fill={`url(#${id}-petal)`}/><rect x="96" y="38" width="49" height="16" rx="4" fill="#ff9ebc"/><path d="M114 39V34A7 7 0 0 1 128 34V39" stroke="#ffc8da" strokeWidth="5"/>{[77, 101, 125].map(y => <rect key={y} x="92" y={y} width="58" height="10" rx="5" fill="var(--art-detail, #ffb5cc)"/>)}</>}
    {kind === 'moon' && <><path d="M153 31C108 30 87 80 109 113C127 144 165 142 181 122C133 127 119 71 153 31Z" fill={`url(#${id}-rose)`}/><path d="M91 163C72 160 76 139 91 139C89 117 113 109 126 122C134 100 167 105 170 130C196 124 207 157 184 166Z" fill="white"/></>}
    {kind === 'leaves' && <BotanicalBranch transform="translate(60 -2)" stem="var(--art-petal-end, #ff8faf)" leaf={`url(#${id}-petal)`} opacity={1}/>}
    {kind === 'hearts' && <g color="var(--art-rose-end, #f55c8f)"><g transform="translate(59 46) rotate(-18 36 36)"><Heart size={72} fill="currentColor" strokeWidth={1}/></g><g transform="translate(124 92) rotate(18 28 28)"><Heart size={56} fill="currentColor" strokeWidth={1}/></g></g>}
    {kind === 'bell' && <g transform="translate(76 48)" color="var(--art-rose-end, #f55c8f)"><BellRing size={100} strokeWidth={1.4}/></g>}
    {kind === 'palette' && <g transform="translate(76 48)" color="var(--art-rose-end, #f55c8f)"><Palette size={100} strokeWidth={1.4}/></g>}
    <g fill="#ff9bb9"><path d="m42 68 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM194 38l3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM207 77l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><circle cx="62" cy="106" r="2.5"/><circle cx="184" cy="66" r="2"/></g>
  </svg>;
}

export function ReferenceHeading({ title, description, action, back, onBack }: { title: string; description?: string; action?: React.ReactNode; back?: boolean; onBack?: () => void }) {
  const headingArt = /games/i.test(title) ? 'hearts' : /notification/i.test(title) ? 'bell' : /theme|color/i.test(title) ? 'palette' : 'leaves';
  return <header className={`reference-heading ${back ? 'has-back' : ''}`}><ReferenceArt kind={headingArt} className="reference-heading-art"/>{back && <button className="reference-back" onClick={onBack} aria-label="Back"><AppIcon name="arrow_back" size={24}/></button>}<div className="reference-heading-row"><h1>{title}</h1>{action}</div>{description && <p>{description}</p>}</header>;
}
