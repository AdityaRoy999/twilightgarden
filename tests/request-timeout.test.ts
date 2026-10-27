import {afterEach,expect,it,vi} from 'vitest';
import {withinDeadline,retryTransientRead} from '../lib/requestTimeout';
afterEach(()=>vi.useRealTimers());
it('aborts the underlying request when its overall deadline expires',async()=>{
 vi.useFakeTimers();let signal!:AbortSignal;
 const result=withinDeadline(s=>{signal=s;return new Promise(()=>{});},100,'Timed out').catch(error=>error);
 await vi.advanceTimersByTimeAsync(101);
 expect(await result).toMatchObject({message:'Timed out'});expect(signal.aborted).toBe(true);
});
it('does not start work for an already cancelled scope',async()=>{
 const controller=new AbortController();controller.abort();const work=vi.fn();
 await expect(withinDeadline(work,100,'Timed out',controller.signal)).rejects.toMatchObject({name:'AbortError'});
 expect(work).not.toHaveBeenCalled();
});
it('never retries invalid credentials or authorization denial',async()=>{
 const read=vi.fn().mockRejectedValue({status:401,message:'Network authentication denied'});
 await expect(retryTransientRead(read,new AbortController().signal)).rejects.toMatchObject({status:401});
 expect(read).toHaveBeenCalledOnce();
});
