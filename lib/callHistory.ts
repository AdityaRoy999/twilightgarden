import { preparePrivateRecord, savePrivateBatch, readPrivateRows, invalidatePrivateRecords } from './privateData';
import { optionalVault } from './vaultRuntime';

export type CallRecord = {
  id: string; coupleId: string; direction: 'incoming' | 'outgoing'; video: boolean;
  startedAt: string; answeredAt?: string; endedAt: string;
  outcome: 'answered' | 'missed' | 'declined' | 'cancelled' | 'failed'; durationSeconds: number;
};
export type ActiveCallRecord = Omit<CallRecord, 'endedAt' | 'outcome' | 'durationSeconds'> & { ownerId: string };
export function finishCall(record: ActiveCallRecord, outcome?: CallRecord['outcome'], now = Date.now()): CallRecord {
  const { ownerId: _, ...value } = record;
  return { ...value, endedAt: new Date(now).toISOString(), outcome: record.answeredAt ? 'answered' : outcome || (record.direction === 'incoming' ? 'missed' : 'cancelled'),
    durationSeconds: record.answeredAt ? Math.max(0, Math.floor((now - Date.parse(record.answeredAt)) / 1000)) : 0 };
}
/** Each device writes only its owner's encrypted record. No call content or keys reach the server. */
export async function persistCall(record: ActiveCallRecord, outcome?: CallRecord['outcome']) {
  if (optionalVault()?.userId !== record.ownerId) return;
  const row = await preparePrivateRecord('call_history', `${record.coupleId}:${record.id}`, finishCall(record, outcome), null);
  row.couple_id = record.coupleId;
  if (optionalVault()?.userId !== record.ownerId) return;
  await savePrivateBatch([row]);
  window.dispatchEvent(new Event('twilight-calls-changed'));
}
export async function loadCallHistory(ownerId: string, coupleId: string) {
  invalidatePrivateRecords(ownerId, 'call_history');
  const rows = await readPrivateRows(ownerId, 'call_history') as CallRecord[];
  return rows.filter(row => row.coupleId === coupleId && typeof row.startedAt === 'string')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export function callDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
