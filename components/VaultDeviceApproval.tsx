import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { rawSupabase } from '../lib/supabase';
import { unlockedVault } from '../lib/vaultRuntime';
import { approveVaultTransfer, deviceCodeHash, normalizeDeviceCode } from '../lib/vaultTransfer';
import { SpringModal } from './ui/SpringModal';
import { AppIcon } from './ui/Icons';
import { MotionPortal } from './ui/MotionPortal';

export function VaultDeviceApprovalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  useEffect(() => { setCode(''); setBusy(false); setError(''); setDone(false); }, [open, user?.id]);
  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !user) return;
    setBusy(true); setError('');
    try {
      const normalized = normalizeDeviceCode(code), hash = await deviceCodeHash(normalized);
      const bundle = unlockedVault();
      if (bundle.userId !== user.id) throw new Error('Unlock this account first.');
      const result = await rawSupabase.from('vault_device_requests' as any).select('id,epoch,public_key').eq('code_hash', hash).eq('user_id', user.id).is('ciphertext', null).single();
      if (result.error || !result.data || (result.data as any).epoch !== bundle.epoch) throw new Error('The code is incorrect or expired. Check the new device.');
      const request = result.data as any;
      const ciphertext = await approveVaultTransfer(bundle, request.id, request.public_key, normalized);
      // An account switch during encryption must never authorize a transfer.
      if (unlockedVault() !== bundle) throw new Error('Account changed. Please retry.');
      const approval = await (rawSupabase.rpc as any)('approve_vault_device', { p_id: request.id, p_hash: hash, p_ciphertext: ciphertext });
      if (approval.error) throw new Error('The code expired or was already used. Request a new one.');
      setCode(''); setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Device approval failed. Please retry.'); }
    finally { setBusy(false); }
  };
  return <SpringModal open={open} onClose={busy ? undefined : onClose} label="Approve another device" className="vault-password-panel">
    <button className="vault-panel-close" aria-label="Close device approval" disabled={busy} onClick={onClose}><AppIcon name="close" size={22}/></button>
    <span className="reference-icon"><AppIcon name="Smartphone" size={30}/></span>
    <h2 className="mt-4 text-2xl font-bold">{done ? 'Device approved' : 'Approve another device'}</h2>
    {done ? <><p className="my-4">Your private records and chats can now open on your other device. You can set a new backup password from either unlocked device.</p><button className="reference-button w-full" onClick={onClose}>Done</button></> : <form className="vault-recovery-options" onSubmit={event => void approve(event)}>
      <p>Only continue if you just signed into your own account on another device. Approving gives that device access to your encrypted private records and chats.</p>
      <label>New device approval code<input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19} required value={code} onChange={event => setCode(event.target.value)}/></label>
      <p className="text-sm">Enter the 16-character code displayed on that device. Never approve a request from someone who contacts you claiming to be support.</p>
      {error && <p role="alert">{error}</p>}
      <button className="reference-button" disabled={busy}>{busy ? 'Approving…' : 'Approve and unlock device'}</button>
    </form>}
  </SpringModal>;
}

export function VaultDeviceApprovalNotice() {
  const { user } = useAuth(), { ready, epoch } = useVault();
  const [pending, setPending] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => {
    setPending(false); setOpen(false);
    if (!user || !ready || !epoch) return;
    let stopped = false, busy = false;
    const check = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const { data: { session } } = await rawSupabase.auth.getSession();
        if (!session || stopped) return;
        const sessionId = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id;
        const result = await rawSupabase.from('vault_device_requests' as any).select('id').eq('user_id', user.id).eq('epoch', epoch).neq('session_id', sessionId).is('ciphertext', null).limit(1);
        if (!stopped) setPending(!result.error && !!result.data?.length);
      } catch { /* An offline notification check must not block the app. */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => void check(), 15000);
    const resume = () => void check();
    document.addEventListener('visibilitychange', resume);
    void check();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [user?.id, ready, epoch]);
  if (!ready) return null;
  return <MotionPortal>{pending && <aside className="vault-device-notice" role="status"><AppIcon name="Smartphone" size={24}/><span>A new device is waiting for your approval.</span><button className="underline min-h-11" onClick={() => setOpen(true)}>Review</button></aside>}
    {open && <VaultDeviceApprovalModal open onClose={() => setOpen(false)}/>}</MotionPortal>;
}
