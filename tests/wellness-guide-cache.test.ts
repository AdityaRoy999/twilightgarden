import {afterEach,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({user:'cache-a',token:'token-a'}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:{user:{id:fixture.user},access_token:fixture.token}}})}}}));
import {generateWellnessTips} from '../lib/wellnessAI';
const response=()=>new Response(JSON.stringify({text:JSON.stringify({cards:[
 {title:'Gentle Movement',body:'Make space for stretching.',illustrationId:'gentle-stretch'},
 {title:'Hydration Focus',body:'Enjoy a warm herbal drink.',illustrationId:'herbal-hydration'},
 {title:'Rest & Recovery',body:'Make time for rest.',illustrationId:'rest-recovery'},
]})}),{status:200,headers:{'Content-Type':'application/json'}});
afterEach(()=>vi.unstubAllGlobals());
it('reuses a guide across views, refreshes explicitly, and isolates accounts and changed observations',async()=>{
 const fetcher=vi.fn().mockImplementation(async()=>response());vi.stubGlobal('fetch',fetcher);
 const ctx={phase:'Luteal',cycleDay:25,moods:['calm'],symptoms:[]};
 await generateWellnessTips(ctx);await generateWellnessTips(ctx);expect(fetcher).toHaveBeenCalledTimes(1);
 await generateWellnessTips(ctx,true);expect(fetcher).toHaveBeenCalledTimes(2);
 fixture.user='cache-b';fixture.token='token-b';await generateWellnessTips(ctx);expect(fetcher).toHaveBeenCalledTimes(3);
 expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer token-b');
 await generateWellnessTips({...ctx,symptoms:['cramps']});expect(fetcher).toHaveBeenCalledTimes(4);
});
it('does not cache failed provider requests as completed guidance',async()=>{
 fixture.user='cache-retry';const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:502})).mockImplementation(async()=>response());vi.stubGlobal('fetch',fetcher);
 const ctx={phase:'Menstrual',cycleDay:1,moods:[],symptoms:[]};
 expect((await generateWellnessTips(ctx)).error).toBeTruthy();expect((await generateWellnessTips(ctx)).error).toBeUndefined();expect(fetcher).toHaveBeenCalledTimes(2);
});
