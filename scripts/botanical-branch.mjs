import { readFileSync } from 'node:fs';

const geometry = JSON.parse(readFileSync(new URL('../lib/botanicalGeometry.json', import.meta.url), 'utf8'));

/** Static counterpart of BotanicalBranch; both use identical attachment points. */
export function botanicalBranch({transform = '', stem = '#e58ab0', leaf = '#eea0c1', opacity = .55} = {}) {
  return `<g transform="${transform}" data-botanical-branch="connected"><g fill="${leaf}" opacity="${opacity}">${geometry.leaves.map(({shape}) => `<path d="${shape}"/>`).join('')}</g><path d="${geometry.stem}" fill="none" stroke="${stem}" stroke-width="2" stroke-linecap="round"/><g fill="none" stroke="${stem}" stroke-width="1.2" stroke-linecap="round" opacity=".45">${geometry.leaves.map(({vein}) => `<path d="${vein}"/>`).join('')}</g></g>`;
}
