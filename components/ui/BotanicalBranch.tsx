import React from 'react';
import geometry from '../../lib/botanicalGeometry.json';

/** Leaf bases lie on the same quadratic curve as the stem, at t=.2/.4/.6/.8.
 * Shared with the static SVG generator so artwork stays connected at every size. */
export function BotanicalBranch({ transform, stem = 'currentColor', leaf = 'currentColor', opacity = .45 }: {
  transform?: string; stem?: string; leaf?: string; opacity?: number;
}) {
  return <g transform={transform} data-botanical-branch="connected">
    <g fill={leaf} opacity={opacity}>
      {geometry.leaves.map(({shape}) => <path key={shape} d={shape}/>)}
    </g>
    <path d={geometry.stem} fill="none" stroke={stem} strokeWidth="2" strokeLinecap="round"/>
    <g fill="none" stroke={stem} strokeWidth="1.2" strokeLinecap="round" opacity=".45">
      {geometry.leaves.map(({vein}) => <path key={vein} d={vein}/>)}
    </g>
  </g>;
}
