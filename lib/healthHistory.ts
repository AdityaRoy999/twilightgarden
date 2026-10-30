/** Own and explicitly shared history use the same complete date-key pagination.
 * daily_logs is unique per (user_id,date), so new inserts do not shift pages. */
export async function loadHealthHistory(client: any, userId: string, signal?: AbortSignal): Promise<any[]> {
  if(client.privateContentVersion===1){
    // The encrypted repository already paginates opaque records and decrypts
    // locally. Applying date pagination again would repeatedly load all pages.
    let query=client.from('daily_logs').select('*').eq('user_id',userId).order('date',{ascending:false});
    if(signal)query=query.abortSignal(signal);const {data,error}=await query;if(error)throw error;return data||[];
  }
  const history: any[] = [];
  let before: string | undefined;
  const pageSize = 500;
  while (true) {
    let query = client.from('daily_logs').select('id,user_id,date,is_period_start,flow,moods,symptoms,notes,energy_level,sleep_hours,sleep_quality,encrypted_payload,created_at').eq('user_id',userId).order('date',{ascending:false}).limit(pageSize);
    if (before) query = query.lt('date',before);
    if (signal) query = query.abortSignal(signal);
    const {data,error} = await query;
    if (error) throw error;
    const rows = data || [];
    history.push(...rows);
    if (rows.length < pageSize) return history;
    const next = rows[rows.length-1]?.date;
    if (!next || next === before) throw new Error('History could not be fully loaded. Please retry.');
    before = next;
  }
}

/** Authorization is independent of the personal-vault decryption envelope. */
export function canReadSharedHealth(couple: {status: string; share_enabled: boolean}, ownId: string, members: readonly (string|null|undefined)[]) {
  return couple.status === 'active' && couple.share_enabled === true && members.includes(ownId);
}
