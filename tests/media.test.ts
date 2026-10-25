import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({sign:vi.fn(),decrypt:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{storage:{from:()=>({createSignedUrl:mocks.sign})}}}));
vi.mock('../lib/encryption',()=>({decryptBlob:mocks.decrypt}));
import {chatMediaPath,loadChatMedia,validateAvatar} from '../lib/media';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('private attachments',()=>{
 it('recognizes legacy storage URLs only on the configured backend',()=>{
  vi.stubEnv('VITE_SUPABASE_URL','https://backend.example');
  expect(chatMediaPath('chat-media:couple/file.enc')).toBe('couple/file.enc');
  expect(chatMediaPath('https://backend.example/storage/v1/object/public/chat-media/couple/old.jpg')).toBe('couple/old.jpg');
  expect(chatMediaPath('https://attacker.example/storage/v1/object/public/chat-media/couple/old.jpg')).toBeNull();
 });
 it('does not fetch any attachment when the identity is locked',async()=>{
  await expect(loadChatMedia('chat-media:couple/file.enc',null)).rejects.toThrow(/identity/);
  expect(mocks.sign).not.toHaveBeenCalled();
 });
 it('fails closed instead of displaying raw data after a decryption error',async()=>{
  mocks.sign.mockResolvedValue({data:{signedUrl:'https://backend.example/signed'},error:null});
  mocks.decrypt.mockRejectedValue(new Error('Wrong key'));
  const fetch=vi.fn().mockResolvedValue({ok:true,arrayBuffer:()=>new ArrayBuffer(3)});vi.stubGlobal('fetch',fetch);
  await expect(loadChatMedia('chat-media:couple/file.enc','key')).rejects.toThrow('Wrong key');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rejects oversized or active-content avatars before upload',()=>{
  expect(()=>validateAvatar(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}))).toThrow(/JPEG/);
  expect(()=>validateAvatar(new File([new Uint8Array(6*1024*1024)],'x.png',{type:'image/png'}))).toThrow(/5 MB/);
 });
});
