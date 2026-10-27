import {expect,it,vi} from 'vitest';
import {completeNativeAuth} from '../lib/nativeAuthCallback';
it('exchanges PKCE codes without treating arbitrary deep links as sign-in',async()=>{
 const auth={exchangeCodeForSession:vi.fn(async()=>({error:null})),setSession:vi.fn(async()=>({error:null}))};
 expect(await completeNativeAuth('com.twilight.garden://google-auth?code=synthetic-code',auth)).toBe(true);
 expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('synthetic-code');
 expect(await completeNativeAuth('https://untrusted.invalid/?code=ignored',auth)).toBe(false);
 expect(await completeNativeAuth('twilight-garden://other',auth)).toBe(false);
 expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
it('supports legacy token callbacks and reports a generic error without leaking their URL',async()=>{
 const auth={exchangeCodeForSession:vi.fn(async()=>({error:new Error('private provider detail')})),setSession:vi.fn(async()=>({error:null}))};
 expect(await completeNativeAuth('com.twilight.garden://google-auth#access_token=synthetic&refresh_token=synthetic-refresh',auth)).toBe(true);
 expect(auth.setSession).toHaveBeenCalledWith({access_token:'synthetic',refresh_token:'synthetic-refresh'});
 await expect(completeNativeAuth('com.twilight.garden://google-auth?code=synthetic-code',auth)).rejects.toThrow('Could not finish sign-in. Please retry.');
});
