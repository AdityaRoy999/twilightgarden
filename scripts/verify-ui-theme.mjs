import postcss from 'postcss';

// Check the CSS users actually receive, including stale dev-server config.
const origin = new URL(process.argv[2] || 'http://127.0.0.1:3000');
async function get(path) {
  const response = await fetch(new URL(path, origin), { headers: { Accept: 'text/css,text/html,image/svg+xml' } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}
const html = await get('/');
const productionStyles = [...html.matchAll(/href="(\/assets\/[^"\s]+\.css)"/g)].map(match => match[1]);
const paths = productionStyles.length ? productionStyles : ['/index.css?direct', '/styles/bloom.css?direct', '/styles/reference.css?direct'];
const sheets = await Promise.all(paths.map(get));
const light = {}, dark = {};
let surfaceBindings = 0;
for (const sheet of sheets) {
  postcss.parse(sheet).walkRules(rule => {
    if (['.bg-surface-dark', '.bg-background-dark'].includes(rule.selector)) {
      rule.walkDecls('background-color', declaration => {
        if (!declaration.value.includes('var(--bg-')) throw new Error('Fixed dark surface found. Restart Vite after updating Tailwind config.');
        surfaceBindings++;
      });
    }
    const tokens = rule.selector === ':root' ? light : rule.selector === ':root.dark' ? dark : null;
    if (tokens) rule.walkDecls(declaration => { tokens[declaration.prop] = declaration.value; });
  });
}
if (surfaceBindings < 2) throw new Error('Missing generated surface utilities');
if (light['--bg-surface-rgb'] !== '255 255 255' || light['--text-primary'] !== '#101333') throw new Error('White surface and text tokens do not match');
if (dark['--bg-surface-rgb'] !== '42 33 47' || dark['--text-primary'] !== '#fff4f9') throw new Error('Dark surface and text tokens do not match');
if (!(await get('/art/bloom-background.svg')).includes('<svg')) throw new Error('Botanical background asset was not served');
console.log(`PASS ${origin.origin}: generated colors, paired light/dark tokens, and botanical asset`);
