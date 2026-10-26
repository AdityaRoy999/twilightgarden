import React, { useId } from 'react';
import { Heart, BellRing, Palette } from './Icons';

/** Local vector artwork, kept decorative and separate from health data. */
export function ReferenceArt({ kind = 'clipboard', className = '' }: { kind?: 'clipboard' | 'moon' | 'leaves' | 'hearts' | 'bell' | 'palette'; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`reference-art ${className}`} viewBox="0 0 240 190" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-petal`} x1="20" y1="20" x2="220" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="var(--art-petal-start, #ffd6e3)"/><stop offset="1" stopColor="var(--art-petal-end, #ff8faf)"/></linearGradient><linearGradient id={`${id}-rose`} x1="80" y1="30" x2="160" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="var(--art-rose-start, #ff9bb8)"/><stop offset="1" stopColor="var(--art-rose-end, #f55c8f)"/></linearGradient></defs>
    <path d="M30 115C7 67 67 67 87 32C113-8 179 7 190 52C201 97 244 94 218 144C186 200 65 192 30 115Z" fill="var(--art-wash, #fff0f5)"/>
    <g stroke="#ffb3cd" strokeWidth="2"><path d="M65 174Q48 140 35 115M178 175Q195 136 208 101"/><path d="M61 162C28 160 16 138 20 126C45 126 60 142 61 162ZM51 143C28 121 32 107 32 107C54 112 59 128 51 143ZM185 156C185 124 202 109 214 108C220 133 198 151 185 156ZM178 174C203 150 219 151 225 156C213 176 192 179 178 174Z" fill={`url(#${id}-petal)`} stroke="none"/></g>
    {kind === 'clipboard' && <><rect x="75" y="48" width="91" height="113" rx="14" fill={`url(#${id}-petal)`}/><rect x="96" y="38" width="49" height="16" rx="4" fill="#ff9ebc"/><path d="M114 39V34A7 7 0 0 1 128 34V39" stroke="#ffc8da" strokeWidth="5"/>{[77, 101, 125].map(y => <rect key={y} x="92" y={y} width="58" height="10" rx="5" fill="var(--art-detail, #ffb5cc)"/>)}</>}
    {kind === 'moon' && <><path d="M153 31C108 30 87 80 109 113C127 144 165 142 181 122C133 127 119 71 153 31Z" fill={`url(#${id}-rose)`}/><path d="M91 163C72 160 76 139 91 139C89 117 113 109 126 122C134 100 167 105 170 130C196 124 207 157 184 166Z" fill="white"/></>}
    {kind === 'leaves' && <g transform="translate(60 -10)" stroke="#ffb1ca" strokeWidth="2"><path d="M87 193C69 150 35 104 55 41"/><path d="M66 141C14 130 9 91 9 91C52 93 73 116 66 141ZM57 107C97 91 107 54 107 54C65 59 48 81 57 107ZM49 76C19 52 29 17 29 17C62 35 61 59 49 76Z" fill={`url(#${id}-petal)`} stroke="none"/></g>}
    {kind === 'hearts' && <g color="var(--art-rose-end, #f55c8f)"><g transform="translate(59 46) rotate(-18 36 36)"><Heart size={72} fill="currentColor" strokeWidth={1}/></g><g transform="translate(124 92) rotate(18 28 28)"><Heart size={56} fill="currentColor" strokeWidth={1}/></g></g>}
    {kind === 'bell' && <g transform="translate(76 48)" color="var(--art-rose-end, #f55c8f)"><BellRing size={100} strokeWidth={1.4}/></g>}
    {kind === 'palette' && <g transform="translate(76 48)" color="var(--art-rose-end, #f55c8f)"><Palette size={100} strokeWidth={1.4}/></g>}
    <g fill="#ff9bb9"><path d="m42 68 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM194 38l3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM207 77l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><circle cx="62" cy="106" r="2.5"/><circle cx="184" cy="66" r="2"/></g>
  </svg>;
}

export function ReferenceHeading({ title, description, action, back, onBack }: { title: string; description?: string; action?: React.ReactNode; back?: boolean; onBack?: () => void }) {
  const headingArt = /games/i.test(title) ? 'hearts' : /notification/i.test(title) ? 'bell' : /theme|color/i.test(title) ? 'palette' : 'leaves';
  return <header className={`reference-heading ${back ? 'has-back' : ''}`}><ReferenceArt kind={headingArt} className="reference-heading-art"/>{back && <button className="reference-back" onClick={onBack} aria-label="Back"><svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}<div className="reference-heading-row"><h1>{title}</h1>{action}</div>{description && <p>{description}</p>}</header>;
}
