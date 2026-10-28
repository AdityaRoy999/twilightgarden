import { resolveDeviceIdentity, installRecoveredIdentity, reconcileIdentityGeneration } from '../lib/identity';
import { mergeChatNotes, cursorFilter } from '../lib/chat';
import { readOutbox, writeOutbox, type QueuedChat } from '../lib/chatOutbox';
import { localDateKey } from '../lib/dates';
import { loadHealthHistory, canReadSharedHealth } from '../lib/healthHistory';
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Couple, SharedNote } from '../types';
import {
  encryptMessage,
  decryptMessage,
  encryptData,
  decryptData,
  encryptBlob,
  decryptBlob,
  encryptIdentityWithPin,
  decryptIdentityWithPin,
  getCachedPrivateKey,
  isContentDecrypted,
  derivePublicKeyFromPrivate,
  clearSharedKeyCache,
  clearEncryptionCache,
} from '../lib/encryption';
import { sendSyncPayload } from '../lib/sync';
import { Preferences } from '@capacitor/preferences';

const NOTES_PAGE_SIZE = 50;

interface CouplesContextType {
  couple: Couple | null;
  notes: SharedNote[];
  isLoading: boolean;
  loading: boolean;  // alias for isLoading
  hasMoreNotes: boolean;
  loadingOlder: boolean;
  loadOlderNotes: () => Promise<void>;
  chatConnected:boolean;
  retryNote: (id:string) => Promise<void>;
  createNote: (content: string, type?: 'text' | 'image' | 'audio' | 'gif', mediaUrl?: string, replyToId?: string) => Promise<void>;
  generatePairingCode: () => Promise<string>;
  joinCouple: (code: string) => Promise<void>;
  addReaction: (noteId: string, emoji: string) => Promise<void>;
  replyToNote: (noteId: string, reply: string) => Promise<void>;
  toggleStar: (noteId: string) => Promise<void>;
  togglePin: (noteId: string) => Promise<void>;
  deleteNote: (noteId: string, forEveryone?: boolean) => Promise<void>;
  forwardNote: (noteId: string) => Promise<void>;
  markAsRead: (noteIds: string[]) => Promise<void>;
  setIsChatOpen: (isOpen: boolean) => void;
  uploadMedia: (file: File) => Promise<string>;

  // Partner Features
  isSupporter: boolean;
  partnerProfile: any | null; // Using any for simplicity for now, should be Profile
  partnerSettings: any | null; // Should be UserSettings
  partnerLogs: any[]; // Should be DailyLog[]
  partnerData: {
    profile: any | null;
    settings: any | null;
    logs: any[];
  };
  fetchPartnerData: () => Promise<void>;
  toggleGhostMode: () => Promise<void>;
  generateLoveCode: () => Promise<string>;
  unlockLoveNotes: (code: string) => Promise<void>;
  disconnectCouple: () => Promise<{mediaDeleted:boolean}>;
  broadcastUpdate: (type: 'log' | 'settings' | 'profile') => void;
  mapSettings: (row: any) => any;
  partnerPubKey: string | null;
  deviceId: string | null;
  hasCloudBackup: boolean;
  isHistorySynced: boolean;
  isSyncRequired: boolean;
  identityReady:boolean;
  identityGeneration:number;
  setupCloudBackup: (pin: string) => Promise<void>;
  restoreFromCloudBackup: (pin: string) => Promise<void>;
  completeSyncHandshake: (token: string) => Promise<void>;
  refreshE2EE: () => Promise<void>;
  keyVersion: number;
  restorationState: { isRestoring: boolean; progress: number; status: string };
}

const CouplesContext = createContext<CouplesContextType | undefined>(undefined);

export const CouplesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  // Cache couple data to prevent flash on resume/re-mount
  const getCachedCouple = (): Couple | null => {
    try {
      const cached = localStorage.getItem('tw_cached_couple');
      const value=cached?JSON.parse(cached):null;
      return user&&value&&[value.partner_1_id,value.partner_2_id].includes(user.id)?value:null;
    } catch { return null; }
  };

  const setCachedCouple = (v: Couple | null) => {
    try {
      if (v) localStorage.setItem('tw_cached_couple', JSON.stringify(v));
      else localStorage.removeItem('tw_cached_couple');
    } catch { }
  };

  // Load cached decrypted notes from localStorage for instant display
  const getCachedNotes = (): SharedNote[] => [];
  const setCachedNotes = (_notes:SharedNote[]) => {localStorage.removeItem('tw_cached_notes');};

  const [couple, setCouple] = useState<Couple | null>(getCachedCouple);
  const [notes, setNotes] = useState<SharedNote[]>(getCachedNotes);
  const [isLoading, setIsLoading] = useState(() => !getCachedCouple());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasMoreNotes, setHasMoreNotes] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Partner State
  const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
  const [partnerSettings, setPartnerSettings] = useState<any | null>(null);
  const [partnerLogs, setPartnerLogs] = useState<any[]>([]);
  const [partnerPubKey, setPartnerPubKey] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasCloudBackup, setHasCloudBackup] = useState(false);
  const [isHistorySynced, setIsHistorySynced] = useState(true);
  const [isSyncRequired, setIsSyncRequired] = useState(false);
  const [e2eeReady, setE2eeReady] = useState(false); // Prevents PIN popup race condition
  const [keyVersion, setKeyVersion] = useState(0);
  const identityGenerationRef = React.useRef(0);
  const identityRevisionRef = React.useRef(0);
  const [restorationState, setRestorationState] = useState({ isRestoring: false, progress: 0, status: '' });


  // Helper to map DB row to CycleSettings type
  const mapSettings = (s: any) => {
    if (!s) return null;
    return {
      avgCycleLength: s.avg_cycle_length || 28,
      avgPeriodLength: s.avg_period_length || 5,
      lastPeriodStart: s.last_period_start || '',
      onboardingCompleted: s.onboarding_completed || false,
      irregularCycle: s.irregular_cycle || false
    };
  };

  // Check if current user is the "supporter"
  const isSupporter = couple
    ? (couple.partner_1_id === user?.id ? couple.partner_1_role === 'supporter' : couple.partner_2_id === user?.id && couple.partner_1_role !== 'supporter')
    : user?.role === 'partner';

  // Use a ref to track chat open status without triggering re-subscriptions
  const isChatOpenRef = React.useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Use a ref for partnerLogs to avoid stale closures in Realtime listeners
  const partnerLogsRef = React.useRef<any[]>([]);
  useEffect(() => {
    partnerLogsRef.current = partnerLogs;
  }, [partnerLogs]);


  // Cache for partner's public key (Latest Active)
  const partnerPublicKeyRef = React.useRef<string | null>(null);
  // Cache for specific device keys (DeviceId -> PublicKey)
  const deviceKeysRef = React.useRef<Map<string, string>>(new Map());
  // Memory Cache for decrypted notes (ID -> Decrypted SharedNote) — capped at 200 entries
  const decryptedNotesCacheRef = React.useRef<Map<string, SharedNote>>(new Map());
  const MAX_DECRYPTED_CACHE = 200;

  // Guard: prevent overlapping refreshE2EE calls on double user/authLoading changes
  const refreshE2EEPendingRef = React.useRef<Promise<void>|null>(null);
  const aliveRef=React.useRef(true);
  const identityUsableRef=React.useRef(false);
  const fetchRevisionRef=React.useRef(0);
  const cachedPartnerIdRef=React.useRef<string|null>(null);
  const outboxRef=React.useRef<QueuedChat[]>([]);
  const sendingRef=React.useRef(new Set<string>());
  const mainChannelRef=React.useRef<ReturnType<typeof supabase.channel>|null>(null);
  const [chatConnected,setChatConnected]=useState(false);
  const partnerFetchRevisionRef=React.useRef(0);
  const relationshipRef=React.useRef(couple);
  React.useEffect(()=>{relationshipRef.current=couple;},[couple]);
  React.useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;fetchRevisionRef.current++;};},[]);

  const clearRelationship = (id?:string) => {
    if(id&&relationshipRef.current?.id&&relationshipRef.current.id!==id)return;
    const removed=id||relationshipRef.current?.id;
    fetchRevisionRef.current++;partnerFetchRevisionRef.current++;
    if(removed&&user)writeOutbox(user.id,removed,[]);
    outboxRef.current=[];sendingRef.current.clear();
    decryptedNotesCacheRef.current.clear();deviceKeysRef.current.clear();clearSharedKeyCache();
    partnerPublicKeyRef.current=null;cachedPartnerIdRef.current=null;relationshipRef.current=null;
    setCachedCouple(null);setCachedNotes([]);setCouple(null);setNotes([]);
    setPartnerProfile(null);setPartnerSettings(null);setPartnerLogs([]);setPartnerPubKey(null);
    setHasMoreNotes(false);setLoadingOlder(false);setChatConnected(false);setIsLoading(false);
  };
  useEffect(()=>{
    if(!user?.id)return;
    const account=supabase.channel('couple_account_'+user.id,{config:{private:true}})
      .on('broadcast',{event:'relationship:deleted'},({payload})=>{
        clearRelationship(payload.couple_id);
        if(payload.identity_reset){
          identityRevisionRef.current++;identityUsableRef.current=false;clearEncryptionCache();
          setE2eeReady(false);setHasCloudBackup(false);setIsSyncRequired(false);
          void refreshE2EE();
        }
      }).subscribe();
    return()=>{void supabase.removeChannel(account);};
  },[user?.id]);

  // Wait for auth to be fully verified before fetching couple data.
  // Without this gate, the cached user triggers a fetch BEFORE the Supabase
  // client has restored its JWT session, so RLS blocks the query and couple = null.
  const initializeIdentity = async () => {
    if(!user){setCouple(null);setNotes([]);setIsLoading(false);return;}
    try{
      const revision=identityRevisionRef.current;
      const current=()=>aliveRef.current&&identityRevisionRef.current===revision;
      const [device,result]=await Promise.all([
        Preferences.get({key:'tw_device_id'}),
        supabase.rpc('get_own_chat_identity_state').abortSignal(AbortSignal.timeout(10000))
      ]);
      if(result.error)throw result.error;
      if(!current())return;
      const state=result.data as unknown as {generation:number;public_key:string|null;has_backup:boolean;active:boolean};
      const generation=state.generation;
      identityGenerationRef.current=generation;
      if(generation>0&&!state.active){
        await reconcileIdentityGeneration(user.id,generation,current);
        if(!current())return;
        identityUsableRef.current=false;clearEncryptionCache();setE2eeReady(false);
        setHasCloudBackup(false);setIsSyncRequired(false);setIsHistorySynced(true);
        await fetchCoupleData();return;
      }
      const currentDeviceId=device.value||crypto.randomUUID();
      if(!device.value)await Preferences.set({key:'tw_device_id',value:currentDeviceId});
      setDeviceId(currentDeviceId);setHasCloudBackup(state.has_backup);
      const identity=await resolveDeviceIdentity(user.id,state.public_key,current,generation);
      if(!current())return;
      identityUsableRef.current=!identity.needsRestore;
      setIsSyncRequired(identity.needsRestore);setIsHistorySynced(!identity.needsRestore);
      if(identity.publicKey){
        const {error}=await supabase.from('user_keys').upsert({user_id:user.id,device_id:currentDeviceId,public_key:identity.publicKey,identity_generation:generation,device_name:navigator.platform||'Browser',last_active:new Date().toISOString()},{onConflict:'user_id,device_id'});
        if(error)throw error;
      }
      if(!current())return;
      setE2eeReady(true);
      await fetchCoupleData();
    }catch(error){if(aliveRef.current){setIsLoading(false);console.error('Identity initialization failed',error);}}
  };
  const refreshE2EE = async () => {
    // Recovery must run again after an initial device check has completed.
    // Returning early here could leave the recovered device unregistered.
    while(refreshE2EEPendingRef.current)await refreshE2EEPendingRef.current;
    const pending=initializeIdentity();refreshE2EEPendingRef.current=pending;
    try{await pending;}finally{if(refreshE2EEPendingRef.current===pending)refreshE2EEPendingRef.current=null;}
  };
  useEffect(()=>{if(!authLoading){
    // Health sharing must not wait for chat device registration/recovery.
    if(user)void fetchCoupleData();
    void refreshE2EE();
  }},[user?.id,authLoading]);
  useEffect(()=>{
    if(!user||authLoading)return;
    const check=()=>{if(document.visibilityState==='visible')void refreshE2EE();};
    window.addEventListener('focus',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
    return()=>{window.removeEventListener('focus',check);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
  },[user?.id,authLoading]);


  const fetchCoupleData = async () => {
    if(!user)return;
    const revision=++fetchRevisionRef.current;
    const current=()=>aliveRef.current&&revision===fetchRevisionRef.current;
    try{
      const {data:rows,error}=await supabase.from('couples').select('*').or('partner_1_id.eq.'+user.id+',partner_2_id.eq.'+user.id).order('created_at',{ascending:false}).abortSignal(AbortSignal.timeout(10000));
      if(error)throw error;if(!current())return;
      const relationship=(rows?.find(c=>c.status==='active')||rows?.find(c=>c.status==='pending')||null) as Couple|null;
      if(!relationship){clearRelationship();return;}
      relationshipRef.current=relationship;setCouple(relationship);setCachedCouple(relationship);setIsLoading(false);
      const other=relationship.partner_1_id===user.id?relationship.partner_2_id:relationship.partner_1_id;
      const [result,key]=await Promise.all([
        supabase.from('shared_notes').select('*').eq('couple_id',relationship.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(NOTES_PAGE_SIZE+1),
        other?fetchPartnerPublicKey(other):Promise.resolve(null),
        relationship.status==='active'?fetchPartnerDataInternal(relationship,user.id):Promise.resolve()
      ]);
      if(result.error)throw result.error;if(!current())return;
      const rowsNotes=(result.data||[]) as unknown as SharedNote[];
      const decoded=await Promise.all(rowsNotes.slice(0,NOTES_PAGE_SIZE).map(note=>decryptNote(note,key,user.id)));
      if(!current())return;
      setHasMoreNotes(rowsNotes.length>NOTES_PAGE_SIZE);
      const newest=rowsNotes[0]?.created_at||'';
      setNotes(previous=>mergeChatNotes(previous.filter(n=>n.localStatus||n.created_at>newest),decoded,user.id));
      if(identityUsableRef.current){
        outboxRef.current=readOutbox(user.id,relationship.id);
        for(const entry of outboxRef.current){
          const p=entry.params;
          const note=await decryptNote({id:p.p_id,couple_id:p.p_couple,sender_id:user.id,content:p.p_content,type:p.p_type||'text',media_url:p.p_media,reply_to_id:p.p_reply||null,reply_content:null,reactions:null,starred_by:null,pinned_by:null,is_forwarded:false,deleted_by:null,status:'sent',sender_public_key:p.p_sender_key,recipient_public_key:p.p_recipient_key,created_at:entry.createdAt} as SharedNote,key,user.id);
          if(!current())return;
          setNotes(previous=>[...previous.filter(n=>n.id!==note.id),{...note,localStatus:'sending'}]);
          void persistChat(entry).catch(()=>{});
        }
      }
      const received=rowsNotes.filter(n=>n.sender_id!==user.id&&n.status==='sent').map(n=>n.id);
      if(received.length)void supabase.from('shared_notes').update({status:'delivered'}).in('id',received).eq('status','sent').then(()=>{});
    }catch(error){if(current()){setIsLoading(false);console.error('Could not refresh shared space',error);}}
  };

  const decryptNote = async (note: SharedNote, partnerPubKey: string | null, userId: string): Promise<SharedNote> => {
    if (!note.content) return note;

    const decryptFn = async (cipher: string, pKey: string | null) => {
        if (!pKey || !identityUsableRef.current) return '🔐 Unlock your history to read this message';
        try {
            return await decryptMessage(cipher, pKey, userId);
        } catch (e) {
            console.warn('[E2EE] Decryption failed:', e);
            return '🔐 Unlock your history to read this message';
        }
    };

    try {
      // 1. Determine which key to use for this specific message
      // If we are the sender, we always use the partner's "latest" key
      // (because that's what we encrypted it with for self-decryption/backup flow)
      // If the partner is the sender, we MUST use the key for the device they sent it from.
      let currentPartnerKey = note.sender_id === userId ? (note.recipient_public_key || partnerPubKey) : (note.sender_public_key || partnerPubKey);
      const isPartnerSender = note.sender_id !== userId;
      const deviceIdToFetch = isPartnerSender ? note.sender_device_id : undefined;

      if (deviceIdToFetch && !note.sender_public_key) {
          const cachedDeviceKey = deviceKeysRef.current.get(deviceIdToFetch);
          if (cachedDeviceKey) {
              currentPartnerKey = cachedDeviceKey;
          } else {
              import.meta.env.DEV && console.log('[E2EE] Fetching specific key for partner device:', deviceIdToFetch);
              const freshDeviceKey = await fetchPartnerPublicKey(undefined, deviceIdToFetch);
              if (freshDeviceKey) {
                  currentPartnerKey = freshDeviceKey;
                  deviceKeysRef.current.set(deviceIdToFetch, freshDeviceKey);
              }
          }
      }

      let content = await decryptFn(note.content, currentPartnerKey);

      // 2. If decryption failed, try one re-fetch bypassing all caches
      if ((content.includes('🔐 Message locked') || content === note.content) && currentPartnerKey) {
          import.meta.env.DEV && console.log('[E2EE] Decryption failed, trying to re-fetch partner key from DB (bypassing cache)...');
          const freshKey = await fetchPartnerPublicKey(undefined, deviceIdToFetch, true);
          if (freshKey && freshKey !== currentPartnerKey) {
              import.meta.env.DEV && console.log('[E2EE] Found different partner key, retrying decryption...');
              content = await decryptFn(note.content, freshKey);
              currentPartnerKey = freshKey;
              if (deviceIdToFetch) deviceKeysRef.current.set(deviceIdToFetch, freshKey);
              else partnerPublicKeyRef.current = freshKey;
          }
      }

      const decrypted = { ...note };
      decrypted.content = content;

      if (note.media_url) {
          decrypted.media_url = await decryptFn(note.media_url, currentPartnerKey);
      }

      if (note.reply_content) {
          decrypted.reply_content = await decryptFn(note.reply_content, currentPartnerKey);
      }

      // Handle reactions — reactions are now stored as plain JSON (not encrypted).
      // Only attempt decryption for legacy string-format reactions.
      if (decrypted.reactions && typeof decrypted.reactions === 'string') {
          try {
              const decryptedReactions = await decryptData<any[]>(decrypted.reactions as any, currentPartnerKey as any, userId);
              decrypted.reactions = decryptedReactions || [];
          } catch (e) {
              // Legacy encrypted reaction that can't be decrypted — set to empty
              decrypted.reactions = [];
          }
      } else if (Array.isArray(decrypted.reactions)) {
          // Already a plain JSON array — keep as-is (new format, no decryption needed)
      } else if (!decrypted.reactions) {
          decrypted.reactions = [];
      }

      return decrypted;
    } catch (e) {
      console.error('[E2EE] decryptNote failed:', e);
      // Even on failure, preserve reactions if they're already plain JSON
      const result = { ...note };
      if (Array.isArray(result.reactions)) {
        // reactions are already usable
      } else if (!result.reactions) {
        result.reactions = [];
      }
      return result;
    }
  };

  // PARTNER REAL-TIME SYNC HELPER
  const partnerId = React.useMemo(() => {
    if (!couple || !user) return null;
    return couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
  }, [couple, user]);

  // Unified Real-time Subscription Effect
  useEffect(() => {
    if (!couple?.id || !user) return;

    let active=true;
    const receiveNote=async(raw:SharedNote)=>{
      if(relationshipRef.current?.id!==couple.id||raw.couple_id!==couple.id||![couple.partner_1_id,couple.partner_2_id].includes(raw.sender_id))return;
      const cached=decryptedNotesCacheRef.current.get(raw.id);
      const note=cached&&cached._encryptedContent===raw.content?{...raw,content:cached.content,media_url:cached.media_url,reply_content:cached.reply_content}:await decryptNote(raw,raw.sender_id===user.id?raw.recipient_public_key||await fetchPartnerPublicKey():raw.sender_public_key||await fetchPartnerPublicKey(),user.id);
      if(!active||!aliveRef.current||relationshipRef.current?.id!==couple.id)return;
      if(isContentDecrypted(note.content)){note._encryptedContent=raw.content;decryptedNotesCacheRef.current.set(note.id,note);}
      if(decryptedNotesCacheRef.current.size>MAX_DECRYPTED_CACHE){const key=decryptedNotesCacheRef.current.keys().next().value;if(key)decryptedNotesCacheRef.current.delete(key);}
      setNotes(previous=>mergeChatNotes(previous,[note],user.id));
      if(note.sender_id!==user.id&&note.status==='sent')void supabase.from('shared_notes').update({status:'delivered'}).eq('id',note.id).eq('status','sent').then(()=>{});
    };
    // 1. MAIN CHANNEL: Couple status & Shared Notes
    const mainChannel = supabase
      .channel(`couple_main_${couple.id}`, { config: { private: true } })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${couple.id}` },
        (payload) => {
            import.meta.env.DEV && console.log('[Realtime] Couple data update');
            if (payload.eventType === 'UPDATE') {
                const oldStatus = couple?.status;
                const newCouple = payload.new as Couple;
                relationshipRef.current=newCouple;
                partnerFetchRevisionRef.current++;
                setCouple(newCouple);setCachedCouple(newCouple);
                if(!newCouple.share_enabled){setPartnerLogs([]);setPartnerSettings(null);}
                else if(newCouple.share_enabled!==couple.share_enabled)void fetchPartnerDataInternal(newCouple,user.id);

                // If couple just became active, clear partner key cache to get fresh keys
                if (newCouple.status === 'active' && oldStatus !== 'active') {
                    import.meta.env.DEV && console.log('[Realtime] Couple active! Clearing partner key cache.');
                    partnerPublicKeyRef.current = null;
                    deviceKeysRef.current.clear();
                    setPartnerPubKey(null);
                    void refreshE2EE();
                }

            }
            if (payload.eventType === 'DELETE') clearRelationship(couple.id);
        }
      )
      .on('broadcast',{event:'note:created'},({payload})=>{void receiveNote(payload as SharedNote);})
      .on('postgres_changes',{event:'*',schema:'public',table:'user_keys',filter:'user_id=eq.'+partnerId},()=>{
        partnerPublicKeyRef.current=null;deviceKeysRef.current.clear();void fetchCoupleData();
      })
      .on('broadcast',{event:'note:updated'},({payload})=>{void receiveNote(payload as SharedNote);})
      .on('broadcast',{event:'note:deleted'},({payload})=>{setNotes(previous=>previous.filter(note=>note.id!==payload.id));})
      .on('broadcast',{event:'partner_data_updated'},({payload})=>{if(payload.senderId!==user.id)refreshPartner();})
      .on('postgres_changes',{event:'*',schema:'public',table:'shared_notes',filter:'couple_id=eq.'+couple.id},payload=>{
        if(payload.eventType==='DELETE')setNotes(previous=>previous.filter(note=>note.id!==payload.old.id));
        else void receiveNote(payload.new as unknown as SharedNote);
      })
      .subscribe(status=>{
        if(!active)return;
        const connected=status==='SUBSCRIBED';setChatConnected(connected);
        if(connected)void fetchCoupleData();
      });
    mainChannelRef.current=mainChannel;

    let partnerRefreshTimer:ReturnType<typeof setTimeout>|undefined;
    const refreshPartner=()=>{clearTimeout(partnerRefreshTimer);partnerRefreshTimer=setTimeout(()=>{const latest=relationshipRef.current;if(latest)void fetchPartnerDataInternal(latest,user.id);},60);};
    const partnerChannel=partnerId?supabase.channel('shared_health_'+couple.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_logs',filter:'user_id=eq.'+partnerId},refreshPartner)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_settings',filter:'user_id=eq.'+partnerId},refreshPartner)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:'id=eq.'+partnerId},refreshPartner).subscribe():null;
    const catchUp=()=>{if(document.visibilityState==='visible')void fetchCoupleData();};
    const retryOutbox=()=>{for(const entry of outboxRef.current)void persistChat(entry).catch(()=>{});catchUp();};
    window.addEventListener('focus',catchUp);window.addEventListener('online',retryOutbox);document.addEventListener('visibilitychange',catchUp);
    // A joined chat socket does not prove that the separate health subscription
    // delivered every update (sleep, reconnects, bulk imports, network changes).
    const statusPollInterval=setInterval(()=>{if(mainChannel.state!=='joined')catchUp();else if(document.visibilityState==='visible')refreshPartner();},20000);
    return () => {
      active=false;clearTimeout(partnerRefreshTimer);mainChannelRef.current=null;setChatConnected(false);
      window.removeEventListener('focus',catchUp);window.removeEventListener('online',retryOutbox);document.removeEventListener('visibilitychange',catchUp);
      supabase.removeChannel(mainChannel);
      if (partnerChannel) supabase.removeChannel(partnerChannel);
      if (statusPollInterval) clearInterval(statusPollInterval);
    };
  }, [couple?.id, user?.id, partnerId, couple?.status]);

  // Direct Broadcast helper
  const broadcastUpdate=(type:'log'|'settings'|'profile')=>{
    if(mainChannelRef.current?.state==='joined')void mainChannelRef.current.send({type:'broadcast',event:'partner_data_updated',payload:{type,senderId:user?.id}});
  };


  // Load older messages (pagination — prepend to the front)
  const loadOlderNotes = async () => {
    if (!couple?.id || !user || !hasMoreNotes || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const oldestNote = notes[0];
      if (!oldestNote) return;

      const { data, error } = await (supabase
        .from('shared_notes')
        .select('*')
        .eq('couple_id', couple.id as any)
        .or(cursorFilter(oldestNote))
        .order('created_at', { ascending: false }).order('id',{ascending:false})
        .limit(NOTES_PAGE_SIZE + 1) as any);

      if (error) throw error;
      if(relationshipRef.current?.id!==couple.id)return;
      const fetched = (data || []) as SharedNote[];
      setHasMoreNotes(fetched.length > NOTES_PAGE_SIZE);

      const partnerPubKey = await fetchPartnerPublicKey();
      const decryptedPage = await Promise.all(fetched.slice(0, NOTES_PAGE_SIZE).reverse().map(async (n) => {
          const cached = decryptedNotesCacheRef.current.get(n.id);
          if (cached && cached.content === n.content) return cached;

          const decrypted = await decryptNote(n, partnerPubKey, user.id);
          if(relationshipRef.current?.id!==couple.id)return decrypted;
          decryptedNotesCacheRef.current.set(n.id, decrypted);
          if (decryptedNotesCacheRef.current.size > MAX_DECRYPTED_CACHE) {
            const firstKey = decryptedNotesCacheRef.current.keys().next().value;
            if (firstKey) decryptedNotesCacheRef.current.delete(firstKey);
          }
          return decrypted;
      }));

      if(relationshipRef.current?.id!==couple.id)return;
      setNotes(previous=>mergeChatNotes(previous,decryptedPage,user.id));
    } catch (err) {
      console.error('Error loading older notes:', err);
    } finally {
      setLoadingOlder(false);
    }
  };


  const generatePairingCode = async () => {
    if(!user)throw new Error('Sign in first.');
    const {data,error}=await (supabase.rpc as any)('generate_pairing_code');
    if(error)throw error;
    relationshipRef.current=data;setCouple(data);setCachedCouple(data);
    return data.pairing_code as string;
  };
  const joinCouple = async (code:string) => {
    if(!user)throw new Error('Sign in first.');
    const {data,error}=await supabase.rpc('join_couple',{code_input:code.trim().toUpperCase()});
    if(error)throw error;
    relationshipRef.current=data as unknown as Couple;setCouple(data as unknown as Couple);setCachedCouple(data as unknown as Couple);
    await refreshE2EE();
  };

  const uploadMedia = async (file: File): Promise<string> => {
    if (!user || !couple) throw new Error('Not authenticated');
    if(!e2eeReady||!identityUsableRef.current)throw new Error('Restore your chats on this device before sending an attachment.');

    if (couple.status !== 'active') throw new Error('Connect to your partner first.');
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Attachments must be smaller than 20 MB.');
    if (!['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mp4'].includes(file.type.split(';')[0])) throw new Error('Unsupported attachment format.');
    const partnerKey = await fetchPartnerPublicKey();
    if (!partnerKey) throw new Error('Your partner must set up encryption before you can send attachments.');
    const encrypted = await encryptBlob(await file.arrayBuffer(), partnerKey);
    if(relationshipRef.current?.id!==couple.id)throw new Error('This connection has ended.');
    const path = couple.id + '/' + crypto.randomUUID() + '.enc';
    const { error } = await supabase.storage.from('chat-media').upload(path, encrypted, { contentType: 'application/octet-stream' });
    if (error) throw error;
    if(relationshipRef.current?.id!==couple.id)throw new Error('This connection has ended.');
    return 'chat-media:' + path;
  };

  const fetchPartnerPublicKey = async (manualUserId?: string, targetDeviceId?: string, forceRefresh = false): Promise<string | null> => {
    const scope=relationshipRef.current?.id;
    const id = manualUserId || partnerId;
    if (!id) return null;

    // 1. Cache lookup
    if (id === cachedPartnerIdRef.current && !forceRefresh) {
        if (targetDeviceId) {
            const devKey = deviceKeysRef.current.get(targetDeviceId);
            if (devKey) return devKey;
        } else if (partnerPublicKeyRef.current) {
            if (!targetDeviceId) setPartnerPubKey(partnerPublicKeyRef.current);
            return partnerPublicKeyRef.current;
        }
    }

    const {data,error}=await supabase.rpc('get_chat_public_key',{p_user_id:id});
    if(error)throw error;
    if(scope!==relationshipRef.current?.id)return null;
    if(data){partnerPublicKeyRef.current=data;cachedPartnerIdRef.current=id;setPartnerPubKey(data);}
    return data;
  };

  const persistChat=async(entry:QueuedChat)=>{
    if(!user||relationshipRef.current?.id!==entry.params.p_couple||sendingRef.current.has(entry.params.p_id))return;
    const id=entry.params.p_id;sendingRef.current.add(id);
    try{
      const {data,error}=await supabase.rpc('send_chat_note',entry.params).abortSignal(AbortSignal.timeout(12000));
      if(error)throw error;
      if(!aliveRef.current||relationshipRef.current?.id!==entry.params.p_couple)return;
      const note=await decryptNote(data as unknown as SharedNote,entry.params.p_recipient_key,user.id);
      if(relationshipRef.current?.id!==entry.params.p_couple)return;
      setNotes(previous=>mergeChatNotes(previous,[note],user.id));
      outboxRef.current=outboxRef.current.filter(item=>item.params.p_id!==id);
      writeOutbox(user.id,entry.params.p_couple,outboxRef.current);
    }catch(error){if(aliveRef.current)setNotes(previous=>previous.map(note=>note.id===id&&note.localStatus?{...note,localStatus:'failed'}:note));throw error;}
    finally{sendingRef.current.delete(id);}
  };
  const retryNote=async(id:string)=>{
    const entry=outboxRef.current.find(item=>item.params.p_id===id);if(!entry)return;
    setNotes(previous=>previous.map(note=>note.id===id?{...note,localStatus:'sending'}:note));
    await persistChat(entry);
  };

  const createNote = async (content:string,type:'text'|'image'|'audio'|'gif'='text',mediaUrl?:string,replyToId?:string)=>{
    if(!user||!couple||couple.status!=='active')throw new Error('Connect to your partner first.');
    if(!e2eeReady||!identityUsableRef.current)throw new Error('Restore your chats on this device before sending messages.');
    if(content.length>8000)throw new Error('Message is too long.');
    if(outboxRef.current.length>=30)throw new Error('Reconnect or retry your pending messages first.');
    const id=crypto.randomUUID(),createdAt=new Date().toISOString();
    const other=couple.partner_1_id===user.id?couple.partner_2_id:couple.partner_1_id;
    const partnerKey=await fetchPartnerPublicKey(other||undefined);
    if(!partnerKey)throw new Error('Your partner needs to open Twilight and set up their secure identity.');
    const privateKey=getCachedPrivateKey();if(!privateKey)throw new Error('Unlock your history first.');
    const senderKey=derivePublicKeyFromPrivate(privateKey);
    const [cipher,media]=await Promise.all([encryptMessage(content,partnerKey),mediaUrl?encryptMessage(mediaUrl,partnerKey):Promise.resolve(null)]);
    if(relationshipRef.current?.id!==couple.id)throw new Error('This connection has ended.');
    const entry:QueuedChat={createdAt,params:{p_id:id,p_couple:couple.id,p_content:cipher,p_sender_key:senderKey,p_recipient_key:partnerKey,p_type:type,p_media:media,p_reply:replyToId||null,p_device:deviceId}};
    const queued=[...outboxRef.current,entry];writeOutbox(user.id,couple.id,queued);outboxRef.current=queued;
    setNotes(previous=>[...previous,{id,couple_id:couple.id,sender_id:user.id,content,type,media_url:mediaUrl,reply_to_id:replyToId||null,reply_content:null,reactions:null,starred_by:null,pinned_by:null,is_forwarded:false,deleted_by:null,status:'sent',localStatus:'sending',created_at:createdAt}]);
    try{await persistChat(entry);}catch(error){throw Object.assign(new Error(error instanceof Error?error.message:'Message delivery failed'),{queued:true});}
  };

  const addReaction = async (noteId: string, emoji: string) => {
      if(!user) return;
      const note = notes.find(n => n.id === noteId);
      if(!note) return;

      const currentReactions: any[] = note.reactions || [];

      // Check if user already reacted with this emoji
      const existingReactionIndex = currentReactions.findIndex(r => r.user_id === user.id && r.emoji === emoji);
      let updatedReactions;

      if (existingReactionIndex !== -1) {
          // Remove reaction (toggle off)
          updatedReactions = [...currentReactions];
          updatedReactions.splice(existingReactionIndex, 1);
      } else {
          // Add reaction
          const newReaction = { user_id: user.id, emoji };
          updatedReactions = [...currentReactions, newReaction];
      }

      // Optimistic update
      setNotes((prev) => prev.map(n =>
        n.id === noteId ? { ...n, reactions: updatedReactions as any } : n
      ));

      try {
        // Store reactions as plain JSON — they are not sensitive (just emoji + user_id)
        // and encrypting them caused key-mismatch bugs when the note sender's device key
        // differs from the partner's general public key.
        const query: any = (supabase.from('shared_notes') as any).update({ reactions: updatedReactions });
        const { error } = await query.eq('id', noteId);

        if(error) throw error;
      } catch (error) {
        // Revert on error
        setNotes((prev) => prev.map(n =>
          n.id === noteId ? { ...n, reactions: currentReactions as any } : n
        ));
        throw error;
      }
  };

  // Toggle star for current user
  const toggleStar = async (noteId: string) => {
    if (!user) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const currentStarred: string[] = note.starred_by || [];
    const isStarred = currentStarred.includes(user.id);
    const updatedStarred = isStarred
      ? currentStarred.filter(id => id !== user.id)
      : [...currentStarred, user.id];

    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, starred_by: updatedStarred } : n
    ));

    try {
      const { error } = await (supabase.from('shared_notes' as any) as any)
        .update({ starred_by: updatedStarred })
        .eq('id', noteId);
      if (error) throw error;
    } catch (error) {
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, starred_by: currentStarred } : n
      ));
      throw error;
    }
  };

  // Toggle pin for current user
  const togglePin = async (noteId: string) => {
    if (!user) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const currentPinned: string[] = note.pinned_by || [];
    const isPinned = currentPinned.includes(user.id);
    const updatedPinned = isPinned
      ? currentPinned.filter(id => id !== user.id)
      : [...currentPinned, user.id];

    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, pinned_by: updatedPinned } : n
    ));

    try {
      const { error } = await (supabase.from('shared_notes' as any) as any)
        .update({ pinned_by: updatedPinned })
        .eq('id', noteId);
      if (error) throw error;
    } catch (error) {
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, pinned_by: currentPinned } : n
      ));
      throw error;
    }
  };

  // Delete note: "for me" (soft) or "for everyone" (hard delete or mark for all)
  const deleteNote = async (noteId: string, forEveryone = false) => {
    if (!user) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (forEveryone) {
      // Only sender can delete for everyone
      if (note.sender_id !== user.id) return;
      // Remove from local state immediately
      setNotes(prev => prev.filter(n => n.id !== noteId));
      try {
        const { error } = await (supabase.from('shared_notes' as any) as any)
          .delete()
          .eq('id', noteId);
        if (error) throw error;
      } catch (error) {
        // Re-add note on failure
        setNotes(prev => [...prev, note].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ));
        throw error;
      }
    } else {
      // Soft delete for this user only
      const currentDeleted: string[] = note.deleted_by || [];
      const updatedDeleted = [...currentDeleted, user.id];

      // Remove from local state
      setNotes(prev => prev.filter(n => n.id !== noteId));

      try {
        const { error } = await (supabase.from('shared_notes' as any) as any)
          .update({ deleted_by: updatedDeleted })
          .eq('id', noteId);
        if (error) throw error;
      } catch (error) {
        // Re-add note on failure
        setNotes(prev => [...prev, note].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ));
        throw error;
      }
    }
  };

  // Forward a note: re-send its content as a new message with is_forwarded flag
  const forwardNote = async (noteId: string) => {
    if (!user || !couple) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const resolvedPartnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
    if (!resolvedPartnerId) return;

    const pKey = await fetchPartnerPublicKey(resolvedPartnerId);
    if (!pKey) return;

    const encryptedContent = await encryptMessage(note.content, pKey);
    let encryptedMediaUrl = note.media_url;
    if (note.media_url && note.type !== 'gif') {
      encryptedMediaUrl = await encryptMessage(note.media_url, pKey);
    }

    const insertPayload: any = {
      couple_id: couple.id,
      sender_id: user.id,
      sender_device_id: deviceId,
      content: encryptedContent,
      type: note.type,
      media_url: encryptedMediaUrl,
      is_forwarded: true,
    };

    const { data: newNote, error } = await (supabase.from('shared_notes' as any).insert(insertPayload) as any).select().single();
    if (error) throw error;

    // Don't optimistically add to state — the Realtime INSERT handler will pick it up
  };

    const replyToNote = async (noteId: string, reply: string) => {
      if(!user) return;
      const note = notes.find(n => n.id === noteId);
      const previousReply = note?.reply_content;

      // Optimistic update
      setNotes((prev) => prev.map(n =>
        n.id === noteId ? { ...n, reply_content: reply } : n
      ));

      try {
        let finalReply = reply;
        const partnerPubKey = await fetchPartnerPublicKey();
        if (partnerPubKey) {
            finalReply = await encryptMessage(reply, partnerPubKey);
        }

        const { error } = await (supabase
          .from('shared_notes' as any)
          .update({ reply_content: finalReply } as any) as any)
          .eq('id', noteId as any);

        if(error) throw error;
      } catch (error) {
        // Revert on error
        setNotes((prev) => prev.map(n =>
          n.id === noteId ? { ...n, reply_content: previousReply } : n
        ));
        throw error;
      }
  };

  const markAsRead = async (noteIds: string[]) => {
    if (!user || noteIds.length === 0) return;

    const {error}=await supabase.from('shared_notes').update({status:'read'})
      .in('id',noteIds).neq('sender_id',user.id);
    if(error)throw error;
    if(!aliveRef.current)return;
    setNotes((prev) => prev.map(n =>
      noteIds.includes(n.id) ? { ...n, status: 'read' } : n
    ));
  };

  const fetchPartnerDataInternal=async(c:Couple,ownId:string)=>{
    const revision=++partnerFetchRevisionRef.current;
    const other=c.partner_1_id===ownId?c.partner_2_id:c.partner_1_id;
    if(!other||c.status!=='active')return;
    const current=()=>aliveRef.current&&revision===partnerFetchRevisionRef.current&&relationshipRef.current?.id===c.id;
    const mayShare=canReadSharedHealth(c,ownId,[c.partner_1_id,c.partner_2_id]);
    try{
      const [profile,settings,logs,key]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',other).maybeSingle(),
        mayShare?supabase.from('user_settings').select('*').eq('user_id',other).maybeSingle():Promise.resolve({data:null,error:null}),
        mayShare?loadHealthHistory(supabase,other,AbortSignal.timeout(15000)).then(data=>({data,error:null})):Promise.resolve({data:[],error:null}),
        mayShare?fetchPartnerPublicKey(other):Promise.resolve(null)
      ]);
      if(profile.error)throw profile.error;if(settings.error)throw settings.error;if(logs.error)throw logs.error;
      if(!current())return;setPartnerProfile(profile.data);
      if(!mayShare||!relationshipRef.current?.share_enabled){setPartnerSettings(null);setPartnerLogs([]);return;}
      let row=settings.data as any;
      if(row?.encrypted_payload&&key&&identityUsableRef.current){const decoded=await decryptData<any>(row.encrypted_payload,key,ownId);if(decoded)row={...row,...decoded};}
      const mapped=await Promise.all((logs.data||[]).map(async record=>{
        let data=record as any;
        if(data.encrypted_payload&&key&&identityUsableRef.current){const decoded=await decryptData<any>(data.encrypted_payload,key,ownId);if(decoded)data={...data,...decoded};}
        return {...data,periodStarted:data.is_period_start??data.periodStarted??false,energyLevel:data.energy_level??data.energyLevel,sleepQuality:data.sleep_quality??data.sleepQuality,sleepHours:data.sleep_hours??data.sleepHours};
      }));
      if(!current()||!relationshipRef.current?.share_enabled)return;
      setPartnerSettings(row?mapSettings(row):null);setPartnerLogs(mapped);
    }catch(error){if(current())console.error('Shared data refresh failed',error);}
  };

  // Memoized partner data for components to consume
  const partnerData = React.useMemo(() => ({
    profile: partnerProfile,
    settings: partnerSettings,
    logs: partnerLogs
  }), [partnerProfile, partnerSettings, partnerLogs]);

  const toggleGhostMode = async () => {
      if (!couple || !user) return;

      try {
          const newStatus = !couple.share_enabled;

          // Optimistic update
          setCouple(prev => prev ? { ...prev, share_enabled: newStatus } : null);

          // Use explicit casting to bypass intermittent schema mapping failures
          const { error } = await ((supabase
              .from('couples' as any) as any)
              .update({ share_enabled: newStatus } as any) as any)
              .eq('id', couple.id as any);

          if (error) throw error;
      } catch (err) {
          console.error('Error toggling ghost mode:', err);
          // Revert optimistic update
          setCouple(prev => prev ? { ...prev, share_enabled: !prev.share_enabled } : null);
      }
  };

  const generateLoveCode = async () => {
    if (!user || !couple) throw new Error('Not authenticated');

    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const code = Array.from(arr).map(b => (b % 36).toString(36)).join('').substring(0, 6).toUpperCase();
    const { error } = await (supabase
      .from('couples' as any) as any)
      .update({ love_code: code } as any)
      .eq('id', couple.id as any);

    if (error) throw error;
    setCouple(prev => prev ? { ...prev, love_code: code } : null);
    return code;
  };

  const unlockLoveNotes = async (code: string) => {
    if (!user || !couple) throw new Error('Not authenticated');

    const { data, error } = await (supabase
      .rpc('join_couple_love_lock', { code_input: code } as any) as any);

    if (error) throw error;
    setCouple(data as any);
  };

  const disconnectCouple = async () => {
    const id=relationshipRef.current?.id;
    if(!user||!id)throw new Error('No connection to unlink.');
    const {data,error}=await supabase.functions.invoke('couple-action',{body:{action:'unlink',coupleId:id}});
    if(error||!data?.unlinked)throw new Error(data?.error||'Unable to unlink. Please retry.');
    clearRelationship(id);
    identityRevisionRef.current++;identityUsableRef.current=false;clearEncryptionCache();
    setE2eeReady(false);setHasCloudBackup(false);setIsSyncRequired(false);
    await refreshE2EE();
    return {mediaDeleted:data.mediaDeleted===true};
  };

  const fetchPartnerData = React.useCallback(() => {
    return couple && user ? fetchPartnerDataInternal(couple, user.id) : Promise.resolve();
  }, [couple, user]);

  const setupCloudBackup = async (pin: string) => {
    if (!user) return;
    if(!identityUsableRef.current)throw new Error('Restore your existing identity first.');
    if(pin.length<8)throw new Error('Use at least 8 characters for your backup password.');
    const generation=identityGenerationRef.current,revision=identityRevisionRef.current;
    const { value: privKey } = await Preferences.get({ key: `${user.id}_private_key` });
    const { value: pubKey } = await Preferences.get({ key: `${user.id}_public_key` }); // Get public key too

    if (!privKey || !pubKey) {
        console.error('[E2EE] Keys not found locally during backup setup!');
        throw new Error('Keys not found locally');
    }

    const { ciphertext, salt } = await encryptIdentityWithPin(privKey, pin);
    if(!identityUsableRef.current||revision!==identityRevisionRef.current)throw new Error('This connection ended. Set up a new backup after reconnecting.');
    import.meta.env.DEV && console.log('[E2EE] Identity encrypted with PIN. Uploading to identity_backups...');

    const { error } = await (supabase
        .from('identity_backups' as any)
        .upsert({
            user_id: user.id,
            backup_identity: ciphertext,
            backup_salt: salt,
            public_key: pubKey,
            identity_generation:generation
        } as any) as any);

    if (error) {
        console.error('[E2EE] Backup upload failed:', error);
        throw error;
    }
    import.meta.env.DEV && console.log('[E2EE] Cloud Backup successfully enabled.');
    setHasCloudBackup(true);
  };

  const restoreFromCloudBackup=async(passphrase:string)=>{
    if(!user)return;
    const generation=identityGenerationRef.current,revision=identityRevisionRef.current;
    setRestorationState({isRestoring:true,progress:20,status:'Unlocking your encrypted identity…'});
    try{
      const {data,error}=await supabase.from('identity_backups').select('backup_identity,backup_salt,public_key').eq('user_id',user.id).single();
      if(error)throw error;
      const privateKey=await decryptIdentityWithPin(data.backup_identity,passphrase,data.backup_salt);
      if(!aliveRef.current||revision!==identityRevisionRef.current)throw new Error('This connection ended. Set up chat again.');
      await installRecoveredIdentity(user.id,privateKey,data.public_key,generation);
      partnerPublicKeyRef.current=null;deviceKeysRef.current.clear();decryptedNotesCacheRef.current.clear();
      identityUsableRef.current=true;setIsSyncRequired(false);setIsHistorySynced(true);
      setRestorationState({isRestoring:true,progress:70,status:'Loading your history…'});
      await refreshE2EE();setKeyVersion(v=>v+1);
    }finally{if(aliveRef.current)setRestorationState({isRestoring:false,progress:100,status:'Complete'});}
  };

  const completeSyncHandshake = async (token: string) => {
    if (!user) return;
    if(!identityUsableRef.current||isSyncRequired)throw new Error('Unlock your identity before approving another device.');
    const { value: privKey } = await Preferences.get({ key: `${user.id}_private_key` });
    if (!privKey) throw new Error('Private key not found locally');

    await sendSyncPayload(token, privKey, privKey);
  };

  const value = useMemo(() => ({
    couple,
    notes,
    chatConnected,
    isLoading: isLoading || authLoading,
    loading: isLoading || authLoading,
    hasMoreNotes,
    loadingOlder,
    loadOlderNotes,
    createNote,
    retryNote,
    generatePairingCode,
    joinCouple,
    addReaction,
    replyToNote,
    toggleStar,
    togglePin,
    deleteNote,
    forwardNote,
    markAsRead,
    setIsChatOpen,
    uploadMedia,
    isSupporter,
    partnerProfile,
    partnerSettings,
    partnerLogs,
    partnerPubKey,
    partnerData,
    fetchPartnerData,
    toggleGhostMode,
    generateLoveCode,
    unlockLoveNotes,
    disconnectCouple,
    broadcastUpdate,
    mapSettings,
    deviceId,
    hasCloudBackup,
    isHistorySynced,
    isSyncRequired,
    identityReady:e2eeReady,
    identityGeneration:identityGenerationRef.current,
    setupCloudBackup,
    restoreFromCloudBackup,
    completeSyncHandshake,
    refreshE2EE,
    keyVersion,
    restorationState,
  }), [
    couple, notes, chatConnected, isLoading, authLoading, hasMoreNotes, loadingOlder,
    isSupporter, partnerProfile, partnerSettings, partnerLogs, partnerPubKey,
    partnerData, deviceId, hasCloudBackup, isHistorySynced, isSyncRequired,
    keyVersion, restorationState, e2eeReady
  ]);

  return (
    <CouplesContext.Provider value={value}>
      {children}
    </CouplesContext.Provider>
  );
};

export const useCouples = () => {
  const context = useContext(CouplesContext);
  if (context === undefined) {
    throw new Error('useCouples must be used within a CouplesProvider');
  }
  return context;
};
