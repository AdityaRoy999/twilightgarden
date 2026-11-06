import { adminClient } from './security.ts';
import { cleanChatMedia } from './chatCleanup.ts';

export async function resetVaultData(actor: string, couples: string[], db = adminClient()) {
  for (const id of couples) await cleanChatMedia(id, db);
  for (let page = 0; page < 100; page++) {
    const { data, error } = await db.rpc('account_storage_objects', { p_actor: actor });
    if (error) throw error;
    if (!data?.length) break;
    for (const bucket of new Set<string>(data.map((o: { bucket_id: string }) => o.bucket_id))) {
      const result = await db.storage.from(bucket).remove(data.filter((o: { bucket_id: string }) => o.bucket_id === bucket).map((o: { name: string }) => o.name));
      if (result.error) throw result.error;
    }
    if (page === 99) throw new Error('More cleanup remains');
  }
  const result = await db.rpc('finish_vault_reset', { p_actor: actor });
  if (result.error) throw result.error;
}
export async function retryVaultResets(db = adminClient()) {
  const { data, error } = await db.rpc('pending_vault_resets');
  if (error) throw error;
  for (const job of data || []) {
    try { await resetVaultData(job.user_id, job.couple_ids, db); }
    catch { console.error('Encrypted data reset queued for retry'); }
  }
}
