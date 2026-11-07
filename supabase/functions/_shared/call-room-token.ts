const encode = (value: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
/** The token grants one authenticated identity access to one unguessable call room. No media encryption key is accepted here. */
export async function signCallRoomToken(apiKey: string, secret: string, identity: string, room: string, now = Math.floor(Date.now() / 1000)) {
  const message = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: apiKey, sub: identity, nbf: now - 5, exp: now + 600,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false },
    roomConfig: { maxParticipants: 2, emptyTimeout: 60, departureTimeout: 20 } })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return `${message}.${btoa(String.fromCharCode(...signature)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}
