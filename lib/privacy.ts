export const PRIVACY_NOTICE_VERSION = '2026-10-30';
export interface PrivacyPreferences {
  age_band: 'under13' | '13-17' | '18+';
  core_consent: boolean; health_consent: boolean; share_health: boolean;
  ai_consent: boolean; shopping_consent: boolean; notice_version: string; deleting?: boolean;
}
export function canEnterPrivateApp(p: PrivacyPreferences | null, role?: string) {
  return !!p && !p.deleting && p.age_band === '18+' && p.core_consent &&
    p.notice_version === PRIVACY_NOTICE_VERSION && (role === 'partner' || role === 'admin' || p.health_consent);
}
/** Remove legacy plaintext snapshots; keep auth and encrypted identity recovery. */
export function clearHealthSnapshots(storage: Pick<Storage,'length'|'key'|'removeItem'>) {
  for (let i=storage.length-1;i>=0;i--) {
    const key=storage.key(i);
    if(key && /^(tw_logs_|tw_settings_|twilight-guide|twilight-wellness)/.test(key)) storage.removeItem(key);
  }
}
