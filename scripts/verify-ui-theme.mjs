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
const paths = productionStyles.length ? productionStyles : ['/index.css?direct', '/styles/bloom.css?direct', '/styles/reference.css?direct', '/styles/spring.css?direct', '/styles/dark.css?direct', '/styles/refinements.css?direct', '/styles/polish.css?direct', '/styles/wellness.css?direct', '/styles/solar-polish.css?direct'];
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
if (dark['--bg-surface-rgb'] !== '33 25 43' || dark['--text-primary'] !== '#fbf8ff') throw new Error('Dark surface and text tokens do not match');
if (!dark['--dark-card']?.includes('linear-gradient') || !dark['--dark-action']?.includes('linear-gradient')) throw new Error('Missing dark reference gradients');
let shadowReset = false;
let hiddenTracks = false, selectionOutlinesRemoved = false;
for (const sheet of sheets) postcss.parse(sheet).walkRules(rule => {
  if (rule.selector.includes('*')) rule.walkDecls('box-shadow', declaration => { if (declaration.value === 'none' && declaration.important) shadowReset = true; });
  if (rule.selector.includes('*')) rule.walkDecls('scrollbar-width', declaration => { if (declaration.value === 'none') hiddenTracks = true; });
  if (rule.selector.includes('*')) rule.walkDecls('outline', declaration => { if (['none', '0'].includes(declaration.value) && declaration.important) selectionOutlinesRemoved = true; });
});
if (!shadowReset) throw new Error('Shadow-free surface rules were not served');
if (!hiddenTracks || !selectionOutlinesRemoved) throw new Error('Scrollbar and selection refinements were not served');
if (!sheets.some(sheet => sheet.includes('data-chat') && sheet.includes('max-width:none') || sheet.includes('data-chat') && sheet.includes('max-width: none'))) throw new Error('Full-pane chat styles were not served');
if (!(await get('/art/bloom-background.svg')).includes('<svg')) throw new Error('Botanical background asset was not served');
if (!(await get('/art/bloom-background-dark.svg')).includes('<svg')) throw new Error('Dark botanical background asset was not served');
if (!sheets.some(sheet => sheet.includes('.solar-icon') && sheet.includes('mask-image'))) throw new Error('Solar and progressive blur refinements were not served');
if (!sheets.some(sheet => sheet.includes('.illustrated-guide') && sheet.includes('.correlation-chart'))) throw new Error('Illustrated Wellness styles were not served');
if (!(await get('/art/wellness/correlation.svg')).includes('<svg')) throw new Error('Wellness vector scene was not served');
const scene = await fetch(new URL('/art/wellness/gentle-stretch.cartoon.webp',origin));
if (!scene.ok || !scene.headers.get('content-type')?.includes('image/webp')) throw new Error('Wellness scene artwork was not served');
await scene.body?.cancel();
console.log(`PASS ${origin.origin}: paired themes, dark gradients, full-pane chat, hidden scrollbars, selection styling, and local artwork`);
