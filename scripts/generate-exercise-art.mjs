import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../lib/exercises.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'./dates'",JSON.stringify(new URL('../lib/dates.ts',import.meta.url).href));
const {exercises,seatedPose,standingPose}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const escape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const line=(a,b,color,width)=>`<path d="M${a}L${b}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
function figure(p,chair,id,final=false){
 const legs=['L','R'].map(side=>line(p['P'+side],p['K'+side],'#8e80b4',18)+line(p['K'+side],p['F'+side],'#8e80b4',16)+line(p['F'+side],[p['F'+side][0]+9,p['F'+side][1]],'#5e567d',10)).join('');
 const arms=['L','R'].map(side=>line(p['S'+side],p['E'+side],'#efb39e',12)+line(p['E'+side],p['W'+side],'#efb39e',11)+`<circle cx="${p['W'+side][0]}" cy="${p['W'+side][1]}" r="6" fill="#efb39e"/>`).join('');
 const fingers=id==='finger-spread'?['L','R'].map(side=>Array.from({length:4},(_,i)=>line([p['W'+side][0]-4+i*3,p['W'+side][1]-2],[p['W'+side][0]-8+i*5,p['W'+side][1]-12-(i===1?3:0)],'#efb39e',3)).join('')).join(''):'';
 const wall=['wall-press','wall-chest','calf-stretch'].includes(id)?'<path d="M192 55V220" stroke="#d5c5d2" stroke-width="6"/>':'';
 const support=['standing-heels','standing-toes','supported-knee','side-leg','heel-curl','mini-bend','split-stance'].includes(id)?'<path d="M164 128H180M177 128V218" fill="none" stroke="#c5b5a6" stroke-width="6" stroke-linecap="round"/>':'';
 const seat=wall+support+(chair?'<path d="M76 145H164M82 145V218M158 145V218M77 145V100" fill="none" stroke="#c5b5a6" stroke-width="7" stroke-linecap="round"/>':'');
 if(final&&id==='neck-tilt'){
  const normal=figure(p,chair,'neck-tilt-static');
  const headStart=normal.indexOf(`<path d="M${p.H[0]-16}`);
  return normal.slice(0,headStart)+`<g transform="rotate(-14 ${p.H[0]} ${p.H[1]})">`+normal.slice(headStart)+'</g>';
 }
 if(final&&id==='neck-turn'){
  const normal=figure(p,chair,'neck-profile');
  return normal.slice(0,normal.lastIndexOf('<path'))+`<path d="M${p.H[0]+5} ${p.H[1]+1}h2m2 3 5 1-5 2m-4 4h6" fill="none" stroke="#6d4857" stroke-width="1.8" stroke-linecap="round"/>`;
 }
 const face=final&&id==='neck-turn'?`<path d="M${p.H[0]+5} ${p.H[1]+1}h2m2 3 5 1-5 2m-4 4h6" fill="none" stroke="#6d4857" stroke-width="1.8" stroke-linecap="round"/>`:'';
 return `${seat}${legs}<path d="M${p.SL}Q120 72 ${p.SR}L${p.PR}Q120 147 ${p.PL}Z" fill="#dc829f"/>${arms}${fingers}<path d="M${p.H[0]-16} ${p.H[1]+6}Q${p.H[0]-24} ${p.H[1]-28} ${p.H[0]} ${p.H[1]-24}Q${p.H[0]+25} ${p.H[1]-25} ${p.H[0]+18} ${p.H[1]+11}" fill="#5f4053"/><circle cx="${p.H[0]}" cy="${p.H[1]}" r="17" fill="#efb39e"/><path d="M${p.H[0]-17} ${p.H[1]-7}Q${p.H[0]-2} ${p.H[1]-24} ${p.H[0]+16} ${p.H[1]-7}" fill="#5f4053"/><path d="M${p.H[0]-7} ${p.H[1]+2}h2m9 0h2m-10 7q4 3 8 0" fill="none" stroke="#6d4857" stroke-width="1.8" stroke-linecap="round"/>${face}`;
}
await fs.mkdir(new URL('../public/art/exercise/',import.meta.url),{recursive:true});
for(const exercise of exercises){
 const chair=exercise.category==='Seated'||exercise.id==='seated-breathe'||exercise.id==='shoulder-breathe'||exercise.id==='sit-stand';
 const start=chair?seatedPose:standingPose,end=exercise.id==='sit-stand'?standingPose:{...start,...exercise.changes};
 const candidates=['Neck','Posture'].includes(exercise.focus)?['H']:['Ankles','Calves'].includes(exercise.focus)?['FL','FR']:['Legs','Hips','Movement'].includes(exercise.focus)?['KL','KR','FL','FR']:['WL','WR','EL','ER','SL','SR'];
 const changed=candidates.find(key=>exercise.changes[key]);
 const target=exercise.focus==='Breath'?[120,110]:end[changed||candidates[0]];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260"><title>${escape(exercise.name)}: start and comfortable range</title><rect x="1" y="1" width="418" height="258" rx="28" fill="#fff6fa"/><path d="M20 227H397" stroke="#ecd9e4" stroke-width="2"/><g transform="translate(12 30) scale(.78)">${figure(start,chair,exercise.id)}</g><g transform="translate(220 30) scale(.78)">${figure(end,chair,exercise.id,true)}<circle cx="${target[0]}" cy="${target[1]}" r="23" fill="none" stroke="#bc567f" stroke-width="1.8" stroke-dasharray="4 5"/></g><path d="M193 117h28m-8-8 9 8-9 8" stroke="#b5688e" stroke-width="3" fill="none" stroke-linecap="round"/><text x="103" y="248" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#675571">Start</text><text x="311" y="248" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#675571">Easy range</text></svg>`;
 await fs.writeFile(new URL(`../public${exercise.art}`,import.meta.url),svg);
 const palette={'#fff6fa':'#281e32','#ecd9e4':'#4c3756','#675571':'#d7c8e4','#8e80b4':'#a99bc6','#5e567d':'#c7b9de','#dc829f':'#bd638f','#c5b5a6':'#88788b','#d5c5d2':'#705977','#bc567f':'#e79ab9','#b5688e':'#e0a4c1'};
 const dark=svg.replace(/#[a-f0-9]{6}/g,color=>palette[color]||color);
 await fs.writeFile(new URL(`../public${exercise.art.replace('.svg','.dark.svg')}`,import.meta.url),dark);
}
console.log(`Generated ${exercises.length} original two-pose SVG exercise sets with paired light/dark artwork.`);
