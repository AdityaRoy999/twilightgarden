import React, { useId } from 'react';

/** Original decorative scenes, independent of live health data and dashboard controls. */
export function WelcomeIllustration({ kind }: { kind: 'cycle' | 'care' | 'together' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 400 300" fill="none" aria-hidden="true" focusable="false" data-welcome-scene={kind}>
    <defs><linearGradient id={`${id}-rose`} x1="70" y1="30" x2="300" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="var(--welcome-rose-light)"/><stop offset="1" stopColor="var(--welcome-rose)"/></linearGradient><linearGradient id={`${id}-lilac`} x1="100" y1="70" x2="300" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="var(--welcome-lilac-light)"/><stop offset="1" stopColor="var(--welcome-lilac)"/></linearGradient></defs>
    <ellipse cx="203" cy="269" rx="142" ry="15" fill="var(--welcome-ground)"/>
    <circle cx="205" cy="146" r="118" fill="var(--welcome-wash)"/>
    <Sprig x={32} y={131} rotate={-18}/><Sprig x={324} y={157} rotate={20}/>
    {kind === 'cycle' ? <>
      <g transform="rotate(-8 159 157)"><rect x="83" y="79" width="161" height="175" rx="25" fill="var(--welcome-paper)"/><path d="M83 104a25 25 0 0 1 25-25h111a25 25 0 0 1 25 25v25H83Z" fill={`url(#${id}-rose)`}/><path d="M118 67v29m91-29v29" stroke="var(--welcome-stem)" strokeWidth="10" strokeLinecap="round"/>{[0,1,2].map(row => [0,1,2,3].map(col => <rect key={`${row}-${col}`} x={104+col*32} y={147+row*29} width="17" height="13" rx="5" fill={row===1&&col===1?'var(--welcome-rose)':'var(--welcome-track)'}/>))}<path d="m144 183 5 5 9-11" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></g>
      <circle cx="270" cy="185" r="63" fill="var(--welcome-paper)"/><circle cx="270" cy="185" r="47" stroke="var(--welcome-track)" strokeWidth="10"/><path d="M270 138a47 47 0 0 1 44 63" stroke={`url(#${id}-rose)`} strokeWidth="10" strokeLinecap="round"/><path d="M299 222a47 47 0 0 1-71-19" stroke={`url(#${id}-lilac)`} strokeWidth="10" strokeLinecap="round"/><path d="M270 161c-4 8-15 17-15 26a15 15 0 0 0 30 0c0-9-11-18-15-26Z" fill={`url(#${id}-rose)`}/><path d="M262 187q-1 7 5 9" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <Flower x={303} y={74}/><Heart x={61} y={91} size={18}/>
    </> : kind === 'care' ? <>
      <path d="M108 185c0-36 14-65 61-65s59 38 51 70l-15 49h-89Z" fill="var(--welcome-hair)"/>
      <path d="M112 190q47-27 96 0l13 63H99Z" fill={`url(#${id}-rose)`}/>
      <path d="M139 178v18q20 16 33 0v-18" fill="var(--welcome-skin)"/><ellipse cx="155" cy="148" rx="35" ry="43" fill="var(--welcome-skin)"/>
      <path d="M118 143c-3-43 17-60 48-52 28 7 35 26 26 59-6-27-29-21-43-36-6 17-18 24-31 29Z" fill="var(--welcome-hair)"/><path d="M136 152q4 5 8 0m22 0q4 5 8 0m-30 17q11 9 22 0" stroke="var(--welcome-ink)" strokeWidth="2.5" strokeLinecap="round"/><ellipse cx="133" cy="162" rx="6" ry="3" fill="var(--welcome-blush)"/><ellipse cx="178" cy="162" rx="6" ry="3" fill="var(--welcome-blush)"/>
      <rect x="210" y="112" width="102" height="128" rx="15" transform="rotate(8 210 112)" fill={`url(#${id}-lilac)`}/><rect x="219" y="128" width="72" height="91" rx="9" transform="rotate(8 219 128)" fill="var(--welcome-paper)"/><path d="m235 161 5 6 10-12m-17 32 5 6 10-12m7-18 18 3m-21 23 18 3" stroke="var(--welcome-lilac)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M120 217q23 18 48 12m25-12q-14 14-25 12" stroke="var(--welcome-skin)" strokeWidth="17" strokeLinecap="round"/><path d="M153 207h29v20a12 12 0 0 1-24 0Z" fill="var(--welcome-paper)"/><path d="M182 210c18-4 18 18-1 14" stroke="var(--welcome-paper)" strokeWidth="5"/><path d="M165 195q-7-8 0-16m10 13q-6-7 0-13" stroke="var(--welcome-rose)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M264 68a23 23 0 0 1-23-29 24 24 0 1 0 23 29Z" fill="var(--welcome-lilac)"/><Flower x={87} y={72}/>
    </> : <>
      <path d="M78 267v-54q0-35 45-35t45 35v54" fill={`url(#${id}-lilac)`}/><path d="M231 267v-54q0-35 45-35t45 35v54" fill={`url(#${id}-rose)`}/>
      <path d="M108 171v21q16 13 31 0v-21m120 0v21q16 13 31 0v-21" fill="var(--welcome-skin)"/>
      <ellipse cx="123" cy="145" rx="32" ry="39" fill="var(--welcome-skin)"/><ellipse cx="276" cy="145" rx="32" ry="39" fill="var(--welcome-skin)"/>
      <path d="M90 145c-9-36 9-60 34-54 27-3 42 21 32 58-5-21-28-15-40-31-5 12-16 20-26 27Z" fill="var(--welcome-hair)"/><path d="M242 140c-9-40 17-60 44-48 26 7 33 25 25 57-13-3-23-13-26-25-11 13-27 16-43 16Z" fill="var(--welcome-hair)"/>
      <g stroke="var(--welcome-ink)" strokeWidth="2.5" strokeLinecap="round"><path d="M108 148h1m27 0h1m-24 17q11 10 22 0m126-17h1m27 0h1m-24 17q11 10 22 0"/></g>
      <path d="M151 218q48 42 97 0" stroke="var(--welcome-skin)" strokeWidth="17" strokeLinecap="round"/>
      <path d="M133 37h74a16 16 0 0 1 16 16v31a16 16 0 0 1-16 16h-42l-19 15V100h-13a16 16 0 0 1-16-16V53a16 16 0 0 1 16-16Z" fill="var(--welcome-paper)"/><Heart x={152} y={53} size={31}/>
      <path d="M248 56h46a14 14 0 0 1 14 14v22a14 14 0 0 1-14 14h-4v13l-17-13h-25a14 14 0 0 1-14-14V70a14 14 0 0 1 14-14Z" fill={`url(#${id}-lilac)`}/><path d="m256 81 9 9 17-19" stroke="var(--welcome-paper)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <Heart x={190} y={153} size={25}/>
    </>}
  </svg>;
}

function Heart({x,y,size}:{x:number;y:number;size:number}) { return <path transform={`translate(${x} ${y}) scale(${size/32})`} d="M16 29 3 16C-6 6 8-5 16 5 24-5 38 6 29 16Z" fill="var(--welcome-rose)"/>; }
function Flower({x,y}:{x:number;y:number}) { return <g transform={`translate(${x} ${y})`} fill="var(--welcome-rose-light)">{[0,72,144,216,288].map(angle=><ellipse key={angle} cx="0" cy="-10" rx="7" ry="11" transform={`rotate(${angle})`}/>)}<circle r="6" fill="var(--welcome-gold)"/></g>; }
function Sprig({x,y,rotate}:{x:number;y:number;rotate:number}) { return <g transform={`translate(${x} ${y}) rotate(${rotate})`} stroke="var(--welcome-stem)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 120Q50 75 24 8"/><path d="M34 83C0 85 0 56 0 56q34-1 34 27m2-30q32-6 31-32Q34 25 36 53M27 22Q3 16 11-8q26 8 16 30" fill="var(--welcome-leaf)" stroke="none"/></g>; }
