import {expect,it,vi} from 'vitest';
import {requestGameCompletion} from '../supabase/functions/_shared/gameProvider';
it('retries one transient provider failure and uses a bounded timeout',async()=>{
 const request=vi.fn().mockRejectedValueOnce(new DOMException('timed out','TimeoutError')).mockResolvedValueOnce(new Response('{}'));
 expect((await requestGameCompletion('https://example.invalid',{method:'POST'},request)).ok).toBe(true);expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
});
it('does not retry invalid provider credentials or retry indefinitely',async()=>{
 const invalid=vi.fn().mockResolvedValue(new Response('{}',{status:401}));expect((await requestGameCompletion('https://example.invalid',{},invalid)).status).toBe(401);expect(invalid).toHaveBeenCalledTimes(1);
 const failed=vi.fn().mockRejectedValue(new TypeError('network'));await expect(requestGameCompletion('https://example.invalid',{},failed)).rejects.toThrow('Retry AI questions');expect(failed).toHaveBeenCalledTimes(2);
});
