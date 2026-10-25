import { localDateKey } from '../lib/dates';
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Couple, SharedNote } from '../types';
import {
  initializeEncryptionKeys,
  encryptMessage,
  decryptMessage,
  encryptData,
  decryptData,
  encryptBlob,
  decryptBlob,
  encryptIdentityWithPin,
  decryptIdentityWithPin,
  setCachedPrivateKey,
  getCachedPrivateKey,
  clearSharedKeyCache,
  isContentDecrypted,
  derivePublicKeyFromPrivate,
} from '../lib/encryption';
import { sendSyncPayload } from '../lib/sync';
import { Preferences } from '@capacitor/preferences';

const NOTES_PAGE_SIZE = 50;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface CouplesContextType {
  couple: Couple | null;
  notes: SharedNote[];
  isLoading: boolean;
  loading: boolean;  // alias for isLoading
  hasMoreNotes: boolean;
  loadingOlder: boolean;
  loadOlderNotes: () => Promise<void>;
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
  disconnectCouple: () => Promise<void>;
  broadcastUpdate: (type: 'log' | 'settings' | 'profile') => void;
  mapSettings: (row: any) => any;
  partnerPubKey: string | null;
  deviceId: string | null;
  hasCloudBackup: boolean;
  isHistorySynced: boolean;
  isSyncRequired: boolean;
  setupCloudBackup: (pin: string) => Promise<void>;
  restoreFromCloudBackup: (pin: string) => Promise<void>;
  completeSyncHandshake: (token: string) => Promise<void>;
  refreshE2EE: () => Promise<void>;
  showPinSetup: boolean;
  setShowPinSetup: (v: boolean) => void;
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
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  };

  const setCachedCouple = (v: Couple | null) => {
    try {
      if (v) localStorage.setItem('tw_cached_couple', JSON.stringify(v));
      else localStorage.removeItem('tw_cached_couple');
    } catch { }
  };

  // Load cached decrypted notes from localStorage for instant display
  const getCachedNotes = (): SharedNote[] => {
    try {
      const cached = localStorage.getItem('tw_cached_notes');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  };
  const setCachedNotes = (n: SharedNote[]) => {
    try {
      // Only cache last 50 notes to keep localStorage size reasonable
      localStorage.setItem('tw_cached_notes', JSON.stringify(n.slice(-50)));
    } catch { }
  };

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
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [e2eeReady, setE2eeReady] = useState(false); // Prevents PIN popup race condition
  const [keyVersion, setKeyVersion] = useState(0);
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
    ? (couple.partner_1_id === user?.id && couple.partner_1_role === 'supporter') ||
      (couple.partner_2_id === user?.id)
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

  // Ref for hasCloudBackup to avoid stale closure in Realtime handler
  const hasCloudBackupRef = React.useRef(hasCloudBackup);
  useEffect(() => {
    hasCloudBackupRef.current = hasCloudBackup;
  }, [hasCloudBackup]);

  // Cache for partner's public key (Latest Active)
  const partnerPublicKeyRef = React.useRef<string | null>(null);
  // Cache for specific device keys (DeviceId -> PublicKey)
  const deviceKeysRef = React.useRef<Map<string, string>>(new Map());
  // Memory Cache for decrypted notes (ID -> Decrypted SharedNote) — capped at 200 entries
  const decryptedNotesCacheRef = React.useRef<Map<string, SharedNote>>(new Map());
  const MAX_DECRYPTED_CACHE = 200;

  // Guard: prevent overlapping refreshE2EE calls on double user/authLoading changes
  const refreshE2EERunningRef = React.useRef(false);

  // Wait for auth to be fully verified before fetching couple data.
  // Without this gate, the cached user triggers a fetch BEFORE the Supabase
  // client has restored its JWT session, so RLS blocks the query and couple = null.
  const refreshE2EE = async () => {
    if (!user) {
      setCouple(null);
      setNotes([]);
      setIsLoading(false);
      partnerPublicKeyRef.current = null;
      setPartnerPubKey(null);
      return;
    }

    // Prevent overlapping refreshE2EE calls (user + authLoading can change in quick succession)
    if (refreshE2EERunningRef.current) {
      import.meta.env.DEV && console.log('[E2EE] refreshE2EE already running — skipping duplicate call');
      return;
    }
    refreshE2EERunningRef.current = true;

    try {
    import.meta.env.DEV && console.log('[E2EE] Initializing for user:', user.id);

    // Clear partner cache on start/restart to ensure fresh keys are fetched correctly
    partnerPublicKeyRef.current = null;
    deviceKeysRef.current.clear();
    setPartnerPubKey(null);

    // 1. Get or Generate Device ID
    const { value: localDeviceId } = await Preferences.get({ key: 'tw_device_id' });
    const currentDeviceId = localDeviceId || crypto.randomUUID();
    if (!localDeviceId) await Preferences.set({ key: 'tw_device_id', value: currentDeviceId });
    setDeviceId(currentDeviceId);

    // 2. Local Key Management — get or create this user's key pair
    const pubKey = await initializeEncryptionKeys(user.id);
    import.meta.env.DEV && console.log('[E2EE] Local Public Key (Base64):', pubKey);

    // 3. Fetch all existing keys for this user to check for local key registration
    import.meta.env.DEV && console.log('[E2EE] Fetching existing keys for user:', user.id);
    const { data: existingKeys, error: keysError } = await (supabase
      .from('user_keys' as any)
      .select('*')
      .eq('user_id', user.id as any) as any);

    if (keysError) console.error('[E2EE] Error fetching keys:', keysError);
    import.meta.env.DEV && console.log('[E2EE] Found', existingKeys?.length, 'keys in user_keys table.');

    // 4. Check cloud identity status from persistent table
    import.meta.env.DEV && console.log('[E2EE] Checking persistent identity_backups table...');
    const { data: backupData, error: backupError } = await (supabase
      .from('identity_backups' as any)
      .select('*')
      .eq('user_id', user.id as any)
      .maybeSingle() as any);

    if (backupError) console.error('[E2EE] Error checking backups:', backupError);
    setHasCloudBackup(!!backupData);
    const cloudBackup = backupData;
    import.meta.env.DEV && console.log('[E2EE] Cloud Backup state:', !!cloudBackup);

    // 5. Determine Sync State
    // If our current public key is NOT in the database yet, it's a fresh install/wiped device.
    // If we ALSO have a cloud backup, we MUST restore it to read old history.
    const localKeyRegistered = existingKeys?.some((k: any) => k.public_key === pubKey);
    import.meta.env.DEV && console.log('[E2EE] Local key already in DB?', localKeyRegistered);

    if (!localKeyRegistered && cloudBackup) {
        console.warn('[E2EE] New device/identity detected with existing backup. Sync required.');
        setIsSyncRequired(true);
        setIsHistorySynced(false);
    } else {
        import.meta.env.DEV && console.log('[E2EE] Sync not required (Matched existing key OR no backup found).');
        setIsSyncRequired(false);
        setIsHistorySynced(true);
    }

    // 6. NOW Upsert this device's key (so other devices can find us)
    import.meta.env.DEV && console.log('[E2EE] Registering device key:', currentDeviceId);
    await (supabase.from('user_keys' as any) as any).upsert({
        user_id: user.id,
        device_id: currentDeviceId,
        public_key: pubKey,
        device_name: `${navigator.platform || 'Device'} (${currentDeviceId.slice(0, 4)})`,
        last_active: new Date().toISOString()
    } as any, { onConflict: 'user_id,device_id' });

    // Other registered devices are valid decryption routes. Remove a device only
    // through the explicit device-management action.

    await fetchCoupleData();

    // 6. After couple data loaded, auto-prompt PIN setup if no backup exists
    if (!cloudBackup) {
      import.meta.env.DEV && console.log('[E2EE] No backup found. Prompting PIN setup.');
      setShowPinSetup(true);
    }

    setE2eeReady(true); // Signal that backup check is complete
    } finally {
      refreshE2EERunningRef.current = false;
    }
  };

  useEffect(() => {
    if (authLoading) return;
    refreshE2EE();
  }, [user?.id, authLoading, keyVersion]);

  // Auto-prompt PIN setup when couple is active but no backup exists
  // GATED on e2eeReady to prevent false triggering before backup check completes
  useEffect(() => {
    if (e2eeReady && couple && couple.status === 'active' && !hasCloudBackup) {
      setShowPinSetup(true);
    }
  }, [couple, hasCloudBackup, e2eeReady]);

  const fetchCoupleData = async () => {
    try {
      if (!user) return;

      // Timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Couple data fetch timeout')), 10000)
      );

      const fetchDataPromise = async () => {
          // fetchData logic continued below

          // 2. Standard Fetch fallback
          const query = user.role === 'admin'
            ? (supabase.from('couples' as any).select('id,partner_1_id,partner_2_id,partner_1_role,status,pairing_code,share_enabled,love_code,love_unlocked,created_at') as any).eq('partner_1_id', user.id).order('created_at', { ascending: false })
            : (supabase.from('couples' as any).select('id,partner_1_id,partner_2_id,partner_1_role,status,pairing_code,share_enabled,love_code,love_unlocked,created_at') as any).or(`partner_1_id.eq.${user.id},partner_2_id.eq.${user.id}`).order('created_at', { ascending: false });

          const { data: rows, error: coupleError } = await query;

          if (coupleError) throw coupleError;

          const coupleRows = (rows || []) as Couple[];

          // Prefer the active couple; fall back to the newest pending one
          const activeCouple = coupleRows.find(r => r.status === 'active');
          const pendingCouple = coupleRows.find(r => r.status === 'pending');
          const coupleData = activeCouple || pendingCouple || null;

          // Auto-cleanup: delete stale pending rows when an active couple exists
          if (activeCouple && coupleRows.length > 1) {
            const staleIds = coupleRows.filter(r => r.id !== activeCouple.id).map(r => r.id);
            if (staleIds.length > 0) {
              supabase.from('couples').delete().in('id', staleIds).then(() => {
                import.meta.env.DEV && console.log('[Couples] Cleaned up', staleIds.length, 'stale couple rows');
              });
            }
          }

          setCouple(coupleData);
          setCachedCouple(coupleData);

          // Fast-clear loading state once basics are ready
          setIsLoading(false);

          if (coupleData) {
            // Fetch only the latest page of notes; older ones loaded on demand
            const { data: notesData, error: notesError } = await (supabase.from('shared_notes' as any) as any)
              .select('*')
              .eq('couple_id', coupleData.id)
              .order('created_at', { ascending: false })
              .limit(NOTES_PAGE_SIZE + 1);

            if (notesError) throw notesError;
            const fetched = (notesData || []) as SharedNote[];

            // E2EE Decryption Flow
            const resolvedPartnerId = coupleData.partner_1_id === user.id ? coupleData.partner_2_id : coupleData.partner_1_id;

            // Show cached decrypted notes OR in-memory decrypted notes while we decrypt
            // IMPORTANT: Do NOT replace visible decrypted notes with raw encrypted ones —
            // that causes the "encryption keys flash" bug on reload.
            const hasExistingDecryptedNotes = notes.length > 0 && notes.some(n => isContentDecrypted(n.content));
            if (!hasExistingDecryptedNotes) {
              // Only show raw initialNotes if we have nothing better to show
              const initialNotes = fetched.map(n => decryptedNotesCacheRef.current.get(n.id) || n);
              setHasMoreNotes(initialNotes.length > NOTES_PAGE_SIZE);
              setNotes(initialNotes.slice(0, NOTES_PAGE_SIZE).reverse());
            } else {
              setHasMoreNotes(fetched.length > NOTES_PAGE_SIZE);
            }

            // Ensure private key is loaded before any decryption attempt
            if (!getCachedPrivateKey()) {
              import.meta.env.DEV && console.log('[E2EE] Private key not in memory — loading from Preferences before decrypt');
              const { value: privKey } = await Preferences.get({ key: `${user.id}_private_key` });
              if (privKey) setCachedPrivateKey(privKey);
            }

            // Decrypt all notes at once (no chunked delays — crypto is fast)
            const partnerPubKey = await fetchPartnerPublicKey(resolvedPartnerId || undefined);
            const toDecrypt = fetched.slice(0, NOTES_PAGE_SIZE);

            const decryptedResults: SharedNote[] = await Promise.all(
              toDecrypt.map(async (note) => {
                // Use in-memory cache only if the note content hasn't changed in DB
                const cached = decryptedNotesCacheRef.current.get(note.id);
                // Compare against the original encrypted content to detect DB changes
                if (cached && cached._encryptedContent === note.content && isContentDecrypted(cached.content)) return cached;
                const decrypted = await decryptNote(note, partnerPubKey, user.id);
                // Only cache if decryption actually worked
                if (isContentDecrypted(decrypted.content)) {
                  // Store original encrypted content alongside for cache invalidation
                  (decrypted as any)._encryptedContent = note.content;
                  decryptedNotesCacheRef.current.set(note.id, decrypted);
                }
                // Evict oldest entries if cache exceeds limit
                if (decryptedNotesCacheRef.current.size > MAX_DECRYPTED_CACHE) {
                  const firstKey = decryptedNotesCacheRef.current.keys().next().value;
                  if (firstKey) decryptedNotesCacheRef.current.delete(firstKey);
                }
                return decrypted;
              })
            );

            // Set all decrypted notes at once — instant
            const finalNotes = decryptedResults.reverse()
              .filter(n => !n.deleted_by || !n.deleted_by.includes(user.id));
            setNotes(finalNotes);
            // Only cache to localStorage if notes are actually decrypted
            // This prevents "encrypted content poisoning" the cache on failed decryption
            if (finalNotes.length === 0 || finalNotes.some(n => isContentDecrypted(n.content))) {
              setCachedNotes(finalNotes);
            }

            // Mark received messages as delivered
            const unacknowledgedNotes = fetched
              .filter(n => n.sender_id !== user.id && n.status === 'sent')
              .map(n => n.id);

            if (unacknowledgedNotes.length > 0) {
              const query: any = (supabase.from('shared_notes') as any).update({ status: 'delivered' });
              await query.in('id', unacknowledgedNotes);
            }

            // Fetch Partner Data if available and authorized
            if (coupleData.status === 'active') {
                 await fetchPartnerDataInternal(coupleData, user.id);
            }
          }
      };

      await Promise.race([fetchDataPromise(), timeoutPromise]);

    } catch (error) {
      console.error('Error fetching couple data:', error);
      setIsLoading(false);
    }
  };

  const decryptNote = async (note: SharedNote, partnerPubKey: string | null, userId: string): Promise<SharedNote> => {
    if (!note.content) return note;

    const decryptFn = async (cipher: string, pKey: string | null) => {
        if (!pKey) return cipher;
        try {
            return await decryptMessage(cipher, pKey, userId);
        } catch (e) {
            console.warn('[E2EE] Decryption failed:', e);
            return cipher;
        }
    };

    try {
      // 1. Determine which key to use for this specific message
      // If we are the sender, we always use the partner's "latest" key
      // (because that's what we encrypted it with for self-decryption/backup flow)
      // If the partner is the sender, we MUST use the key for the device they sent it from.
      let currentPartnerKey = partnerPubKey;
      const isPartnerSender = note.sender_id !== userId;
      const deviceIdToFetch = isPartnerSender ? note.sender_device_id : undefined;

      if (deviceIdToFetch) {
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
                setCouple(newCouple);

                // If couple just became active, clear partner key cache to get fresh keys
                if (newCouple.status === 'active' && oldStatus !== 'active') {
                    import.meta.env.DEV && console.log('[Realtime] Couple active! Clearing partner key cache.');
                    partnerPublicKeyRef.current = null;
                    deviceKeysRef.current.clear();
                    setPartnerPubKey(null);
                    fetchCoupleData();
                }

                // Trigger PIN setup if this is a newly active couple and no backup exists
                if (newCouple.status === 'active' && !hasCloudBackupRef.current) {
                    setShowPinSetup(true);
                }
            }
            if (payload.eventType === 'DELETE') {
                import.meta.env.DEV && console.log('[Realtime] Couple deleted — cleaning up keys and state');
                // Wipe own stale user_keys (backup + old device entries)
                // so a fresh reconnect doesn't trigger false IdentityLockdown
                if (user) {
                  (async () => {
                    try {
                      await (supabase.from('user_keys' as any).delete()
                        .eq('user_id', user.id as any) as any);
                      // Re-register current device's key
                      const pubKey = await initializeEncryptionKeys(user.id);
                      await (supabase.from('user_keys' as any) as any).insert({
                        user_id: user.id,
                        device_id: deviceId,
                        public_key: pubKey,
                        device_name: `${navigator.platform || 'Device'} (${deviceId?.slice(0, 4)})`,
                        last_active: new Date().toISOString()
                      } as any);
                      setHasCloudBackup(false);
                    } catch (e) {
                      console.error('[Realtime] Key cleanup failed:', e);
                    }
                  })();
                }
                setCouple(null);
                setNotes([]);
                setPartnerProfile(null);
                setPartnerSettings(null);
                setPartnerLogs([]);
                partnerPublicKeyRef.current = null;
                setPartnerPubKey(null);
                setIsSyncRequired(false);
                setShowPinSetup(false);
            }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_notes', filter: `couple_id=eq.${couple.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            let newNote = payload.new as SharedNote;

            // WE MUST DECRYPT ON INSERT
            const partnerPubKey = await fetchPartnerPublicKey();
            newNote = await decryptNote(newNote, partnerPubKey, user.id);

            setNotes((prev) => {
              if (newNote.deleted_by && newNote.deleted_by.includes(user.id)) return prev;
              // If we sent this note, createNote already added it via optimistic update.
              // Skip to avoid the brief duplicate flash before React batches the removes.
              if (newNote.sender_id === user.id) {
                // Just replace in case the optimistic/returned note is already there
                const exists = prev.some(n => n.id === newNote.id);
                const hasTempVersion = prev.some(n => n.id.startsWith('temp-') && n.sender_id === user.id && n.content === newNote.content);
                if (exists) return prev;
                if (hasTempVersion) {
                  // Replace the temp note with the real one from realtime
                  let replaced = false;
                  return prev.map(n => {
                    if (!replaced && n.id.startsWith('temp-') && n.sender_id === user.id) {
                      replaced = true;
                      return newNote;
                    }
                    return n;
                  });
                }
                return prev; // Self-sent note will be handled by createNote's setNotes
              }
              return prev.some(n => n.id === newNote.id) ? prev : [...prev, newNote];
            });
            if (newNote.sender_id !== user.id && newNote.status === 'sent') {
              // When chat is open, LoveLock's markAsRead handles the 'read' transition
              // (with optimistic UI). Only set 'delivered' here when chat is closed.
              if (!isChatOpenRef.current) {
                (supabase.from('shared_notes' as any) as any).update({ status: 'delivered' } as any).eq('id', newNote.id).then();
              }
            }
          } else if (payload.eventType === 'UPDATE') {
             let updatedNote = payload.new as SharedNote;

              // WE MUST DECRYPT ON UPDATE
              const partnerPubKey = await fetchPartnerPublicKey();
              updatedNote = await decryptNote(updatedNote, partnerPubKey, user.id);

             setNotes((prev) => {
               // If this user deleted it, remove from list
               if (updatedNote.deleted_by && updatedNote.deleted_by.includes(user.id)) {
                 return prev.filter(n => n.id !== updatedNote.id);
               }
               return prev.map(n => {
                 if (n.id !== updatedNote.id) return n;
                 // Merge strategy: if the content decryption failed on this update
                 // (still looks like encrypted base64), keep the existing decrypted content
                 // and only apply metadata changes (reactions, status, starred, pinned, etc.)
                 if (!isContentDecrypted(updatedNote.content) && isContentDecrypted(n.content)) {
                   return {
                     ...n,
                     reactions: Array.isArray(updatedNote.reactions) ? updatedNote.reactions : n.reactions,
                     status: updatedNote.status || n.status,
                     starred_by: updatedNote.starred_by ?? n.starred_by,
                     pinned_by: updatedNote.pinned_by ?? n.pinned_by,
                     deleted_by: updatedNote.deleted_by ?? n.deleted_by,
                     is_forwarded: updatedNote.is_forwarded ?? n.is_forwarded,
                   };
                 }
                 return updatedNote;
               });
             });
          }
        }
      )
      .subscribe();

    // 2. PARTNER CHANNEL: Live Cycle Sync + Profile Sync
    let partnerChannel: any = null;
    if (couple.status === 'active' && partnerId && partnerId !== user.id) {
      partnerChannel = supabase
        .channel(`partner_realtime_${partnerId}`, { config: { private: true } })
        // Live profile sync (name, avatar changes)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
          (payload) => {
            import.meta.env.DEV && console.log('[Realtime] Partner profile synced');
            setPartnerProfile(payload.new as any);
          }
        )
        .on(
          'broadcast',
          { event: 'partner_data_updated' },
          (payload) => {
            import.meta.env.DEV && console.log('[Realtime] Broadcast received:', payload.payload.type);
            // Re-fetch partner data immediately on broadcast
            if (couple && user) {
               fetchPartnerDataInternal(couple, user.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${partnerId}` },
          (payload) => {
            import.meta.env.DEV && console.log('[Realtime] Partner settings synced', payload.eventType);
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const s = payload.new as any;
              let start = s.last_period_start || '';
              // Smart Fallback integration using Ref to avoid stale logs state
              if (!start && partnerLogsRef.current.length > 0) {
                const latest = [...partnerLogsRef.current].sort((a, b) => b.date.localeCompare(a.date)).find(l => l.flow);
                if (latest) {
                   import.meta.env.DEV && console.log('[Realtime] Settings fallback to latest log:', latest.date);
                   start = latest.date;
                }
              }
              setPartnerSettings(mapSettings({ ...s, last_period_start: start }));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${partnerId}` },
          (payload) => {
            import.meta.env.DEV && console.log('[Realtime] Partner log synced');
            const mapPartnerLog = (l: any) => ({
              ...l,
              energyLevel: l.energy_level,
              sleepQuality: l.sleep_quality,
              sleepHours: l.sleep_hours
            });

            if (payload.eventType === 'INSERT') {
              setPartnerLogs(prev => [mapPartnerLog(payload.new), ...prev].sort((a, b) => b.date.localeCompare(a.date)));
            } else if (payload.eventType === 'UPDATE') {
              const updated = mapPartnerLog(payload.new);
              setPartnerLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
            } else if (payload.eventType === 'DELETE') {
              setPartnerLogs(prev => prev.filter(l => l.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    }

    // 3. READ RECEIPT SYNC: Poll note statuses every 3s while chat is open
    // This ensures the sender sees read/delivered status even if Realtime misses
    let statusPollInterval: NodeJS.Timeout | null = null;
    statusPollInterval = setInterval(async () => {
      if (!isChatOpenRef.current || !couple?.id || !user) return;
      try {
        // Query ALL recent sent notes (not just sent/delivered) so we can
        // catch transitions to 'read' that Realtime may have missed.
        const { data } = await (supabase
          .from('shared_notes')
          .select('id, status')
          .eq('couple_id', couple.id)
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20) as any);

        if (data && data.length > 0) {
          setNotes(prev => prev.map(n => {
            const updated = (data as any[]).find(d => d.id === n.id);
            return updated && updated.status !== n.status
              ? { ...n, status: updated.status }
              : n;
          }));
        }
      } catch (err) {
        // Silent — polling is a fallback
      }
    }, 3000);

    return () => {
      supabase.removeChannel(mainChannel);
      if (partnerChannel) supabase.removeChannel(partnerChannel);
      if (statusPollInterval) clearInterval(statusPollInterval);
    };
  }, [couple?.id, user?.id, partnerId, couple?.status]);

  // Direct Broadcast helper
  const broadcastUpdate = (type: 'log' | 'settings' | 'profile') => {
    if (!couple?.id || !partnerId) return;

    const channelId = `partner_realtime_${user?.id}`; // Listeners listen to the sender's channel
    const ch = supabase.channel(channelId, { config: { private: true } });
    // Safety timeout: remove the channel after 5s regardless of subscription status
    const timeout = setTimeout(() => {
      try { supabase.removeChannel(ch); } catch {}
    }, 5000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'partner_data_updated',
          payload: { type, senderId: user?.id },
        }).then(() => {
          clearTimeout(timeout);
          supabase.removeChannel(ch);
        }).catch(() => {
          clearTimeout(timeout);
          supabase.removeChannel(ch);
        });
      }
    });
    import.meta.env.DEV && console.log('[Realtime] Broadcast sent:', type);
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
        .lt('created_at', oldestNote.created_at)
        .order('created_at', { ascending: false })
        .limit(NOTES_PAGE_SIZE + 1) as any);

      if (error) throw error;
      const fetched = (data || []) as SharedNote[];
      setHasMoreNotes(fetched.length > NOTES_PAGE_SIZE);

      const partnerPubKey = await fetchPartnerPublicKey();
      const decryptedPage = await Promise.all(fetched.slice(0, NOTES_PAGE_SIZE).reverse().map(async (n) => {
          const cached = decryptedNotesCacheRef.current.get(n.id);
          if (cached && cached.content === n.content) return cached;

          const decrypted = await decryptNote(n, partnerPubKey, user.id);
          decryptedNotesCacheRef.current.set(n.id, decrypted);
          if (decryptedNotesCacheRef.current.size > MAX_DECRYPTED_CACHE) {
            const firstKey = decryptedNotesCacheRef.current.keys().next().value;
            if (firstKey) decryptedNotesCacheRef.current.delete(firstKey);
          }
          return decrypted;
      }));

      setNotes(prev => [...decryptedPage.filter(n => !n.deleted_by || !n.deleted_by.includes(user.id)), ...prev]);
    } catch (err) {
      console.error('Error loading older notes:', err);
    } finally {
      setLoadingOlder(false);
    }
  };


  const generatePairingCode = async () => {
    if (!user) throw new Error('Not authenticated');

    // Guard: if we already have ANY couple (active OR pending), block new pairing
    if (couple) {
      if (couple.status === 'active') {
        throw new Error('You are already connected. Disconnect first to create a new pairing.');
      }
      // Already have a pending code — just return it
      if (couple.status === 'pending' && couple.pairing_code && Date.parse(couple.created_at) > Date.now() - 86400000) {
        return couple.pairing_code;
      }
    }

    // Double-check against the DB to prevent race conditions
    const { data: existing } = await (supabase
      .from('couples')
      .select('id, status, pairing_code, created_at') as any)
      .or(`partner_1_id.eq.${user.id},partner_2_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        throw new Error('You are already connected. Disconnect first to create a new pairing.');
      }
      if (existing.status === 'pending' && existing.pairing_code && existing.pairing_code.length === 6 && Date.parse(existing.created_at) > Date.now() - 86400000) {
        // Return the existing pending code instead of creating another
        return existing.pairing_code;
      }
      // Stale pending row OR legacy 4-char code — delete it to allow fresh 6-char generation
      await (supabase.from('couples').delete().eq('id', existing.id) as any);
    }

    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const code = Array.from(arr).map(b => (b % 36).toString(36)).join('').substring(0, 6).toUpperCase();

    const { data, error } = await (supabase
      .from('couples')
      .insert({
        partner_1_id: user.id,
        partner_1_role: user.role === 'partner' ? 'supporter' : 'menstruator',
        pairing_code: code,
        status: 'pending'
      } as any) as any)
      .select()
      .single();

    if (error) throw error;
    setCouple(data as any);
    return code;
  };

  const joinCouple = async (code: string) => {
  if (!user) throw new Error('Not authenticated');

  // Guard: block joining if this user ALREADY has an ACTIVE pairing.
  // If it's only 'pending' (e.g. they generated a code but now want to join instead),
  // allow them to proceed but cleanup the existing pending record first.
  if (couple) {
    if (couple.status === 'active') {
      throw new Error('You are already connected to a partner. Disconnect first to join another.');
    }
    // Delete our own pending record if we're now joining someone else's code
    await (supabase.from('couples' as any).delete() as any).eq('id', couple.id as any);
  }

  // Double-check the DB
  const { data: existingCouple } = await (supabase
    .from('couples')
    .select('id, status') as any)
    .or(`partner_1_id.eq.${user.id},partner_2_id.eq.${user.id}`)
    .not('status', 'eq', 'pending')
    .limit(1)
    .maybeSingle();

  if (existingCouple) {
    throw new Error('You are already connected to someone. Disconnect first.');
  }

  // The pairing RPC validates membership, account roles and code expiry atomically.
  const rpcCall: any = supabase.rpc.bind(supabase);
  const { data, error } = await rpcCall('join_couple', { code_input: code });

  if (error) throw error;

  setCouple(data as any);
  // Trigger PIN setup prompt for the joining user
  if (!hasCloudBackup) {
    setShowPinSetup(true);
  }
};

  const uploadMedia = async (file: File): Promise<string> => {
    if (!user || !couple) throw new Error('Not authenticated');

    if (couple.status !== 'active') throw new Error('Connect to your partner first.');
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Attachments must be smaller than 20 MB.');
    if (!['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mp4'].includes(file.type.split(';')[0])) throw new Error('Unsupported attachment format.');
    const partnerKey = await fetchPartnerPublicKey();
    if (!partnerKey) throw new Error('Your partner must set up encryption before you can send attachments.');
    const encrypted = await encryptBlob(await file.arrayBuffer(), partnerKey);
    const path = couple.id + '/' + crypto.randomUUID() + '.enc';
    const { error } = await supabase.storage.from('chat-media').upload(path, encrypted, { contentType: 'application/octet-stream' });
    if (error) throw error;
    return 'chat-media:' + path;
  };

  const fetchPartnerPublicKey = async (manualUserId?: string, targetDeviceId?: string, forceRefresh = false): Promise<string | null> => {
    const id = manualUserId || partnerId;
    if (!id) return null;

    // 1. Cache lookup
    if (!manualUserId && !forceRefresh) {
        if (targetDeviceId) {
            const devKey = deviceKeysRef.current.get(targetDeviceId);
            if (devKey) return devKey;
        } else if (partnerPublicKeyRef.current) {
            if (!targetDeviceId) setPartnerPubKey(partnerPublicKeyRef.current);
            return partnerPublicKeyRef.current;
        }
    }

    // 2. Try fetching from user_keys (Active Routes)
    let query = supabase
        .from('user_keys' as any)
        .select('public_key')
        .eq('user_id', id as any);

    if (targetDeviceId) {
        query = query.eq('device_id', targetDeviceId as any);
    } else {
        query = query.order('last_active', { ascending: false });
    }

    const { data, error } = await (query.limit(1).maybeSingle() as any);

    if (data?.public_key) {
        if (!manualUserId) {
            if (targetDeviceId) deviceKeysRef.current.set(targetDeviceId, data.public_key);
            else partnerPublicKeyRef.current = data.public_key;
        }
        if (!targetDeviceId) setPartnerPubKey(data.public_key);
        return data.public_key;
    }

    // 3. FALLBACK 1: If specific device key is missing, try ANY key for this user
    if (targetDeviceId) {
        import.meta.env.DEV && console.log('[E2EE] Specific device key missing, falling back to any key for user:', id);
        const { data: anyKeyData } = await (supabase
            .from('user_keys' as any)
            .select('public_key')
            .eq('user_id', id as any)
            .order('last_active', { ascending: false })
            .limit(1)
            .maybeSingle() as any);

        if (anyKeyData?.public_key) {
            deviceKeysRef.current.set(targetDeviceId, anyKeyData.public_key);
            return anyKeyData.public_key;
        }
    }

    // 4. FALLBACK 2: Try fetching from persistent identity_backups
    import.meta.env.DEV && console.log('[E2EE] Key not in active routes, checking identity_backups fallback...');
    const { data: backupData } = await (supabase
        .from('identity_backups' as any)
        .select('public_key')
        .eq('user_id', id as any)
        .maybeSingle() as any);

    if (backupData?.public_key) {
        import.meta.env.DEV && console.log('[E2EE] Found fallback key in identity_backups');
        if (!manualUserId) {
            if (targetDeviceId) deviceKeysRef.current.set(targetDeviceId, backupData.public_key);
            else partnerPublicKeyRef.current = backupData.public_key;
        }
        if (!targetDeviceId) setPartnerPubKey(backupData.public_key);
        return backupData.public_key;
    }

    console.warn('[E2EE] Could not fetch public key anywhere for user:', id, 'device:', targetDeviceId);
    return null;
  };

  const createNote = async (content: string, type: 'text' | 'image' | 'audio' | 'gif' = 'text', mediaUrl?: string, replyToId?: string) => {
    if (!user || !couple) return;

    // Optimistic update - add note immediately to UI
    const tempId = `temp-${Date.now()}`;
    const optimisticNote: SharedNote = {
      id: tempId,
      couple_id: couple.id,
      sender_id: user.id,
      content,
      reply_content: null,
      reply_to_id: replyToId || null,
      reactions: null,
      starred_by: null,
      pinned_by: null,
      is_forwarded: false,
      deleted_by: null,
      status: 'sent',
      type,
      media_url: mediaUrl,
      created_at: new Date().toISOString(),
    };

    setNotes((prev) => [...prev, optimisticNote]);

    try {
      const resolvedPartnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
      if (!resolvedPartnerId) throw new Error('No partner found to encrypt for');

      // 1. Encrypt content using ECDH shared secret
      // Proactive Fix: Always fetch the ABSOLUTE LATEST key from DB before encrypting
      // to ensure the recipient can read it if they just re-paired.
      const pKey = await fetchPartnerPublicKey(resolvedPartnerId);
      if (!pKey) throw new Error('Partner public key not found');

      const encryptedContent = await encryptMessage(content, pKey);
      let encryptedMediaUrl = mediaUrl;
      if (mediaUrl) {
          encryptedMediaUrl = await encryptMessage(mediaUrl, pKey);
      }

      // 2. Insert the Note
      const insertPayload: any = {
        couple_id: couple.id,
        sender_id: user.id,
        sender_device_id: deviceId,
        content: encryptedContent,
        type,
        media_url: encryptedMediaUrl,
      };
      if (replyToId) insertPayload.reply_to_id = replyToId;

      const { data: noteData, error: noteError } = await (supabase.from('shared_notes' as any).insert(insertPayload) as any).select().single();

      if (noteError) throw noteError;
      let note = noteData as SharedNote;

      // Decrypt for self
      const partnerPubKey = await fetchPartnerPublicKey(resolvedPartnerId);
      note = await decryptNote(note, partnerPubKey, user.id);

      setNotes((prev) => {
          if (prev.some(n => n.id === note.id)) {
              return prev.map(n => n.id === note.id ? note : n).filter(n => n.id !== tempId);
          }
          return prev.map(n => n.id === tempId ? note : n);
      });

      // Trigger Push Notification & In-App Notification
      const recipientId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
      if (recipientId) {
        // 1. Get nickname of the recipient for the sender
      let nickname = 'partner';
      try {
        const { data: recipientProfile } = await supabase
          .from('profiles')
          .select('partner_nickname')
          .eq('id', recipientId)
          .single();

        if (recipientProfile && (recipientProfile as any).partner_nickname) {
            nickname = (recipientProfile as any).partner_nickname;
        } else {
            // Fallback: Use Sender's First Name
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .single();
            if (senderProfile && (senderProfile as any).full_name) {
                nickname = (senderProfile as any).full_name.split(' ')[0];
            }
        }
      } catch (err) {
          console.warn('[CouplesContext] Failed to fetch nickname', err);
      }

      const displayMessage = `New love note from your ${nickname} ❤️`;

        // 3. Insert In-App Notification
        (supabase.from('notifications' as any) as any).insert({
          user_id: recipientId,
          type: 'chat',
          message: displayMessage,
          is_read: false,
          created_at: new Date().toISOString(),
        }).then(({ error }: any) => {
          if (error) console.error('In-app notification for note failed:', error);
        });
      }
    } catch (error) {
      // Remove optimistic note on error
      setNotes((prev) => prev.filter(n => n.id !== tempId));
      throw error;
    }
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

    // Optimistic update
    setNotes((prev) => prev.map(n =>
      noteIds.includes(n.id) ? { ...n, status: 'read' } : n
    ));

    await (supabase
      .from('shared_notes' as any)
      .update({ status: 'read' } as any) as any)
      .in('id', noteIds as any);
  };

  const fetchPartnerDataInternal = async (currentCouple: Couple, currentUserId: string) => {
      // Determine partner ID — must be the OTHER person in the couple
      const partnerId = currentCouple.partner_1_id === currentUserId
          ? currentCouple.partner_2_id
          : currentCouple.partner_1_id;

      import.meta.env.DEV && console.log('[PARTNER DEBUG] currentUserId:', currentUserId);
      import.meta.env.DEV && console.log('[PARTNER DEBUG] couple.partner_1_id:', currentCouple.partner_1_id);
      import.meta.env.DEV && console.log('[PARTNER DEBUG] couple.partner_2_id:', currentCouple.partner_2_id);
      import.meta.env.DEV && console.log('[PARTNER DEBUG] Resolved partnerId:', partnerId);

      // Safety guard: never fetch our own data as "partner"
      if (!partnerId || partnerId === currentUserId) {
        console.warn('[PARTNER] partnerId resolved to self or null — skipping fetch');
        return;
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Partner data fetch timeout')), 8000)
      );

      const fetchPromise = async () => {
          // Run all 3 queries in PARALLEL for instant loading
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const [profileResult, settingsResult, logsResult] = await Promise.all([
              // 1. Fetch Partner Profile
              (supabase
                  .from('profiles' as any)
                  .select('*')
                  .eq('id', partnerId as any)
                  .single() as any),
              // 2. Fetch User Settings (Cycle Data) — only if sharing enabled
              currentCouple.share_enabled
                  ? (supabase
                      .from('user_settings' as any)
                      .select('*') as any)
                      .eq('user_id', partnerId as any)
                      .maybeSingle()
                  : Promise.resolve({ data: null }),
              // 3. Fetch Recent Logs (Last 30 days) — only if sharing enabled
              currentCouple.share_enabled
                  ? (supabase
                      .from('daily_logs' as any)
                      .select('*') as any)
                      .eq('user_id', partnerId as any)
                      .gte('date', localDateKey(thirtyDaysAgo) as any)
                      .order('date', { ascending: false })
                  : Promise.resolve({ data: null }),
          ]);

          import.meta.env.DEV && console.log('[PARTNER DEBUG] Fetched profile:', profileResult.data?.full_name, 'avatar:', profileResult.data?.avatar_url);

          // Set profile immediately
          if (profileResult.data) setPartnerProfile(profileResult.data as any);

          // Process settings + logs
          if (currentCouple.share_enabled) {
              const settingsData = settingsResult.data;
              const logsData = logsResult.data as any[] | null;

              if (settingsData) {
                  let s = settingsData as any;

                  // Decrypt partner settings
                  if (s.encrypted_payload && partnerPubKey) {
                    const decrypted = await decryptData<any>(s.encrypted_payload, partnerPubKey, user.id);
                    if (decrypted) s = { ...s, ...decrypted };
                  }

                  let effectiveStart = s.last_period_start || s.lastPeriodStart || '';

                  // SMART FALLBACK: If start date is missing in settings, derive from logs
                  if (!effectiveStart && logsData && logsData.length > 0) {
                      const latestFlowLog = logsData.find((l: any) => l.flow);
                      if (latestFlowLog) {
                          import.meta.env.DEV && console.log('[PARTNER DEBUG] Using fallback lastPeriodStart from log:', latestFlowLog.date);
                          effectiveStart = latestFlowLog.date;
                      }
                  }

                  setPartnerSettings(mapSettings({
                      ...s,
                      last_period_start: effectiveStart
                  }));
              } else {
                  setPartnerSettings(null);
              }

              if (logsData) {
                  const mappedLogs = await Promise.all((logsData as any[]).map(async (l: any) => {
                      let data = { ...l };
                      if (l.encrypted_payload && partnerPubKey) {
                          const decrypted = await decryptData<any>(l.encrypted_payload, partnerPubKey, user.id);
                          if (decrypted) data = { ...data, ...decrypted };
                      }
                      return {
                          ...data,
                          energyLevel: data.energy_level || data.energyLevel,
                          sleepQuality: data.sleep_quality || data.sleepQuality,
                          sleepHours: data.sleep_hours || data.sleepHours
                      };
                  }));
                  setPartnerLogs(mappedLogs);
              }
          } else {
              setPartnerSettings(null);
              setPartnerLogs([]);
          }
      };

      try {
           await Promise.race([fetchPromise(), timeoutPromise]);
      } catch (error) {
          console.error('Error fetching partner data:', error);
      }
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
    if (!user || !couple) throw new Error('Not authenticated');

    try {
      import.meta.env.DEV && console.log('[E2EE] Wiping relationship data...');
      const partnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;

      // 1. Delete shared notes
      await (supabase
        .from('shared_notes' as any)
        .delete() as any)
        .eq('couple_id', couple.id as any);

      // 2. Delete the couple
      const { error } = await (supabase.from('couples' as any) as any).delete().eq('id', couple.id as any);
      if (error) throw error;

      // 3. Full key reset for BOTH users in the DB
      // This ensures the partner doesn't stay "Locked" if they miss the Realtime event
      await (supabase.from('user_keys' as any).delete()
        .eq('user_id', user.id as any) as any);

      // NOTE: Do NOT delete partner's keys — RLS should prevent it, and it would
      // break their E2EE on other couples. Partner's keys are cleaned up by their own client.

      // 4. Re-register current device's key (fresh entry, no backup)
      const pubKey = await initializeEncryptionKeys(user.id);
      await (supabase.from('user_keys' as any) as any).insert({
        user_id: user.id,
        device_id: deviceId,
        public_key: pubKey,
        device_name: `${navigator.platform || 'Device'} (${deviceId?.slice(0, 4)})`,
        last_active: new Date().toISOString()
      } as any);

      // 5. Reset local state
      partnerPublicKeyRef.current = null;
      setPartnerPubKey(null);
      setCouple(null);
      setNotes([]);
      setPartnerProfile(null);
      setPartnerSettings(null);
      setPartnerLogs([]);
      setIsSyncRequired(false);
      setIsHistorySynced(true);
    } catch (err) {
      console.error('Disconnect failed:', err);
      throw err;
    }
  };

  const fetchPartnerData = React.useCallback(() => {
    return couple && user ? fetchPartnerDataInternal(couple, user.id) : Promise.resolve();
  }, [couple, user]);

  const setupCloudBackup = async (pin: string) => {
    if (!user) return;
    import.meta.env.DEV && console.log('[E2EE] Setting up Cloud Backup...');
    const { value: privKey } = await Preferences.get({ key: `${user.id}_private_key` });
    const { value: pubKey } = await Preferences.get({ key: `${user.id}_public_key` }); // Get public key too

    if (!privKey || !pubKey) {
        console.error('[E2EE] Keys not found locally during backup setup!');
        throw new Error('Keys not found locally');
    }

    const { ciphertext, salt } = await encryptIdentityWithPin(privKey, pin);
    import.meta.env.DEV && console.log('[E2EE] Identity encrypted with PIN. Uploading to identity_backups...');

    const { error } = await (supabase
        .from('identity_backups' as any)
        .upsert({
            user_id: user.id,
            backup_identity: ciphertext,
            backup_salt: salt,
            public_key: pubKey // Populate public_key column
        } as any) as any);

    if (error) {
        console.error('[E2EE] Backup upload failed:', error);
        throw error;
    }
    import.meta.env.DEV && console.log('[E2EE] Cloud Backup successfully enabled.');
    setHasCloudBackup(true);
  };

  const restoreFromCloudBackup = async (pin: string) => {
    if (!user) return;
    import.meta.env.DEV && console.log('[E2EE] Attempting Identity Restoration from Cloud Backup...');
    const { data: backupRows, error: fetchError } = await (supabase
        .from('identity_backups' as any)
        .select('backup_identity, backup_salt')
        .eq('user_id', user.id as any)
        .limit(1) as any);

    if (fetchError) {
        console.error('[E2EE] Restoration fetch failed:', fetchError);
        throw fetchError;
    }

    const backup = backupRows?.[0];
    if (!backup) {
        console.error('[E2EE] No backup record found for user:', user.id);
        throw new Error('No cloud backup found');
    }

    import.meta.env.DEV && console.log('[E2EE] Found backup. Decrypting identity with PIN...');
    // 1. Decrypt the backed-up private key
    const decryptedPriv = await decryptIdentityWithPin(
        backup.backup_identity,
        pin,
        backup.backup_salt
    );
    import.meta.env.DEV && console.log('[E2EE] Identity decrypted successfully.');

    // 2. Derive the original public key from the restored private key
    const restoredPubKey = derivePublicKeyFromPrivate(decryptedPriv);
    import.meta.env.DEV && console.log('[E2EE] Restored Public Key (Base64):', restoredPubKey);

    // 3. Store both keys locally
    import.meta.env.DEV && console.log('[E2EE] Saving restored keys to local Preferences...');
    await Preferences.set({ key: `${user.id}_private_key`, value: decryptedPriv });
    await Preferences.set({ key: `${user.id}_public_key`, value: restoredPubKey });

    // 4. Update the in-memory cache so decryptMessage uses the restored key
    setCachedPrivateKey(decryptedPriv);

    // 4b. Clear the shared-key derivation cache — it may contain entries derived with
    // the WRONG (pre-restore) private key that was generated on first load.
    clearSharedKeyCache();

    // 5. Update user_keys AND identity_backups in the DB with the restored public key
    import.meta.env.DEV && console.log('[E2EE] Updating route and permanent identity with restored public key...');
    await Promise.all([
        (supabase
            .from('user_keys' as any)
            .update({ public_key: restoredPubKey, last_active: new Date().toISOString() } as any)
            .eq('user_id', user.id as any)
            .eq('device_id', deviceId as any) as any),
        (supabase
            .from('identity_backups' as any)
            .update({ public_key: restoredPubKey } as any)
            .eq('user_id', user.id as any) as any)
    ]);

    // 6. Clear ALL stale caches so fresh data is used
    partnerPublicKeyRef.current = null;
    deviceKeysRef.current.clear();
    decryptedNotesCacheRef.current.clear();  // Purge any failed decryption entries

    // Start UI Restoration Sequence
    setRestorationState({ isRestoring: true, progress: 10, status: 'Restoring secure identity...' });
    await sleep(800);

    setRestorationState({ isRestoring: true, progress: 40, status: 'Re-deriving shared keys...' });
    setIsHistorySynced(true);
    setIsSyncRequired(false);
    setHasCloudBackup(true);
    setE2eeReady(true);
    setKeyVersion(prev => prev + 1);
    await sleep(600);

    setRestorationState({ isRestoring: true, progress: 70, status: 'Decrypting secure history...' });
    // Reload everything with the NEW key
    await Promise.all([
      fetchCoupleData(),
      couple ? fetchPartnerDataInternal(couple, user.id) : Promise.resolve()
    ]);

    setRestorationState({ isRestoring: true, progress: 95, status: 'Finalizing...' });
    await sleep(500);

    setRestorationState({ isRestoring: false, progress: 100, status: 'Complete' });
    import.meta.env.DEV && console.log('[E2EE] Restoration complete.');
  };

  const completeSyncHandshake = async (token: string) => {
    if (!user) return;
    const { value: privKey } = await Preferences.get({ key: `${user.id}_private_key` });
    if (!privKey) throw new Error('Private key not found locally');

    await sendSyncPayload(token, privKey, privKey);
  };

  const value = useMemo(() => ({
    couple,
    notes,
    isLoading: isLoading || authLoading,
    loading: isLoading || authLoading,
    hasMoreNotes,
    loadingOlder,
    loadOlderNotes,
    createNote,
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
    setupCloudBackup,
    restoreFromCloudBackup,
    completeSyncHandshake,
    refreshE2EE,
    showPinSetup,
    setShowPinSetup,
    keyVersion,
    restorationState,
  }), [
    couple, notes, isLoading, authLoading, hasMoreNotes, loadingOlder,
    isSupporter, partnerProfile, partnerSettings, partnerLogs, partnerPubKey,
    partnerData, deviceId, hasCloudBackup, isHistorySynced, isSyncRequired,
    showPinSetup, keyVersion, restorationState
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
