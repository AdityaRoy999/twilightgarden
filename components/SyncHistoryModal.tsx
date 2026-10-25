import QRCode from 'react-qr-code';
import { derivePublicKeyFromPrivate, setCachedPrivateKey } from '../lib/encryption';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Smartphone, Laptop, QrCode, Shield,
  Key, RefreshCw, CheckCircle2, AlertCircle,
  Copy, ScanLine, ArrowRight, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCouples } from '../contexts/CouplesContext';
import { createSyncSession, sendSyncPayload } from '../lib/sync';
import { supabase } from '../lib/supabase';
import {
  initializeEncryptionKeys,
  encryptIdentityWithPin,
  decryptIdentityWithPin,
  encryptWithEphemeralKey,
  decryptWithEphemeralKey
} from '../lib/encryption';
import { Preferences } from '@capacitor/preferences';
import { SyncSession } from '../lib/sync';

interface SyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'sync' | 'backup';
}

export const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({ isOpen, onClose, initialTab = 'sync' }) => {
  const { user } = useAuth();
  const receiverChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const receiverRevision = useRef(0);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      receiverRevision.current++;
      clearTimeout(completionTimer.current);
      if(receiverChannel.current) void supabase.removeChannel(receiverChannel.current);
      receiverChannel.current=null;
    };
  },[isOpen,user?.id]);
  const {
    deviceId,
    completeSyncHandshake,
    refreshE2EE,
    restoreFromCloudBackup,
    hasCloudBackup
  } = useCouples();
  const [activeTab, setActiveTab] = useState<'sync' | 'backup'>(initialTab);
  const [mode, setMode] = useState<'idle' | 'receiver' | 'sender' | 'pin-restore' | 'pin-setup'>('idle');

  // Handle initial tab update if changed externally
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Sync States
  const [syncToken, setSyncToken] = useState('');
  const [session, setSession] = useState<any>(null);
  const [ephemeralPrivate, setEphemeralPrivate] = useState('');
  const [status, setStatus] = useState<'pending' | 'scanning' | 'completing' | 'success' | 'error'>('pending');
  const [error, setError] = useState('');

  // PIN States
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. RECEIVER MODE: This is a NEW device wanting keys
  const initiateReceiver = async () => {
    if (!user) return;
    setStatus('pending');
    setMode('receiver');
    const revision=++receiverRevision.current;
    if(receiverChannel.current) void supabase.removeChannel(receiverChannel.current);
    try {
        const { session: newSession, ephemeralPrivate: priv } = await createSyncSession(user.id);
        if(revision!==receiverRevision.current)return;
        setSession(newSession);
        setSyncToken(newSession.token);
        setEphemeralPrivate(priv);

        // Listen for completion
        const channel = supabase
            .channel(`sync_${newSession.token}`)
            .on('postgres_changes' as any, {
                event: 'UPDATE',
                schema: 'public',
                table: 'sync_sessions',
                filter: `id=eq.${newSession.id}`
            }, async (payload: any) => {
                const updated = payload.new as SyncSession;
                if (updated.status === 'completed' && updated.encrypted_payload) {
                    try {
                        setStatus('completing');
                        if(revision!==receiverRevision.current)return;
                        let senderKey: string, ciphertext: string;
                        if(updated.encrypted_payload.startsWith('{')){
                          const envelope=JSON.parse(updated.encrypted_payload);
                          if(envelope.version!==1||typeof envelope.senderPublicKey!=='string'||typeof envelope.ciphertext!=='string')throw new Error('Invalid handshake');
                          senderKey=envelope.senderPublicKey;ciphertext=envelope.ciphertext;
                        }else{
                          const {data:keys,error}=await supabase.from('user_keys').select('public_key').eq('user_id',user.id).order('last_active',{ascending:false}).limit(1);
                          if(error||!keys?.[0])throw new Error('Sender key not found');
                          senderKey=keys[0].public_key;ciphertext=updated.encrypted_payload;
                        }
                        const decryptedKey=await decryptWithEphemeralKey(ciphertext,priv,senderKey);
                        if(revision!==receiverRevision.current)return;
                        const publicKey=derivePublicKeyFromPrivate(decryptedKey);
                        await Preferences.set({key:user.id+'_private_key',value:decryptedKey});
                        await Preferences.set({key:user.id+'_public_key',value:publicKey});
                        setCachedPrivateKey(decryptedKey);
                        await supabase.from('sync_sessions').delete().eq('id',newSession.id);
                        setStatus('success');
                        completionTimer.current = setTimeout(async () => {
                            await refreshE2EE();
                            onClose();
                        }, 1500);
                    } catch (e) {
                        console.error('Handshake failed:', e);
                        setStatus('error');
                        setError('Handshake failed');
                    }
                }
            })
            .subscribe();

        receiverChannel.current = channel;
    } catch (err) {
        setStatus('error');
        setError('Failed to start session');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-y-auto no-scrollbar shadow-2xl border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5">
            <div>
              <h2 className="text-xl font-bold dark:text-white">History Sync</h2>
              <p className="text-sm text-gray-500">Access messages from all devices</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-gray-100 dark:bg-black/20 m-6 rounded-xl">
            {(['sync', 'backup'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-[#2C2C2E] text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'sync' ? 'Link via QR' : 'PIN Backup'}
              </button>
            ))}
          </div>

          <div className="px-6 pb-8">
            {activeTab === 'sync' ? (
              <div className="space-y-6">
                {mode === 'idle' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => initiateReceiver()}
                      className="flex flex-col items-center gap-3 p-6 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary/20 transition-all group"
                    >
                      <Laptop className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-semibold text-primary">This is my new device</span>
                    </button>
                    <button
                      onClick={() => setMode('sender')}
                      className="flex flex-col items-center gap-3 p-6 bg-pink-500/10 border border-pink-500/20 rounded-2xl hover:bg-pink-500/20 transition-all group"
                    >
                      <Smartphone className="w-8 h-8 text-pink-500 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-semibold text-pink-500">I have my old phone</span>
                    </button>
                  </div>
                )}

                {mode === 'receiver' && (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative p-4 bg-white rounded-2xl shadow-xl">
                      {syncToken ? (
                        <QRCode value={'twilightsync:'+syncToken} size={192} title="Device identity sync code" />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold dark:text-white">Scan this with your old phone</p>
                        <p className="text-xs text-gray-500">Go to Settings &gt; Backup &amp; Sync on your trusted device.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                        <span className="text-xs font-mono text-gray-500 uppercase">Code:</span>
                        <span className="text-sm font-mono font-bold tracking-widest text-primary uppercase">{syncToken}</span>
                    </div>
                  </div>
                )}

                {mode === 'sender' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                         <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                         <p className="text-xs text-amber-700 dark:text-amber-400">Enter the 8-digit code displayed on your new device to authorize it.</p>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="text"
                            maxLength={8}
                            placeholder="Enter 8-digit code"
                            value={syncToken}
                            onChange={(e) => setSyncToken(e.target.value.toUpperCase())}
                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold tracking-[0.2em] text-primary focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                        />
                        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                        <button
                            disabled={syncToken.length < 8 || isSubmitting}
                            onClick={async () => {
                                setIsSubmitting(true);
                                setError('');
                                try {
                                    await completeSyncHandshake(syncToken);
                                    setStatus('success');
                                    setTimeout(() => onClose(), 2000);
                                } catch (e: any) {
                                    setError(e.message || 'Authorization failed');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                            className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {status === 'success' ? <CheckCircle2 className="w-5 h-5 animate-bounce" /> : isSubmitting ? <RefreshCw className="animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            {status === 'success' ? 'Device Authorized!' : 'Authorize Device'}
                        </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                 <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                        <Lock className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold dark:text-white">PIN Backup</h3>
                        <p className="text-sm text-gray-500 px-4">Create a security PIN to restore your history if you lose access to all your devices.</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                     {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                     <div className="flex justify-center gap-2">
                         {[1,2,3,4,5,6].map((i) => (
                             <div
                                key={i}
                                className={`w-8 h-10 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${
                                    pin.length >= i ? 'border-primary bg-primary/5 dark:text-white' : 'border-gray-100 dark:border-white/5'
                                }`}
                             >
                                {pin.length >= i ? '●' : ''}
                             </div>
                         ))}
                     </div>

                     <div className="grid grid-cols-3 gap-1.5 px-4">
                         {[1,2,3,4,5,6,7,8,9,0].map(n => (
                             <button
                                key={n}
                                onClick={() => pin.length < 6 && setPin(p => p + n)}
                                className="h-10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg font-bold text-base dark:text-white transition-colors"
                             >
                                {n}
                             </button>
                         ))}
                         <button
                            onClick={() => setPin(p => p.slice(0, -1))}
                            className="h-10 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center transition-colors"
                         >
                            <span className="material-symbols-outlined text-lg">backspace</span>
                         </button>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <button
                            disabled={pin.length < 6 || isSubmitting}
                            onClick={async () => {
                                setIsSubmitting(true);
                                setError('');
                                try {
                                     const { value: privKey } = await Preferences.get({ key: `${user?.id}_private_key` });
                                     if (!privKey) throw new Error('Local keys missing');
                                     const { ciphertext, salt } = await encryptIdentityWithPin(privKey, pin);

                                     // Upsert into dedicated identity_backups table for persistence
                                     const { error: upsertError } = await (supabase.from('identity_backups' as any) as any)
                                        .upsert({
                                            user_id: user?.id,
                                            backup_identity: ciphertext,
                                            backup_salt: salt
                                        } as any);

                                     if (upsertError) throw upsertError;

                                     setStatus('success');
                                     setTimeout(() => setPin(''), 1000);
                                 } catch (e: any) {
                                     setError(e.message || 'Backup failed');
                                 } finally {
                                     setIsSubmitting(false);
                                 }
                             }}
                             className="py-2.5 bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition-all disabled:opacity-50 text-sm"
                         >
                             Enable Backup
                         </button>
                          <button
                             disabled={pin.length < 6 || isSubmitting}
                             onClick={async () => {
                                 setIsSubmitting(true);
                                 setError('');
                                 console.log('[SyncHistoryModal] Starting PIN restoration...');
                                 try {
                                     await restoreFromCloudBackup(pin);
                                     console.log('[SyncHistoryModal] Restoration SUCCESS.');
                                     // Notes decrypt in the background — close modal immediately
                                     onClose();
                                 } catch (err: any) {
                                     console.error('[SyncHistoryModal] Restoration FAILED:', err);
                                     setError(err.message || 'Incorrect PIN or restore failed');
                                 } finally {
                                     setIsSubmitting(false);
                                 }
                             }}
                             className="py-2.5 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 text-sm"
                         >
                             Restore History
                         </button>
                     </div>
                 </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
