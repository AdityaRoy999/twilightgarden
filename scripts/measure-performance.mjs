// Reproducible client-side request timing. Only isolated QA rows are created.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {randomUUID,randomBytes} from 'node:crypto';
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
config({quiet:true});
const label=process.argv[2]||'sample';if(!/^[a-z-]+$/.test(label))throw Error('Use a simple report label');
const origin=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY;
if(new URL(origin).hostname!=='awijrkxrhlisixufiukw.supabase.co')throw Error('Unexpected backend');
const admin=createClient(origin,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checked=result=>{if(result.error)throw Error(result.error.message);return result.data;};
const samples=[];let qa;
const report={label,measuredAt:new Date().toISOString(),samplesPerRead:7,networkLocation:'Execution host; not a browser Core Web Vitals test',network:{},bundle:{}};
async function measure(name,url,options={}){
 const runs=[];
 for(let i=0;i<8;i++){
  const start=performance.now();const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});const headers=performance.now();const bytes=(await response.arrayBuffer()).byteLength;
  if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);
  if(i)runs.push({ttfbMs:Math.round(headers-start),totalMs:Math.round(performance.now()-start),bytes});
 }
 const percentile=(key,p)=>[...runs].sort((a,b)=>a[key]-b[key])[Math.min(runs.length-1,Math.ceil(runs.length*p)-1)][key];
 report.network[name]={p50Ms:percentile('totalMs',.5),p95Ms:percentile('totalMs',.95),ttfbP50Ms:percentile('ttfbMs',.5),bytes:runs[0].bytes};samples.push({name,runs});
}
try{
 const email=`twilight-perf-qa-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
 qa=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic Performance QA'}})).user;
 const client=createClient(origin,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=checked(await client.auth.signInWithPassword({email,password})).session.access_token;
 checked(await client.rpc('ensure_own_profile'));
 checked(await client.from('daily_logs').insert(Array.from({length:241},(_,i)=>({user_id:qa.id,date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),flow:null,moods:[],symptoms:[],notes:'Synthetic performance fixture'}))));
 const headers={apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 await measure('profile',`${origin}/rest/v1/profiles?select=role,full_name,avatar_url&id=eq.${qa.id}`,{headers});
 await measure('datasetEpoch',`${origin}/rest/v1/rpc/get_data_epoch`,{headers,method:'POST',body:'{}'});
 await measure('history241',`${origin}/rest/v1/daily_logs?select=id,user_id,date,is_period_start,flow,moods,symptoms,notes,energy_level,sleep_quality,sleep_hours,encrypted_payload,created_at&user_id=eq.${qa.id}&order=date.desc&limit=500`,{headers});
 await measure('productionHtml','https://twilight-mocha.vercel.app/');
}finally{
 if(qa){const actual=checked(await admin.auth.admin.getUserById(qa.id)).user;if(!actual.email?.startsWith('twilight-perf-qa-')||!actual.email.endsWith('@example.invalid'))throw Error('QA cleanup scope mismatch');checked(await admin.from('profiles').delete().eq('id',qa.id));checked(await admin.auth.admin.deleteUser(qa.id));}
}
if(fs.existsSync('dist/index.html')){
 const html=fs.readFileSync('dist/index.html','utf8');const paths=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/g)].map(match=>match[1]))];
 report.bundle={initialJavaScriptFiles:paths.length,rawBytes:0,gzipBytes:0,files:[]};
 for(const path of paths){const data=fs.readFileSync('dist'+path),gzip=gzipSync(data).length;report.bundle.rawBytes+=data.length;report.bundle.gzipBytes+=gzip;report.bundle.files.push({path,rawBytes:data.length,gzipBytes:gzip});}
}
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync(`tmp/performance-${label}.json`,JSON.stringify({...report,samples},null,2));
console.log(JSON.stringify(report,null,2));
