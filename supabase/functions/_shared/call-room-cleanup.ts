/** Unlinking must evict native participants even when their WebView is suspended. */
export async function closeCallRooms(coupleId: string) {
  const url = Deno.env.get('LIVEKIT_URL'), apiKey = Deno.env.get('LIVEKIT_API_KEY'), secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!url || !apiKey || !secret) return;
  const endpoint = new URL(url); if (endpoint.protocol !== 'wss:') throw new Error('Invalid media endpoint');
  endpoint.protocol = 'https:';
  const encode = (value: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const invoke = async (method: string, body: unknown, grant: Record<string, unknown>) => {
    const now = Math.floor(Date.now()/1000);
    const input = `${encode({alg:'HS256',typ:'JWT'})}.${encode({iss:apiKey,sub:'twilight-cleanup',nbf:now-5,exp:now+60,video:grant})}`;
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input))))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const result = await fetch(new URL(`/twirp/livekit.RoomService/${method}`,endpoint),{method:'POST',headers:{Authorization:`Bearer ${input}.${signature}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
    if (!result.ok) throw new Error('Media cleanup will retry');
    return result.json();
  };
  const response = await invoke('ListRooms',{}, {roomList:true});
  const names = (response.rooms || []).map((room: {name:string}) => room.name).filter((name: unknown): name is string => typeof name === 'string' && name.startsWith(`twilight-${coupleId}-`));
  for (const room of names) await invoke('DeleteRoom',{room},{roomAdmin:true,room});
}
