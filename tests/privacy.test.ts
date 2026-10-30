import {describe,expect,it} from 'vitest';
import {canEnterPrivateApp,clearHealthSnapshots,PRIVACY_NOTICE_VERSION,type PrivacyPreferences} from '../lib/privacy';
const adult:PrivacyPreferences={age_band:'18+',core_consent:true,health_consent:true,share_health:false,ai_consent:false,shopping_consent:false,notice_version:PRIVACY_NOTICE_VERSION};
describe('privacy admission',()=>{
 it('requires explicit core and tracker health consent without forcing optional processing',()=>{
  expect(canEnterPrivateApp(null,'user')).toBe(false);
  expect(canEnterPrivateApp({...adult,core_consent:false},'user')).toBe(false);
  expect(canEnterPrivateApp({...adult,health_consent:false},'user')).toBe(false);
  expect(canEnterPrivateApp({...adult,health_consent:false},'partner')).toBe(true);
  expect(canEnterPrivateApp(adult,'user')).toBe(true);
 });
 it('blocks minors, stale notice acceptance and accounts being deleted',()=>{
  for(const age_band of ['under13','13-17'] as const)expect(canEnterPrivateApp({...adult,age_band},'partner')).toBe(false);
  expect(canEnterPrivateApp({...adult,notice_version:'old'},'user')).toBe(false);
  expect(canEnterPrivateApp({...adult,deleting:true},'user')).toBe(false);
 });
 it('removes plaintext history without deleting unrelated identity recovery',()=>{
  const map=new Map([['tw_logs_1','private'],['tw_settings_1','private'],['identity-backup','encrypted'],['theme','dark']]);
  const storage={get length(){return map.size;},key:(i:number)=>[...map.keys()][i],removeItem:(k:string)=>{map.delete(k);}};
  clearHealthSnapshots(storage);expect([...map.keys()]).toEqual(['identity-backup','theme']);
 });
});
