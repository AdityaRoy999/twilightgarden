import {describe,expect,it,vi} from 'vitest';
import {installChunkRecovery,isChunkLoadError} from '../lib/chunkRecovery';
describe('deployment chunk recovery',()=>{
 const makeWindow=(online=true)=>{const target=new EventTarget();const values=new Map<string,string>();return Object.assign(target,{navigator:{onLine:online},location:{reload:vi.fn()},sessionStorage:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)}});};
 it('reloads once after a stale import and leaves repeated failures visible',()=>{const target=makeWindow();installChunkRecovery(target as unknown as Window);const first=new Event('vite:preloadError',{cancelable:true});target.dispatchEvent(first);expect(first.defaultPrevented).toBe(true);expect(target.location.reload).toHaveBeenCalledTimes(1);const second=new Event('vite:preloadError',{cancelable:true});target.dispatchEvent(second);expect(target.location.reload).toHaveBeenCalledTimes(1);expect(second.defaultPrevented).toBe(false);});
 it('does not repeatedly reload an offline device',()=>{const target=makeWindow(false);installChunkRecovery(target as unknown as Window);target.dispatchEvent(new Event('vite:preloadError'));expect(target.location.reload).not.toHaveBeenCalled();});
 it('recognizes cached lazy import failures for the reload action',()=>{expect(isChunkLoadError('Failed to fetch dynamically imported module: /assets/old.js')).toBe(true);expect(isChunkLoadError('Network request failed')).toBe(false);});
});
