import { rawSupabase } from './supabase';
export async function vaultRecoveryAction(action: 'send-code' | 'reset', epoch: string, code?: string) {
  const { data: { session } } = await rawSupabase.auth.getSession();
  if (!session) throw new Error('Sign in again before recovering your account.');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vault-recovery`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, epoch, code }), signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Recovery could not be completed. Please retry.');
  return result as { queued?: boolean; reset?: boolean; sent?: boolean };
}
