import {readFileSync, writeFileSync} from 'node:fs';
import {botanicalBranch} from './botanical-branch.mjs';

for (const dark of [false, true]) {
  const file = new URL(`../public/art/bloom-background${dark ? '-dark' : ''}.svg`, import.meta.url);
  const source = readFileSync(file, 'utf8');
  const stem = dark ? '#a63866' : '#ffb5cf';
  const branches = `<g data-background-botanicals="connected" opacity=".55">${botanicalBranch({transform:'translate(580 45) scale(1.4) rotate(-25 80 190)',stem,leaf:'url(#petal)',opacity:1})}${botanicalBranch({transform:'translate(-4 1185) scale(.85) rotate(15 80 190)',stem,leaf:'url(#petal)',opacity:1})}</g>`;
  // Replace only the botanical group; preserve the original wash and sparkles.
  const pattern = /<g (?:stroke="[^"]+" stroke-width="2"|data-background-botanicals="connected") opacity=".55">[\s\S]*?(?=\n<g fill=)/;
  if (!pattern.test(source)) throw new Error(`Botanical group missing in ${file.pathname}`);
  writeFileSync(file, source.replace(pattern, branches));
}
