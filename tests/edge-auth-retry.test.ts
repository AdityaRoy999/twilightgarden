import {expect,it,vi} from 'vitest';
import {verifiedUser} from '../supabase/functions/_shared/authRetry';
it('recovers from a temporary verification failure without treating a valid session as signed out',async()=>{
 const lookup=vi.fn().mockResolvedValueOnce({data:{user:null},error:{status:503,name:'AuthRetryableFetchError'}}).mockResolvedValueOnce({data:{user:{id:'verified'}},error:null});
 expect(await verifiedUser(lookup,async()=>{})).toBe('verified');expect(lookup).toHaveBeenCalledTimes(2);
});
it('denies invalid credentials without retrying',async()=>{
 const lookup=vi.fn().mockResolvedValue({data:{user:null},error:{status:401,name:'AuthApiError'}});
 expect(await verifiedUser(lookup,async()=>{})).toBeNull();expect(lookup).toHaveBeenCalledOnce();
});
it('distinguishes persistent service unavailability from an invalid session',async()=>{
 const lookup=vi.fn().mockResolvedValue({data:{user:null},error:{status:503}});
 await expect(verifiedUser(lookup,async()=>{})).rejects.toThrow('temporarily unavailable');expect(lookup).toHaveBeenCalledTimes(2);
});
