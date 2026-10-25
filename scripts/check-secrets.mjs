import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const paths = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0');
const failures=[];
for(const path of paths){
  if(!/\.(?:[cm]?js|tsx?|sql|json|md|txt|ya?ml|toml|key|pem)$/.test(path)||!fs.existsSync(path))continue;
  const source=fs.readFileSync(path,'utf8');
  if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(source))failures.push(`${path}: private signing/administrator key`);
  for(const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){
    try{if(JSON.parse(Buffer.from(match[0].split('.')[1],'base64url')).role==='service_role')failures.push(`${path}: administrator JWT`);}catch{/* Not a JWT. */}
  }
  if(/nvapi-[A-Za-z0-9_-]{24,}/.test(source))failures.push(`${path}: provider credential`);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log('No private keys, administrator JWTs or provider credentials found in tracked source.');
