import { Capacitor } from '@capacitor/core';
import { notificationPath } from './notificationRoutes';

/** iOS foreground delivery from Realtime; this is not remote APNs delivery.
 * Never asks for permission during a game or replays notifications on login. */
export async function presentNativeGameInvitation(note: {id:string; message:string; data:unknown}, role: string | undefined, isCurrent:()=>boolean) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios' || !isCurrent()) return;
  const {LocalNotifications} = await import('@capacitor/local-notifications');
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' || !isCurrent()) return;
  const data = note.data as {url?:unknown} | null;
  const id = [...note.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7)%2000000000+10000;
  await LocalNotifications.schedule({notifications:[{id,title:'A game for the two of you',body:note.message,sound:'default',extra:{url:notificationPath(data?.url,'/games',role)}}]});
}
