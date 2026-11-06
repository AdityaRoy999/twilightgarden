import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { rawSupabase } from '../lib/supabase';
import { deviceCodeHash, newDeviceSecret, receiveVaultTransfer } from '../lib/vaultTransfer';
import { vaultRecoveryAction } from '../lib/vaultRecovery';
import { SpringModal } from './ui/SpringModal';
import { AppIcon } from './ui/Icons';

export function VaultRecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth(), vault = useVault();
  const [step, setStep] = useState<'choose' | 'device' | 'reset' | 'done'>('choose');
  const [code, setCode] = useState(''), [otp, setOtp] = useState(''), [sent, setSent] = useState(false);
  const [confirmation, setConfirmation] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expired, setExpired] = useState(false), [queued, setQueued] = useState(false);
  const revision = useRef(0), cancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    setStep('choose'); setCode(''); setOtp(''); setSent(false); setConfirmation(false); setBusy(false); setError('');
    return () => { revision.current++; cancel.current?.(); cancel.current = null; };
  }, [open, user?.id]);
  const showDevice = async () => {
    if (busy || !user || !vault.epoch) return;
    const current = ++revision.current, id = crypto.randomUUID(), epoch = vault.epoch, userId = user.id;
    cancel.current?.(); setError(''); setBusy(true); setExpired(false);
    try {
      const secret = await newDeviceSecret();
      const result = await (rawSupabase.rpc as any)('request_vault_device', { p_id: id, p_epoch: epoch, p_hash: await deviceCodeHash(secret.code), p_key: secret.publicKey, p_name: navigator.platform || 'New device' });
      if (result.error) throw result.error;
      if (current !== revision.current) { void (rawSupabase.rpc as any)('cancel_vault_device', { p_id: id }); return; }
      setCode(secret.code.match(/.{4}/g)!.join(' ')); setStep('device');
      let checking = false;
      const poll = async () => {
        if (checking || current !== revision.current || document.visibilityState === 'hidden') return;
        checking = true;
        try {
          const result = await (rawSupabase.rpc as any)('consume_vault_device', { p_id: id });
          if (result.error) throw result.error;
          if (!result.data || current !== revision.current) return;
          const canonical = await rawSupabase.from('account_vaults' as any).select('public_key,epoch').eq('user_id', userId).single();
          if (canonical.error || (canonical.data as any)?.epoch !== epoch) throw new Error('Vault changed. Sign in again.');
          const bundle = await receiveVaultTransfer(secret.privateKey, (canonical.data as any).public_key, secret.code, userId, epoch, id, result.data.ciphertext);
          if (current !== revision.current) return;
          await vault.acceptDevice(bundle);
          cancel.current?.(); setCode(''); onClose();
        } catch { if (current === revision.current) { setError('Could not verify the device transfer. Generate a new code and try again.'); cancel.current?.(); setCode(''); setExpired(true); } }
        finally { checking = false; }
      };
      const timer = setInterval(() => void poll(), 2000);
      const resume = () => void poll();
      document.addEventListener('visibilitychange', resume);
      const expiry = setTimeout(() => { if (current === revision.current) { revision.current++; setExpired(true); setCode(''); cancel.current?.(); } }, 5 * 60 * 1000);
      cancel.current = () => { clearInterval(timer); clearTimeout(expiry); document.removeEventListener('visibilitychange', resume); void (rawSupabase.rpc as any)('cancel_vault_device', { p_id: id }); };
    } catch (e) { if (current === revision.current) setError(e instanceof Error ? e.message : 'Could not request device approval. Please retry.'); }
    finally { if (current === revision.current) setBusy(false); }
  };
  const sendEmail = async () => {
    if (busy || !vault.epoch) return;
    setBusy(true); setError('');
    try { await vaultRecoveryAction('send-code', vault.epoch); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Email could not be sent.'); }
    finally { setBusy(false); }
  };
  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !confirmation || !vault.epoch) return;
    setBusy(true); setError('');
    try {
      const result = await vaultRecoveryAction('reset', vault.epoch, otp.trim());
      setQueued(!!result.queued); setStep('done'); setOtp('');
      // Keep a clear result visible until the user chooses to sign in again.
    } catch (e) { setError(e instanceof Error ? e.message : 'Reset could not be completed.'); }
    finally { setBusy(false); }
  };
  return <SpringModal open={open} onClose={busy || step === 'done' ? undefined : onClose} label="Recover your private space" className="vault-password-panel vault-recovery-panel">
    {step !== 'done' && <button className="vault-panel-close" aria-label="Close recovery" disabled={busy} onClick={onClose}><AppIcon name="close" size={22}/></button>}
    <span className="reference-icon"><AppIcon name={step === 'reset' ? 'delete' : 'key'} size={30}/></span>
    <h2 className="mt-4 text-2xl font-bold">{step === 'reset' ? 'Start fresh' : step === 'device' ? 'Approve this device' : step === 'done' ? 'Encrypted data reset' : 'Forgot backup password?'}</h2>
    {step === 'choose' && <div className="vault-recovery-options">
      <p>Keep your records by using another device where your private space is already unlocked.</p>
      <button className="reference-button" disabled={busy} onClick={() => void showDevice()}>Use an unlocked device</button>
      <p>On that device, you can also open Account → Backup password, choose “I forgot my current password”, and set a new one.</p>
      <button className="reference-button secondary" disabled={busy} onClick={() => { setStep('reset'); setError(''); }}>No unlocked device? Reset encrypted data</button>
    </div>}
    {step === 'device' && <div className="vault-recovery-options">
      <p>On your unlocked device, tap the device-approval notice or open Account → Backup password → Approve another device. Enter this code there.</p>
      {code && <output aria-label="New device code" className="vault-device-code">{code}</output>}
      <p role="status">{expired ? 'This code has expired. Generate another code to continue.' : 'Waiting for your approval. The code expires in five minutes.'}</p>
      <p className="text-sm">Only enter this code on your own unlocked device. Never send it to support or another person.</p>
      {expired && <button className="reference-button" disabled={busy} onClick={() => void showDevice()}>Generate another code</button>}
    </div>}
    {step === 'reset' && <form onSubmit={event => void reset(event)} className="vault-recovery-options">
      <p>This permanently deletes your encrypted health records, profile, preferences, backups and keys. It disconnects your partner and deletes shared chats, media and games for both of you. Their personal health records remain theirs.</p>
      <p>Your login account and privacy/age records stay. You will sign in again and create a new vault and backup password. Email verification cannot restore your old encrypted data.</p>
      <button type="button" className="reference-button secondary" disabled={busy || sent} onClick={() => void sendEmail()}>{sent ? 'Verification email sent' : 'Send verification email'}</button>
      {sent && <><label>Email verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} required value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}/></label>
        <label className="vault-saved-check"><input type="checkbox" checked={confirmation} onChange={event => setConfirmation(event.target.checked)}/><span className="vault-check-mark" aria-hidden="true"><AppIcon name="check" size={20}/></span><span>I understand that this deletes the data above permanently.</span></label>
        <button className="reference-button" disabled={busy || !confirmation || !/^\d{6,8}$/.test(otp)}>{busy ? 'Resetting…' : 'Permanently reset encrypted data'}</button></>}
      <button type="button" className="min-h-11 underline" disabled={busy} onClick={() => { setStep('choose'); setError(''); }}>Back to recovery options</button>
    </form>}
    {step === 'done' && <div className="vault-recovery-options"><p>{queued ? 'Your account is locked while remaining cleanup retries automatically. Sign in again later to set up a fresh private space.' : 'Your old encrypted data and keys have been deleted. Sign in again to create your new private space.'}</p><button className="reference-button" onClick={() => void signOut()}>Return to sign in</button></div>}
    {error && <p className="mt-4" role="alert">{error}</p>}
  </SpringModal>;
}
