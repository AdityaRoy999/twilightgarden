import {expect,it,vi} from 'vitest';
import {loadHealthHistory,canReadSharedHealth} from '../lib/healthHistory';

it('loads complete own and partner history beyond 90 and the server row cap',async()=>{
  const dates=Array.from({length:1201},(_,i)=>new Date(Date.UTC(2026,0,1-i)).toISOString().slice(0,10));
  let before:string|undefined; const cutoffs:string[]=[];
  const client={from:vi.fn(()=>{
    before=undefined;
    const query:any={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,lt:(_:string,value:string)=>{before=value;cutoffs.push(value);return query;},abortSignal:()=>query,then:(resolve:any)=>resolve({data:dates.filter(date=>!before||date<before).slice(0,500).map(date=>({date})),error:null})};
    return query;
  })};
  const rows=await loadHealthHistory(client,'owner');
  expect(rows.map(row=>row.date)).toEqual(dates);
  expect(cutoffs).toEqual([dates[499],dates[999]]);
  expect(client.from).toHaveBeenCalledTimes(3);
});
it('rejects a failed page instead of treating partial history as complete',async()=>{
  const query:any={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,then:(resolve:any)=>resolve({error:new Error('offline')})};
  await expect(loadHealthHistory({from:()=>query},'owner')).rejects.toThrow('offline');
});
it('permits shared health for active members without depending on chat recovery',()=>{
  expect(canReadSharedHealth({status:'active',share_enabled:true},'partner',['owner','partner'])).toBe(true);
  expect(canReadSharedHealth({status:'active',share_enabled:false},'partner',['owner','partner'])).toBe(false);
  expect(canReadSharedHealth({status:'pending',share_enabled:true},'partner',['owner','partner'])).toBe(false);
  expect(canReadSharedHealth({status:'active',share_enabled:true},'outsider',['owner','partner'])).toBe(false);
});
