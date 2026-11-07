import { preparePrivateRecord, savePrivateBatch, readPrivateRows, invalidatePrivateRecords } from './privateData';
import { unlockedVault } from './vaultRuntime';
export const chatThemes = ['garden', 'rose', 'lavender', 'mint', 'plain'] as const;
export type ChatTheme = typeof chatThemes[number];
export type ChatSettings = { coupleId: string; theme: ChatTheme; muted: boolean };
export async function loadChatSettings(coupleId: string): Promise<ChatSettings> {
  const rows = await readPrivateRows(unlockedVault().userId, 'chat_settings') as ChatSettings[];
  return rows.find(row => row.coupleId === coupleId) || { coupleId, theme: 'garden', muted: false };
}
export async function saveChatSettings(value: ChatSettings) {
  const row = await preparePrivateRecord('chat_settings', value.coupleId, value, null);
  row.couple_id = value.coupleId;
  await savePrivateBatch([row]);
  invalidatePrivateRecords(row.owner_id, 'chat_settings');
  window.dispatchEvent(new CustomEvent('twilight-chat-settings', { detail: value }));
}
