import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const roots = ['pages', 'components', 'contexts', 'hooks', 'lib'];
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(dir,e.name).replaceAll('\\','/')] : []);
const files = roots.flatMap(walk).concat(['App.tsx','index.tsx','types.ts']);
const texts = new Map(files.map(f => [f,fs.readFileSync(f,'utf8')]));
const edges = new Map(), packages = new Set();
for (const [file, source] of texts) {
  const sf = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const imports = [];
  function visit(n) {
    if ((ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) imports.push(n.moduleSpecifier.text);
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) imports.push(n.arguments[0].text);
    ts.forEachChild(n,visit);
  }
  visit(sf);
  edges.set(file,imports.filter(x=>x.startsWith('.')||x.startsWith('@/')).map(x=>{
    const base = x.startsWith('@/') ? x.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file),x));
    return [base,base+'.ts',base+'.tsx',base+'/index.ts',base+'/index.tsx'].find(f=>texts.has(f));
  }).filter(Boolean));
  imports.filter(x=>!x.startsWith('.')&&!x.startsWith('@/')).forEach(x=>packages.add(x.startsWith('@')?x.split('/').slice(0,2).join('/'):x.split('/')[0]));
}
const reached = new Set();
function reach(f) { if(reached.has(f))return; reached.add(f); (edges.get(f)||[]).forEach(reach); }
reach('index.tsx');
const unreferenced = files.filter(f=>!reached.has(f));
const inactiveUses = unreferenced.map(file=>({file,referencedBy:[...edges].filter(([,v])=>v.includes(file)).map(([k])=>k)}));
const tracked = (await import('node:child_process')).execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
const hashes = new Map();
for(const f of tracked.filter(f=>/\.(png|svg|webp|jpg|mp4|json)$/.test(f)&&!f.includes('adminsdk')&&!f.includes('lock')&&fs.existsSync(f))) {
  const b=fs.readFileSync(f); const hash=(await import('node:crypto')).createHash('sha256').update(b).digest('hex');
  hashes.set(hash,[...(hashes.get(hash)||[]),{file:f,bytes:b.length}]);
}
const result={files:files.length,lines:[...texts.values()].reduce((s,t)=>s+t.split('\n').length,0),unreachableFromWebEntry:inactiveUses,declaredDependenciesNotImportedInWeb:Object.keys(JSON.parse(fs.readFileSync('package.json','utf8')).dependencies).filter(d=>!packages.has(d)),exactAssetDuplicates:[...hashes.values()].filter(g=>g.length>1),publicBytes:tracked.filter(f=>f.startsWith('public/')&&fs.existsSync(f)).reduce((s,f)=>s+fs.statSync(f).size,0),largest:files.map(file=>({file,lines:texts.get(file).split('\n').length})).sort((a,b)=>b.lines-a.lines).slice(0,12)};
fs.writeFileSync('tmp/audit-graph.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
