import React from 'react';
import type { CallReactionName } from '../lib/callReactions';
/** Original, theme-independent call stickers. Chat reactions retain real emoji. */
export function CallReactionSymbol({ name, size = 44 }: { name: CallReactionName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="call-reaction-symbol">
    {name === 'heart' ? <><path d="M32 54C20 45 7 37 7 23 7 8 25 6 32 19 39 6 57 8 57 23c0 14-13 22-25 31Z" fill="#f26799"/><path d="M16 22c0-5 5-8 9-5" stroke="#ffdae8" strokeWidth="4" strokeLinecap="round"/></>
    : name === 'clap' ? <><path d="m21 51-9-19c-2-4 4-7 6-3l4 7-6-21c-1-4 5-6 6-2l8 21-3-24c0-4 6-5 7-1l4 24 3-18c1-4 7-3 6 1l-1 22c0 17-17 23-25 13Z" fill="#f9c693"/><path d="m12 14-4-6m44 1 3-5M5 24l-4-1" stroke="#f788b3" strokeWidth="3" strokeLinecap="round"/></>
    : name === 'celebrate' ? <><path d="m7 57 12-34 22 23Z" fill="#ba9af0"/><path d="m14 37 14 10m-10-20 20 18" stroke="#f8d6e7" strokeWidth="4"/><path d="m35 10 7 9-6 9m10-6 8-5m-3 17 9 2M23 5l3 10" stroke="#f277a3" strokeWidth="4" strokeLinecap="round"/><circle cx="51" cy="6" r="3" fill="#efc473"/><circle cx="30" cy="30" r="3" fill="#efc473"/></>
    : name === 'wave' ? <><path d="m21 54-10-19c-2-4 4-7 6-3l5 7-8-22c-1-4 5-6 7-2l8 18-4-24c0-4 6-5 7-1l5 23 1-19c0-4 6-4 7 0v24l5-7c3-3 7 0 5 4l-7 16c-6 13-21 15-27 5Z" fill="#f9c693"/><path d="M8 14 4 22M51 10l6 7" stroke="#d7b7f9" strokeWidth="3" strokeLinecap="round"/></>
    : <><circle cx="32" cy="32" r="27" fill="#f9cf82"/><ellipse cx="16" cy="37" rx="6" ry="3" fill="#f29f9b"/><ellipse cx="48" cy="37" rx="6" ry="3" fill="#f29f9b"/>
      <path d="m17 26 5-3 5 3m10 0 5-3 5 3" stroke="#705065" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {name === 'laugh' ? <><path d="M20 36c1 18 23 18 24 0Z" fill="#705065"/><path d="M25 47c4-6 10-6 14 0" stroke="#f58e9b" strokeWidth="5" strokeLinecap="round"/></>
      : <><path d="m29 35 7 4-7 4" stroke="#705065" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M50 33c-12-7-10-16-4-16 4 0 4 4 4 4s1-4 5-4c6 0 8 9-5 16Z" fill="#ed769e"/></>}
    </>}
  </svg>;
}
